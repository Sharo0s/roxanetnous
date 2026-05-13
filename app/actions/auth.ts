'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { waitUntil } from '@vercel/functions'
import { sendWelcomeEmailIfFirstTime } from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'
import { createParrainageRelation } from '@/app/actions/parrainage'
import { getClientIp } from '@/lib/get-client-ip'
import { geocodeAddress } from '@/lib/geocoding'

export type AuthResult = {
  error?: string
  errorCode?: 'email_not_confirmed'
  success?: boolean
}

const SIGNUP_ALLOWED_ROLES = ['accompagnant', 'accompagne'] as const
type SignupRole = (typeof SIGNUP_ALLOWED_ROLES)[number]

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const rawRole = formData.get('role')
  const ville = ((formData.get('ville') as string | null) || '').trim()
  const codePostal = ((formData.get('code_postal') as string | null) || '').trim()

  if (!email || !password || !firstName || !lastName || !rawRole) {
    return { error: 'Tous les champs sont requis.' }
  }

  if (!ville || !/^\d{5}$/.test(codePostal)) {
    return { error: 'Ville et code postal valides requis.' }
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

  // Check préalable : Supabase Auth ne renvoie plus "already registered" pour
  // éviter l'énumération d'emails — il accepte silencieusement le re-signup
  // d'un email existant. Sans ce garde-fou, l'INSERT dans public.users plante
  // sur la contrainte unique users_email_key et l'utilisateur voit un message
  // d'erreur générique.
  const emailAlreadyTaken = await checkEmailExists(email)
  if (emailAlreadyTaken) {
    return { error: 'Cette adresse email est déjà utilisée. Connectez-vous ou réinitialisez votre mot de passe.' }
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

  // Persistance de la localisation dans le profil (créé par le trigger
  // handle_new_user). Géocodage best-effort : si l'API tombe, on stocke quand
  // même ville+CP pour ne pas bloquer l'inscription ; le matching tombera sur
  // le fallback ville-exacte/département en attendant.
  // Note : seule la table accompagnantes_profiles a latitude/longitude
  // (pour le matching Haversine côté offre). Les accompagnés ne stockent
  // que ville+code_postal.
  if (role === 'accompagnant') {
    const geo = await geocodeAddress(ville, codePostal)
    const { error: profileError } = await supabaseAdmin
      .from('accompagnantes_profiles')
      .update({
        ville,
        code_postal: codePostal,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
      })
      .eq('user_id', authData.user.id)
    if (profileError) {
      console.error('Erreur update accompagnantes_profiles avec localisation:', profileError.message)
    }
  } else {
    const { error: profileError } = await supabaseAdmin
      .from('accompagnes_profiles')
      .update({
        ville,
        code_postal: codePostal,
      })
      .eq('user_id', authData.user.id)
    if (profileError) {
      console.error('Erreur update accompagnes_profiles avec localisation:', profileError.message)
    }
  }

  // Parrainage (accompagnante uniquement) : si un code valide est fourni,
  // créer la relation marraine/filleule. Silencieux côté UX (l'inscription
  // réussit même si le code ne convient pas), mais logué côté serveur pour
  // ne pas perdre le signal opérationnel en cas d'échec.
  if (role === 'accompagnant') {
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
  const rememberMe = formData.get('rememberMe') === 'on'

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

  // Si l'utilisateur n'a pas coché "Rester connecté", on convertit les cookies
  // sb-* (posés par signInWithPassword) en cookies de session : ils seront
  // détruits à la fermeture du navigateur. Un cookie marqueur permet au
  // middleware Supabase de refaire le downgrade à chaque token refresh.
  if (!rememberMe) {
    const cookieStore = await cookies()
    cookieStore.set('rxn-no-remember', '1', {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    for (const c of cookieStore.getAll()) {
      if (!c.name.startsWith('sb-')) continue
      cookieStore.set(c.name, c.value, {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      })
    }
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
  // waitUntil : le redirect() ci-dessous tue le process Vercel sinon.
  if ((role === 'accompagnant' || role === 'accompagne') && user.email && userData?.first_name) {
    waitUntil(
      sendWelcomeEmailIfFirstTime({
        email: user.email,
        firstName: userData.first_name,
        role,
        userId: user.id,
      }).catch(() => {})
    )
  }

  if (role === 'admin') {
    redirect('/admin')
  } else if (role === 'accompagnant') {
    redirect('/accompagnant/dashboard')
  } else {
    redirect('/accompagne/dashboard')
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete('rxn-no-remember')
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

// Changement de mot de passe depuis le profil utilisateur (session active).
// Contrairement à `updatePassword` qui est utilisée après un lien de reset,
// on exige ici le mot de passe actuel pour empêcher qu'une session volée ou
// laissée ouverte permette de prendre le contrôle du compte.
export async function updatePasswordFromProfile(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: 'Session expirée. Reconnectez-vous.' }
  }

  const currentPassword = formData.get('currentPassword') as string
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (!currentPassword) {
    return { error: 'Veuillez saisir votre mot de passe actuel.' }
  }

  if (!password || password.length < 8) {
    return { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }
  }

  if (password !== passwordConfirm) {
    return { error: 'Les deux nouveaux mots de passe ne correspondent pas.' }
  }

  if (password === currentPassword) {
    return { error: 'Le nouveau mot de passe doit être différent de l\'actuel.' }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) {
    return { error: 'Mot de passe actuel incorrect.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: 'Erreur lors de la mise à jour du mot de passe.' }
  }

  return { success: true }
}

// Demande de changement d'email depuis le profil. Supabase envoie un mail de
// confirmation au NOUVEL email ; tant que l'utilisateur n'a pas cliqué dessus,
// l'email de connexion reste l'ancien.
export async function updateEmailFromProfile(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: 'Session expirée. Reconnectez-vous.' }
  }

  const newEmail = ((formData.get('email') as string) || '').trim().toLowerCase()
  const currentPassword = (formData.get('currentPassword') as string) || ''

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { error: 'Adresse email invalide.' }
  }

  if (newEmail === user.email.toLowerCase()) {
    return { error: 'Cette adresse est déjà votre email actuel.' }
  }

  if (!currentPassword) {
    return { error: 'Veuillez saisir votre mot de passe pour confirmer.' }
  }

  // Vérification du mot de passe actuel pour bloquer un changement d'email
  // depuis une session ouverte sans réauthentification.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (signInError) {
    return { error: 'Mot de passe incorrect.' }
  }

  // Garde-fou côté applicatif : éviter d'envoyer une demande de changement
  // vers un email déjà utilisé par un autre compte. (Supabase Auth refusera
  // aussi, mais on rend l'erreur lisible.)
  const taken = await checkEmailExists(newEmail)
  if (taken) {
    return { error: 'Cette adresse email est déjà utilisée par un autre compte.' }
  }

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
    }
  )

  if (error) {
    return { error: 'Erreur lors de la demande de changement d\'email.' }
  }

  return { success: true }
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
