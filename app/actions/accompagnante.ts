'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { geocodeAddress } from '@/lib/geocoding'

export type OnboardingResult = {
  error?: string
  success?: boolean
}

export async function submitOnboarding(data: {
  diplomes: string[]
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
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') {
    return { error: 'Accès non autorisé.' }
  }

  // En flow filleule (parrainee + parrainage actif), les diplômes et leurs
  // justificatifs sont remplacés par la garantie de la marraine. Expérience
  // et spécialités restent obligatoires pour que le profil soit exploitable
  // côté recherche.
  // Service role : la RLS sur `users` peut ne pas exposer parrainee_par au
  // client utilisateur ; cohérent avec la lecture côté onboarding/page.tsx.
  const supabaseAdmin = await createClient({ serviceRole: true })
  const { data: parrainageRow } = await supabaseAdmin
    .from('users')
    .select('parrainee_par')
    .eq('id', user.id)
    .maybeSingle()

  let isFilleule = false
  if (parrainageRow?.parrainee_par) {
    const { data: activeParrainage } = await supabaseAdmin
      .from('parrainages')
      .select('id, statut')
      .eq('filleule_id', user.id)
      .eq('marraine_id', parrainageRow.parrainee_par)
      .in('statut', ['inscrite', 'abonnee', 'confirme'])
      .limit(1)
      .maybeSingle()
    isFilleule = !!activeParrainage
  }

  // L2 (code review 2026-04-29) : pour la filleule (validée par parrainage),
  // experience et specialites deviennent optionnels — alignement avec
  // l'esprit AC7 spec 2.1 (le bypass parrainage retire toutes les exigences
  // de step 0). Une filleule peut compléter son profil progressivement.
  if (!isFilleule) {
    if (data.diplomes.length === 0 || !data.experience || data.specialites.length === 0) {
      return { error: 'Diplômes, expérience et spécialités sont requis.' }
    }
  }

  if (!data.ville || !data.code_postal) {
    return { error: 'Ville et code postal sont requis.' }
  }

  if (!/^\d{5}$/.test(data.code_postal)) {
    return { error: 'Le code postal doit contenir 5 chiffres.' }
  }

  // M2 (code review 2026-04-28) : validation des disponibilités, applicable
  // aussi en flow filleule. Le bypass parrainage ne doit pas rendre le profil
  // inexploitable côté recherche : il faut au minimum une plage horaire ou
  // l'option flexible.
  const dispo = data.disponibilites
  const isFlexible =
    typeof dispo === 'object' && dispo !== null && 'flexible' in dispo && dispo.flexible === true
  const hasSlots =
    typeof dispo === 'object' &&
    dispo !== null &&
    !('flexible' in dispo) &&
    Object.values(dispo as Record<string, string[]>).some((slots) => Array.isArray(slots) && slots.length > 0)
  if (!isFlexible && !hasSlots) {
    return { error: 'Renseignez au moins une plage horaire ou cochez "flexible".' }
  }

  // Geocoder l'adresse pour obtenir les coordonnees
  const coords = await geocodeAddress(data.ville, data.code_postal)

  const profileData = {
    diplomes: data.diplomes,
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
    validation_status: 'en_attente' as const,
  }

  // Le trigger handle_new_user cree deja un profil vide, on fait un upsert
  const { data: existingProfile } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  let error
  if (existingProfile) {
    const result = await supabase
      .from('accompagnantes_profiles')
      .update(profileData)
      .eq('user_id', user.id)
    error = result.error
  } else {
    const result = await supabase
      .from('accompagnantes_profiles')
      .insert({ user_id: user.id, ...profileData })
    error = result.error
  }

  if (error) {
    return { error: 'Erreur lors de la création du profil.' }
  }

  redirect('/accompagnante/dashboard')
}

export async function uploadJustificatif(formData: FormData): Promise<OnboardingResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const file = formData.get('file') as File
  const type = formData.get('type') as string

  if (!file || !type) {
    return { error: 'Fichier et type requis.' }
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Format non supporté. Utilisez PDF, JPG, PNG ou WebP.' }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: 'Le fichier ne doit pas dépasser 10 Mo.' }
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

  // Gerer les types diplome:xxx (upload par diplome)
  const isDiplomeType = type.startsWith('diplome:')
  const diplomeKey = isDiplomeType ? type.split(':')[1] : null

  if (isDiplomeType && diplomeKey) {
    // Recuperer le profil pour merger dans le jsonb
    const { data: currentProfile } = await supabase
      .from('accompagnantes_profiles')
      .select('justificatifs_diplomes')
      .eq('user_id', user.id)
      .single()

    const current = (currentProfile?.justificatifs_diplomes as Record<string, string>) || {}
    const updated = { ...current, [diplomeKey]: path }

    const { error: updateError } = await supabase
      .from('accompagnantes_profiles')
      .update({ justificatifs_diplomes: updated })
      .eq('user_id', user.id)

    if (updateError) {
      return { error: 'Erreur lors de la mise à jour du profil.' }
    }
  } else {
    const fieldMap: Record<string, string> = {
      identite: 'justificatif_identite_url',
      permis: 'justificatif_permis_url',
      cv: 'justificatif_cv_url',
    }
    const field = fieldMap[type]
    if (!field) {
      return { error: 'Type de justificatif non reconnu.' }
    }

    const { error: updateError } = await supabase
      .from('accompagnantes_profiles')
      .update({ [field]: path })
      .eq('user_id', user.id)

    if (updateError) {
      return { error: 'Erreur lors de la mise à jour du profil.' }
    }
  }

  return { success: true }
}
