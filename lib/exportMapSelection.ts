import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType } from 'docx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface SelectionPin {
  id: string
  kind: 'property' | 'listing'
  title: string
  subtitle: string
  lat: number
  lng: number
}

const KIND_LABEL: Record<string, string> = {
  property: 'Inmueble',
  listing:  'Publicación',
}

const HEADER_COLOR: [number, number, number] = [0, 120, 212]
const HEADER_HEX = '0078D4'
const fmt = (n: number) => n.toFixed(6)
const label = () => new Date().toISOString().slice(0, 10)

// ── Excel ─────────────────────────────────────────────────────────────────────

export async function exportSelectionXlsx(pins: SelectionPin[]) {
  const XLSX = await import('xlsx')
  const rows = pins.map(p => ({
    'Tipo':     KIND_LABEL[p.kind] ?? p.kind,
    'Nombre':   p.title,
    'Detalle':  p.subtitle,
    'Latitud':  p.lat,
    'Longitud': p.lng,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Selección')
  XLSX.writeFile(wb, `seleccion-mapa-${label()}.xlsx`)
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function exportSelectionPdf(pins: SelectionPin[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFillColor(...HEADER_COLOR)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Nexo.RE — Selección del mapa', 10, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${pins.length} elemento${pins.length !== 1 ? 's' : ''} · ${label()}`, 210, 12)

  autoTable(doc, {
    startY: 22,
    head: [['Tipo', 'Nombre', 'Detalle', 'Latitud', 'Longitud']],
    body: pins.map(p => [
      KIND_LABEL[p.kind] ?? p.kind,
      p.title,
      p.subtitle,
      fmt(p.lat),
      fmt(p.lng),
    ]),
    headStyles: { fillColor: HEADER_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [229, 241, 251] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 70 },
      2: { cellWidth: 100 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
    },
    margin: { left: 10, right: 10 },
  })

  doc.save(`seleccion-mapa-${label()}.pdf`)
}

// ── Word ──────────────────────────────────────────────────────────────────────

export async function exportSelectionDocx(pins: SelectionPin[]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Tipo', 'Nombre', 'Detalle', 'Latitud', 'Longitud'].map(text =>
      new TableCell({
        shading: { fill: HEADER_HEX, type: 'clear' as never },
        children: [new Paragraph({
          children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 18 })],
          alignment: AlignmentType.CENTER,
        })],
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        },
      })
    ),
  })

  const dataRows = pins.map((p, i) =>
    new TableRow({
      children: [
        KIND_LABEL[p.kind] ?? p.kind,
        p.title,
        p.subtitle,
        fmt(p.lat),
        fmt(p.lng),
      ].map(text =>
        new TableCell({
          shading: { fill: i % 2 === 0 ? 'E5F1FB' : 'FFFFFF', type: 'clear' as never },
          children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 18 })] })],
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
        })
      ),
    })
  )

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'Nexo.RE — Selección del mapa', color: HEADER_HEX, bold: true })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `${pins.length} elemento${pins.length !== 1 ? 's' : ''} · ${label()}`, color: '64748b', size: 18 })],
        }),
        new Paragraph({ children: [] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seleccion-mapa-${label()}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
