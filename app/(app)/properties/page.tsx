'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getProperties } from '@/lib/firestore'
import { exportPropertiesXlsx, exportPropertiesPdf, exportPropertiesDocx } from '@/lib/export'
import type { Property, PropertyType } from '@/types'

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const fmt = (n: number) => n.toLocaleString('es-AR')

function ExportMenu({ items, filename }: { items: Property[]; filename: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState('')

  const run = async (type: string) => {
    setLoading(type); setOpen(false)
    if (type === 'xlsx') await exportPropertiesXlsx(items, filename)
    if (type === 'pdf')  await exportPropertiesPdf(items, filename)
    if (type === 'docx') await exportPropertiesDocx(items, filename)
    setLoading('')
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={items.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-col-border bg-white hover:bg-col-gray rounded-sm transition-colors disabled:opacity-50">
        {loading ? <span className="w-4 h-4 border-2 border-dyn border-t-transparent rounded-full animate-spin" /> : '⬇️'}
        Exportar
        <span className="text-col-muted text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-col-border rounded-sm shadow-card-hover z-20 min-w-[140px]">
          {[['xlsx','📊 Excel'],['pdf','📄 PDF'],['docx','📝 Word']].map(([t, label]) => (
            <button key={t} onClick={() => run(t)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-dyn-light hover:text-dyn transition-colors">
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PropertyCard({ property }: { property: Property }) {
  const cover = property.coverImage ?? property.images?.[0]?.url
  return (
    <Link href={`/properties/${property.id}`}
      className="bg-white border border-col-border rounded-sm shadow-card hover:shadow-card-hover transition-shadow group block">
      <div className="h-44 bg-col-gray overflow-hidden rounded-t-sm">
        {cover
          ? <img src={cover} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center text-3xl text-col-muted/30">🏢</div>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-col-text text-sm leading-tight line-clamp-1">{property.name}</h3>
          <span className="text-[10px] px-1.5 py-0.5 bg-dyn-light text-dyn rounded font-medium whitespace-nowrap flex-shrink-0">
            {PROP_LABELS[property.type] ?? property.type}
          </span>
        </div>
        <p className="text-xs text-col-muted mb-3 line-clamp-1">
          {property.address.formattedAddress ?? `${property.address.street ?? ''}, ${property.address.city ?? ''}`}
        </p>
        <div className="flex items-center gap-3 text-xs text-col-muted border-t border-col-border pt-2">
          <span>{fmt(property.totalArea)} m²</span>
          {property.floors && <span>{property.floors} pisos</span>}
          {property.rentPricePerM2 && <span className="text-col-green font-medium">Alq. {property.currency ?? 'USD'} {fmt(property.rentPricePerM2)}/m²</span>}
          {property.salePricePerM2 && <span className="text-col-text font-medium">Vta. {property.currency ?? 'USD'} {fmt(property.salePricePerM2)}/m²</span>}
        </div>
      </div>
    </Link>
  )
}

export default function PropertiesPage() {
  const [all, setAll]         = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [typeFilter, setType] = useState<PropertyType | ''>('')
  const [cityFilter, setCity] = useState('')

  useEffect(() => {
    getProperties().then(d => { setAll(d); setLoading(false) })
  }, [])

  const cities  = [...new Set(all.map(p => p.address.city).filter(Boolean))] as string[]
  const filtered = all.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.address.formattedAddress ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter && p.type !== typeFilter) return false
    if (cityFilter && p.address.city !== cityFilter) return false
    return true
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar filters */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-col-border overflow-y-auto p-4">
        <p className="text-[11px] font-semibold text-col-muted uppercase tracking-wide mb-3">Filtros</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-col-text block mb-1">Tipo</label>
            <select value={typeFilter} onChange={e => setType(e.target.value as PropertyType | '')}
              className="w-full text-xs border border-col-border rounded-sm px-2 py-1.5 focus:outline-none focus:border-dyn bg-white">
              <option value="">Todos</option>
              {Object.entries(PROP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-col-text block mb-1">Ciudad</label>
            <select value={cityFilter} onChange={e => setCity(e.target.value)}
              className="w-full text-xs border border-col-border rounded-sm px-2 py-1.5 focus:outline-none focus:border-dyn bg-white">
              <option value="">Todas</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => { setType(''); setCity(''); setSearch('') }}
          className="mt-4 text-xs text-dyn hover:underline">
          Limpiar filtros
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Command bar */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-col-border flex-shrink-0">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-col-muted text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar inmueble..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-col-border rounded-sm focus:outline-none focus:border-dyn bg-white" />
          </div>
          <span className="text-xs text-col-muted">{filtered.length} inmueble{filtered.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto"><ExportMenu items={filtered} filename="inmuebles" /></div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white border border-col-border rounded-sm shadow-card animate-pulse">
                  <div className="h-44 bg-col-gray rounded-t-sm" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-col-gray rounded w-3/4" />
                    <div className="h-3 bg-col-gray rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-col-muted">
              <span className="text-4xl mb-3">🏢</span>
              <p className="text-sm">{all.length === 0 ? 'No hay inmuebles cargados aún' : 'No hay resultados para los filtros aplicados'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
