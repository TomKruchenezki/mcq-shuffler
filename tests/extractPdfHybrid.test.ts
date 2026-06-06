import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExtractPdfText, mockExtractPdfTextFromProxy, mockExtractPdfOcr, mockGetDocument } =
  vi.hoisted(() => ({
    mockExtractPdfText: vi.fn(),
    mockExtractPdfTextFromProxy: vi.fn(),
    mockExtractPdfOcr: vi.fn(),
    mockGetDocument: vi.fn(),
  }))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
  default: { GlobalWorkerOptions: { workerSrc: '' }, getDocument: mockGetDocument },
}))

vi.mock('@/lib/extract/extractPdf', () => ({
  extractPdfText: mockExtractPdfText,
  extractPdfTextFromProxy: mockExtractPdfTextFromProxy,
}))

vi.mock('@/lib/extract/pdfEngine/extractPdfOcr', () => ({
  extractPdfOcr: mockExtractPdfOcr,
}))

import { extractPdfHybrid, isNativeQualityPoor } from '@/lib/extract/pdfEngine/extractPdfHybrid'
import type { PdfExtractionQuality } from '@/lib/extract/extractPdf'

function makeQuality(overrides: Partial<PdfExtractionQuality> = {}): PdfExtractionQuality {
  return {
    pages: 2,
    textItems: 100,
    chars: 500,
    detectedQuestionMarkers: 5,
    detectedOptionMarkers: 15,
    suspiciousJoinedWords: 0,
    hasEnoughLineBreaks: true,
    ...overrides,
  }
}

const mockPdf = { numPages: 2, getPage: vi.fn() }

describe('extractPdfHybrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })
  })

  it('mode=fast delegates to extractPdfText and returns its result', async () => {
    const expected = { text: 'שאלה 1', quality: makeQuality() }
    mockExtractPdfText.mockResolvedValue(expected)

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'fast')

    expect(mockExtractPdfText).toHaveBeenCalledWith(expect.any(ArrayBuffer))
    expect(mockExtractPdfOcr).not.toHaveBeenCalled()
    expect(result).toBe(expected)
  })

  it('mode=ocr delegates to extractPdfOcr with the loaded document', async () => {
    const expected = { text: 'OCR text', quality: makeQuality() }
    mockExtractPdfOcr.mockResolvedValue(expected)

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'ocr')

    expect(mockExtractPdfOcr).toHaveBeenCalledWith(mockPdf, undefined)
    expect(mockExtractPdfText).not.toHaveBeenCalled()
    expect(result).toBe(expected)
  })

  it('mode=auto with good quality returns native result without calling OCR', async () => {
    const nativeResult = { text: 'native text', quality: makeQuality() }
    mockExtractPdfTextFromProxy.mockResolvedValue(nativeResult)

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(mockExtractPdfTextFromProxy).toHaveBeenCalledWith(mockPdf)
    expect(mockExtractPdfOcr).not.toHaveBeenCalled()
    expect(result).toBe(nativeResult)
  })

  it('mode=auto with poor quality (chars < 100) falls back to OCR', async () => {
    const nativeResult = { text: '', quality: makeQuality({ chars: 50 }) }
    const ocrResult = { text: 'OCR fallback', quality: makeQuality({ detectedQuestionMarkers: 3 }) }
    mockExtractPdfTextFromProxy.mockResolvedValue(nativeResult)
    mockExtractPdfOcr.mockResolvedValue(ocrResult)

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(mockExtractPdfOcr).toHaveBeenCalledWith(mockPdf, undefined)
    expect(result).toBe(ocrResult)
  })
})

describe('isNativeQualityPoor', () => {
  it('returns true when chars < 100', () => {
    expect(isNativeQualityPoor(makeQuality({ chars: 50 }))).toBe(true)
  })

  it('returns false for healthy quality', () => {
    expect(isNativeQualityPoor(makeQuality())).toBe(false)
  })

  it('returns true when suspiciousJoinedWords > 5', () => {
    expect(isNativeQualityPoor(makeQuality({ suspiciousJoinedWords: 6 }))).toBe(true)
  })

  it('returns true when hasEnoughLineBreaks is false', () => {
    expect(isNativeQualityPoor(makeQuality({ hasEnoughLineBreaks: false }))).toBe(true)
  })

  it('returns true when no question markers and chars > 200', () => {
    expect(isNativeQualityPoor(makeQuality({ detectedQuestionMarkers: 0, chars: 300 }))).toBe(true)
  })
})
