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
  if (!user) return { error: 'Non connecte.' }

  // Verifier que l'utilisateur est admin
  const { data: adminData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminData || adminData.role !== 'admin') {
    return { error: 'Acces non autorise.' }
  }

  // Verifier que le motif est fourni pour refus ou a_completer
  if ((decision === 'refuse' || decision === 'a_completer') && !motif) {
    return { error: 'Le motif est requis pour un refus ou une demande de complement.' }
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
    return { error: 'Erreur lors de la mise a jour du profil.' }
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
    return { error: 'Acces refuse.' }
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
