// Known header/footer patterns found in Hebrew university exam PDFs.
const HEADER_FOOTER_PATTERNS: RegExp[] = [
  /עמוד\s+\d+\s+מתוך\s+\d+/,
  /מבחן\s+מס[''']?\s*\d*/,
  /קוד\s+מבחן/,
  /בן\s+גוריון/,
  /^\d+$/, // lone page-number lines
]

// Matches a line whose option label has been moved to the end by RTL PDF extraction:
// "text content .א" → normalise to "א. text content"
const RE_FLIPPED_OPTION = /^(.+?)\s+\.([א-ת])\s*$/

/**
 * Removes repeated headers/footers across pages and normalises RTL-flipped option
 * labels. Returns one cleaned string per page.
 */
export function normalizePdfText(pages: string[]): string[] {
  if (pages.length === 0) return []

  // Build a map from trimmed line → set of page indices it appears on
  const linePageMap = new Map<string, Set<number>>()
  for (let pi = 0; pi < pages.length; pi++) {
    for (const line of pages[pi].split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (!linePageMap.has(t)) linePageMap.set(t, new Set())
      linePageMap.get(t)!.add(pi)
    }
  }

  // Determine which lines are headers or footers
  const headerFooterLines = new Set<string>()
  for (const [line, pageSet] of linePageMap) {
    if (isHeaderOrFooter(line, pageSet.size)) headerFooterLines.add(line)
  }

  // Filter and normalise each page
  return pages.map(page =>
    page
      .split('\n')
      .filter(line => !headerFooterLines.has(line.trim()))
      .map(normalizeOptionLabel)
      .join('\n'),
  )
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
