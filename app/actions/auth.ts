'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { sendWelcomeEmailIfFirstTime } from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { createParrainageRelation } from '@/app/actions/parrainage'
import { getClientIp } from '@/lib/get-client-ip'

export type AuthResult = {
  error?: string
  errorCode?: 'email_not_confirmed'
  success?: boolean
}

const SIGNUP_ALLOWED_ROLES = ['accompagnante', 'accompagne'] as const
type SignupRole = (typeof SIGNUP_ALLOWED_ROLES)[number]

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const rawRole = formData.get('role')

  if (!email || !password || !firstName || !lastName || !rawRole) {
    return { error: 'Tous les champs sont requis.' }
  }

  // Validation runtime du rôle : interdit toute valeur hors whitelist
  // (notamment 'admin'), sinon le trigger BDD inserterait role='admin'.
  if (typeof rawRole !== 'string' || !SIGNUP_ALLOWED_ROLES.includes(rawRole as SignupRole)) {
    return { error: 'Rôle invalide.' }
  }
  const role = rawRole as SignupRole

  if (password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role,
      },
    },
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'Cette adresse email est déjà utilisée.' }
    }
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Erreur lors de la création du compte.' }
  }

  // Le trigger handle_new_user insère automatiquement dans public.users
  // On vérifie simplement que la ligne existe
  const supabaseAdmin = await createClient({ serviceRole: true })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', authData.user.id)
    .single()

  if (!userRow) {
    // Le trigger n'a pas fonctionné, on insère manuellement
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        role,
        first_name: firstName,
        last_name: lastName,
      })

    if (userError) {
      console.error('Erreur insertion public.users:', userError.message, userError.code, userError.details)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { error: 'Erreur lors de la création du profil. Veuillez réessayer.' }
    }
  }

  // Parrainage (accompagnante uniquement) : si un code valide est fourni,
  // créer la relation marraine/filleule. Silencieux côté UX (l'inscription
  // réussit même si le code ne convient pas), mais logué côté serveur pour
  // ne pas perdre le signal opérationnel en cas d'échec.
  if (role === 'accompagnante') {
    const parrainageCode = (formData.get('parrainage_code') as string | null)?.trim() || ''
    if (parrainageCode) {
      try {
        const h = await headers()
        const ip = getClientIp(h)
        const result = await createParrainageRelation({
          code: parrainageCode,
          filleuleId: authData.user.id,
          ipInscription: ip,
          filleuleEmail: email,
        })
        if (!result.ok) {
          console.error(
            'createParrainageRelation a échoué pendant signup:',
            result.reason,
            'filleuleId=',
            authData.user.id
          )
        }
      } catch (e) {
        console.error('Exception createParrainageRelation pendant signup:', e)
      }
    }
  }

  // Le mail de bienvenue n'est PAS envoyé ici : Supabase envoie son mail de
  // confirmation, et notre welcome part seulement après que l'utilisateur ait
  // cliqué sur le lien (cf. app/auth/callback/route.ts). Évite l'UX où le
  // welcome arrive avant que le compte soit utilisable.

  return { success: true }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  const supabase = await createClient({ serviceRole: true })
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
  return (count ?? 0) > 0
}

export async function login(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email et mot de passe requis.' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Email ou mot de passe incorrect.' }
    }
    // Supabase renvoie "Email not confirmed" tant que email_confirmed_at est
    // NULL. On expose un code structuré pour permettre au form de proposer
    // un renvoi du lien de confirmation.
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Votre adresse email n\'est pas encore confirmée. Vérifiez votre boîte mail (et vos spams) ou demandez un nouveau lien.',
        errorCode: 'email_not_confirmed',
      }
    }
    return { error: error.message }
  }

  // Récupérer le rôle pour rediriger
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Erreur de connexion.' }
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, first_name')
    .eq('id', user.id)
    .single()

  const role = userData?.role

  // Filet de sécurité : si l'utilisateur arrive ici sans être passé par
  // /auth/callback (ex: callback en erreur, lien expiré rejoué, login manuel
  // après resend), on envoie le welcome maintenant. Idempotent.
  if ((role === 'accompagnante' || role === 'accompagne') && user.email && userData?.first_name) {
    sendWelcomeEmailIfFirstTime({
      email: user.email,
      firstName: userData.first_name,
      role,
      userId: user.id,
    }).catch(() => {})
  }

  if (role === 'admin') {
    redirect('/admin')
  } else if (role === 'accompagnante') {
    redirect('/accompagnante/dashboard')
  } else {
    redirect('/accompagne/dashboard')
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Renvoie le lien de confirmation email pour un utilisateur dont
// `email_confirmed_at` est encore NULL. Réponse volontairement neutre côté
// erreur pour ne pas leaker l'existence d'un compte.
export async function resendConfirmation(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()
  const email = (formData.get('email') as string | null)?.trim()

  if (!email) {
    return { error: 'Adresse email requise.' }
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    // Supabase renvoie une erreur si l'email est déjà confirmé ou inexistant.
    // On reste volontairement vague pour ne pas révéler quels emails existent.
    return { error: 'Impossible d\'envoyer un nouveau lien. L\'adresse est peut-être déjà confirmée.' }
  }

  return { success: true }
}

export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Adresse email requise.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: 'Erreur lors de l\'envoi du lien. Vérifiez votre adresse email.' }
  }

  return {}
}

export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (!password || password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  if (password !== passwordConfirm) {
    return { error: 'Les deux mots de passe ne correspondent pas.' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'Erreur lors de la mise à jour du mot de passe.' }
  }

  return {}
}

export async function deleteAccount(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  try {
    const supabaseAdmin = await createClient({ serviceRole: true })

    // 1. Cancel Stripe subscription if active
    try {
      const subStatus = await getSubscriptionStatus(user.id)
      if (subStatus.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(subStatus.stripeSubscriptionId).catch(() => {})
      }
      if (subStatus.stripeCustomerId) {
        await stripe.customers.del(subStatus.stripeCustomerId).catch(() => {})
      }
    } catch {
      // Stripe errors should not block account deletion
    }

    // 2. Delete Storage files (justificatifs)
    try {
      const { data: profile } = await supabaseAdmin
        .from('accompagnantes_profiles')
        .select('justificatif_identite_url, justificatif_diplome_url, justificatifs_autres')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        const filesToDelete: string[] = []
        if (profile.justificatif_identite_url) filesToDelete.push(profile.justificatif_identite_url)
        if (profile.justificatif_diplome_url) filesToDelete.push(profile.justificatif_diplome_url)
        if (profile.justificatifs_autres) {
          filesToDelete.push(...(profile.justificatifs_autres as string[]))
        }
        if (filesToDelete.length > 0) {
          await supabaseAdmin.storage.from('justificatifs').remove(filesToDelete)
        }
      }
    } catch {
      // Storage errors should not block account deletion
    }

    // 3. Delete from public.users (CASCADE handles profiles, subscriptions, favoris, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user.id)

    if (deleteError) {
      return { error: 'Erreur lors de la suppression du compte. Veuillez contacter le support.' }
    }

    // 4. Delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (authDeleteError) {
      return { error: "Erreur lors de la suppression de l'authentification." }
    }

    // 5. Sign out and redirect
    await supabase.auth.signOut()
  } catch (e) {
    // Re-throw redirect exceptions from Next.js
    if (e && typeof e === 'object' && 'digest' in e) throw e
    console.error('deleteAccount error:', e)
    return { error: 'Erreur inattendue lors de la suppression. Veuillez contacter le support.' }
  }

  redirect('/')
}
