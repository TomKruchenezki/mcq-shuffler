import { describe, it, expect } from 'vitest'
import { validateVisualResult } from '@/lib/extract/validateVisualResult'
import type { VisualQuestion } from '@/lib/extract/pdfEngine/visualTypes'

function makeQ(stemLen: number, optionCount: number): VisualQuestion {
  return {
    number: 1,
    stemDataUrl: 'x'.repeat(stemLen),
    options: Array.from({ length: optionCount }, (_, i) => ({
      originalIndex: i,
      isOriginalCorrectAnswer: i === 0,
      dataUrl: 'data:image/png;base64,abc',
      labelBox: {
        pdfRect: { x: 50, y: 100, width: 20, height: 12 },
        labelChar: String(i + 1),
      },
      approximateText: String(i + 1),
    })),
    pageIndex: 0,
  }
}

describe('validateVisualResult', () => {
  it('rejects empty array', () => {
    const r = validateVisualResult([])
    expect(r.ok).toBe(false)
    expect(r.reason).toBeTruthy()
  })

  it('rejects when majority have < 2 options', () => {
    // 3 out of 4 have 0 options → majority fail
    const qs = [makeQ(200, 0), makeQ(200, 0), makeQ(200, 0), makeQ(200, 4)]
    const r = validateVisualResult(qs)
    expect(r.ok).toBe(false)
  })

  it('rejects when majority have empty stemDataUrl', () => {
    // 3 out of 4 have stem < 100 chars → majority fail
    const qs = [makeQ(5, 4), makeQ(5, 4), makeQ(5, 4), makeQ(200, 4)]
    const r = validateVisualResult(qs)
    expect(r.ok).toBe(false)
  })

  it('accepts valid questions (≥2 opts, real stemDataUrl)', () => {
    const qs = [makeQ(200, 4), makeQ(300, 4), makeQ(150, 3)]
    const r = validateVisualResult(qs)
    expect(r.ok).toBe(true)
    expect(r.reason).toBeUndefined()
  })

  it('accepts when minority have issues (does not fail on minority)', () => {
    // Only 1 out of 5 has < 2 options — minority, so ok
    const qs = [makeQ(200, 4), makeQ(200, 4), makeQ(200, 4), makeQ(200, 4), makeQ(200, 0)]
    const r = validateVisualResult(qs)
    expect(r.ok).toBe(true)
  })
})
