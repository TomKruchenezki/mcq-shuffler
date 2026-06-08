// Known header/footer patterns found in Hebrew university exam PDFs.
const HEADER_FOOTER_PATTERNS: RegExp[] = [
  /עמוד\s+\d+\s+מתוך\s+\d+/,
  /עמוד\s*\d+\s*מתוך\s*\d+/, // no-space variant (catches "עמוד5מתוך11")
  /מבחן\s+מס[''']?\s*\d*/,
  /קוד\s+מבחן/,
  /בן\s+גוריון/,
  /^\d+$/, // lone page-number lines
]

// Matches a line whose option label has been moved to the end by RTL PDF extraction:
// "text content .א" → normalise to "א. text content"
const RE_FLIPPED_OPTION = /^(.+?)\s+\.([א-ת])\s*$/

// Reversed question marker at line START: ":2 שאלה מספר" or "2: שאלה מספר"
// (?::\s+|\s+) matches EITHER "colon+space" (N: form) OR just "space" (:N form)
const RE_REVERSED_START = /^:?\s*(\d+)(?::\s+|\s+)שאלה\s+מספר\s*(.*)/
// Reversed question marker MID-LINE (non-empty prefix before it)
const RE_REVERSED_MID = /^(.+?)\s+:?\s*(\d+)(?::\s+|\s+)שאלה\s+מספר\s*(.*)/

// Forward question marker embedded after a slash: "ו. / שאלה מספר 5 text"
// \s*:?\s* handles the colon-before-digit form "שאלה מספר :0"
// \d+\b prevents backtracking to a partial digit (e.g. "7" from "70%") that would defeat the lookahead
const RE_FORWARD_SLASH = /^(.*?\S)\s*\/\s*(שאלה\s+מספר\s*:?\s*\d+\b(?!\s*%)\s*.*)$/

// Page+question marker on same line: "עמוד 3 שאלה מספר 7 text"
// \s*:?\s* handles the colon-before-digit form "שאלה מספר :7"
const RE_PAGE_QUESTION = /^עמוד\s+\d+\s+(שאלה\s+מספר\s*:?\s*\d+\b(?!\s*%)\s*.*)$/

// Zero-width space marker (U+200B) — prepended to auto-split question lines
// so the parser can detect and count them without threading counts through layers
const ZWSP = '​'

// Hebrew↔digit boundary spacing
const RE_HEB_DIGIT = /([א-ת])(\d)/g
const RE_DIGIT_HEB = /(\d)([א-ת])/g

/**
 * Removes repeated headers/footers across pages and normalises RTL-flipped option
 * labels and reversed question markers. Returns one cleaned string per page.
 */
export function normalizePdfText(pages: string[]): string[] {
  if (pages.length === 0) return []

  // Phase 1: apply digit-Hebrew spacing and reversed-marker normalization per line.
  // This runs before header detection so that "עמוד5מתוך11" becomes "עמוד 5 מתוך 11"
  // (matched by the header pattern) and ":2 שאלה מספר" becomes "שאלה מספר 2" (protected).
  const preProcessed: string[][] = pages.map(page =>
    page
      .split('\n')
      .flatMap(line =>
        splitAndNormalizeReversedMarkers(fixDigitHebrewSpacing(line))
          .flatMap(l => splitForwardMarkersFromMidLine(l))
      )
  )

  // Phase 2: build map from pre-processed trimmed line → set of page indices
  const linePageMap = new Map<string, Set<number>>()
  for (let pi = 0; pi < preProcessed.length; pi++) {
    for (const line of preProcessed[pi]) {
      const t = line.trim()
      if (!t) continue
      if (!linePageMap.has(t)) linePageMap.set(t, new Set())
      linePageMap.get(t)!.add(pi)
    }
  }

  // Phase 3: determine headers from pre-processed content
  const headerFooterLines = new Set<string>()
  for (const [line, pageSet] of linePageMap) {
    if (isHeaderOrFooter(line, pageSet.size)) headerFooterLines.add(line)
  }

  // Phase 4: filter headers and normalize option labels
  return preProcessed.map(lines =>
    lines
      .filter(line => !headerFooterLines.has(line.trim()))
      .map(normalizeOptionLabel)
      .join('\n'),
  )
}

function fixDigitHebrewSpacing(line: string): string {
  return line.replace(RE_HEB_DIGIT, '$1 $2').replace(RE_DIGIT_HEB, '$1 $2')
}

function splitAndNormalizeReversedMarkers(line: string): string[] {
  const t = line.trim()

  const mStart = RE_REVERSED_START.exec(t)
  if (mStart) {
    const num = mStart[1]
    const rest = mStart[2].replace(/^[:\s]+/, '').trim()
    return rest ? [`שאלה מספר ${num}`, rest] : [`שאלה מספר ${num}`]
  }

  const mMid = RE_REVERSED_MID.exec(t)
  if (mMid) {
    const prefix = mMid[1].trim()
    const num = mMid[2]
    const suffix = mMid[3].replace(/^[:\s]+/, '').trim()
    const qLine = suffix ? `שאלה מספר ${num} ${suffix}` : `שאלה מספר ${num}`
    return prefix ? [prefix, qLine] : [qLine]
  }

  return [t || line]
}

/**
 * Splits a line that has a forward question marker embedded after content.
 * E.g. "ו. / שאלה מספר 5 text" → ["ו.", "​שאלה מספר 5 text"]
 * The ZWSP prefix on the question line lets the parser detect and count auto-splits.
 */
function splitForwardMarkersFromMidLine(line: string): string[] {
  const t = line.trim()

  const mSlash = RE_FORWARD_SLASH.exec(t)
  if (mSlash) {
    const prefix = mSlash[1]!.trim()
    const qLine = mSlash[2]!.trim()
    // ZWSP only when a real prefix exists (i.e. a genuine split happened)
    return prefix ? [prefix, ZWSP + qLine] : [qLine]
  }

  const mPage = RE_PAGE_QUESTION.exec(t)
  if (mPage) {
    const questionLine = mPage[1]!.trim()
    const pagePrefix = t.slice(0, t.indexOf(questionLine)).trim()
    return pagePrefix ? [pagePrefix, ZWSP + questionLine] : [ZWSP + questionLine]
  }

  return [t || line]
}

function isHeaderOrFooter(line: string, pageCount: number): boolean {
  // Never remove lines that look like questions or options
  if (/^(שאלה|\d+\.?\s|\.[א-ת]|[א-ת][.)])/.test(line)) return false
  // Short line that appears on more than one page → probable header/footer
  if (pageCount >= 2 && line.length <= 60) return true
  // Matches a known header/footer pattern regardless of frequency
  return HEADER_FOOTER_PATTERNS.some(re => re.test(line))
}

function normalizeOptionLabel(line: string): string {
  const m = RE_FLIPPED_OPTION.exec(line.trim())
  if (m) return `${m[2]}. ${m[1]}`
  return line
}
