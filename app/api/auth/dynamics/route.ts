import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

const EMBED_SECRET = process.env.DYNAMICS_EMBED_SECRET!
const WINDOW_MS    = 10 * 60 * 1000 // 10 minutos

async function verifyHmac(secret: string, message: string, signature: string): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )
    const b64      = signature.replace(/-/g, '+').replace(/_/g, '/')
    const padded   = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
    return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(message))
  } catch {
    return false
  }
}

// GET /api/auth/dynamics?userId=...&userName=...&userEmail=...&ts=...&sig=...
export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams
  const userId    = p.get('userId')
  const userName  = p.get('userName')
  const userEmail = p.get('userEmail') ?? ''
  const ts        = p.get('ts')
  const sig       = p.get('sig')

  const redirect = (path: string) => {
    const url = req.nextUrl.clone()
    url.pathname = path.split('?')[0]
    url.search   = path.includes('?') ? '?' + path.split('?')[1] : ''
    return NextResponse.redirect(url)
  }

  if (!userId || !userName || !ts || !sig) {
    return redirect('/login')
  }

  // Validar ventana de tiempo
  const age = Date.now() - parseInt(ts, 10)
  if (age < 0 || age > WINDOW_MS) {
    return redirect('/login?error=expired')
  }

  // Validar HMAC
  const valid = await verifyHmac(EMBED_SECRET, `${userId}:${userName}:${ts}`, sig)
  if (!valid) {
    return redirect('/login?error=invalid')
  }

  // Crear Firebase custom token para el usuario de Dynamics
  const firebaseToken = await adminAuth().createCustomToken(
    `dynamics-${userId}`,
    {
      embed:        true,
      dynamicsUser: true,
      dynamicsGuid: userId,
      dynamicsName: userName,
      email:        userEmail,
    }
  )

  const cookieOpts = {
    httpOnly:  false,
    maxAge:    8 * 3600,
    sameSite:  'none' as const,
    secure:    true,
    path:      '/',
  }

  const res = redirect('/properties')
  // Re-set cookies sobre el response de redirect ya creado
  ;[
    ['nexo-embed-token',   firebaseToken,                                              cookieOpts],
    ['nexo-dynamics-user', JSON.stringify({ name: userName, guid: userId, email: userEmail }), cookieOpts],
    ['nexo-session',       'embed',                                                    { ...cookieOpts, httpOnly: true }],
  ].forEach(([name, value, opts]) => res.cookies.set(name as string, value as string, opts as Parameters<typeof res.cookies.set>[2]))
  return res
}
