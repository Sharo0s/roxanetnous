'use server'

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { revokeFilleuleValidationFromWebhook } from '@/app/actions/parrainage'

const NOTES_MAX_LENGTH = 5000

// Story 2.3 AC8 : trois actions admin pour gérer les rows parrainages bloquées,
// flaggées ou frauduleuses. Auth check role admin obligatoire (pattern admin-signalements.ts).

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.', user: null }

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès non autorisé.', user: null }
  }
  return { error: null, user }
}

// Story 2.3 AC8 : autoriserException remet le parrainage en flow normal.
export async function autoriserException(
  parrainageId: string,
  notes: string,
): Promise<{ error?: string }> {
  const { error: authErr, user } = await requireAdmin()
  if (authErr || !user) return { error: authErr || 'Accès non autorisé.' }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: parrainage } = await supabaseAdmin
    .from('parrainages')
    .select('id, marraine_id, filleule_id, statut')
    .eq('id', parrainageId)
    .maybeSingle()
  if (!parrainage) return { error: 'Parrainage introuvable.' }

  // Reset statut + flags (le flow normal pourra reprendre).
  // Si déjà 'fraude', on remet 'inscrite' aussi (l'admin assume la décision).
  const newStatut = parrainage.statut === 'abonnee' || parrainage.statut === 'confirme'
    ? parrainage.statut
    : 'inscrite'
  const { error: updateErr } = await supabaseAdmin
    .from('parrainages')
    .update({
      statut: newStatut,
      blocage_raison: null,
      flag_suspicion: null,
    })
    .eq('id', parrainageId)
  if (updateErr) return { error: 'Erreur lors de la mise à jour.' }

  // Restaurer le lien parrainee_par si la filleule existe encore.
  if (parrainage.filleule_id) {
    const { error: parraineeErr } = await supabaseAdmin
      .from('users')
      .update({ parrainee_par: parrainage.marraine_id })
      .eq('id', parrainage.filleule_id)
    if (parraineeErr) {
      console.error('[parrainage_admin][autoriser][parrainee_par]', parraineeErr)
      Sentry.captureException(parraineeErr, {
        tags: { flow: 'admin', signal: 'autoriser-parrainee-par', severity: 'critical' },
        extra: { parrainageId, filleuleId: parrainage.filleule_id },
      })
    }
  }

  const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'parrainage_autorise_exception',
    target_type: 'parrainage',
    target_id: parrainageId,
    details: {
      notes: notes?.trim().slice(0, NOTES_MAX_LENGTH) || null,
      marraine_id: parrainage.marraine_id,
      filleule_id: parrainage.filleule_id,
    },
  })
  if (logErr) {
    console.error('[parrainage_admin][autoriser][log]', logErr)
    Sentry.captureException(logErr, {
      tags: { flow: 'admin', signal: 'autoriser-log', severity: 'critical' },
      extra: { parrainageId, adminId: user.id },
    })
  }

  revalidatePath('/admin/parrainages')
  return {}
}

// Story 2.3 AC8 : confirmerFraude valide définitivement la suspicion. Suspend la
// filleule (validation_status='refuse'). NE suspend PAS automatiquement la marraine
// (décision MVP : éviter faux positifs côté marraine, l'admin tranche manuellement).
export async function confirmerFraude(
  parrainageId: string,
  notes: string,
): Promise<{ error?: string }> {
  const { error: authErr, user } = await requireAdmin()
  if (authErr || !user) return { error: authErr || 'Accès non autorisé.' }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: parrainage } = await supabaseAdmin
    .from('parrainages')
    .select('id, marraine_id, filleule_id, statut')
    .eq('id', parrainageId)
    .maybeSingle()
  if (!parrainage) return { error: 'Parrainage introuvable.' }

  // H11 (code review 2026-04-29) : si le parrainage était 'confirme', il a
  // contribué au compteur de la marraine et potentiellement à une récompense.
  // On décrémente le compteur (UPDATE atomique x = x - 1) avant de passer
  // à 'fraude'. Si le compteur passerait en négatif, c'est qu'une récompense
  // a déjà été déclenchée et le compteur ramené à compteur - palier : on log
  // pour que l'admin révoque manuellement le coupon Stripe et corrige
  // total_recompenses (le coupon ID se trouve dans admin_actions_log
  // 'parrainage_recompense_appliquee').
  const wasConfirmed = parrainage.statut === 'confirme'

  const { error: updateErr } = await supabaseAdmin
    .from('parrainages')
    .update({ statut: 'fraude', flag_suspicion: null })
    .eq('id', parrainageId)
  if (updateErr) return { error: 'Erreur lors de la mise à jour.' }

  if (wasConfirmed) {
    const { data: codeRow } = await supabaseAdmin
      .from('parrainages_codes')
      .select('compteur_confirmes, total_recompenses')
      .eq('user_id', parrainage.marraine_id)
      .maybeSingle()

    if (codeRow) {
      // Décrément atomique borné : ne descend pas sous 0.
      const newCompteur = Math.max(0, (codeRow.compteur_confirmes ?? 0) - 1)
      const { error: decErr } = await supabaseAdmin
        .from('parrainages_codes')
        .update({ compteur_confirmes: newCompteur })
        .eq('user_id', parrainage.marraine_id)
      if (decErr) {
        console.error('[parrainage_admin][confirmer_fraude][counter_rollback]', decErr)
        Sentry.captureException(decErr, {
          tags: { flow: 'admin', signal: 'confirmer-fraude-counter-rollback', severity: 'critical' },
          extra: { parrainageId, marraineId: parrainage.marraine_id },
        })
      }

      // Si la marraine a déjà reçu au moins une récompense, le parrainage
      // frauduleux a peut-être contribué à un palier déclenché. On log un
      // flag explicite pour que l'admin tranche (révoquer le coupon Stripe
      // ou laisser tel quel selon l'analyse).
      if ((codeRow.total_recompenses ?? 0) > 0) {
        await supabaseAdmin.from('admin_actions_log').insert({
          admin_id: user.id,
          action_type: 'parrainage_fraude_recompense_a_reviser',
          target_type: 'user',
          target_id: parrainage.marraine_id,
          details: {
            parrainage_id: parrainageId,
            ancien_compteur: codeRow.compteur_confirmes,
            nouveau_compteur: newCompteur,
            total_recompenses_actuel: codeRow.total_recompenses,
            note: 'Vérifier manuellement si une récompense doit être révoquée (cancel coupon Stripe + decrement total_recompenses).',
          },
        })
      }
    }
  }

  // Révocation parrainage (helper AC4) : remet validation_status='en_attente' UNIQUEMENT
  // si la validation provenait du parrainage. Toujours retire parrainee_par. Logue
  // 'parrainage_fraude_confirmee' avec via='admin_confirme'.
  if (parrainage.filleule_id) {
    // M11 (code review 2026-04-29) : on lit le profil AVANT révocation pour
    // décider de la suspension de manière explicite, plutôt que de s'appuyer
    // sur l'effet de bord 'manuelle' posé par revokeFilleuleValidation.
    // Cela évite un faux-positif dangereux : une filleule qui aurait été
    // validée manuellement (validation_source='manuelle') de manière légitime
    // par un admin, puis impliquée dans une fraude parrainage, n'aurait pas
    // dû être suspendue par l'ancien check.
    const { data: profileBefore } = await supabaseAdmin
      .from('accompagnantes_profiles')
      .select('id, validation_source, validation_status')
      .eq('user_id', parrainage.filleule_id)
      .maybeSingle()

    const wasValidatedByParrainage =
      profileBefore?.validation_source === 'parrainage' &&
      profileBefore?.validation_status === 'valide'

    await revokeFilleuleValidationFromWebhook(parrainage.filleule_id, 'admin_confirme', {
      parrainageId,
      marraineId: parrainage.marraine_id,
    })

    // Suspension explicite uniquement si la filleule était validée VIA PARRAINAGE.
    // Une validation OCR/visio antérieure n'est pas pénalisée par la fraude
    // d'un parrainage tiers.
    if (wasValidatedByParrainage && profileBefore) {
      const { error: suspendErr } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .update({
          validation_status: 'refuse',
          validation_date: null,
          refus_motif: 'Suspicion fraude parrainage - confirmé par admin',
        })
        .eq('id', profileBefore.id)
      if (suspendErr) {
        console.error('[parrainage_admin][confirmer_fraude][suspend]', suspendErr)
        Sentry.captureException(suspendErr, {
          tags: { flow: 'admin', signal: 'confirmer-fraude-suspend', severity: 'critical' },
          extra: { parrainageId, filleuleId: parrainage.filleule_id },
        })
      }
    }
  }

  const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'parrainage_fraude_confirmee',
    target_type: 'parrainage',
    target_id: parrainageId,
    details: {
      notes: notes?.trim().slice(0, NOTES_MAX_LENGTH) || null,
      marraine_id: parrainage.marraine_id,
      filleule_id: parrainage.filleule_id,
      via: 'admin_confirme',
    },
  })
  if (logErr) {
    console.error('[parrainage_admin][confirmer_fraude][log]', logErr)
    Sentry.captureException(logErr, {
      tags: { flow: 'admin', signal: 'confirmer-fraude-log', severity: 'critical' },
      extra: { parrainageId, adminId: user.id },
    })
  }

  revalidatePath('/admin/parrainages')
  return {}
}

// Story 2.3 AC8 : ignorerFlag retire le flag de suspicion sans toucher au statut.
export async function ignorerFlag(
  parrainageId: string,
): Promise<{ error?: string }> {
  const { error: authErr, user } = await requireAdmin()
  if (authErr || !user) return { error: authErr || 'Accès non autorisé.' }

  const supabaseAdmin = await createClient({ serviceRole: true })

  const { error: updateErr } = await supabaseAdmin
    .from('parrainages')
    .update({ flag_suspicion: null })
    .eq('id', parrainageId)
  if (updateErr) return { error: 'Erreur lors de la mise à jour.' }

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'parrainage_ignore_flag',
    target_type: 'parrainage',
    target_id: parrainageId,
    details: { parrainage_id: parrainageId },
  })

  revalidatePath('/admin/parrainages')
  return {}
}
