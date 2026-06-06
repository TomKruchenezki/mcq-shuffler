import { describe, it, expect } from 'vitest'
import { pdfRectToCanvasRect, labelBoxToCanvasRect, cropPageRegion } from '@/lib/extract/pdfEngine/cropPageRegion'
import type { PdfRect, LabelBox } from '@/lib/extract/pdfEngine/visualTypes'

const PAGE_H = 800

function makeCanvas(w = 400, h = 600): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

describe('pdfRectToCanvasRect', () => {
  it('converts X coordinate with scale=2', () => {
    const r: PdfRect = { x: 50, y: 100, width: 200, height: 30 }
    const result = pdfRectToCanvasRect(r, PAGE_H, 2)
    expect(result.x).toBe(100)  // 50 * 2
  })

  it('inverts Y axis: high PDF-Y → low canvas-Y', () => {
    // PDF rect near the top of the page (high Y) → small canvas Y
    const r: PdfRect = { x: 0, y: 750, width: 100, height: 20 }
    const result = pdfRectToCanvasRect(r, PAGE_H, 2)
    // canvasY = (800 - 750 - 20) * 2 = 30 * 2 = 60
    expect(result.y).toBe(60)
  })

  it('negative canvas coords are clamped to 0', () => {
    // PDF rect below page (y < 0)
    const r: PdfRect = { x: -10, y: -5, width: 100, height: 20 }
    const result = pdfRectToCanvasRect(r, PAGE_H, 2)
    expect(result.x).toBe(0)
  })

  it('width and height are scaled by factor', () => {
    const r: PdfRect = { x: 0, y: 100, width: 150, height: 40 }
    const result = pdfRectToCanvasRect(r, PAGE_H, 2)
    expect(result.width).toBe(300)
    expect(result.height).toBe(80)
  })

  it('minimum size is enforced (1×1)', () => {
    const r: PdfRect = { x: 0, y: 100, width: 0, height: 0 }
    const result = pdfRectToCanvasRect(r, PAGE_H, 2)
    expect(result.width).toBeGreaterThanOrEqual(1)
    expect(result.height).toBeGreaterThanOrEqual(1)
  })
})

describe('labelBoxToCanvasRect', () => {
  it('converts LabelBox pdfRect using page height', () => {
    const box: LabelBox = {
      pdfRect: { x: 20, y: 300, width: 15, height: 12 },
      labelChar: 'א',
    }
    const r = labelBoxToCanvasRect(box, PAGE_H, 2)
    // same as pdfRectToCanvasRect on box.pdfRect
    const expected = pdfRectToCanvasRect(box.pdfRect, PAGE_H, 2)
    expect(r).toEqual(expected)
  })
})

describe('cropPageRegion', () => {
  it('returns a string starting with "data:"', () => {
    const canvas = makeCanvas()
    const rect = { x: 10, y: 10, width: 80, height: 30 }
    const result = cropPageRegion(canvas, rect, [])
    expect(result).toMatch(/^data:/)
  })

  it('does not throw when labelsToWhiteFill is empty', () => {
    const canvas = makeCanvas()
    const rect = { x: 0, y: 0, width: 100, height: 50 }
    expect(() => cropPageRegion(canvas, rect, [])).not.toThrow()
  })

  it('does not throw when labelsToWhiteFill has entries', () => {
    const canvas = makeCanvas()
    const rect = { x: 0, y: 0, width: 200, height: 80 }
    const label = { x: 10, y: 10, width: 20, height: 12 }
    expect(() => cropPageRegion(canvas, rect, [label])).not.toThrow()
  })

  it('handles rect larger than canvas without throwing', () => {
    const canvas = makeCanvas(100, 100)
    const rect = { x: 90, y: 90, width: 200, height: 200 }
    expect(() => cropPageRegion(canvas, rect, [])).not.toThrow()
  })
})
