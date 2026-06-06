import { describe, it, expect } from 'vitest'
import { exportDocx } from '@/lib/export/exportDocx'
import type { ShuffledExam, ShuffledQuestion, ShuffledOption } from '@/lib/shuffle/shuffleExam'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'

function makeOption(text: string, pos: number): ShuffledOption {
  return {
    label: HEBREW_LABELS[pos] as string,
    text,
    originalIndex: pos,
    isCorrectAnswer: pos === 0,
  }
}

function makeQuestion(num: number, texts: string[]): ShuffledQuestion {
  return {
    number: num,
    questionText: `שאלה ${num}`,
    options: texts.map((t, i) => makeOption(t, i)),
  }
}

function makeShuffledExam(optCount: number): ShuffledExam {
  const texts = Array.from({ length: optCount }, (_, i) => `אפשרות ${i + 1}`)
  return { questions: [makeQuestion(1, texts)] }
}

describe('exportDocx', () => {
  it('resolves to a Blob', async () => {
    const blob = await exportDocx(makeShuffledExam(4))
    expect(blob).toBeInstanceOf(Blob)
  })

  it('Blob is non-empty', async () => {
    const blob = await exportDocx(makeShuffledExam(4))
    expect(blob.size).toBeGreaterThan(0)
  })

  it('works with 2-option question', async () => {
    await expect(exportDocx(makeShuffledExam(2))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 4-option question', async () => {
    await expect(exportDocx(makeShuffledExam(4))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 6-option question', async () => {
    await expect(exportDocx(makeShuffledExam(6))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 8-option question', async () => {
    await expect(exportDocx(makeShuffledExam(8))).resolves.toBeInstanceOf(Blob)
  })

  it('works with Hebrew-only option text', async () => {
    const exam: ShuffledExam = {
      questions: [makeQuestion(1, ['ערך נכון', 'ערך שגוי', 'אולי', 'תלוי'])],
    }
    await expect(exportDocx(exam)).resolves.toBeInstanceOf(Blob)
  })

  it('works with mixed Hebrew-English-number-SQL option text', async () => {
    const exam: ShuffledExam = {
      questions: [
        makeQuestion(1, [
          'SELECT * FROM users WHERE id = 5',
          'היא מחזירה null',
          'accuracy=95%, precision=80%',
          'user_id=123 מחזיר string',
        ]),
      ],
    }
    await expect(exportDocx(exam)).resolves.toBeInstanceOf(Blob)
  })

  it('does not mutate the input ShuffledExam', async () => {
    const exam = makeShuffledExam(4)
    const snapshot = JSON.stringify(exam)
    await exportDocx(exam)
    expect(JSON.stringify(exam)).toBe(snapshot)
  })

  it('does not mutate ShuffledQuestion objects', async () => {
    const exam = makeShuffledExam(4)
    const qSnapshot = JSON.stringify(exam.questions[0])
    await exportDocx(exam)
    expect(JSON.stringify(exam.questions[0])).toBe(qSnapshot)
  })

  it('accepts a custom title without crashing', async () => {
    await expect(exportDocx(makeShuffledExam(3), 'מבחן מתמטיקה')).resolves.toBeInstanceOf(Blob)
  })
})
