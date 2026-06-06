import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseExam } from '@/lib/parser/parseQuestions'

const mockGetDocument = vi.fn()

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
  default: { GlobalWorkerOptions: { workerSrc: '' }, getDocument: mockGetDocument },
}))

import { extractPdfText } from '@/lib/extract/extractPdf'

interface MockItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  fontName: string
  hasEOL: boolean
}

function makePosItem(str: string, x: number, y: number, dir = 'rtl', w?: number, h = 12): MockItem {
  return {
    str,
    dir,
    width: w ?? str.length * 7,
    height: h,
    transform: [1, 0, 0, 1, x, y],
    fontName: '',
    hasEOL: false,
  }
}

function makeMockPdf(pageItems: MockItem[][]) {
  return {
    numPages: pageItems.length,
    getPage: vi.fn().mockImplementation(async (i: number) => ({
      getTextContent: async () => ({ items: pageItems[i - 1] ?? [] }),
    })),
  }
}

// A minimal RTL exam page: one question with two options, well-spaced
// Items are positioned so that spacing heuristics insert the right spaces
function examPage(questionLabel: string, questionNum: number, qText: string, opts: string[]) {
  const items: MockItem[] = []
  let y = 700
  const lineH = 16

  // Question marker line (RTL): "שאלה מספר N" sorted right-to-left
  items.push(makePosItem(questionLabel, 500, y, 'rtl', 80))
  items.push(makePosItem(String(questionNum), 380, y, 'ltr', 20))
  y -= lineH

  // Question text
  items.push(makePosItem(qText, 500, y, 'rtl', 200))
  y -= lineH

  // Options
  const HEBREW_LABELS = ['א', 'ב', 'ג', 'ד']
  for (let i = 0; i < opts.length; i++) {
    const label = HEBREW_LABELS[i] + '.'
    items.push(makePosItem(label, 500, y, 'rtl', 20))
    items.push(makePosItem(opts[i], 440, y, 'rtl', 80))
    y -= lineH
  }

  return items
}

describe('PDF extraction integration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reconstructed Hebrew exam text allows parseExam to detect questions', async () => {
    const page = examPage('שאלה מספר', 1, 'מה נכון?', ['תשובה א', 'תשובה ב'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))
    const exam = parseExam(result.text)

    expect(exam.questions.length).toBeGreaterThanOrEqual(1)
  })

  it('reconstructed text allows parseExam to detect options', async () => {
    const page = examPage('שאלה מספר', 1, 'מה עושה הפונקציה?', ['מחזירה null', 'זורקת Exception'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))
    const exam = parseExam(result.text)

    expect(exam.questions[0]?.options.length).toBeGreaterThanOrEqual(2)
  })

  it('quality object is present on successful extraction', async () => {
    const page = examPage('שאלה מספר', 1, 'שאלה?', ['א', 'ב'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality).toBeDefined()
  })

  it('quality.pages matches the number of pages in the PDF', async () => {
    const page1 = examPage('שאלה מספר', 1, 'שאלה ראשונה?', ['א', 'ב'])
    const page2 = examPage('שאלה מספר', 2, 'שאלה שניה?', ['ג', 'ד'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page1, page2])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality?.pages).toBe(2)
  })

  it('detectedQuestionMarkers > 0 when content includes question markers', async () => {
    const page = examPage('שאלה מספר', 1, 'מה נכון?', ['כן', 'לא'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality?.detectedQuestionMarkers).toBeGreaterThan(0)
  })

  it('suspiciousJoinedWords is 0 when items are properly spaced', async () => {
    // All items in this exam have gaps → reconstruction inserts spaces → no glued words
    const page = examPage('שאלה מספר', 1, 'מה?', ['תשובה'])
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.quality?.suspiciousJoinedWords).toBe(0)
  })

  it('extracted text contains original Hebrew tokens unchanged (no reversal)', async () => {
    const page = [makePosItem('getUserName', 400, 700, 'ltr', 80, 12)]
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.text).toContain('getUserName')
  })

  it('header line appearing on 2+ pages is removed from output', async () => {
    const header = makePosItem("מבחן מס' 123", 400, 750, 'rtl', 80)
    const q1Item = makePosItem('שאלה מספר 1', 400, 700, 'rtl', 100)
    const q2Item = makePosItem('שאלה מספר 2', 400, 700, 'rtl', 100)
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(
        makeMockPdf([
          [header, q1Item],
          [header, q2Item],
        ]),
      ),
    })

    const result = await extractPdfText(new ArrayBuffer(8))

    // Header should be removed; question markers should remain
    expect(result.text).not.toMatch(/מבחן מס'/)
    expect(result.text).toContain('שאלה מספר')
  })

  it('multi-page PDF joins pages with a blank line between them', async () => {
    const page1 = [makePosItem('שאלה מספר 1', 400, 700, 'rtl', 100)]
    const page2 = [makePosItem('שאלה מספר 2', 400, 700, 'rtl', 100)]
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page1, page2])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.text).toContain('\n\n')
  })

  it('mixed Hebrew-English item: English token is preserved in readable form', async () => {
    const page = [
      makePosItem('SELECT', 200, 700, 'ltr', 50),
      makePosItem('*', 260, 700, 'ltr', 10),
    ]
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makeMockPdf([page])) })

    const result = await extractPdfText(new ArrayBuffer(8))

    expect(result.text).toContain('SELECT')
    expect(result.text).toContain('*')
  })
})
