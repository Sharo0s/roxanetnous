import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmailIfFirstTime } from '@/lib/emails'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next')

  if (code || tokenHash) {
    const supabase = await createClient()

    // Deux formats Supabase :
    // - code= : flux PKCE (par défaut sur les nouveaux templates)
    // - token_hash + type : ancien flux (templates non migrés)
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: (type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change') ?? 'email',
        })

    if (!error) {
      // Si une redirection specifique est demandee (ex: reset-password)
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role, first_name')
          .eq('id', user.id)
          .single()

        const role = userData?.role

        // Premier passage = confirmation email réussie : envoie le mail
        // "Bienvenue" (idempotent, ne renvoie pas si déjà loggé en 'sent').
        // waitUntil : Vercel laisse la promesse finir en arrière-plan APRÈS
        // la redirection. Sans ça, NextResponse.redirect() tue le process
        // avant que Resend ait fini son POST (test du 12/05 : aucun log).
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
          return NextResponse.redirect(`${origin}/admin`)
        } else if (role === 'accompagnant') {
          return NextResponse.redirect(`${origin}/accompagnant/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/accompagne/dashboard`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
