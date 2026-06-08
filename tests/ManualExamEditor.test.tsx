import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ManualExamEditor from '@/components/ManualExamEditor'
import type { EditableExam, EditableQuestion } from '@/lib/editor/editableExam'
import { parsedToEditable } from '@/lib/editor/editableExam'
import type { ParsedExam } from '@/lib/parser/parseQuestions'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeParsedExam(): ParsedExam {
  return {
    questions: [
      {
        number: 1, sequenceIndex: 0, outputQuestionNumber: 1,
        questionText: 'שאלה 1', hasVisualContent: false,
        options: [
          { originalLabel: 'א', text: 'תשובה א', originalIndex: 0, isOriginalCorrectAnswer: true },
          { originalLabel: 'ב', text: 'תשובה ב', originalIndex: 1, isOriginalCorrectAnswer: false },
          { originalLabel: 'ג', text: 'תשובה ג', originalIndex: 2, isOriginalCorrectAnswer: false },
          { originalLabel: 'ד', text: 'תשובה ד', originalIndex: 3, isOriginalCorrectAnswer: false },
        ],
        status: 'ok',
      },
      {
        number: 2, sequenceIndex: 1, outputQuestionNumber: 2,
        questionText: 'שאלה 2', hasVisualContent: false,
        options: [
          { originalLabel: 'א', text: 'ב1', originalIndex: 0, isOriginalCorrectAnswer: false },
          { originalLabel: 'ב', text: 'ב2', originalIndex: 1, isOriginalCorrectAnswer: true },
        ],
        status: 'ok',
      },
    ],
  }
}

function makeExam(): EditableExam {
  return parsedToEditable(makeParsedExam())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ManualExamEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders question count in section heading', () => {
    render(<ManualExamEditor exam={makeExam()} onChange={() => {}} />)
    expect(screen.getByText(/2 שאלות/)).toBeInTheDocument()
  })

  it('renders global action buttons', () => {
    render(<ManualExamEditor exam={makeExam()} onChange={() => {}} />)
    expect(screen.getByText('+ הוסף שאלה')).toBeInTheDocument()
    expect(screen.getByText('אפס מספור')).toBeInTheDocument()
    expect(screen.getByText('סמן הכל כבדוק')).toBeInTheDocument()
    expect(screen.getByText('שמור טיוטה')).toBeInTheDocument()
  })

  it('editing question text calls onChange with updated text', () => {
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    const textareas = screen.getAllByRole('textbox')
    const firstQTextarea = textareas.find(
      el => (el as HTMLTextAreaElement).value === 'שאלה 1',
    )!
    fireEvent.change(firstQTextarea, { target: { value: 'שאלה חדשה' } })

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions[0]!.text).toBe('שאלה חדשה')
  })

  it('editing option text calls onChange with updated option', () => {
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    // Find the option text inputs (type=text, not textareas)
    const optionInputs = screen.getAllByRole('textbox').filter(
      el => el.tagName === 'INPUT',
    ) as HTMLInputElement[]
    const targetInput = optionInputs.find(el => el.value === 'תשובה א')!
    fireEvent.change(targetInput, { target: { value: 'תשובה ערוכה' } })

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    const allOptionTexts = updated.questions.flatMap(q => q.options.map(o => o.text))
    expect(allOptionTexts).toContain('תשובה ערוכה')
  })

  it('clicking הוסף שאלה calls onChange with one more question', () => {
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    fireEvent.click(screen.getByText('+ הוסף שאלה'))

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions).toHaveLength(3)
  })

  it('deleting a question with confirmed prompt calls onChange with one fewer', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    const deleteButtons = screen.getAllByTitle('מחק שאלה')
    fireEvent.click(deleteButtons[0]!)

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions).toHaveLength(1)
  })

  it('deleting a question with declined prompt does not call onChange', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    const deleteButtons = screen.getAllByTitle('מחק שאלה')
    fireEvent.click(deleteButtons[0]!)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('changing correct-answer radio calls onChange with updated correctOptionId', () => {
    const exam = makeExam()
    const onChange = vi.fn()
    render(<ManualExamEditor exam={exam} onChange={onChange} />)

    // Find all radios for the first question's radio group
    const q = exam.questions[0]!
    const radios = screen.getAllByRole('radio')
    // Click the radio for the second option of the first question
    const secondOptionRadio = radios[1]!  // index 1 = second option of question 1
    fireEvent.click(secondOptionRadio)

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions[0]!.correctOptionId).toBe(q.options[1]!.id)
  })

  it('אפס מספור button calls onChange with sequential numbers', () => {
    // Create an exam with scrambled numbers
    const exam = makeExam()
    const scrambled: EditableExam = {
      questions: exam.questions.map((q, i) => ({
        ...q,
        outputQuestionNumber: i + 10,
      })),
    }
    const onChange = vi.fn()
    render(<ManualExamEditor exam={scrambled} onChange={onChange} />)

    fireEvent.click(screen.getByText('אפס מספור'))

    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions[0]!.outputQuestionNumber).toBe(1)
    expect(updated.questions[1]!.outputQuestionNumber).toBe(2)
  })

  it('renders empty-state message when exam has no questions', () => {
    render(<ManualExamEditor exam={{ questions: [] }} onChange={() => {}} />)
    expect(screen.getByText(/אין שאלות/)).toBeInTheDocument()
  })

  it('question with visualImageDataUrl renders image preview and מחק תמונה button', () => {
    const exam = makeExam()
    const examWithImg: EditableExam = {
      questions: exam.questions.map((q, i) =>
        i === 0 ? { ...q, visualImageDataUrl: 'data:image/png;base64,qtest' } : q,
      ),
    }
    render(<ManualExamEditor exam={examWithImg} onChange={() => {}} />)
    expect(screen.getByAltText('תמונה לשאלה')).toBeInTheDocument()
    expect(screen.getByText('מחק תמונה')).toBeInTheDocument()
  })

  it('clicking מחק תמונה calls onChange with undefined visualImageDataUrl', () => {
    const exam = makeExam()
    const examWithImg: EditableExam = {
      questions: exam.questions.map((q, i) =>
        i === 0 ? { ...q, visualImageDataUrl: 'data:image/png;base64,qtest' } : q,
      ),
    }
    const onChange = vi.fn()
    render(<ManualExamEditor exam={examWithImg} onChange={onChange} />)
    fireEvent.click(screen.getByText('מחק תמונה'))
    expect(onChange).toHaveBeenCalledOnce()
    const updated: EditableExam = onChange.mock.calls[0][0]
    expect(updated.questions[0]!.visualImageDataUrl).toBeUndefined()
  })

  it('option with visualImageDataUrl renders image thumbnail', () => {
    const exam = makeExam()
    const q = exam.questions[0]!
    const examWithImg: EditableExam = {
      questions: exam.questions.map((eq, i) =>
        i !== 0 ? eq : {
          ...eq,
          options: eq.options.map((o, oi) =>
            oi === 0 ? { ...o, visualImageDataUrl: 'data:image/png;base64,otest' } : o,
          ),
        },
      ),
    }
    render(<ManualExamEditor exam={examWithImg} onChange={() => {}} />)
    // The first option of question 1 has label 'א'
    expect(screen.getByAltText(`תמונה לתשובה א`)).toBeInTheDocument()
    // Suppress unused variable warning
    void q
  })

  it('missing-visual-content question shows orange alert with image button', () => {
    const exam = makeExam()
    const examWithMVC: EditableExam = {
      questions: exam.questions.map((q, i) =>
        i !== 0 ? q : { ...q, reviewStatus: 'missing-visual-content' as const },
      ),
    }
    render(<ManualExamEditor exam={examWithMVC} onChange={() => {}} />)
    // Orange alert should be present
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/ייתכן שחסר תוכן חזותי\/קוד/)).toBeInTheDocument()
    // The action button to add screenshot
    expect(screen.getByText(/הוסף\/הדבק צילום מסך לשאלה/)).toBeInTheDocument()
  })

  it('✂ split button is present on each question card', () => {
    render(<ManualExamEditor exam={makeExam()} onChange={() => {}} />)
    // One ✂ button per question
    const splitButtons = screen.getAllByTitle(/פצל לשאלה חדשה/)
    expect(splitButtons).toHaveLength(2)
  })

  it('⊞ merge button is absent on the first card and present on subsequent cards', () => {
    render(<ManualExamEditor exam={makeExam()} onChange={() => {}} />)
    // Only question 2 (qIdx=1) has the merge button
    const mergeButtons = screen.getAllByTitle(/אחד עם השאלה/)
    expect(mergeButtons).toHaveLength(1)
  })

  it('after image attached to missing-visual-content card, alert disappears', () => {
    const exam = makeExam()
    const q = exam.questions[0]!
    const examWithMVC: EditableExam = {
      questions: exam.questions.map((eq, i) =>
        i !== 0 ? eq : { ...eq, reviewStatus: 'missing-visual-content' as const },
      ),
    }
    // Simulate the exam already having an image (as if the user already attached one)
    const examWithImg: EditableExam = {
      questions: examWithMVC.questions.map(eq =>
        eq.id !== q.id ? eq : { ...eq, visualImageDataUrl: 'data:image/png;base64,new' },
      ),
    }
    render(<ManualExamEditor exam={examWithImg} onChange={() => {}} />)
    // The alert should NOT appear when a visualImageDataUrl is already set
    expect(screen.queryByText(/ייתכן שחסר תוכן חזותי\/קוד/)).not.toBeInTheDocument()
    expect(screen.getByAltText('תמונה לשאלה')).toBeInTheDocument()
  })
})
