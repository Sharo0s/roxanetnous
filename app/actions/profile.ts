'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ProfileResult = {
  error?: string
  success?: boolean
}

export async function updateAuxiliaireProfile(data: {
  diplomes: string[]
  experience: string
  specialites: string[]
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]>
  langues: string[]
  permis_conduire: boolean
  vehicule: boolean
  description: string
}): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'auxiliaire') {
    return { error: 'Acces non autorise.' }
  }

  if (data.diplomes.length === 0 || !data.experience || data.specialites.length === 0) {
    return { error: 'Diplomes, experience et specialites sont requis.' }
  }

  if (!data.ville || !data.code_postal) {
    return { error: 'Ville et code postal sont requis.' }
  }

  // Verifier le statut actuel pour remettre en attente si necessaire
  const { data: currentProfile } = await supabase
    .from('auxiliaires_profiles')
    .select('validation_status')
    .eq('user_id', user.id)
    .single()

  const updateData: Record<string, unknown> = {
    diplomes: data.diplomes,
    experience: data.experience,
    specialites: data.specialites,
    ville: data.ville,
    code_postal: data.code_postal,
    rayon_km: data.rayon_km,
    disponibilites: data.disponibilites,
    langues: data.langues,
    permis_conduire: data.permis_conduire,
    vehicule: data.vehicule,
    description: data.description,
    updated_at: new Date().toISOString(),
  }

  // Remettre en attente si le profil etait refuse ou a completer
  if (currentProfile?.validation_status === 'a_completer' || currentProfile?.validation_status === 'refuse') {
    updateData.validation_status = 'en_attente'
    updateData.refus_motif = null
  }

  const { error } = await supabase
    .from('auxiliaires_profiles')
    .update(updateData)
    .eq('user_id', user.id)

  if (error) {
    return { error: 'Erreur lors de la mise a jour du profil.' }
  }

  revalidatePath('/auxiliaire/profil')
  revalidatePath('/auxiliaire/dashboard')
  return { success: true }
}

export async function updateUserInfo(data: {
  first_name: string
  last_name: string
  phone: string
}): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  if (!data.first_name.trim() || !data.last_name.trim()) {
    return { error: 'Le prenom et le nom sont requis.' }
  }

  const { error } = await supabase
    .from('users')
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: data.phone.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'Erreur lors de la mise a jour.' }
  }

  revalidatePath('/auxiliaire/profil')
  revalidatePath('/beneficiaire/profil')
  return { success: true }
}

export async function updateLastSeen(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
}

export async function toggleDisponible(): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('disponible')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  const { error } = await supabase
    .from('auxiliaires_profiles')
    .update({ disponible: !profile.disponible })
    .eq('user_id', user.id)

  if (error) return { error: 'Erreur lors de la mise a jour.' }

  revalidatePath('/auxiliaire/profil')
  revalidatePath('/auxiliaire/dashboard')
  revalidatePath('/recherche')
  return { success: true }
}

export async function updateBeneficiaireProfile(data: {
  ville: string
  code_postal: string
  adresse: string
}): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'beneficiaire') {
    return { error: 'Acces non autorise.' }
  }

  // Verifier si le profil existe
  const { data: existing } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('beneficiaires_profiles')
      .update({
        ville: data.ville.trim() || null,
        code_postal: data.code_postal.trim() || null,
        adresse: data.adresse.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) return { error: 'Erreur lors de la mise a jour.' }
  } else {
    const { error } = await supabase
      .from('beneficiaires_profiles')
      .insert({
        user_id: user.id,
        ville: data.ville.trim() || null,
        code_postal: data.code_postal.trim() || null,
        adresse: data.adresse.trim() || null,
      })

    if (error) return { error: 'Erreur lors de la creation du profil.' }
  }

  revalidatePath('/beneficiaire/profil')
  return { success: true }
}
