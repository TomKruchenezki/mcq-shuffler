import type { PdfRect, CanvasRect, LabelBox } from './visualTypes'

const RENDER_SCALE = 2.0

/**
 * Converts a rectangle from PDF user-space coordinates to canvas pixel coordinates.
 *
 * PDF convention: origin at bottom-left, Y increases UP.
 * Canvas convention: origin at top-left, Y increases DOWN.
 *
 * pdfRect.y is the BOTTOM edge in PDF space.
 * The top edge in PDF space is (pdfRect.y + pdfRect.height).
 * Inverting: canvasY = (pageHeightPdf - (pdfRect.y + pdfRect.height)) * scale
 */
export function pdfRectToCanvasRect(
  pdfRect: PdfRect,
  pageHeightPdf: number,
  scale = RENDER_SCALE,
): CanvasRect {
  const x = pdfRect.x * scale
  const y = (pageHeightPdf - pdfRect.y - pdfRect.height) * scale
  const w = pdfRect.width * scale
  const h = pdfRect.height * scale
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(1, w),
    height: Math.max(1, h),
  }
}

/**
 * Converts a LabelBox to canvas coordinates, adding padding for the white-fill.
 */
export function labelBoxToCanvasRect(
  box: LabelBox,
  pageHeightPdf: number,
  scale = RENDER_SCALE,
): CanvasRect {
  return pdfRectToCanvasRect(box.pdfRect, pageHeightPdf, scale)
}

/**
 * Crops a sub-region of a canvas to a PNG data URL, optionally white-filling
 * specified areas (e.g. to remove original option labels before shuffle).
 */
export function cropPageRegion(
  canvas: HTMLCanvasElement,
  canvasRect: CanvasRect,
  labelsToWhiteFill: CanvasRect[],
): string {
  const w = Math.max(1, Math.ceil(Math.min(canvasRect.width, canvas.width - canvasRect.x)))
  const h = Math.max(1, Math.ceil(Math.min(canvasRect.height, canvas.height - canvasRect.y)))
  const cx = Math.max(0, Math.floor(canvasRect.x))
  const cy = Math.max(0, Math.floor(canvasRect.y))

  const crop = document.createElement('canvas')
  crop.width = w
  crop.height = h
  const ctx = crop.getContext('2d')
  if (!ctx) return 'data:,'

  // Copy the sub-region from the source canvas
  ctx.drawImage(canvas, cx, cy, w, h, 0, 0, w, h)

  // White-fill each label box (translated to local coordinates)
  for (const labelRect of labelsToWhiteFill) {
    const lx = Math.floor(labelRect.x - cx)
    const ly = Math.floor(labelRect.y - cy)
    const lw = Math.ceil(labelRect.width)
    const lh = Math.ceil(labelRect.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(lx, ly, lw, lh)
  }

  return crop.toDataURL('image/png')
}
