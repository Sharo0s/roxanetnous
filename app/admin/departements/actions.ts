'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DEPARTEMENTS_CACHE_TAG } from '@/lib/departements'
import { notifyWaitlistForCode } from '@/lib/notify-waitlist'

// Note : revalidateTag exige un profil cacheLife en Next 16.
// On utilise 'default' pour invalidation au prochain hit ; combine avec
// revalidatePath pour rafraichir l'ecran admin immediatement.

export type ToggleResult = {
  error?: string
  success?: boolean
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' as const }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'admin') {
    return { error: 'Accès non autorisé.' as const }
  }

  return { adminId: user.id }
}

function invalidate() {
  revalidateTag(DEPARTEMENTS_CACHE_TAG, 'default')
  revalidatePath('/admin/departements', 'page')
}

export async function toggleDepartement(code: string, ouvrir: boolean): Promise<ToggleResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient({ serviceRole: true })

  // SELECT pre-update pour detecter transition false -> true (story 3.5 D2).
  // Code review patch #6 : gerer error explicitement, sinon une erreur
  // transitoire BDD masque la transition reelle (etaitFerme=false silencieux).
  const { data: avant, error: preErr } = await supabase
    .from('departements_ouverts')
    .select('ouvert')
    .eq('code', code)
    .single()
  if (preErr) {
    return { error: 'Erreur lors de la lecture de l\'etat du departement.' }
  }
  if (!avant) {
    return { error: 'Departement introuvable.' }
  }
  const etaitFerme = avant.ouvert === false

  const updateData: Record<string, unknown> = {
    ouvert: ouvrir,
    updated_by: auth.adminId,
  }
  if (ouvrir) {
    updateData.ouvert_le = new Date().toISOString()
  }

  // Code review patch #7 : verifier que l'UPDATE touche bien >=1 ligne
  // (defense en profondeur, le SELECT pre-update verifie deja l'existence).
  const { data: updated, error } = await supabase
    .from('departements_ouverts')
    .update(updateData)
    .eq('code', code)
    .select('code')

  if (error) return { error: 'Erreur lors de la mise à jour.' }
  if (!updated || updated.length === 0) {
    return { error: 'Departement introuvable.' }
  }

  // Bug latent fix (story 3.5 D1) : target_id_text au lieu de target_id
  // (UUID NOT NULL en BDD, code dpt est TEXT).
  // Code review patch #8 : logger l'erreur insert log explicitement.
  const { error: logErr } = await supabase.from('admin_actions_log').insert({
    admin_id: auth.adminId,
    action_type: ouvrir ? 'departement_ouvert' : 'departement_ferme',
    target_type: 'departement',
    target_id: null,
    target_id_text: code,
    details: { code, ouvert: ouvrir },
  })
  if (logErr) {
    console.error('[toggleDepartement][log_error]', { code, ouvrir, err: logErr })
  }

  // Notification waitlist : transition false -> true uniquement (AC4, AC8).
  // Synchrone : on attend l'envoi dans la meme requete server action.
  if (ouvrir && etaitFerme) {
    try {
      await notifyWaitlistForCode(code)
    } catch (notifyErr) {
      console.error('[toggleDepartement][notify_error]', { code, err: notifyErr })
    }
  }

  invalidate()
  return { success: true }
}

export async function toggleRegion(region: string, ouvrir: boolean): Promise<ToggleResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient({ serviceRole: true })

  // SELECT pre-update pour capturer codes actuellement fermes (story 3.5 D3).
  // Code review patch #6 : gerer error explicitement.
  const { data: avant, error: preErr } = await supabase
    .from('departements_ouverts')
    .select('code, ouvert')
    .eq('region', region)
  if (preErr) {
    return { error: 'Erreur lors de la lecture de la region.' }
  }
  const codesAvantFermes = (avant || [])
    .filter((d) => d.ouvert === false)
    .map((d) => d.code)

  // Code review patch #11 : warn si batch region depasse le budget timeout
  // 60s server action (~5 codes * ~50 emails * 300ms = ~75s). Le cron retry
  // rattrape, mais on signale le risque pour observabilite ops.
  if (ouvrir && codesAvantFermes.length > 5) {
    console.warn('[toggleRegion][batch_large]', {
      region,
      codesCount: codesAvantFermes.length,
      info: 'risque timeout 60s server action, cron retry rattrapera surplus',
    })
  }

  const updateData: Record<string, unknown> = {
    ouvert: ouvrir,
    updated_by: auth.adminId,
  }
  if (ouvrir) {
    updateData.ouvert_le = new Date().toISOString()
  }

  const { data: codes, error } = await supabase
    .from('departements_ouverts')
    .update(updateData)
    .eq('region', region)
    .select('code')

  if (error) return { error: 'Erreur lors de la mise à jour.' }

  // Bug latent fix (story 3.5 D1) : target_id_text au lieu de target_id.
  // Code review patch #8 : logger l'erreur insert log explicitement.
  const { error: logErr } = await supabase.from('admin_actions_log').insert({
    admin_id: auth.adminId,
    action_type: ouvrir ? 'region_ouverte' : 'region_fermee',
    target_type: 'region',
    target_id: null,
    target_id_text: region,
    details: { region, ouvert: ouvrir, codes: codes?.map((d) => d.code) || [] },
  })
  if (logErr) {
    console.error('[toggleRegion][log_error]', { region, ouvrir, err: logErr })
  }

  // Notification waitlist sequentielle pour chaque code passe false -> true
  // (AC5). Sequentiel pour ne pas burst Resend. Cron retry rattrape ce qui
  // n'aura pas pu etre envoye dans la fenetre 60s server action (R2).
  if (ouvrir) {
    for (const c of codesAvantFermes) {
      try {
        await notifyWaitlistForCode(c)
      } catch (notifyErr) {
        console.error('[toggleRegion][notify_error]', { code: c, region, err: notifyErr })
      }
    }
  }

  invalidate()
  return { success: true }
}
