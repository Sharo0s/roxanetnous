'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

export type AnnonceResult = {
  error?: string
  success?: boolean
}

export async function createAnnonceAuxiliaire(data: {
  titre: string
  description: string
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]>
}): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id, validation_status')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouve.' }
  if (profile.validation_status !== 'valide') {
    return { error: 'Votre profil doit etre valide pour publier une annonce.' }
  }

  // Verifier l'abonnement actif
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour publier une annonce.' }
  }

  if (!data.titre.trim() || !data.description.trim()) {
    return { error: 'Le titre et la description sont requis.' }
  }

  if (!data.ville.trim() || !data.code_postal.trim()) {
    return { error: 'La ville et le code postal sont requis.' }
  }

  const { error } = await supabase
    .from('annonces_auxiliaires')
    .insert({
      auxiliaire_id: profile.id,
      titre: data.titre.trim(),
      description: data.description.trim(),
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim(),
      rayon_km: data.rayon_km,
      disponibilites: data.disponibilites,
      status: 'publiee',
      published_at: new Date().toISOString(),
    })

  if (error) {
    return { error: 'Erreur lors de la creation de l\'annonce.' }
  }

  redirect('/auxiliaire/annonces')
}

export async function updateAnnonceAuxiliaireStatus(
  annonceId: string,
  status: 'publiee' | 'archivee'
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: profile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouve.' }

  const updateData: Record<string, unknown> = { status }
  if (status === 'publiee') {
    updateData.published_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('annonces_auxiliaires')
    .update(updateData)
    .eq('id', annonceId)
    .eq('auxiliaire_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise a jour.' }
  }

  return { success: true }
}

export async function createAnnonceBeneficiaire(data: {
  titre: string
  description: string
  besoins_specifiques: string
  specialites_recherchees: string[]
  ville: string
  code_postal: string
  diplome_requis: string
  experience_min: string
  niveau_dependance: 'forte' | 'moderee' | 'peu'
  ouverture_aide: string
  equipe_en_place: string
  disponibilites: Record<string, string[]>
  date_debut: string
  infos_complementaires: string
  message_auxiliaires: string
}): Promise<AnnonceResult> {
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

  // Verifier l'abonnement actif
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour publier une annonce.' }
  }

  // Recuperer ou creer le profil beneficiaire
  let { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    const { data: newProfile, error: createError } = await supabase
      .from('beneficiaires_profiles')
      .insert({
        user_id: user.id,
        ville: data.ville.trim(),
        code_postal: data.code_postal.trim(),
      })
      .select('id')
      .single()

    if (createError || !newProfile) {
      return { error: 'Erreur lors de la creation du profil.' }
    }
    profile = newProfile
  }

  if (!data.titre.trim() || !data.description.trim()) {
    return { error: 'Le titre et la description sont requis.' }
  }

  if (!data.ville.trim() || data.specialites_recherchees.length === 0) {
    return { error: 'La ville et au moins une specialite sont requis.' }
  }

  const { error } = await supabase
    .from('annonces_beneficiaires')
    .insert({
      beneficiaire_id: profile.id,
      titre: data.titre.trim(),
      description: data.description.trim(),
      besoins_specifiques: data.besoins_specifiques.trim() || null,
      specialites_recherchees: data.specialites_recherchees,
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim() || null,
      diplome_requis: data.diplome_requis || null,
      experience_min: data.experience_min || null,
      niveau_dependance: data.niveau_dependance,
      ouverture_aide: data.ouverture_aide.trim(),
      equipe_en_place: data.equipe_en_place.trim(),
      disponibilites: data.disponibilites,
      date_debut: data.date_debut,
      infos_complementaires: data.infos_complementaires.trim() || null,
      message_auxiliaires: data.message_auxiliaires.trim() || null,
      status: 'publiee',
      published_at: new Date().toISOString(),
    })

  if (error) {
    return { error: 'Erreur lors de la creation de l\'annonce.' }
  }

  redirect('/beneficiaire/annonces')
}

export async function updateAnnonceBeneficiaireStatus(
  annonceId: string,
  status: 'publiee' | 'archivee'
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: profile } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouve.' }

  const updateData: Record<string, unknown> = { status }
  if (status === 'publiee') {
    updateData.published_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('annonces_beneficiaires')
    .update(updateData)
    .eq('id', annonceId)
    .eq('beneficiaire_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise a jour.' }
  }

  return { success: true }
}
