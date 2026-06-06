/**
 * High-fidelity visual PDF extraction.
 *
 * Known limitations:
 * 1. Cross-page questions: detection is per-page. A question spanning page N→N+1
 *    produces a partial stem on page N with no options, and orphaned options on page N+1.
 * 2. Multi-column layouts: region detection assumes single-column text flow.
 * 3. Scanned PDFs: requires a pdfjs text layer. Fully scanned PDFs (no text items)
 *    return a warning. Use OCR mode instead.
 * 4. White-fill accuracy: label white-fill uses the TextItem bounding box. Increase
 *    LABEL_PAD_PDF from 4.0 to 6.0 if residual label outlines are observed.
 * 5. DOCX export is not supported — use browser Print → PDF for visual questions.
 */

import type { PdfTextItem } from '../pdfLines'
import { reconstructPageText } from '../pdfLines'
import { renderPdfPage } from './renderPdfPage'
import { detectQuestionRegions } from './detectQuestionRegions'
import { pdfRectToCanvasRect, labelBoxToCanvasRect, cropPageRegion } from './cropPageRegion'
import type { OnProgress } from './types'
import type {
  VisualExtractionResult,
  VisualQuestion,
  VisualOption,
  PdfRect,
  LabelBox,
} from './visualTypes'

const LABEL_PAD_PDF = 4.0  // extra PDF units of padding around label for white-fill

function buildLabelPdfRect(item: PdfTextItem): PdfRect {
  return {
    x: (item.transform[4] ?? 0) - LABEL_PAD_PDF,
    y: item.transform[5] ?? 0,
    width: Math.abs(item.width) + 2 * LABEL_PAD_PDF,
    height: Math.abs(item.height),
  }
}

export async function extractPdfVisual(
  buffer: ArrayBuffer,
  onProgress?: OnProgress,
): Promise<VisualExtractionResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()
    }

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const allQuestions: VisualQuestion[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages)

      const page = await pdf.getPage(i)

      // Get page dimensions in PDF units (scale=1 gives unscaled dimensions)
      const viewport1 = page.getViewport({ scale: 1 })
      const pageHeightPdf = viewport1.height
      const pageWidthPdf = viewport1.width

      // Render page to canvas at 2× scale
      const canvas = await renderPdfPage(page)

      // Extract text items with coordinates
      const content = await page.getTextContent()
      const items = (content.items as unknown[]).filter(
        (it): it is PdfTextItem => typeof it === 'object' && it !== null && 'str' in it,
      ) as PdfTextItem[]

      // Detect question/option region boundaries from text coordinates
      const regions = detectQuestionRegions(items, pageHeightPdf)

      for (const region of regions) {
        // Crop the question stem
        const stemPdfRect: PdfRect = {
          x: 0,
          y: region.stemYBottom,
          width: pageWidthPdf,
          height: region.stemYTop - region.stemYBottom,
        }
        const stemCanvasRect = pdfRectToCanvasRect(stemPdfRect, pageHeightPdf)
        const stemDataUrl = cropPageRegion(canvas, stemCanvasRect, [])

        // Crop each option
        const options: VisualOption[] = []
        for (let j = 0; j < region.options.length; j++) {
          const opt = region.options[j]

          const optPdfRect: PdfRect = {
            x: 0,
            y: opt.yBottom,
            width: pageWidthPdf,
            height: opt.yTop - opt.yBottom,
          }
          const optCanvasRect = pdfRectToCanvasRect(optPdfRect, pageHeightPdf)

          const labelPdfRect = buildLabelPdfRect(opt.labelItem)
          const labelBox: LabelBox = { pdfRect: labelPdfRect, labelChar: opt.label }
          const labelCanvasRect = labelBoxToCanvasRect(labelBox, pageHeightPdf)

          const dataUrl = cropPageRegion(canvas, optCanvasRect, [labelCanvasRect])
          const approximateText = reconstructPageText(opt.items)

          options.push({
            originalIndex: j,
            isOriginalCorrectAnswer: j === 0,
            dataUrl,
            labelBox,
            approximateText,
          })
        }

        allQuestions.push({
          number: region.questionNumber,
          stemDataUrl,
          options,
          pageIndex: i - 1,
        })
      }
    }

    if (allQuestions.length === 0) {
      return {
        visualQuestions: [],
        warning:
          'לא זוהו שאלות בחילוץ הוויזואלי. ייתכן שה-PDF סרוק ואין שכבת טקסט — נסה מצב OCR מקומי.',
      }
    }

    return { visualQuestions: allQuestions }
  } catch {
    return {
      visualQuestions: [],
      error: 'שגיאה בחילוץ הוויזואלי. ייתכן שהקובץ פגום.',
    }
  }
}
