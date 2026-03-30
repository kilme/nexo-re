import type { Property, Listing } from '@/types'

const PROP_LABELS: Record<string, string> = {
  office: 'Oficinas', industrial: 'Industrial', retail: 'Retail / Local',
  business_park: 'Centro Comercial', hotel: 'Hotel', mixed: 'Mixto', land: 'Terreno', other: 'Otro',
}
const OP_LABELS: Record<string, string> = {
  rent: 'Alquiler', sale: 'Venta', rent_sale: 'Alquiler y Venta',
}
const fmt = (n: number) => n.toLocaleString('es-AR')

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function exportPropertiesXlsx(items: Property[], filename = 'inmuebles') {
  const XLSX = await import('xlsx')
  const rows = items.map(p => ({
    'Nombre': p.name,
    'Tipo': PROP_LABELS[p.type] ?? p.type,
    'Dirección': p.address.formattedAddress ?? `${p.address.street}, ${p.address.city}`,
    'Ciudad': p.address.city ?? '',
    'Superficie (m²)': p.totalArea,
    'Pisos': p.floors ?? '',
    'Año construcción': p.yearBuilt ?? '',
    'Alquiler /m²': p.rentPricePerM2 ? `${p.currency ?? 'USD'} ${fmt(p.rentPricePerM2)}` : '',
    'Precio venta total': p.salePrice ? `${p.currency ?? 'USD'} ${fmt(p.salePrice)}` : '',
    'Clase': p.clase ?? '',
    'Estado': p.status === 'active' ? 'Activo' : 'Inactivo',
  }))
  const ws  = XLSX.utils.json_to_sheet(rows)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inmuebles')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportListingsXlsx(items: Listing[], filename = 'publicaciones') {
  const XLSX = await import('xlsx')
  const rows = items.map(l => ({
    'Nombre': l.name,
    'Tipo': PROP_LABELS[l.propertyType] ?? l.propertyType,
    'Operación': OP_LABELS[l.operationType] ?? l.operationType,
    'Dirección': l.address.formattedAddress ?? `${l.address.street}, ${l.address.city}`,
    'Ciudad': l.address.city ?? '',
    'Superficie (m²)': l.area,
    'Piso': l.floor ?? '',
    'Alquiler': l.rentPrice ? `${l.currency ?? 'USD'} ${fmt(l.rentPrice)}` : '',
    'Venta': l.salePrice ? `${l.currency ?? 'USD'} ${fmt(l.salePrice)}` : '',
    'Estado': l.status === 'active' ? 'Activo' : 'Inactivo',
  }))
  const ws  = XLSX.utils.json_to_sheet(rows)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Publicaciones')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportPropertiesPdf(items: Property[], filename = 'inmuebles') {
  const { default: jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ orientation: 'landscape' })
  const blue = [0, 120, 212] as [number, number, number]

  doc.setFillColor(...blue)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text('Nexo.RE — Inmuebles', 10, 12)
  doc.setTextColor(0, 0, 0)

  let y = 28
  const cols = [10, 80, 130, 165, 200, 235]
  const headers = ['Nombre', 'Tipo', 'Ciudad', 'Sup. m²', 'Alq/m²', 'Vta/m²']

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => doc.text(h, cols[i], y))
  doc.setFont('helvetica', 'normal')
  y += 6

  items.forEach(p => {
    if (y > 190) { doc.addPage(); y = 20 }
    doc.setFontSize(7)
    doc.text(p.name.substring(0, 30), cols[0], y)
    doc.text(PROP_LABELS[p.type] ?? p.type, cols[1], y)
    doc.text(p.address.city ?? '', cols[2], y)
    doc.text(String(p.totalArea), cols[3], y)
    doc.text(p.rentPricePerM2 ? fmt(p.rentPricePerM2) : '-', cols[4], y)
    doc.text(p.salePricePerM2 ? fmt(p.salePricePerM2) : '-', cols[5], y)
    y += 7
  })

  doc.save(`${filename}.pdf`)
}

export async function exportListingsPdf(items: Listing[], filename = 'publicaciones') {
  const { default: jsPDF } = await import('jspdf')
  const doc  = new jsPDF({ orientation: 'landscape' })
  const blue = [0, 120, 212] as [number, number, number]

  doc.setFillColor(...blue)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text('Nexo.RE — Publicaciones', 10, 12)
  doc.setTextColor(0, 0, 0)

  let y = 28
  const cols = [10, 75, 120, 155, 185, 220, 255]
  const headers = ['Nombre', 'Tipo', 'Operación', 'Ciudad', 'Sup.', 'Alquiler', 'Venta']

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => doc.text(h, cols[i], y))
  doc.setFont('helvetica', 'normal')
  y += 6

  items.forEach(l => {
    if (y > 190) { doc.addPage(); y = 20 }
    doc.setFontSize(7)
    doc.text(l.name.substring(0, 28), cols[0], y)
    doc.text(PROP_LABELS[l.propertyType] ?? l.propertyType, cols[1], y)
    doc.text(OP_LABELS[l.operationType] ?? l.operationType, cols[2], y)
    doc.text(l.address.city ?? '', cols[3], y)
    doc.text(String(l.area), cols[4], y)
    doc.text(l.rentPrice ? fmt(l.rentPrice) : '-', cols[5], y)
    doc.text(l.salePrice ? fmt(l.salePrice) : '-', cols[6], y)
    y += 7
  })

  doc.save(`${filename}.pdf`)
}

// ─── Word ─────────────────────────────────────────────────────────────────────

export async function exportPropertiesDocx(items: Property[], filename = 'inmuebles') {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, HeadingLevel, WidthType } = await import('docx')

  const headerRow = new TableRow({
    children: ['Nombre','Tipo','Ciudad','Sup. m²','Alq/m²','Vta/m²'].map(h =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
    ),
  })

  const dataRows = items.map(p => new TableRow({
    children: [
      p.name,
      PROP_LABELS[p.type] ?? p.type,
      p.address.city ?? '',
      String(p.totalArea),
      p.rentPricePerM2 ? fmt(p.rentPricePerM2) : '-',
      p.salePrice ? fmt(p.salePrice) : '-',
    ].map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 16 })] })] }))
  }))

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Nexo.RE — Inmuebles', heading: HeadingLevel.HEADING_1 }),
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

export async function exportListingsDocx(items: Listing[], filename = 'publicaciones') {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, HeadingLevel, WidthType } = await import('docx')

  const headerRow = new TableRow({
    children: ['Nombre','Tipo','Operación','Ciudad','Sup.','Alquiler','Venta'].map(h =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
    ),
  })

  const dataRows = items.map(l => new TableRow({
    children: [
      l.name,
      PROP_LABELS[l.propertyType] ?? l.propertyType,
      OP_LABELS[l.operationType] ?? l.operationType,
      l.address.city ?? '',
      String(l.area),
      l.rentPrice ? `${l.currency ?? 'USD'} ${fmt(l.rentPrice)}` : '-',
      l.salePrice ? `${l.currency ?? 'USD'} ${fmt(l.salePrice)}` : '-',
    ].map(text => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 16 })] })] }))
  }))

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Nexo.RE — Publicaciones', heading: HeadingLevel.HEADING_1 }),
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
