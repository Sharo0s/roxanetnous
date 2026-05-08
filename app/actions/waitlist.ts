'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAllDepartements } from '@/lib/departements'
import { enqueueWaitlistConfirmationEmail } from '@/lib/emails'
import { getClientIp } from '@/lib/get-client-ip'

export type WaitlistResult = {
  error?: string
  success?: boolean
  alreadyRegistered?: boolean
  codeDepartement?: string
  nomDepartement?: string
}

const VALID_ROLES = ['accompagnante', 'accompagne', 'visiteur'] as const
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitWaitlist(formData: FormData): Promise<WaitlistResult> {
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  const codeDepartement = ((formData.get('code_departement') as string | null) ?? '').trim().toUpperCase()
  const rawRole = ((formData.get('role') as string | null) ?? '').trim()

  if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) {
    return { error: 'Adresse email invalide.' }
  }
  if (!codeDepartement) {
    return { error: 'Departement requis.' }
  }
  const role = rawRole === '' ? null : rawRole
  if (role !== null && !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return { error: 'Role invalide.' }
  }

  const departements = await getAllDepartements()
  const dpt = departements.find((d) => d.code === codeDepartement)
  if (!dpt) {
    return { error: 'Departement inconnu.' }
  }

  const headersList = await headers()
  const ip = getClientIp(headersList)
  const userAgent = headersList.get('user-agent')?.slice(0, 500) || null

  const supabase = await createClient({ serviceRole: true })

  // Rate-limit : 5 inscriptions max / 10 min / IP. Best-effort : si le RPC
  // echoue (DB down), on n'empeche pas l'inscription. Pattern aligne
  // app/actions/parrainage.ts:320.
  try {
    const { data: allowed } = await supabase.rpc('try_consume_rate_limit', {
      p_key: `waitlist:${ip ?? 'unknown'}`,
      p_max_requests: 5,
      p_window_seconds: 600,
    })
    if (allowed === false) {
      return { error: 'Trop de tentatives. Reessayez dans quelques minutes.' }
    }
  } catch (rateLimitErr) {
    console.error('[waitlist][rate_limit_error]', rateLimitErr)
  }

  const { error: insertError } = await supabase
    .from('waitlist_departements')
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
    console.error('[waitlist][insert_error]', insertError)
    return { error: "Erreur lors de l'inscription. Reessayez." }
  }

  // Story 4.3 : enqueue durable (Vercel Workflow DevKit). Return immediat
  // (~50-100 ms). En cas de queue down, fallback synchrone est encapsule dans
  // enqueueWaitlistConfirmationEmail (Sentry tag queue-fallback-sync). Le
  // try/catch defensif reste pour absorber un unhandled (defense en profondeur,
  // la ligne waitlist_departements est deja persistee).
  try {
    await enqueueWaitlistConfirmationEmail({
      email: rawEmail,
      codeDepartement: dpt.code,
      nomDepartement: dpt.nom,
    })
  } catch (emailErr) {
    console.error('[waitlist][email_unexpected_error]', emailErr)
  }

  return {
    success: true,
    codeDepartement: dpt.code,
    nomDepartement: dpt.nom,
  }
}
