'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getListing } from '@/lib/firestore'
import type { Listing } from '@/types'

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail',
  business_park: 'Parque Empresarial', land: 'Terreno', other: 'Otro',
}
const OP_LABELS: Record<string, string> = {
  rent: 'Alquiler', sale: 'Venta', rent_sale: 'Alquiler y Venta',
}
const OP_COLORS: Record<string, string> = {
  rent: 'bg-col-green/10 text-col-green',
  sale: 'bg-orange-50 text-orange-600',
  rent_sale: 'bg-purple-50 text-purple-600',
}
const fmt = (n: number) => n.toLocaleString('es-AR')

async function exportPdf(listing: Listing) {
  const { default: jsPDF } = await import('jspdf')
  const doc  = new jsPDF()
  const blue = [0, 120, 212] as [number, number, number]
  doc.setFillColor(...blue)
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('Nexo.RE — Ficha de Publicación', 10, 13)
  doc.setTextColor(0, 0, 0)
  let y = 32
  const line = (label: string, value: string) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label, 10, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 60, y)
    y += 7
  }
  line('Nombre:', listing.name)
  line('Tipo de propiedad:', PROP_LABELS[listing.propertyType] ?? listing.propertyType)
  line('Operación:', OP_LABELS[listing.operationType] ?? listing.operationType)
  line('Dirección:', listing.address.formattedAddress ?? `${listing.address.street ?? ''}, ${listing.address.city ?? ''}`)
  line('Ciudad:', listing.address.city ?? '')
  line('Superficie:', `${fmt(listing.area)} m²`)
  if (listing.floor) line('Piso:', listing.floor)
  if (listing.rentPrice) line('Precio alquiler:', `${listing.currency ?? 'USD'} ${fmt(listing.rentPrice)}`)
  if (listing.salePrice) line('Precio venta:', `${listing.currency ?? 'USD'} ${fmt(listing.salePrice)}`)
  if (listing.amenities?.length) line('Amenities:', listing.amenities.join(', '))
  if (listing.description) {
    y += 4
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción:', 10, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(listing.description, 185)
    doc.text(lines, 10, y)
  }
  doc.save(`publicacion-${listing.id}.pdf`)
}

async function exportXlsx(listing: Listing) {
  const XLSX = await import('xlsx')
  const rows = [{
    'Nombre': listing.name,
    'Tipo de propiedad': PROP_LABELS[listing.propertyType] ?? listing.propertyType,
    'Operación': OP_LABELS[listing.operationType] ?? listing.operationType,
    'Dirección': listing.address.formattedAddress ?? `${listing.address.street ?? ''}, ${listing.address.city ?? ''}`,
    'Ciudad': listing.address.city ?? '',
    'Superficie (m²)': listing.area,
    'Piso': listing.floor ?? '',
    'Precio alquiler': listing.rentPrice ? `${listing.currency ?? 'USD'} ${fmt(listing.rentPrice)}` : '',
    'Precio venta': listing.salePrice ? `${listing.currency ?? 'USD'} ${fmt(listing.salePrice)}` : '',
    'Amenities': listing.amenities?.join(', ') ?? '',
    'Descripción': listing.description ?? '',
  }]
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Publicación')
  XLSX.writeFile(wb, `publicacion-${listing.id}.xlsx`)
}

async function exportDocx(listing: Listing) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const field = (label: string, value: string) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 20 }),
        new TextRun({ text: value, size: 20 }),
      ],
      spacing: { after: 100 },
    })
  const children = [
    new Paragraph({ text: `Publicación: ${listing.name}`, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
    field('Tipo de propiedad', PROP_LABELS[listing.propertyType] ?? listing.propertyType),
    field('Operación', OP_LABELS[listing.operationType] ?? listing.operationType),
    field('Dirección', listing.address.formattedAddress ?? `${listing.address.street ?? ''}, ${listing.address.city ?? ''}`),
    field('Ciudad', listing.address.city ?? ''),
    field('Superficie', `${fmt(listing.area)} m²`),
    ...(listing.floor ? [field('Piso', listing.floor)] : []),
    ...(listing.rentPrice ? [field('Precio alquiler', `${listing.currency ?? 'USD'} ${fmt(listing.rentPrice)}`)] : []),
    ...(listing.salePrice ? [field('Precio venta', `${listing.currency ?? 'USD'} ${fmt(listing.salePrice)}`)] : []),
    ...(listing.amenities?.length ? [field('Amenities', listing.amenities.join(', '))] : []),
    ...(listing.description ? [
      new Paragraph({ text: '', spacing: { after: 100 } }),
      new Paragraph({ text: 'Descripción:', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: listing.description, spacing: { after: 200 } }),
    ] : []),
  ]
  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `publicacion-${listing.id}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [listing,   setListing]  = useState<Listing | null>(null)
  const [loading,   setLoading]  = useState(true)
  const [lightbox,  setLightbox] = useState<string | null>(null)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    if (!id) return
    getListing(id).then(l => { setListing(l); setLoading(false) })
  }, [id])

  const runExport = async (type: string) => {
    if (!listing) return
    setExporting(type)
    if (type === 'pdf')  await exportPdf(listing)
    if (type === 'xlsx') await exportXlsx(listing)
    if (type === 'docx') await exportDocx(listing)
    setExporting('')
  }

  if (loading) return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-6 bg-col-gray rounded w-1/3" />
      <div className="h-48 bg-col-gray rounded" />
      <div className="h-4 bg-col-gray rounded w-2/3" />
    </div>
  )
  if (!listing) return (
    <div className="flex flex-col items-center justify-center h-full text-col-muted">
      <span className="text-4xl mb-3">📢</span>
      <p className="text-sm">Publicación no encontrada</p>
      <Link href="/listings" className="mt-3 text-xs text-dyn hover:underline">← Volver</Link>
    </div>
  )

  const images = listing.images ?? []
  const cover  = listing.coverImage ?? images[0]?.url

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-col-border flex-shrink-0">
        <Link href="/listings" className="text-col-muted hover:text-dyn text-sm">← Publicaciones</Link>
        <span className="text-col-border">/</span>
        <h1 className="font-semibold text-col-text text-sm truncate">{listing.name}</h1>
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
                ? <img src={cover} alt={listing.name} className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightbox(cover)} />
                : <div className="w-full h-full flex items-center justify-center text-4xl text-col-muted/30">📢</div>}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-1.5">
                {images.slice(0, 8).map((img, i) => (
                  <div key={i} className="h-16 bg-col-gray rounded-sm overflow-hidden cursor-pointer"
                    onClick={() => setLightbox(img.url)}>
                    <img src={img.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 bg-dyn-light text-dyn rounded font-medium">
                  {PROP_LABELS[listing.propertyType] ?? listing.propertyType}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${OP_COLORS[listing.operationType] ?? 'bg-col-gray text-col-muted'}`}>
                  {OP_LABELS[listing.operationType] ?? listing.operationType}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  listing.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-col-gray text-col-muted'
                }`}>
                  {listing.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-col-text">{listing.name}</h2>
              <p className="text-sm text-col-muted mt-1">
                {listing.address.formattedAddress ?? `${listing.address.street ?? ''}, ${listing.address.city ?? ''}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-col-gray/50 rounded-sm p-3">
                <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Superficie</p>
                <p className="text-lg font-semibold text-col-text">{fmt(listing.area)} m²</p>
              </div>
              {listing.floor && (
                <div className="bg-col-gray/50 rounded-sm p-3">
                  <p className="text-[10px] text-col-muted uppercase font-medium mb-0.5">Piso</p>
                  <p className="text-lg font-semibold text-col-text">{listing.floor}</p>
                </div>
              )}
            </div>

            {(listing.rentPrice || listing.salePrice) && (
              <div className="border border-col-border rounded-sm p-3 space-y-2">
                <p className="text-[10px] font-semibold text-col-muted uppercase">Precios</p>
                {listing.rentPrice && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-col-muted">Alquiler</span>
                    <span className="font-semibold text-col-green">{listing.currency ?? 'USD'} {fmt(listing.rentPrice)}</span>
                  </div>
                )}
                {listing.salePrice && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-col-muted">Venta</span>
                    <span className="font-semibold text-col-text">{listing.currency ?? 'USD'} {fmt(listing.salePrice)}</span>
                  </div>
                )}
              </div>
            )}

            {listing.amenities && listing.amenities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-col-muted uppercase mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {listing.amenities.map(a => (
                    <span key={a} className="text-[11px] px-2 py-0.5 bg-col-gray rounded-full text-col-text">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {listing.description && (
              <div>
                <p className="text-[10px] font-semibold text-col-muted uppercase mb-1">Descripción</p>
                <p className="text-sm text-col-text leading-relaxed">{listing.description}</p>
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
