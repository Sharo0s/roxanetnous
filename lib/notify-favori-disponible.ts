'use server'

import { createClient } from '@/lib/supabase/server'
import { sendFavoriDisponibleEmail } from '@/lib/emails'

export async function notifyFavoriBeneficiaires(auxiliaireUserId: string) {
  const supabase = await createClient({ serviceRole: true })

  // Trouver le profil auxiliaire
  const { data: auxProfile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', auxiliaireUserId)
    .single()

  if (!auxProfile) return

  // Trouver les annonces de cet auxiliaire
  const { data: annonces } = await supabase
    .from('annonces_auxiliaires')
    .select('id')
    .eq('auxiliaire_id', auxProfile.id)

  if (!annonces || annonces.length === 0) return

  const annonceIds = annonces.map((a) => a.id)

  // Trouver les beneficiaires qui ont mis en favori une annonce de cet auxiliaire
  const { data: favoris } = await supabase
    .from('favoris')
    .select('user_id')
    .in('annonce_auxiliaire_id', annonceIds)

  if (!favoris || favoris.length === 0) return

  const beneficiaireUserIds = [...new Set(favoris.map((f) => f.user_id))]

  // Recuperer le prenom de l'auxiliaire
  const { data: auxUser } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', auxiliaireUserId)
    .single()

  const auxFirstName = auxUser?.first_name || 'Un auxiliaire'

  // Recuperer les infos des beneficiaires et envoyer les mails
  const { data: beneficiaires } = await supabase
    .from('users')
    .select('id, email, first_name')
    .in('id', beneficiaireUserIds)

  for (const ben of beneficiaires || []) {
    await sendFavoriDisponibleEmail({
      email: ben.email,
      beneficiaireFirstName: ben.first_name || 'Bonjour',
      auxiliaireFirstName: auxFirstName,
      userId: ben.id,
    })
  }
}
