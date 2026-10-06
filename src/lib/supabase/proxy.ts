import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const protectedPrefixes = [
  '/account',
  '/search',
  '/profile',
  '/editor',
  '/admin',
]

const roleRank: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
}

function isProtectedPath(pathname: string) {
  return (
    pathname === '/' ||
    protectedPrefixes.some(
      (prefix) =>
        pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  )
}

function getRequiredRole(pathname: string) {
  if (pathname.startsWith('/admin/')) {
    return 'admin'
  }

  if (pathname === '/editor' || pathname.startsWith('/editor/')) {
    return 'editor'
  }

  return 'viewer'
}

function redirectWithSessionCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
) {
  const response = NextResponse.redirect(
    new URL(pathname, request.url),
  )

  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })

  return response
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims

  const pathname = request.nextUrl.pathname

  if (!isProtectedPath(pathname)) {
    return supabaseResponse
  }

  if (!claims?.sub) {
    const nextPath = `${pathname}${request.nextUrl.search}`
    const loginPath = `/login?next=${encodeURIComponent(nextPath)}`

    return redirectWithSessionCookies(
      request,
      supabaseResponse,
      loginPath,
    )
  }

  const { data: routeAccess, error: appUserError } = await supabase
    .rpc('get_my_route_access')

  const appUser = routeAccess?.[0]

  // Keep the page-level guard as the fallback if account loading fails.
  if (appUserError || !appUser) {
    return supabaseResponse
  }

  if (appUser.account_status === 'suspended') {
    if (pathname !== '/account') {
      return redirectWithSessionCookies(
        request,
        supabaseResponse,
        '/account',
      )
    }

    return supabaseResponse
  }

  if (appUser.account_status !== 'active') {
    return redirectWithSessionCookies(
      request,
      supabaseResponse,
      '/login?error=このCampus Tagアカウントは現在利用できません。',
    )
  }

  const requiredRole = getRequiredRole(pathname)
  const currentRank = roleRank[appUser.role] ?? 0

  if (currentRank < roleRank[requiredRole]) {
    return redirectWithSessionCookies(
      request,
      supabaseResponse,
      '/account',
    )
  }

  return supabaseResponse
}
