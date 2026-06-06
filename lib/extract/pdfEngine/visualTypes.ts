import type { PdfTextItem } from '../pdfLines'

// Rectangle in PDF user-space: origin bottom-left, y increases UP.
export interface PdfRect {
  x: number      // left edge in PDF units
  y: number      // BOTTOM edge in PDF units (not the top)
  width: number
  height: number
}

// Rectangle in canvas pixel-space: origin top-left, y increases DOWN.
export interface CanvasRect {
  x: number      // left edge in pixels
  y: number      // TOP edge in pixels
  width: number
  height: number
}

// Bounding box of one option label glyph (e.g. "א.") in PDF space.
// Used to white-fill the label before cropping option content.
export interface LabelBox {
  pdfRect: PdfRect
  labelChar: string  // e.g. 'א'
}

// One option within a detected QuestionRegion.
export interface OptionRegion {
  label: string           // the Hebrew letter matched (e.g. 'א')
  labelItem: PdfTextItem  // the TextItem whose .str contains the label char
  yTop: number            // TOP of this option in PDF units (larger y = higher on page)
  yBottom: number         // BOTTOM of this option in PDF units
  items: PdfTextItem[]    // all items in this option's y-band
}

// One question as detected on one PDF page.
export interface QuestionRegion {
  questionNumber: number
  stemYTop: number    // TOP of stem in PDF units (larger y = visually higher)
  stemYBottom: number // BOTTOM of stem in PDF units
  options: OptionRegion[]
}

// Signals used to trigger the auto-mode complexity hint banner.
export interface ComplexityFlags {
  hasImages: boolean          // page has embedded XObject images (pdfjs op 82/83)
  hasTables: boolean          // text items cluster into 3+ distinct x-columns
  hasMultiColumnText: boolean // gap > 40% of page width at the median x-split
  hasFormulas: boolean        // text contains ∫∑√±×÷≤≥αβγδπΩ²³
}

// A single visual option BEFORE shuffling.
export interface VisualOption {
  originalIndex: number
  isOriginalCorrectAnswer: boolean  // true only for originalIndex === 0
  dataUrl: string                   // PNG data URL; label already white-filled
  labelBox: LabelBox                // stored for render-time label placement
  approximateText: string           // pdfjs-extracted text for answer-key fallback
}

// A single visual question BEFORE shuffling.
export interface VisualQuestion {
  number: number
  stemDataUrl: string
  options: VisualOption[]
  pageIndex: number   // 0-based
}

// Top-level result returned by extractPdfVisual.
export interface VisualExtractionResult {
  visualQuestions: VisualQuestion[]
  warning?: string
  error?: string
}

// Post-shuffle types (mirror ShuffledExam / ShuffledOption).

export interface ShuffledVisualOption {
  label: string            // assigned shuffled Hebrew label (א, ב, ...)
  originalIndex: number
  isCorrectAnswer: boolean
  dataUrl: string
  labelBox: LabelBox
  approximateText: string
}

export interface ShuffledVisualQuestion {
  number: number
  stemDataUrl: string
  options: ShuffledVisualOption[]
}

export interface ShuffledVisualExam {
  questions: ShuffledVisualQuestion[]
}
