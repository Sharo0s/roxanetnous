'use server'

import * as Sentry from '@sentry/nextjs'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { enqueueEmail } from '@/lib/email-queue'
import { escapeHtml } from '@/lib/escape-html'
import { logNotification } from '@/lib/notifications-log'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'roxanetnous <onboarding@resend.dev>'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
export async function sendWelcomeEmail(params: {
  email: string
  firstName: string
  role: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const dashboardUrl = params.role === 'accompagnant'
    ? `${BASE_URL}/accompagnant/dashboard`
    : `${BASE_URL}/accompagne/dashboard`

  const roleLabel = params.role === 'accompagnant' ? 'accompagnant de vie' : 'accompagné'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Bienvenue sur roxanetnous',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue ${escapeHtml(params.firstName)},</h1>
          <p>Votre compte ${roleLabel} a été créé avec succès sur roxanetnous.</p>
          ${params.role === 'accompagnant' ? '<p>Pour apparaître sur la plateforme, complétez votre profil professionnel puis soumettez-le à validation.</p>' : '<p>Vous pouvez dès maintenant rechercher un accompagnant de vie ou publier une annonce.</p>'}
          <p style="margin-top: 24px;">
            <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Accéder à mon espace
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

// Envoie l'email "Bienvenue" si et seulement s'il n'a jamais été envoyé pour
// cet utilisateur. Idempotent grâce à `notifications_log` : utilisé depuis le
// callback OAuth/confirmation et le login (filet de sécurité au cas où le
// callback échouerait).
export async function sendWelcomeEmailIfFirstTime(params: {
  email: string
  firstName: string
  role: 'accompagnant' | 'accompagne'
  userId: string
}): Promise<{ sent: boolean }> {
  const supabase = await createClient({ serviceRole: true })
  const { data: existing } = await supabase
    .from('notifications_log')
    .select('id')
    .eq('user_id', params.userId)
    .eq('type', 'welcome')
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { sent: false }
  }

  await sendWelcomeEmail(params)
  return { sent: true }
}

export async function sendValidationResultEmail(params: {
  email: string
  firstName: string
  decision: 'valide' | 'refuse' | 'a_completer'
  motif?: string
  userId?: string
}) {
  const subjects: Record<string, string> = {
    valide: 'Votre profil a été validé',
    refuse: 'Votre profil a été refusé',
    a_completer: 'Informations complémentaires demandées',
  }

  const messages: Record<string, string> = {
    valide: 'Votre profil accompagnant a été validé par notre équipe. Vous pouvez désormais publier des annonces et être visible dans les recherches.',
    refuse: `Votre profil accompagnant a été refusé.${params.motif ? ` Motif : ${escapeHtml(params.motif)}` : ''} Vous pouvez mettre à jour votre profil et le soumettre à nouveau.`,
    a_completer: `Des informations complémentaires sont nécessaires pour valider votre profil.${params.motif ? ` Détails : ${escapeHtml(params.motif)}` : ''} Veuillez mettre à jour votre profil.`,
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: subjects[params.decision],
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">${subjects[params.decision]}</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>${messages[params.decision]}</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnant/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
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
      subject: `Nouveau message de ${escapeHtml(params.senderFirstName)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Nouveau message</h1>
          <p>Bonjour ${escapeHtml(params.recipientFirstName)},</p>
          <p>${escapeHtml(params.senderFirstName)} vous a envoyé un message sur roxanetnous.</p>
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
      subject: `Nouveau message de ${escapeHtml(params.senderFirstName)}`,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'new_message',
      subject: `Nouveau message de ${escapeHtml(params.senderFirstName)}`,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendSubscriptionConfirmEmail(params: {
  email: string
  firstName: string
  role?: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const role = params.role || 'accompagnant'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement activé',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement activé</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous est désormais actif. Vos annonces sont maintenant visibles dans les recherches.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gérer mon abonnement
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_confirm',
      subject: 'Abonnement activé',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_confirm',
      subject: 'Abonnement activé',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendSubscriptionCancelEmail(params: {
  email: string
  firstName: string
  role?: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const role = params.role || 'accompagnant'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement annulé',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement annulé</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous a été annulé. Vos annonces ne seront plus visibles dans les recherches à la fin de la période en cours.</p>
          <p>Vous pouvez vous réabonner à tout moment.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Se réabonner
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_cancel',
      subject: 'Abonnement annulé',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'subscription_cancel',
      subject: 'Abonnement annulé',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendDisponibleReactivatedEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Votre profil est de nouveau disponible',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Vous êtes de nouveau disponible</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre date de retour est arrivée, votre profil est automatiquement repassé en disponible sur roxanetnous.</p>
          <p>Si vous souhaitez prolonger votre indisponibilité, vous pouvez le faire depuis votre profil.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnant/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gérer ma disponibilité
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'disponible_reactivated',
      subject: 'Votre profil est de nouveau disponible',
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'disponible_reactivated',
      subject: 'Votre profil est de nouveau disponible',
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendFavoriDisponibleEmail(params: {
  email: string
  accompagneFirstName: string
  accompagnanteFirstName: string
  userId?: string
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: `${escapeHtml(params.accompagnanteFirstName)} est de nouveau disponible`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bonne nouvelle !</h1>
          <p>Bonjour ${escapeHtml(params.accompagneFirstName)},</p>
          <p>${escapeHtml(params.accompagnanteFirstName)}, que vous suivez dans vos favoris, est de nouveau disponible sur roxanetnous.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/recherche" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir le profil
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'favori_disponible',
      subject: `${escapeHtml(params.accompagnanteFirstName)} est de nouveau disponible`,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'favori_disponible',
      subject: `${escapeHtml(params.accompagnanteFirstName)} est de nouveau disponible`,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendMatchingNotificationEmail(params: {
  email: string
  firstName: string
  type: 'nouvelle_annonce_accompagne' | 'nouveau_profil_accompagnant'
  annonceTitle: string
  annonceId: string
  score: number
  userId?: string
}) {
  const isForAccompagnante = params.type === 'nouvelle_annonce_accompagne'
  const subject = isForAccompagnante
    ? 'Une nouvelle annonce correspond à votre profil'
    : 'Un nouvel accompagnant correspond à vos critères'

  const description = isForAccompagnante
    ? "Une nouvelle annonce d'accompagné correspond à votre profil."
    : 'Un nouvel accompagnant de vie correspond aux critères de votre annonce.'

  const linkUrl = isForAccompagnante
    ? `${BASE_URL}/recherche`
    : `${BASE_URL}/recherche`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">${subject}</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>${description}</p>
          <p style="margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px;">
            <strong>${escapeHtml(params.annonceTitle)}</strong><br/>
            <span style="color: #666;">Score de compatibilité : ${params.score}/100</span>
          </p>
          <p style="margin-top: 24px;">
            <a href="${linkUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir le profil
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: `matching_${params.type}`,
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: `matching_${params.type}`,
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendPlanChangeEmail(params: {
  email: string
  firstName: string
  oldPlan: string
  newPlan: string
  role: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const planLabels: Record<string, string> = { mensuel: 'Mensuel', annuel: 'Annuel' }
  const subject = 'Changement de formule confirmé'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Changement de formule confirmé</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous est passé de la formule <strong>${planLabels[params.oldPlan] || params.oldPlan}</strong> à la formule <strong>${planLabels[params.newPlan] || params.newPlan}</strong>.</p>
          <p>Le prorata sera appliqué automatiquement sur votre prochaine facture.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gérer mon abonnement
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'plan_change',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'plan_change',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendRenewalReminderEmail(params: {
  email: string
  firstName: string
  renewalDate: string
  amount: number
  role: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const subject = 'Votre abonnement sera renouvelé prochainement'
  const formattedDate = new Date(params.renewalDate).toLocaleDateString('fr-FR')
  const formattedAmount = params.amount.toFixed(2).replace('.', ',')

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Renouvellement à venir</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous sera renouvelé prochainement, le ${formattedDate}, pour un montant de ${formattedAmount} EUR.</p>
          <p>Si vous souhaitez modifier ou annuler votre abonnement, vous pouvez le faire depuis votre espace.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gérer mon abonnement
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'renewal_reminder',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'renewal_reminder',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendParrainageBienvenueParrain(params: {
  email: string
  firstName: string
  code: string
  userId?: string
}) {
  const subject = 'Votre code de parrainage roxanetnous'
  const dashboardUrl = `${BASE_URL}/accompagnant/dashboard`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Votre profil est validé, ${escapeHtml(params.firstName)}</h1>
          <p>Félicitations, votre profil accompagnant est maintenant validé sur roxanetnous.</p>
          <p>Pour vous remercier de votre engagement, nous vous offrons un programme de parrainage : invitez d'autres accompagnants à rejoindre la plateforme.</p>
          <div style="margin: 24px 0; padding: 24px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Votre code de parrainage</p>
            <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000;">${escapeHtml(params.code)}</p>
          </div>
          <p>Comment ça marche :</p>
          <ul>
            <li>Partagez ce code avec un accompagnant de votre réseau professionnel.</li>
            <li>À son inscription, il s'appuie sur votre garantie : pas de vérification de documents ni de visio, et son profil est activé dès la souscription.</li>
            <li>5 parrainages confirmés vous offrent <strong>6 mois d'abonnement gratuit</strong>.</li>
          </ul>
          <p style="margin-top: 24px;">
            <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Accéder à mon espace
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_bienvenue',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_bienvenue',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

/** @deprecated Epic 8 -- supprimer prochaine release (Epic 9). Voir _bmad-output/implementation-artifacts/deferred-work.md */
export const sendParrainageBienvenueMarraine = sendParrainageBienvenueParrain

// Story 8.A.1 : variante accompagne du mail "bienvenue parrain". Symetrique de
// sendParrainageBienvenueMarraine mais le destinataire est un accompagne dont
// l'abonnement vient de passer en active/trialing (1ere fois). Wording masculin
// neutre obligatoire (regle CLAUDE.md durcie : "parrain"/"filleul",
// jamais "marraine"/"filleule"). CTA vers /accompagne/parrainage (page livree 8.B.1).
export async function sendParrainageBienvenueAccompagne(params: {
  email: string
  firstName: string
  code: string
  userId?: string
}) {
  const subject = 'Votre code de parrainage roxanetnous'
  const parrainageUrl = `${BASE_URL}/accompagne/parrainage`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue dans le programme parrainage${params.firstName ? `, ${escapeHtml(params.firstName)}` : ''}</h1>
          <p>Votre abonnement roxanetnous est actif. Vous pouvez désormais inviter un proche accompagnant à rejoindre la plateforme grâce au parrainage.</p>
          <div style="margin: 24px 0; padding: 24px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Votre code de parrainage</p>
            <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000;">${escapeHtml(params.code)}</p>
          </div>
          <p>Comment ça marche :</p>
          <ul>
            <li>Partagez ce code avec un accompagnant de votre entourage.</li>
            <li>À son inscription, il s'appuie sur votre garantie : pas de vérification de documents ni de visio, son profil est activé dès la souscription.</li>
            <li>5 parrainages confirmés vous offrent <strong>6 mois d'abonnement gratuit</strong>.</li>
          </ul>
          <p style="margin-top: 24px;">
            <a href="${parrainageUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir mon parrainage
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_bienvenue',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_bienvenue',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendParrainageFilleuleConfirmation(params: {
  email: string
  firstName: string
  marraineFirstName: string
  userId?: string
}) {
  const subject = 'Bienvenue sur roxanetnous, votre profil est validé'
  const dashboardUrl = `${BASE_URL}/accompagnant/dashboard`
  const marraineLabel = params.marraineFirstName?.trim()
    ? escapeHtml(params.marraineFirstName)
    : 'votre parrain'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue ${escapeHtml(params.firstName)}</h1>
          <p>Grâce au parrainage de ${marraineLabel}, votre profil accompagnant est validé automatiquement sur roxanetnous.</p>
          <p>Vous pouvez dès maintenant publier vos annonces, répondre aux demandes des accompagnés et gérer votre planning.</p>
          <p style="margin-top: 24px;">
            <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Accéder à mon espace
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_filleule_confirm',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_filleule_confirm',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendParrainageRecompense(params: {
  email: string
  firstName: string
  totalRecompenses: number
  userId?: string
  planType?: 'mensuel' | 'annuel' | null
  // 8.A.3 (F-Epic8-A3) : rôle du parrain pour adapter l'URL de l'abonnement.
  // Optionnel pour rétro-compat (fallback 'accompagnant' = comportement Epic 2).
  role?: 'accompagnant' | 'accompagne'
}) {
  const subject = 'Félicitations, vous avez 6 mois offerts sur roxanetnous'
  // Fallback 'accompagnant' = comportement Epic 2 historique (tous les parrains
  // pré-8.A.3 sont accompagnants). Un role null inattendu déclenche un warning Sentry.
  if (!params.role) {
    Sentry.captureMessage('sendParrainageRecompense appelé sans role', {
      level: 'warning',
      tags: { flow: 'parrainage', signal: 'recompense-email-missing-role' },
      extra: { userId: params.userId },
    })
  }
  const abonnementUrl = `${BASE_URL}/${params.role ?? 'accompagnant'}/abonnement`
  const safeFirstName = params.firstName?.trim() ? escapeHtml(params.firstName) : ''
  const greetingFirstName = safeFirstName ? `, ${safeFirstName}` : ''
  const cumulSentence = params.totalRecompenses > 1
    ? `<p>C'est votre ${params.totalRecompenses}e récompense — merci de continuer à faire grandir la communauté !</p>`
    : ''

  // M12 (code review 2026-04-29) : sur un plan annuel, le coupon
  // duration='repeating' duration_in_months=6 ne s'applique qu'aux
  // 6 prochaines factures mensuelles. Sur un sub annuel (1 invoice / 12 mois),
  // le coupon est partiellement consommé sur la prochaine facture annuelle
  // (6/12 = 50% off au lieu de 6 mois free). On adapte le texte pour ne pas
  // mentir à la marraine.
  const recompenseText = params.planType === 'annuel'
    ? `5 accompagnants que vous avez parrainés sont actifs depuis plus de 30 jours. Comme promis, votre prochaine facturation annuelle bénéficiera d'une réduction équivalente à 6 mois d'abonnement (50 %), automatiquement appliquée sur votre compte.`
    : `5 accompagnants que vous avez parrainés sont actifs depuis plus de 30 jours. Comme promis, vos 6 prochains prélèvements mensuels seront offerts, automatiquement appliqués sur votre compte.`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Félicitations${greetingFirstName}, 6 mois vous sont offerts</h1>
          <p>${recompenseText}</p>
          ${cumulSentence}
          <p style="margin-top: 24px;">
            <a href="${abonnementUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Voir mon abonnement
            </a>
          </p>
          <p style="margin-top: 24px;">Continuez à parrainer pour cumuler de nouvelles récompenses (5 nouveaux parrainages confirmés = 6 mois supplémentaires).</p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_recompense',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_recompense',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

// Story 2.3 AC5 : email admin déclenché à chaque blocage ou flag de suspicion sur
// parrainages. Destinataire : ADMIN_NOTIFICATIONS_EMAIL (variable dédiée et obligatoire).
// M5 (code review 2026-04-28) : pas de fallback sur RESEND_FROM_EMAIL. Mieux
// vaut pas d'alerte qu'une alerte envoyée vers une boîte no-reply non monitorée
// (auto-envoi from=to qui peut aussi déclencher SPF/DMARC).
export async function sendAdminParrainageFlag(params: {
  marraineName: string
  filleuleName: string
  type: 'meme_email' | 'meme_carte' | 'meme_ip' | 'meme_adresse'
  parrainageId: string
}) {
  const adminEmail = process.env.ADMIN_NOTIFICATIONS_EMAIL || null
  if (!adminEmail) {
    // H5 (code review 2026-04-29) : fail-loud. Sans cette variable, toutes
    // les alertes anti-fraude étaient silencieusement perdues (preview/staging).
    // On persiste maintenant la "missed alert" dans admin_actions_log pour
    // qu'elle apparaisse dans l'UI admin (historique) ET on la log explicitement.
    // Story 3.8 : console.warn (config attendue absente sur preview/staging)
    // plutôt que console.error réservé aux pannes Resend / DB. Le garde-fou
    // build (scripts/check-required-env.mjs) signale l'absence en VERCEL_ENV=production.
    console.warn(
      '[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL manquant — alerte parrainage non envoyée par email, voir admin_actions_log.',
      { type: params.type, parrainageId: params.parrainageId },
    )
    Sentry.captureMessage('admin notifications email missing', {
      level: 'warning',
      tags: { flow: 'email', signal: 'admin-email-missing', severity: 'warning' },
      extra: { type: params.type, parrainageId: params.parrainageId },
    })
    try {
      const supabase = await createClient({ serviceRole: true })
      await supabase.from('admin_actions_log').insert({
        admin_id: null,
        action_type: 'parrainage_admin_alert_lost',
        target_type: 'parrainage',
        target_id: params.parrainageId,
        details: {
          reason: 'ADMIN_NOTIFICATIONS_EMAIL non défini',
          flag_type: params.type,
          marraine_name: params.marraineName,
          filleule_name: params.filleuleName,
        },
      })
    } catch (logErr) {
      console.error('[sendAdminParrainageFlag][admin_log_failed]', logErr)
      Sentry.captureException(logErr, {
        tags: { flow: 'email', signal: 'admin-log-failed', severity: 'critical' },
        extra: { type: params.type, parrainageId: params.parrainageId },
      })
    }
    return
  }

  const isBlocage = params.type === 'meme_email' || params.type === 'meme_carte'
  const subjectPrefix = isBlocage ? 'Parrainage bloqué' : 'Parrainage suspect'

  const typeLabels: Record<string, string> = {
    meme_email: 'même email entre parrain et filleul',
    meme_carte: 'même carte de paiement entre parrain et filleul',
    meme_ip: 'même adresse IP que d\'autres filleuls de ce parrain',
    meme_adresse: 'même adresse postale entre parrain et filleul',
  }

  const subject = `${subjectPrefix} - ${typeLabels[params.type] || params.type}`
  const link = `${BASE_URL}/admin/parrainages?vue=bloques&id=${encodeURIComponent(params.parrainageId)}`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">${subjectPrefix}</h1>
          <p>Un parrainage déclenche une alerte de détection automatique sur roxanetnous.</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Parrain :</td>
              <td style="padding: 8px 0; color: #000; font-weight: 600;">${escapeHtml(params.marraineName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Filleul :</td>
              <td style="padding: 8px 0; color: #000; font-weight: 600;">${escapeHtml(params.filleuleName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Raison :</td>
              <td style="padding: 8px 0; color: #000;">${escapeHtml(typeLabels[params.type] || params.type)}</td>
            </tr>
          </table>
          <p style="margin-top: 24px;">
            <a href="${link}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Examiner le parrainage
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            Cet email est envoyé automatiquement par le système de détection anti-fraude parrainage.
          </p>
        </div>
      `,
    })

    await logNotification({
      email: adminEmail,
      type: 'admin_parrainage_flag',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      email: adminEmail,
      type: 'admin_parrainage_flag',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

export async function sendExpirationReminderEmail(params: {
  email: string
  firstName: string
  expirationDate: string
  role: 'accompagnant' | 'accompagne'
  userId?: string
}) {
  const subject = 'Votre abonnement expire bientôt'
  const formattedDate = new Date(params.expirationDate).toLocaleDateString('fr-FR')

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Votre abonnement expire bientôt</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous prend fin le ${formattedDate}. Après cette date, vos annonces ne seront plus visibles dans les recherches et vous n'aurez plus accès à la messagerie.</p>
          <p>Vous pouvez réactiver votre abonnement ou vous réabonner à tout moment.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gérer mon abonnement
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'expiration_reminder',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'expiration_reminder',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

// Relance d'onboarding pour une accompagnant au statut 'a_completer'
// (cron quotidien /api/cron/relance-profils-incomplets). Envoye a J+2 puis
// J+7, jamais plus. Le mail liste dynamiquement les champs vides du profil
// et inclut un lien d'opt-out signe HMAC (cf. lib/optout-token.ts).
export async function sendRelanceOnboardingEmail(params: {
  email: string
  firstName: string
  userId: string
  missingFields: { label: string }[]
  optoutToken: string
  notificationType: 'relance_onboarding_j2' | 'relance_onboarding_j7'
}) {
  const subject =
    params.notificationType === 'relance_onboarding_j2'
      ? 'Finalisez votre profil sur roxanetnous'
      : 'Votre profil roxanetnous est toujours incomplet'

  const optoutUrl = `${BASE_URL}/api/email/optout?type=rappels_onboarding&token=${encodeURIComponent(params.optoutToken)}`
  const dashboardUrl = `${BASE_URL}/accompagnant/onboarding`

  const missingListHtml =
    params.missingFields.length > 0
      ? `<p>Il vous reste a renseigner :</p>
         <ul style="color: #4b5563; line-height: 1.6;">
           ${params.missingFields.map((f) => `<li>${escapeHtml(f.label)}</li>`).join('')}
         </ul>`
      : '<p>Votre profil est presque complet. Quelques etapes vous separent encore de la validation.</p>'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bonjour ${escapeHtml(params.firstName)},</h1>
          <p>Vous vous etes inscrit·e sur roxanetnous comme accompagnant de vie, mais votre profil n'est pas encore finalise. Sans profil complet, vous ne pouvez pas etre soumis·e a validation, ni apparaitre dans les recherches.</p>
          ${missingListHtml}
          <p style="margin-top: 24px;">
            <a href="${dashboardUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Completer mon profil
            </a>
          </p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Vous recevez ce message car vous vous etes inscrite sur roxanetnous. Si vous ne souhaitez plus recevoir ces rappels, <a href="${optoutUrl}" style="color: #9ca3af;">cliquez ici</a>.
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: params.notificationType,
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: params.notificationType,
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}

// Email envoye au visiteur apres inscription pour un departement
// non-ouvert. userId optionnel : visiteur anonyme -> user_id NULL en BDD
// (schema story 4.2).
export async function sendOuvertureConfirmationEmail(params: {
  email: string
  codeDepartement: string
  nomDepartement: string
  userId?: string
}) {
  const subject = `Vous serez notifie(e) a l'ouverture pour ${params.nomDepartement}`
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Merci pour votre inscription</h1>
          <p>Bonjour,</p>
          <p>Nous avons bien enregistré votre demande pour le département <strong>${escapeHtml(params.nomDepartement)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
          <p>Nous vous enverrons un email automatique dès l'ouverture du service dans votre département.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Retour sur roxanetnous
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'ouverture_confirmation',
      subject,
      status: 'sent',
    })
  } catch (error) {
    Sentry.captureException(error, {
      tags: { flow: 'email', signal: 'ouverture-confirm-failed', severity: 'warning' },
      extra: { codeDepartement: params.codeDepartement },
    })
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'ouverture_confirmation',
      subject,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
    // Code review 2026-05-08 P12 : re-throw apres log pour permettre au caller
    // (chemin fallback synchrone enqueueOuvertureConfirmationEmail) de detecter
    // un double incident infra (queue down + Resend down) et alerter Sentry
    // critical signal:queue-fallback-sync-failed.
    throw error
  }
}

// Email envoye a un visiteur inscrit quand son departement est ouvert.
// userId optionnel : visiteur anonyme -> user_id NULL en BDD (schema story 4.2).
export async function sendOuvertureNotificationEmail(params: {
  email: string
  codeDepartement: string
  nomDepartement: string
  userId?: string
}) {
  // Validation defensive : nomDepartement vide / trop long / contenant CRLF
  // ferait planter le subject Resend ou ouvrirait une header injection.
  // Code review patch #13/#14.
  const nom = (params.nomDepartement || '').trim()
  if (!nom || nom.length > 80 || /[\r\n]/.test(nom)) {
    console.error('[notify-ouverture][invalid_nom]', { code: params.codeDepartement, nom: params.nomDepartement })
    Sentry.captureMessage('notify-ouverture invalid nom departement', {
      level: 'error',
      tags: { flow: 'email', signal: 'ouverture-invalid-nom', severity: 'critical' },
      extra: {
        code: params.codeDepartement,
        nom_length: (params.nomDepartement || '').length,
        has_crlf: /[\r\n]/.test(params.nomDepartement || ''),
      },
    })
    return
  }
  const subject = `Le service est ouvert dans ${nom}`
  // BASE_URL peut avoir un trailing slash en preview Vercel : on neutralise.
  // Code review patch #12.
  const baseClean = (BASE_URL || '').replace(/\/+$/, '')
  // P5 : pas de escapeHtml sur ctaUrl dans le href (encodeURIComponent sur le
  // param suffit, & dans les URL est valide en HTML). escapeHtml reste sur
  // le label visible.
  const ctaUrl = `${baseClean}/recherche?code_departement=${encodeURIComponent(params.codeDepartement)}`
  let result: Awaited<ReturnType<typeof resend.emails.send>>
  try {
    // Resend peut resoudre avec { error } sans throw (rate-limit, recipient
    // invalide). Code review patch #1 : on verifie explicitement.
    result = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bonne nouvelle</h1>
          <p>Bonjour,</p>
          <p>Le service roxanetnous est désormais ouvert dans le département <strong>${escapeHtml(nom)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
          <p>Vous pouvez dès maintenant explorer les profils disponibles dans votre zone.</p>
          <p style="margin-top: 24px;">
            <a href="${ctaUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Découvrir roxanetnous dans ${escapeHtml(nom)}
            </a>
          </p>
        </div>
      `,
    })
  } catch (error) {
    // SDK throw (timeout reseau, abort). Log + re-throw pour P12.
    Sentry.captureException(error, {
      tags: { flow: 'email', signal: 'ouverture-notif-failed', severity: 'warning' },
      extra: { code: params.codeDepartement },
    })
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'ouverture_notification',
      subject,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
    throw error
  }

  const resendError = result.error
  if (resendError) {
    console.error('[notify-ouverture][resend_error]', { code: params.codeDepartement, email: params.email, error: resendError })
    const errorObject = resendError instanceof Error
      ? resendError
      : new Error(typeof resendError === 'string' ? resendError : JSON.stringify(resendError))
    Sentry.captureException(errorObject, {
      tags: { flow: 'email', signal: 'ouverture-resend-error', severity: 'warning' },
      extra: { code: params.codeDepartement, userId: params.userId ?? null },
    })
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'ouverture_notification',
      subject,
      status: 'failed',
      error: typeof resendError === 'string' ? resendError : JSON.stringify(resendError),
    })
    // P12 : re-throw au lieu de return silencieux pour permettre au caller
    // fallback (enqueueOuvertureNotificationEmail) d'alerter Sentry
    // critical signal:queue-fallback-sync-failed.
    throw errorObject
  }

  await logNotification({
    userId: params.userId,
    email: params.email,
    type: 'ouverture_notification',
    subject,
    status: 'sent',
  })
}

// Story 4.3 : variantes asynchrones via la queue durable Vercel Workflow
// DevKit. Les call-sites prioritaires (submitNotificationOuverture, toggleDepartement,
// toggleRegion, cron retry) basculent sur ces fonctions pour return immediat
// (~50-100 ms) et beneficier des 3 retries automatiques + backoff exponentiel
// du runtime. En cas de queue down (incident plateforme), un fallback
// synchrone est emprunte (AC8) — l'email passe alors par sendOuverture*Email
// classique au prix de la latence Resend mais sans perte d'envoi.

export async function enqueueOuvertureConfirmationEmail(params: {
  email: string
  codeDepartement: string
  nomDepartement: string
  userId?: string
}) {
  try {
    await enqueueEmail({
      template: 'ouverture_confirmation',
      to: params.email,
      userId: params.userId,
      variables: {
        codeDepartement: params.codeDepartement,
        nomDepartement: params.nomDepartement,
      },
    })
  } catch (queueError) {
    // Fallback synchrone (AC8) : un envoi confirmation perdu =
    // mauvaise UX (utilisateur sans email apres inscription). Mieux vaut
    // bloquer la server action 500 ms supplementaires sur Resend que perdre
    // l'email. Sentry alerte l'incident queue (warning).
    Sentry.captureException(queueError, {
      tags: { flow: 'email', signal: 'queue-fallback-sync', severity: 'warning' },
      extra: { template: 'ouverture_confirmation', codeDepartement: params.codeDepartement },
    })
    // P12 : double-try pour detecter un double incident infra (queue down +
    // Resend down). sendOuvertureConfirmationEmail re-throw apres log -> on
    // alerte Sentry critical et propage au caller.
    try {
      await sendOuvertureConfirmationEmail(params)
    } catch (fallbackError) {
      Sentry.captureException(fallbackError, {
        tags: { flow: 'email', signal: 'queue-fallback-sync-failed', severity: 'critical' },
        extra: { template: 'ouverture_confirmation', codeDepartement: params.codeDepartement },
      })
      throw fallbackError
    }
  }
}

export async function enqueueOuvertureNotificationEmail(params: {
  email: string
  codeDepartement: string
  nomDepartement: string
  userId?: string
}) {
  try {
    await enqueueEmail({
      template: 'ouverture_notification',
      to: params.email,
      userId: params.userId,
      variables: {
        codeDepartement: params.codeDepartement,
        nomDepartement: params.nomDepartement,
      },
    })
  } catch (queueError) {
    Sentry.captureException(queueError, {
      tags: { flow: 'email', signal: 'queue-fallback-sync', severity: 'warning' },
      extra: { template: 'ouverture_notification', codeDepartement: params.codeDepartement },
    })
    // P12 : double-try, cf. enqueueOuvertureConfirmationEmail.
    try {
      await sendOuvertureNotificationEmail(params)
    } catch (fallbackError) {
      Sentry.captureException(fallbackError, {
        tags: { flow: 'email', signal: 'queue-fallback-sync-failed', severity: 'critical' },
        extra: { template: 'ouverture_notification', codeDepartement: params.codeDepartement },
      })
      throw fallbackError
    }
  }
}

export async function sendParrainageVerificationEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  const subject = 'Vérification supplémentaire requise pour votre inscription'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Vérification supplémentaire requise</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre paiement a bien été reçu et votre abonnement est actif.</p>
          <p>
            En revanche, notre système a relevé un signal qui nécessite une
            vérification manuelle avant que votre profil soit publié sur la
            plateforme. Un administrateur examinera votre dossier sous 48h
            ouvrées.
          </p>
          <p>
            Si vous pensez qu'il s'agit d'une erreur, ou si vous partagez
            votre moyen de paiement avec votre parrain, contactez-nous :
            <a href="mailto:roxanetnous@outlook.com">roxanetnous@outlook.com</a>.
          </p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnant/dashboard" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Accéder à mon espace
            </a>
          </p>
        </div>
      `,
    })

    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_verification',
      subject,
      status: 'sent',
    })
  } catch (error) {
    await logNotification({
      userId: params.userId,
      email: params.email,
      type: 'parrainage_verification',
      subject,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })
  }
}
