// Hebrew Unicode block U+0590-U+05FF and Hebrew Presentation Forms U+FB1D-U+FB4F
const HEBREW_RE = /[֐-׿יִ-ﭏ]/

export function isHebrew(char: string): boolean {
  return HEBREW_RE.test(char)
}

export function containsHebrew(text: string): boolean {
  return HEBREW_RE.test(text)
}

// Unicode directional marks for embedding LTR runs inside RTL paragraphs.
// Use around code snippets, English terms, numbers, SQL, and formulas.
const LTR_EMBED = '‪'  // LEFT-TO-RIGHT EMBEDDING
const POP_DIR   = '‬'  // POP DIRECTIONAL FORMATTING

export function wrapLtr(text: string): string {
  return `${LTR_EMBED}${text}${POP_DIR}`
}

export function textDirection(text: string): 'rtl' | 'ltr' {
  return containsHebrew(text) ? 'rtl' : 'ltr'
}
