'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function exportUserData(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Collect all user data
  const [
    { data: userData },
    { data: auxProfile },
    { data: benProfile },
    { data: annoncesAux },
    { data: annoncesBen },
    { data: avisAuteur },
    { data: avisCible },
    { data: messages },
    { data: subscription },
    { data: favoris },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', user.id).single(),
    supabaseAdmin.from('accompagnantes_profiles').select('*').eq('user_id', user.id).single(),
    supabaseAdmin.from('accompagnes_profiles').select('*').eq('user_id', user.id).single(),
    supabaseAdmin.from('annonces_accompagnantes').select('*').eq('accompagnante_id', user.id),
    supabaseAdmin.from('annonces_accompagnes').select('*').eq('accompagne_id', user.id),
    supabaseAdmin.from('avis').select('*').eq('auteur_id', user.id),
    supabaseAdmin.from('avis').select('*').eq('cible_id', user.id),
    supabaseAdmin.from('messages').select('*').eq('sender_id', user.id),
    supabaseAdmin.from('subscriptions').select('*').eq('user_id', user.id).single(),
    supabaseAdmin.from('favoris').select('*').eq('user_id', user.id),
  ])

  // For annonces, we need to query by profile ID, not user ID
  let annoncesAuxData = annoncesAux
  let annoncesBenData = annoncesBen
  if (auxProfile) {
    const { data } = await supabaseAdmin
      .from('annonces_accompagnantes')
      .select('*')
      .eq('accompagnante_id', auxProfile.id)
    annoncesAuxData = data
  }
  if (benProfile) {
    const { data } = await supabaseAdmin
      .from('annonces_accompagnes')
      .select('*')
      .eq('accompagne_id', benProfile.id)
    annoncesBenData = data
  }

  const exportData = {
    export_date: new Date().toISOString(),
    user: userData,
    profil_accompagnante: auxProfile,
    profil_accompagne: benProfile,
    annonces_accompagnante: annoncesAuxData || [],
    annonces_accompagne: annoncesBenData || [],
    avis_donnes: avisAuteur || [],
    avis_recus: avisCible || [],
    messages_envoyes: messages || [],
    abonnement: subscription,
    favoris: favoris || [],
  }

  return JSON.stringify(exportData, null, 2)
}
