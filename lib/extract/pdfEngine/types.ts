export type PdfMode = 'auto' | 'fast' | 'ocr'
export type OnProgress = (page: number, total: number, percent?: number) => void
