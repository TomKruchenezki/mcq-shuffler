import { describe, it, expect } from 'vitest'
import { shuffleVisualExam, generateVisualAnswerKey } from '@/lib/shuffle/shuffleVisualExam'
import type { VisualQuestion, VisualOption } from '@/lib/extract/pdfEngine/visualTypes'

function makeOption(index: number): VisualOption {
  return {
    originalIndex: index,
    isOriginalCorrectAnswer: index === 0,
    dataUrl: `data:image/png;base64,option${index}`,
    labelBox: {
      pdfRect: { x: 50, y: 100, width: 20, height: 12 },
      labelChar: ['א', 'ב', 'ג', 'ד'][index] ?? 'ה',
    },
    approximateText: `תשובה ${index + 1}`,
  }
}

function makeQuestion(n: number, optionCount = 4): VisualQuestion {
  return {
    number: n,
    stemDataUrl: `data:image/png;base64,stem${n}`,
    options: Array.from({ length: optionCount }, (_, i) => makeOption(i)),
    pageIndex: 0,
  }
}

// Deterministic RNG — seeded counter that won't produce identity permutations
function makeSeededRng(start = 0.3) {
  let v = start
  return () => {
    v = (v * 17 + 0.1) % 1
    return v
  }
}

describe('shuffleVisualExam', () => {
  it('returns same number of questions after shuffle', () => {
    const questions = [makeQuestion(1), makeQuestion(2)]
    const result = shuffleVisualExam(questions)
    expect(result.questions).toHaveLength(2)
  })

  it('returns same option count per question after shuffle', () => {
    const questions = [makeQuestion(1, 4)]
    const result = shuffleVisualExam(questions)
    expect(result.questions[0].options).toHaveLength(4)
  })

  it('dataUrl is preserved verbatim after shuffle', () => {
    const questions = [makeQuestion(1, 4)]
    const original = questions[0].options.map(o => o.dataUrl)
    const result = shuffleVisualExam(questions)
    const shuffled = result.questions[0].options.map(o => o.dataUrl)
    // Every original dataUrl must appear in shuffled
    for (const url of original) {
      expect(shuffled).toContain(url)
    }
  })

  it('exactly one isCorrectAnswer per question', () => {
    const questions = [makeQuestion(1, 4)]
    const result = shuffleVisualExam(questions)
    const correct = result.questions[0].options.filter(o => o.isCorrectAnswer)
    expect(correct).toHaveLength(1)
  })

  it('isCorrectAnswer tracks the option with originalIndex === 0', () => {
    const questions = [makeQuestion(1, 4)]
    const result = shuffleVisualExam(questions)
    const correct = result.questions[0].options.find(o => o.isCorrectAnswer)!
    expect(correct.originalIndex).toBe(0)
  })

  it('labels are assigned from Hebrew alphabet', () => {
    const questions = [makeQuestion(1, 4)]
    const result = shuffleVisualExam(questions)
    const labels = result.questions[0].options.map(o => o.label)
    expect(labels).toContain('א')
    expect(labels).toContain('ב')
    expect(labels).toContain('ג')
    expect(labels).toContain('ד')
  })

  it('seeded RNG produces deterministic output', () => {
    const questions = [makeQuestion(1, 4)]
    const rng1 = makeSeededRng(0.31)
    const rng2 = makeSeededRng(0.31)
    const r1 = shuffleVisualExam(questions, rng1)
    const r2 = shuffleVisualExam(questions, rng2)
    expect(r1.questions[0].options.map(o => o.originalIndex)).toEqual(
      r2.questions[0].options.map(o => o.originalIndex),
    )
  })

  it('does NOT mutate the input VisualQuestion array', () => {
    const questions = [makeQuestion(1, 4)]
    const originalLabels = questions[0].options.map(o => o.labelBox.labelChar)
    shuffleVisualExam(questions)
    expect(questions[0].options.map(o => o.labelBox.labelChar)).toEqual(originalLabels)
  })

  it('zero-option question does not crash', () => {
    const questions = [makeQuestion(1, 0)]
    expect(() => shuffleVisualExam(questions)).not.toThrow()
  })

  it('one-option question does not crash and assigns label', () => {
    const questions = [makeQuestion(1, 1)]
    const result = shuffleVisualExam(questions)
    expect(result.questions[0].options[0].label).toBe('א')
  })

  it('generateVisualAnswerKey returns one row per question', () => {
    const questions = [makeQuestion(1), makeQuestion(2)]
    const exam = shuffleVisualExam(questions)
    const key = generateVisualAnswerKey(exam)
    expect(key).toHaveLength(2)
    expect(key[0].questionNumber).toBe(1)
    expect(key[1].questionNumber).toBe(2)
  })

  it('generateVisualAnswerKey newCorrectLabel matches isCorrectAnswer option', () => {
    const questions = [makeQuestion(1, 4)]
    const exam = shuffleVisualExam(questions)
    const key = generateVisualAnswerKey(exam)
    const correct = exam.questions[0].options.find(o => o.isCorrectAnswer)!
    expect(key[0].newCorrectLabel).toBe(correct.label)
  })
})
