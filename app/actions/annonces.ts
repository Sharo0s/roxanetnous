'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { hasActiveSubscription } from '@/lib/subscription-helpers'
import { geocodeAddress } from '@/lib/geocoding'
import { isDepartementOuvert, getMessageRestriction } from '@/lib/departements'
import { notifyMatchingUsers } from '@/lib/matching-notifications'

export type AnnonceResult = {
  error?: string
  success?: boolean
}

// Story 7.A.9 (AC4) : whitelist applicative pour les toggles de status d'annonce.
// Filet de securite runtime aligne sur le typage TS `status: 'publiee' | 'archivee'`
// (defense en profondeur contre un appel HTTP direct `... as any`).
const ALLOWED_TOGGLE_STATUSES = ['publiee', 'archivee'] as const
type AllowedToggleStatus = (typeof ALLOWED_TOGGLE_STATUSES)[number]

export async function createAnnonceAccompagnante(data: {
  description: string
  ville: string
  code_postal: string
  rayon_km: number
  disponibilites: Record<string, string[]>
}): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnants_profiles')
    .select('id, validation_status')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }
  if (profile.validation_status !== 'valide') {
    return { error: 'Votre profil doit être validé pour publier une annonce.' }
  }

  // Verifier l'abonnement actif
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour publier une annonce.' }
  }

  if (!data.description.trim()) {
    return { error: 'La description est requise.' }
  }

  if (!data.ville.trim() || !data.code_postal.trim()) {
    return { error: 'La ville et le code postal sont requis.' }
  }

  if (!(await isDepartementOuvert(data.code_postal))) {
    return { error: await getMessageRestriction() }
  }

  const coords = await geocodeAddress(data.ville.trim(), data.code_postal.trim())

  const { data: insertedAnnonce, error } = await supabase
    .from('annonces_accompagnants')
    .insert({
      accompagnant_id: profile.id,
      titre: '',
      description: data.description.trim(),
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim(),
      rayon_km: data.rayon_km,
      disponibilites: data.disponibilites,
      status: 'publiee',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Erreur lors de la création de l\'annonce.' }
  }

  // Mettre a jour lat/lng sur le profil accompagnant si pas encore renseigne
  if (coords) {
    await supabase
      .from('accompagnants_profiles')
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq('id', profile.id)
      .is('latitude', null)
  }

  // Notifier les accompagnes dont l'annonce correspond (fire-and-forget)
  if (insertedAnnonce) {
    notifyMatchingUsers({
      annonceType: 'accompagnant',
      annonceId: insertedAnnonce.id,
    }).catch(() => {})
  }

  redirect('/accompagnant/annonces')
}

export async function updateAnnonceAccompagnante(
  annonceId: string,
  data: {
    description: string
    ville: string
    code_postal: string
    rayon_km: number
    disponibilites: Record<string, string[]>
  }
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  if (!data.description.trim()) {
    return { error: 'La description est requise.' }
  }

  if (data.code_postal.trim() && !(await isDepartementOuvert(data.code_postal))) {
    return { error: await getMessageRestriction() }
  }

  // Story 3.6 (patch F9 review) : check abonnement apres validation des inputs pour eviter
  // un round-trip Supabase inutile quand le formulaire est mal rempli.
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour modifier une annonce.' }
  }

  const { error } = await supabase
    .from('annonces_accompagnants')
    .update({
      description: data.description.trim(),
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim(),
      rayon_km: data.rayon_km,
      disponibilites: data.disponibilites,
    })
    .eq('id', annonceId)
    .eq('accompagnant_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise à jour.' }
  }

  redirect('/accompagnant/annonces')
}

export async function updateAnnonceAccompagnanteStatus(
  annonceId: string,
  status: 'publiee' | 'archivee'
): Promise<AnnonceResult> {
  // Story 7.A.9 (AC4) : whitelist applicative en tete -- fail-fast avant tout
  // round-trip BDD ou check session pour un appel out-of-band.
  if (!ALLOWED_TOGGLE_STATUSES.includes(status as AllowedToggleStatus)) {
    return { error: 'Statut invalide.' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  // Story 7.A.9 (AC2/AC3) : early-return idempotent `publiee -> publiee` avant le
  // check abonnement pour eviter de paywaller un no-op et empecher le bump frauduleux
  // de `published_at` (vector de fraude au classement sur le tri du feed).
  const { data: current, error: currentErr } = await supabase
    .from('annonces_accompagnants')
    .select('status')
    .eq('id', annonceId)
    .eq('accompagnant_id', profile.id)
    .maybeSingle()

  if (currentErr) return { error: 'Erreur lors de la mise à jour.' }
  if (!current) return { error: 'Annonce introuvable.' }

  if (current.status === 'publiee' && status === 'publiee') {
    return { success: true }
  }

  // Review 7.A.9/7.A.10 : empeche un utilisateur de re-publier une annonce suspendue par un admin.
  // L'archivage reste autorise (droit utilisateur, cf. Story 3.6 commentaire ci-dessous).
  if (current.status === 'suspendue' && status === 'publiee') {
    return { error: 'Cette annonce est suspendue par un administrateur.' }
  }

  // Story 3.6 : paywall asymetrique sur toggle (D5) : reactivation 'publiee' = re-publication implicite => paywall.
  // Archivage 'archivee' = retrait => pas de paywall (droit utilisateur).
  if (status === 'publiee') {
    const subscribed = await hasActiveSubscription(user.id)
    if (!subscribed) {
      return { error: 'Un abonnement actif est requis pour publier une annonce.' }
    }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'publiee') {
    updateData.published_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('annonces_accompagnants')
    .update(updateData)
    .eq('id', annonceId)
    .eq('accompagnant_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise à jour.' }
  }

  return { success: true }
}

export async function createAnnonceAccompagne(data: {
  titre: string
  description: string
  besoins_specifiques: string
  specialites_recherchees: string[]
  ville: string
  code_postal: string
  diplome_requis: string
  experience_min: string
  niveau_dependance: 'besoins_plus_plus_plus' | 'besoins_plus_plus' | 'besoins_plus'
  ouverture_aide: string
  equipe_en_place: string
  disponibilites: Record<string, string[]>
  date_debut: string
  infos_complementaires: string
  message_accompagnants: string
}): Promise<AnnonceResult> {
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

  if (data.code_postal.trim() && !(await isDepartementOuvert(data.code_postal))) {
    return { error: await getMessageRestriction() }
  }

  // Verifier l'abonnement actif
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour publier une annonce.' }
  }

  // Recuperer ou creer le profil accompagne
  let { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    const { data: newProfile, error: createError } = await supabase
      .from('accompagnes_profiles')
      .insert({
        user_id: user.id,
        ville: data.ville.trim(),
        code_postal: data.code_postal.trim(),
      })
      .select('id')
      .single()

    if (createError || !newProfile) {
      return { error: 'Erreur lors de la création du profil.' }
    }
    profile = newProfile
  }

  if (!data.titre.trim() || !data.description.trim()) {
    return { error: 'Le titre et la description sont requis.' }
  }

  if (!data.ville.trim() || data.specialites_recherchees.length === 0) {
    return { error: 'La ville et au moins une spécialité sont requis.' }
  }

  const coords = await geocodeAddress(data.ville.trim(), data.code_postal.trim() || '')

  const { data: insertedAnnonce, error } = await supabase
    .from('annonces_accompagnes')
    .insert({
      accompagne_id: profile.id,
      titre: data.titre.trim(),
      description: data.description.trim(),
      besoins_specifiques: data.besoins_specifiques.trim() || null,
      specialites_recherchees: data.specialites_recherchees,
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim() || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      diplome_requis: data.diplome_requis || null,
      experience_min: data.experience_min || null,
      niveau_dependance: data.niveau_dependance,
      ouverture_aide: data.ouverture_aide.trim(),
      equipe_en_place: data.equipe_en_place.trim(),
      disponibilites: data.disponibilites,
      date_debut: data.date_debut,
      infos_complementaires: data.infos_complementaires.trim() || null,
      message_accompagnants: data.message_accompagnants.trim() || null,
      status: 'publiee',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return { error: 'Erreur lors de la création de l\'annonce.' }
  }

  // Notifier les accompagnants dont le profil correspond (fire-and-forget)
  if (insertedAnnonce) {
    notifyMatchingUsers({
      annonceType: 'accompagne',
      annonceId: insertedAnnonce.id,
    }).catch(() => {})
  }

  redirect('/accompagne/annonces')
}

export async function updateAnnonceAccompagne(
  annonceId: string,
  data: {
    titre: string
    description: string
    besoins_specifiques: string
    specialites_recherchees: string[]
    ville: string
    code_postal: string
    diplome_requis: string
    experience_min: string
    niveau_dependance: 'besoins_plus_plus_plus' | 'besoins_plus_plus' | 'besoins_plus'
    equipe_en_place: string
    disponibilites: Record<string, string[]>
    date_debut: string
    infos_complementaires: string
    message_accompagnants: string
  }
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  if (!data.titre.trim() || !data.description.trim()) {
    return { error: 'Le titre et la description sont requis.' }
  }

  if (!data.ville.trim() || data.specialites_recherchees.length === 0) {
    return { error: 'La ville et au moins une spécialité sont requis.' }
  }

  if (data.code_postal.trim() && !(await isDepartementOuvert(data.code_postal))) {
    return { error: await getMessageRestriction() }
  }

  // Story 3.6 (patch F9 review) : check abonnement apres validation des inputs pour eviter
  // un round-trip Supabase inutile quand le formulaire est mal rempli.
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Un abonnement actif est requis pour modifier une annonce.' }
  }

  const coords = await geocodeAddress(data.ville.trim(), data.code_postal.trim() || '')

  const { error } = await supabase
    .from('annonces_accompagnes')
    .update({
      titre: data.titre.trim(),
      description: data.description.trim(),
      besoins_specifiques: data.besoins_specifiques.trim() || null,
      specialites_recherchees: data.specialites_recherchees,
      ville: data.ville.trim(),
      code_postal: data.code_postal.trim() || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      diplome_requis: data.diplome_requis || null,
      experience_min: data.experience_min || null,
      niveau_dependance: data.niveau_dependance,
      equipe_en_place: data.equipe_en_place.trim(),
      disponibilites: data.disponibilites,
      date_debut: data.date_debut,
      infos_complementaires: data.infos_complementaires.trim() || null,
      message_accompagnants: data.message_accompagnants.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', annonceId)
    .eq('accompagne_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise à jour de l\'annonce.' }
  }

  redirect('/accompagne/annonces')
}

export async function deleteAnnonceAccompagnante(
  annonceId: string
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  const { error } = await supabase
    .from('annonces_accompagnants')
    .delete()
    .eq('id', annonceId)
    .eq('accompagnant_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la suppression.' }
  }

  return { success: true }
}

export async function deleteAnnonceAccompagne(
  annonceId: string
): Promise<AnnonceResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  const { error } = await supabase
    .from('annonces_accompagnes')
    .delete()
    .eq('id', annonceId)
    .eq('accompagne_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la suppression.' }
  }

  return { success: true }
}

export async function updateAnnonceAccompagneStatus(
  annonceId: string,
  status: 'publiee' | 'archivee'
): Promise<AnnonceResult> {
  // Story 7.A.9 (AC4) : whitelist applicative en tete -- symetrie avec
  // updateAnnonceAccompagnanteStatus.
  if (!ALLOWED_TOGGLE_STATUSES.includes(status as AllowedToggleStatus)) {
    return { error: 'Statut invalide.' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: profile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil non trouvé.' }

  // Story 7.A.9 (AC2/AC3) : early-return idempotent `publiee -> publiee` avant le
  // check abonnement -- symetrie stricte avec updateAnnonceAccompagnanteStatus.
  const { data: current, error: currentErr } = await supabase
    .from('annonces_accompagnes')
    .select('status')
    .eq('id', annonceId)
    .eq('accompagne_id', profile.id)
    .maybeSingle()

  if (currentErr) return { error: 'Erreur lors de la mise à jour.' }
  if (!current) return { error: 'Annonce introuvable.' }

  if (current.status === 'publiee' && status === 'publiee') {
    return { success: true }
  }

  // Review 7.A.9/7.A.10 : empeche un utilisateur de re-publier une annonce suspendue par un admin.
  // L'archivage reste autorise (droit utilisateur, cf. Story 3.6 commentaire ci-dessous).
  if (current.status === 'suspendue' && status === 'publiee') {
    return { error: 'Cette annonce est suspendue par un administrateur.' }
  }

  // Story 3.6 : paywall asymetrique sur toggle (D5) : reactivation 'publiee' = re-publication => paywall.
  // Archivage 'archivee' = retrait => pas de paywall (droit utilisateur).
  if (status === 'publiee') {
    const subscribed = await hasActiveSubscription(user.id)
    if (!subscribed) {
      return { error: 'Un abonnement actif est requis pour publier une annonce.' }
    }
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'publiee') {
    updateData.published_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('annonces_accompagnes')
    .update(updateData)
    .eq('id', annonceId)
    .eq('accompagne_id', profile.id)

  if (error) {
    return { error: 'Erreur lors de la mise à jour.' }
  }

  return { success: true }
}
