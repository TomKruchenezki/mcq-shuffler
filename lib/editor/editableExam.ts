import type { ParsedExam, QuestionStatus } from '@/lib/parser/parseQuestions'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EditableReviewStatus =
  | 'ok'
  | 'needs-review'
  | 'manually-edited'
  | 'missing-options'
  | 'missing-correct-answer'
  | 'visual-content'
  | 'missing-visual-content'
  | 'suspicious-number'
  | 'incomplete'

export interface EditableOption {
  id: string
  text: string
  originalIndex?: number   // carried from parser (diagnostics only)
  originalLabel?: string   // e.g. 'א' (diagnostics only)
  visualImageDataUrl?: string
}

export interface EditableQuestion {
  id: string
  outputQuestionNumber: number   // user-editable display number; default = sequenceIndex + 1
  sequenceIndex: number          // 0-based extraction order; stable metadata
  sourceQuestionNumber?: number  // PDF-detected number if different from outputQuestionNumber
  text: string
  options: EditableOption[]
  correctOptionId: string | null // id of the correct option; null = not yet set
  reviewStatus: EditableReviewStatus
  notes?: string
  hasVisualContent: boolean
  visualImageDataUrl?: string
}

export interface EditableExam {
  questions: EditableQuestion[]
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateId(): string {
  // crypto.randomUUID() available in Node 14.17+ / jsdom 20+ / modern browsers
  return crypto.randomUUID()
}

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapStatus(status: QuestionStatus, hasVisualContent: boolean): EditableReviewStatus {
  if (status === 'suspicious-number') return 'suspicious-number'
  if (status === 'few-options') return 'missing-options'
  if (status === 'huge-block') return 'incomplete'
  if (hasVisualContent) return 'visual-content'
  return 'ok'
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a ParsedExam (parser output) to an EditableExam (editor input).
 * The first option with isOriginalCorrectAnswer=true becomes the default correctOptionId.
 */
export function parsedToEditable(exam: ParsedExam): EditableExam {
  return {
    questions: exam.questions.map(q => {
      const optionIds = q.options.map(() => generateId())
      const correctIndex = q.options.findIndex(o => o.isOriginalCorrectAnswer)
      const correctId = correctIndex >= 0 ? (optionIds[correctIndex] ?? null) : null

      return {
        id: generateId(),
        outputQuestionNumber: q.outputQuestionNumber,
        sequenceIndex: q.sequenceIndex,
        sourceQuestionNumber: q.number !== q.outputQuestionNumber ? q.number : undefined,
        text: q.questionText,
        options: q.options.map((opt, i) => ({
          id: optionIds[i] as string,
          text: opt.text,
          originalIndex: opt.originalIndex,
          originalLabel: opt.originalLabel,
        })),
        correctOptionId: correctId,
        reviewStatus: mapStatus(q.status, q.hasVisualContent),
        hasVisualContent: q.hasVisualContent,
      }
    }),
  }
}

/**
 * Convert an EditableExam back to a ParsedExam for shuffling.
 * The option whose id matches correctOptionId gets isOriginalCorrectAnswer=true.
 * This is the sole bridge to the shuffle machinery — no changes to shuffleExam.ts needed.
 */
export function editableToParsed(exam: EditableExam): ParsedExam {
  return {
    questions: exam.questions.map(q => ({
      number: q.sourceQuestionNumber ?? q.outputQuestionNumber,
      sequenceIndex: q.sequenceIndex,
      outputQuestionNumber: q.outputQuestionNumber,
      questionText: q.text,
      options: q.options.map((opt, idx) => ({
        originalLabel: opt.originalLabel ?? (HEBREW_LABELS[idx] ?? String(idx + 1)),
        text: opt.text,
        originalIndex: opt.originalIndex ?? idx,
        isOriginalCorrectAnswer: opt.id === q.correctOptionId,
        visualImageDataUrl: opt.visualImageDataUrl,
      })),
      status: 'ok' as const,
      hasVisualContent: q.hasVisualContent,
      visualImageDataUrl: q.visualImageDataUrl,
    })),
  }
}

// ─── Pure mutation helpers (all return new EditableExam) ──────────────────────

/** Renumber outputQuestionNumber to 1, 2, 3… in array order. */
export function resetOutputNumbers(questions: EditableQuestion[]): EditableQuestion[] {
  return questions.map((q, i) => ({ ...q, outputQuestionNumber: i + 1 }))
}

/** Append a new blank question with `numOptions` empty options. */
export function addQuestion(exam: EditableExam, numOptions = 4): EditableExam {
  const optionIds = Array.from({ length: numOptions }, () => generateId())
  const newQuestion: EditableQuestion = {
    id: generateId(),
    outputQuestionNumber: exam.questions.length + 1,
    sequenceIndex: exam.questions.length,
    text: '',
    options: optionIds.map(id => ({ id, text: '' })),
    correctOptionId: null,
    reviewStatus: 'manually-edited',
    hasVisualContent: false,
  }
  return { questions: [...exam.questions, newQuestion] }
}

/** Remove a question by id and renumber. */
export function deleteQuestion(exam: EditableExam, questionId: string): EditableExam {
  const questions = exam.questions.filter(q => q.id !== questionId)
  return { questions: resetOutputNumbers(questions) }
}

/** Duplicate a question (new ids, inserted after original) and renumber. */
export function duplicateQuestion(exam: EditableExam, questionId: string): EditableExam {
  const idx = exam.questions.findIndex(q => q.id === questionId)
  if (idx === -1) return exam
  const original = exam.questions[idx]
  const newOptionIds = original.options.map(() => generateId())
  const correctIdx = original.options.findIndex(o => o.id === original.correctOptionId)
  const duplicated: EditableQuestion = {
    ...original,
    id: generateId(),
    options: original.options.map((opt, i) => ({ ...opt, id: newOptionIds[i] as string })),
    correctOptionId: correctIdx >= 0 ? (newOptionIds[correctIdx] ?? null) : null,
    reviewStatus: 'manually-edited',
  }
  const questions = [
    ...exam.questions.slice(0, idx + 1),
    duplicated,
    ...exam.questions.slice(idx + 1),
  ]
  return { questions: resetOutputNumbers(questions) }
}

/** Move a question up or down. */
export function moveQuestion(
  exam: EditableExam,
  questionId: string,
  direction: 'up' | 'down',
): EditableExam {
  const idx = exam.questions.findIndex(q => q.id === questionId)
  if (idx === -1) return exam
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= exam.questions.length) return exam
  const questions = [...exam.questions]
  ;[questions[idx], questions[targetIdx]] = [questions[targetIdx], questions[idx]]
  return { questions: resetOutputNumbers(questions) }
}

/** Generic patch for a single question. */
export function updateQuestion(
  exam: EditableExam,
  questionId: string,
  patch: Partial<EditableQuestion>,
): EditableExam {
  return {
    questions: exam.questions.map(q => q.id === questionId ? { ...q, ...patch } : q),
  }
}

/** Set the correct option for a question. */
export function setCorrectOption(
  exam: EditableExam,
  questionId: string,
  optionId: string,
): EditableExam {
  return updateQuestion(exam, questionId, { correctOptionId: optionId })
}

/** Append a blank option to a question. */
export function addOption(exam: EditableExam, questionId: string): EditableExam {
  return {
    questions: exam.questions.map(q => {
      if (q.id !== questionId) return q
      return { ...q, options: [...q.options, { id: generateId(), text: '' }] }
    }),
  }
}

/**
 * Remove an option from a question.
 * If the deleted option was the correct answer, correctOptionId is set to null.
 */
export function deleteOption(
  exam: EditableExam,
  questionId: string,
  optionId: string,
): EditableExam {
  return {
    questions: exam.questions.map(q => {
      if (q.id !== questionId) return q
      const options = q.options.filter(o => o.id !== optionId)
      const correctOptionId = q.correctOptionId === optionId ? null : q.correctOptionId
      return { ...q, options, correctOptionId }
    }),
  }
}

/** Update the text of a single option. */
export function updateOptionText(
  exam: EditableExam,
  questionId: string,
  optionId: string,
  text: string,
): EditableExam {
  return {
    questions: exam.questions.map(q => {
      if (q.id !== questionId) return q
      return {
        ...q,
        options: q.options.map(o => o.id === optionId ? { ...o, text } : o),
      }
    }),
  }
}

/** Move an option up or down within a question. correctOptionId remains stable. */
export function moveOption(
  exam: EditableExam,
  questionId: string,
  optionId: string,
  direction: 'up' | 'down',
): EditableExam {
  return {
    questions: exam.questions.map(q => {
      if (q.id !== questionId) return q
      const idx = q.options.findIndex(o => o.id === optionId)
      if (idx === -1) return q
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= q.options.length) return q
      const options = [...q.options]
      ;[options[idx], options[targetIdx]] = [options[targetIdx], options[idx]]
      return { ...q, options }
    }),
  }
}

/**
 * Set or clear the image attached to a specific option.
 * Pass `undefined` to remove the image.
 */
export function updateOptionImage(
  exam: EditableExam,
  questionId: string,
  optionId: string,
  dataUrl: string | undefined,
): EditableExam {
  return {
    questions: exam.questions.map(q => {
      if (q.id !== questionId) return q
      return {
        ...q,
        options: q.options.map(o =>
          o.id === optionId ? { ...o, visualImageDataUrl: dataUrl } : o,
        ),
      }
    }),
  }
}
