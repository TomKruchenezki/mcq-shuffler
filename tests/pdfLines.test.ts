import { describe, it, expect } from 'vitest'
import { reconstructPageText } from '@/lib/extract/pdfLines'
import type { PdfTextItem } from '@/lib/extract/pdfLines'

function item(str: string, x: number, y: number, w: number, h = 10, dir = 'ltr'): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: w, height: h, dir }
}

describe('reconstructPageText — basic', () => {
  it('returns empty string for empty item list', () => {
    expect(reconstructPageText([])).toBe('')
  })

  it('returns the item string for a single non-empty item', () => {
    expect(reconstructPageText([item('שלום', 100, 700, 30)])).toBe('שלום')
  })

  it('ignores items with whitespace-only str', () => {
    const result = reconstructPageText([
      item('  ', 100, 700, 10),
      item('text', 200, 700, 30),
    ])
    expect(result).toBe('text')
  })

  it('joins two LTR items on the same y without a space when they are touching', () => {
    // prev right edge = 100 + 30 = 130; curr left edge = 130 → gap = 0 ≤ threshold
    const result = reconstructPageText([
      item('foo', 100, 700, 30),
      item('bar', 130, 700, 30),
    ])
    expect(result).toBe('foobar')
  })

  it('does not insert a space when items overlap in LTR mode', () => {
    // gap is negative → no space
    const result = reconstructPageText([
      item('foo', 100, 700, 30),
      item('bar', 125, 700, 30),
    ])
    expect(result).toBe('foobar')
  })

  it('places items on separate lines when y values differ beyond tolerance', () => {
    const result = reconstructPageText([
      item('line1', 100, 700, 40),
      item('line2', 100, 685, 40), // y differs by 15 > Y_TOLERANCE(3)
    ])
    expect(result).toBe('line1\nline2')
  })

  it('sorts lines top-to-bottom (higher y first)', () => {
    const result = reconstructPageText([
      item('bottom', 100, 600, 50),
      item('top', 100, 700, 30),
    ])
    expect(result.indexOf('top')).toBeLessThan(result.indexOf('bottom'))
  })

  it('groups items within Y_TOLERANCE onto the same line', () => {
    // Items at y=700 and y=702 should merge (|702-700| = 2 ≤ 3)
    const result = reconstructPageText([
      item('A', 100, 700, 20),
      item('B', 150, 702, 20),
    ])
    expect(result.split('\n').length).toBe(1)
  })

  it('sorts LTR items by x ascending within a line', () => {
    const result = reconstructPageText([
      item('B', 120, 700, 20),
      item('A', 100, 700, 20), // lower x → comes first
    ])
    expect(result.startsWith('A')).toBe(true)
  })

  it('sorts RTL items by x descending within a line', () => {
    const result = reconstructPageText([
      item('second', 100, 700, 40, 12, 'rtl'),
      item('first', 300, 700, 50, 12, 'rtl'),
    ])
    expect(result.indexOf('first')).toBeLessThan(result.indexOf('second'))
  })

  it('inserts a space between RTL items with a large gap', () => {
    // prev: x=500, w=40 → left edge 460; curr: x=450 → gap = 460-450 = 10 > threshold
    const result = reconstructPageText([
      item('שאלה', 500, 700, 40, 12, 'rtl'),
      item('מספר', 450, 700, 35, 12, 'rtl'),
    ])
    expect(result).toBe('שאלה מספר')
  })

  it('does not insert a space between RTL items that are touching (gap = 0)', () => {
    // prev left edge = 500-40=460; curr x = 460 → gap = 0
    const result = reconstructPageText([
      item('אב', 500, 700, 40, 12, 'rtl'),
      item('גד', 460, 700, 40, 12, 'rtl'),
    ])
    expect(result).toBe('אבגד')
  })
})

describe('SPACE_THRESHOLD_FACTOR = 0.35 (increased from 0.25)', () => {
  it('inserts space between LTR items when gap > 35% of font height', () => {
    // Font height = 10; threshold = 10 × 0.35 = 3.5
    // item1 ends at x=100+30=130; item2 starts at x=135 → gap = 5 > 3.5 → space
    const result = reconstructPageText([
      item('hello', 100, 700, 30, 10),
      item('world', 135, 700, 30, 10),
    ])
    expect(result).toBe('hello world')
  })

  it('does NOT insert space when gap is below 35% threshold', () => {
    // Font height = 10; threshold = 3.5
    // item1 ends at 130; item2 starts at 133 → gap = 3 < 3.5 → no space
    const result = reconstructPageText([
      item('hello', 100, 700, 30, 10),
      item('world', 133, 700, 30, 10),
    ])
    expect(result).toBe('helloworld')
  })

  it('boundary: gap exactly equal to threshold does NOT insert space', () => {
    // gap must be strictly > threshold to insert space
    // Font h=10, threshold=3.5, gap=3 (< threshold) → no space
    const result = reconstructPageText([
      item('A', 50, 700, 20, 10),
      item('B', 73, 700, 20, 10), // gap = 73 - (50+20) = 3
    ])
    expect(result).toBe('AB')
  })

  it('gap just above threshold inserts space', () => {
    // gap = 4 > 3.5 → space inserted
    const result = reconstructPageText([
      item('A', 50, 700, 20, 10),
      item('B', 74, 700, 20, 10), // gap = 74 - (50+20) = 4
    ])
    expect(result).toBe('A B')
  })

  it('with font-height 12, space threshold is 4.2 (not 3.0 from old 0.25 factor)', () => {
    // Old threshold would be 12 × 0.25 = 3.0; new is 12 × 0.35 = 4.2
    // gap = 3.5 → OLD: 3.5 > 3.0 → space; NEW: 3.5 < 4.2 → NO space
    const result = reconstructPageText([
      item('X', 100, 700, 30, 12),
      item('Y', 133, 700, 30, 12), // gap = 133 - 130 = 3.5
    ])
    // With new threshold (4.2), 3.5 < 4.2 → no space
    expect(result).toBe('XY')
  })
})
