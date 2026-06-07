import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExportButtons from '@/components/ExportButtons'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'
import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'

function makeShuffledExam(): ShuffledExam {
  return {
    questions: [
      {
        number: 1,
        questionText: 'שאלה לדוגמה',
        outputQuestionNumber: 1,
        options: [
          { label: HEBREW_LABELS[0] as string, text: 'א', originalIndex: 0, isCorrectAnswer: true },
          { label: HEBREW_LABELS[1] as string, text: 'ב', originalIndex: 1, isCorrectAnswer: false },
        ],
      },
    ],
  }
}

describe('ExportButtons — PDF button', () => {
  beforeEach(() => {
    vi.stubGlobal('print', vi.fn())
  })

  it('is disabled when shuffledExam is null', () => {
    render(<ExportButtons shuffledExam={null} answerKey={null} />)
    const btn = screen.getByRole('button', { name: 'הורד מבחן כ-PDF' })
    expect(btn).toBeDisabled()
  })

  it('is enabled when shuffledExam is provided', () => {
    render(<ExportButtons shuffledExam={makeShuffledExam()} answerKey={[]} />)
    const btn = screen.getByRole('button', { name: 'הורד מבחן כ-PDF' })
    expect(btn).not.toBeDisabled()
  })

  it('calls window.print when PDF button is clicked', () => {
    render(<ExportButtons shuffledExam={makeShuffledExam()} answerKey={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'הורד מבחן כ-PDF' }))
    expect(window.print).toHaveBeenCalledOnce()
  })
})
