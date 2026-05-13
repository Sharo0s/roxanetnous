'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { sendNewMessageEmail } from '@/lib/emails'
import { hasActiveSubscription } from '@/lib/subscription-helpers'

export type MessageResult = {
  error?: string
  conversationId?: string
}

type ConversationParticipantUserId = { user_id: string } | null

// Story 5.B.1 (AI-3.5 deferred-work) : message d'erreur paywall unifie et
// generique pour empecher l'oracle d'enumeration du role d'un compte cible.
// Avant : 'Abonnement requis pour contacter un accompagnant.' vs '... un beneficiaire.'
// permettait a un attaquant connecte non-abonne de deduire le role d'un userId
// arbitraire en testant getOrCreateConversation* et en lisant le texte d'erreur.
// Apres : message generique unique, identique pour les 3 server actions.
// Garde-fou CI : scripts/check-oracle-paywall.mjs grep ce literal pour
// empecher la re-introduction d'un message differencie par role.
const PAYWALL_GENERIC_ERROR = 'Abonnement requis pour contacter cet utilisateur.'

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

  // Story 5.B.2 : .maybeSingle() distingue clairement 0-row (creation a faire)
  // vs erreur DB transitoire. La contrainte UNIQUE conversations_unique_aux_acc
  // (deja en prod) garantit l'invariant 1 conversation = 1 paire.
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnant_id', accompagnanteProfileId)
    .eq('accompagne_id', benProfile.id)
    .maybeSingle()

  if (existingError) {
    Sentry.captureException(existingError, {
      tags: { flow: 'messaging', signal: 'getOrCreateConversation-existing-error', severity: 'warning' },
    })
    return { error: 'Erreur lors de la vérification de la conversation existante.' }
  }

  if (existing) {
    return { conversationId: existing.id }
  }

  // Story 3.6 : paywall sur ouverture conversation (apres check existence pour preserver idempotence D3)
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    Sentry.captureMessage('paywall-block:getOrCreateConversation', {
      level: 'info',
      tags: { flow: 'messaging', signal: 'oracle-fix', severity: 'warning', security: 'oracle-fix' },
    })
    return { error: PAYWALL_GENERIC_ERROR }
  }

  // Creer la conversation. Race condition possible si 2 appels concurrents :
  // la contrainte UNIQUE rejette le 2eme avec code 23505, on retourne alors la
  // conversation existante (idempotence preservee).
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnant_id: accompagnanteProfileId,
      accompagne_id: benProfile.id,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation : race condition, refetch
    if (error.code === '23505') {
      const { data: refetched } = await supabase
        .from('conversations')
        .select('id')
        .eq('accompagnant_id', accompagnanteProfileId)
        .eq('accompagne_id', benProfile.id)
        .maybeSingle()
      if (refetched) return { conversationId: refetched.id }
    }
    Sentry.captureException(error, {
      tags: { flow: 'messaging', signal: 'getOrCreateConversation-insert-error', severity: 'critical' },
    })
    return { error: 'Erreur lors de la création de la conversation.' }
  }

  if (!conversation) {
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

  if (!userData || userData.role !== 'accompagnant') {
    return { error: 'Seuls les accompagnants peuvent utiliser cette fonction.' }
  }

  const { data: auxProfile } = await supabase
    .from('accompagnants_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!auxProfile) {
    return { error: 'Profil accompagnant introuvable.' }
  }

  // Story 5.B.2 : .maybeSingle() distingue 0-row vs erreur DB.
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('accompagnant_id', auxProfile.id)
    .eq('accompagne_id', accompagneProfileId)
    .maybeSingle()

  if (existingError) {
    Sentry.captureException(existingError, {
      tags: { flow: 'messaging', signal: 'getOrCreateConversationAsAccompagnante-existing-error', severity: 'warning' },
    })
    return { error: 'Erreur lors de la vérification de la conversation existante.' }
  }

  if (existing) {
    return { conversationId: existing.id }
  }

  // Story 3.6 : paywall sur ouverture conversation (apres check existence pour preserver idempotence D3)
  const subscribed = await hasActiveSubscription(user.id)
  if (!subscribed) {
    Sentry.captureMessage('paywall-block:getOrCreateConversationAsAccompagnante', {
      level: 'info',
      tags: { flow: 'messaging', signal: 'oracle-fix', severity: 'warning', security: 'oracle-fix' },
    })
    return { error: PAYWALL_GENERIC_ERROR }
  }

  // Creer la conversation. Race condition handled via UNIQUE constraint (cf. 5.B.2 helper).
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnant_id: auxProfile.id,
      accompagne_id: accompagneProfileId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: refetched } = await supabase
        .from('conversations')
        .select('id')
        .eq('accompagnant_id', auxProfile.id)
        .eq('accompagne_id', accompagneProfileId)
        .maybeSingle()
      if (refetched) return { conversationId: refetched.id }
    }
    Sentry.captureException(error, {
      tags: { flow: 'messaging', signal: 'getOrCreateConversationAsAccompagnante-insert-error', severity: 'critical' },
    })
    return { error: 'Erreur lors de la création de la conversation.' }
  }

  if (!conversation) {
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
    .eq('accompagnant_id', accompagnanteProfileId)
    .eq('admin_id', user.id)
    .is('accompagne_id', null)
    .maybeSingle()

  if (existing) {
    return { conversationId: existing.id }
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      accompagnant_id: accompagnanteProfileId,
      accompagne_id: null,
      admin_id: user.id,
    })
    .select('id')
    .single()

  if (error) {
    // Story 5.B.2 : 23505 sur UNIQUE (accompagnant_id, admin_id) where admin_id IS NOT NULL.
    if (error.code === '23505') {
      const { data: refetched } = await supabase
        .from('conversations')
        .select('id')
        .eq('accompagnant_id', accompagnanteProfileId)
        .eq('admin_id', user.id)
        .is('accompagne_id', null)
        .maybeSingle()
      if (refetched) return { conversationId: refetched.id }
    }
    Sentry.captureException(error, {
      tags: { flow: 'messaging', signal: 'getOrCreateAdminConversation-insert-error', severity: 'critical' },
    })
    return { error: 'Erreur lors de la création de la conversation admin.' }
  }

  if (!conversation) {
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
      accompagnant_id,
      accompagne_id,
      admin_id,
      accompagnants_profiles:accompagnant_id (user_id),
      accompagnes_profiles:accompagne_id (user_id)
    `)
    .eq('id', conversationId)
    .single()

  if (!conversation) {
    return { error: 'Conversation non trouvée.' }
  }

  // Supabase generated types modelisent les relations 1-1 imbriquees comme tableaux.
  const auxProfile = conversation.accompagnants_profiles as unknown as ConversationParticipantUserId
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
