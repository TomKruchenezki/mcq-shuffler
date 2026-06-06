import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

const RENDER_SCALE = 2.0

export async function renderPdfPage(
  page: PDFPageProxy,
  scale = RENDER_SCALE,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}
