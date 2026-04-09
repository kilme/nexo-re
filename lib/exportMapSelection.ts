import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, HeadingLevel, AlignmentType, BorderStyle, WidthType, PageBreak } from 'docx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface SelectionPin {
  id:          string
  kind:        'property' | 'listing'
  title:       string
  subtitle:    string
  lat:         number
  lng:         number
  coverImage?: string
}

const KIND_LABEL: Record<string, string> = {
  property: 'Inmueble',
  listing:  'Publicación',
}

const HEADER_COLOR: [number, number, number] = [0, 120, 212]
const HEADER_HEX = '0078D4'
const fmtCoord   = (n: number) => n.toFixed(6)
const label      = () => new Date().toISOString().slice(0, 10)

// ── Image utilities ───────────────────────────────────────────────────────────

const proxied = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`

async function fetchImgData(url: string): Promise<{ data: Uint8Array; format: 'JPEG' | 'PNG' } | null> {
  try {
    const res    = await fetch(proxied(url))
    const ct     = res.headers.get('content-type') ?? ''
    const format = ct.includes('png') ? 'PNG' : 'JPEG'
    const buf    = await res.arrayBuffer()
    return { data: new Uint8Array(buf), format }
  } catch { return null }
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export async function exportSelectionXlsx(pins: SelectionPin[]) {
  const XLSX = await import('xlsx')
  const rows = pins.map(p => ({
    'Tipo':          KIND_LABEL[p.kind] ?? p.kind,
    'Nombre':        p.title,
    'Detalle':       p.subtitle,
    'Latitud':       p.lat,
    'Longitud':      p.lng,
    'Portada (URL)': p.coverImage ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 60 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Selección')
  XLSX.writeFile(wb, `seleccion-mapa-${label()}.xlsx`)
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function exportSelectionPdf(pins: SelectionPin[]) {
  const images = await Promise.all(
    pins.map(p => p.coverImage ? fetchImgData(p.coverImage) : Promise.resolve(null))
  )

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(...HEADER_COLOR)
  doc.rect(0, 0, 297, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Nexo.RE — Selección del mapa', 10, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${pins.length} elemento${pins.length !== 1 ? 's' : ''} · ${label()}`, 220, 11)

  autoTable(doc, {
    startY: 20,
    head: [['', 'Tipo', 'Nombre', 'Detalle', 'Lat', 'Lng']],
    body: pins.map(p => [
      '',
      KIND_LABEL[p.kind] ?? p.kind,
      p.title,
      p.subtitle,
      fmtCoord(p.lat),
      fmtCoord(p.lng),
    ]),
    headStyles:         { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:         { fontSize: 7, textColor: [30, 30, 30], minCellHeight: 22, valign: 'middle' },
    alternateRowStyles: { fillColor: [229, 241, 251] },
    columnStyles: {
      0: { cellWidth: 32, cellPadding: 1 },
      1: { cellWidth: 22 },
      2: { cellWidth: 65 },
      3: { cellWidth: 95 },
      4: { cellWidth: 26 },
      5: { cellWidth: 26 },
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

  doc.save(`seleccion-mapa-${label()}.pdf`)
}

// ── Word ──────────────────────────────────────────────────────────────────────

export async function exportSelectionDocx(pins: SelectionPin[]) {
  const buffers = await Promise.all(
    pins.map(p => p.coverImage ? fetchImgData(p.coverImage) : Promise.resolve(null))
  )

  const noBorder = { style: BorderStyle.NONE } as const
  const borders  = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading:  HeadingLevel.HEADING_1,
      spacing:  { after: 100 },
      children: [new TextRun({ text: 'Nexo.RE — Selección del mapa', color: HEADER_HEX, bold: true, size: 36 })],
    }),
    new Paragraph({
      spacing:  { after: 400 },
      children: [new TextRun({
        text:  `${pins.length} elemento${pins.length !== 1 ? 's' : ''} · ${label()}`,
        color: '64748b', size: 18,
      })],
    }),
  ]

  for (let i = 0; i < pins.length; i++) {
    const p   = pins[i]
    const buf = buffers[i]

    // Nombre + tipo
    children.push(new Paragraph({
      heading:  HeadingLevel.HEADING_2,
      spacing:  { before: 200, after: 80 },
      children: [new TextRun({ text: p.title, color: HEADER_HEX, bold: true, size: 26 })],
    }))

    children.push(new Paragraph({
      spacing:  { after: 100 },
      children: [new TextRun({ text: `${KIND_LABEL[p.kind]} · ${p.subtitle}`, size: 18, color: '605e5c' })],
    }))

    // Portada
    if (buf) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing:   { after: 150 },
        children:  [
          new ImageRun({
            type:           buf.format === 'PNG' ? 'png' : 'jpg',
            data:           buf.data,
            transformation: { width: 480, height: 280 },
          }),
        ],
      }))
    }

    // Coordenadas
    const fields: [string, string][] = [
      ['Tipo',      KIND_LABEL[p.kind]],
      ['Detalle',   p.subtitle],
      ['Latitud',   fmtCoord(p.lat)],
      ['Longitud',  fmtCoord(p.lng)],
    ]

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows:  fields.map(([key, value], idx) => new TableRow({
        children: [
          new TableCell({
            width:   { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: 'E5F1FB', type: 'clear' as never },
            borders,
            children: [new Paragraph({ children: [new TextRun({ text: key, bold: true, size: 18, color: '323130' })] })],
          }),
          new TableCell({
            width:   { size: 72, type: WidthType.PERCENTAGE },
            shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8F8F8', type: 'clear' as never },
            borders,
            children: [new Paragraph({ children: [new TextRun({ text: value, size: 18 })] })],
          }),
        ],
      })),
    }))

    // Salto de página entre elementos
    if (i < pins.length - 1) {
      children.push(new Paragraph({ spacing: { before: 200 }, children: [new PageBreak()] }))
    }
  }

  const doc  = new Document({ sections: [{ children: children as never[] }] })
  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `seleccion-mapa-${label()}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
