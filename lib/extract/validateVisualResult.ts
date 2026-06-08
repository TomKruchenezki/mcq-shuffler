import type { VisualQuestion } from './pdfEngine/visualTypes'

/**
 * Result of visual-extraction quality validation.
 * Used by ExamShuffler to gate whether to accept visual mode output.
 */
export interface VisualValidationResult {
  ok: boolean
  reason?: string  // Hebrew explanation, shown in the failure UI
}

/**
 * Validates whether a set of extracted VisualQuestion objects meets minimum
 * quality thresholds before they are accepted by the editor.
 *
 * Rules (all checked against a >50% majority threshold):
 *  - Zero questions → reject immediately
 *  - Majority have < 2 options → reject (most regions were partially detected)
 *  - Majority have empty or too-short stemDataUrl → reject (images were not captured)
 */
export function validateVisualResult(
  questions: VisualQuestion[],
): VisualValidationResult {
  if (questions.length === 0) {
    return { ok: false, reason: 'לא זוהו שאלות בחילוץ הוויזואלי' }
  }

  const threshold = questions.length / 2

  const fewOpts = questions.filter(q => q.options.length < 2).length
  if (fewOpts > threshold) {
    return {
      ok: false,
      reason: 'רוב השאלות חסרות תשובות (פחות מ-2 אפשרויות) — ייתכן שאזורי השאלות לא זוהו נכון',
    }
  }

  // stemDataUrl should be a real data URL (>100 chars); empty/minimal strings are placeholders
  const noStem = questions.filter(q => !q.stemDataUrl || q.stemDataUrl.length < 100).length
  if (noStem > threshold) {
    return {
      ok: false,
      reason: 'רוב השאלות חסרות תמונת שאלה — ייתכן שה-PDF לא מכיל שכבת תמונה תקינה',
    }
  }

  return { ok: true }
}
