'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAllDepartements } from '@/lib/departements'
import { enqueueOuvertureConfirmationEmail } from '@/lib/emails'
import { getClientIp } from '@/lib/get-client-ip'

export type NotificationOuvertureResult = {
  error?: string
  success?: boolean
  alreadyRegistered?: boolean
  codeDepartement?: string
  nomDepartement?: string
}

const VALID_ROLES = ['accompagnante', 'accompagne', 'visiteur'] as const
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitNotificationOuverture(formData: FormData): Promise<NotificationOuvertureResult> {
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  const codeDepartement = ((formData.get('code_departement') as string | null) ?? '').trim().toUpperCase()
  const rawRole = ((formData.get('role') as string | null) ?? '').trim()

  if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) {
    return { error: 'Adresse email invalide.' }
  }
  if (!codeDepartement) {
    return { error: 'Departement requis.' }
  }
  if (!rawRole) {
    return { error: 'Merci d\'indiquer qui vous etes.' }
  }
  if (!VALID_ROLES.includes(rawRole as typeof VALID_ROLES[number])) {
    return { error: 'Role invalide.' }
  }
  const role = rawRole

  const departements = await getAllDepartements()
  const dpt = departements.find((d) => d.code === codeDepartement)
  if (!dpt) {
    return { error: 'Departement inconnu.' }
  }

  const headersList = await headers()
  const ip = getClientIp(headersList)
  const userAgent = headersList.get('user-agent')?.slice(0, 500) || null

  const supabase = await createClient({ serviceRole: true })

  try {
    const { data: allowed } = await supabase.rpc('try_consume_rate_limit', {
      p_key: `notifications-ouverture:${ip ?? 'unknown'}`,
      p_max_requests: 5,
      p_window_seconds: 600,
    })
    if (allowed === false) {
      return { error: 'Trop de tentatives. Reessayez dans quelques minutes.' }
    }
  } catch (rateLimitErr) {
    console.error('[notifications-ouverture][rate_limit_error]', rateLimitErr)
  }

  const { error: insertError } = await supabase
    .from('notifications_ouverture')
    .insert({
      email: rawEmail,
      code_departement: dpt.code,
      role,
      ip_inscription: ip,
      user_agent: userAgent,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        success: true,
        alreadyRegistered: true,
        codeDepartement: dpt.code,
        nomDepartement: dpt.nom,
      }
    }
    console.error('[notifications-ouverture][insert_error]', insertError)
    return { error: "Erreur lors de l'inscription. Reessayez." }
  }

  try {
    await enqueueOuvertureConfirmationEmail({
      email: rawEmail,
      codeDepartement: dpt.code,
      nomDepartement: dpt.nom,
    })
  } catch (emailErr) {
    console.error('[notifications-ouverture][email_unexpected_error]', emailErr)
  }

  return {
    success: true,
    codeDepartement: dpt.code,
    nomDepartement: dpt.nom,
  }
}
