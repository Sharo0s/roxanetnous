'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendValidationResultEmail } from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'

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

  // Envoyer l'email de resultat de validation (non-bloquant)
  void (async () => {
    try {
      const { data: auxProfile } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .select('user_id')
        .eq('id', profileId)
        .single()

      if (!auxProfile) return

      const { data: auxUser } = await supabaseAdmin
        .from('users')
        .select('email, first_name')
        .eq('id', auxProfile.user_id)
        .single()

      if (!auxUser) return

      await sendValidationResultEmail({
        email: auxUser.email,
        firstName: auxUser.first_name || '',
        decision,
        motif,
        userId: auxProfile.user_id,
      })
    } catch {}
  })()

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
