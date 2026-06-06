// Minimal subset of pdfjs-dist TextItem needed for line reconstruction.
// Kept separate so this module is testable without importing pdfjs-dist.
export interface PdfTextItem {
  str: string
  dir?: string       // 'ltr' | 'rtl'
  width: number
  height: number
  transform: number[] // [a, b, c, d, x, y] — we use indices 4 (x) and 5 (y)
  hasEOL?: boolean
}

interface PositionedItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  dir: string
}

const Y_TOLERANCE = 3.0
const SPACE_THRESHOLD_FACTOR = 0.25

/**
 * Reconstructs readable plain text from a single PDF page's text items.
 * Groups items into visual lines by y-coordinate, sorts within each line
 * by reading direction, and inserts spaces where the gap between items
 * exceeds a font-height-based threshold.
 */
export function reconstructPageText(items: PdfTextItem[]): string {
  if (items.length === 0) return ''

  // Map to positioned items, discarding completely empty items
  const nonEmpty: PositionedItem[] = items
    .filter(item => item.str.trim().length > 0)
    .map(item => ({
      str: item.str,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      width: Math.abs(item.width),
      height: Math.abs(item.height),
      dir: item.dir ?? 'ltr',
    }))

  if (nonEmpty.length === 0) return ''

  // Group items into lines by y-coordinate proximity
  const lineGroups = groupByY(nonEmpty)

  // Sort line groups top-to-bottom (highest y = top of page in PDF space)
  lineGroups.sort((a, b) => b[0].y - a[0].y)

  const resultLines: string[] = []

  for (const group of lineGroups) {
    // Determine dominant text direction for this line
    const rtlCount = group.filter(i => i.dir === 'rtl').length
    const isRtl = rtlCount >= group.length / 2

    // Sort items within the line by reading order
    const sorted = [...group].sort((a, b) => isRtl ? b.x - a.x : a.x - b.x)

    const lineText = joinWithSpacing(sorted, isRtl).trim()
    if (lineText.length > 0) resultLines.push(lineText)
  }

  return resultLines.join('\n')
}

function groupByY(items: PositionedItem[]): PositionedItem[][] {
  // Sort by y descending so we process top-of-page items first
  const sorted = [...items].sort((a, b) => b.y - a.y)

  const groups: PositionedItem[][] = []
  let currentGroup: PositionedItem[] = []
  let currentY = sorted[0].y

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) <= Y_TOLERANCE) {
      currentGroup.push(item)
    } else {
      groups.push(currentGroup)
      currentGroup = [item]
      currentY = item.y
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  return groups
}

function joinWithSpacing(items: PositionedItem[], isRtl: boolean): string {
  if (items.length === 0) return ''
  let result = items[0].str

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]

    const fontSize = Math.max(prev.height, curr.height, 1)
    const spaceThreshold = fontSize * SPACE_THRESHOLD_FACTOR

    // Gap between the trailing edge of prev and the leading edge of curr,
    // measured in the visual reading direction.
    const gap = isRtl
      ? (prev.x - prev.width) - curr.x   // RTL: prev left edge minus curr right edge
      : curr.x - (prev.x + prev.width)   // LTR: curr left edge minus prev right edge

    const prevEndsSpace = prev.str.endsWith(' ')
    const currStartsSpace = curr.str.startsWith(' ')

    if (gap > spaceThreshold && !prevEndsSpace && !currStartsSpace) {
      result += ' '
    }

    result += curr.str
  }

  return result
}
