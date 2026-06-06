import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { reconstructPageText } from './pdfLines'
import { normalizePdfText } from './pdfNormalize'

export interface PdfExtractionQuality {
  pages: number
  textItems: number
  chars: number
  detectedQuestionMarkers: number
  detectedOptionMarkers: number
  suspiciousJoinedWords: number
  hasEnoughLineBreaks: boolean
}

export interface PdfExtractionResult {
  text: string
  warning?: string
  error?: string
  quality?: PdfExtractionQuality
}

// Heuristic: fewer than 100 chars of extracted text likely means a scanned/image PDF
const SCANNED_THRESHOLD = 100

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractionResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString()
    }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise

    const rawPages: string[] = []
    let totalItems = 0

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const items = content.items.filter((item): item is TextItem => 'str' in item)
      totalItems += items.length
      rawPages.push(reconstructPageText(items))
    }

    const normalizedPages = normalizePdfText(rawPages)
    const text = normalizedPages.join('\n\n').trim()
    const quality = computeQuality({ pages: pdf.numPages, totalItems, text })

    let warning: string | undefined
    if (text.trim().length < SCANNED_THRESHOLD) {
      warning = 'נראה שה-PDF סרוק או שהטקסט לא חולץ טוב. מומלץ להשתמש בקובץ Word אם אפשר.'
    } else if (quality.suspiciousJoinedWords > 5 || !quality.hasEnoughLineBreaks) {
      warning = 'נראה שחלוץ הטקסט לא מלא — מומלץ לבדוק את תצוגה המקדימה.'
    }

    return { text, warning, quality }
  } catch {
    return { text: '', error: 'לא ניתן לחלץ טקסט מקובץ PDF. ייתכן שהקובץ פגום.' }
  }
}

function computeQuality(params: {
  pages: number
  totalItems: number
  text: string
}): PdfExtractionQuality {
  const { pages, totalItems, text } = params
  const lines = text.split('\n').filter(l => l.trim().length > 0)

  const questionRe = /^(שאלה|\d+\.\s|\.\d+\b)/
  const optionRe = /^[א-ת][.)]/

  const detectedQuestionMarkers = lines.filter(l => questionRe.test(l.trim())).length
  const detectedOptionMarkers = lines.filter(l => optionRe.test(l.trim())).length

  // Hebrew tokens longer than 20 chars are likely multiple words glued together
  const suspiciousJoinedWords = text
    .split(/\s+/)
    .filter(w => w.length > 20 && /[א-ת]/.test(w)).length

  const hasEnoughLineBreaks = lines.length > Math.max(3, totalItems * 0.05)

  return {
    pages,
    textItems: totalItems,
    chars: text.length,
    detectedQuestionMarkers,
    detectedOptionMarkers,
    suspiciousJoinedWords,
    hasEnoughLineBreaks,
  }
}
