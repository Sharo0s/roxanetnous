'use server'

import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  sendValidationResultEmail,
  sendNewMessageEmail,
  sendParrainageBienvenueMarraine,
} from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { generateCodeForUserSystem } from '@/lib/parrainage-codes'

const VISIO_INVITATION_MESSAGE = `Bonjour,

Votre dossier a été revu. Pour finaliser votre inscription, je souhaite vous rencontrer lors d'un court échange en visio (15-20 minutes).

Pouvez-vous me proposer deux ou trois créneaux qui vous conviennent dans les prochains jours ? Je vous enverrai un lien visio en retour.

À très bientôt,
L'équipe roxanetnous`

export type ValidationResult = {
  error?: string
  success?: boolean
}

export async function validateAccompagnante(
  profileId: string,
  decision: 'valide' | 'refuse' | 'a_completer',
  motif?: string
): Promise<ValidationResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  // Verifier que l'utilisateur est admin
  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès non autorisé.' }
  }

  // Verifier que le motif est fourni pour refus ou a_completer
  if ((decision === 'refuse' || decision === 'a_completer') && !motif) {
    return { error: 'Le motif est requis pour un refus ou une demande de complément.' }
  }

  // FR11ter : la validation finale n'est autorisée qu'à partir d'un statut
  // qui justifie une validation manuelle. P5 (code review 2026-04-28) :
  // élargi à 'refuse' et 'a_completer' pour permettre la re-validation
  // post-fraude ou après complément de dossier sans recréer une visio.
  if (decision === 'valide') {
    const { data: current } = await supabase
      .from('accompagnantes_profiles')
      .select('validation_status')
      .eq('id', profileId)
      .single()
    const allowedFromStatuses = ['visio_realisee', 'refuse', 'a_completer']
    if (!current || !allowedFromStatuses.includes(current.validation_status)) {
      return {
        error:
          'La validation finale n\'est autorisée que depuis les statuts visio réalisée, refusée ou à compléter.',
      }
    }
  }

  // Mettre a jour le profil
  const updateData: Record<string, unknown> = {
    validation_status: decision,
    validation_date: new Date().toISOString(),
    validated_by: user.id,
  }

  if (motif) {
    updateData.refus_motif = motif
  }

  const { error: updateError } = await supabase
    .from('accompagnantes_profiles')
    .update(updateData)
    .eq('id', profileId)

  if (updateError) {
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }

  // Logger l'action admin
  const supabaseAdmin = await createClient({ serviceRole: true })

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: decision,
    target_type: 'accompagnante',
    target_id: profileId,
    details: { motif: motif || null, decision },
  })

  // Email de résultat de validation : exécuté post-réponse via after() pour
  // garantir l'achèvement même après redirect() sur Vercel serverless.
  after(async () => {
    try {
      const { data: auxProfile } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .select('user_id')
        .eq('id', profileId)
        .maybeSingle()

      if (!auxProfile) return

      const { data: auxUser } = await supabaseAdmin
        .from('users')
        .select('email, first_name')
        .eq('id', auxProfile.user_id)
        .maybeSingle()

      if (!auxUser?.email) {
        console.error('[validateAccompagnante][missing_email]', { user_id: auxProfile.user_id })
        return
      }

      await sendValidationResultEmail({
        email: auxUser.email,
        firstName: auxUser.first_name || '',
        decision,
        motif,
        userId: auxProfile.user_id,
      })
    } catch (e) {
      console.error('[validateAccompagnante][email_error]', e)
    }
  })

  // FR11quinquies — à la validation finale, générer le code de parrainage
  // de la nouvelle marraine et lui envoyer l'email de bienvenue.
  // Découplé de l'envoi précédent : un échec d'email de validation ne doit pas
  // empêcher la génération du code, et inversement.
  if (decision === 'valide') {
    after(async () => {
      try {
        const { data: auxProfile } = await supabaseAdmin
          .from('accompagnantes_profiles')
          .select('user_id')
          .eq('id', profileId)
          .maybeSingle()
        if (!auxProfile) return

        const { data: auxUser } = await supabaseAdmin
          .from('users')
          .select('email, first_name')
          .eq('id', auxProfile.user_id)
          .maybeSingle()
        if (!auxUser?.email) {
          console.error('[validateAccompagnante][parrainage_code][missing_email]', { user_id: auxProfile.user_id })
          return
        }

        const codeResult = await generateCodeForUserSystem(auxProfile.user_id)
        if (!('code' in codeResult)) {
          console.error('[validateAccompagnante][parrainage_code][generate_failed]', codeResult.error, 'user_id=', auxProfile.user_id)
          return
        }

        await sendParrainageBienvenueMarraine({
          email: auxUser.email,
          firstName: auxUser.first_name || '',
          code: codeResult.code,
          userId: auxProfile.user_id,
        })
      } catch (e) {
        console.error('[validateAccompagnante][parrainage_code]', e)
      }
    })
  }

  redirect('/admin')
}

export async function markVisioToPlan(profileId: string): Promise<ValidationResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès non autorisé.' }
  }

  const { data: current } = await supabase
    .from('accompagnantes_profiles')
    .select('validation_status, user_id')
    .eq('id', profileId)
    .single()

  if (!current) return { error: 'Profil introuvable.' }
  if (current.validation_status !== 'en_attente') {
    return { error: 'Transition impossible depuis le statut actuel.' }
  }

  const { error: updateError } = await supabase
    .from('accompagnantes_profiles')
    .update({ validation_status: 'visio_a_planifier' })
    .eq('id', profileId)

  if (updateError) {
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'visio_planifiee',
    target_type: 'accompagnante',
    target_id: profileId,
    details: { planifie_le: new Date().toISOString() },
  })

  // Création/récupération de la conversation admin <-> accompagnante et envoi
  // du message de convocation visio. Exécuté post-réponse via after().
  after(async () => {
    try {
      let { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('accompagnante_id', profileId)
        .eq('admin_id', user.id)
        .is('accompagne_id', null)
        .maybeSingle()

      if (!conv) {
        const { data: newConv } = await supabaseAdmin
          .from('conversations')
          .insert({
            accompagnante_id: profileId,
            accompagne_id: null,
            admin_id: user.id,
          })
          .select('id')
          .single()
        conv = newConv
      }

      if (!conv) return

      await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conv.id,
          sender_id: user.id,
          content: VISIO_INVITATION_MESSAGE,
        })

      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conv.id)

      // Notification email de type "nouveau message" au destinataire
      const { data: auxUser } = await supabaseAdmin
        .from('users')
        .select('email, first_name')
        .eq('id', current.user_id)
        .maybeSingle()

      const { data: adminData } = await supabaseAdmin
        .from('users')
        .select('first_name')
        .eq('id', user.id)
        .maybeSingle()

      if (auxUser?.email) {
        await sendNewMessageEmail({
          email: auxUser.email,
          recipientFirstName: auxUser.first_name || '',
          senderFirstName: adminData?.first_name || 'L\'équipe',
          conversationId: conv.id,
          userId: current.user_id,
        })
      }
    } catch (e) {
      console.error('[markVisioToPlan][message_error]', e)
    }
  })

  redirect('/admin')
}

export async function markVisioRealisee(
  profileId: string,
  visioDate: string,
  notes?: string
): Promise<ValidationResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté.' }

  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès non autorisé.' }
  }

  if (!visioDate) {
    return { error: 'La date de la visio est requise.' }
  }

  const { data: current } = await supabase
    .from('accompagnantes_profiles')
    .select('validation_status')
    .eq('id', profileId)
    .single()

  if (!current) return { error: 'Profil introuvable.' }
  if (current.validation_status !== 'visio_a_planifier') {
    return { error: 'Transition impossible depuis le statut actuel.' }
  }

  const updateData: Record<string, unknown> = {
    validation_status: 'visio_realisee',
    visio_date: new Date(visioDate).toISOString(),
  }
  if (notes && notes.trim()) {
    updateData.visio_notes = notes.trim()
  }

  const { error: updateError } = await supabase
    .from('accompagnantes_profiles')
    .update(updateData)
    .eq('id', profileId)

  if (updateError) {
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }

  const supabaseAdmin = await createClient({ serviceRole: true })

  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: user.id,
    action_type: 'visio_realisee',
    target_type: 'accompagnante',
    target_id: profileId,
    details: { visio_date: new Date(visioDate).toISOString(), notes: notes?.trim() || null },
  })

  redirect('/admin')
}

export async function adminDeleteUser(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Verifier que l'appelant est admin
  const { data: adminData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', adminUser.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès refusé.' }
  }

  // Verifier que l'utilisateur cible existe et n'est pas admin
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!targetUser) {
    return { error: 'Utilisateur introuvable.' }
  }

  if (targetUser.role === 'admin') {
    return { error: 'Impossible de supprimer un administrateur.' }
  }

  try {
    // 1. Annuler l'abonnement Stripe
    try {
      const subStatus = await getSubscriptionStatus(userId)
      if (subStatus.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(subStatus.stripeSubscriptionId).catch(() => {})
      }
      if (subStatus.stripeCustomerId) {
        await stripe.customers.del(subStatus.stripeCustomerId).catch(() => {})
      }
    } catch {
      // Stripe errors should not block deletion
    }

    // 2. Supprimer les fichiers Storage
    try {
      const { data: profile } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .select('justificatif_identite_url, justificatif_permis_url, justificatif_cv_url, justificatifs_diplomes')
        .eq('user_id', userId)
        .single()

      if (profile) {
        const filesToDelete: string[] = []
        if (profile.justificatif_identite_url) filesToDelete.push(profile.justificatif_identite_url)
        if (profile.justificatif_permis_url) filesToDelete.push(profile.justificatif_permis_url)
        if (profile.justificatif_cv_url) filesToDelete.push(profile.justificatif_cv_url)
        if (profile.justificatifs_diplomes) {
          for (const path of Object.values(profile.justificatifs_diplomes as Record<string, string>)) {
            if (path) filesToDelete.push(path)
          }
        }
        if (filesToDelete.length > 0) {
          await supabaseAdmin.storage.from('justificatifs').remove(filesToDelete)
        }
      }
    } catch {
      // Storage errors should not block deletion
    }

    // 3. Supprimer de public.users (CASCADE gere les profils, subscriptions, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      return { error: 'Erreur lors de la suppression : ' + deleteError.message }
    }

    // 4. Supprimer de auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return { error: 'Erreur lors de la suppression de l\'authentification.' }
    }

    // 5. Logger l'action
    await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: adminUser.id,
      action_type: 'suppression_utilisateur',
      target_type: targetUser.role,
      target_id: userId,
      details: { deleted_at: new Date().toISOString() },
    })
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e
    console.error('adminDeleteUser error:', e)
    return { error: 'Erreur inattendue lors de la suppression.' }
  }

  redirect('/admin/utilisateurs')
}

export async function adminGrantSubscription(
  userId: string,
  planType: 'mensuel' | 'annuel'
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) return { error: 'Non connecté.' }

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Verifier que l'appelant est admin
  const { data: adminData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', adminUser.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès refusé.' }
  }

  // Charger l'utilisateur cible
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role')
    .eq('id', userId)
    .single()

  if (!targetUser) return { error: 'Utilisateur introuvable.' }

  const role = targetUser.role as 'accompagnante' | 'accompagne'
  if (role !== 'accompagnante' && role !== 'accompagne') {
    return { error: 'Rôle non éligible à un abonnement.' }
  }

  // Verifier s'il a deja un abonnement actif
  const existingSub = await getSubscriptionStatus(userId)
  if (existingSub.active) {
    return { error: 'Cet utilisateur a déjà un abonnement actif.' }
  }

  const priceId = (await import('@/lib/stripe')).getStripePriceId(role, planType)
  if (!priceId) return { error: 'Prix introuvable pour ce plan.' }

  try {
    // Creer ou recuperer le client Stripe
    let customerId = existingSub.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: targetUser.email,
        name: `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim() || undefined,
        metadata: { user_id: userId, role },
      })
      customerId = customer.id
    }

    // Creer un coupon 100% pour abonnement offert par admin
    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'forever',
      name: `Offert par admin - ${targetUser.email}`,
    })

    // Creer l'abonnement Stripe avec coupon 100%
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      discounts: [{ coupon: coupon.id }],
      metadata: { user_id: userId, role, plan: planType, granted_by_admin: adminUser.id },
    })

    const item = subscription.items.data[0]
    const currentPeriodStart = item ? new Date(item.current_period_start * 1000).toISOString() : null
    const currentPeriodEnd = item ? new Date(item.current_period_end * 1000).toISOString() : null

    // Upsert dans Supabase (meme logique que le webhook)
    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: 'active',
        plan_type: planType,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        first_subscription_date: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    // Logger l'action admin
    await supabaseAdmin.from('admin_actions_log').insert({
      admin_id: adminUser.id,
      action_type: 'grant_subscription',
      target_type: 'subscription',
      target_id: userId,
      details: { plan_type: planType, stripe_subscription_id: subscription.id },
    })

    return { success: true }
  } catch (e) {
    console.error('adminGrantSubscription error:', e)
    return { error: 'Erreur lors de la création de l\'abonnement.' }
  }
}

export async function adminCancelSubscription(formData: FormData): Promise<{ error?: string }> {
  const userId = formData.get('userId') as string
  if (!userId) return { error: 'userId manquant.' }

  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // Verifier que l'appelant est admin
  const { data: adminData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', adminUser.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Accès refusé.' }
  }

  const subStatus = await getSubscriptionStatus(userId)
  if (!subStatus.stripeSubscriptionId) {
    return { error: 'Aucun abonnement actif.' }
  }

  try {
    await stripe.subscriptions.update(subStatus.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  } catch {
    return { error: 'Erreur lors de l\'annulation via Stripe.' }
  }

  // Logger l'action
  await supabaseAdmin.from('admin_actions_log').insert({
    admin_id: adminUser.id,
    action_type: 'annulation_abonnement',
    target_type: 'subscription',
    target_id: userId,
    details: { cancelled_at: new Date().toISOString() },
  })

  redirect(`/admin/utilisateurs/${userId}`)
}
