import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
  default: {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: mockGetDocument,
  },
}))

import { extractPdfText } from '@/lib/extract/extractPdf'

function makeTextItem(str: string, x = 100, y = 700, dir = 'ltr') {
  return {
    str,
    dir,
    width: str.length * 6,
    height: 12,
    transform: [1, 0, 0, 1, x, y],
    fontName: '',
    hasEOL: false,
  }
}

// Split a text string into word-level items spanning two y positions,
// so reconstructPageText sees a realistic multi-line page.
function makePageItems(text: string) {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return []
  const mid = Math.ceil(words.length / 2)
  return words.map((word, i) =>
    makeTextItem(word, 100 + (i % mid) * 70, i < mid ? 700 : 685),
  )
}

function makeMockPdf(pageTexts: string[]) {
  return {
    numPages: pageTexts.length,
    getPage: vi.fn().mockImplementation(async (i: number) => ({
      getTextContent: async () => ({
        items: makePageItems(pageTexts[i - 1] ?? ''),
      }),
    })),
  }
}

describe('extractPdfText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns extracted text when PDF has text content', async () => {
    const page1 = 'מה מחזירה הפונקציה getUserName כאשר user_id=123 א. string ב. null ג. Exception ד. number'
    const page2 = 'אם accuracy=95% ו-precision=80% מה נכון א. הראשון ב. השני ג. שניהם ד. אף אחד'
    const mockPdf = makeMockPdf([page1, page2])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.error).toBeUndefined()
    expect(result.warning).toBeUndefined()
    expect(result.text).toContain('getUserName')
    expect(result.text).toContain('accuracy')
  })

  it('returns warning when extracted text is too short (likely scanned)', async () => {
    const mockPdf = makeMockPdf(['', ''])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.error).toBeUndefined()
    expect(result.warning).toContain('סרוק')
    expect(result.text.trim()).toBe('')
  })

  it('returns Hebrew error message on failure', async () => {
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('bad pdf')),
    })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.text).toBe('')
    expect(result.error).toContain('PDF')
  })

  it('quality object is present on successful extraction', async () => {
    const mockPdf = makeMockPdf(['שאלה מספר 1 מה נכון א. כן ב. לא'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality).toBeDefined()
  })

  it('quality.pages equals the number of pages in the mock PDF', async () => {
    const mockPdf = makeMockPdf(['עמוד ראשון', 'עמוד שני'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality?.pages).toBe(2)
  })

  it('quality.detectedQuestionMarkers > 0 when text contains question markers', async () => {
    const page = 'שאלה מספר 1 מה נכון א. כן ב. לא שאלה מספר 2 מה שגוי א. זה ב. אחר'
    const mockPdf = makeMockPdf([page])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality?.detectedQuestionMarkers).toBeGreaterThan(0)
  })
})
