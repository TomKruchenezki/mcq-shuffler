import { extractPdfText, extractPdfTextFromProxy } from '../extractPdf'
import type { PdfExtractionResult, PdfExtractionQuality } from '../extractPdf'
import { extractPdfOcr } from './extractPdfOcr'
import type { PdfMode, OnProgress } from './types'
import type { ComplexityFlags } from './visualTypes'
import type { PdfTextItem } from '../pdfLines'

export type { PdfMode, OnProgress }

export function isNativeQualityPoor(quality: PdfExtractionQuality): boolean {
  return (
    quality.chars < 100 ||
    quality.suspiciousJoinedWords > 5 ||
    !quality.hasEnoughLineBreaks ||
    (quality.detectedQuestionMarkers === 0 && quality.chars > 200)
  )
}

const FORMULA_RE = /[∫∑√±×÷≤≥αβγδπΩ²³⁴⁵]/

async function detectComplexity(pdf: {
  numPages: number
  getPage(n: number): Promise<{
    getOperatorList(): Promise<{ fnArray: number[] }>
    getTextContent(): Promise<{ items: unknown[] }>
    getViewport(opts: { scale: number }): { width: number; height: number }
  }>
}): Promise<ComplexityFlags | null> {
  const pagesToCheck = Math.min(3, pdf.numPages)
  let hasImages = false
  let hasTables = false
  let hasMultiColumnText = false
  let hasFormulas = false

  for (let i = 1; i <= pagesToCheck; i++) {
    try {
      const page = await pdf.getPage(i)
      if (!page) continue  // defensive: skip if page is unavailable

      try {
        const ops = await page.getOperatorList()
        // pdfjs OPS.paintJpegXObject=82, paintXObjectLike=83 — raster images
        hasImages = hasImages || ops.fnArray.some(fn => fn === 82 || fn === 83)
      } catch {
        // getOperatorList may fail on some PDFs — skip image detection for this page
      }

      const content = await page.getTextContent()
      const items = (content.items as unknown[]).filter(
        (it): it is PdfTextItem => typeof it === 'object' && it !== null && 'str' in it,
      ) as PdfTextItem[]

      if (items.some(it => FORMULA_RE.test(it.str))) hasFormulas = true

      const xs = items.map(it => it.transform[4] ?? 0)
      if (xs.length > 10) {
        const sorted = [...xs].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const pageWidth = page.getViewport({ scale: 1 }).width

        if (sorted[mid] - sorted[mid - 1] > pageWidth * 0.4) hasMultiColumnText = true

        const uniqueXBuckets = new Set(xs.map(x => Math.round(x / 10) * 10))
        if (uniqueXBuckets.size >= 3 && items.length > 20) hasTables = true
      }
    } catch {
      continue  // skip page on any unexpected error
    }
  }

  if (!hasImages && !hasTables && !hasMultiColumnText && !hasFormulas) return null
  return { hasImages, hasTables, hasMultiColumnText, hasFormulas }
}

export async function extractPdfHybrid(
  buffer: ArrayBuffer,
  mode: PdfMode,
  onProgress?: OnProgress,
): Promise<PdfExtractionResult> {
  // 'visual' mode is handled directly by FileUpload via extractPdfVisual.
  // Return an empty stub so the text pipeline gets an empty string gracefully.
  if (mode === 'visual') {
    return { text: '' }
  }

  if (mode === 'fast') {
    return extractPdfText(buffer)
  }

  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()
    }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise

    if (mode === 'ocr') {
      return extractPdfOcr(pdf, onProgress)
    }

    // mode === 'auto': try native first, detect complexity, fall back to OCR on poor quality
    const nativeResult = await extractPdfTextFromProxy(pdf)

    const complexity = await detectComplexity(pdf)
    if (complexity) nativeResult.complexity = complexity

    if (nativeResult.quality && !isNativeQualityPoor(nativeResult.quality)) {
      return nativeResult
    }
    return extractPdfOcr(pdf, onProgress)
  } catch {
    return { text: '', error: 'לא ניתן לחלץ טקסט מקובץ PDF. ייתכן שהקובץ פגום.' }
  }
}
