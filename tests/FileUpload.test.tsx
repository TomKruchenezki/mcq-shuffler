import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import FileUpload from '@/components/FileUpload'

const { mockExtractDocxText, mockExtractPdfText } = vi.hoisted(() => ({
  mockExtractDocxText: vi.fn(),
  mockExtractPdfText: vi.fn(),
}))

vi.mock('@/lib/extract/extractDocx', () => ({ extractDocxText: mockExtractDocxText }))
vi.mock('@/lib/extract/extractPdf', () => ({ extractPdfText: mockExtractPdfText }))

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
      expect(onExtracted).toHaveBeenCalledWith('שאלה 1\nא. כן\nב. לא')
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
    expect(mockExtractPdfText).not.toHaveBeenCalled()
  })
})
