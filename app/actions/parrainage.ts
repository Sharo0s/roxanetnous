'use server'

import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
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
import { hashRateLimitKey } from '@/lib/rate-limit-hash'
import { getClientIpOrUnknown } from '@/lib/get-client-ip'

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

    // P9 (code review 2026-05-04) : plusieurs filleules d'une même marraine
    // partageant le même email = pattern fraude évident. On scanne les autres
    // parrainages actifs/historiques de cette marraine et on compare l'email
    // de chaque filleule passée à celle qui s'inscrit.
    const { data: otherFilleulesIds } = await supabaseAdmin
      .from('parrainages')
      .select('filleule_id')
      .eq('marraine_id', params.marraineId)
      .neq('id', params.parrainageId)
      .not('filleule_id', 'is', null)
    const filleuleIds = (otherFilleulesIds ?? [])
      .map((r) => (r as { filleule_id: string | null }).filleule_id)
      .filter((id): id is string => !!id && id !== params.filleuleId)
    if (filleuleIds.length > 0) {
      const { data: otherFilleuleUsers } = await supabaseAdmin
        .from('users')
        .select('email')
        .in('id', filleuleIds)
      const sameEmail = (otherFilleuleUsers ?? []).some(
        (u) => normalizeEmail((u as { email: string | null }).email || '') === filleuleEmailNorm,
      )
      if (sameEmail) {
        return { blocage: 'meme_email' }
      }
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
  // Story 7.A.7 (F-Epic7-A7) : `parrainageId` est REQUIS car il alimente
  // `target_id` du log `admin_actions_log` (cf. ligne ~172 plus bas) qui doit
  // satisfaire le CHECK XOR `target_id_xor` (exactement un de target_id /
  // target_id_text renseigne, sinon Postgres 23514). Les 2 callers existants
  // (admin-parrainages.ts:201 et webhooks/stripe/route.ts:218) passent toujours
  // un parrainageId issu d'une row BDD `parrainages.id` -> precondition garantie
  // par construction. Fail-loud ici previent toute regression future.
  if (!context.parrainageId) {
    throw new Error(
      'revokeFilleuleValidation: context.parrainageId requis pour log admin_actions_log (CHECK XOR target_id_xor)',
    )
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: profile } = await supabaseAdmin
    .from('accompagnants_profiles')
    .select('id, validation_status, validation_source')
    .eq('user_id', filleuleId)
    .maybeSingle()

  // Si la filleule était validée par parrainage, on remet en attente.
  if (profile?.validation_source === 'parrainage' && profile?.validation_status === 'valide') {
    await supabaseAdmin
      .from('accompagnants_profiles')
      .update({
        validation_status: 'en_attente',
        validation_source: 'manuelle',
        validation_date: null,
      })
      .eq('id', profile.id)
  } else {
    // L9 (code review 2026-04-29) : log explicite quand la révocation est
    // un no-op (profil déjà migré ou validation_source autre que 'parrainage').
    // Permet à l'admin de voir qu'une fraude a été détectée mais la suspension
    // n'a pas eu d'effet (la filleule était déjà refuse/manuelle/etc.).
    console.warn('[revokeFilleuleValidation][noop]', {
      filleule_id: filleuleId,
      raison,
      current_status: profile?.validation_status ?? null,
      current_source: profile?.validation_source ?? null,
    })
    Sentry.captureMessage('parrainage revokeFilleuleValidation noop', {
      level: 'warning',
      tags: { flow: 'parrainage', signal: 'revoke-noop', severity: 'warning' },
      extra: {
        filleule_id: filleuleId,
        raison,
        current_status: profile?.validation_status ?? null,
        current_source: profile?.validation_source ?? null,
      },
    })
  }

  // Toujours retirer le lien parrainee_par.
  await supabaseAdmin
    .from('users')
    .update({ parrainee_par: null })
    .eq('id', filleuleId)

  // H3 (code review 2026-04-29) : supprimer le code parrainage de la
  // filleule frauduleuse. Sans ce DELETE, elle conserve un code permettant
  // de sponsoriser des sous-filleules même après révocation de sa validation,
  // contournant entièrement l'anti-fraude. Le code est généré dans
  // confirmParrainageOnSuccess (ligne ~660), donc nous savons qu'il existe.
  // Suppression best-effort : si la filleule n'avait pas encore de code
  // (race confirmParrainageOnSuccess vs webhook), le DELETE est no-op.
  await supabaseAdmin
    .from('parrainages_codes')
    .delete()
    .eq('user_id', filleuleId)

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: context.adminId ?? null,
    action_type: 'parrainage_fraude_confirmee',
    target_type: 'parrainage',
    target_id: context.parrainageId,
    details: {
      via: raison,
      filleule_id: filleuleId,
      marraine_id: context.marraineId ?? null,
    },
  })
}

// Re-export interne pour le webhook (qui ne peut pas importer depuis un fichier
// 'use server' avec usage non-action). Utilisable comme server action depuis le webhook.
//
// Auth guard : tout export d'un fichier 'use server' devient un endpoint POST
// public exploitable. Ce helper accepte un filleuleId arbitraire ; sans guard,
// n'importe quel client authentifié peut révoquer la validation de n'importe
// quelle accompagnant. On exige un secret partagé connu uniquement du webhook
// (PARRAINAGE_INTERNAL_SECRET) ou un appelant admin authentifié.
export async function revokeFilleuleValidationFromWebhook(
  filleuleId: string,
  raison: string,
  context: { parrainageId?: string; marraineId?: string; internalSecret?: string } = {},
): Promise<void> {
  const expectedSecret = process.env.PARRAINAGE_INTERNAL_SECRET
  const hasValidSecret =
    !!expectedSecret &&
    !!context.internalSecret &&
    context.internalSecret === expectedSecret

  if (!hasValidSecret) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('revokeFilleuleValidationFromWebhook: non authentifié')

    const { data: caller } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (caller?.role !== 'admin') {
      throw new Error('revokeFilleuleValidationFromWebhook: accès refusé')
    }
  }

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
    return { code: existing.code, created: false }
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
      return { code, created: true }
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
      return { code: nowExisting.code, created: false }
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
        | 'rate_limited'
    }

// H12 (code review 2026-04-29) : rate-limit fenêtre glissante par IP pour
// empêcher l'énumération du keyspace 31^8 codes. Limite : 30 tentatives par
// 5 minutes (suffisant pour saisir/corriger un code, infaisable pour brute-force
// même si parallélisé sur 100 IPs : 3000/5min = 100k codes / 6 jours pour
// 1 hit espéré, alors qu'une vraie marraine partage son code via canal direct).
const VALIDATE_CODE_MAX_REQUESTS = 30
const VALIDATE_CODE_WINDOW_SECONDS = 300

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

  // H12 : check rate-limit avant toute lecture BDD. Key = IP du client ;
  // si IP indisponible (cas rare en preview/dev), fallback string 'unknown'.
  // Review 2026-05-07 : rateLimitKey hisse hors du try pour partager le
  // keyHash entre la branche success et le catch RPC error.
  let rateLimitKey: string | null = null
  try {
    const h = await headers()
    const ip = getClientIpOrUnknown(h)
    rateLimitKey = `validate_code:${ip}`
    const { data: allowed } = await supabaseAdmin.rpc('try_consume_rate_limit', {
      p_key: rateLimitKey,
      p_max_requests: VALIDATE_CODE_MAX_REQUESTS,
      p_window_seconds: VALIDATE_CODE_WINDOW_SECONDS,
    })
    if (allowed === false) {
      console.warn('[validateCode][rate_limited]', { ip })
      // Story 4.1 AC4 : evenement Sentry dedie pour signaler une tentative
      // de bruteforce du keyspace 31^8 codes parrainage. keyHash HMAC-sale
      // pour ne pas envoyer l'IP brute (PII) tout en permettant
      // d'identifier un attaquant recurrent sur le dashboard.
      Sentry.captureMessage('rate-limit-validate-code triggered', {
        level: 'warning',
        tags: {
          flow: 'parrainage',
          signal: 'rate-limit-validate-code',
          severity: 'warning',
        },
        extra: { keyHash: hashRateLimitKey(rateLimitKey) },
      })
      return { valid: false, reason: 'rate_limited' }
    }
  } catch (rateLimitErr) {
    // Best-effort : si le RPC échoue (DB down), on n'empêche pas la
    // validation pour ne pas casser le flow signup. L'erreur est logguée
    // pour observabilité.
    console.error('[validateCode][rate_limit_error]', rateLimitErr)
    // Story 4.1 AC4 : critical car une defaillance du RPC rate-limit
    // ouvre temporairement la fenetre brute-force. keyHash transmis pour
    // correlation dashboard si l'erreur RPC coincide avec un attaquant.
    Sentry.captureException(rateLimitErr, {
      tags: {
        flow: 'parrainage',
        signal: 'rate-limit-rpc-error',
        severity: 'critical',
      },
      extra: rateLimitKey ? { keyHash: hashRateLimitKey(rateLimitKey) } : {},
    })
  }

  const { data: row } = await supabaseAdmin
    .from('parrainages_codes')
    .select('user_id')
    .eq('code', code)
    .maybeSingle()

  if (!row?.user_id) {
    return { valid: false, reason: 'unknown_code' }
  }

  // Désambiguïsation FK : accompagnants_profiles a deux FK vers users
  // (user_id et validated_by), donc PostgREST exige un hint explicite
  // sur le nom de la contrainte. Sans cela, l'embed renvoie un tableau
  // vide et la marraine apparaît comme non validée.
  const { data: marraine } = await supabaseAdmin
    .from('users')
    .select('first_name, accompagnants_profiles!auxiliaires_profiles_user_id_fkey(validation_status)')
    .eq('id', row.user_id)
    .maybeSingle()

  const profileRow = marraine?.accompagnants_profiles as
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
  //
  // D5 (code review 2026-04-29) : 'past_due' n'est plus accepté.
  // Asymétrie corrigée avec hasActiveSubscription (cron récompense), qui
  // n'accepte que 'active' / 'trialing'. Une marraine en échec de paiement
  // (carte refusée) ne peut pas onboarder pendant que Stripe retry.
  const { data: marraineSub } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', row.user_id)
    .maybeSingle()
  const isSubActive = marraineSub?.status === 'active' || marraineSub?.status === 'trialing'
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
    Sentry.captureException(err, {
      tags: { flow: 'parrainage', signal: 'blacklist-signup', severity: 'critical' },
      extra: { parrainageId: inserted.id, marraineId, filleuleId: params.filleuleId },
    })
  }

  // parrainee_par n'est posé que si pas de blocage : la branche meme_email plus
  // bas le laisse intentionnellement à null. meme_ip est seulement un flag, le
  // parrainage reste actif donc parrainee_par doit être posé.
  //
  // M9 (code review 2026-04-29) : guard `IS NULL` pour ne jamais écraser un
  // parrainee_par déjà posé. Sinon, si une filleule a un parrainage actif et
  // tente un autre code, l'historique d'attribution serait silencieusement
  // perdu (premier marraine remplacée par seconde).
  if (blacklistResult.blocage !== 'meme_email') {
    const { error: parraineeErr } = await supabaseAdmin
      .from('users')
      .update({ parrainee_par: validation.marraineId })
      .eq('id', params.filleuleId)
      .is('parrainee_par', null)
    if (parraineeErr) {
      console.error('[parrainage][signup][parrainee_par]', parraineeErr)
      Sentry.captureException(parraineeErr, {
        tags: { flow: 'parrainage', signal: 'signup-parrainee-par', severity: 'critical' },
        extra: { parrainageId: inserted.id, filleuleId: params.filleuleId },
      })
    }
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
    if (blocErr) {
      console.error('[parrainage_blacklist][signup][update_bloque]', blocErr)
      Sentry.captureException(blocErr, {
        tags: { flow: 'parrainage', signal: 'signup-update-bloque', severity: 'critical' },
        extra: { parrainageId: inserted.id, raison: 'meme_email' },
      })
    }

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
    if (logErr) {
      console.error('[parrainage_blacklist][signup][log]', logErr)
      Sentry.captureException(logErr, {
        tags: { flow: 'parrainage', signal: 'signup-log-bloque', severity: 'critical' },
        extra: { parrainageId: inserted.id, raison: 'meme_email' },
      })
    }

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
      Sentry.captureException(err, {
        tags: { flow: 'parrainage', signal: 'signup-email-bloque', severity: 'warning' },
        extra: { parrainageId: inserted.id, type: 'meme_email' },
      })
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
    if (mergeErr) {
      console.error('[parrainage_blacklist][signup][merge_flag]', mergeErr)
      Sentry.captureException(mergeErr, {
        tags: { flow: 'parrainage', signal: 'signup-merge-flag', severity: 'critical' },
        extra: { parrainageId: inserted.id, flag: 'meme_ip' },
      })
    }

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
      if (logErr) {
        console.error('[parrainage_blacklist][signup][log_flag]', logErr)
        Sentry.captureException(logErr, {
          tags: { flow: 'parrainage', signal: 'signup-log-flag', severity: 'critical' },
          extra: { parrainageId: inserted.id, flag: 'meme_ip' },
        })
      }

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
        Sentry.captureException(err, {
          tags: { flow: 'parrainage', signal: 'signup-email-flag', severity: 'warning' },
          extra: { parrainageId: inserted.id, type: 'meme_ip' },
        })
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
    .from('accompagnants_profiles')
    .select('validation_status')
    .eq('user_id', parrainage.marraine_id)
    .maybeSingle()
  if (marraineProfile?.validation_status !== 'valide') {
    return { ok: false, reason: 'marraine_no_longer_validated' }
  }

  // Décision 3a : refuser la validation et le log si le profil filleule est absent.
  // .maybeSingle() pour gérer le cas onboarding incomplet sans lever PGRST116.
  const { data: filleuleProfile } = await supabaseAdmin
    .from('accompagnants_profiles')
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

  // C3/H4 (code review 2026-04-29) : CAS sur validation_status pour ne pas
  // écraser une décision admin antérieure (ex. 'refuse', 'a_completer').
  // La transition légitime est en_attente -> valide via parrainage. Si la
  // filleule est déjà 'valide' (idempotence), on saute. Si elle est dans
  // un autre statut, on log et on n'écrase pas.
  const { data: validationUpdated } = await supabaseAdmin
    .from('accompagnants_profiles')
    .update({
      validation_status: 'valide',
      validation_source: 'parrainage',
      validation_date: nowIso,
      validated_by: null,
    })
    .eq('id', filleuleProfile.id)
    .eq('validation_status', 'en_attente')
    .select('id')

  if (!validationUpdated || validationUpdated.length === 0) {
    // Statut courant n'est pas 'en_attente' : peut être 'valide' (idempotence,
    // OK) ou 'refuse' / 'a_completer' (décision admin à préserver).
    const { data: currentProfile } = await supabaseAdmin
      .from('accompagnants_profiles')
      .select('validation_status')
      .eq('id', filleuleProfile.id)
      .single()

    if (currentProfile?.validation_status !== 'valide') {
      console.warn('[confirmParrainageOnSuccess][validation_status_skipped]', {
        user_id: user.id,
        current_status: currentProfile?.validation_status ?? null,
      })
      Sentry.captureMessage('parrainage validation status skipped', {
        level: 'warning',
        tags: { flow: 'parrainage', signal: 'validation-status-skipped', severity: 'warning' },
        extra: {
          user_id: user.id,
          current_status: currentProfile?.validation_status ?? null,
        },
      })
      await supabaseAdmin.from('admin_actions_log').insert({
        admin_id: null,
        action_type: 'parrainage_validation_skipped',
        target_type: 'user',
        target_id: user.id,
        details: { current_status: currentProfile?.validation_status ?? null },
      })
    }
  }

  // Générer le code de la filleule (elle devient marraine à son tour) — bypass authz.
  const codeResult = await generateCodeForUserSystem(user.id)
  if (!('code' in codeResult)) {
    // La filleule est validée mais sans code de parrainage : on log explicitement
    // pour qu'un admin puisse rattraper manuellement (re-trigger via admin tool).
    console.error('[confirmParrainageOnSuccess][generate_code_failed]', {
      user_id: user.id,
      reason: codeResult.error,
    })
    Sentry.captureMessage('parrainage generate code failed', {
      level: 'error',
      tags: { flow: 'parrainage', signal: 'generate-code-failed', severity: 'critical' },
      extra: { user_id: user.id, reason: codeResult.error },
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

  // L1 (code review 2026-04-29) : n'envoyer l'email "bienvenue marraine"
  // qu'à la création réelle du code, pas sur retour idempotent.
  if (filleuleUser?.email && 'code' in codeResult && codeResult.created) {
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
    target_type: 'accompagnant',
    target_id: filleuleProfile.id,
    details: {
      parrainage_id: parrainage.id,
      marraine_id: parrainage.marraine_id,
    },
  })

  // Invalide le cache du dashboard pour que le teaser parrainage apparaisse
  // sans nécessiter un reload manuel après validation par parrainage.
  revalidatePath('/accompagnant/dashboard')
  revalidatePath('/accompagnant/parrainage')

  return { ok: true }
}

