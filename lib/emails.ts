'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'roxanetnous <onboarding@resend.dev>'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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
  role: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const dashboardUrl = params.role === 'accompagnante'
    ? `${BASE_URL}/accompagnante/dashboard`
    : `${BASE_URL}/accompagne/dashboard`

  const roleLabel = params.role === 'accompagnante' ? 'accompagnante de vie' : 'accompagne'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Bienvenue sur roxanetnous',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue ${escapeHtml(params.firstName)},</h1>
          <p>Votre compte ${roleLabel} a ete cree avec succes sur roxanetnous.</p>
          ${params.role === 'accompagnante' ? '<p>Pour apparaitre sur la plateforme, completez votre profil professionnel puis soumettez-le a validation.</p>' : '<p>Vous pouvez des maintenant rechercher une accompagnante de vie ou publier une annonce.</p>'}
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
    valide: 'Votre profil accompagnante a ete valide par notre equipe. Vous pouvez desormais publier des annonces et etre visible dans les recherches.',
    refuse: `Votre profil accompagnante a ete refuse.${params.motif ? ` Motif : ${params.motif}` : ''} Vous pouvez mettre a jour votre profil et le soumettre a nouveau.`,
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
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>${messages[params.decision]}</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnante/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
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
          <p>${escapeHtml(params.senderFirstName)} vous a envoye un message sur roxanetnous.</p>
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
  role?: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const role = params.role || 'accompagnante'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement active',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement active</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous est desormais actif. Vos annonces sont maintenant visibles dans les recherches.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
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
  role?: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const role = params.role || 'accompagnante'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Abonnement annule',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Abonnement annule</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous a ete annule. Vos annonces ne seront plus visibles dans les recherches a la fin de la periode en cours.</p>
          <p>Vous pouvez vous reabonner a tout moment.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
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
          <h1 style="color: #000;">Vous etes de nouveau disponible</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre date de retour est arrivee, votre profil est automatiquement repasse en disponible sur roxanetnous.</p>
          <p>Si vous souhaitez prolonger votre indisponibilite, vous pouvez le faire depuis votre profil.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnante/profil" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gerer ma disponibilite
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
  type: 'nouvelle_annonce_accompagne' | 'nouveau_profil_accompagnante'
  annonceTitle: string
  annonceId: string
  score: number
  userId?: string
}) {
  const isForAccompagnante = params.type === 'nouvelle_annonce_accompagne'
  const subject = isForAccompagnante
    ? 'Une nouvelle annonce correspond a votre profil'
    : 'Un nouvel accompagnante correspond a vos criteres'

  const description = isForAccompagnante
    ? 'Une nouvelle annonce accompagne correspond a votre profil.'
    : 'Un nouvel accompagnante de vie correspond aux criteres de votre annonce.'

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
            <span style="color: #666;">Score de compatibilite : ${params.score}/100</span>
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
  role: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const planLabels: Record<string, string> = { mensuel: 'Mensuel', annuel: 'Annuel' }
  const subject = 'Changement de formule confirme'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Changement de formule confirme</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous est passe de la formule <strong>${planLabels[params.oldPlan] || params.oldPlan}</strong> a la formule <strong>${planLabels[params.newPlan] || params.newPlan}</strong>.</p>
          <p>Le prorata sera applique automatiquement sur votre prochaine facture.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gerer mon abonnement
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
  role: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const subject = 'Votre abonnement sera renouvele prochainement'
  const formattedDate = new Date(params.renewalDate).toLocaleDateString('fr-FR')
  const formattedAmount = params.amount.toFixed(2).replace('.', ',')

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Renouvellement a venir</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous sera renouvele prochainement, le ${formattedDate}, pour un montant de ${formattedAmount} EUR.</p>
          <p>Si vous souhaitez modifier ou annuler votre abonnement, vous pouvez le faire depuis votre espace.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gerer mon abonnement
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

export async function sendParrainageBienvenueMarraine(params: {
  email: string
  firstName: string
  code: string
  userId?: string
}) {
  const subject = 'Votre code de parrainage roxanetnous'
  const dashboardUrl = `${BASE_URL}/accompagnante/dashboard`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Votre profil est validé, ${escapeHtml(params.firstName)}</h1>
          <p>Félicitations, votre profil accompagnante est maintenant validé sur roxanetnous.</p>
          <p>Pour vous remercier de votre engagement, nous vous offrons un programme de parrainage : invitez d'autres accompagnantes à rejoindre la plateforme.</p>
          <div style="margin: 24px 0; padding: 24px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Votre code de parrainage</p>
            <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000;">${escapeHtml(params.code)}</p>
          </div>
          <p>Comment ça marche :</p>
          <ul>
            <li>Partagez ce code avec une accompagnante de votre réseau professionnel.</li>
            <li>À son inscription, elle s'appuie sur votre garantie : pas de vérification de documents ni de visio, et son profil est activé dès la souscription.</li>
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

export async function sendParrainageFilleuleConfirmation(params: {
  email: string
  firstName: string
  marraineFirstName: string
  userId?: string
}) {
  const subject = 'Bienvenue sur roxanetnous, votre profil est validé'
  const dashboardUrl = `${BASE_URL}/accompagnante/dashboard`
  const marraineLabel = params.marraineFirstName?.trim()
    ? escapeHtml(params.marraineFirstName)
    : 'votre marraine'

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bienvenue ${escapeHtml(params.firstName)}</h1>
          <p>Grâce au parrainage de ${marraineLabel}, votre profil accompagnante est validé automatiquement sur roxanetnous.</p>
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
}) {
  const subject = 'Félicitations, vous avez 6 mois offerts sur roxanetnous'
  const abonnementUrl = `${BASE_URL}/accompagnante/abonnement`
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
    ? `5 accompagnantes que vous avez parrainées sont actives depuis plus de 30 jours. Comme promis, votre prochaine facturation annuelle bénéficiera d'une réduction équivalente à 6 mois d'abonnement (50 %), automatiquement appliquée sur votre compte.`
    : `5 accompagnantes que vous avez parrainées sont actives depuis plus de 30 jours. Comme promis, vos 6 prochains prélèvements mensuels seront offerts, automatiquement appliqués sur votre compte.`

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
    console.error(
      '[sendAdminParrainageFlag] ADMIN_NOTIFICATIONS_EMAIL non défini : alerte anti-fraude perdue.',
      { type: params.type, parrainageId: params.parrainageId },
    )
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
    }
    return
  }

  const isBlocage = params.type === 'meme_email' || params.type === 'meme_carte'
  const subjectPrefix = isBlocage ? 'Parrainage bloqué' : 'Parrainage suspect'

  const typeLabels: Record<string, string> = {
    meme_email: 'même email entre marraine et filleule',
    meme_carte: 'même carte de paiement entre marraine et filleule',
    meme_ip: 'même adresse IP que d\'autres filleules de cette marraine',
    meme_adresse: 'même adresse postale entre marraine et filleule',
  }

  const subject = `${subjectPrefix} - ${typeLabels[params.type] || params.type}`
  const link = `${BASE_URL}/admin/parrainages/blacklist?id=${encodeURIComponent(params.parrainageId)}`

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
              <td style="padding: 8px 16px 8px 0; color: #666;">Marraine :</td>
              <td style="padding: 8px 0; color: #000; font-weight: 600;">${escapeHtml(params.marraineName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 16px 8px 0; color: #666;">Filleule :</td>
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
  role: 'accompagnante' | 'accompagne'
  userId?: string
}) {
  const subject = 'Votre abonnement expire bientot'
  const formattedDate = new Date(params.expirationDate).toLocaleDateString('fr-FR')

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Votre abonnement expire bientot</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre abonnement roxanetnous prend fin le ${formattedDate}. Apres cette date, vos annonces ne seront plus visibles dans les recherches et vous n'aurez plus acces a la messagerie.</p>
          <p>Vous pouvez reactiver votre abonnement ou vous reabonner a tout moment.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/${params.role}/abonnement" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Gerer mon abonnement
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

// Email envoye a la filleule quand son parrainage a ete bloque par
// la detection anti-fraude au moment du paiement. Volontairement
// generique : ne revele pas la regle violee (meme_carte, meme_email,
// etc.) pour ne pas aider un fraudeur a contourner le systeme.
export async function sendParrainageVerificationEmail(params: {
  email: string
  firstName: string
  userId?: string
}) {
  const subject = 'Verification supplementaire requise pour votre inscription'
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Verification supplementaire requise</h1>
          <p>Bonjour ${escapeHtml(params.firstName)},</p>
          <p>Votre paiement a bien ete recu et votre abonnement est actif.</p>
          <p>
            En revanche, notre systeme a releve un signal qui necessite une
            verification manuelle avant que votre profil soit publie sur la
            plateforme. Un administrateur examinera votre dossier sous 48h
            ouvrees.
          </p>
          <p>
            Si vous pensez qu'il s'agit d'une erreur, ou si vous partagez
            votre moyen de paiement avec votre marraine, contactez-nous :
            <a href="mailto:roxanetnous@outlook.com">roxanetnous@outlook.com</a>.
          </p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}/accompagnante/dashboard" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Acceder a mon espace
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
