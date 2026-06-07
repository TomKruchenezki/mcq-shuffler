import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintableExam from '@/components/PrintableExam'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'
import type { ShuffledExam, ShuffledOption, ShuffledQuestion } from '@/lib/shuffle/shuffleExam'

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
    outputQuestionNumber: num,
    options: texts.map((t, i) => makeOption(t, i)),
  }
}

function makeExam(optionGroups: string[][]): ShuffledExam {
  return {
    questions: optionGroups.map((texts, i) => makeQuestion(i + 1, texts)),
  }
}

describe('PrintableExam', () => {
  it('renders question text', () => {
    const exam = makeExam([['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד']])
    render(<PrintableExam exam={exam} />)
    expect(screen.getByText(/שאלה 1/)).toBeInTheDocument()
  })

  it('renders shuffled option labels as Hebrew letters', () => {
    const exam = makeExam([['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד']])
    render(<PrintableExam exam={exam} />)
    // First four Hebrew labels should be present
    expect(screen.getByText('א.')).toBeInTheDocument()
    expect(screen.getByText('ב.')).toBeInTheDocument()
    expect(screen.getByText('ג.')).toBeInTheDocument()
    expect(screen.getByText('ד.')).toBeInTheDocument()
  })

  it('does not render answer key content', () => {
    const exam = makeExam([['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד']])
    render(<PrintableExam exam={exam} />)
    expect(screen.queryByText(/מפתח תשובות/)).not.toBeInTheDocument()
    expect(screen.queryByText(/תשובה נכונה/)).not.toBeInTheDocument()
    expect(screen.queryByText(/isCorrectAnswer/)).not.toBeInTheDocument()
  })

  it('supports 8-option questions without crashing', () => {
    const texts = Array.from({ length: 8 }, (_, i) => `אפשרות ${i + 1}`)
    const exam = makeExam([texts])
    render(<PrintableExam exam={exam} />)
    // Label for position 7 should be 'ח' (8th Hebrew letter)
    expect(screen.getByText('ח.')).toBeInTheDocument()
  })

  it('preserves mixed Hebrew-English-number-SQL option text verbatim', () => {
    const exam = makeExam([[
      'SELECT * FROM users WHERE id = 5',
      'היא מחזירה null',
      'accuracy=95%, precision=80%',
      'user_id=123 מחזיר string',
    ]])
    render(<PrintableExam exam={exam} />)
    expect(screen.getByText('SELECT * FROM users WHERE id = 5')).toBeInTheDocument()
    expect(screen.getByText('היא מחזירה null')).toBeInTheDocument()
    expect(screen.getByText('accuracy=95%, precision=80%')).toBeInTheDocument()
  })

  it('does not mutate shuffled exam data', () => {
    const exam = makeExam([['א', 'ב', 'ג', 'ד']])
    const snapshot = JSON.stringify(exam)
    render(<PrintableExam exam={exam} />)
    expect(JSON.stringify(exam)).toBe(snapshot)
  })

  it('option text spans have unicodeBidi plaintext style', () => {
    const exam = makeExam([['ערך נכון', 'ערך שגוי']])
    const { container } = render(<PrintableExam exam={exam} />)
    const lis = container.querySelectorAll('li')
    lis.forEach(li => {
      const spans = li.querySelectorAll('span')
      const textSpan = spans[spans.length - 1]  // last span = option text (first = label)
      expect(textSpan).toHaveStyle({ unicodeBidi: 'plaintext' })
    })
  })

  it('option text spans have whiteSpace pre-wrap style', () => {
    const exam = makeExam([['ערך נכון', 'ערך שגוי']])
    const { container } = render(<PrintableExam exam={exam} />)
    const lis = container.querySelectorAll('li')
    lis.forEach(li => {
      const spans = li.querySelectorAll('span')
      const textSpan = spans[spans.length - 1]
      expect(textSpan).toHaveStyle({ whiteSpace: 'pre-wrap' })
    })
  })

  it('does not inject hidden direction marks into rendered option text', () => {
    const text = 'SELECT * FROM users WHERE id = 5'
    const exam: ShuffledExam = {
      questions: [makeQuestion(1, [text, 'אפשרות ב'])],
    }
    render(<PrintableExam exam={exam} />)
    // screen.getByText would fail if wrapLtr were accidentally called (adds U+202A/U+202C)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(exam.questions[0].options[0].text).toBe(text)
  })
})
