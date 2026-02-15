'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/emails'
import { stripe } from '@/lib/stripe'
import { getSubscriptionStatus } from '@/lib/subscription-helpers'

export type AuthResult = {
  error?: string
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const role = formData.get('role') as 'auxiliaire' | 'beneficiaire'

  if (!email || !password || !firstName || !lastName || !role) {
    return { error: 'Tous les champs sont requis.' }
  }

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

  // Créer l'entrée dans public.users via service role (bypass RLS)
  const supabaseAdmin = await createClient({ serviceRole: true })

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
    // Supprimer le user auth orphelin pour permettre une nouvelle tentative
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Erreur lors de la création du profil. Veuillez réessayer.' }
  }

  // Envoyer l'email de bienvenue (non-bloquant)
  sendWelcomeEmail({
    email,
    firstName,
    role,
    userId: authData.user.id,
  }).catch(() => {})

  if (role === 'auxiliaire') {
    redirect('/auxiliaire/dashboard')
  } else {
    redirect('/beneficiaire/dashboard')
  }
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
    return { error: error.message }
  }

  // Récupérer le rôle pour rediriger
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Erreur de connexion.' }
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role

  if (role === 'admin') {
    redirect('/admin')
  } else if (role === 'auxiliaire') {
    redirect('/auxiliaire/dashboard')
  } else {
    redirect('/beneficiaire/dashboard')
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function deleteAccount(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAdmin = await createClient({ serviceRole: true })

  // 1. Cancel Stripe subscription if active
  const subStatus = await getSubscriptionStatus(user.id)
  if (subStatus.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(subStatus.stripeSubscriptionId)
    } catch {
      // Subscription may already be cancelled
    }
  }
  if (subStatus.stripeCustomerId) {
    try {
      await stripe.customers.del(subStatus.stripeCustomerId)
    } catch {
      // Customer may already be deleted
    }
  }

  // 2. Delete Storage files (justificatifs)
  const { data: profile } = await supabaseAdmin
    .from('auxiliaires_profiles')
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

    for (const fileUrl of filesToDelete) {
      // Extract path from URL (format: bucket/path)
      const match = fileUrl.match(/\/storage\/v1\/object\/public\/(.+)/)
      if (match) {
        const fullPath = match[1]
        const bucketEnd = fullPath.indexOf('/')
        const bucket = fullPath.substring(0, bucketEnd)
        const path = fullPath.substring(bucketEnd + 1)
        await supabaseAdmin.storage.from(bucket).remove([path])
      }
    }
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
    return { error: 'Erreur lors de la suppression de l\'authentification.' }
  }

  // 5. Sign out and redirect
  await supabase.auth.signOut()
  redirect('/')
}
