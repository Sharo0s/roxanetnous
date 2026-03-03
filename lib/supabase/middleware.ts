import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/mentions-legales',
  '/politique-de-confidentialite',
  '/cgu',
  '/sitemap.xml',
  '/robots.txt',
])

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname === '/recherche' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/landing-')
  )
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Skip Supabase entirely for public routes — avoids network calls
  if (isPublicPath(pathname)) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
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

  // Redirect to /login if not authenticated on protected route
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // For admin routes or login/register redirects, we need the role.
  // Read it from user metadata first to avoid a DB call.
  const needsRole = pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register'

  if (needsRole) {
    // Try metadata first (set at signup), fallback to DB query
    let role: string | null = (user.user_metadata?.role as string) ?? null

    if (!role) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      role = userData?.role ?? null
    }

    // Redirect logged-in users away from login/register
    if (pathname === '/login' || pathname === '/register') {
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

    // Protect admin routes
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
