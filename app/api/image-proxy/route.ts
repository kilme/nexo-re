import { NextRequest, NextResponse } from 'next/server'

// Proxy server-side para imágenes de Firebase Storage (evita CORS en exportaciones)
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const res         = await fetch(url)
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer      = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error al obtener imagen' }, { status: 502 })
  }
}
