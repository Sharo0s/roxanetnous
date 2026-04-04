'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendNewMessageEmail } from '@/lib/emails'

export type MessageResult = {
  error?: string
  conversationId?: string
}

export async function getOrCreateConversation(
  accompagnanteProfileId: string
): Promise<MessageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagne') {
    return { error: 'Seuls les accompagnes peuvent initier une conversation.' }
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
      return { error: 'Erreur lors de la creation du profil.' }
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
    return { error: 'Erreur lors de la creation de la conversation.' }
  }

  return { conversationId: conversation.id }
}

export async function getOrCreateConversationAsAccompagnante(
  accompagneProfileId: string
): Promise<MessageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'accompagnante') {
    return { error: 'Seuls les accompagnantes peuvent utiliser cette fonction.' }
  }

  const { data: auxProfile } = await supabase
    .from('accompagnantes_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!auxProfile) {
    return { error: 'Profil accompagnante introuvable.' }
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
    return { error: 'Erreur lors de la creation de la conversation.' }
  }

  return { conversationId: conversation.id }
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecte.' }

  if (!content.trim()) {
    return { error: 'Le message ne peut pas etre vide.' }
  }

  // Verifier que l'utilisateur fait partie de la conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id,
      accompagnante_id,
      accompagne_id,
      accompagnantes_profiles:accompagnante_id (user_id),
      accompagnes_profiles:accompagne_id (user_id)
    `)
    .eq('id', conversationId)
    .single()

  if (!conversation) {
    return { error: 'Conversation non trouvee.' }
  }

  const auxProfile = conversation.accompagnantes_profiles as any
  const benProfile = conversation.accompagnes_profiles as any

  if (auxProfile?.user_id !== user.id && benProfile?.user_id !== user.id) {
    return { error: 'Acces non autorise a cette conversation.' }
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

  // Envoyer un email de notification au destinataire (non-bloquant)
  const recipientUserId = auxProfile?.user_id === user.id
    ? benProfile?.user_id
    : auxProfile?.user_id

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
