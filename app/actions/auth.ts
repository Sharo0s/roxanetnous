'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/emails'

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
    return { error: 'Erreur lors de la création du profil.' }
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
