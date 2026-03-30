'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { getProperties, getListings } from '@/lib/firestore'
import type { Property, Listing } from '@/types'

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const OP_LABELS: Record<string, string> = {
  rent: 'Alquiler', sale: 'Venta', rent_sale: 'Alq. y Venta',
}
const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString('es-AR') : '—'

type PinItem =
  | { kind: 'property'; data: Property }
  | { kind: 'listing';  data: Listing  }

// ─── Export helpers ────────────────────────────────────────────────────────────
async function exportXlsx(items: PinItem[], filename: string) {
  const XLSX = await import('xlsx')
  const rows = items.map(p => {
    if (p.kind === 'property') {
      const d = p.data
      return {
        'Tipo': 'Inmueble',
        'Nombre': d.name,
        'Categoría': PROP_LABELS[d.type] ?? d.type,
        'Dirección': d.address.formattedAddress ?? `${d.address.street ?? ''}, ${d.address.city ?? ''}`,
        'Ciudad': d.address.city ?? '',
        'Superficie (m²)': d.totalArea,
        'Alquiler /m²': d.rentPricePerM2 ? `${d.currency ?? 'USD'} ${fmt(d.rentPricePerM2)}` : '',
        'Venta /m²': d.salePricePerM2 ? `${d.currency ?? 'USD'} ${fmt(d.salePricePerM2)}` : '',
      }
    } else {
      const d = p.data
      return {
        'Tipo': 'Publicación',
        'Nombre': d.name,
        'Categoría': PROP_LABELS[d.propertyType] ?? d.propertyType,
        'Dirección': d.address.formattedAddress ?? `${d.address.street ?? ''}, ${d.address.city ?? ''}`,
        'Ciudad': d.address.city ?? '',
        'Superficie (m²)': d.area,
        'Alquiler': d.rentPrice ? `${d.currency ?? 'USD'} ${fmt(d.rentPrice)}` : '',
        'Venta': d.salePrice ? `${d.currency ?? 'USD'} ${fmt(d.salePrice)}` : '',
      }
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Selección')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

async function exportPdf(items: PinItem[], filename: string) {
  const { default: jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ orientation: 'landscape' })
  const blue = [0, 120, 212] as [number, number, number]
  doc.setFillColor(...blue)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text('Nexo.RE — Selección del mapa', 10, 12)
  doc.setTextColor(0, 0, 0)
  let y = 28
  const cols = [10, 30, 80, 125, 165, 210, 255]
  const headers = ['Tipo', 'Nombre', 'Categoría', 'Ciudad', 'Sup.', 'Alquiler', 'Venta']
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => doc.text(h, cols[i], y))
  doc.setFont('helvetica', 'normal')
  y += 6
  items.forEach(p => {
    if (y > 190) { doc.addPage(); y = 20 }
    doc.setFontSize(7)
    if (p.kind === 'property') {
      const d = p.data
      doc.text('Inmueble',                                cols[0], y)
      doc.text(d.name.substring(0, 25),                  cols[1], y)
      doc.text(PROP_LABELS[d.type] ?? d.type,            cols[2], y)
      doc.text(d.address.city ?? '',                      cols[3], y)
      doc.text(String(d.totalArea),                       cols[4], y)
      doc.text(d.rentPricePerM2 ? fmt(d.rentPricePerM2) : '-', cols[5], y)
      doc.text(d.salePricePerM2 ? fmt(d.salePricePerM2) : '-', cols[6], y)
    } else {
      const d = p.data
      doc.text('Publicación',                             cols[0], y)
      doc.text(d.name.substring(0, 25),                  cols[1], y)
      doc.text(PROP_LABELS[d.propertyType] ?? d.propertyType, cols[2], y)
      doc.text(d.address.city ?? '',                      cols[3], y)
      doc.text(String(d.area),                            cols[4], y)
      doc.text(d.rentPrice ? fmt(d.rentPrice) : '-',     cols[5], y)
      doc.text(d.salePrice ? fmt(d.salePrice) : '-',     cols[6], y)
    }
    y += 7
  })
  doc.save(`${filename}.pdf`)
}

async function exportDocx(items: PinItem[], filename: string) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } = await import('docx')
  const headerRow = new TableRow({
    children: ['Tipo','Nombre','Categoría','Ciudad','Sup.','Alquiler/m²','Venta/m²'].map(h =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
    ),
  })
  const dataRows = items.map(p => {
    const cells = p.kind === 'property'
      ? ['Inmueble', p.data.name, PROP_LABELS[p.data.type] ?? p.data.type,
         p.data.address.city ?? '', String(p.data.totalArea),
         p.data.rentPricePerM2 ? fmt(p.data.rentPricePerM2) : '-',
         p.data.salePricePerM2 ? fmt(p.data.salePricePerM2) : '-']
      : ['Publicación', p.data.name, PROP_LABELS[p.data.propertyType] ?? p.data.propertyType,
         p.data.address.city ?? '', String(p.data.area),
         p.data.rentPrice ? fmt(p.data.rentPrice) : '-',
         p.data.salePrice ? fmt(p.data.salePrice) : '-']
    return new TableRow({
      children: cells.map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 16 })] })] }))
    })
  })
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Nexo.RE — Selección del mapa', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `Total: ${items.length} registros`, spacing: { after: 300 } }),
        new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Polygon selector ──────────────────────────────────────────────────────────
function PolygonSelector({
  enabled,
  onSelect,
  pins,
}: {
  enabled: boolean
  onSelect: (keys: Set<string>) => void
  pins: (PinItem & { lat: number; lng: number; key: string })[]
}) {
  const map         = useMap()
  const drawingLib  = useMapsLibrary('drawing')
  const geometryLib = useMapsLibrary('geometry')
  const managerRef  = useRef<google.maps.drawing.DrawingManager | null>(null)
  const polygonRef  = useRef<google.maps.Polygon | null>(null)

  useEffect(() => {
    if (!map || !drawingLib || !geometryLib) return
    if (!enabled) {
      managerRef.current?.setMap(null)
      polygonRef.current?.setMap(null)
      return
    }
    const mgr = new drawingLib.DrawingManager({
      drawingMode: drawingLib.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: { fillColor: '#0078D4', fillOpacity: 0.15, strokeColor: '#0078D4', strokeWeight: 2 },
    })
    mgr.setMap(map)
    managerRef.current = mgr
    google.maps.event.addListener(mgr, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      polygonRef.current?.setMap(null)
      polygonRef.current = polygon
      mgr.setDrawingMode(null)
      const inside = new Set<string>()
      pins.forEach(p => {
        const pt = new google.maps.LatLng(p.lat, p.lng)
        if (geometryLib.poly.containsLocation(pt, polygon)) inside.add(p.key)
      })
      onSelect(inside)
    })
    return () => {
      mgr.setMap(null)
      polygonRef.current?.setMap(null)
      managerRef.current = null
    }
  }, [map, drawingLib, geometryLib, enabled])

  return null
}

// ─── Info popup ────────────────────────────────────────────────────────────────
function InfoPopup({ item, onClose }: { item: PinItem; onClose: () => void }) {
  if (item.kind === 'property') {
    const d = item.data
    return (
      <div className="absolute bottom-4 left-4 z-30 w-72 bg-white border border-col-border rounded-sm shadow-card-hover p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-dyn-light text-dyn rounded font-medium">Inmueble</span>
          <button onClick={onClose} className="text-col-muted hover:text-col-text text-xs">✕</button>
        </div>
        <h3 className="font-semibold text-col-text text-sm mb-1">{d.name}</h3>
        <p className="text-xs text-col-muted mb-1">{PROP_LABELS[d.type] ?? d.type}</p>
        <p className="text-xs text-col-muted mb-3">{d.address.formattedAddress ?? `${d.address.street ?? ''}, ${d.address.city ?? ''}`}</p>
        <div className="flex gap-3 text-xs border-t border-col-border pt-2">
          <span className="text-col-muted">{fmt(d.totalArea)} m²</span>
          {d.rentPricePerM2 && <span className="text-col-green font-medium">Alq. {fmt(d.rentPricePerM2)}/m²</span>}
          {d.salePricePerM2 && <span className="text-col-text font-medium">Vta. {fmt(d.salePricePerM2)}/m²</span>}
        </div>
        <a href={`/properties/${d.id}`} className="mt-3 block text-center text-xs text-dyn hover:underline">Ver detalle →</a>
      </div>
    )
  }
  const d = item.data
  return (
    <div className="absolute bottom-4 left-4 z-30 w-72 bg-white border border-col-border rounded-sm shadow-card-hover p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] px-1.5 py-0.5 bg-col-green/10 text-col-green rounded font-medium">Publicación</span>
        <button onClick={onClose} className="text-col-muted hover:text-col-text text-xs">✕</button>
      </div>
      <h3 className="font-semibold text-col-text text-sm mb-1">{d.name}</h3>
      <p className="text-xs text-col-muted mb-1">{PROP_LABELS[d.propertyType] ?? d.propertyType} · {OP_LABELS[d.operationType] ?? d.operationType}</p>
      <p className="text-xs text-col-muted mb-3">{d.address.formattedAddress ?? `${d.address.street ?? ''}, ${d.address.city ?? ''}`}</p>
      <div className="flex gap-3 text-xs border-t border-col-border pt-2">
        <span className="text-col-muted">{fmt(d.area)} m²</span>
        {d.rentPrice && <span className="text-col-green font-medium">Alq. {fmt(d.rentPrice)}</span>}
        {d.salePrice && <span className="text-col-text font-medium">Vta. {fmt(d.salePrice)}</span>}
      </div>
      <a href={`/listings/${d.id}`} className="mt-3 block text-center text-xs text-dyn hover:underline">Ver detalle →</a>
    </div>
  )
}

// ─── Export panel ──────────────────────────────────────────────────────────────
function ExportPanel({ selected, pins, onClear }: {
  selected: Set<string>
  pins: (PinItem & { key: string })[]
  onClear: () => void
}) {
  const [loading, setLoading] = useState('')
  const items = pins.filter(p => selected.has(p.key))
  const run = async (type: string) => {
    setLoading(type)
    const pure: PinItem[] = items.map(p => ({ kind: p.kind, data: p.data }) as PinItem)
    if (type === 'xlsx') await exportXlsx(pure, 'seleccion-mapa')
    if (type === 'pdf')  await exportPdf(pure, 'seleccion-mapa')
    if (type === 'docx') await exportDocx(pure, 'seleccion-mapa')
    setLoading('')
  }
  return (
    <div className="absolute top-4 right-4 z-30 bg-white border border-col-border rounded-sm shadow-card-hover p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-col-text">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
        <button onClick={onClear} className="text-[10px] text-col-muted hover:text-dyn">Limpiar</button>
      </div>
      <div className="flex gap-1.5">
        {[['xlsx','Excel'],['pdf','PDF'],['docx','Word']].map(([t, label]) => (
          <button key={t} onClick={() => run(t)} disabled={!!loading}
            className="flex-1 text-[11px] px-2 py-1.5 border border-col-border rounded-sm hover:bg-dyn-light hover:text-dyn transition-colors disabled:opacity-50">
            {loading === t ? '...' : label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Map inner (needs map context) ────────────────────────────────────────────
function MapInner({ pins, showProps, showListings }: {
  pins: (PinItem & { lat: number; lng: number; key: string })[]
  showProps: boolean
  showListings: boolean
}) {
  const [activeKey, setActiveKey]     = useState<string | null>(null)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [polygonMode, setPolygonMode] = useState(false)

  const visiblePins = pins.filter(p =>
    (p.kind === 'property' && showProps) ||
    (p.kind === 'listing'  && showListings)
  )

  const togglePin = useCallback((key: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(key)) { next.delete(key) } else { next.add(key) }
        return next
      })
    } else {
      setSelected(new Set())
      setActiveKey(prev => prev === key ? null : key)
    }
  }, [])

  const activeItem = activeKey ? pins.find(p => p.key === activeKey) ?? null : null

  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => { setPolygonMode(m => !m); setSelected(new Set()) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors shadow-sm ${
            polygonMode
              ? 'bg-dyn text-white border-dyn'
              : 'bg-white border-col-border hover:bg-col-gray'
          }`}>
          ⬡ {polygonMode ? 'Dibujando…' : 'Seleccionar área'}
        </button>
        {selected.size > 0 && !polygonMode && (
          <button onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 text-xs border border-col-border bg-white hover:bg-col-gray rounded-sm shadow-sm">
            ✕ Limpiar selección
          </button>
        )}
      </div>

      {/* Help text */}
      {!polygonMode && selected.size === 0 && (
        <div className="absolute bottom-4 right-4 z-10 text-[10px] text-col-muted bg-white/80 px-2 py-1 rounded-sm border border-col-border">
          Ctrl+clic para selección múltiple
        </div>
      )}

      <PolygonSelector
        enabled={polygonMode}
        pins={visiblePins}
        onSelect={keys => { setSelected(keys); setPolygonMode(false) }}
      />

      {visiblePins.map(pin => {
        const isSelected = selected.has(pin.key)
        const isActive   = activeKey === pin.key
        const isProp     = pin.kind === 'property'
        return (
          <AdvancedMarker
            key={pin.key}
            position={{ lat: pin.lat, lng: pin.lng }}
            onClick={(e) => togglePin(pin.key, (e.domEvent as MouseEvent).ctrlKey || (e.domEvent as MouseEvent).metaKey)}
          >
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold shadow transition-transform cursor-pointer ${
              isSelected
                ? 'bg-orange-500 text-white scale-110 ring-2 ring-orange-300'
                : isActive
                ? 'bg-dyn text-white scale-110'
                : isProp
                ? 'bg-dyn text-white'
                : 'bg-col-green text-white'
            }`}>
              {isProp ? '🏢' : '📢'}
              <span className="max-w-[80px] truncate">
                {isProp ? (pin.data as Property).name : (pin.data as Listing).name}
              </span>
            </div>
          </AdvancedMarker>
        )
      })}

      {activeItem && !polygonMode && selected.size === 0 && (
        <InfoPopup item={activeItem} onClose={() => setActiveKey(null)} />
      )}

      {selected.size > 0 && (
        <ExportPanel selected={selected} pins={pins} onClear={() => setSelected(new Set())} />
      )}
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MapPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [listings,   setListings]   = useState<Listing[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showProps,  setShowProps]  = useState(true)
  const [showList,   setShowList]   = useState(true)

  useEffect(() => {
    Promise.all([getProperties(), getListings()]).then(([props, lists]) => {
      setProperties(props)
      setListings(lists)
      setLoading(false)
    })
  }, [])

  const pins: (PinItem & { lat: number; lng: number; key: string })[] = [
    ...properties
      .filter(p => p.address.lat && p.address.lng)
      .map(p => ({ kind: 'property' as const, data: p, lat: p.address.lat!, lng: p.address.lng!, key: `property-${p.id}` })),
    ...listings
      .filter(l => l.address.lat && l.address.lng)
      .map(l => ({ kind: 'listing' as const, data: l, lat: l.address.lat!, lng: l.address.lng!, key: `listing-${l.id}` })),
  ]

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-2.5 bg-white border-b border-col-border flex-shrink-0">
        <span className="text-xs font-semibold text-col-text">Mapa unificado</span>
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={showProps} onChange={e => setShowProps(e.target.checked)} className="accent-dyn" />
            <span className="flex items-center gap-1">🏢 Inmuebles <span className="text-col-muted">({properties.length})</span></span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={showList} onChange={e => setShowList(e.target.checked)} className="accent-col-green" />
            <span className="flex items-center gap-1">📢 Publicaciones <span className="text-col-muted">({listings.length})</span></span>
          </label>
        </div>
        {loading && <span className="text-xs text-col-muted animate-pulse">Cargando…</span>}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!apiKey ? (
          <div className="flex flex-col items-center justify-center h-full text-col-muted gap-2">
            <span className="text-3xl">🗺️</span>
            <p className="text-sm">Configurá <code className="text-xs bg-col-gray px-1 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para ver el mapa</p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={['drawing', 'geometry']}>
            <Map
              defaultCenter={{ lat: -34.6, lng: -58.4 }}
              defaultZoom={11}
              mapId="nexo-map"
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <MapInner pins={pins} showProps={showProps} showListings={showList} />
            </Map>
          </APIProvider>
        )}
      </div>
    </div>
  )
}
