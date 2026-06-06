import { describe, it, expect } from 'vitest'
import { reconstructPageText, type PdfTextItem } from '@/lib/extract/pdfLines'

function item(str: string, x: number, y: number, w: number, h = 10, dir = 'ltr'): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: w, height: h, dir }
}

describe('reconstructPageText', () => {
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

  it('inserts a space between LTR items when there is a visible gap', () => {
    // prev right edge = 100 + 30 = 130; curr left edge = 140 → gap = 10 > threshold(2.5)
    const result = reconstructPageText([
      item('foo', 100, 700, 30),
      item('bar', 140, 700, 30),
    ])
    expect(result).toBe('foo bar')
  })

  it('does not insert a space when items overlap in LTR mode', () => {
    // curr left (125) < prev right (130) → gap negative
    const result = reconstructPageText([
      item('foo', 100, 700, 30),
      item('bar', 125, 700, 30),
    ])
    expect(result).toBe('foobar')
  })

  it('sorts two LTR items by x ascending within a line', () => {
    // item B has smaller x than item A — it should come first after ascending sort
    // items are touching (B right edge 120 = A left edge 120) so no space is inserted,
    // making the expected order unambiguous
    const result = reconstructPageText([
      item('A', 120, 700, 20), // higher x, second in reading order
      item('B', 100, 700, 20), // lower x, first in reading order
    ])
    expect(result).toBe('BA')
  })

  it('sorts two RTL items by x descending within a line', () => {
    // In RTL (Hebrew) the rightmost item is read first
    const result = reconstructPageText([
      item('שניה', 100, 700, 40, 12, 'rtl'), // lower x → comes second in RTL sort
      item('ראשון', 300, 700, 50, 12, 'rtl'), // higher x → comes first in RTL sort
    ])
    expect(result.startsWith('ראשון')).toBe(true)
    expect(result).toContain('שניה')
  })

  it('inserts a space between RTL items when there is a visible gap', () => {
    // RTL: prev at x=500 width=40 → left edge=460; curr at x=450 → gap = 460-450 = 10 > threshold
    const result = reconstructPageText([
      item('שאלה', 500, 700, 40, 12, 'rtl'),
      item('מספר', 450, 700, 35, 12, 'rtl'),
    ])
    expect(result).toBe('שאלה מספר')
  })

  it('does not insert a space between RTL items that are touching', () => {
    // RTL: prev left edge = 500-40=460; curr right edge = 460 → gap = 0
    const result = reconstructPageText([
      item('אב', 500, 700, 40, 12, 'rtl'),
      item('גד', 460, 700, 40, 12, 'rtl'),
    ])
    expect(result).toBe('אבגד')
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
      item('bottom', 100, 600, 50), // lower y on page = bottom
      item('top', 100, 700, 30),    // higher y on page = top
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

  it('uses RTL sort when majority of items in a line are RTL', () => {
    // 2 RTL, 1 LTR → RTL sort
    const result = reconstructPageText([
      item('1', 100, 700, 15, 12, 'ltr'),    // ltr item at x=100
      item('מספר', 300, 700, 40, 12, 'rtl'), // rtl item at x=300
      item('שאלה', 500, 700, 50, 12, 'rtl'), // rtl item at x=500
    ])
    // Sorted by x desc: שאלה(500), מספר(300), 1(100)
    expect(result.indexOf('שאלה')).toBeLessThan(result.indexOf('מספר'))
    expect(result.indexOf('מספר')).toBeLessThan(result.indexOf('1'))
  })

  it('returns trimmed line even if leading/trailing spaces exist in items', () => {
    const result = reconstructPageText([item(' hello ', 100, 700, 40)])
    expect(result).toBe('hello')
  })
})
