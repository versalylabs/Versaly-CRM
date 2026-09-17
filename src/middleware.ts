import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit, clientIp } from '../lib/rateLimit'

const SENSITIVE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/auth/register': { limit: 8, windowMs: 15 * 60 * 1000 },
  '/api/auth/accept-invite': { limit: 20, windowMs: 15 * 60 * 1000 },
  '/api/public/lead': { limit: 30, windowMs: 15 * 60 * 1000 },
  '/api/auth/callback/credentials': { limit: 15, windowMs: 15 * 60 * 1000 },
}

function withRequestHeaders(response: NextResponse, requestId: string) {
  response.headers.set('X-Request-ID', requestId)
  return response
}

export async function middleware(req: NextRequest) {
  // Do not run authentication or response-header logic on WebSocket/HMR upgrade requests.
  // In Next.js development this avoids interfering with the dev server's upgrade handler.
  if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()

  const policy = SENSITIVE_LIMITS[pathname]
  if (policy && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ip = clientIp(req.headers)
    const result = checkRateLimit(`${pathname}:${ip}`, policy.limit, policy.windowMs)
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
      return withRequestHeaders(NextResponse.json({ error: 'Too many requests. Please try again later.' }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' },
      }), requestId)
    }
  }

  if (
    pathname === '/' ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return withRequestHeaders(NextResponse.next(), requestId)
  }

  const authSecret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'versaly-crm-session-production-auth-secret-key-32-chars-long-minimum';

  const hasSecureCookie = req.cookies.has('__Secure-next-auth.session-token');

  let token = await getToken({
    req,
    secret: authSecret,
    cookieName: hasSecureCookie ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    secureCookie: hasSecureCookie,
  });

  if (!token && hasSecureCookie) {
    token = await getToken({
      req,
      secret: authSecret,
      cookieName: 'next-auth.session-token',
      secureCookie: false,
    });
  } else if (!token && !hasSecureCookie) {
    token = await getToken({
      req,
      secret: authSecret,
      cookieName: '__Secure-next-auth.session-token',
      secureCookie: true,
    });
  }

  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth/signin'
    return withRequestHeaders(NextResponse.redirect(url), requestId)
  }

  if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return withRequestHeaders(NextResponse.redirect(url), requestId)
  }

  return withRequestHeaders(NextResponse.next(), requestId)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|public).*)'],
}
