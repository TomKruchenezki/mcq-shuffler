import { shuffleArray } from './shuffleOptions'
import { HEBREW_LABELS } from './shuffleExam'
import type { AnswerKeyRow } from './shuffleExam'
import type {
  VisualQuestion,
  ShuffledVisualExam,
  ShuffledVisualQuestion,
  ShuffledVisualOption,
} from '@/lib/extract/pdfEngine/visualTypes'

const MAX_RESHUFFLE_ATTEMPTS = 10

function shuffleVisualQuestion(
  q: VisualQuestion,
  rng: () => number,
): ShuffledVisualQuestion {
  const opts = q.options

  // 0 or 1 options: assign labels, skip Fisher-Yates
  if (opts.length <= 1) {
    return {
      number: q.number,
      stemDataUrl: q.stemDataUrl,
      options: opts.map((opt, pos): ShuffledVisualOption => ({
        label: HEBREW_LABELS[pos] as string,
        originalIndex: opt.originalIndex,
        isCorrectAnswer: opt.isOriginalCorrectAnswer,
        dataUrl: opt.dataUrl,
        labelBox: opt.labelBox,
        approximateText: opt.approximateText,
      })),
    }
  }

  // 2+ options: Fisher-Yates with identity-permutation retry
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
    stemDataUrl: q.stemDataUrl,
    options: shuffledPositions.map((origIdx, newPos): ShuffledVisualOption => ({
      label: HEBREW_LABELS[newPos] as string,
      originalIndex: opts[origIdx].originalIndex,
      isCorrectAnswer: opts[origIdx].isOriginalCorrectAnswer,
      dataUrl: opts[origIdx].dataUrl,
      labelBox: opts[origIdx].labelBox,
      approximateText: opts[origIdx].approximateText,
    })),
  }
}

export function shuffleVisualExam(
  questions: VisualQuestion[],
  rng: () => number = Math.random,
): ShuffledVisualExam {
  return {
    questions: questions.map(q => shuffleVisualQuestion(q, rng)),
  }
}

export function generateVisualAnswerKey(exam: ShuffledVisualExam): AnswerKeyRow[] {
  return exam.questions.map(q => {
    const correct = q.options.find(o => o.isCorrectAnswer)!
    return {
      questionNumber: q.number,
      correctAnswerText: correct.approximateText || `תשובה ${correct.label}`,
      newCorrectLabel: correct.label,
      newCorrectIndex: q.options.indexOf(correct),
      originalCorrectIndex: 0,
    }
  })
}
