import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import { normalizePdfText } from '../pdfNormalize'
import { computeQuality } from '../extractPdf'
import type { PdfExtractionResult } from '../extractPdf'
import { renderPdfPage } from './renderPdfPage'
import { ocrPdfPage } from './ocrPdfPage'
import type { OnProgress } from './types'

const LARGE_PDF_THRESHOLD = 10

export async function extractPdfOcr(
  pdf: PDFDocumentProxy,
  onProgress?: OnProgress,
): Promise<PdfExtractionResult> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['heb', 'eng'])

  try {
    const rawPages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages)
      const page = await pdf.getPage(i)
      const canvas = await renderPdfPage(page)
      const pageText = await ocrPdfPage(worker, canvas)
      rawPages.push(pageText)
    }

    const normalizedPages = normalizePdfText(rawPages)
    const text = normalizedPages.join('\n\n').trim()
    const totalItems = text.split(/\s+/).filter(w => w.length > 0).length
    const quality = computeQuality({ pages: pdf.numPages, totalItems, text })

    let warning: string | undefined
    if (pdf.numPages > LARGE_PDF_THRESHOLD) {
      warning = `מסמך זה מכיל ${pdf.numPages} עמודים. OCR עשוי לקחת מספר דקות.`
    }

    return { text, quality, warning }
  } finally {
    await worker.terminate()
  }
}
