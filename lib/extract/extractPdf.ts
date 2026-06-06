import type { TextItem } from 'pdfjs-dist/types/src/display/api'

export interface PdfExtractionResult {
  text: string
  warning?: string
  error?: string
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
    const pageTexts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join('')
        .trim()
      if (pageText) pageTexts.push(pageText)
    }
    const text = pageTexts.join('\n\n')
    const warning =
      text.trim().length < SCANNED_THRESHOLD
        ? 'נראה שה-PDF סרוק או שהטקסט לא חולץ טוב. מומלץ להשתמש בקובץ Word אם אפשר.'
        : undefined
    return { text, warning }
  } catch {
    return { text: '', error: 'לא ניתן לחלץ טקסט מקובץ PDF. ייתכן שהקובץ פגום.' }
  }
}
