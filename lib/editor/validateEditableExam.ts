import type { EditableExam } from './editableExam'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationWarningType =
  | 'no-correct-answer'
  | 'too-few-options'
  | 'empty-question-text'
  | 'empty-option-text'
  | 'duplicate-output-number'

export interface ValidationWarning {
  type: ValidationWarningType
  questionId: string
  outputQuestionNumber: number
  message: string  // Hebrew
}

export interface ValidationResult {
  warnings: ValidationWarning[]
  counts: {
    ok: number
    needsReview: number
    noCorrectAnswer: number
    tooFewOptions: number
    missingVisualContent: number
    emptyOptions: number
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate an EditableExam before shuffling.
 * Does NOT block the user — warnings are advisory.
 */
export function validateEditableExam(exam: EditableExam): ValidationResult {
  const warnings: ValidationWarning[] = []

  // Detect duplicate outputQuestionNumbers
  const numberCounts = new Map<number, number>()
  for (const q of exam.questions) {
    numberCounts.set(q.outputQuestionNumber, (numberCounts.get(q.outputQuestionNumber) ?? 0) + 1)
  }

  let noCorrectAnswer = 0
  let tooFewOptions = 0
  let missingVisualContent = 0
  let emptyOptions = 0
  let needsReview = 0

  for (const q of exam.questions) {
    const num = q.outputQuestionNumber
    const questionWarnings: ValidationWarning[] = []

    if ((numberCounts.get(num) ?? 0) > 1) {
      questionWarnings.push({
        type: 'duplicate-output-number',
        questionId: q.id,
        outputQuestionNumber: num,
        message: `שאלה ${num}: מספר שאלה כפול`,
      })
    }

    if (q.text.trim() === '' && !q.visualImageDataUrl) {
      questionWarnings.push({
        type: 'empty-question-text',
        questionId: q.id,
        outputQuestionNumber: num,
        message: `שאלה ${num}: טקסט השאלה ריק`,
      })
    }

    if (q.options.length < 2) {
      tooFewOptions++
      questionWarnings.push({
        type: 'too-few-options',
        questionId: q.id,
        outputQuestionNumber: num,
        message: `שאלה ${num}: פחות מ-2 תשובות (${q.options.length})`,
      })
    }

    const hasCorrect =
      q.correctOptionId !== null &&
      q.options.some(o => o.id === q.correctOptionId)
    if (!hasCorrect) {
      noCorrectAnswer++
      questionWarnings.push({
        type: 'no-correct-answer',
        questionId: q.id,
        outputQuestionNumber: num,
        message: `שאלה ${num}: לא נבחרה תשובה נכונה`,
      })
    }

    // One empty-option warning per question (avoid flooding)
    const hasEmptyOption = q.options.some(
      o => o.text.trim() === '' && !o.visualImageDataUrl,
    )
    if (hasEmptyOption) {
      emptyOptions++
      questionWarnings.push({
        type: 'empty-option-text',
        questionId: q.id,
        outputQuestionNumber: num,
        message: `שאלה ${num}: תשובה עם טקסט ריק`,
      })
    }

    if (q.reviewStatus === 'missing-visual-content') {
      missingVisualContent++
    }

    if (questionWarnings.length > 0 || q.reviewStatus === 'needs-review') {
      needsReview++
    }

    warnings.push(...questionWarnings)
  }

  const ok = exam.questions.length - needsReview

  return {
    warnings,
    counts: {
      ok: Math.max(0, ok),
      needsReview,
      noCorrectAnswer,
      tooFewOptions,
      missingVisualContent,
      emptyOptions,
    },
  }
}
