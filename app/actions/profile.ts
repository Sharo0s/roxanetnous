'use server'

import { createClient } from '@/lib/supabase/server'
import { notifyFavoriAccompagnes } from '@/lib/notify-favori-disponible'
import { revalidatePath } from 'next/cache'

export type ProfileResult = {
  error?: string
  success?: boolean
}

export async function updateAccompagnanteProfile(data: {
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
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') {
    return { error: 'Accès non autorisé.' }
  }

  if (data.diplomes.length === 0 || !data.experience || data.specialites.length === 0) {
    return { error: 'Diplômes, expérience et spécialités sont requis.' }
  }

  if (!data.ville || !data.code_postal) {
    return { error: 'Ville et code postal sont requis.' }
  }

  // Verifier le statut actuel pour remettre en attente si necessaire
  const { data: currentProfile } = await supabase
    .from('accompagnantes_profiles')
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

  // Remettre en attente si le profil etait refuse, a completer, ou en cycle visio
  // (FR11bis : toute modification de dossier apres revue documentaire impose une nouvelle revue)
  const resetFromStatuses = new Set<string>([
    'a_completer',
    'refuse',
    'visio_a_planifier',
    'visio_realisee',
  ])
  if (currentProfile?.validation_status && resetFromStatuses.has(currentProfile.validation_status)) {
    updateData.validation_status = 'en_attente'
    updateData.refus_motif = null
    updateData.visio_date = null
    updateData.visio_notes = null
  }

  const { error } = await supabase
    .from('accompagnantes_profiles')
    .update(updateData)
    .eq('user_id', user.id)

  if (error) {
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }

  revalidatePath('/accompagnante/profil')
  revalidatePath('/accompagnante/dashboard')
  return { success: true }
}

export async function updateUserInfo(data: {
  first_name: string
  last_name: string
  phone: string
}): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  if (!data.first_name.trim() || !data.last_name.trim()) {
    return { error: 'Le prénom et le nom sont requis.' }
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
    return { error: 'Erreur lors de la mise à jour.' }
  }

  revalidatePath('/accompagnante/profil')
  revalidatePath('/accompagne/profil')
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

export async function toggleDisponible(indisponibleJusquAu?: string | null): Promise<ProfileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnantes_profiles')
    .select('disponible')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  const newValue = !profile.disponible

  const { error } = await supabase
    .from('accompagnantes_profiles')
    .update({
      disponible: newValue,
      indisponible_jusqu_au: newValue ? null : (indisponibleJusquAu || null),
    })
    .eq('user_id', user.id)

  if (error) return { error: 'Erreur lors de la mise à jour.' }

  // Mettre a jour badges_cache immediatement
  await supabase
    .from('badges_cache')
    .update({ disponible: newValue, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // Si repasse disponible, notifier les accompagnes qui l'ont en favori (fire-and-forget)
  if (newValue) {
    notifyFavoriAccompagnes(user.id).catch(() => {})
  }

  revalidatePath('/accompagnante/profil')
  revalidatePath('/accompagnante/dashboard')
  revalidatePath('/recherche')
  return { success: true }
}

export async function updateAccompagneProfile(data: {
  ville: string
  code_postal: string
  adresse: string
}): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') {
    return { error: 'Accès non autorisé.' }
  }

  // Verifier si le profil existe
  const { data: existing } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('accompagnes_profiles')
      .update({
        ville: data.ville.trim() || null,
        code_postal: data.code_postal.trim() || null,
        adresse: data.adresse.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) return { error: 'Erreur lors de la mise à jour.' }
  } else {
    const { error } = await supabase
      .from('accompagnes_profiles')
      .insert({
        user_id: user.id,
        ville: data.ville.trim() || null,
        code_postal: data.code_postal.trim() || null,
        adresse: data.adresse.trim() || null,
      })

    if (error) return { error: 'Erreur lors de la création du profil.' }
  }

  revalidatePath('/accompagne/profil')
  return { success: true }
}

export async function uploadAvatar(formData: FormData): Promise<ProfileResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const file = formData.get('file') as File
  if (!file) return { error: 'Fichier requis.' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Le fichier ne doit pas dépasser 5 Mo.' }
  }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    return { error: 'Erreur lors de l\'upload.' }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) {
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }

  revalidatePath('/accompagnante/dashboard')
  revalidatePath('/accompagnante/profil')
  return { success: true }
}
