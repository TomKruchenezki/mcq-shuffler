import { shuffleArray } from './shuffleOptions'
import type { ParsedExam, ParsedQuestion } from '@/lib/parser/parseQuestions'

export const HEBREW_LABELS: readonly string[] = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
  'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
]

export interface ShuffledOption {
  label: string
  text: string
  originalIndex: number
  isCorrectAnswer: boolean
}

export interface ShuffledQuestion {
  number: number
  questionText: string
  options: ShuffledOption[]
  sequenceIndex?: number  // carried from ParsedQuestion; used for stable ordering references
}

export interface ShuffledExam {
  questions: ShuffledQuestion[]
}

export interface AnswerKeyRow {
  questionNumber: number
  correctAnswerText: string
  newCorrectLabel: string
  newCorrectIndex: number
  originalCorrectLabel?: string
  originalCorrectIndex?: number
}

const MAX_RESHUFFLE_ATTEMPTS = 10

function shuffleQuestion(q: ParsedQuestion, rng: () => number): ShuffledQuestion {
  const opts = q.options

  if (opts.length > HEBREW_LABELS.length) {
    throw new Error(
      `Question ${q.number} has ${opts.length} options but only ${HEBREW_LABELS.length} Hebrew labels are available`
    )
  }

  // 0 or 1 options: no shuffle needed, just assign labels
  if (opts.length <= 1) {
    return {
      number: q.number,
      questionText: q.questionText,
      options: opts.map((opt, pos) => ({
        label: HEBREW_LABELS[pos] as string,
        text: opt.text,
        originalIndex: opt.originalIndex,
        isCorrectAnswer: opt.isOriginalCorrectAnswer,
      })),
      sequenceIndex: q.sequenceIndex,
    }
  }

  // 2+ options: shuffle with identity-permutation retry
  const positions = opts.map((_, i) => i)
  let shuffledPositions = shuffleArray(positions, rng)

  for (
    let attempt = 1;
    attempt < MAX_RESHUFFLE_ATTEMPTS && shuffledPositions.every((v, i) => v === i);
    attempt++
  ) {
    shuffledPositions = shuffleArray(positions, rng)
  }

  return {
    number: q.number,
    questionText: q.questionText,
    options: shuffledPositions.map((origIdx, newPos) => ({
      label: HEBREW_LABELS[newPos] as string,
      text: opts[origIdx].text,
      originalIndex: opts[origIdx].originalIndex,
      isCorrectAnswer: opts[origIdx].isOriginalCorrectAnswer,
    })),
    sequenceIndex: q.sequenceIndex,
  }
}

export function shuffleExam(exam: ParsedExam, rng: () => number = Math.random): ShuffledExam {
  return {
    questions: exam.questions.map(q => shuffleQuestion(q, rng)),
  }
}

export function generateAnswerKey(exam: ShuffledExam): AnswerKeyRow[] {
  const rows: AnswerKeyRow[] = []
  for (const q of exam.questions) {
    const correct = q.options.find(o => o.isCorrectAnswer)
    if (correct === undefined) continue
    rows.push({
      questionNumber: q.number,
      correctAnswerText: correct.text,
      newCorrectLabel: correct.label,
      newCorrectIndex: q.options.indexOf(correct),
      originalCorrectIndex: 0,
    })
  }
  return rows
}
