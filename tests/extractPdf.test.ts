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

function makeTextItem(str: string) {
  return { str, dir: 'ltr', width: 10, height: 10, transform: [], fontName: '', hasEOL: false }
}

function makeMockPdf(pageTexts: string[]) {
  return {
    numPages: pageTexts.length,
    getPage: vi.fn().mockImplementation(async (i: number) => ({
      getTextContent: async () => ({
        items: pageTexts[i - 1] !== undefined ? [makeTextItem(pageTexts[i - 1])] : [],
      }),
    })),
  }
}

describe('extractPdfText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns extracted text when PDF has text content', async () => {
    const page1 = 'מה מחזירה הפונקציה getUserName כאשר user_id=123? א. string ב. null ג. Exception ד. number'
    const page2 = 'אם accuracy=95% ו-precision=80% מה נכון? א. הראשון ב. השני ג. שניהם ד. אף אחד'
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
})
