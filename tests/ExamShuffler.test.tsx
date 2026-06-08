import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ExamShuffler from '@/components/ExamShuffler'
import type { VisualExtractionResult } from '@/lib/extract/pdfEngine/visualTypes'

const { capturedProps, mockSaveExam, mockUpdateExam, mockDeriveStatus, mockUseLiveQuery, mockMigrateDraft } = vi.hoisted(() => ({
  capturedProps: { current: null as { onVisualExtracted?: (r: VisualExtractionResult) => void } | null },
  mockSaveExam: vi.fn(),
  mockUpdateExam: vi.fn(),
  mockDeriveStatus: vi.fn(),
  mockUseLiveQuery: vi.fn(),
  mockMigrateDraft: vi.fn(),
}))

vi.mock('@/components/FileUpload', () => ({
  default: (props: any) => {
    capturedProps.current = props
    return <div data-testid="mock-file-upload" />
  },
}))

vi.mock('@/lib/storage/examStore', () => ({
  saveExam: mockSaveExam,
  updateExam: mockUpdateExam,
  deriveStatus: mockDeriveStatus,
  loadExam: vi.fn(),
  listExams: vi.fn(),
  deleteExam: vi.fn(),
  renameExam: vi.fn(),
  duplicateExam: vi.fn(),
  saveShuffledExam: vi.fn(),
  autoTitle: vi.fn(),
}))

vi.mock('@/lib/storage/migrateDraft', () => ({
  migrateLocalStorageDraft: mockMigrateDraft,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: mockUseLiveQuery,
}))

const SAMPLE = `1. שאלה\nא. ראשון\nב. שני\nג. שלישי\nד. רביעי`

function makeVisualResult(): VisualExtractionResult {
  // stemDataUrl must be ≥100 chars to pass validateVisualResult's quality gate
  const validStemDataUrl = 'data:image/png;base64,' + 'A'.repeat(100)
  return {
    visualQuestions: [
      {
        number: 1,
        stemDataUrl: validStemDataUrl,
        options: [
          { originalIndex: 0, isOriginalCorrectAnswer: true, dataUrl: 'data:,optA', labelBox: { pdfRect: { x: 50, y: 100, width: 20, height: 12 }, labelChar: 'א' }, approximateText: 'א' },
          { originalIndex: 1, isOriginalCorrectAnswer: false, dataUrl: 'data:,optB', labelBox: { pdfRect: { x: 50, y: 80, width: 20, height: 12 }, labelChar: 'ב' }, approximateText: 'ב' },
        ],
        pageIndex: 0,
      },
    ],
  }
}

const MIXED = `1. הפונקציה getUserName מחזירה user_id=123\nא. string תקין\nב. null\nג. Exception\nד. number`

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('ExamShuffler', () => {
  beforeEach(() => {
    capturedProps.current = null
    mockSaveExam.mockResolvedValue({
      id: 'saved-id',
      title: 'מבחן 1',
      createdAt: 1000,
      updatedAt: 1000,
      sourceType: 'paste',
      status: 'parsed',
      editableExam: { questions: [] },
    })
    mockUpdateExam.mockResolvedValue(undefined)
    mockDeriveStatus.mockReturnValue('shuffled')
    mockUseLiveQuery.mockReturnValue([])
    mockMigrateDraft.mockResolvedValue(undefined)
  })

  it('renders Hebrew title', () => {
    render(<ExamShuffler />)
    expect(screen.getByText('מערבל תשובות אמריקאיות')).toBeInTheDocument()
  })

  it('renders textarea', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shuffle button is disabled initially', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).toBeDisabled()
  })

  it('parse button is disabled when textarea is empty', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('button', { name: 'נתח מבחן' })).toBeDisabled()
  })

  it('parse button becomes enabled when text is entered', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: 'some text' } })
    expect(screen.getByRole('button', { name: 'נתח מבחן' })).not.toBeDisabled()
  })

  it('shows warning when no questions are detected', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: 'some text with no questions' } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByText(/לא זוהו שאלות/)).toBeInTheDocument()
  })

  it('shows parse results heading after successful parse', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByText(/תוצאות ניתוח/)).toBeInTheDocument()
  })

  it('shuffle button becomes enabled after successful parse', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).not.toBeDisabled()
  })

  it('shows shuffled exam heading after shuffling', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    expect(screen.getAllByText('מבחן מעורבב').length).toBeGreaterThan(0)
  })

  it('shows answer key heading after shuffling', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    expect(screen.getByText('מפתח תשובות')).toBeInTheDocument()
  })

  it('mixed Hebrew-English-number content renders without error', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: MIXED } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    // getUserName appears in both textarea and parsed preview — just check it rendered
    expect(screen.getAllByText(/getUserName/).length).toBeGreaterThan(0)
  })

  it('reset clears shuffled state', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    fireEvent.click(screen.getByRole('button', { name: 'נקה הכל' }))
    expect(screen.queryByText('מבחן מעורבב')).not.toBeInTheDocument()
    expect(screen.queryByText('מפתח תשובות')).not.toBeInTheDocument()
  })

  it('reset clears textarea', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'נקה הכל' }))
    expect(getTextarea().value).toBe('')
  })

  it('shuffle button becomes enabled after onVisualExtracted fires', async () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).toBeDisabled()

    await act(async () => {
      capturedProps.current?.onVisualExtracted?.(makeVisualResult())
    })

    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).not.toBeDisabled()
  })

  it('after visual shuffle, "נאמנות גבוהה" badge appears', async () => {
    render(<ExamShuffler />)

    await act(async () => {
      capturedProps.current?.onVisualExtracted?.(makeVisualResult())
    })

    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    // Badge exact text from VisualShuffledExamView
    expect(screen.getByText('מצב: נאמנות גבוהה')).toBeInTheDocument()
  })

  it('reset clears visual state — badge disappears', async () => {
    render(<ExamShuffler />)

    await act(async () => {
      capturedProps.current?.onVisualExtracted?.(makeVisualResult())
    })

    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    expect(screen.getByText('מצב: נאמנות גבוהה')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'נקה הכל' }))
    expect(screen.queryByText('מצב: נאמנות גבוהה')).not.toBeInTheDocument()
  })

  it('quick-fill button populates textarea with sample text', () => {
    render(<ExamShuffler />)
    fireEvent.click(screen.getByRole('button', { name: 'טען דוגמה' }))
    expect(getTextarea().value.length).toBeGreaterThan(0)
    expect(getTextarea().value).toContain('getUserName')
  })

  it('shows confirm dialog before loading over a dirty exam', () => {
    // Return one exam from the library so the פתח button appears
    mockUseLiveQuery.mockReturnValue([{
      id: 'e1',
      title: 'מבחן קיים',
      status: 'parsed' as const,
      sourceType: 'paste' as const,
      questionCount: 1,
      createdAt: 1000,
      updatedAt: 1000,
      editableExam: { questions: [] },
    }])

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<ExamShuffler />)

    // Parse sample text so editableExam loads and ManualExamEditor appears
    fireEvent.change(screen.getByLabelText('הדבק כאן את המבחן'), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))

    // Edit a question in the ManualExamEditor → isDirty becomes true
    const qTextarea = screen.getByRole('textbox', { name: 'טקסט שאלה 1' })
    fireEvent.change(qTextarea, { target: { value: 'שינוי' } })

    // Open library panel
    fireEvent.click(screen.getByRole('button', { name: /פתח מבחנים שמורים/ }))

    // Click "פתח" on the exam row — should trigger confirm because isDirty=true
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }))

    expect(confirmSpy).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })

  it('auto-save on shuffle calls updateExam with the current editableExam', async () => {
    render(<ExamShuffler />)

    // Parse sample text so editableExam is loaded
    fireEvent.change(screen.getByLabelText('הדבק כאן את המבחן'), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))

    // Click "שמור מבחן" → saveExam mock resolves → currentExamId = 'saved-id'
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'שמור מבחן' }))
    })
    expect(mockSaveExam).toHaveBeenCalledOnce()

    // Edit a question so the exam is dirty
    const qTextarea = screen.getByRole('textbox', { name: 'טקסט שאלה 1' })
    fireEvent.change(qTextarea, { target: { value: 'שינוי' } })

    // Shuffle → handleShuffle is async; updateExam should be called with editableExam
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    })

    expect(mockUpdateExam).toHaveBeenCalledWith(
      'saved-id',
      expect.objectContaining({ editableExam: expect.any(Object) }),
    )
  })
})
