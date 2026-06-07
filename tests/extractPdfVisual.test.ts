import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetDocument,
  mockRenderPdfPage,
  mockDetectQuestionRegions,
  mockPdfRectToCanvasRect,
  mockLabelBoxToCanvasRect,
  mockCropPageRegion,
  mockReconstructPageText,
} = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockRenderPdfPage: vi.fn(),
  mockDetectQuestionRegions: vi.fn(),
  mockPdfRectToCanvasRect: vi.fn(),
  mockLabelBoxToCanvasRect: vi.fn(),
  mockCropPageRegion: vi.fn(),
  mockReconstructPageText: vi.fn(),
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: 'test' },
  getDocument: mockGetDocument,
  default: { GlobalWorkerOptions: { workerSrc: 'test' }, getDocument: mockGetDocument },
}))

vi.mock('@/lib/extract/pdfEngine/renderPdfPage', () => ({
  renderPdfPage: mockRenderPdfPage,
}))

vi.mock('@/lib/extract/pdfEngine/detectQuestionRegions', () => ({
  detectQuestionRegions: mockDetectQuestionRegions,
}))

vi.mock('@/lib/extract/pdfEngine/cropPageRegion', () => ({
  pdfRectToCanvasRect: mockPdfRectToCanvasRect,
  labelBoxToCanvasRect: mockLabelBoxToCanvasRect,
  cropPageRegion: mockCropPageRegion,
}))

vi.mock('@/lib/extract/pdfLines', () => ({
  reconstructPageText: mockReconstructPageText,
}))

import { extractPdfVisual } from '@/lib/extract/pdfEngine/extractPdfVisual'
import type { QuestionRegion } from '@/lib/extract/pdfEngine/visualTypes'

function makeItem(str: string, x = 50, y = 100, w = 40, h = 12) {
  return { str, dir: 'rtl', width: w, height: h, transform: [1, 0, 0, 1, x, y], hasEOL: false }
}

function makeRegion(qNum: number): QuestionRegion {
  const labelItem = makeItem('א.', 50, 680)
  return {
    questionNumber: qNum,
    stemYTop: 704,
    stemYBottom: 676,
    options: [
      {
        label: 'א',
        labelItem: labelItem as any,
        yTop: 684,
        yBottom: 656,
        items: [labelItem as any, makeItem('תשובה א', 70, 680) as any],
      },
    ],
  }
}

function makePdf(numPages: number) {
  const page = {
    getViewport: vi.fn().mockReturnValue({ width: 200, height: 792 }),
    getTextContent: vi.fn().mockResolvedValue({
      items: [makeItem('1. שאלה', 50, 700), makeItem('א.', 50, 680)],
    }),
  }
  return {
    numPages,
    getPage: vi.fn().mockResolvedValue(page),
  }
}

describe('extractPdfVisual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const pdf = makePdf(1)
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(pdf) })
    mockRenderPdfPage.mockResolvedValue({} as HTMLCanvasElement)
    mockDetectQuestionRegions.mockReturnValue([makeRegion(1)])
    mockPdfRectToCanvasRect.mockReturnValue({ x: 0, y: 0, width: 100, height: 50 })
    mockLabelBoxToCanvasRect.mockReturnValue({ x: 0, y: 0, width: 20, height: 12 })
    mockCropPageRegion.mockReturnValue('data:image/png;base64,crop')
    mockReconstructPageText.mockReturnValue('מוק טקסט')
  })

  it('returns VisualExtractionResult with visualQuestions', async () => {
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.visualQuestions).toHaveLength(1)
    expect(result.error).toBeUndefined()
  })

  it('onProgress called once per page', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(makePdf(3)) })
    const onProgress = vi.fn()
    await extractPdfVisual(new ArrayBuffer(8), onProgress)
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenCalledWith(1, 3)
    expect(onProgress).toHaveBeenCalledWith(3, 3)
  })

  it('returns error when pdfjs throws', async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error('bad pdf')) })
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.error).toBeDefined()
    expect(result.visualQuestions).toHaveLength(0)
  })

  it('renderPdfPage called once per page', async () => {
    await extractPdfVisual(new ArrayBuffer(8))
    expect(mockRenderPdfPage).toHaveBeenCalledTimes(1)
  })

  it('detectQuestionRegions called once per page', async () => {
    await extractPdfVisual(new ArrayBuffer(8))
    expect(mockDetectQuestionRegions).toHaveBeenCalledTimes(1)
  })

  it('cropPageRegion called once for stem and once per option', async () => {
    await extractPdfVisual(new ArrayBuffer(8))
    // 1 stem + 1 option = 2 calls
    expect(mockCropPageRegion).toHaveBeenCalledTimes(2)
  })

  it('isOriginalCorrectAnswer is true only for the first option (originalIndex === 0)', async () => {
    const twoOptionRegion: QuestionRegion = {
      ...makeRegion(1),
      options: [
        { label: 'א', labelItem: makeItem('א.') as any, yTop: 684, yBottom: 660, items: [] },
        { label: 'ב', labelItem: makeItem('ב.') as any, yTop: 660, yBottom: 636, items: [] },
      ],
    }
    mockDetectQuestionRegions.mockReturnValue([twoOptionRegion])
    const result = await extractPdfVisual(new ArrayBuffer(8))
    const opts = result.visualQuestions[0].options
    expect(opts[0].isOriginalCorrectAnswer).toBe(true)
    expect(opts[1].isOriginalCorrectAnswer).toBe(false)
  })

  it('approximateText equals value returned by mocked reconstructPageText', async () => {
    mockReconstructPageText.mockReturnValue('טקסט משוחזר')
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.visualQuestions[0].options[0].approximateText).toBe('טקסט משוחזר')
  })

  it('returns warning when no regions detected across all pages', async () => {
    mockDetectQuestionRegions.mockReturnValue([])
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.visualQuestions).toHaveLength(0)
    expect(result.warning).toBeDefined()
  })

  it('filters out regions with 0 options', async () => {
    const noOptionRegion: QuestionRegion = {
      questionNumber: 1,
      stemYTop: 704,
      stemYBottom: 0,
      options: [],
    }
    mockDetectQuestionRegions.mockReturnValue([noOptionRegion])
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.visualQuestions).toHaveLength(0)
  })

  it('returns partial-detection warning when regions existed but all had 0 options', async () => {
    const noOptionRegion: QuestionRegion = {
      questionNumber: 1,
      stemYTop: 704,
      stemYBottom: 0,
      options: [],
    }
    mockDetectQuestionRegions.mockReturnValue([noOptionRegion])
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.warning).toMatch(/חלקיים/)
  })

  it('keeps regions with 1+ options and filters those with 0', async () => {
    const goodRegion = makeRegion(1)  // has 1 option
    const badRegion: QuestionRegion = {
      questionNumber: 2,
      stemYTop: 500,
      stemYBottom: 0,
      options: [],
    }
    mockDetectQuestionRegions.mockReturnValue([goodRegion, badRegion])
    const result = await extractPdfVisual(new ArrayBuffer(8))
    expect(result.visualQuestions).toHaveLength(1)
    expect(result.visualQuestions[0].number).toBe(1)
  })
})
