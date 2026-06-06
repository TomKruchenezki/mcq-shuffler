import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import VisualShuffledExamView from '@/components/VisualShuffledExamView'
import type { ShuffledVisualExam } from '@/lib/extract/pdfEngine/visualTypes'

function makeExam(): ShuffledVisualExam {
  return {
    questions: [
      {
        number: 1,
        stemDataUrl: 'data:image/png;base64,stem1',
        options: [
          {
            label: 'א',
            originalIndex: 2,
            isCorrectAnswer: false,
            dataUrl: 'data:image/png;base64,optA',
            labelBox: { pdfRect: { x: 50, y: 100, width: 20, height: 12 }, labelChar: 'א' },
            approximateText: 'תשובה א',
          },
          {
            label: 'ב',
            originalIndex: 0,
            isCorrectAnswer: true,
            dataUrl: 'data:image/png;base64,optB',
            labelBox: { pdfRect: { x: 50, y: 80, width: 20, height: 12 }, labelChar: 'ב' },
            approximateText: 'תשובה ב',
          },
        ],
      },
    ],
  }
}

describe('VisualShuffledExamView', () => {
  it('renders an img for the question stem', () => {
    render(<VisualShuffledExamView exam={makeExam()} />)
    const stems = screen.getAllByAltText(/שאלה 1/)
    expect(stems.length).toBeGreaterThan(0)
    expect(stems[0].tagName).toBe('IMG')
  })

  it('renders an img for each option', () => {
    render(<VisualShuffledExamView exam={makeExam()} />)
    expect(screen.getByAltText('תשובה א')).toBeInTheDocument()
    expect(screen.getByAltText('תשובה ב')).toBeInTheDocument()
  })

  it('renders Hebrew label before each option', () => {
    render(<VisualShuffledExamView exam={makeExam()} />)
    expect(screen.getByText('א.')).toBeInTheDocument()
    expect(screen.getByText('ב.')).toBeInTheDocument()
  })

  it('section has dir="rtl"', () => {
    const { container } = render(<VisualShuffledExamView exam={makeExam()} />)
    const section = container.querySelector('section')
    expect(section?.getAttribute('dir')).toBe('rtl')
  })

  it('renders the "נאמנות גבוהה" mode badge', () => {
    render(<VisualShuffledExamView exam={makeExam()} />)
    expect(screen.getByText(/נאמנות גבוהה/)).toBeInTheDocument()
  })

  it('renders one article per question', () => {
    const exam: ShuffledVisualExam = {
      questions: [
        { ...makeExam().questions[0], number: 1 },
        { ...makeExam().questions[0], number: 2, stemDataUrl: 'data:image/png;base64,stem2' },
      ],
    }
    const { container } = render(<VisualShuffledExamView exam={exam} />)
    expect(container.querySelectorAll('article')).toHaveLength(2)
  })
})
