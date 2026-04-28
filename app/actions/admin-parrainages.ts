'use server'

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
    if (parraineeErr) console.error('[parrainage_admin][autoriser][parrainee_par]', parraineeErr)
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
  if (logErr) console.error('[parrainage_admin][autoriser][log]', logErr)

  revalidatePath('/admin/parrainages')
  revalidatePath('/admin/parrainages/blacklist')
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

  const { error: updateErr } = await supabaseAdmin
    .from('parrainages')
    .update({ statut: 'fraude' })
    .eq('id', parrainageId)
  if (updateErr) return { error: 'Erreur lors de la mise à jour.' }

  // Révocation parrainage (helper AC4) : remet validation_status='en_attente' UNIQUEMENT
  // si la validation provenait du parrainage. Toujours retire parrainee_par. Logue
  // 'parrainage_fraude_confirmee' avec via='admin_confirme'.
  if (parrainage.filleule_id) {
    await revokeFilleuleValidationFromWebhook(parrainage.filleule_id, 'admin_confirme', {
      parrainageId,
      marraineId: parrainage.marraine_id,
    })

    // Suspension supplémentaire : si la filleule était validée VIA PARRAINAGE,
    // on la passe à 'refuse' (la révocation l'avait remise en 'en_attente').
    // Si validation_source != 'parrainage', on ne touche pas à validation_status
    // (la filleule peut avoir été validée par OCR/visio, indépendamment de la fraude).
    const { data: profileAfter } = await supabaseAdmin
      .from('accompagnantes_profiles')
      .select('id, validation_source')
      .eq('user_id', parrainage.filleule_id)
      .maybeSingle()

    if (profileAfter && profileAfter.validation_source === 'manuelle') {
      // 'manuelle' = état post-révocation parrainage (cf revokeFilleuleValidation).
      // On suspend uniquement dans ce cas pour éviter de pénaliser une validation OCR/visio.
      const { error: suspendErr } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .update({
          validation_status: 'refuse',
          validation_date: null,
          refus_motif: 'Suspicion fraude parrainage - confirmé par admin',
        })
        .eq('id', profileAfter.id)
      if (suspendErr) console.error('[parrainage_admin][confirmer_fraude][suspend]', suspendErr)
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
  if (logErr) console.error('[parrainage_admin][confirmer_fraude][log]', logErr)

  revalidatePath('/admin/parrainages')
  revalidatePath('/admin/parrainages/blacklist')
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
  revalidatePath('/admin/parrainages/blacklist')
  return {}
}
