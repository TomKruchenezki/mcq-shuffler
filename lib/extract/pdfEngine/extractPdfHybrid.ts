import { extractPdfText, extractPdfTextFromProxy } from '../extractPdf'
import type { PdfExtractionResult, PdfExtractionQuality } from '../extractPdf'
import { extractPdfOcr } from './extractPdfOcr'
import type { PdfMode, OnProgress } from './types'

export type { PdfMode, OnProgress }

export function isNativeQualityPoor(quality: PdfExtractionQuality): boolean {
  return (
    quality.chars < 100 ||
    quality.suspiciousJoinedWords > 5 ||
    !quality.hasEnoughLineBreaks ||
    (quality.detectedQuestionMarkers === 0 && quality.chars > 200)
  )
}

export async function extractPdfHybrid(
  buffer: ArrayBuffer,
  mode: PdfMode,
  onProgress?: OnProgress,
): Promise<PdfExtractionResult> {
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

    // mode === 'auto': try native first, fall back to OCR on poor quality
    const nativeResult = await extractPdfTextFromProxy(pdf)
    if (nativeResult.quality && !isNativeQualityPoor(nativeResult.quality)) {
      return nativeResult
    }
    return extractPdfOcr(pdf, onProgress)
  } catch {
    return { text: '', error: 'לא ניתן לחלץ טקסט מקובץ PDF. ייתכן שהקובץ פגום.' }
  }
}
