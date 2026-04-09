'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getProperty } from '@/lib/firestore'
import { fetchImgData } from '@/lib/export'
import type { Property } from '@/types'

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString('es-AR') : '—'

async function exportPdf(property: Property) {
  console.log('[exportPdf] start — property.id:', property.id)
  console.log('[exportPdf] coverImage:', property.coverImage)
  console.log('[exportPdf] images:', property.images)
  const { default: jsPDF } = await import('jspdf')
  const coverUrl = property.coverImage ?? property.images?.[0]?.url
  console.log('[exportPdf] coverUrl resolved:', coverUrl)
  const img = coverUrl ? await fetchImgData(coverUrl) : null
  console.log('[exportPdf] img result:', img ? `format=${img.format} bytes=${img.data.byteLength}` : 'null')

  const doc  = new jsPDF()
  const blue = [0, 120, 212] as [number, number, number]
  doc.setFillColor(...blue)
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('Nexo.RE — Ficha de Inmueble', 10, 13)
  doc.setTextColor(0, 0, 0)

  let y = 28
  if (img) {
    try {
      doc.addImage(img.data, img.format, 10, y, 190, 90)
      y += 95
    } catch { /* skip */ }
  }

  const line = (label: string, value: string) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label, 10, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 60, y)
    y += 7
  }
  line('Nombre:', property.name)
  line('Tipo:', PROP_LABELS[property.type] ?? property.type)
  line('Dirección:', property.address.formattedAddress ?? `${property.address.street ?? ''}, ${property.address.city ?? ''}`)
  line('Ciudad:', property.address.city ?? '')
  line('Superficie total:', `${fmt(property.totalArea)} m²`)
  if (property.floors) line('Pisos:', String(property.floors))
  if (property.yearBuilt) line('Año construcción:', String(property.yearBuilt))
  if (property.clase) line('Clase:', property.clase)
  if (property.rentPricePerM2) line('Precio alquiler /m²:', `${property.currency ?? 'USD'} ${fmt(property.rentPricePerM2)}`)
  if (property.salePrice) line('Precio venta total:', `${property.currency ?? 'USD'} ${fmt(property.salePrice)}`)
  if (property.description) {
    y += 4
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción:', 10, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(property.description, 185)
    doc.text(lines, 10, y)
  }
  doc.save(`inmueble-${property.id}.pdf`)
}

async function exportXlsx(property: Property) {
  const XLSX = await import('xlsx')
  const rows = [{
    'Nombre': property.name,
    'Tipo': PROP_LABELS[property.type] ?? property.type,
    'Dirección': property.address.formattedAddress ?? `${property.address.street ?? ''}, ${property.address.city ?? ''}`,
    'Ciudad': property.address.city ?? '',
    'Superficie (m²)': property.totalArea,
    'Pisos': property.floors ?? '',
    'Año construcción': property.yearBuilt ?? '',
    'Clase': property.clase ?? '',
    'Alquiler /m²': property.rentPricePerM2 ? `${property.currency ?? 'USD'} ${fmt(property.rentPricePerM2)}` : '',
    'Precio venta total': property.salePrice ? `${property.currency ?? 'USD'} ${fmt(property.salePrice)}` : '',
    'Descripción': property.description ?? '',
  }]
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inmueble')
  XLSX.writeFile(wb, `inmueble-${property.id}.xlsx`)
}

async function exportDocx(property: Property) {
  console.log('[exportDocx] start — property.id:', property.id)
  console.log('[exportDocx] coverImage:', property.coverImage)
  console.log('[exportDocx] images:', property.images)
  const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } = await import('docx')
  const coverUrl = property.coverImage ?? property.images?.[0]?.url
  console.log('[exportDocx] coverUrl resolved:', coverUrl)
  const img = coverUrl ? await fetchImgData(coverUrl) : null
  console.log('[exportDocx] img result:', img ? `format=${img.format} bytes=${img.data.byteLength}` : 'null')

  const field = (label: string, value: string) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20 }),
        new TextRun({ text: value, size: 20 }),
      ],
      spacing: { after: 100 },
    })

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: `Inmueble: ${property.name}`, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
    ...(img ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new ImageRun({
        type: img.format === 'PNG' ? 'png' : 'jpg',
        data: img.data,
        transformation: { width: 480, height: 270 },
      })],
    })] : []),
    field('Tipo', PROP_LABELS[property.type] ?? property.type),
    field('Dirección', property.address.formattedAddress ?? `${property.address.street ?? ''}, ${property.address.city ?? ''}`),
    field('Ciudad', property.address.city ?? ''),
    field('Superficie total', `${fmt(property.totalArea)} m²`),
    ...(property.floors ? [field('Pisos', String(property.floors))] : []),
    ...(property.yearBuilt ? [field('Año construcción', String(property.yearBuilt))] : []),
    ...(property.clase ? [field('Clase', property.clase)] : []),
    ...(property.rentPricePerM2 ? [field('Precio alquiler /m²', `${property.currency ?? 'USD'} ${fmt(property.rentPricePerM2)}`)] : []),
    ...(property.salePrice ? [field('Precio venta total', `${property.currency ?? 'USD'} ${fmt(property.salePrice)}`)] : []),
    ...(property.description ? [
      new Paragraph({ text: '', spacing: { after: 100 } }),
      new Paragraph({ text: 'Descripción:', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: property.description, spacing: { after: 200 } }),
    ] : []),
  ]
  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `inmueble-${property.id}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [property,  setProperty]  = useState<Property | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [lightbox,  setLightbox]  = useState<string | null>(null)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    if (!id) return
    getProperty(id).then(p => { setProperty(p); setLoading(false) })
  }, [id])

  const runExport = async (type: string) => {
    if (!property) return
    console.log('[runExport] type:', type, '| property:', property.id, '| coverImage:', property.coverImage, '| images count:', property.images?.length ?? 0)
    setExporting(type)
    if (type === 'pdf')  await exportPdf(property)
    if (type === 'xlsx') await exportXlsx(property)
    if (type === 'docx') await exportDocx(property)
    setExporting('')
  }

  if (loading) return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-6 bg-col-gray rounded w-1/3" />
      <div className="h-48 bg-col-gray rounded" />
      <div className="h-4 bg-col-gray rounded w-2/3" />
    </div>
  )
  if (!property) return (
    <div className="flex flex-col items-center justify-center h-full text-col-muted">
      <span className="text-4xl mb-3">🏢</span>
      <p className="text-sm">Inmueble no encontrado</p>
      <Link href="/properties" className="mt-3 text-xs text-dyn hover:underline">← Volver</Link>
    </div>
  )

  const images = property.images ?? []
  const cover  = property.coverImage ?? images[0]?.url

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-col-border flex-shrink-0">
        <Link href="/properties" className="text-col-muted hover:text-dyn text-sm">← Inmuebles</Link>
        <span className="text-col-border">/</span>
        <h1 className="font-semibold text-col-text text-sm truncate">{property.name}</h1>
        <div className="ml-auto flex items-center gap-1.5">
          {[['xlsx','📊 Excel'],['pdf','📄 PDF'],['docx','📝 Word']].map(([t, label]) => (
            <button key={t} onClick={() => runExport(t)} disabled={!!exporting}
              className="px-3 py-1.5 text-xs border border-col-border bg-white hover:bg-col-gray rounded-sm transition-colors disabled:opacity-50">
              {exporting === t ? '…' : label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: images */}
          <div>
            <div className="h-64 bg-col-gray rounded-sm overflow-hidden mb-3">
              {cover
                ? <img src={cover} alt={property.name} className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightbox(cover)} />
                : <div className="w-full h-full flex items-center justify-center text-4xl text-col-muted/30">🏢</div>}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-1.5">
                {images.slice(0, 8).map((img, i) => (
                  <div key={i} className="cursor-pointer" onClick={() => setLightbox(img.url)}>
                    <div className="h-16 bg-col-gray rounded-sm overflow-hidden">
                      <img src={img.url} alt={img.tipo ?? ''} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                    {img.tipo && <p className="text-[9px] text-col-muted mt-0.5 truncate text-center">{img.tipo}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] px-2 py-0.5 bg-dyn-light text-dyn rounded font-medium">
                  {PROP_LABELS[property.type] ?? property.type}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  property.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-col-gray text-col-muted'
                }`}>
                  {property.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-col-text">{property.name}</h2>
              <p className="text-sm text-col-muted mt-1">
                {property.address.formattedAddress ?? `${property.address.street ?? ''}, ${property.address.city ?? ''}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-col-gray/50 rounded-sm p-3">
                <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Superficie</p>
                <p className="text-lg font-semibold text-col-text">{fmt(property.totalArea)} m²</p>
              </div>
              {property.floors && (
                <div className="bg-col-gray/50 rounded-sm p-3">
                  <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Pisos</p>
                  <p className="text-lg font-semibold text-col-text">{property.floors}</p>
                </div>
              )}
              {property.yearBuilt && (
                <div className="bg-col-gray/50 rounded-sm p-3">
                  <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Año construcción</p>
                  <p className="text-lg font-semibold text-col-text">{property.yearBuilt}</p>
                </div>
              )}
              {property.clase && (
                <div className="bg-col-gray/50 rounded-sm p-3">
                  <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Clase</p>
                  <p className="text-lg font-semibold text-col-text">{property.clase}</p>
                </div>
              )}
            </div>

            {(property.rentPricePerM2 || property.salePrice) && (
              <div className="border border-col-border rounded-sm p-3 space-y-2">
                <p className="text-[10px] font-semibold text-col-muted uppercase">Precios</p>
                {property.rentPricePerM2 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-col-muted">Alquiler por m²</span>
                    <span className="font-semibold text-col-green">{property.currency ?? 'USD'} {fmt(property.rentPricePerM2)}</span>
                  </div>
                )}
                {property.salePrice && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-col-muted">Precio venta total</span>
                    <span className="font-semibold text-col-text">{property.currency ?? 'USD'} {fmt(property.salePrice)}</span>
                  </div>
                )}
              </div>
            )}

            {property.description && (
              <div>
                <p className="text-[10px] font-semibold text-col-muted uppercase mb-1">Descripción</p>
                <p className="text-sm text-col-text leading-relaxed">{property.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded" />
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-col-gray"
            onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
