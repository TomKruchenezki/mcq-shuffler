import { describe, it, expect } from 'vitest'
import { detectQuestionRegions } from '@/lib/extract/pdfEngine/detectQuestionRegions'
import type { PdfTextItem } from '@/lib/extract/pdfLines'

function item(str: string, x: number, y: number, w = str.length * 6, h = 12): PdfTextItem {
  return {
    str,
    dir: /[א-ת]/.test(str) ? 'rtl' : 'ltr',
    width: w,
    height: h,
    transform: [1, 0, 0, 1, x, y],
    hasEOL: false,
  }
}

const PAGE_H = 800

describe('detectQuestionRegions', () => {
  it('returns [] for empty items', () => {
    expect(detectQuestionRegions([], PAGE_H)).toEqual([])
  })

  it('detects one question with two options', () => {
    // Use single item per line to avoid RTL sort ambiguity in reconstruction
    const items = [
      item('1. שאלה ראשונה', 50, 700),
      item('א. תשובה א', 50, 680),
      item('ב. תשובה ב', 50, 660),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions).toHaveLength(1)
    expect(regions[0].questionNumber).toBe(1)
    expect(regions[0].options).toHaveLength(2)
    expect(regions[0].options[0].label).toBe('א')
    expect(regions[0].options[1].label).toBe('ב')
  })

  it('stemYTop = question marker Y + REGION_PAD', () => {
    const items = [item('1. שאלה', 50, 700), item('א.', 50, 680)]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].stemYTop).toBe(700 + 4)
  })

  it('stemYBottom = first option Y - REGION_PAD', () => {
    const items = [item('1. שאלה', 50, 700), item('א.', 50, 680)]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].stemYBottom).toBe(680 - 4)
  })

  it('option yTop = option marker Y + REGION_PAD', () => {
    const items = [
      item('1. שאלה', 50, 700),
      item('א.', 50, 680),
      item('ב.', 50, 660),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options[0].yTop).toBe(680 + 4)
  })

  it('option yBottom = next marker Y - REGION_PAD', () => {
    const items = [
      item('1. שאלה', 50, 700),
      item('א.', 50, 680),
      item('ב.', 50, 660),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options[0].yBottom).toBe(660 - 4)
  })

  it('last option yBottom = 0 (after padding clamp)', () => {
    const items = [
      item('1. שאלה', 50, 700),
      item('א.', 50, 680),
      item('ב.', 50, 60),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options[1].yBottom).toBe(0)
  })

  it('labelItem.str contains the matched Hebrew letter', () => {
    const items = [
      item('1. שאלה', 50, 700),
      item('א.', 50, 680),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options[0].labelItem.str).toMatch(/א/)
  })

  it('detects RTL-flipped option label at line end', () => {
    // RTL-flipped: label appears at the end as ".א" or ")א"
    const items = [
      item('1. שאלה', 50, 700),
      item('תשובה .א', 50, 680),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options).toHaveLength(1)
    expect(regions[0].options[0].label).toBe('א')
  })

  it('multi-question page produces one region per question', () => {
    const items = [
      item('1. שאלה ראשונה', 50, 700),
      item('א.', 50, 680),
      item('ב.', 50, 660),
      item('2. שאלה שנייה', 50, 620),
      item('א.', 50, 600),
      item('ב.', 50, 580),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions).toHaveLength(2)
    expect(regions[0].questionNumber).toBe(1)
    expect(regions[1].questionNumber).toBe(2)
  })

  it('question without options produces options: []', () => {
    const items = [item('1. שאלה ללא תשובות', 50, 700)]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options).toHaveLength(0)
  })

  it('continuation lines extend option items', () => {
    const extraItem = item('המשך שורה', 50, 670)
    const items = [
      item('1. שאלה', 50, 700),
      item('א.', 50, 680),
      extraItem,
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].options[0].items.length).toBeGreaterThan(1)
  })

  it('REGION_PAD is clamped to pageHeightPdf on stemYTop', () => {
    const items = [
      item('1. שאלה', 50, PAGE_H - 1),  // near top edge
      item('א.', 50, PAGE_H - 20),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].stemYTop).toBe(PAGE_H)  // clamped
  })

  it('שאלה marker without number is detected and assigned incremental number', () => {
    const items = [
      item('שאלה', 50, 700),
      item('א.', 50, 680),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions).toHaveLength(1)
    expect(regions[0].options).toHaveLength(1)
  })

  it('detects reversed RTL question marker :2 שאלה מספר', () => {
    const items = [
      item(':2 שאלה מספר', 50, 700),
      item('א. תשובה', 50, 680),
      item('ב. תשובה', 50, 660),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions).toHaveLength(1)
    expect(regions[0].options).toHaveLength(2)
  })

  it('extracts correct question number from reversed marker :2 שאלה מספר', () => {
    const items = [
      item(':2 שאלה מספר', 50, 700),
      item('א. תשובה', 50, 680),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions[0].questionNumber).toBe(2)
  })

  it('detects reversed RTL marker 3: שאלה מספר (N: colon-after-number form)', () => {
    const items = [
      item('3: שאלה מספר', 50, 700),
      item('א. תשובה', 50, 680),
    ]
    const regions = detectQuestionRegions(items, PAGE_H)
    expect(regions).toHaveLength(1)
    expect(regions[0].questionNumber).toBe(3)
  })
})
