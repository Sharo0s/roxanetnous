'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { geocodeAddress } from '@/lib/geocoding'

export type OnboardingResult = {
  error?: string
  success?: boolean
}

export async function submitOnboarding(data: {
  diplome: string
  experience: string
  specialites: string[]
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]> | { flexible: boolean }
  langues: string[]
  permis_conduire: boolean
  vehicule: boolean
  description: string
}): Promise<OnboardingResult> {
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

  const { data: existingProfile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (existingProfile) {
    return { error: 'Profil deja existant.' }
  }

  if (!data.diplome || !data.experience || data.specialites.length === 0) {
    return { error: 'Diplome, experience et specialites sont requis.' }
  }

  if (!data.ville || !data.code_postal) {
    return { error: 'Ville et code postal sont requis.' }
  }

  if (!/^\d{5}$/.test(data.code_postal)) {
    return { error: 'Le code postal doit contenir 5 chiffres.' }
  }

  // Geocoder l'adresse pour obtenir les coordonnees
  const coords = await geocodeAddress(data.ville, data.code_postal)

  const { error } = await supabase
    .from('auxiliaires_profiles')
    .insert({
      user_id: user.id,
      diplome: data.diplome,
      experience: data.experience,
      specialites: data.specialites,
      ville: data.ville,
      code_postal: data.code_postal,
      rayon_km: data.rayon_km,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      disponibilites: data.disponibilites,
      langues: data.langues,
      permis_conduire: data.permis_conduire,
      vehicule: data.vehicule,
      description: data.description,
      validation_status: 'en_attente',
    })

  if (error) {
    return { error: 'Erreur lors de la creation du profil.' }
  }

  redirect('/auxiliaire/dashboard')
}

export async function uploadJustificatif(formData: FormData): Promise<OnboardingResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const file = formData.get('file') as File
  const type = formData.get('type') as string

  if (!file || !type) {
    return { error: 'Fichier et type requis.' }
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Format non supporte. Utilisez PDF, JPG, PNG ou WebP.' }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: 'Le fichier ne doit pas depasser 10 Mo.' }
  }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/${type}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('justificatifs')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    return { error: 'Erreur lors de l\'upload du fichier.' }
  }

  const field = type === 'identite' ? 'justificatif_identite_url' : 'justificatif_diplome_url'

  const { error: updateError } = await supabase
    .from('auxiliaires_profiles')
    .update({ [field]: path })
    .eq('user_id', user.id)

  if (updateError) {
    return { error: 'Erreur lors de la mise a jour du profil.' }
  }

  return { success: true }
}
