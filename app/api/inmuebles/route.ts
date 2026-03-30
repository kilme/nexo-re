import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import type { PropertyType } from '@/types'

const API_KEY = process.env.API_SECRET_KEY!

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key')
  return key === API_KEY
}

const TIPO_MAP: Record<number, PropertyType> = {
  0: 'office',
  1: 'industrial',
  2: 'land',
  3: 'retail',
  4: 'business_park',
  5: 'hotel',
  6: 'mixed',
  7: 'other',
}

function resolveType(type: unknown): PropertyType {
  if (typeof type === 'number') return TIPO_MAP[type] ?? 'other'
  if (typeof type === 'string' && /^\d+$/.test(type)) return TIPO_MAP[parseInt(type)] ?? 'other'
  return (type as PropertyType) ?? 'other'
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const db   = adminDb()

    body.type = resolveType(body.type)

    // Upsert por externalId si viene
    if (body.externalId) {
      const snap = await db.collection('properties')
        .where('externalId', '==', body.externalId).limit(1).get()

      if (!snap.empty) {
        const ref = snap.docs[0].ref
        await ref.update({ ...body, updatedAt: new Date().toISOString() })
        return NextResponse.json({ id: ref.id, actualizado: true })
      }
    }

    const ref = await db.collection('properties').add({
      status: 'active',
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ id: ref.id, creado: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const db   = adminDb()
  const snap = await db.collection('properties').where('status', '==', 'active').get()
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json({ data, total: data.length })
}
