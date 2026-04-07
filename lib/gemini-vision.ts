import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ImagenTipo } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const TIPOS_VALIDOS: ImagenTipo[] = ['portada', 'fachada', 'interior', 'planta', 'exterior']

const PROMPT = `Sos un asistente especializado en fotografía inmobiliaria comercial.
Analizá esta imagen y respondé ÚNICAMENTE con un JSON válido con este formato exacto:
{
  "tipo": "<categoría>",
  "descripcion": "<descripción en español>"
}

Categorías posibles (elegí solo una):
- portada: imagen de presentación principal del inmueble, la mejor toma general
- fachada: vista exterior frontal o lateral del edificio
- exterior: otras vistas exteriores (estacionamiento, jardín, accesos, vista aérea)
- interior: espacios interiores (lobby, oficinas, baños, cocina, pasillos, etc.)
- planta: plano arquitectónico, diagrama de planta o distribución de espacios

La descripción debe ser una sola oración concisa en español describiendo lo que se ve.
Respondé SOLO el JSON, sin texto adicional.`

export interface GeminiVisionResult {
  tipo:        ImagenTipo
  descripcion: string
}

export async function categorizarImagen(
  imageBase64: string,
  mimeType:    string
): Promise<GeminiVisionResult> {
  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      PROMPT,
    ])

    const text = result.response.text().trim()
    // Extraer JSON aunque Gemini agregue backticks o texto extra
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini no devolvió JSON válido')

    const parsed = JSON.parse(match[0]) as { tipo: string; descripcion: string }
    const tipo   = TIPOS_VALIDOS.includes(parsed.tipo as ImagenTipo)
      ? (parsed.tipo as ImagenTipo)
      : 'interior' // fallback razonable

    return { tipo, descripcion: parsed.descripcion ?? '' }
  } catch (e) {
    console.warn('[gemini-vision] Error categorizando imagen:', e)
    // Fallback: no bloquear el upload por un error de IA
    return { tipo: 'interior', descripcion: '' }
  }
}
