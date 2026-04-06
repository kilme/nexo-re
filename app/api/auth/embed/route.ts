import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { adminAuth } from '@/lib/firebase-admin'

const SECRET = new TextEncoder().encode(process.env.EMBED_JWT_SECRET!)

// Logic Apps llama a este endpoint con api_key para generar un token de embed
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey !== process.env.API_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, email, displayName } = await req.json()

  // Genera Firebase custom token para el usuario embed
  const firebaseToken = await adminAuth().createCustomToken(
    userId ?? 'embed-dynamics-user',
    { embed: true, email, displayName }
  )

  // Genera JWT firmado para pasar en la URL del iframe
  const embedToken = await new SignJWT({ firebaseToken, email, displayName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET)

  return NextResponse.json({ embedToken })
}

function publicBaseUrl(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  return `${proto}://${host}`
}

// El iframe carga /embed?token=xxx → este endpoint valida y redirige
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const base  = publicBaseUrl(req)
  if (!token) return NextResponse.redirect(`${base}/login`)

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const res = NextResponse.redirect(`${base}/properties`)
    // Guarda el firebase token en cookie para que el cliente lo use
    res.cookies.set('nexo-embed-token', payload.firebaseToken as string, {
      httpOnly: false, // necesita ser leído por JS en cliente
      maxAge: 8 * 3600,
      sameSite: 'none',
      secure: true,
    })
    res.cookies.set('nexo-session', 'embed', {
      httpOnly: true,
      maxAge: 8 * 3600,
      sameSite: 'none',
      secure: true,
    })
    return res
  } catch {
    return NextResponse.redirect(`${base}/login`)
  }
}
