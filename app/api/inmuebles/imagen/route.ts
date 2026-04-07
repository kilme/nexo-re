import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminStorage } from '@/lib/firebase-admin'
import { categorizarImagen } from '@/lib/gemini-vision'
import { FieldValue } from 'firebase-admin/firestore'
import type { Imagen, ImagenTipo } from '@/types'

const API_KEY = process.env.API_SECRET_KEY!

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('api_key')
  return key === API_KEY
}

async function findPropertyByExternalId(externalId: string) {
  const db   = adminDb()
  const snap = await db.collection('properties')
    .where('externalId', '==', externalId).limit(1).get()
  if (snap.empty) return null
  return snap.docs[0]
}

function storageUrl(bucketName: string, filePath: string) {
  return `https://storage.googleapis.com/${bucketName}/${filePath}`
}

// ─── POST: subir imagen desde Power Automate ─────────────────────────────────
// Body: { externalId, fileName, imageBase64, mimeType }
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { externalId, fileName, imageBase64, mimeType = 'image/jpeg' } = await req.json()

    if (!externalId || !fileName || !imageBase64) {
      return NextResponse.json({ error: 'externalId, fileName e imageBase64 son requeridos' }, { status: 400 })
    }

    const propertyDoc = await findPropertyByExternalId(externalId)
    if (!propertyDoc) {
      return NextResponse.json({ error: `Propiedad con externalId "${externalId}" no encontrada` }, { status: 404 })
    }

    // 1. Categorizar con Gemini Vision
    const { tipo, descripcion } = await categorizarImagen(imageBase64, mimeType)

    // 2. Subir a Firebase Storage
    const bucket   = adminStorage().bucket()
    const filePath = `properties/${externalId}/${fileName}`
    const file     = bucket.file(filePath)

    await file.save(Buffer.from(imageBase64, 'base64'), {
      metadata: { contentType: mimeType },
    })
    await file.makePublic()

    const url = storageUrl(bucket.name, filePath)

    // 3. Actualizar Firestore
    const imagen: Imagen = { url, tipo, descripcion, fileName }
    const data = propertyDoc.data()

    if (tipo === 'portada') {
      // Reemplazar portada anterior (también actualiza images[] si había una portada vieja)
      const prevPortada = (data.images as Imagen[] | undefined)
        ?.find(i => i.tipo === 'portada')

      const updates: Record<string, unknown> = {
        coverImage: url,
        updatedAt:  new Date().toISOString(),
      }

      if (prevPortada) {
        updates.images = FieldValue.arrayRemove(prevPortada)
      }

      await propertyDoc.ref.update(updates)
      // Agregar nueva portada al array de imágenes también
      await propertyDoc.ref.update({ images: FieldValue.arrayUnion(imagen) })
    } else {
      // Numerar automáticamente imágenes del mismo tipo (interior 1, interior 2, etc.)
      const existing = (data.images as Imagen[] | undefined) ?? []
      const sameType = existing.filter(i => i.tipo === tipo).length
      const tipoLabel = sameType > 0
        ? (`${tipo} ${sameType + 1}` as ImagenTipo)
        : tipo

      const imagenNumerada: Imagen = { ...imagen, tipo: tipoLabel as ImagenTipo }

      await propertyDoc.ref.update({
        images:    FieldValue.arrayUnion(imagenNumerada),
        updatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ ok: true, tipo, descripcion, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── DELETE: eliminar imagen ──────────────────────────────────────────────────
// Body: { externalId, fileName }
export async function DELETE(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { externalId, fileName } = await req.json()

    if (!externalId || !fileName) {
      return NextResponse.json({ error: 'externalId y fileName son requeridos' }, { status: 400 })
    }

    const propertyDoc = await findPropertyByExternalId(externalId)
    if (!propertyDoc) {
      return NextResponse.json({ error: `Propiedad con externalId "${externalId}" no encontrada` }, { status: 404 })
    }

    // 1. Eliminar de Firebase Storage
    const bucket   = adminStorage().bucket()
    const filePath = `properties/${externalId}/${fileName}`
    try {
      await bucket.file(filePath).delete()
    } catch {
      // Si no existe en Storage, continuar igual para limpiar Firestore
    }

    // 2. Encontrar y eliminar del array de imágenes en Firestore
    const data    = propertyDoc.data()
    const images  = (data.images as Imagen[] | undefined) ?? []
    const imagen  = images.find(i => i.fileName === fileName)

    if (imagen) {
      const updates: Record<string, unknown> = {
        images:    FieldValue.arrayRemove(imagen),
        updatedAt: new Date().toISOString(),
      }
      // Si era la portada, limpiar coverImage
      if (imagen.tipo === 'portada' || data.coverImage === imagen.url) {
        updates.coverImage = FieldValue.delete()
      }
      await propertyDoc.ref.update(updates)
    }

    return NextResponse.json({ ok: true, eliminado: fileName })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
