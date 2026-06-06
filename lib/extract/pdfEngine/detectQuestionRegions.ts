import type { PdfTextItem } from '../pdfLines'
import { reconstructPageText } from '../pdfLines'
import type { QuestionRegion, OptionRegion } from './visualTypes'

const Y_TOLERANCE = 3.0   // same as pdfLines.ts
const REGION_PAD = 4.0    // PDF units of padding around each detected region

// Detects question markers: "שאלה 1", "שאלה", "1.", ".1", "1)"
const QUESTION_RE = /^(שאלה\s*\d*|(\d+)\s*[\.\)]\s|[\.\)]\s*(\d+)[\s$])/

// Detects option markers: "א." "א)" at start, or ".א" ")א" at end (RTL-flipped)
const OPTION_RE = /^([א-ת])[.)]/
const OPTION_RE_FLIPPED = /[.)]\s*([א-ת])\s*$/

interface LineGroup {
  y: number
  items: PdfTextItem[]
}

function groupItemsByY(items: PdfTextItem[]): LineGroup[] {
  const nonEmpty = items.filter(it => it.str.trim().length > 0)
  if (nonEmpty.length === 0) return []

  const sorted = [...nonEmpty].sort((a, b) => (b.transform[5] ?? 0) - (a.transform[5] ?? 0))

  const groups: LineGroup[] = []
  let currentItems: PdfTextItem[] = [sorted[0]]
  let currentY = sorted[0].transform[5] ?? 0

  for (let i = 1; i < sorted.length; i++) {
    const y = sorted[i].transform[5] ?? 0
    if (Math.abs(y - currentY) <= Y_TOLERANCE) {
      currentItems.push(sorted[i])
    } else {
      groups.push({ y: currentY, items: currentItems })
      currentItems = [sorted[i]]
      currentY = y
    }
  }
  if (currentItems.length > 0) groups.push({ y: currentY, items: currentItems })

  return groups
}

function lineTextOf(items: PdfTextItem[]): string {
  return reconstructPageText(items).trim()
}

function extractQuestionNumber(text: string): number {
  const hebrewMatch = text.match(/שאלה\s*(\d+)/)
  if (hebrewMatch) return parseInt(hebrewMatch[1], 10)
  const numericMatch = text.match(/^(\d+)\s*[\.\)]/)
  if (numericMatch) return parseInt(numericMatch[1], 10)
  const flippedMatch = text.match(/[\.\)]\s*(\d+)/)
  if (flippedMatch) return parseInt(flippedMatch[1], 10)
  return 0
}

function extractOptionLabelInfo(
  text: string,
  items: PdfTextItem[],
): { label: string; labelItem: PdfTextItem } | null {
  if (items.length === 0) return null

  const normalMatch = text.match(OPTION_RE)
  if (normalMatch) {
    const labelChar = normalMatch[1]
    const exactItem =
      items.find(it => it.str === labelChar || it.str === `${labelChar}.` || it.str === `${labelChar})`) ??
      items.find(it => it.str.startsWith(labelChar)) ??
      items[0]
    return { label: labelChar, labelItem: exactItem }
  }

  const flippedMatch = text.match(OPTION_RE_FLIPPED)
  if (flippedMatch) {
    const labelChar = flippedMatch[1]
    const exactItem =
      items.find(it => it.str === labelChar || it.str === `.${labelChar}` || it.str === `)${labelChar}`) ??
      items.find(it => it.str.endsWith(labelChar)) ??
      items[items.length - 1]
    return { label: labelChar, labelItem: exactItem }
  }

  return null
}

/**
 * Given text items for one PDF page and the page height in PDF user-units,
 * returns detected question/option region boundaries.
 *
 * Pure coordinate logic — no browser APIs, no pdfjs runtime imports.
 */
export function detectQuestionRegions(
  items: PdfTextItem[],
  pageHeightPdf: number,
): QuestionRegion[] {
  if (items.length === 0) return []

  // Group items into visual lines, sorted top-to-bottom (descending Y in PDF space)
  const lines = groupItemsByY(items)

  const regions: QuestionRegion[] = []
  let currentRegion: QuestionRegion | null = null
  let currentOption: OptionRegion | null = null
  let questionCount = 0
  let inStem = false

  for (const line of lines) {
    const text = lineTextOf(line.items)
    if (!text) continue

    const isQuestion = QUESTION_RE.test(text)
    const optionInfo = !isQuestion ? extractOptionLabelInfo(text, line.items) : null

    if (isQuestion) {
      // Close the open option
      if (currentOption !== null && currentRegion !== null) {
        currentOption.yBottom = line.y
        currentRegion.options.push(currentOption)
        currentOption = null
      }
      // Close the open region
      if (currentRegion !== null) {
        if (currentRegion.options.length === 0) {
          // No options found: stem ends where next question begins
          currentRegion.stemYBottom = line.y
        }
        regions.push(currentRegion)
      }
      questionCount++
      const qNum = extractQuestionNumber(text) || questionCount
      currentRegion = {
        questionNumber: qNum,
        stemYTop: line.y,
        stemYBottom: 0,
        options: [],
      }
      inStem = true

    } else if (optionInfo !== null && currentRegion !== null) {
      // Close previous option (or first option closing the stem)
      if (currentOption !== null) {
        currentOption.yBottom = line.y
        currentRegion.options.push(currentOption)
      } else if (inStem) {
        // First option — close the stem
        currentRegion.stemYBottom = line.y
        inStem = false
      }
      currentOption = {
        label: optionInfo.label,
        labelItem: optionInfo.labelItem,
        yTop: line.y,
        yBottom: 0,
        items: [...line.items],
      }

    } else {
      // Continuation line — extend whatever region is currently open
      if (currentOption !== null) {
        currentOption.items.push(...line.items)
      }
      // Stem continuation: no action needed — stem extent governed by stemYTop/stemYBottom
    }
  }

  // Close last open option and region at end of page
  if (currentOption !== null && currentRegion !== null) {
    currentOption.yBottom = 0   // extends to page bottom
    currentRegion.options.push(currentOption)
  }
  if (currentRegion !== null) {
    if (currentRegion.options.length === 0 && currentRegion.stemYBottom === 0) {
      // Question with no detected options — stem extends to page bottom
      // (stemYBottom already 0)
    }
    regions.push(currentRegion)
  }

  // Apply padding, clamped to valid range
  for (const r of regions) {
    r.stemYTop = Math.min(pageHeightPdf, r.stemYTop + REGION_PAD)
    r.stemYBottom = Math.max(0, r.stemYBottom - REGION_PAD)
    for (const opt of r.options) {
      opt.yTop = Math.min(pageHeightPdf, opt.yTop + REGION_PAD)
      opt.yBottom = Math.max(0, opt.yBottom - REGION_PAD)
    }
  }

  return regions
}
