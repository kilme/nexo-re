import type { Property, Listing } from '@/types'

// ─── Labels ───────────────────────────────────────────────────────────────────

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const OP_LABELS: Record<string, string> = {
  rent: 'Alquiler', sale: 'Venta', rent_sale: 'Alquiler y Venta',
}
const fmt  = (n: number | null | undefined) => n != null ? n.toLocaleString('es-AR') : '—'
const BLUE: [number, number, number] = [0, 120, 212]
const BLUE_HEX = '0078D4'
const today = () => new Date().toLocaleDateString('es-AR')

// ─── Image utilities ──────────────────────────────────────────────────────────

const proxied = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`

// Devuelve { data: Uint8Array, format: 'JPEG'|'PNG' } listo para jsPDF e ImageRun
export async function fetchImgData(url: string): Promise<{ data: Uint8Array; format: 'JPEG' | 'PNG' } | null> {
  try {
    console.log('[export] fetching:', proxied(url))
    const res    = await fetch(proxied(url))
    console.log('[export] status:', res.status, 'content-type:', res.headers.get('content-type'))
    if (!res.ok) { console.warn('[export] fetch failed:', res.status); return null }
    const ct     = res.headers.get('content-type') ?? ''
    const format = ct.includes('png') ? 'PNG' : 'JPEG'
    const buf    = await res.arrayBuffer()
    console.log('[export] image size (bytes):', buf.byteLength, 'format:', format)
    return { data: new Uint8Array(buf), format }
  } catch (e) {
    console.error('[export] fetchImgData error:', e)
    return null
  }
}


// ─── Excel ────────────────────────────────────────────────────────────────────

export async function exportPropertiesXlsx(items: Property[], filename = 'inmuebles') {
  const XLSX = await import('xlsx')
  const rows = items.map(p => ({
    'Nombre':              p.name,
    'Tipo':                PROP_LABELS[p.type] ?? p.type,
    'Dirección':           p.address.formattedAddress ?? `${p.address.street ?? ''}, ${p.address.city ?? ''}`,
    'Ciudad':              p.address.city ?? '',
    'Superficie (m²)':    p.totalArea,
    'Pisos':               p.floors ?? '',
    'Año construcción':   p.yearBuilt ?? '',
    'Clase':               p.clase ?? '',
    'Alquiler /m²':       p.rentPricePerM2 ? `${p.currency ?? 'USD'} ${fmt(p.rentPricePerM2)}` : '',
    'Precio venta total': p.salePrice ? `${p.currency ?? 'USD'} ${fmt(p.salePrice)}` : '',
    'Estado':              p.status === 'active' ? 'Activo' : 'Inactivo',
    'Portada (URL)':       p.coverImage ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    {wch:40},{wch:18},{wch:40},{wch:18},{wch:14},{wch:8},{wch:12},{wch:8},
    {wch:14},{wch:18},{wch:10},{wch:60},
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inmuebles')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportListingsXlsx(items: Listing[], filename = 'publicaciones') {
  const XLSX = await import('xlsx')
  const rows = items.map(l => ({
    'Nombre':          l.name,
    'Tipo':            PROP_LABELS[l.propertyType] ?? l.propertyType,
    'Operación':      OP_LABELS[l.operationType] ?? l.operationType,
    'Dirección':       l.address.formattedAddress ?? `${l.address.street ?? ''}, ${l.address.city ?? ''}`,
    'Ciudad':          l.address.city ?? '',
    'Superficie (m²)': l.area,
    'Piso':            l.floor ?? '',
    'Alquiler':        l.rentPrice ? `${l.currency ?? 'USD'} ${fmt(l.rentPrice)}` : '',
    'Venta':           l.salePrice ? `${l.currency ?? 'USD'} ${fmt(l.salePrice)}` : '',
    'Estado':          l.status === 'active' ? 'Activo' : 'Inactivo',
    'Portada (URL)':   l.coverImage ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    {wch:40},{wch:18},{wch:14},{wch:40},{wch:18},{wch:14},{wch:8},{wch:16},{wch:16},{wch:10},{wch:60},
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Publicaciones')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportPropertiesPdf(items: Property[], filename = 'inmuebles') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  // Prefetch cover images in parallel
  const images = await Promise.all(
    items.map(p => {
      const url = p.coverImage ?? p.images?.[0]?.url
      return url ? fetchImgData(url) : Promise.resolve(null)
    })
  )

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, 297, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Nexo.RE — Inmuebles', 10, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${items.length} registros · ${today()}`, 240, 11)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 20,
    head: [['', 'Nombre', 'Tipo', 'Ciudad', 'Sup. m²', 'Alq/m²', 'Venta total', 'Clase']],
    body: items.map(p => [
      '',
      p.name,
      PROP_LABELS[p.type] ?? p.type,
      p.address.city ?? '',
      fmt(p.totalArea),
      p.rentPricePerM2 ? `${p.currency ?? 'USD'} ${fmt(p.rentPricePerM2)}` : '—',
      p.salePrice      ? `${p.currency ?? 'USD'} ${fmt(p.salePrice)}`      : '—',
      p.clase ?? '',
    ]),
    headStyles:          { fillColor: BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:          { fontSize: 7, textColor: [30, 30, 30], minCellHeight: 22, valign: 'middle' },
    alternateRowStyles:  { fillColor: [229, 241, 251] },
    columnStyles: {
      0: { cellWidth: 32, cellPadding: 1 },
      1: { cellWidth: 60 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' },
      7: { cellWidth: 18 },
    },
    margin: { left: 8, right: 8 },
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.row.section === 'body') {
        const img = images[data.row.index]
        if (img) {
          try {
            doc.addImage(img.data, img.format, data.cell.x + 1, data.cell.y + 1, 30, 20)
          } catch { /* skip si la imagen falla */ }
        }
      }
    },
  })

  doc.save(`${filename}.pdf`)
}

export async function exportListingsPdf(items: Listing[], filename = 'publicaciones') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const images = await Promise.all(
    items.map(l => {
      const url = l.coverImage ?? l.images?.[0]?.url
      return url ? fetchImgData(url) : Promise.resolve(null)
    })
  )

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(...BLUE)
  doc.rect(0, 0, 297, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Nexo.RE — Publicaciones', 10, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${items.length} registros · ${today()}`, 240, 11)
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 20,
    head: [['', 'Nombre', 'Tipo', 'Operación', 'Ciudad', 'Sup. m²', 'Alquiler', 'Venta']],
    body: items.map(l => [
      '',
      l.name,
      PROP_LABELS[l.propertyType] ?? l.propertyType,
      OP_LABELS[l.operationType] ?? l.operationType,
      l.address.city ?? '',
      fmt(l.area),
      l.rentPrice ? `${l.currency ?? 'USD'} ${fmt(l.rentPrice)}` : '—',
      l.salePrice ? `${l.currency ?? 'USD'} ${fmt(l.salePrice)}` : '—',
    ]),
    headStyles:         { fillColor: BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:         { fontSize: 7, textColor: [30, 30, 30], minCellHeight: 22, valign: 'middle' },
    alternateRowStyles: { fillColor: [229, 241, 251] },
    columnStyles: {
      0: { cellWidth: 32, cellPadding: 1 },
      1: { cellWidth: 55 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
      7: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 8, right: 8 },
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.row.section === 'body') {
        const img = images[data.row.index]
        if (img) {
          try {
            doc.addImage(img.data, img.format, data.cell.x + 1, data.cell.y + 1, 30, 20)
          } catch { /* skip */ }
        }
      }
    },
  })

  doc.save(`${filename}.pdf`)
}

// ─── Word ─────────────────────────────────────────────────────────────────────

async function buildPropertySection(p: Property, coverBuf: { data: Uint8Array; format: 'JPEG' | 'PNG' } | null, isLast: boolean) {
  const {
    Paragraph, Table, TableRow, TableCell, TextRun, ImageRun,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, PageBreak,
  } = await import('docx')

  const children: (typeof Paragraph.prototype | typeof Table.prototype)[] = []

  // Nombre
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: p.name, color: BLUE_HEX, bold: true, size: 28 })],
  }))

  // Portada
  if (coverBuf) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new ImageRun({
          type: coverBuf.format === 'PNG' ? 'png' : 'jpg',
          data: coverBuf.data,
          transformation: { width: 480, height: 280 },
        }),
      ],
    }))
  }

  // Tabla de datos
  const fields: [string, string][] = [
    ['Tipo',             PROP_LABELS[p.type] ?? p.type],
    ['Dirección',        p.address.formattedAddress ?? `${p.address.street ?? ''}, ${p.address.city ?? ''}`],
    ['Ciudad',           p.address.city ?? '—'],
    ['Superficie',       `${fmt(p.totalArea)} m²`],
    ['Pisos',            p.floors != null ? String(p.floors) : '—'],
    ['Año construcción', p.yearBuilt != null ? String(p.yearBuilt) : '—'],
    ['Clase',            p.clase ?? '—'],
    ['Alquiler /m²',     p.rentPricePerM2 ? `${p.currency ?? 'USD'} ${fmt(p.rentPricePerM2)}` : '—'],
    ['Precio venta',     p.salePrice      ? `${p.currency ?? 'USD'} ${fmt(p.salePrice)}`      : '—'],
  ]

  const noBorder = { style: BorderStyle.NONE } as const
  const borders  = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

  children.push(new Table({
    width:  { size: 100, type: WidthType.PERCENTAGE },
    rows: fields.map(([label, value], i) => new TableRow({
      children: [
        new TableCell({
          width:   { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5F1FB', type: 'clear' as never },
          borders,
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 18, color: '323130' })],
          })],
        }),
        new TableCell({
          width:   { size: 72, type: WidthType.PERCENTAGE },
          shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F8F8F8', type: 'clear' as never },
          borders,
          children: [new Paragraph({
            children: [new TextRun({ text: value, size: 18 })],
          })],
        }),
      ],
    })),
  }))

  // Descripción
  if (p.description) {
    children.push(new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: p.description, size: 18, color: '605e5c' })],
    }))
  }

  // Salto de página (excepto el último)
  if (!isLast) {
    children.push(new Paragraph({
      children: [new PageBreak()],
    }))
  }

  return children
}

export async function exportPropertiesDocx(items: Property[], filename = 'inmuebles') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  // Prefetch cover images en paralelo
  const buffers = await Promise.all(
    items.map(p => {
      const url = p.coverImage ?? p.images?.[0]?.url
      return url ? fetchImgData(url) : Promise.resolve(null)
    })
  )

  const sections: (typeof Paragraph.prototype)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({ text: 'Nexo.RE — Inmuebles', color: BLUE_HEX, bold: true, size: 36 })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [new TextRun({ text: `${items.length} registros · ${today()}`, color: '605e5c', size: 18 })],
    }),
  ]

  for (let i = 0; i < items.length; i++) {
    const propertySections = await buildPropertySection(items[i], buffers[i], i === items.length - 1)
    sections.push(...propertySections as never[])
  }

  const doc  = new Document({ sections: [{ children: sections as never[] }] })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

async function buildListingSection(l: Listing, coverBuf: { data: Uint8Array; format: 'JPEG' | 'PNG' } | null, isLast: boolean) {
  const {
    Paragraph, Table, TableRow, TableCell, TextRun, ImageRun,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, PageBreak,
  } = await import('docx')

  const children: (typeof Paragraph.prototype | typeof Table.prototype)[] = []

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: l.name, color: BLUE_HEX, bold: true, size: 28 })],
  }))

  if (coverBuf) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new ImageRun({
          type: coverBuf.format === 'PNG' ? 'png' : 'jpg',
          data: coverBuf.data,
          transformation: { width: 480, height: 280 },
        }),
      ],
    }))
  }

  const fields: [string, string][] = [
    ['Tipo',       PROP_LABELS[l.propertyType] ?? l.propertyType],
    ['Operación',  OP_LABELS[l.operationType] ?? l.operationType],
    ['Dirección',  l.address.formattedAddress ?? `${l.address.street ?? ''}, ${l.address.city ?? ''}`],
    ['Ciudad',     l.address.city ?? '—'],
    ['Superficie', `${fmt(l.area)} m²`],
    ['Piso',       l.floor ?? '—'],
    ['Alquiler',   l.rentPrice ? `${l.currency ?? 'USD'} ${fmt(l.rentPrice)}` : '—'],
    ['Venta',      l.salePrice ? `${l.currency ?? 'USD'} ${fmt(l.salePrice)}` : '—'],
  ]

  const noBorder = { style: BorderStyle.NONE } as const
  const borders  = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows:  fields.map(([label, value], i) => new TableRow({
      children: [
        new TableCell({
          width:   { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5F1FB', type: 'clear' as never },
          borders,
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: '323130' })] })],
        }),
        new TableCell({
          width:   { size: 72, type: WidthType.PERCENTAGE },
          shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F8F8F8', type: 'clear' as never },
          borders,
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 18 })] })],
        }),
      ],
    })),
  }))

  if (l.description) {
    children.push(new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: l.description, size: 18, color: '605e5c' })],
    }))
  }

  if (!isLast) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
  }

  return children
}

export async function exportListingsDocx(items: Listing[], filename = 'publicaciones') {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  const buffers = await Promise.all(
    items.map(l => {
      const url = l.coverImage ?? l.images?.[0]?.url
      return url ? fetchImgData(url) : Promise.resolve(null)
    })
  )

  const sections: (typeof Paragraph.prototype)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 100 },
      children: [new TextRun({ text: 'Nexo.RE — Publicaciones', color: BLUE_HEX, bold: true, size: 36 })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [new TextRun({ text: `${items.length} registros · ${today()}`, color: '605e5c', size: 18 })],
    }),
  ]

  for (let i = 0; i < items.length; i++) {
    const listingSections = await buildListingSection(items[i], buffers[i], i === items.length - 1)
    sections.push(...listingSections as never[])
  }

  const doc  = new Document({ sections: [{ children: sections as never[] }] })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
