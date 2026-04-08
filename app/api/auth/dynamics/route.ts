import { NextRequest, NextResponse } from 'next/server'

function publicBaseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return `${proto}://${host}`
}

// GET /api/auth/dynamics?userId=...&userName=...&userEmail=...
// Recibe el contexto del usuario de Dynamics, guarda en cookie y redirige al portal.
export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams
  const userId    = p.get('userId')    ?? 'unknown'
  const userName  = p.get('userName')  ?? 'Usuario Dynamics'
  const userEmail = p.get('userEmail') ?? ''

  const base = publicBaseUrl(req)
  const res  = NextResponse.redirect(`${base}/map`)

  const cookieOpts = {
    httpOnly: false,
    maxAge:   8 * 3600,
    sameSite: 'none' as const,
    secure:   true,
    path:     '/',
  }

  res.cookies.set('nexo-dynamics-user', JSON.stringify({ name: userName, guid: userId, email: userEmail }), cookieOpts)
  res.cookies.set('nexo-session', 'embed', { ...cookieOpts, httpOnly: true })

  return res
}
