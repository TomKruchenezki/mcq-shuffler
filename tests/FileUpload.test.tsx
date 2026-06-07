import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import FileUpload from '@/components/FileUpload'

const { mockExtractDocxText, mockExtractPdfHybrid, mockExtractPdfVisual } = vi.hoisted(() => ({
  mockExtractDocxText: vi.fn(),
  mockExtractPdfHybrid: vi.fn(),
  mockExtractPdfVisual: vi.fn(),
}))

vi.mock('@/lib/extract/extractDocx', () => ({ extractDocxText: mockExtractDocxText }))
vi.mock('@/lib/extract/pdfEngine/extractPdfHybrid', () => ({
  extractPdfHybrid: mockExtractPdfHybrid,
}))
vi.mock('@/lib/extract/pdfEngine/extractPdfVisual', () => ({
  extractPdfVisual: mockExtractPdfVisual,
}))

function uploadFile(input: Element, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  })
  fireEvent.change(input)
}

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 25 does not implement Blob.prototype.arrayBuffer — polyfill for tests
    ;(Blob.prototype as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))
  })

  afterEach(() => {
    delete (Blob.prototype as any).arrayBuffer
  })

  it('renders upload label text', () => {
    render(<FileUpload onExtracted={() => {}} />)
    expect(screen.getByText(/קבצים נתמכים/)).toBeInTheDocument()
  })

  it('calls onExtracted with text from a DOCX file', async () => {
    mockExtractDocxText.mockResolvedValue({ text: 'שאלה 1\nא. כן\nב. לא' })
    const onExtracted = vi.fn()
    render(<FileUpload onExtracted={onExtracted} />)

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy docx bytes'], 'exam.docx'))
    })

    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalledWith('שאלה 1\nא. כן\nב. לא', { fileName: 'exam.docx', sourceType: 'docx' })
    })
  })

  it('shows Hebrew error when the extractor reports an error', async () => {
    mockExtractDocxText.mockResolvedValue({ text: '', error: 'לא ניתן לחלץ טקסט' })
    render(<FileUpload onExtracted={() => {}} />)

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy'], 'exam.docx'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('לא ניתן לחלץ טקסט')
    })
  })

  it('shows Hebrew error for an unsupported file extension', async () => {
    render(<FileUpload onExtracted={() => {}} />)

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy'], 'exam.xyz'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(mockExtractDocxText).not.toHaveBeenCalled()
    expect(mockExtractPdfHybrid).not.toHaveBeenCalled()
  })

  it('renders PDF mode selector with three options', () => {
    render(<FileUpload onExtracted={() => {}} />)
    expect(screen.getByText('אוטומטי')).toBeInTheDocument()
    expect(screen.getByText('טקסט מהיר')).toBeInTheDocument()
    expect(screen.getByText('OCR מקומי')).toBeInTheDocument()
  })

  it('PDF mode selector defaults to אוטומטי', () => {
    render(<FileUpload onExtracted={() => {}} />)
    const autoRadio = screen.getByDisplayValue('auto')
    expect(autoRadio).toBeChecked()
  })

  it('PDF mode selector shows 4 options including נאמנות גבוהה', () => {
    render(<FileUpload onExtracted={() => {}} />)
    expect(screen.getByText('אוטומטי')).toBeInTheDocument()
    expect(screen.getByText('טקסט מהיר')).toBeInTheDocument()
    expect(screen.getByText('OCR מקומי')).toBeInTheDocument()
    expect(screen.getByText('נאמנות גבוהה')).toBeInTheDocument()
  })

  it('calls onExtracted with text extracted from a PDF file', async () => {
    mockExtractPdfHybrid.mockResolvedValue({
      text: 'שאלה 1\nא. כן\nב. לא',
      quality: {
        pages: 1,
        textItems: 10,
        chars: 20,
        detectedQuestionMarkers: 1,
        detectedOptionMarkers: 2,
        suspiciousJoinedWords: 0,
        hasEnoughLineBreaks: true,
      },
    })
    const onExtracted = vi.fn()
    render(<FileUpload onExtracted={onExtracted} />)

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy pdf bytes'], 'exam.pdf'))
    })

    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalledWith('שאלה 1\nא. כן\nב. לא', { fileName: 'exam.pdf', sourceType: 'pdf' })
    })
    expect(mockExtractPdfHybrid).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'auto',
      expect.any(Function),
    )
  })

  it('visual mode calls extractPdfVisual, not extractPdfHybrid', async () => {
    // Return a non-empty result so the fallback is not triggered
    mockExtractPdfVisual.mockResolvedValue({
      visualQuestions: [{ number: 1, stemDataUrl: 'data:,stem', options: [
        { originalIndex: 0, isOriginalCorrectAnswer: true, dataUrl: 'data:,opt',
          labelBox: { pdfRect: { x: 0, y: 0, width: 10, height: 10 }, labelChar: 'א' },
          approximateText: 'תשובה' },
      ], pageIndex: 0 }],
    })
    render(<FileUpload onExtracted={() => {}} />)

    fireEvent.click(screen.getByDisplayValue('visual'))

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy pdf'], 'exam.pdf'))
    })

    await waitFor(() => {
      expect(mockExtractPdfVisual).toHaveBeenCalled()
    })
    expect(mockExtractPdfHybrid).not.toHaveBeenCalled()
  })

  it('visual mode falls back to text extraction when no questions are detected', async () => {
    mockExtractPdfVisual.mockResolvedValue({ visualQuestions: [], warning: 'לא זוהו שאלות' })
    mockExtractPdfHybrid.mockResolvedValue({ text: 'שאלה 1\nא. כן\nב. לא', quality: null })
    const onExtracted = vi.fn()
    render(<FileUpload onExtracted={onExtracted} />)

    fireEvent.click(screen.getByDisplayValue('visual'))

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy pdf'], 'exam.pdf'))
    })

    await waitFor(() => {
      expect(mockExtractPdfVisual).toHaveBeenCalled()
      expect(mockExtractPdfHybrid).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'auto', undefined)
      expect(onExtracted).toHaveBeenCalled()
    })
  })

  it('visual mode calls onVisualExtracted with VisualExtractionResult', async () => {
    const visualResult = {
      visualQuestions: [
        {
          number: 1,
          stemDataUrl: 'data:,stem',
          options: [],
          pageIndex: 0,
        },
      ],
    }
    mockExtractPdfVisual.mockResolvedValue(visualResult)
    const onVisualExtracted = vi.fn()
    render(<FileUpload onExtracted={() => {}} onVisualExtracted={onVisualExtracted} />)

    fireEvent.click(screen.getByDisplayValue('visual'))

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy pdf'], 'exam.pdf'))
    })

    await waitFor(() => {
      expect(onVisualExtracted).toHaveBeenCalledWith(visualResult)
    })
  })

  it('complexity hint banner appears when result has hasImages=true', async () => {
    mockExtractPdfHybrid.mockResolvedValue({
      text: 'שאלה 1\nא. כן\nב. לא',
      quality: {
        pages: 1,
        textItems: 10,
        chars: 200,
        detectedQuestionMarkers: 1,
        detectedOptionMarkers: 2,
        suspiciousJoinedWords: 0,
        hasEnoughLineBreaks: true,
      },
      complexity: {
        hasImages: true,
        hasTables: false,
        hasMultiColumnText: false,
        hasFormulas: false,
      },
    })
    render(<FileUpload onExtracted={() => {}} />)

    const input = document.querySelector('input[type="file"]')!
    await act(async () => {
      uploadFile(input, new File(['dummy pdf'], 'exam.pdf'))
    })

    await waitFor(() => {
      expect(screen.getByText(/זוהה מבנה מורכב/)).toBeInTheDocument()
    })
  })

  it('no crash when onVisualExtracted prop is absent and visual mode used', async () => {
    mockExtractPdfVisual.mockResolvedValue({ visualQuestions: [] })
    render(<FileUpload onExtracted={() => {}} />)

    fireEvent.click(screen.getByDisplayValue('visual'))

    const input = document.querySelector('input[type="file"]')!
    await expect(
      act(async () => {
        uploadFile(input, new File(['dummy pdf'], 'exam.pdf'))
      }),
    ).resolves.not.toThrow()

    await waitFor(() => {
      expect(mockExtractPdfVisual).toHaveBeenCalled()
    })
  })

  it('shows large-PDF warning text before OCR pages are processed', async () => {
    // extractPdfOcr emits onProgress(0, N) before page 1 starts for large PDFs.
    // The deferred promise keeps ocrProgress alive long enough to assert the UI.
    let resolveExtract!: (v: any) => void
    mockExtractPdfHybrid.mockImplementation(async (_buf, _mode, onProgress) => {
      onProgress?.(0, 15)  // pre-OCR large-PDF signal
      return new Promise(resolve => { resolveExtract = resolve })
    })

    render(<FileUpload onExtracted={() => {}} />)
    const input = document.querySelector('input[type="file"]')!
    // Start upload without awaiting — inspect mid-flight state
    act(() => { uploadFile(input, new File(['dummy pdf'], 'exam.pdf')) })

    await waitFor(() => {
      expect(screen.getByText(/קובץ PDF גדול/)).toBeInTheDocument()
    })

    // Resolve the deferred promise to clean up
    await act(async () => {
      resolveExtract({ text: '', quality: null })
    })
  })
})
