import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

const API_KEY = process.env.API_SECRET_KEY!

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key')
  return key === API_KEY
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const db   = adminDb()

    if (body.externalId) {
      const snap = await db.collection('listings')
        .where('externalId', '==', body.externalId).limit(1).get()

      if (!snap.empty) {
        const ref = snap.docs[0].ref
        await ref.update({ ...body, updatedAt: new Date().toISOString() })
        return NextResponse.json({ id: ref.id, updated: true })
      }
    }

    const ref = await db.collection('listings').add({
      status: 'active',
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id, created: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db   = adminDb()
  const snap = await db.collection('listings').where('status', '==', 'active').get()
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ data, total: data.length })
}
