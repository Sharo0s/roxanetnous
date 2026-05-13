'use server'

import { createClient } from '@/lib/supabase/server'
import { sendFavoriDisponibleEmail } from '@/lib/emails'

export async function notifyFavoriAccompagnes(accompagnanteUserId: string) {
  const supabase = await createClient({ serviceRole: true })

  // Trouver le profil accompagnante
  const { data: auxProfile } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', accompagnanteUserId)
    .single()

  if (!auxProfile) return

  // Trouver les annonces de cette accompagnante
  const { data: annonces } = await supabase
    .from('annonces_accompagnantes')
    .select('id')
    .eq('accompagnante_id', auxProfile.id)

  if (!annonces || annonces.length === 0) return

  const annonceIds = annonces.map((a) => a.id)

  // Trouver les accompagnes qui ont mis en favori une annonce de cette accompagnante
  const { data: favoris } = await supabase
    .from('favoris')
    .select('user_id')
    .in('annonce_accompagnante_id', annonceIds)

  if (!favoris || favoris.length === 0) return

  const accompagneUserIds = [...new Set(favoris.map((f) => f.user_id))]

  // Recuperer le prenom de l'accompagnante
  const { data: auxUser } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', accompagnanteUserId)
    .single()

  const auxFirstName = auxUser?.first_name || 'Un accompagnant'

  // Recuperer les infos des accompagnes et envoyer les mails
  const { data: accompagnes } = await supabase
    .from('users')
    .select('id, email, first_name')
    .in('id', accompagneUserIds)

  for (const ben of accompagnes || []) {
    await sendFavoriDisponibleEmail({
      email: ben.email,
      accompagneFirstName: ben.first_name || 'Bonjour',
      accompagnanteFirstName: auxFirstName,
      userId: ben.id,
    })
  }
}
