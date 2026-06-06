export interface ExtractionResult {
  text: string
  error?: string
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<ExtractionResult> {
  // Primary: numbering-aware XML extraction (reconstructs list markers)
  try {
    const { extractDocxParagraphs } = await import('./parseDocxXml')
    const text = await extractDocxParagraphs(buffer)
    return { text }
  } catch {
    // Fallback: mammoth plain text (no list markers, partial extraction)
    try {
      const mammoth = await import('mammoth')
      const api = (mammoth.default ?? mammoth) as {
        extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
      }
      const result = await api.extractRawText({ arrayBuffer: buffer })
      return { text: result.value }
    } catch {
      return { text: '', error: 'לא ניתן לחלץ טקסט מקובץ Word. ייתכן שהקובץ פגום.' }
    }
  }
}
