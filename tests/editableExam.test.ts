import { describe, it, expect } from 'vitest'
import type { ParsedExam } from '@/lib/parser/parseQuestions'
import {
  parsedToEditable,
  editableToParsed,
  resetOutputNumbers,
  addQuestion,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  updateQuestion,
  setCorrectOption,
  addOption,
  deleteOption,
  updateOptionText,
  moveOption,
} from '@/lib/editor/editableExam'
import { validateEditableExam } from '@/lib/editor/validateEditableExam'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(text: string, isCorrect = false) {
  return { originalLabel: 'א', text, originalIndex: 0, isOriginalCorrectAnswer: isCorrect }
}

function makeParsedExam(overrides?: Partial<Parameters<typeof parsedToEditable>[0]['questions'][0]>[]): ParsedExam {
  const questions = (overrides ?? [undefined, undefined]).map((ovr, i) => ({
    number: i + 1,
    sequenceIndex: i,
    outputQuestionNumber: i + 1,
    questionText: `שאלה ${i + 1}`,
    options: [
      { originalLabel: 'א', text: 'תשובה א', originalIndex: 0, isOriginalCorrectAnswer: true },
      { originalLabel: 'ב', text: 'תשובה ב', originalIndex: 1, isOriginalCorrectAnswer: false },
      { originalLabel: 'ג', text: 'תשובה ג', originalIndex: 2, isOriginalCorrectAnswer: false },
      { originalLabel: 'ד', text: 'תשובה ד', originalIndex: 3, isOriginalCorrectAnswer: false },
    ],
    status: 'ok' as const,
    hasVisualContent: false,
    ...ovr,
  }))
  return { questions }
}

// ─── parsedToEditable ─────────────────────────────────────────────────────────

describe('parsedToEditable', () => {
  it('preserves question count', () => {
    const exam = makeParsedExam()
    const editable = parsedToEditable(exam)
    expect(editable.questions).toHaveLength(2)
  })

  it('first isOriginalCorrectAnswer option becomes correctOptionId', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה',
        options: [
          { originalLabel: 'א', text: 'א', originalIndex: 0, isOriginalCorrectAnswer: false },
          { originalLabel: 'ב', text: 'ב', originalIndex: 1, isOriginalCorrectAnswer: true },
          { originalLabel: 'ג', text: 'ג', originalIndex: 2, isOriginalCorrectAnswer: false },
        ],
        status: 'ok', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    const q = editable.questions[0]!
    expect(q.correctOptionId).toBe(q.options[1]!.id)
  })

  it('correctOptionId is null when no option isOriginalCorrectAnswer', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה',
        options: [
          { originalLabel: 'א', text: 'א', originalIndex: 0, isOriginalCorrectAnswer: false },
          { originalLabel: 'ב', text: 'ב', originalIndex: 1, isOriginalCorrectAnswer: false },
        ],
        status: 'ok', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.correctOptionId).toBeNull()
  })

  it('sourceQuestionNumber is set when source ≠ output', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 42, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה',
        options: [makeOption('א')],
        status: 'ok', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.sourceQuestionNumber).toBe(42)
  })

  it('sourceQuestionNumber is undefined when source === output', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה',
        options: [makeOption('א')],
        status: 'ok', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.sourceQuestionNumber).toBeUndefined()
  })

  it('outputQuestionNumber matches sequential 1,2,3', () => {
    const exam = makeParsedExam()
    const editable = parsedToEditable(exam)
    expect(editable.questions[0]!.outputQuestionNumber).toBe(1)
    expect(editable.questions[1]!.outputQuestionNumber).toBe(2)
  })

  it('maps status suspicious-number → reviewStatus suspicious-number', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 999, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה', options: [makeOption('א')],
        status: 'suspicious-number', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.reviewStatus).toBe('suspicious-number')
  })

  it('maps status few-options → reviewStatus missing-options', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה', options: [makeOption('א')],
        status: 'few-options', hasVisualContent: false,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.reviewStatus).toBe('missing-options')
  })

  it('hasVisualContent is preserved', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה', options: [makeOption('א')],
        status: 'ok', hasVisualContent: true,
      }],
    }
    const editable = parsedToEditable(parsed)
    expect(editable.questions[0]!.hasVisualContent).toBe(true)
    expect(editable.questions[0]!.reviewStatus).toBe('visual-content')
  })
})

// ─── editableToParsed — round trip ────────────────────────────────────────────

describe('editableToParsed round trip', () => {
  it('questionText survives round trip unchanged', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const back = editableToParsed(editable)
    expect(back.questions[0]!.questionText).toBe('שאלה 1')
  })

  it('correctOptionId → isOriginalCorrectAnswer=true for matching option', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const back = editableToParsed(editable)
    const q = back.questions[0]!
    const correct = q.options.find(o => o.isOriginalCorrectAnswer)
    expect(correct).toBeDefined()
    expect(correct!.text).toBe('תשובה א')
  })

  it('all other options get isOriginalCorrectAnswer=false', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const back = editableToParsed(editable)
    const q = back.questions[0]!
    const incorrectCount = q.options.filter(o => !o.isOriginalCorrectAnswer).length
    expect(incorrectCount).toBe(3)
  })

  it('RTL+SQL mixed text survives round trip unchanged', () => {
    const mixedText = 'SELECT * FROM users WHERE id = 5'
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'מה הפלט?',
        options: [
          { originalLabel: 'א', text: mixedText, originalIndex: 0, isOriginalCorrectAnswer: true },
          { originalLabel: 'ב', text: 'אחר', originalIndex: 1, isOriginalCorrectAnswer: false },
        ],
        status: 'ok', hasVisualContent: false,
      }],
    }
    const back = editableToParsed(parsedToEditable(parsed))
    expect(back.questions[0]!.options[0]!.text).toBe(mixedText)
  })

  it('no hidden direction marks injected into option text', () => {
    const parsed = makeParsedExam()
    const back = editableToParsed(parsedToEditable(parsed))
    for (const q of back.questions) {
      for (const opt of q.options) {
        expect(opt.text).not.toContain('‪')
        expect(opt.text).not.toContain('‬')
      }
    }
  })

  it('editableToParsed carries visualImageDataUrl from EditableOption to ParsedOption', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const q = editable.questions[0]!
    const examWithImg: ReturnType<typeof parsedToEditable> = {
      questions: editable.questions.map(eq =>
        eq.id !== q.id ? eq : {
          ...eq,
          options: eq.options.map((o, i) =>
            i === 0 ? { ...o, visualImageDataUrl: 'data:image/png;base64,abc' } : o,
          ),
        },
      ),
    }
    const back = editableToParsed(examWithImg)
    expect(back.questions[0]!.options[0]!.visualImageDataUrl).toBe('data:image/png;base64,abc')
    expect(back.questions[0]!.options[1]!.visualImageDataUrl).toBeUndefined()
  })

  it('editableToParsed carries visualImageDataUrl from EditableQuestion to ParsedQuestion', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const q = editable.questions[0]!
    const examWithImg: ReturnType<typeof parsedToEditable> = {
      questions: editable.questions.map(eq =>
        eq.id !== q.id ? eq : { ...eq, visualImageDataUrl: 'data:image/png;base64,xyz' },
      ),
    }
    const back = editableToParsed(examWithImg)
    expect(back.questions[0]!.visualImageDataUrl).toBe('data:image/png;base64,xyz')
    expect(back.questions[1]!.visualImageDataUrl).toBeUndefined()
  })
})

// ─── setCorrectOption / user changes correct answer ───────────────────────────

describe('setCorrectOption', () => {
  it('changing correctOptionId propagates through editableToParsed', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const q = editable.questions[0]!
    const secondOptId = q.options[1]!.id
    const updated = setCorrectOption(editable, q.id, secondOptId)
    const back = editableToParsed(updated)
    const correct = back.questions[0]!.options.find(o => o.isOriginalCorrectAnswer)
    expect(correct!.text).toBe('תשובה ב')
  })

  it('only one option is marked correct after changing', () => {
    const parsed = makeParsedExam()
    const editable = parsedToEditable(parsed)
    const q = editable.questions[0]!
    const updated = setCorrectOption(editable, q.id, q.options[2]!.id)
    const back = editableToParsed(updated)
    const correctCount = back.questions[0]!.options.filter(o => o.isOriginalCorrectAnswer).length
    expect(correctCount).toBe(1)
  })
})

// ─── Question mutations ───────────────────────────────────────────────────────

describe('addQuestion', () => {
  it('appends at end with 4 options', () => {
    const exam = parsedToEditable(makeParsedExam())
    const updated = addQuestion(exam)
    expect(updated.questions).toHaveLength(3)
    expect(updated.questions[2]!.options).toHaveLength(4)
  })

  it('correctOptionId starts as null', () => {
    const exam = parsedToEditable(makeParsedExam())
    const updated = addQuestion(exam)
    expect(updated.questions[2]!.correctOptionId).toBeNull()
  })

  it('new question has reviewStatus manually-edited', () => {
    const exam = parsedToEditable(makeParsedExam())
    const updated = addQuestion(exam)
    expect(updated.questions[2]!.reviewStatus).toBe('manually-edited')
  })

  it('does not mutate original exam', () => {
    const exam = parsedToEditable(makeParsedExam())
    const snapshot = JSON.stringify(exam)
    addQuestion(exam)
    expect(JSON.stringify(exam)).toBe(snapshot)
  })
})

describe('deleteQuestion', () => {
  it('removes the target question', () => {
    const exam = parsedToEditable(makeParsedExam())
    const idToDelete = exam.questions[0]!.id
    const updated = deleteQuestion(exam, idToDelete)
    expect(updated.questions).toHaveLength(1)
    expect(updated.questions.find(q => q.id === idToDelete)).toBeUndefined()
  })

  it('renumbers remaining questions sequentially', () => {
    const exam = parsedToEditable(makeParsedExam())
    const updated = deleteQuestion(exam, exam.questions[0]!.id)
    expect(updated.questions[0]!.outputQuestionNumber).toBe(1)
  })
})

describe('duplicateQuestion', () => {
  it('inserts a copy after the original', () => {
    const exam = parsedToEditable(makeParsedExam())
    const id = exam.questions[0]!.id
    const updated = duplicateQuestion(exam, id)
    expect(updated.questions).toHaveLength(3)
    expect(updated.questions[0]!.id).toBe(id)
    expect(updated.questions[1]!.id).not.toBe(id)
  })

  it('copy has new option ids (correctOptionId is remapped)', () => {
    const exam = parsedToEditable(makeParsedExam())
    const id = exam.questions[0]!.id
    const updated = duplicateQuestion(exam, id)
    const original = updated.questions[0]!
    const copy = updated.questions[1]!
    // Correct option id should be distinct between original and copy
    expect(copy.correctOptionId).not.toBe(original.correctOptionId)
    expect(copy.correctOptionId).toBeDefined()
  })
})

describe('moveQuestion', () => {
  it('moves question up', () => {
    const exam = parsedToEditable(makeParsedExam())
    const id = exam.questions[1]!.id
    const updated = moveQuestion(exam, id, 'up')
    expect(updated.questions[0]!.id).toBe(id)
  })

  it('moves question down', () => {
    const exam = parsedToEditable(makeParsedExam())
    const id = exam.questions[0]!.id
    const updated = moveQuestion(exam, id, 'down')
    expect(updated.questions[1]!.id).toBe(id)
  })

  it('moving first question up is a no-op', () => {
    const exam = parsedToEditable(makeParsedExam())
    const id = exam.questions[0]!.id
    const updated = moveQuestion(exam, id, 'up')
    expect(updated.questions[0]!.id).toBe(id)
  })
})

describe('resetOutputNumbers', () => {
  it('renumbers to 1,2,3', () => {
    const exam = parsedToEditable(makeParsedExam())
    // Mess up numbers
    const messedUp = { questions: exam.questions.map((q, i) => ({ ...q, outputQuestionNumber: i + 10 })) }
    const { questions } = messedUp
    const renumbered = resetOutputNumbers(questions)
    expect(renumbered[0]!.outputQuestionNumber).toBe(1)
    expect(renumbered[1]!.outputQuestionNumber).toBe(2)
  })
})

// ─── Option mutations ─────────────────────────────────────────────────────────

describe('addOption', () => {
  it('appends a new option to the question', () => {
    const exam = parsedToEditable(makeParsedExam())
    const qId = exam.questions[0]!.id
    const updated = addOption(exam, qId)
    expect(updated.questions[0]!.options).toHaveLength(5)
  })

  it('new option has empty text and a unique id', () => {
    const exam = parsedToEditable(makeParsedExam())
    const qId = exam.questions[0]!.id
    const updated = addOption(exam, qId)
    const newOpt = updated.questions[0]!.options[4]!
    expect(newOpt.text).toBe('')
    expect(typeof newOpt.id).toBe('string')
  })
})

describe('deleteOption', () => {
  it('removes the target option', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const optToDelete = q.options[2]!.id
    const updated = deleteOption(exam, q.id, optToDelete)
    expect(updated.questions[0]!.options).toHaveLength(3)
    expect(updated.questions[0]!.options.find(o => o.id === optToDelete)).toBeUndefined()
  })

  it('sets correctOptionId to null when the correct option is deleted', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const correctId = q.correctOptionId!
    const updated = deleteOption(exam, q.id, correctId)
    expect(updated.questions[0]!.correctOptionId).toBeNull()
  })

  it('does not clear correctOptionId when a non-correct option is deleted', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const nonCorrectId = q.options.find(o => o.id !== q.correctOptionId)!.id
    const updated = deleteOption(exam, q.id, nonCorrectId)
    expect(updated.questions[0]!.correctOptionId).toBe(q.correctOptionId)
  })
})

describe('moveOption', () => {
  it('moves option up without changing correctOptionId', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const origCorrectId = q.correctOptionId
    const optToMove = q.options[2]!.id
    const updated = moveOption(exam, q.id, optToMove, 'up')
    expect(updated.questions[0]!.options[1]!.id).toBe(optToMove)
    expect(updated.questions[0]!.correctOptionId).toBe(origCorrectId)
  })

  it('8 options survive editableToParsed round trip', () => {
    const parsed: ParsedExam = {
      questions: [{
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה',
        options: Array.from({ length: 8 }, (_, i) => ({
          originalLabel: String(i), text: `תשובה ${i}`,
          originalIndex: i, isOriginalCorrectAnswer: i === 0,
        })),
        status: 'ok', hasVisualContent: false,
      }],
    }
    const back = editableToParsed(parsedToEditable(parsed))
    expect(back.questions[0]!.options).toHaveLength(8)
    expect(back.questions[0]!.options.filter(o => o.isOriginalCorrectAnswer)).toHaveLength(1)
  })
})

describe('updateOptionText', () => {
  it('updates option text without touching correctOptionId', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const optId = q.options[0]!.id
    const origCorrect = q.correctOptionId
    const updated = updateOptionText(exam, q.id, optId, 'טקסט חדש')
    expect(updated.questions[0]!.options[0]!.text).toBe('טקסט חדש')
    expect(updated.questions[0]!.correctOptionId).toBe(origCorrect)
  })
})

// ─── validateEditableExam ─────────────────────────────────────────────────────

describe('validateEditableExam', () => {
  it('no-correct-answer warning when correctOptionId is null', () => {
    const exam = parsedToEditable(makeParsedExam())
    const modified = { questions: [{ ...exam.questions[0]!, correctOptionId: null }] }
    const result = validateEditableExam(modified)
    expect(result.warnings.some(w => w.type === 'no-correct-answer')).toBe(true)
    expect(result.counts.noCorrectAnswer).toBeGreaterThan(0)
  })

  it('too-few-options warning when only 1 option', () => {
    const exam = parsedToEditable(makeParsedExam())
    const q = exam.questions[0]!
    const modified = {
      questions: [{ ...q, options: [q.options[0]!] }],
    }
    const result = validateEditableExam(modified)
    expect(result.warnings.some(w => w.type === 'too-few-options')).toBe(true)
    expect(result.counts.tooFewOptions).toBeGreaterThan(0)
  })

  it('empty-question-text warning when text is blank', () => {
    const exam = parsedToEditable(makeParsedExam())
    const modified = { questions: [{ ...exam.questions[0]!, text: '   ' }] }
    const result = validateEditableExam(modified)
    expect(result.warnings.some(w => w.type === 'empty-question-text')).toBe(true)
  })

  it('no warnings for valid exam', () => {
    const exam = parsedToEditable(makeParsedExam())
    const result = validateEditableExam(exam)
    expect(result.warnings.filter(w =>
      w.type === 'no-correct-answer' || w.type === 'too-few-options'
    )).toHaveLength(0)
  })

  it('counts.ok equals total questions when no warnings', () => {
    const exam = parsedToEditable(makeParsedExam())
    const result = validateEditableExam(exam)
    expect(result.counts.ok).toBe(2)
  })
})
