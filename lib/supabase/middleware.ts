import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes publiques — pas de redirection
  const publicPaths = ['/', '/login', '/register']
  const isPublic = publicPaths.some(
    (p) => request.nextUrl.pathname === p
  )

  // API webhooks — pas d'auth requise
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return supabaseResponse
  }

  // Rediriger vers /login si non connecté sur route protégée
  if (
    !user &&
    !isPublic &&
    !request.nextUrl.pathname.startsWith('/auth/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si connecté et visite /login ou /register, rediriger vers dashboard
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = userData?.role
    const url = request.nextUrl.clone()

    if (role === 'admin') {
      url.pathname = '/admin'
    } else if (role === 'auxiliaire') {
      url.pathname = '/auxiliaire/dashboard'
    } else {
      url.pathname = '/beneficiaire/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Protection route admin
  if (request.nextUrl.pathname.startsWith('/admin') && user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
