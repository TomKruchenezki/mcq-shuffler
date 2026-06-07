import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExamLibrary from '@/components/ExamLibrary'
import type { StoredExam } from '@/lib/storage/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('@/lib/storage/examStore', () => ({
  renameExam: vi.fn().mockResolvedValue(undefined),
  deleteExam: vi.fn().mockResolvedValue(undefined),
  duplicateExam: vi.fn().mockResolvedValue(undefined),
}))

import { useLiveQuery } from 'dexie-react-hooks'
import { deleteExam, duplicateExam, renameExam } from '@/lib/storage/examStore'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStoredExam(overrides?: Partial<StoredExam>): StoredExam {
  return {
    id: 'exam-1',
    title: 'מבחן לדוגמה',
    createdAt: 1_000_000,
    updatedAt: 2_000_000,
    sourceType: 'paste',
    status: 'parsed',
    editableExam: {
      questions: [
        {
          id: 'q1',
          outputQuestionNumber: 1,
          sequenceIndex: 0,
          text: 'שאלה ראשונה',
          options: [
            { id: 'o1', text: 'תשובה א' },
            { id: 'o2', text: 'תשובה ב' },
          ],
          correctOptionId: 'o1',
          reviewStatus: 'ok',
          hasVisualContent: false,
        },
        {
          id: 'q2',
          outputQuestionNumber: 2,
          sequenceIndex: 1,
          text: 'שאלה שנייה',
          options: [
            { id: 'o3', text: 'תשובה א' },
            { id: 'o4', text: 'תשובה ב' },
          ],
          correctOptionId: 'o3',
          reviewStatus: 'ok',
          hasVisualContent: false,
        },
      ],
    },
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useLiveQuery).mockReturnValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExamLibrary', () => {
  it('renders the header with exam count', () => {
    vi.mocked(useLiveQuery).mockReturnValue([makeStoredExam(), makeStoredExam({ id: 'exam-2', title: 'מבחן 2' })])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    expect(screen.getByText('המבחנים שלי (2)')).toBeInTheDocument()
  })

  it('shows a loading message while exams are undefined', () => {
    vi.mocked(useLiveQuery).mockReturnValue(undefined)
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    expect(screen.getByText(/טוען/)).toBeInTheDocument()
  })

  it('shows an empty state message when there are no exams', () => {
    vi.mocked(useLiveQuery).mockReturnValue([])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    expect(screen.getByText(/אין מבחנים שמורים/)).toBeInTheDocument()
  })

  it('renders each exam title and question count', () => {
    const exam = makeStoredExam({ title: 'מבחן ביולוגיה' })
    vi.mocked(useLiveQuery).mockReturnValue([exam])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    expect(screen.getByText('מבחן ביולוגיה')).toBeInTheDocument()
    expect(screen.getByText('2 שאלות')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    vi.mocked(useLiveQuery).mockReturnValue([makeStoredExam({ status: 'shuffled' })])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    expect(screen.getByText('עורבב')).toBeInTheDocument()
  })

  it('clicking פתח calls onLoad with the correct exam', () => {
    const exam = makeStoredExam()
    const onLoad = vi.fn()
    vi.mocked(useLiveQuery).mockReturnValue([exam])
    render(<ExamLibrary currentExamId={null} onLoad={onLoad} />)
    fireEvent.click(screen.getByText('פתח'))
    expect(onLoad).toHaveBeenCalledWith(exam)
  })

  it('clicking מחק triggers window.confirm then calls deleteExam on confirm', async () => {
    vi.mocked(useLiveQuery).mockReturnValue([makeStoredExam()])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    fireEvent.click(screen.getByText('מחק'))
    await waitFor(() => expect(deleteExam).toHaveBeenCalledWith('exam-1'))
  })

  it('clicking מחק and cancelling confirm does NOT call deleteExam', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(useLiveQuery).mockReturnValue([makeStoredExam()])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    fireEvent.click(screen.getByText('מחק'))
    await waitFor(() => expect(deleteExam).not.toHaveBeenCalled())
  })

  it('clicking שכפל calls duplicateExam', async () => {
    vi.mocked(useLiveQuery).mockReturnValue([makeStoredExam()])
    render(<ExamLibrary currentExamId={null} onLoad={() => {}} />)
    fireEvent.click(screen.getByText('שכפל'))
    await waitFor(() => expect(duplicateExam).toHaveBeenCalledWith('exam-1'))
  })

  it('current exam row has a visual highlight class', () => {
    const exam = makeStoredExam({ id: 'active-exam' })
    vi.mocked(useLiveQuery).mockReturnValue([exam])
    const { container } = render(<ExamLibrary currentExamId="active-exam" onLoad={() => {}} />)
    const row = container.querySelector('li')
    expect(row?.className).toContain('border-blue-500')
  })
})
