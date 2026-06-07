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

/**
 * Wraps `text` in U+202A (LEFT-TO-RIGHT EMBEDDING) / U+202C (POP DIRECTIONAL FORMATTING)
 * Unicode marks so that an LTR run (code snippet, SQL, English term, number, formula)
 * renders correctly when embedded inside an RTL paragraph.
 *
 * @renderOnly — ONLY safe to call in render/display/export contexts (JSX, DOCX XML).
 * NEVER call this on text that will be stored in ParsedQuestion, ShuffledQuestion,
 * or any data structure that is exported, persisted, or used as input to further
 * parsing, shuffling, or answer-key generation. Doing so would inject hidden Unicode
 * direction marks into stored exam data.
 */
export function wrapLtr(text: string): string {
  return `${LTR_EMBED}${text}${POP_DIR}`
}

export function textDirection(text: string): 'rtl' | 'ltr' {
  return containsHebrew(text) ? 'rtl' : 'ltr'
}
