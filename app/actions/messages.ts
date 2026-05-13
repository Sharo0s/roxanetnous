'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendNewMessageEmail } from '@/lib/emails'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

export type MessageResult = {
  error?: string
  conversationId?: string
}

type ConversationParticipantUserId = { user_id: string } | null

export async function getOrCreateConversation(
  accompagnanteProfileId: string
): Promise<MessageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') {
    return { error: 'Seuls les accompagnés peuvent initier une conversation.' }
  }

  // Recuperer le profil accompagne
  let { data: benProfile } = await supabase
    .from('accompagnes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!benProfile) {
    const { data: newProfile, error: createError } = await supabase
      .from('accompagnes_profiles')
      .insert({ user_id: user.id })
      .select('id')
      .single()

    if (createError || !newProfile) {
      return { error: 'Erreur lors de la création du profil.' }
    }
    benProfile = newProfile
  }

  // Verifier si une conversation existe deja
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnante_id', accompagnanteProfileId)
    .eq('accompagne_id', benProfile.id)
    .single()

  if (existing) {
    return { conversationId: existing.id }
  }

  // Story 3.6 : paywall sur ouverture conversation (apres check existence pour preserver idempotence D3)
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Abonnement requis pour contacter un accompagnant.' }
  }

  // Creer la conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnante_id: accompagnanteProfileId,
      accompagne_id: benProfile.id,
    })
    .select('id')
    .single()

  if (error || !conversation) {
    return { error: 'Erreur lors de la création de la conversation.' }
  }

  return { conversationId: conversation.id }
}

export async function getOrCreateConversationAsAccompagnante(
  accompagneProfileId: string
): Promise<MessageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') {
    return { error: 'Seuls les accompagnants peuvent utiliser cette fonction.' }
  }

  const { data: auxProfile } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!auxProfile) {
    return { error: 'Profil accompagnant introuvable.' }
  }

  // Verifier si une conversation existe deja
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnante_id', auxProfile.id)
    .eq('accompagne_id', accompagneProfileId)
    .single()

  if (existing) {
    return { conversationId: existing.id }
  }

  // Story 3.6 : paywall sur ouverture conversation (apres check existence pour preserver idempotence D3)
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    return { error: 'Abonnement requis pour contacter un beneficiaire.' }
  }

  // Creer la conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnante_id: auxProfile.id,
      accompagne_id: accompagneProfileId,
    })
    .select('id')
    .single()

  if (error || !conversation) {
    return { error: 'Erreur lors de la création de la conversation.' }
  }

  return { conversationId: conversation.id }
}

export async function getOrCreateAdminConversation(
  accompagnanteProfileId: string
): Promise<MessageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'admin') {
    return { error: 'Seul un admin peut ouvrir ce type de conversation.' }
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnante_id', accompagnanteProfileId)
    .eq('admin_id', user.id)
    .is('accompagne_id', null)
    .maybeSingle()

  if (existing) {
    return { conversationId: existing.id }
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnante_id: accompagnanteProfileId,
      accompagne_id: null,
      admin_id: user.id,
    })
    .select('id')
    .single()

  if (error || !conversation) {
    return { error: 'Erreur lors de la création de la conversation admin.' }
  }

  return { conversationId: conversation.id }
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  if (!content.trim()) {
    return { error: 'Le message ne peut pas être vide.' }
  }

  // Verifier que l'utilisateur fait partie de la conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id,
      accompagnante_id,
      accompagne_id,
      admin_id,
      accompagnantes_profiles:accompagnante_id (user_id),
      accompagnes_profiles:accompagne_id (user_id)
    `)
    .eq('id', conversationId)
    .single()

  if (!conversation) {
    return { error: 'Conversation non trouvée.' }
  }

  // Supabase generated types modelisent les relations 1-1 imbriquees comme tableaux.
  const auxProfile = conversation.accompagnantes_profiles as unknown as ConversationParticipantUserId
  const benProfile = conversation.accompagnes_profiles as unknown as ConversationParticipantUserId
  const adminUserId = conversation.admin_id as string | null

  const isAux = auxProfile?.user_id === user.id
  const isBen = benProfile?.user_id === user.id
  const isAdmin = adminUserId === user.id

  if (!isAux && !isBen && !isAdmin) {
    return { error: 'Accès non autorisé à cette conversation.' }
  }

  // Story 3.6 : paywall envoi message (D1 = skip si conversation contient un admin OU sender admin)
  if (!isAdmin && adminUserId === null) {
    const subscribed = await hasActiveSubscription(user.id)
    if (!subscribed) {
      return { error: 'Abonnement requis pour envoyer un message.' }
    }
  }

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    })

  if (error) {
    return { error: 'Erreur lors de l\'envoi du message.' }
  }

  // Mettre a jour last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  // Determiner le destinataire : l'autre partie de la conversation
  let recipientUserId: string | null = null
  if (isAux) {
    recipientUserId = benProfile?.user_id ?? adminUserId
  } else if (isBen) {
    recipientUserId = auxProfile?.user_id ?? null
  } else if (isAdmin) {
    recipientUserId = auxProfile?.user_id ?? null
  }

  // Envoyer un email de notification au destinataire (non-bloquant)
  if (recipientUserId) {
    const { data: senderData } = await supabase
      .from('users')
      .select('first_name')
      .eq('id', user.id)
      .single()

    const { data: recipientData } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', recipientUserId)
      .single()

    if (senderData && recipientData) {
      sendNewMessageEmail({
        email: recipientData.email,
        recipientFirstName: recipientData.first_name || '',
        senderFirstName: senderData.first_name || '',
        conversationId,
        userId: recipientUserId,
      }).catch(() => {})
    }
  }

  return {}
}

export async function markMessagesAsRead(
  conversationId: string
): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null)
}
