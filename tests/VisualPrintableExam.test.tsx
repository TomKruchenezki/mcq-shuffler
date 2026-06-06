import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import VisualPrintableExam from '@/components/VisualPrintableExam'
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
            originalIndex: 1,
            isCorrectAnswer: false,
            dataUrl: 'data:image/png;base64,optA',
            labelBox: { pdfRect: { x: 50, y: 100, width: 20, height: 12 }, labelChar: 'א' },
            approximateText: 'ראשון',
          },
          {
            label: 'ב',
            originalIndex: 2,
            isCorrectAnswer: false,
            dataUrl: 'data:image/png;base64,optB',
            labelBox: { pdfRect: { x: 50, y: 80, width: 20, height: 12 }, labelChar: 'ב' },
            approximateText: 'שני',
          },
          {
            label: 'ג',
            originalIndex: 0,
            isCorrectAnswer: true,
            dataUrl: 'data:image/png;base64,optC',
            labelBox: { pdfRect: { x: 50, y: 60, width: 20, height: 12 }, labelChar: 'ג' },
            approximateText: 'שלישי',
          },
          {
            label: 'ד',
            originalIndex: 3,
            isCorrectAnswer: false,
            dataUrl: 'data:image/png;base64,optD',
            labelBox: { pdfRect: { x: 50, y: 40, width: 20, height: 12 }, labelChar: 'ד' },
            approximateText: 'רביעי',
          },
        ],
      },
    ],
  }
}

describe('VisualPrintableExam', () => {
  it('renders img for each stem', () => {
    render(<VisualPrintableExam exam={makeExam()} />)
    expect(screen.getByAltText('שאלה 1')).toBeInTheDocument()
  })

  it('renders img for each option', () => {
    render(<VisualPrintableExam exam={makeExam()} />)
    expect(screen.getByAltText('תשובה א')).toBeInTheDocument()
    expect(screen.getByAltText('תשובה ד')).toBeInTheDocument()
  })

  it('Hebrew labels א–ד appear before option images', () => {
    render(<VisualPrintableExam exam={makeExam()} />)
    expect(screen.getByText('א.')).toBeInTheDocument()
    expect(screen.getByText('ב.')).toBeInTheDocument()
    expect(screen.getByText('ג.')).toBeInTheDocument()
    expect(screen.getByText('ד.')).toBeInTheDocument()
  })

  it('renders default title "מבחן מעורבב"', () => {
    render(<VisualPrintableExam exam={makeExam()} />)
    expect(screen.getByText('מבחן מעורבב')).toBeInTheDocument()
  })

  it('renders custom title prop', () => {
    render(<VisualPrintableExam exam={makeExam()} title="בחינה חזרה" />)
    expect(screen.getByText('בחינה חזרה')).toBeInTheDocument()
  })
})
