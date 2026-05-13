import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const role =
    (user.user_metadata?.role as string | undefined) ??
    (await supabase.from('users').select('role').eq('id', user.id).single()).data?.role ??
    null

  let dashboard = '/'
  if (role === 'admin') dashboard = '/admin'
  else if (role === 'accompagnant') dashboard = '/accompagnant/dashboard'
  else if (role === 'accompagne') dashboard = '/accompagne/dashboard'

  return NextResponse.json(
    { authenticated: true, role, dashboard },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
