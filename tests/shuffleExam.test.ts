import { describe, it, expect } from 'vitest'
import { shuffleExam, generateAnswerKey, HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'
import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'
import type { ParsedExam, ParsedOption, ParsedQuestion } from '@/lib/parser/parseQuestions'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeLcg(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function makeOption(text: string, originalIndex: number): ParsedOption {
  return {
    originalLabel: HEBREW_LABELS[originalIndex] ?? 'א',
    text,
    originalIndex,
    isOriginalCorrectAnswer: originalIndex === 0,
  }
}

function makeQuestion(num: number, text: string, opts: string[]): ParsedQuestion {
  return {
    number: num,
    questionText: text,
    options: opts.map((t, i) => makeOption(t, i)),
  }
}

function makeExam(...questions: ParsedQuestion[]): ParsedExam {
  return { questions }
}

// RNG that produces identity permutation for any array (swaps each element with itself)
const alwaysIdentityRng = () => 0.9999

// RNG that produces rotation [1,2,3,0] for 4 elements (always swaps with position 0)
const alwaysSwapRng = () => 0

// ─── HEBREW_LABELS constant ───────────────────────────────────────────────────

describe('HEBREW_LABELS', () => {
  it('has 22 labels', () => {
    expect(HEBREW_LABELS).toHaveLength(22)
  })

  it('starts with alef (U+05D0)', () => {
    expect(HEBREW_LABELS[0]).toBe('א')
  })

  it('ends with tav (U+05EA)', () => {
    expect(HEBREW_LABELS[21]).toBe('ת')
  })

  it('contains all 22 Hebrew letters in order', () => {
    expect(Array.from(HEBREW_LABELS)).toEqual([
      'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
      'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
    ])
  })
})

// ─── shuffleExam — structure preservation ────────────────────────────────────

describe('shuffleExam — structure preservation', () => {
  const exam = makeExam(
    makeQuestion(1, 'שאלה ראשונה', ['נכון', 'לא נכון', 'אולי', 'תלוי']),
    makeQuestion(2, 'שאלה שניה', ['A', 'B', 'C']),
    makeQuestion(3, 'שאלה שלישית', ['כן', 'לא']),
  )

  it('question count is unchanged', () => {
    const { questions } = shuffleExam(exam, alwaysSwapRng)
    expect(questions).toHaveLength(3)
  })

  it('question order is unchanged', () => {
    const { questions } = shuffleExam(exam, alwaysSwapRng)
    expect(questions.map(q => q.number)).toEqual([1, 2, 3])
  })

  it('question text is unchanged for all questions', () => {
    const { questions } = shuffleExam(exam, alwaysSwapRng)
    expect(questions[0].questionText).toBe('שאלה ראשונה')
    expect(questions[1].questionText).toBe('שאלה שניה')
    expect(questions[2].questionText).toBe('שאלה שלישית')
  })

  it('option count per question is unchanged', () => {
    const { questions } = shuffleExam(exam, alwaysSwapRng)
    expect(questions[0].options).toHaveLength(4)
    expect(questions[1].options).toHaveLength(3)
    expect(questions[2].options).toHaveLength(2)
  })

  it('multi-line question text is passed through verbatim', () => {
    const multiLineQ: ParsedQuestion = {
      number: 1,
      questionText: 'שורה ראשונה\nשורה שניה\nשורה שלישית',
      options: [makeOption('A', 0), makeOption('B', 1)],
    }
    const shuffled = shuffleExam(makeExam(multiLineQ))
    expect(shuffled.questions[0].questionText).toBe('שורה ראשונה\nשורה שניה\nשורה שלישית')
  })
})

// ─── shuffleExam — option content preservation ───────────────────────────────

describe('shuffleExam — option content preservation', () => {
  const q = makeQuestion(1, 'Q', ['נכון', 'לא נכון', 'אולי', 'תלוי'])
  const exam = makeExam(q)

  it('same set of option texts after shuffle', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const origTexts = q.options.map(o => o.text).sort()
    const shuffTexts = shuffled.questions[0].options.map(o => o.text).sort()
    expect(shuffTexts).toEqual(origTexts)
  })

  it('mixed Hebrew-English-number text unchanged', () => {
    const mixedQ = makeQuestion(1, 'Q', [
      'הפונקציה getUserName מקבלת user_id=123',
      'SELECT * FROM users WHERE id = 5',
      'accuracy=95%, precision=80%',
      'DELETE FROM users',
    ])
    const shuffled = shuffleExam(makeExam(mixedQ), alwaysSwapRng)
    const origTexts = mixedQ.options.map(o => o.text).sort()
    const shuffTexts = shuffled.questions[0].options.map(o => o.text).sort()
    expect(shuffTexts).toEqual(origTexts)
  })

  it('option text after shuffle is verbatim — no RTL marks injected', () => {
    const q2 = makeQuestion(1, 'Q', ['value=42', 'value=0', 'null'])
    const shuffled = shuffleExam(makeExam(q2), alwaysSwapRng)
    for (const opt of shuffled.questions[0].options) {
      expect(opt.text).not.toContain('‪') // LTR embedding
      expect(opt.text).not.toContain('‬') // pop directional formatting
      expect(opt.text).not.toContain('‏') // RLM
      expect(opt.text).not.toContain('‎') // LRM
    }
  })

  it('originalIndex is preserved from the parsed option', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const originalIndices = shuffled.questions[0].options.map(o => o.originalIndex).sort((a, b) => a - b)
    expect(originalIndices).toEqual([0, 1, 2, 3])
  })
})

// ─── shuffleExam — Hebrew output labels ──────────────────────────────────────

describe('shuffleExam — Hebrew output labels', () => {
  it('labels are regenerated as Hebrew regardless of input labels', () => {
    // Parser might produce English labels (A, B, C, D) — output must be Hebrew
    const q = makeQuestion(1, 'Q', ['First', 'Second', 'Third', 'Fourth'])
    q.options[0].originalLabel = 'A'
    q.options[1].originalLabel = 'B'
    q.options[2].originalLabel = 'C'
    q.options[3].originalLabel = 'D'
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const labels = shuffled.questions[0].options.map(o => o.label)
    expect(labels).toEqual(['א', 'ב', 'ג', 'ד'])
  })

  it('labels are sequential from א regardless of shuffle order', () => {
    const q = makeQuestion(1, 'Q', ['A', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const labels = shuffled.questions[0].options.map(o => o.label)
    expect(labels).toEqual(['א', 'ב', 'ג', 'ד'])
  })

  it('six-option question uses labels up to ו', () => {
    const q = makeQuestion(1, 'Q', ['A', 'B', 'C', 'D', 'E', 'F'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const labels = shuffled.questions[0].options.map(o => o.label)
    expect(labels).toEqual(['א', 'ב', 'ג', 'ד', 'ה', 'ו'])
  })

  it('five-option question uses labels up to ה', () => {
    const q = makeQuestion(1, 'Q', ['A', 'B', 'C', 'D', 'E'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const labels = shuffled.questions[0].options.map(o => o.label)
    expect(labels).toEqual(['א', 'ב', 'ג', 'ד', 'ה'])
    expect(shuffled.questions[0].options).toHaveLength(5)
  })

  it('five-option question — correct answer tracked after shuffle', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D', 'E'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const correct = shuffled.questions[0].options.find(o => o.isCorrectAnswer)
    expect(correct?.text).toBe('CORRECT')
    expect(HEBREW_LABELS).toContain(correct?.label)
  })

  it('throws if more than 22 options', () => {
    const opts = Array.from({ length: 23 }, (_, i) => `opt${i}`)
    const q = makeQuestion(1, 'Q', opts)
    expect(() => shuffleExam(makeExam(q))).toThrow()
  })
})

// ─── shuffleExam — variable option counts ────────────────────────────────────

describe('shuffleExam — variable option counts', () => {
  // alwaysSwapRng with n options: shuffleArray([0..n-1], () => 0) → [1,2,...,n-1,0]
  // Correct answer (originalIndex 0) always ends at last position (index n-1)

  it.each([2, 3, 4, 5, 6, 7, 8])('%i-option question — no crash', (count) => {
    const opts = Array.from({ length: count }, (_, i) => `opt${i}`)
    const q = makeQuestion(1, 'Q', opts)
    expect(() => shuffleExam(makeExam(q))).not.toThrow()
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('%i-option question — labels are sequential from א', (count) => {
    const opts = Array.from({ length: count }, (_, i) => `opt${i}`)
    const q = makeQuestion(1, 'Q', opts)
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const labels = shuffled.questions[0].options.map(o => o.label)
    expect(labels).toEqual(Array.from(HEBREW_LABELS).slice(0, count))
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('%i-option question — correct answer tracked', (count) => {
    const opts = Array.from({ length: count }, (_, i) => i === 0 ? 'CORRECT' : `opt${i}`)
    const q = makeQuestion(1, 'Q', opts)
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const correct = shuffled.questions[0].options.find(o => o.isCorrectAnswer)
    expect(correct?.text).toBe('CORRECT')
  })

  it('8-option question — correct answer ends at position 7 with label ח', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const opts = shuffled.questions[0].options
    expect(opts[7].text).toBe('CORRECT')
    expect(opts[7].isCorrectAnswer).toBe(true)
    expect(opts[7].label).toBe('ח')
  })

  it('8-option answer key row — newCorrectLabel is ח, newCorrectIndex is 7', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(row.newCorrectLabel).toBe('ח')
    expect(row.newCorrectIndex).toBe(7)
    expect(row.correctAnswerText).toBe('CORRECT')
  })
})

// ─── shuffleExam — correct answer tracking ───────────────────────────────────

describe('shuffleExam — correct answer tracking', () => {
  // With alwaysSwapRng and 4 options [0,1,2,3] → shuffledPositions = [1,2,3,0]
  // So: pos0=opts[1], pos1=opts[2], pos2=opts[3], pos3=opts[0]=correct
  const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
  const exam = makeExam(q)

  it('exactly one option per question has isCorrectAnswer=true', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const correctOpts = shuffled.questions[0].options.filter(o => o.isCorrectAnswer)
    expect(correctOpts).toHaveLength(1)
  })

  it('the correct option has the text of the original first option', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const correct = shuffled.questions[0].options.find(o => o.isCorrectAnswer)
    expect(correct?.text).toBe('CORRECT')
  })

  it('other options have isCorrectAnswer=false', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const wrong = shuffled.questions[0].options.filter(o => !o.isCorrectAnswer)
    expect(wrong).toHaveLength(3)
    expect(wrong.every(o => o.text !== 'CORRECT')).toBe(true)
  })

  it('correct answer (originalIndex 0) moves to the last position with alwaysSwapRng', () => {
    // [1,2,3,0] permutation: correct answer ends at position 3
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const opts = shuffled.questions[0].options
    expect(opts[3].text).toBe('CORRECT')
    expect(opts[3].isCorrectAnswer).toBe(true)
    expect(opts[3].label).toBe('ד')
  })

  it('correct answer tracking works across multiple questions', () => {
    const exam2 = makeExam(
      makeQuestion(1, 'Q1', ['CORRECT_1', 'B', 'C']),
      makeQuestion(2, 'Q2', ['CORRECT_2', 'X', 'Y', 'Z']),
    )
    const shuffled = shuffleExam(exam2, alwaysSwapRng)
    const correct1 = shuffled.questions[0].options.find(o => o.isCorrectAnswer)
    const correct2 = shuffled.questions[1].options.find(o => o.isCorrectAnswer)
    expect(correct1?.text).toBe('CORRECT_1')
    expect(correct2?.text).toBe('CORRECT_2')
  })
})

// ─── shuffleExam — shuffle behavior and seeding ───────────────────────────────

describe('shuffleExam — shuffle behavior', () => {
  const q = makeQuestion(1, 'Q', ['A', 'B', 'C', 'D'])
  const exam = makeExam(q)

  it('seeded mode is deterministic — same seed produces same result', () => {
    const r1 = shuffleExam(exam, makeLcg(42))
    const r2 = shuffleExam(exam, makeLcg(42))
    expect(r1).toEqual(r2)
  })

  it('different seeds can produce different results', () => {
    const results = [7, 42, 99, 123, 456, 999].map(seed =>
      shuffleExam(exam, makeLcg(seed)).questions[0].options.map(o => o.text).join(',')
    )
    const unique = new Set(results)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('default mode (no seed) does not crash', () => {
    expect(() => shuffleExam(exam)).not.toThrow()
  })

  it('option order changes with alwaysSwapRng (non-identity permutation)', () => {
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const texts = shuffled.questions[0].options.map(o => o.text)
    // [1,2,3,0] permutation: [B, C, D, A] — not the original [A, B, C, D]
    expect(texts).not.toEqual(['A', 'B', 'C', 'D'])
    expect(texts).toEqual(['B', 'C', 'D', 'A'])
  })

  it('retries if first shuffle produces identity', () => {
    // First 3 calls produce 0.9999 (identity for 4 elements), then 0 (swap)
    let call = 0
    const identityThenSwap = () => {
      call++
      return call <= 3 ? 0.9999 : 0
    }
    const shuffled = shuffleExam(exam, identityThenSwap)
    const texts = shuffled.questions[0].options.map(o => o.text)
    expect(texts).not.toEqual(['A', 'B', 'C', 'D'])
  })

  it('falls back to identity after max retries if RNG always produces identity', () => {
    const shuffled = shuffleExam(exam, alwaysIdentityRng)
    const texts = shuffled.questions[0].options.map(o => o.text)
    // Identity fallback: same order as input
    expect(texts).toEqual(['A', 'B', 'C', 'D'])
    // But answer key still correct (correct answer at position 0)
    const key = generateAnswerKey(shuffled as ShuffledExam)
    expect(key[0].correctAnswerText).toBe('A')
    expect(key[0].newCorrectIndex).toBe(0)
  })

  it('shuffle does not mutate the input exam', () => {
    const origTexts = exam.questions[0].options.map(o => o.text)
    shuffleExam(exam, alwaysSwapRng)
    const afterTexts = exam.questions[0].options.map(o => o.text)
    expect(afterTexts).toEqual(origTexts)
  })
})

// ─── shuffleExam — edge cases ─────────────────────────────────────────────────

describe('shuffleExam — edge cases', () => {
  it('zero questions — no crash, returns empty exam', () => {
    const result = shuffleExam({ questions: [] })
    expect(result.questions).toHaveLength(0)
  })

  it('question with zero options — no crash', () => {
    const q: ParsedQuestion = { number: 1, questionText: 'Q', options: [] }
    const result = shuffleExam(makeExam(q))
    expect(result.questions[0].options).toHaveLength(0)
  })

  it('question with one option — no crash, label is א', () => {
    const q = makeQuestion(1, 'Q', ['בלעדי'])
    const result = shuffleExam(makeExam(q))
    expect(result.questions[0].options).toHaveLength(1)
    expect(result.questions[0].options[0].label).toBe('א')
    expect(result.questions[0].options[0].text).toBe('בלעדי')
    expect(result.questions[0].options[0].isCorrectAnswer).toBe(true)
  })

  it('question with two options — no crash, both labels assigned', () => {
    const q = makeQuestion(1, 'Q', ['כן', 'לא'])
    const result = shuffleExam(makeExam(q))
    const labels = result.questions[0].options.map(o => o.label)
    expect(labels).toContain('א')
    expect(labels).toContain('ב')
  })
})

// ─── generateAnswerKey ────────────────────────────────────────────────────────

describe('generateAnswerKey', () => {
  it('returns one row per question with options', () => {
    const exam = makeExam(
      makeQuestion(1, 'Q1', ['CORRECT_1', 'B', 'C']),
      makeQuestion(2, 'Q2', ['CORRECT_2', 'X']),
    )
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const key = generateAnswerKey(shuffled)
    expect(key).toHaveLength(2)
  })

  it('correctAnswerText matches the correct shuffled option text', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(row.correctAnswerText).toBe('CORRECT')
  })

  it('newCorrectLabel is a Hebrew letter', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(HEBREW_LABELS).toContain(row.newCorrectLabel)
  })

  it('newCorrectIndex matches position in options array', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(shuffled.questions[0].options[row.newCorrectIndex].isCorrectAnswer).toBe(true)
    expect(shuffled.questions[0].options[row.newCorrectIndex].text).toBe('CORRECT')
  })

  it('newCorrectLabel equals label of the correct option in the shuffled exam', () => {
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(shuffled.questions[0].options[row.newCorrectIndex].label).toBe(row.newCorrectLabel)
  })

  it('question numbers in key match original question numbers', () => {
    const exam = makeExam(
      makeQuestion(5, 'Q5', ['A', 'B']),
      makeQuestion(10, 'Q10', ['X', 'Y', 'Z']),
    )
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const key = generateAnswerKey(shuffled)
    expect(key.map(r => r.questionNumber)).toEqual([5, 10])
  })

  it('question with zero options is excluded from answer key', () => {
    const exam = makeExam(
      makeQuestion(1, 'Q1', []),
      makeQuestion(2, 'Q2', ['CORRECT', 'B']),
    )
    const shuffled = shuffleExam(exam)
    const key = generateAnswerKey(shuffled)
    expect(key).toHaveLength(1)
    expect(key[0].questionNumber).toBe(2)
  })

  it('complete answer key row structure for a deterministic shuffle', () => {
    // alwaysSwapRng produces [1,2,3,0] for 4 options:
    // CORRECT (originalIndex 0) ends at position 3 with label ד
    const q = makeQuestion(1, 'Q', ['CORRECT', 'B', 'C', 'D'])
    const shuffled = shuffleExam(makeExam(q), alwaysSwapRng)
    const [row] = generateAnswerKey(shuffled)
    expect(row).toEqual({
      questionNumber: 1,
      correctAnswerText: 'CORRECT',
      newCorrectLabel: 'ד',
      newCorrectIndex: 3,
      originalCorrectIndex: 0,
    })
  })

  it('originalCorrectIndex is 0 in every row', () => {
    const exam = makeExam(
      makeQuestion(1, 'Q1', ['C1', 'B', 'C']),
      makeQuestion(2, 'Q2', ['C2', 'X', 'Y']),
    )
    const shuffled = shuffleExam(exam, alwaysSwapRng)
    const key = generateAnswerKey(shuffled)
    for (const row of key) {
      expect(row.originalCorrectIndex).toBe(0)
    }
  })
})
