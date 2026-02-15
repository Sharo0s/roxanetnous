'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'roxanetnous <onboarding@resend.dev>'
const CONTACT_EMAIL = 'contact@roxanetnous.fr'

export async function sendContactMessage(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  if (!name || !email || !message) {
    return { error: 'Tous les champs sont obligatoires.' }
  }

  if (message.length > 2000) {
    return { error: 'Le message ne doit pas depasser 2000 caracteres.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Adresse email invalide.' }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `Contact roxanetnous : ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #000;">Nouveau message de contact</h2>
          <p><strong>Nom :</strong> ${name}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Message :</strong></p>
          <p style="white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 8px;">${message}</p>
        </div>
      `,
    })

    const supabase = await createClient({ serviceRole: true })
    await supabase.from('notifications_log').insert({
      email: CONTACT_EMAIL,
      type: 'contact_form',
      subject: `Contact roxanetnous : ${name}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (error) {
    const supabase = await createClient({ serviceRole: true })
    await supabase.from('notifications_log').insert({
      email: CONTACT_EMAIL,
      type: 'contact_form',
      subject: `Contact roxanetnous : ${name}`,
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    })

    return { error: 'Une erreur est survenue. Veuillez reessayer.' }
  }
}
