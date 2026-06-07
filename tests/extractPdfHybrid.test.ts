import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExtractPdfText, mockExtractPdfTextFromProxy, mockExtractPdfOcr, mockGetDocument, mockParseExam } =
  vi.hoisted(() => ({
    mockExtractPdfText: vi.fn(),
    mockExtractPdfTextFromProxy: vi.fn(),
    mockExtractPdfOcr: vi.fn(),
    mockGetDocument: vi.fn(),
    mockParseExam: vi.fn(),
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

vi.mock('@/lib/parser/parseQuestions', () => ({
  parseExam: mockParseExam,
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
    // Default: parseExam returns 0 questions (tie → OCR wins, preserving existing behaviour)
    mockParseExam.mockReturnValue({ questions: [] })
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
    // Both parse 0 questions (default mock) — tie → OCR wins

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(mockExtractPdfOcr).toHaveBeenCalledWith(mockPdf, undefined)
    expect(result).toBe(ocrResult)
  })

  it('auto mode: native wins when it parses more questions than OCR', async () => {
    // Native triggers poor-quality (detectedQuestionMarkers=0, chars>200) but parses more questions
    const nativeResult = { text: 'native rich text', quality: makeQuality({ detectedQuestionMarkers: 0, chars: 500 }) }
    const ocrResult    = { text: 'ocr poor text',   quality: makeQuality({ detectedQuestionMarkers: 2 }) }
    mockExtractPdfTextFromProxy.mockResolvedValue(nativeResult)
    mockExtractPdfOcr.mockResolvedValue(ocrResult)

    // Native parses 2 questions, OCR parses 1 → native wins
    mockParseExam
      .mockReturnValueOnce({ questions: [{ number: 1 }, { number: 2 }] })  // native
      .mockReturnValueOnce({ questions: [{ number: 1 }] })                  // OCR

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(result).toBe(nativeResult)
    expect(result.nativePreferredOverOcr).toBe(true)
  })

  it('auto mode: autoModeReason set to Hebrew explanation when native preferred over OCR', async () => {
    const nativeResult = { text: 'native', quality: makeQuality({ detectedQuestionMarkers: 0, chars: 300 }) }
    const ocrResult    = { text: 'ocr',    quality: makeQuality() }
    mockExtractPdfTextFromProxy.mockResolvedValue(nativeResult)
    mockExtractPdfOcr.mockResolvedValue(ocrResult)

    mockParseExam
      .mockReturnValueOnce({ questions: [{ number: 1 }, { number: 2 }, { number: 3 }] })  // native: 3
      .mockReturnValueOnce({ questions: [{ number: 1 }] })                                  // OCR: 1

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(result.autoModeReason).toMatch(/טקסטואלי/)
    expect(result.nativePreferredOverOcr).toBe(true)
  })

  it('auto mode: OCR wins and autoModeReason mentions OCR when OCR parses more questions', async () => {
    const nativeResult = { text: 'poor native', quality: makeQuality({ chars: 50 }) }
    const ocrResult    = { text: 'good ocr',   quality: makeQuality() }
    mockExtractPdfTextFromProxy.mockResolvedValue(nativeResult)
    mockExtractPdfOcr.mockResolvedValue(ocrResult)

    mockParseExam
      .mockReturnValueOnce({ questions: [] })                                                // native: 0
      .mockReturnValueOnce({ questions: [{ number: 1 }, { number: 2 }, { number: 3 }] })   // OCR: 3

    const result = await extractPdfHybrid(new ArrayBuffer(8), 'auto')

    expect(result).toBe(ocrResult)
    expect(result.autoModeReason).toMatch(/OCR/)
    expect(result.nativePreferredOverOcr).toBeUndefined()
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
