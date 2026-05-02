'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DEPARTEMENTS_CACHE_TAG } from '@/lib/departements'

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

  const updateData: Record<string, unknown> = {
    ouvert: ouvrir,
    updated_by: auth.adminId,
  }
  if (ouvrir) {
    updateData.ouvert_le = new Date().toISOString()
  }

  const { error } = await supabase
    .from('departements_ouverts')
    .update(updateData)
    .eq('code', code)

  if (error) return { error: 'Erreur lors de la mise à jour.' }

  await supabase.from('admin_actions_log').insert({
    admin_id: auth.adminId,
    action_type: ouvrir ? 'departement_ouvert' : 'departement_ferme',
    target_type: 'departement',
    target_id: code,
    details: { code, ouvert: ouvrir },
  })

  invalidate()
  return { success: true }
}

export async function toggleRegion(region: string, ouvrir: boolean): Promise<ToggleResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient({ serviceRole: true })

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

  await supabase.from('admin_actions_log').insert({
    admin_id: auth.adminId,
    action_type: ouvrir ? 'region_ouverte' : 'region_fermee',
    target_type: 'region',
    target_id: region,
    details: { region, ouvert: ouvrir, codes: codes?.map((d) => d.code) || [] },
  })

  invalidate()
  return { success: true }
}
