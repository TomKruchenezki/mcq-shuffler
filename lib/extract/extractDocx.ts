export interface ExtractionResult {
  text: string
  error?: string
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<ExtractionResult> {
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
