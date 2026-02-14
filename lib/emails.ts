'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'roxanetnous <onboarding@resend.dev>'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function logNotification(params: {
  userId?: string
  email: string
  type: string
  subject: string
  status: 'sent' | 'error'
  error?: string
}) {
  const supabase = await createClient({ serviceRole: true })
  await supabase.from('notifications_log').insert({
    user_id: params.userId || null,
    email: params.email,
    type: params.type,
    subject: params.subject,
    status: params.status,
    error: params.error || null,
    sent_at: params.status === 'sent' ? new Date().toISOString() : null,
  })
}

export async function sendWelcomeEmail(params: {
  email: string
  firstName: string
  role: 'auxiliaire' | 'beneficiaire'
  userId?: string
}) {
  const dashboardUrl = params.role === 'auxiliaire'
    ? `${BASE_URL}/auxiliaire/dashboard`
    : `${BASE_URL}/beneficiaire/dashboard`

  const roleLabel = params.role === 'auxiliaire' ? 'auxiliaire de vie' : 'beneficiaire'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Bienvenue sur roxanetnous',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue ${params.firstName},</h1>
          <p>Votre compte ${roleLabel} a ete cree avec succes sur roxanetnous.</p>
          ${params.role === 'auxiliaire' ? '<p>Pour apparaitre sur la plateforme, completez votre profil professionnel puis soumettez-le a validation.</p>' : '<p>Vous pouvez des maintenant rechercher un auxiliaire de vie ou publier une annonce.</p>'}
          <p style="margin-top: 24px;">
            <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Acceder a mon espace
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'welcome',
      subject: 'Bienvenue sur roxanetnous',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'welcome',
      subject: 'Bienvenue sur roxanetnous',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendValidationResultEmail(params: {
  email: string
  firstName: string
  decision: 'valide' | 'refuse' | 'a_completer'
  motif?: string
  userId?: string
}) {
  const subjects: Record<string, string> = {
    valide: 'Votre profil a ete valide',
    refuse: 'Votre profil a ete refuse',
    a_completer: 'Informations complementaires demandees',
  }

  const messages: Record<string, string> = {
    valide: 'Votre profil auxiliaire a ete valide par notre equipe. Vous pouvez desormais publier des annonces et etre visible dans les recherches.',
    refuse: `Votre profil auxiliaire a ete refuse.${params.motif ? ` Motif : ${params.motif}` : ''} Vous pouvez mettre a jour votre profil et le soumettre a nouveau.`,
    a_completer: `Des informations complementaires sont necessaires pour valider votre profil.${params.motif ? ` Details : ${params.motif}` : ''} Veuillez mettre a jour votre profil.`,
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: subjects[params.decision],
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">${subjects[params.decision]}</h1>
          <p>Bonjour ${params.firstName},</p>
          <p>${messages[params.decision]}</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/auxiliaire/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir mon profil
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: `validation_${params.decision}`,
      subject: subjects[params.decision],
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: `validation_${params.decision}`,
      subject: subjects[params.decision],
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendNewMessageEmail(params: {
  email: string
  recipientFirstName: string
  senderFirstName: string
  conversationId: string
  userId?: string
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: `Nouveau message de ${params.senderFirstName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Nouveau message</h1>
          <p>Bonjour ${params.recipientFirstName},</p>
          <p>${params.senderFirstName} vous a envoye un message sur roxanetnous.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/messages/${params.conversationId}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Lire le message
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'new_message',
      subject: `Nouveau message de ${params.senderFirstName}`,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'new_message',
      subject: `Nouveau message de ${params.senderFirstName}`,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendSubscriptionConfirmEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement active',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement active</h1>
          <p>Bonjour ${params.firstName},</p>
          <p>Votre abonnement roxanetnous est desormais actif. Vos annonces sont maintenant visibles dans les recherches.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/auxiliaire/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gerer mon abonnement
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_confirm',
      subject: 'Abonnement active',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_confirm',
      subject: 'Abonnement active',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendSubscriptionCancelEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement annule',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement annule</h1>
          <p>Bonjour ${params.firstName},</p>
          <p>Votre abonnement roxanetnous a ete annule. Vos annonces ne seront plus visibles dans les recherches a la fin de la periode en cours.</p>
          <p>Vous pouvez vous reabonner a tout moment.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/auxiliaire/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Se reabonner
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_cancel',
      subject: 'Abonnement annule',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_cancel',
      subject: 'Abonnement annule',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}
