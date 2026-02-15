import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Si une redirection specifique est demandee (ex: reset-password)
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = userData?.role

        if (role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        } else if (role === 'auxiliaire') {
          return NextResponse.redirect(`${origin}/auxiliaire/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/beneficiaire/dashboard`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
