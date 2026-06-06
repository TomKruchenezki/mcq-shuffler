export type PdfMode = 'auto' | 'fast' | 'ocr' | 'visual'
export type OnProgress = (page: number, total: number, percent?: number) => void
