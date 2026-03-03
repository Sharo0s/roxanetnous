'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendTeamInviteEmail } from '@/lib/emails'

async function getBeneficiaireProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('beneficiaires_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getAvailableAuxiliaires() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return []

  // Auxiliaires avec conversation existante pas encore dans l'equipe
  const { data: conversations } = await supabase
    .from('conversations')
    .select('auxiliaire_id')
    .eq('beneficiaire_id', profile.id)

  if (!conversations || conversations.length === 0) return []

  const auxProfileIds = conversations.map(c => c.auxiliaire_id)

  // Recuperer les user_ids des auxiliaires
  const { data: auxProfiles } = await supabase
    .from('auxiliaires_profiles')
    .select('user_id')
    .in('id', auxProfileIds)

  if (!auxProfiles || auxProfiles.length === 0) return []

  const auxUserIds = auxProfiles.map(p => p.user_id)

  // Exclure ceux deja dans l'equipe
  const { data: existingTeam } = await supabase
    .from('beneficiaire_auxiliaires')
    .select('auxiliaire_user_id')
    .eq('beneficiaire_id', profile.id)

  const existingIds = new Set(existingTeam?.map(t => t.auxiliaire_user_id) || [])
  const availableUserIds = auxUserIds.filter(id => !existingIds.has(id))

  if (availableUserIds.length === 0) return []

  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', availableUserIds)

  return users || []
}

export async function getTeamMembers() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return []

  const { data: team } = await supabase
    .from('beneficiaire_auxiliaires')
    .select('id, auxiliaire_user_id, couleur, actif, created_at')
    .eq('beneficiaire_id', profile.id)
    .order('created_at', { ascending: true })

  if (!team || team.length === 0) return []

  const userIds = team.map(t => t.auxiliaire_user_id)
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', userIds)

  const usersMap = new Map(users?.map(u => [u.id, u]) || [])

  return team.map(t => ({
    ...t,
    first_name: usersMap.get(t.auxiliaire_user_id)?.first_name || '',
    last_name: usersMap.get(t.auxiliaire_user_id)?.last_name || '',
  }))
}

export async function addAuxiliaireToTeam(auxiliaireUserId: string, couleur: string = '#6B7280') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  // Verifier qu'une conversation existe
  const { data: auxProfile } = await supabase
    .from('auxiliaires_profiles')
    .select('id')
    .eq('user_id', auxiliaireUserId)
    .single()

  if (!auxProfile) return { error: 'Auxiliaire introuvable' }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('beneficiaire_id', profile.id)
    .eq('auxiliaire_id', auxProfile.id)
    .single()

  if (!conversation) return { error: 'Aucune conversation existante avec cet auxiliaire' }

  const { error } = await supabase
    .from('beneficiaire_auxiliaires')
    .insert({
      beneficiaire_id: profile.id,
      auxiliaire_user_id: auxiliaireUserId,
      couleur,
    })

  if (error) {
    if (error.code === '23505') return { error: 'Cet auxiliaire est deja dans votre equipe' }
    return { error: 'Erreur lors de l\'ajout' }
  }

  // Envoyer email notification
  const { data: auxUser } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('id', auxiliaireUserId)
    .single()

  const { data: benefUser } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', user.id)
    .single()

  if (auxUser) {
    await sendTeamInviteEmail({
      email: auxUser.email,
      auxiliaireFirstName: auxUser.first_name || '',
      beneficiaireFirstName: benefUser?.first_name || '',
      userId: auxiliaireUserId,
    })
  }

  revalidatePath('/beneficiaire/planning/equipe')
  return { success: true }
}

export async function updateAuxiliaireColor(auxiliaireUserId: string, couleur: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  await supabase
    .from('beneficiaire_auxiliaires')
    .update({ couleur })
    .eq('beneficiaire_id', profile.id)
    .eq('auxiliaire_user_id', auxiliaireUserId)

  revalidatePath('/beneficiaire/planning/equipe')
  return { success: true }
}

export async function toggleAuxiliaireActif(auxiliaireUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  // Lire l'etat actuel
  const { data: current } = await supabase
    .from('beneficiaire_auxiliaires')
    .select('actif')
    .eq('beneficiaire_id', profile.id)
    .eq('auxiliaire_user_id', auxiliaireUserId)
    .single()

  if (!current) return { error: 'Auxiliaire introuvable dans votre equipe' }

  await supabase
    .from('beneficiaire_auxiliaires')
    .update({ actif: !current.actif })
    .eq('beneficiaire_id', profile.id)
    .eq('auxiliaire_user_id', auxiliaireUserId)

  revalidatePath('/beneficiaire/planning/equipe')
  return { success: true }
}

export async function removeAuxiliaireFromTeam(auxiliaireUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getBeneficiaireProfile(supabase, user.id)
  if (!profile) return { error: 'Profil beneficiaire introuvable' }

  await supabase
    .from('beneficiaire_auxiliaires')
    .delete()
    .eq('beneficiaire_id', profile.id)
    .eq('auxiliaire_user_id', auxiliaireUserId)

  revalidatePath('/beneficiaire/planning/equipe')
  return { success: true }
}
