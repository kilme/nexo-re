export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

interface MapPinSummary {
  id: string
  kind: string
  title: string
  subtitle: string
  tag: string
  meta: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const { messages, pins } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const pinIndex = (pins as MapPinSummary[]).map(p => ({
      key:      `${p.kind}::${p.id}`,
      kind:     p.kind,
      title:    p.title,
      subtitle: p.subtitle,
      tag:      p.tag,
      meta:     p.meta,
    }))

    const systemPrompt = `Eres un asistente especializado en búsqueda de inmuebles comerciales para Nexo.RE.
El usuario puede hacer búsquedas en lenguaje natural sobre el portfolio de propiedades y publicaciones.

Tienes acceso al siguiente inventario de elementos en el mapa (en formato JSON compacto):
<inventory>
${JSON.stringify(pinIndex, null, 2)}
</inventory>

Cada elemento tiene:
- key: identificador único "kind::id"
- kind: "property" (inmueble) o "listing" (publicación)
- title: nombre del elemento
- subtitle: descripción breve con dirección y ciudad
- tag: tipo de inmueble
- meta: datos adicionales (type, operationType, area, rentPricePerM2, salePrice, city)

Tu tarea:
1. Interpretar la consulta en lenguaje natural del usuario
2. Filtrar los elementos del inventario que coincidan con los criterios
3. Responder con un JSON estructurado (NO markdown, solo JSON puro) con este formato exacto:
{"reply":"respuesta amigable explicando qué encontraste","matchedKeys":["property::abc123","listing::xyz456"]}

Criterios de búsqueda a considerar:
- Tipo de inmueble: office/oficinas, industrial, retail/local, business_park/centro comercial, hotel, mixed/mixto, land/terreno
- Tipo de operación (listings): rent/alquiler, sale/venta
- Superficie mínima/máxima en m²
- Ciudad o zona geográfica
- Precio de alquiler o venta
- Tipo de entidad (inmueble o publicación)

Si no hay resultados, dilo claramente y sugiere una búsqueda alternativa.
Si la consulta no es sobre propiedades, responde que solo podés ayudar con búsquedas del portfolio.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    })

    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1].content
    const result = await chat.sendMessage(lastMessage)
    const raw = result.response.text()

    let parsed: { reply: string; matchedKeys: string[] }
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { reply: raw, matchedKeys: [] }
    }

    return NextResponse.json({
      reply:       parsed.reply ?? 'No pude procesar la búsqueda.',
      matchedKeys: parsed.matchedKeys ?? [],
    })
  } catch (err) {
    console.error('[map-search]', err)
    return NextResponse.json({ error: 'Error procesando la búsqueda' }, { status: 500 })
  }
}
