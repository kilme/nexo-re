'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { getProperties, getListings } from '@/lib/firestore'
import { exportSelectionXlsx, exportSelectionPdf, exportSelectionDocx } from '@/lib/exportMapSelection'
import type { SelectionPin } from '@/lib/exportMapSelection'
import type { Property, Listing } from '@/types'

// ─── Labels & colors ──────────────────────────────────────────────────────────

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const OP_LABELS: Record<string, string> = {
  rent: 'Alquiler', sale: 'Venta', rent_sale: 'Alq. y Venta',
}
const TYPE_COLORS: Record<string, string> = {
  office: '#0078D4', industrial: '#E36C09', land: '#7B5EA7',
  retail: '#D4294B', business_park: '#107C10', hotel: '#C19C00',
  mixed: '#00B7C3', other: '#767676',
}
const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString('es-AR') : '—'

// ─── Types ────────────────────────────────────────────────────────────────────

type PinItem =
  | { kind: 'property'; data: Property }
  | { kind: 'listing';  data: Listing  }

type MapPin = PinItem & { lat: number; lng: number; key: string }

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  matchedKeys?: string[]
}

// ─── Polygon selector ─────────────────────────────────────────────────────────

function PolygonSelector({
  enabled,
  onSelect,
  pins,
}: {
  enabled: boolean
  onSelect: (keys: Set<string>) => void
  pins: MapPin[]
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
      polygonOptions: { fillColor: '#0078D4', fillOpacity: 0.15, strokeColor: '#0078D4', strokeWeight: 2, editable: false },
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
  }, [map, drawingLib, geometryLib, enabled, pins, onSelect])

  return null
}

// ─── Info popup ───────────────────────────────────────────────────────────────

function InfoPopup({ item, onClose }: { item: MapPin; onClose: () => void }) {
  const d = item.data
  const isProp = item.kind === 'property'
  return (
    <div className="absolute bottom-4 left-4 z-30 w-72 bg-white border border-col-border rounded-sm shadow-card-hover p-4">
      <div className="flex items-start justify-between mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isProp ? 'bg-dyn-light text-dyn' : 'bg-col-green/10 text-col-green'}`}>
          {isProp ? 'Inmueble' : 'Publicación'}
        </span>
        <button onClick={onClose} className="text-col-muted hover:text-col-text text-xs">✕</button>
      </div>
      <h3 className="font-semibold text-col-text text-sm mb-1">{d.name}</h3>
      <p className="text-xs text-col-muted mb-1">
        {isProp
          ? PROP_LABELS[(d as Property).type] ?? (d as Property).type
          : `${PROP_LABELS[(d as Listing).propertyType] ?? (d as Listing).propertyType} · ${OP_LABELS[(d as Listing).operationType] ?? ''}`}
      </p>
      <p className="text-xs text-col-muted mb-3">
        {d.address.formattedAddress ?? `${d.address.street ?? ''}, ${d.address.city ?? ''}`}
      </p>
      <div className="flex gap-3 text-xs border-t border-col-border pt-2">
        {isProp ? (
          <>
            <span className="text-col-muted">{fmt((d as Property).totalArea)} m²</span>
            {(d as Property).rentPricePerM2 && <span className="text-col-green font-medium">Alq. {fmt((d as Property).rentPricePerM2)}/m²</span>}
            {(d as Property).salePrice && <span className="text-col-text font-medium">Vta. {fmt((d as Property).salePrice)}</span>}
          </>
        ) : (
          <>
            <span className="text-col-muted">{fmt((d as Listing).area)} m²</span>
            {(d as Listing).rentPrice && <span className="text-col-green font-medium">Alq. {fmt((d as Listing).rentPrice)}</span>}
            {(d as Listing).salePrice && <span className="text-col-text font-medium">Vta. {fmt((d as Listing).salePrice)}</span>}
          </>
        )}
      </div>
      <a href={isProp ? `/properties/${d.id}` : `/listings/${d.id}`}
        className="mt-3 block text-center text-xs text-dyn hover:underline">Ver detalle →</a>
    </div>
  )
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ allPins, onResults, onClear }: {
  allPins: MapPin[]
  onResults: (keys: Set<string>) => void
  onClear: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setLoading(true)
    try {
      const pinSummaries = allPins.map(p => ({
        id:       p.data.id,
        kind:     p.kind,
        title:    p.data.name,
        subtitle: p.data.address.formattedAddress ?? `${p.data.address.street ?? ''}, ${p.data.address.city ?? ''}`,
        tag:      p.kind === 'property' ? (p.data as Property).type : (p.data as Listing).propertyType,
        meta:     p.kind === 'property'
          ? { type: (p.data as Property).type, area: (p.data as Property).totalArea, rentPricePerM2: (p.data as Property).rentPricePerM2, salePrice: (p.data as Property).salePrice, city: p.data.address.city }
          : { type: (p.data as Listing).propertyType, operationType: (p.data as Listing).operationType, area: (p.data as Listing).area, rentPrice: (p.data as Listing).rentPrice, salePrice: (p.data as Listing).salePrice, city: p.data.address.city },
      }))

      const res  = await fetch('/api/chat/map-search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })), pins: pinSummaries }),
      })
      const data = await res.json()
      const matchedKeys: string[] = data.matchedKeys ?? []

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'No pude procesar la búsqueda.', matchedKeys }])

      if (matchedKeys.length > 0) {
        const keySet = new Set(matchedKeys.map(k => {
          const [kind, id] = k.split('::')
          const pin = allPins.find(p => p.kind === kind && p.data.id === id)
          return pin?.key ?? ''
        }).filter(Boolean))
        onResults(keySet)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente. Intentá nuevamente.' }])
    } finally {
      setLoading(false)
    }
  }

  const EXAMPLES = [
    'Oficinas en Ciudad de México en alquiler',
    'Inmuebles industriales con más de 1000 m²',
    'Publicaciones de venta en Monterrey',
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b bg-dyn text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Búsqueda inteligente</p>
            <p className="text-[10px] opacity-75 mt-0.5">Describí lo que buscás en lenguaje natural</p>
          </div>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setInput(''); onClear() }}
              className="text-[10px] opacity-70 hover:opacity-100 px-2 py-1 rounded border border-white/30 hover:bg-white/10">
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4 px-2">
            <div className="text-2xl mb-2">✦</div>
            <p className="text-[11px] text-col-muted font-medium mb-3">¿Qué estás buscando?</p>
            <div className="space-y-1.5">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setInput(ex); inputRef.current?.focus() }}
                  className="w-full text-left text-[11px] bg-col-gray/50 hover:bg-dyn-light hover:text-dyn border border-col-border rounded-sm px-2.5 py-1.5 transition-colors">
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-sm px-3 py-2 text-xs ${
              msg.role === 'user'
                ? 'bg-dyn text-white'
                : 'bg-white border border-col-border text-col-text shadow-sm'
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.matchedKeys && msg.matchedKeys.length > 0 && (
                <p className="mt-1.5 text-[10px] text-col-green font-medium">
                  ✓ {msg.matchedKeys.length} resultado{msg.matchedKeys.length !== 1 ? 's' : ''} destacado{msg.matchedKeys.length !== 1 ? 's' : ''} en el mapa
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-col-border rounded-sm shadow-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map(d => (
                  <span key={d} style={{ animationDelay: `${d}ms` }}
                    className="w-1.5 h-1.5 bg-col-muted rounded-full animate-bounce" />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Describí lo que buscás..." rows={2}
            className="flex-1 resize-none text-xs border border-col-border rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-dyn placeholder-col-muted" />
          <button onClick={send} disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 bg-dyn hover:bg-dyn/90 disabled:bg-col-gray text-white rounded-sm flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-col-muted mt-1 text-center">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}

// ─── Map inner ────────────────────────────────────────────────────────────────

function MapInner({ pins, showProps, showListings, chatKeys }: {
  pins: MapPin[]
  showProps: boolean
  showListings: boolean
  chatKeys: Set<string> | null
}) {
  const [activeKey, setActiveKey]     = useState<string | null>(null)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [polygonMode, setPolygonMode] = useState(false)
  const [exporting, setExporting]     = useState('')

  const visiblePins = pins.filter(p =>
    (p.kind === 'property' && showProps) ||
    (p.kind === 'listing'  && showListings)
  )

  const togglePin = useCallback((key: string, ctrl: boolean) => {
    if (ctrl) {
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

  const selectionPins: SelectionPin[] = pins
    .filter(p => selected.has(p.key))
    .map(p => ({
      id:          p.data.id,
      kind:        p.kind,
      title:       p.data.name,
      subtitle:    p.data.address.formattedAddress ?? `${p.data.address.street ?? ''}, ${p.data.address.city ?? ''}`,
      lat:         p.lat,
      lng:         p.lng,
      coverImage:  p.data.coverImage,
    }))

  const runExport = async (type: string) => {
    if (!selectionPins.length) return
    setExporting(type)
    if (type === 'xlsx') await exportSelectionXlsx(selectionPins)
    if (type === 'pdf')  await exportSelectionPdf(selectionPins)
    if (type === 'docx') await exportSelectionDocx(selectionPins)
    setExporting('')
  }

  return (
    <>
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => { setPolygonMode(m => !m); setSelected(new Set()) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-sm transition-colors shadow-sm ${
            polygonMode ? 'bg-dyn text-white border-dyn' : 'bg-white border-col-border hover:bg-col-gray'
          }`}>
          🔷 {polygonMode ? 'Dibujando…' : 'Seleccionar área'}
        </button>
        {selected.size > 0 && !polygonMode && (
          <button onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 text-xs border border-col-border bg-white hover:bg-col-gray rounded-sm shadow-sm">
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Export panel */}
      {selected.size > 0 && (
        <div className="absolute top-4 right-4 z-30 bg-white border border-col-border rounded-sm shadow-card-hover p-3 min-w-[210px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-col-text">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
            <button onClick={() => setSelected(new Set())} className="text-[10px] text-col-muted hover:text-dyn">Limpiar</button>
          </div>
          <div className="flex gap-1.5">
            {[['xlsx','Excel'],['pdf','PDF'],['docx','Word']].map(([t, label]) => (
              <button key={t} onClick={() => runExport(t)} disabled={!!exporting}
                className="flex-1 text-[11px] px-2 py-1.5 border border-col-border rounded-sm hover:bg-dyn-light hover:text-dyn transition-colors disabled:opacity-50">
                {exporting === t ? '…' : label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help */}
      {!polygonMode && selected.size === 0 && !chatKeys && (
        <div className="absolute bottom-4 right-4 z-10 text-[10px] text-col-muted bg-white/80 px-2 py-1 rounded-sm border border-col-border">
          Ctrl+clic para selección múltiple
        </div>
      )}

      <PolygonSelector enabled={polygonMode} pins={visiblePins}
        onSelect={keys => { setSelected(keys); setPolygonMode(false) }} />

      {visiblePins.map(pin => {
        const isSelected  = selected.has(pin.key)
        const isActive    = activeKey === pin.key
        const isChatMatch = chatKeys ? chatKeys.has(pin.key) : true
        const propType    = pin.kind === 'property' ? (pin.data as Property).type : (pin.data as Listing).propertyType
        const baseColor   = TYPE_COLORS[propType] ?? '#767676'
        const bgColor     = isSelected ? '#F97316' : isActive ? '#1A1A1A' : baseColor
        const dimmed      = chatKeys && !isChatMatch && !isSelected

        return (
          <AdvancedMarker
            key={pin.key}
            position={{ lat: pin.lat, lng: pin.lng }}
            onClick={(e) => togglePin(pin.key, (e.domEvent as MouseEvent).ctrlKey || (e.domEvent as MouseEvent).metaKey)}
          >
            <div style={{ backgroundColor: bgColor, opacity: dimmed ? 0.25 : 1 }}
              className={`flex items-center justify-center w-9 h-9 rounded-full text-[10px] font-bold shadow-md cursor-pointer transition-transform text-white ${
                (isSelected || isActive) ? 'scale-125 ring-2 ring-white/60' : 'hover:scale-110'
              } ${isChatMatch && chatKeys ? 'ring-2 ring-yellow-400' : ''}`}>
              {pin.kind === 'property' ? 'INM' : 'PUB'}
            </div>
          </AdvancedMarker>
        )
      })}

      {activeItem && !polygonMode && selected.size === 0 && (
        <InfoPopup item={activeItem} onClose={() => setActiveKey(null)} />
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [listings,   setListings]   = useState<Listing[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showProps,     setShowProps]     = useState(true)
  const [showList,      setShowList]      = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_COLORS)))
  const [tab,           setTab]           = useState<'filters' | 'chat'>('filters')
  const [chatKeys,      setChatKeys]      = useState<Set<string> | null>(null)

  const toggleType = (type: string) =>
    setSelectedTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })

  const allTypesSelected = selectedTypes.size === Object.keys(TYPE_COLORS).length

  const toggleAllTypes = () =>
    setSelectedTypes(
      allTypesSelected ? new Set() : new Set(Object.keys(TYPE_COLORS))
    )

  useEffect(() => {
    Promise.all([getProperties(), getListings()])
      .then(([props, lists]) => {
        console.log(`[Nexo] Propiedades: ${props.length} total, ${props.filter(p => p.address.lat && p.address.lng).length} con coords`)
        console.log(`[Nexo] Publicaciones: ${lists.length} total, ${lists.filter(l => l.address.lat && l.address.lng).length} con coords`)
        setProperties(props)
        setListings(lists)
        setLoading(false)
      })
      .catch(err => {
        console.error('[Nexo] Error cargando datos:', err)
        setLoading(false)
      })
  }, [])

  const pins: MapPin[] = [
    ...properties
      .filter(p => p.address.lat && p.address.lng && selectedTypes.has(p.type))
      .map(p => ({ kind: 'property' as const, data: p, lat: p.address.lat!, lng: p.address.lng!, key: `property-${p.id}` })),
    ...listings
      .filter(l => l.address.lat && l.address.lng && selectedTypes.has(l.propertyType))
      .map(l => ({ kind: 'listing' as const, data: l, lat: l.address.lat!, lng: l.address.lng!, key: `listing-${l.id}` })),
  ]

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-col-border flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-col-border flex-shrink-0">
          {([['filters','Filtros'],['chat','Búsqueda IA']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
                tab === t ? 'border-b-2 border-dyn text-dyn' : 'text-col-muted hover:text-col-text'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'filters' ? (
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">

            {/* Capas */}
            <div>
              <p className="text-[11px] font-semibold text-col-muted uppercase tracking-wide mb-2">Capas</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={showProps} onChange={e => setShowProps(e.target.checked)} className="accent-dyn w-3.5 h-3.5" />
                  <span className="flex items-center gap-1.5">🏢 Inmuebles <span className="text-col-muted">({properties.filter(p => selectedTypes.has(p.type)).length})</span></span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={showList} onChange={e => setShowList(e.target.checked)} className="accent-col-green w-3.5 h-3.5" />
                  <span className="flex items-center gap-1.5">📢 Publicaciones <span className="text-col-muted">({listings.filter(l => selectedTypes.has(l.propertyType)).length})</span></span>
                </label>
              </div>
            </div>

            {/* Tipo */}
            <div className="pt-3 border-t border-col-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-col-muted uppercase tracking-wide">Tipo</p>
                <button onClick={toggleAllTypes} className="text-[10px] text-dyn hover:underline">
                  {allTypesSelected ? 'Ninguno' : 'Todos'}
                </button>
              </div>
              <div className="space-y-1.5">
                {Object.entries(TYPE_COLORS).map(([type, color]) => {
                  const active = selectedTypes.has(type)
                  return (
                    <label key={type} className="flex items-center gap-2 text-xs cursor-pointer group">
                      <span
                        onClick={() => toggleType(type)}
                        className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 border transition-opacity cursor-pointer ${active ? 'opacity-100' : 'opacity-25'}`}
                        style={{ backgroundColor: color, borderColor: color }}
                      />
                      <input
                        type="checkbox" checked={active} onChange={() => toggleType(type)}
                        className="sr-only"
                      />
                      <span
                        onClick={() => toggleType(type)}
                        className={`transition-colors ${active ? 'text-col-text' : 'text-col-muted'}`}
                      >
                        {PROP_LABELS[type] ?? type}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {loading && <p className="text-xs text-col-muted animate-pulse">Cargando…</p>}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              allPins={pins}
              onResults={keys => setChatKeys(keys)}
              onClear={() => setChatKeys(null)}
            />
          </div>
        )}
      </aside>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        {!apiKey ? (
          <div className="flex flex-col items-center justify-center h-full text-col-muted gap-2">
            <span className="text-3xl">🗺️</span>
            <p className="text-sm">Configurá <code className="text-xs bg-col-gray px-1 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para ver el mapa</p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={['drawing', 'geometry']}>
            <Map
              defaultCenter={{ lat: 19.4326, lng: -99.1332 }}
              defaultZoom={6}
              mapId="955e6d120bfec853d9d9a92e"
              gestureHandling="greedy"
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            >
              <MapInner pins={pins} showProps={showProps} showListings={showList} chatKeys={chatKeys} />
            </Map>
          </APIProvider>
        )}
      </div>
    </div>
  )
}
