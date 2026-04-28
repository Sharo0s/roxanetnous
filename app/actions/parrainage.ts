'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  sendParrainageBienvenueMarraine,
  sendParrainageFilleuleConfirmation,
  sendAdminParrainageFlag,
} from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { normalizeEmail } from '@/lib/parrainage-detection'
import {
  generateCode,
  generateCodeForUserSystem,
  type GenerateCodeResult,
} from '@/lib/parrainage-codes'

// Alphabet 31 chars sans 0/O/1/I/L (lisibilité). Doit rester en sync avec lib/parrainage-codes.ts.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const CODE_REGEX = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

function normalizeCode(input: string): string {
  return (input || '').toUpperCase().replace(/[\s-]/g, '')
}

// Story 2.3 AC1 : helper interne (non export) appelé depuis createParrainageRelation
// après l'INSERT initial. Détecte les signaux disponibles AU SIGNUP : email marraine =
// email filleule (BLOCAGE), IP filleule = IP d'une autre filleule de la même marraine
// (FLAG). Les autres signaux (téléphone/adresse/carte) sont évalués au webhook (AC3).
async function detectBlacklist(params: {
  marraineId: string
  filleuleId: string
  filleuleEmail: string | null | undefined
  ipInscription: string | null | undefined
  parrainageId: string
}): Promise<{ blocage?: 'meme_email'; flag?: 'meme_ip' }> {
  const supabaseAdmin = await createClient({ serviceRole: true })

  // Lookup email marraine + comparaison case-insensitive (index idx_users_email_lower).
  const filleuleEmailNorm = normalizeEmail(params.filleuleEmail || '')
  if (filleuleEmailNorm) {
    const { data: marraineUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', params.marraineId)
      .maybeSingle()

    const marraineEmailNorm = normalizeEmail((marraineUser?.email as string) || '')
    if (marraineEmailNorm && marraineEmailNorm === filleuleEmailNorm) {
      return { blocage: 'meme_email' }
    }
  }

  // Lookup IP : une autre row parrainages de la même marraine avec la même IP.
  if (params.ipInscription && params.ipInscription.trim()) {
    const { data: ipMatches } = await supabaseAdmin
      .from('parrainages')
      .select('id')
      .eq('marraine_id', params.marraineId)
      .neq('id', params.parrainageId)
      .eq('ip_inscription', params.ipInscription)
      .limit(1)
    if (ipMatches && ipMatches.length > 0) {
      return { flag: 'meme_ip' }
    }
  }

  return {}
}

// Story 2.3 AC4 : helper interne pour révoquer la validation parrainage en cas de
// fraude détectée APRÈS qu'elle ait été appliquée (ex: meme_carte au webhook).
// Ne révoque PAS l'abonnement Stripe : la filleule a payé, elle peut continuer à
// l'utiliser. Révoque uniquement le bypass de validation (la filleule devra repasser
// par OCR + visio si elle veut être validée).
async function revokeFilleuleValidation(
  filleuleId: string,
  raison: string,
  context: { adminId?: string | null; parrainageId?: string; marraineId?: string } = {},
): Promise<void> {
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: profile } = await supabaseAdmin
    .from('accompagnantes_profiles')
    .select('id, validation_status, validation_source')
    .eq('user_id', filleuleId)
    .maybeSingle()

  // Si la filleule était validée par parrainage, on remet en attente.
  if (profile?.validation_source === 'parrainage' && profile?.validation_status === 'valide') {
    await supabaseAdmin
      .from('accompagnantes_profiles')
      .update({
        validation_status: 'en_attente',
        validation_source: 'manuelle',
        validation_date: null,
      })
      .eq('id', profile.id)
  }

  // Toujours retirer le lien parrainee_par.
  await supabaseAdmin
    .from('users')
    .update({ parrainee_par: null })
    .eq('id', filleuleId)

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: context.adminId ?? null,
    action_type: 'parrainage_fraude_confirmee',
    target_type: 'parrainage',
    target_id: context.parrainageId ?? null,
    details: {
      via: raison,
      filleule_id: filleuleId,
      marraine_id: context.marraineId ?? null,
    },
  })
}

// Re-export interne pour le webhook (qui ne peut pas importer depuis un fichier
// 'use server' avec usage non-action). Utilisable comme server action depuis le webhook.
export async function revokeFilleuleValidationFromWebhook(
  filleuleId: string,
  raison: string,
  context: { parrainageId?: string; marraineId?: string } = {},
): Promise<void> {
  return revokeFilleuleValidation(filleuleId, raison, context)
}

export async function generateCodeForUser(userId: string): Promise<GenerateCodeResult> {
  if (!userId) return { error: 'userId manquant.' }

  // Authz : seul l'utilisateur lui-même ou un admin peut générer un code pour cet userId.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  if (user.id !== userId) {
    const { data: caller } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (caller?.role !== 'admin') {
      return { error: 'Accès refusé.' }
    }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Idempotence : si une ligne existe déjà, retourner le code existant
  const { data: existing } = await supabaseAdmin
    .from('parrainages_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.code) {
    return { code: existing.code }
  }

  // Retry max 3 fois en cas de collision UNIQUE (probabilité quasi nulle, ceinture+bretelles)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode()
    const { error } = await supabaseAdmin
      .from('parrainages_codes')
      .insert({
        user_id: userId,
        code,
        compteur_confirmes: 0,
        total_recompenses: 0,
      })

    if (!error) {
      return { code }
    }

    // 23505 = unique_violation. Si la collision est sur user_id (PK), retourner le code existant.
    if ((error as { code?: string }).code !== '23505') {
      return { error: 'Erreur lors de la création du code de parrainage.' }
    }

    const { data: nowExisting } = await supabaseAdmin
      .from('parrainages_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle()
    if (nowExisting?.code) {
      return { code: nowExisting.code }
    }
  }

  return { error: 'Impossible de générer un code unique après plusieurs tentatives.' }
}

export type ValidationCodeResult =
  | { valid: true; marraineId: string; marraineFirstName: string }
  | {
      valid: false
      reason:
        | 'invalid_format'
        | 'invalid_chars'
        | 'unknown_code'
        | 'marraine_not_validated'
        | 'marraine_subscription_inactive'
    }

export async function validateCode(rawCode: string): Promise<ValidationCodeResult> {
  const code = normalizeCode(rawCode)
  if (!code) {
    return { valid: false, reason: 'invalid_format' }
  }
  if (code.length !== CODE_LENGTH) {
    return { valid: false, reason: 'invalid_format' }
  }
  if (!CODE_REGEX.test(code)) {
    return { valid: false, reason: 'invalid_chars' }
  }

  // RLS bloque la lecture anon de parrainages_codes (auth.uid() = user_id requis).
  // La fonction étant appelée depuis le formulaire d'inscription non authentifié,
  // on utilise le service role pour cette lecture publique de validation.
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: row } = await supabaseAdmin
    .from('parrainages_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle()

  if (!row?.user_id) {
    return { valid: false, reason: 'unknown_code' }
  }

  const { data: marraine } = await supabaseAdmin
    .from('users')
    .select('first_name, accompagnantes_profiles!inner(validation_status)')
    .eq('id', row.user_id)
    .maybeSingle()

  const profileRow = marraine?.accompagnantes_profiles as
    | { validation_status?: string }
    | { validation_status?: string }[]
    | undefined
  const validationStatus = Array.isArray(profileRow)
    ? profileRow[0]?.validation_status
    : profileRow?.validation_status

  if (validationStatus !== 'valide') {
    return { valid: false, reason: 'marraine_not_validated' }
  }

  // P2 (code review 2026-04-28) : la marraine doit avoir un abonnement actif
  // pour partager son code. Une marraine désabonnée garde sa validation pour
  // l'historique mais ne peut plus parrainer (sinon, elle propage le bypass
  // d'onboarding à des sous-filleules sans contrepartie économique).
  const { data: marraineSub } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', row.user_id)
    .maybeSingle()
  const isSubActive = marraineSub?.status === 'active' || marraineSub?.status === 'past_due'
  if (!isSubActive) {
    return { valid: false, reason: 'marraine_subscription_inactive' }
  }

  return {
    valid: true,
    marraineId: row.user_id,
    marraineFirstName: (marraine?.first_name as string) || '',
  }
}

export type CreateParrainageRelationResult =
  | { ok: true; parrainageId: string; marraineId: string }
  | { ok: false; reason: string }

export async function createParrainageRelation(params: {
  code: string
  filleuleId: string
  ipInscription: string | null
  // SCP §4.6.a : champs capturés dès Story 2.1 pour préparer la détection
  // blacklist (Story 2.3). Optionnels actuellement, pas encore persistés.
  filleuleEmail?: string | null
  filleuleTelephone?: string | null
  filleuleAdresse?: string | null
}): Promise<CreateParrainageRelationResult> {
  const code = normalizeCode(params.code)
  if (!code) return { ok: false, reason: 'invalid_format' }
  if (!params.filleuleId) return { ok: false, reason: 'invalid_filleule' }

  const validation = await validateCode(code)
  if (!validation.valid) {
    return { ok: false, reason: validation.reason }
  }

  // Anti auto-parrainage : la marraine ne peut pas se parrainer elle-même.
  if (validation.marraineId === params.filleuleId) {
    return { ok: false, reason: 'self_referral' }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Idempotence : si déjà une ligne pour ce filleule + code, la renvoyer (sans relancer
  // la détection blacklist pour éviter doubles logs/emails).
  const { data: existing } = await supabaseAdmin
    .from('parrainages')
    .select('id, marraine_id, statut, blocage_raison')
    .eq('filleule_id', params.filleuleId)
    .eq('code', code)
    .in('statut', ['inscrite', 'bloque'])
    .maybeSingle()

  if (existing?.id) {
    if (existing.statut === 'bloque' && existing.blocage_raison === 'meme_email') {
      return { ok: false, reason: 'blacklist_meme_email' }
    }
    if (existing.statut === 'inscrite') {
      // Revalider que la marraine est toujours valide avant de réutiliser la row
      // (entre l'appel initial et le rappel idempotent, la marraine a pu perdre sa validation).
      const recheck = await validateCode(code)
      if (!recheck.valid) {
        return { ok: false, reason: recheck.reason }
      }
      return {
        ok: true,
        parrainageId: existing.id,
        marraineId: existing.marraine_id,
      }
    }
    // Statut bloqué pour une autre raison : on ne relance rien.
    return { ok: false, reason: 'blacklist_other' }
  }

  const nowIso = new Date().toISOString()

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('parrainages')
    .insert({
      code,
      marraine_id: validation.marraineId,
      filleule_id: params.filleuleId,
      statut: 'inscrite',
      filleule_inscrite_at: nowIso,
      ip_inscription: params.ipInscription,
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    // P13 : double POST concurrent peut violer l'index unique partiel
    // parrainages_filleule_code_active_unique. PG renvoie 23505 ; on traite
    // comme idempotence : recharger la row existante et la renvoyer.
    if (insertError && (insertError as { code?: string }).code === '23505') {
      const { data: raceRow } = await supabaseAdmin
        .from('parrainages')
        .select('id, marraine_id, statut, blocage_raison')
        .eq('filleule_id', params.filleuleId)
        .eq('code', code)
        .in('statut', ['inscrite', 'abonnee', 'confirme'])
        .maybeSingle()
      if (raceRow?.id) {
        return {
          ok: true,
          parrainageId: raceRow.id,
          marraineId: raceRow.marraine_id,
        }
      }
    }
    return { ok: false, reason: 'insert_failed' }
  }

  // Story 2.3 AC2 : détection blacklist AVANT de poser parrainee_par.
  // Si on pose parrainee_par puis qu'on doit le reset après détection meme_email,
  // un échec du reset laisse l'utilisatrice avec parrainee_par != null ET
  // parrainages.statut='bloque' — état corrompu qui active le bypass onboarding
  // sans valider via parrainage. En détectant d'abord, on n'écrit parrainee_par
  // que si la relation est légitime.
  const marraineId = validation.marraineId
  let blacklistResult: { blocage?: 'meme_email'; flag?: 'meme_ip' } = {}
  try {
    blacklistResult = await detectBlacklist({
      marraineId,
      filleuleId: params.filleuleId,
      filleuleEmail: params.filleuleEmail ?? null,
      ipInscription: params.ipInscription,
      parrainageId: inserted.id,
    })
  } catch (err) {
    console.error('[parrainage_blacklist][signup]', err)
  }

  // parrainee_par n'est posé que si pas de blocage : la branche meme_email plus
  // bas le laisse intentionnellement à null. meme_ip est seulement un flag, le
  // parrainage reste actif donc parrainee_par doit être posé.
  if (blacklistResult.blocage !== 'meme_email') {
    const { error: parraineeErr } = await supabaseAdmin
      .from('users')
      .update({ parrainee_par: validation.marraineId })
      .eq('id', params.filleuleId)
    if (parraineeErr) console.error('[parrainage][signup][parrainee_par]', parraineeErr)
  }

  // Charger les infos pour les emails admin (best-effort).
  async function loadNamesForAdminEmail() {
    const { data: marraine } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name')
      .eq('id', marraineId)
      .maybeSingle()
    const { data: filleule } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name')
      .eq('id', params.filleuleId)
      .maybeSingle()
    const marraineName = `${marraine?.first_name || ''} ${marraine?.last_name || ''}`.trim() || 'Marraine'
    const filleuleName = `${filleule?.first_name || ''} ${filleule?.last_name || ''}`.trim() || 'Filleule'
    return { marraineName, filleuleName }
  }

  if (blacklistResult.blocage === 'meme_email') {
    const { error: blocErr } = await supabaseAdmin
      .from('parrainages')
      .update({ statut: 'bloque', blocage_raison: 'meme_email' })
      .eq('id', inserted.id)
    if (blocErr) console.error('[parrainage_blacklist][signup][update_bloque]', blocErr)

    // parrainee_par n'a pas été posé (cf. plus haut) : pas de reset à faire.

    const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: null,
      action_type: 'parrainage_bloque',
      target_type: 'parrainage',
      target_id: inserted.id,
      details: {
        marraine_id: marraineId,
        filleule_id: params.filleuleId,
        raison: 'meme_email',
      },
    })
    if (logErr) console.error('[parrainage_blacklist][signup][log]', logErr)

    try {
      const { marraineName, filleuleName } = await loadNamesForAdminEmail()
      await sendAdminParrainageFlag({
        marraineName,
        filleuleName,
        type: 'meme_email',
        parrainageId: inserted.id,
      })
    } catch (err) {
      console.error('[parrainage_blacklist][signup][email]', err)
    }

    return { ok: false, reason: 'blacklist_meme_email' }
  }

  if (blacklistResult.flag === 'meme_ip') {
    // M4 : RPC atomique. was_added=false si un autre worker (webhook concurrent)
    // a déjà posé le flag -> on skip log/email pour éviter les doublons.
    const { data: mergeResult, error: mergeErr } = await supabaseAdmin
      .rpc('merge_parrainage_flag_suspicion', {
        p_parrainage_id: inserted.id,
        p_flag: 'meme_ip',
      })
      .select('was_added')
      .maybeSingle()
    if (mergeErr) console.error('[parrainage_blacklist][signup][merge_flag]', mergeErr)

    if (mergeResult?.was_added) {
      const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
        admin_id: null,
        action_type: 'parrainage_flag',
        target_type: 'parrainage',
        target_id: inserted.id,
        details: {
          marraine_id: marraineId,
          filleule_id: params.filleuleId,
          flag: 'meme_ip',
        },
      })
      if (logErr) console.error('[parrainage_blacklist][signup][log_flag]', logErr)

      try {
        const { marraineName, filleuleName } = await loadNamesForAdminEmail()
        await sendAdminParrainageFlag({
          marraineName,
          filleuleName,
          type: 'meme_ip',
          parrainageId: inserted.id,
        })
      } catch (err) {
        console.error('[parrainage_blacklist][signup][email]', err)
      }
    }
  }

  return {
    ok: true,
    parrainageId: inserted.id,
    marraineId,
  }
}

export type ConfirmParrainageOnSuccessResult =
  | { ok: true; alreadyDone?: boolean }
  | { ok: false; reason: string }

export async function confirmParrainageOnSuccess(
  sessionId: string
): Promise<ConfirmParrainageOnSuccessResult> {
  if (!sessionId) return { ok: false, reason: 'missing_session_id' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not_authenticated' }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return { ok: false, reason: 'stripe_session_not_found' }
  }

  const parrainageCode = (session.metadata?.parrainage_code || '').toString()
  if (!parrainageCode) {
    return { ok: false, reason: 'no_parrainage_metadata' }
  }

  const isComplete = session.status === 'complete' || session.payment_status === 'paid'
  if (!isComplete) {
    return { ok: false, reason: 'session_not_complete' }
  }
  // Sécurité : la metadata user_id doit être présente ET correspondre à l'utilisateur courant.
  const sessionUserId = (session.metadata?.user_id || '').toString()
  if (sessionUserId !== user.id) {
    return { ok: false, reason: 'user_mismatch' }
  }

  const code = normalizeCode(parrainageCode)
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: parrainage } = await supabaseAdmin
    .from('parrainages')
    .select('id, statut, marraine_id, filleule_id')
    .eq('code', code)
    .eq('filleule_id', user.id)
    .order('filleule_inscrite_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!parrainage) {
    return { ok: false, reason: 'parrainage_not_found' }
  }

  if (parrainage.statut !== 'inscrite') {
    return { ok: true, alreadyDone: true }
  }

  // Vérification que la marraine est toujours validée au moment du paiement.
  // Si elle a été déchue entre l'inscription de la filleule et le paiement, on
  // refuse la validation automatique par parrainage.
  const { data: marraineProfile } = await supabaseAdmin
    .from('accompagnantes_profiles')
    .select('validation_status')
    .eq('user_id', parrainage.marraine_id)
    .maybeSingle()
  if (marraineProfile?.validation_status !== 'valide') {
    return { ok: false, reason: 'marraine_no_longer_validated' }
  }

  // Décision 3a : refuser la validation et le log si le profil filleule est absent.
  // .maybeSingle() pour gérer le cas onboarding incomplet sans lever PGRST116.
  const { data: filleuleProfile } = await supabaseAdmin
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!filleuleProfile?.id) {
    return { ok: false, reason: 'profile_not_found' }
  }

  const nowIso = new Date().toISOString()

  // Idempotence transactionnelle (optimistic locking) : on tente le passage à 'abonnee'
  // EN PREMIER avec un filtre statut='inscrite'. Si 0 ligne affectée, c'est qu'un autre
  // appel concurrent a déjà fait la transition — on abandonne pour éviter doubles emails/logs.
  const { data: lockedRows } = await supabaseAdmin
    .from('parrainages')
    .update({
      statut: 'abonnee',
      filleule_abonnee_at: nowIso,
    })
    .eq('id', parrainage.id)
    .eq('statut', 'inscrite')
    .select('id')

  if (!lockedRows || lockedRows.length !== 1) {
    return { ok: true, alreadyDone: true }
  }

  // Profil filleule -> valide via parrainage
  await supabaseAdmin
    .from('accompagnantes_profiles')
    .update({
      validation_status: 'valide',
      validation_source: 'parrainage',
      validation_date: nowIso,
      validated_by: null,
    })
    .eq('id', filleuleProfile.id)

  // Générer le code de la filleule (elle devient marraine à son tour) — bypass authz.
  const codeResult = await generateCodeForUserSystem(user.id)
  if (!('code' in codeResult)) {
    // La filleule est validée mais sans code de parrainage : on log explicitement
    // pour qu'un admin puisse rattraper manuellement (re-trigger via admin tool).
    console.error('[confirmParrainageOnSuccess][generate_code_failed]', {
      user_id: user.id,
      reason: codeResult.error,
    })
    await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: null,
      action_type: 'parrainage_code_generation_failed',
      target_type: 'user',
      target_id: user.id,
      details: { reason: codeResult.error },
    })
  }

  // Charger marraine + filleule pour les emails
  const { data: marraineUser } = await supabaseAdmin
    .from('users')
    .select('email, first_name')
    .eq('id', parrainage.marraine_id)
    .single()

  const { data: filleuleUser } = await supabaseAdmin
    .from('users')
    .select('email, first_name')
    .eq('id', user.id)
    .single()

  // Emails non-bloquants via after() (Next 16) : garantit l'exécution post-réponse
  // sur Vercel sans risque que la fonction termine prématurément.
  if (filleuleUser?.email) {
    after(async () => {
      try {
        await sendParrainageFilleuleConfirmation({
          email: filleuleUser.email,
          firstName: filleuleUser.first_name || '',
          marraineFirstName: marraineUser?.first_name || '',
          userId: user.id,
        })
      } catch {}
    })
  }

  if (filleuleUser?.email && 'code' in codeResult) {
    after(async () => {
      try {
        await sendParrainageBienvenueMarraine({
          email: filleuleUser.email,
          firstName: filleuleUser.first_name || '',
          code: codeResult.code,
          userId: user.id,
        })
      } catch {}
    })
  }

  // Log admin (action système : admin_id null)
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: null,
    action_type: 'validation_par_parrainage',
    target_type: 'accompagnante',
    target_id: filleuleProfile.id,
    details: {
      parrainage_id: parrainage.id,
      marraine_id: parrainage.marraine_id,
    },
  })

  // Invalide le cache du dashboard pour que la ParrainageCard apparaisse
  // sans nécessiter un reload manuel après validation par parrainage.
  revalidatePath('/accompagnante/dashboard')

  return { ok: true }
}

