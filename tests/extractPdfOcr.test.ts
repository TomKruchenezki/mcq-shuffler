import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRenderPdfPage, mockOcrPdfPage, mockCreateWorker, mockGetDocument } = vi.hoisted(
  () => ({
    mockRenderPdfPage: vi.fn(),
    mockOcrPdfPage: vi.fn(),
    mockCreateWorker: vi.fn(),
    mockGetDocument: vi.fn(),
  }),
)

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
  default: { GlobalWorkerOptions: { workerSrc: '' }, getDocument: mockGetDocument },
}))

vi.mock('@/lib/extract/pdfEngine/renderPdfPage', () => ({
  renderPdfPage: mockRenderPdfPage,
}))

vi.mock('@/lib/extract/pdfEngine/ocrPdfPage', () => ({
  ocrPdfPage: mockOcrPdfPage,
}))

vi.mock('tesseract.js', () => ({
  createWorker: mockCreateWorker,
}))

import { extractPdfOcr } from '@/lib/extract/pdfEngine/extractPdfOcr'

const mockWorker = {
  recognize: vi.fn(),
  terminate: vi.fn().mockResolvedValue(undefined),
}

function makeMockPdf(numPages: number) {
  return {
    numPages,
    getPage: vi.fn().mockResolvedValue({}),
  }
}

describe('extractPdfOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateWorker.mockResolvedValue(mockWorker)
    mockRenderPdfPage.mockResolvedValue({} as HTMLCanvasElement)
    mockOcrPdfPage.mockResolvedValue('שאלה 1\nא. כן\nב. לא')
    mockWorker.terminate.mockResolvedValue(undefined)
  })

  it('returns OCR text in result.text', async () => {
    const pdf = makeMockPdf(1)

    const result = await extractPdfOcr(pdf as any)

    expect(result.text).toContain('שאלה')
    expect(result.error).toBeUndefined()
  })

  it('calls onProgress once per page with correct index and total', async () => {
    const pdf = makeMockPdf(3)
    const onProgress = vi.fn()

    await extractPdfOcr(pdf as any, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenCalledWith(1, 3)
    expect(onProgress).toHaveBeenCalledWith(2, 3)
    expect(onProgress).toHaveBeenCalledWith(3, 3)
  })

  it('terminates the Tesseract worker after extraction', async () => {
    const pdf = makeMockPdf(1)

    await extractPdfOcr(pdf as any)

    expect(mockWorker.terminate).toHaveBeenCalled()
  })

  it('extracted text contains original tokens unchanged (no reversal)', async () => {
    mockOcrPdfPage.mockResolvedValue('getUserName שאלה 1')
    const pdf = makeMockPdf(1)

    const result = await extractPdfOcr(pdf as any)

    expect(result.text).toContain('getUserName')
    expect(result.text).toContain('שאלה')
  })
})
