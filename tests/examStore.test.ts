import { describe, it, expect, beforeEach } from 'vitest'
import { getDb } from '@/lib/storage/db'
import {
  saveExam,
  loadExam,
  listExams,
  updateExam,
  deleteExam,
  renameExam,
  duplicateExam,
  saveShuffledExam,
  deriveStatus,
  autoTitle,
} from '@/lib/storage/examStore'
import type { EditableExam } from '@/lib/editor/editableExam'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEditableExam(questionCount = 2): EditableExam {
  return {
    questions: Array.from({ length: questionCount }, (_, i) => ({
      id: crypto.randomUUID(),
      outputQuestionNumber: i + 1,
      sequenceIndex: i,
      text: `שאלה ${i + 1}`,
      options: [
        { id: crypto.randomUUID(), text: 'תשובה א' },
        { id: crypto.randomUUID(), text: 'תשובה ב' },
      ],
      correctOptionId: null,
      reviewStatus: 'ok' as const,
      hasVisualContent: false,
    })),
  }
}

const MOCK_SHUFFLED: ShuffledExam = {
  questions: [{
    number: 1,
    questionText: 'שאלה 1',
    outputQuestionNumber: 1,
    options: [{ label: 'א', text: 'תשובה', originalIndex: 0, isCorrectAnswer: true }],
  }],
}

const MOCK_KEY: AnswerKeyRow[] = [{
  questionNumber: 1,
  correctAnswerText: 'תשובה',
  newCorrectLabel: 'א',
  newCorrectIndex: 0,
}]

// ─── Setup: clear tables before each test ────────────────────────────────────

beforeEach(async () => {
  await getDb().exams.clear()
})

// ─── saveExam ─────────────────────────────────────────────────────────────────

describe('saveExam', () => {
  it('creates a record with a unique id, timestamps, and default status', async () => {
    const editableExam = makeEditableExam()
    const stored = await saveExam({ editableExam })

    expect(stored.id).toBeTruthy()
    expect(stored.createdAt).toBeGreaterThan(0)
    expect(stored.updatedAt).toBeGreaterThan(0)
    expect(stored.status).toBe('parsed')
    expect(stored.sourceType).toBe('paste')
  })

  it('auto-generates title from first question text when no title or fileName provided', async () => {
    const editableExam = makeEditableExam()
    const stored = await saveExam({ editableExam })

    expect(stored.title).toBe('שאלה 1')
  })

  it('auto-generates title from sourceFileName, stripping extension', async () => {
    const editableExam = makeEditableExam()
    const stored = await saveExam({ editableExam, sourceFileName: 'biology_exam.pdf' })

    expect(stored.title).toBe('biology_exam')
  })

  it('uses explicit title when provided', async () => {
    const editableExam = makeEditableExam()
    const stored = await saveExam({ editableExam, title: 'מבחן ביולוגיה' })

    expect(stored.title).toBe('מבחן ביולוגיה')
  })

  it('persists the record — loadExam returns the same data', async () => {
    const editableExam = makeEditableExam()
    const stored = await saveExam({ editableExam, title: 'מבחן לדוגמה' })

    const loaded = await loadExam(stored.id)
    expect(loaded).toBeDefined()
    expect(loaded!.id).toBe(stored.id)
    expect(loaded!.title).toBe('מבחן לדוגמה')
    expect(loaded!.editableExam.questions).toHaveLength(2)
  })
})

// ─── loadExam ─────────────────────────────────────────────────────────────────

describe('loadExam', () => {
  it('returns undefined for an unknown id', async () => {
    const result = await loadExam('does-not-exist')
    expect(result).toBeUndefined()
  })
})

// ─── listExams ────────────────────────────────────────────────────────────────

describe('listExams', () => {
  it('returns all exams ordered by updatedAt descending', async () => {
    const a = await saveExam({ editableExam: makeEditableExam(), title: 'ראשון' })
    // Ensure a slightly later timestamp for b
    await new Promise(r => setTimeout(r, 5))
    const b = await saveExam({ editableExam: makeEditableExam(), title: 'שני' })

    const list = await listExams()
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(b.id) // newer first
    expect(list[1].id).toBe(a.id)
  })
})

// ─── updateExam ───────────────────────────────────────────────────────────────

describe('updateExam', () => {
  it('updates the specified fields and refreshes updatedAt', async () => {
    const stored = await saveExam({ editableExam: makeEditableExam(), title: 'ישן' })
    const before = stored.updatedAt

    await new Promise(r => setTimeout(r, 5))
    await updateExam(stored.id, { title: 'חדש' })

    const loaded = await loadExam(stored.id)
    expect(loaded!.title).toBe('חדש')
    expect(loaded!.updatedAt).toBeGreaterThan(before)
  })
})

// ─── deleteExam ───────────────────────────────────────────────────────────────

describe('deleteExam', () => {
  it('removes the record so loadExam returns undefined', async () => {
    const stored = await saveExam({ editableExam: makeEditableExam() })
    await deleteExam(stored.id)
    expect(await loadExam(stored.id)).toBeUndefined()
  })
})

// ─── renameExam ───────────────────────────────────────────────────────────────

describe('renameExam', () => {
  it('updates only the title field', async () => {
    const stored = await saveExam({ editableExam: makeEditableExam(), title: 'לפני' })
    await renameExam(stored.id, 'אחרי')

    const loaded = await loadExam(stored.id)
    expect(loaded!.title).toBe('אחרי')
    // Other fields untouched
    expect(loaded!.status).toBe(stored.status)
  })
})

// ─── duplicateExam ────────────────────────────────────────────────────────────

describe('duplicateExam', () => {
  it('creates a new record with a different id and appended (עותק) in the title', async () => {
    const original = await saveExam({ editableExam: makeEditableExam(), title: 'מבחן' })
    const copy = await duplicateExam(original.id)

    expect(copy.id).not.toBe(original.id)
    expect(copy.title).toBe('מבחן (עותק)')
    expect(copy.editableExam.questions).toHaveLength(original.editableExam.questions.length)
  })

  it('throws for an unknown id', async () => {
    await expect(duplicateExam('no-such-id')).rejects.toThrow()
  })
})

// ─── saveShuffledExam ─────────────────────────────────────────────────────────

describe('saveShuffledExam', () => {
  it('attaches shuffledExam, answerKey and sets status to shuffled', async () => {
    const stored = await saveExam({ editableExam: makeEditableExam() })
    await saveShuffledExam(stored.id, MOCK_SHUFFLED, MOCK_KEY)

    const loaded = await loadExam(stored.id)
    expect(loaded!.shuffledExam).toEqual(MOCK_SHUFFLED)
    expect(loaded!.answerKey).toEqual(MOCK_KEY)
    expect(loaded!.status).toBe('shuffled')
  })
})

// ─── Image round-trip ─────────────────────────────────────────────────────────

describe('image data URL round-trip', () => {
  it('preserves visualImageDataUrl on options through save and load', async () => {
    const dataUrl = 'data:image/png;base64,ABC123'
    const editableExam: EditableExam = {
      questions: [{
        id: crypto.randomUUID(),
        outputQuestionNumber: 1,
        sequenceIndex: 0,
        text: 'שאלה עם תמונה',
        options: [
          { id: crypto.randomUUID(), text: '', visualImageDataUrl: dataUrl },
          { id: crypto.randomUUID(), text: 'תשובה ב' },
        ],
        correctOptionId: null,
        reviewStatus: 'ok',
        hasVisualContent: false,
      }],
    }
    const stored = await saveExam({ editableExam })
    const loaded = await loadExam(stored.id)
    expect(loaded!.editableExam.questions[0].options[0].visualImageDataUrl).toBe(dataUrl)
  })
})

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns shuffled when hasShuffled is true', () => {
    expect(deriveStatus(makeEditableExam(), true)).toBe('shuffled')
  })

  it('returns edited when any question has reviewStatus manually-edited', () => {
    const exam = makeEditableExam()
    exam.questions[0].reviewStatus = 'manually-edited'
    expect(deriveStatus(exam, false)).toBe('edited')
  })

  it('returns parsed when no editing and no shuffle', () => {
    expect(deriveStatus(makeEditableExam(), false)).toBe('parsed')
  })
})

describe('autoTitle', () => {
  it('returns filename without extension when sourceFileName is provided', () => {
    expect(autoTitle(makeEditableExam(), 'history_test.docx')).toBe('history_test')
  })

  it('returns first question text (up to 40 chars) when no sourceFileName', () => {
    expect(autoTitle(makeEditableExam())).toBe('שאלה 1')
  })

  it('returns fallback label for empty exam', () => {
    expect(autoTitle({ questions: [] })).toBe('מבחן ללא שם')
  })
})
