// Backward-compatible type (used by lib/export/exportDocx.ts)
export interface Question {
  text: string
  options: string[]
}

export interface ParsedOption {
  originalLabel: string
  text: string
  originalIndex: number
  isOriginalCorrectAnswer: boolean
  /** Manually attached image data URL (set by editableToParsed; never set by parseExam). */
  visualImageDataUrl?: string
}

export type QuestionStatus =
  | 'ok'
  | 'few-options'         // < 2 options
  | 'visual-content'      // keywords suggest diagram/table/graph
  | 'suspicious-number'   // source number is 0 or implausibly large
  | 'huge-block'          // questionText.length > 500 (likely merged questions)

export interface ParsedQuestion {
  number: number               // source number from PDF (kept for diagnostics)
  sequenceIndex: number        // 0-based position in extracted text; stable across sort/reorder
  outputQuestionNumber: number // always 1,2,3... = sequenceIndex + 1; use for display/export
  questionText: string
  options: ParsedOption[]
  status: QuestionStatus
  hasVisualContent: boolean    // detected from text keywords or blank options
  /** True when question text references a visual element that wasn't extracted as text */
  hasMissingVisualContent?: boolean
  /** True when split from a mid-line embedded marker by normalization */
  splitFromEmbedded?: boolean
  /** Manually attached image data URL (set by editableToParsed; never set by parseExam). */
  visualImageDataUrl?: string
}

export interface ParsedExam {
  questions: ParsedQuestion[]
}

// Belt-and-suspenders fallback for reversed question markers not caught by pdfNormalize:
// ":2 שאלה מספר" or "2: שאלה מספר" (RTL PDF extraction puts number first)
const RE_REVERSED_FULL = /^:?\s*(\d+)(?::\s+|\s+)שאלה\s+מספר\s*/
// "שאלה מספר N" — handles optional colon variants: "שאלה מספר 2", "שאלה מספר:2", "שאלה מספר :2"
// Must be tested before RE_HEBREW_SHORT
const RE_HEBREW_FULL = /^שאלה\s+מספר\s*:?\s*(\d+)/
// "שאלה N"
const RE_HEBREW_SHORT = /^שאלה\s+(\d+)/
// "N. text" or "N." alone — requires \s+ before inline text to avoid matching 1.5
const RE_PERIOD = /^(\d+)\.(?:\s+(.+)|\s*$)/
// "N) text" or "N)" alone
const RE_PAREN = /^(\d+)\)(?:\s+(.+)|\s*$)/
// ".N" — RTL/PDF-flipped period-number, e.g. ".2" at start of line
// Restricted to 1-2 digits; (?!\s*%) prevents ".70%" (decimal value) from matching as question 70
const RE_RTL_PERIOD = /^\.(\d{1,2})\b(?!\s*%)/
// Hebrew א–ת (full alphabet) or Latin A–Z, with . or ) delimiter
const RE_OPTION = /^([א-ת]|[A-Z])[.)]\s*(.*)/

// Keywords that suggest a question references a visual element (graph, table, diagram, etc.)
const VISUAL_CONTENT_PATTERNS: RegExp[] = [
  /נתוי?נ[הת]\s+ה(?:דיאגרמה|גרף|טבלה|סכמה|erd|ציור|תרשים)/i,
  /ב(?:גרף|טבלה|דיאגרמה|תרשים)/,
  /הגרף\s+הבא/,
  /הטבלה\s+הבא/,
  /שאילתת\s+SQL/i,   // SQL query reference ("שאילתת SQL הבאה")
  /הנוסחה\s+הבאה/,  // inline formula reference
]

// Phrases that strongly imply the visual/code content is NOT present in the extracted text
const MISSING_VISUAL_KEYWORDS: RegExp[] = [
  /הגרף\s+הבא/,
  /הדיאגרמה/,
  /התרשים/,
  /הטבלה\s+הבא/,
  /נתון\s+קטע\s+הקוד\s+הבא/,
  /הקוד\s+הבא/,
  /השאילתה\s+הבא/,
  /הפלט\s+הבא/,
  /הרלציות\s+הבאות/,
  /שאילתת\s+SQL/i,  // SQL queries
  /DataFrame/i,      // Python DataFrame tables
]

// Patterns indicating actual code/table/query content IS already in the text
const INLINE_CODE_PATTERNS: RegExp[] = [
  /\bSELECT\b/i,
  /\bFROM\b/i,
  /\bWHERE\b/i,
  /[{}];/,
]

function hasVisualKeywords(text: string): boolean {
  return VISUAL_CONTENT_PATTERNS.some(re => re.test(text))
}

function checkMissingVisualContent(questionText: string): boolean {
  const hasMissingKeyword = MISSING_VISUAL_KEYWORDS.some(re => re.test(questionText))
  if (!hasMissingKeyword) return false
  const hasInlineContent = INLINE_CODE_PATTERNS.some(re => re.test(questionText))
  return !hasInlineContent
}

interface AccOption {
  label: string
  index: number
  textParts: string[]
}

function optionsAreAllBlank(options: AccOption[]): boolean {
  // Detects PDF options that are likely visual (images/diagrams) rather than text:
  // their extracted text is empty or a single noise character (≤ 1 char).
  // Two-letter Hebrew words like "כן"/"לא" (length 2) are valid text and not blank.
  return (
    options.length >= 2 &&
    options.every(o => o.textParts.join(' ').trim().length <= 1)
  )
}

interface AccQuestion {
  number: number
  questionTextParts: string[]
  options: AccOption[]
  sequenceIndex: number  // captured when question opens = questions.length at that moment
  splitFromEmbedded?: boolean
}

function flushOption(acc: AccOption): ParsedOption {
  return {
    originalLabel: acc.label,
    text: acc.textParts.join(' ').trim(),
    originalIndex: acc.index,
    isOriginalCorrectAnswer: acc.index === 0,
  }
}

function flushQuestion(acc: AccQuestion): ParsedQuestion {
  const questionText = acc.questionTextParts.join(' ').trim()
  const options = acc.options.map(flushOption)
  const hasVisualContent = hasVisualKeywords(questionText) || optionsAreAllBlank(acc.options)
  const hasMissingVisualContent = hasVisualContent
    ? checkMissingVisualContent(questionText)
    : false
  const outputQuestionNumber = acc.sequenceIndex + 1

  let status: QuestionStatus = 'ok'
  if (acc.number === 0 || acc.number > 999) status = 'suspicious-number'
  else if (options.length < 2) status = 'few-options'
  else if (questionText.length > 500) status = 'huge-block'
  else if (hasVisualContent) status = 'visual-content'

  return {
    number: acc.number,
    sequenceIndex: acc.sequenceIndex,
    outputQuestionNumber,
    questionText,
    options,
    status,
    hasVisualContent,
    hasMissingVisualContent: hasMissingVisualContent || undefined,
    splitFromEmbedded: acc.splitFromEmbedded || undefined,
  }
}

export function parseExam(rawText: string): ParsedExam {
  const questions: ParsedQuestion[] = []

  if (!rawText.trim()) return { questions }

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  let currentQuestion: AccQuestion | null = null
  let currentOption: AccOption | null = null

  // Zero-width space marker added by pdfNormalize for auto-split question lines
  const ZWSP = '​'

  for (const rawLine of lines) {
    // Detect and strip ZWSP marker (set by splitForwardMarkersFromMidLine)
    const splitFromEmbedded = rawLine.startsWith(ZWSP)
    const line = splitFromEmbedded ? rawLine.slice(ZWSP.length) : rawLine

    // Check question-start patterns (RE_HEBREW_FULL before RE_HEBREW_SHORT)
    let questionNumber: number | null = null
    let questionInlineText: string | null = null

    const mReversed = RE_REVERSED_FULL.exec(line)
    if (mReversed) {
      questionNumber = parseInt(mReversed[1], 10)
      const rest = line.slice(mReversed[0].length).replace(/^[:\s]+/, '').trim()
      questionInlineText = rest || null
    } else {
    const mHebFull = RE_HEBREW_FULL.exec(line)
    if (mHebFull) {
      // Percentage protection: reject "שאלה מספר 70%" as a question start
      const rest = line.slice(mHebFull[0].length).replace(/^[:\s]+/, '').trim()
      if (rest.startsWith('%')) {
        // Not a question start — treat as continuation text
      } else {
        questionNumber = parseInt(mHebFull[1], 10)
        questionInlineText = rest || null
      }
    } else {
      const mHebShort = RE_HEBREW_SHORT.exec(line)
      if (mHebShort) {
        questionNumber = parseInt(mHebShort[1], 10)
        const rest = line.slice(mHebShort[0].length).trim()
        questionInlineText = rest || null
      } else {
        const mPeriod = RE_PERIOD.exec(line)
        if (mPeriod) {
          questionNumber = parseInt(mPeriod[1], 10)
          questionInlineText = (mPeriod[2] ?? '').trim() || null
        } else {
          const mParen = RE_PAREN.exec(line)
          if (mParen) {
            questionNumber = parseInt(mParen[1], 10)
            questionInlineText = (mParen[2] ?? '').trim() || null
          } else {
            const mRtlPeriod = RE_RTL_PERIOD.exec(line)
            if (mRtlPeriod) {
              questionNumber = parseInt(mRtlPeriod[1], 10)
              questionInlineText = null
            }
          }
        }
      }
    }
    } // end else (RE_REVERSED_FULL)

    // Guard: a negative number is not a valid question number.
    // 0 is allowed through — flushQuestion assigns it suspicious-number status.
    if (questionNumber !== null && questionNumber < 0) questionNumber = null

    if (questionNumber !== null) {
      if (currentOption !== null && currentQuestion !== null) {
        currentQuestion.options.push(currentOption)
        currentOption = null
      }
      if (currentQuestion !== null) {
        questions.push(flushQuestion(currentQuestion))
      }
      currentQuestion = {
        number: questionNumber,
        questionTextParts: questionInlineText ? [questionInlineText] : [],
        options: [],
        sequenceIndex: questions.length,  // = how many questions flushed so far
        splitFromEmbedded: splitFromEmbedded || undefined,
      }
      continue
    }

    // Check option label (only when inside a question)
    const mOption = RE_OPTION.exec(line)
    if (mOption !== null && currentQuestion !== null) {
      if (currentOption !== null) {
        currentQuestion.options.push(currentOption)
      }
      const index = currentQuestion.options.length
      const inlineText = (mOption[2] ?? '').trim()
      currentOption = {
        label: mOption[1],
        index,
        textParts: inlineText ? [inlineText] : [],
      }
      continue
    }

    // Continuation line
    if (currentOption !== null) {
      currentOption.textParts.push(line)
    } else if (currentQuestion !== null) {
      currentQuestion.questionTextParts.push(line)
    }
  }

  // Flush remaining accumulators
  if (currentOption !== null && currentQuestion !== null) {
    currentQuestion.options.push(currentOption)
  }
  if (currentQuestion !== null) {
    questions.push(flushQuestion(currentQuestion))
  }

  return { questions }
}

export interface ParseDiagnostics {
  parsedQuestionCount: number
  questionsWithFewerThanTwoOptions: number[]
  suspiciousHugeBlocks: number[]
  questionNumbers: number[]
  duplicateQuestionNumbers: number[]
  nonSequentialNumbers: number[]  // question numbers where q.number < previous q.number (likely mis-read digit)
  hasVisualContentCount: number   // questions with visual-content status
  needsReviewCount: number        // questions with any non-ok status
  suspiciousNumberCount: number   // questions with suspicious-number status
  missingVisualContentCount: number // questions with hasMissingVisualContent=true
  autoSplitCount: number          // questions split from embedded markers by normalization
}

export function diagnoseParsedExam(exam: ParsedExam): ParseDiagnostics {
  const numbers = exam.questions.map(q => q.number)
  const seen = new Set<number>()
  const duplicates: number[] = []
  for (const n of numbers) {
    if (seen.has(n)) duplicates.push(n)
    seen.add(n)
  }
  const nonSequential: number[] = []
  for (let i = 1; i < exam.questions.length; i++) {
    const prev = exam.questions[i - 1]!
    const curr = exam.questions[i]!
    if (curr.number < prev.number) nonSequential.push(curr.number)
  }

  const hasVisualContentCount = exam.questions.filter(q => q.hasVisualContent).length
  const needsReviewCount = exam.questions.filter(q => q.status !== 'ok').length
  const suspiciousNumberCount = exam.questions.filter(q => q.status === 'suspicious-number').length
  const missingVisualContentCount = exam.questions.filter(q => q.hasMissingVisualContent).length
  const autoSplitCount = exam.questions.filter(q => q.splitFromEmbedded).length

  return {
    parsedQuestionCount: exam.questions.length,
    questionsWithFewerThanTwoOptions: exam.questions
      .filter(q => q.options.length < 2)
      .map(q => q.number),
    suspiciousHugeBlocks: exam.questions
      .filter(q => q.questionText.length > 500)
      .map(q => q.number),
    questionNumbers: numbers,
    duplicateQuestionNumbers: [...new Set(duplicates)],
    nonSequentialNumbers: nonSequential,
    hasVisualContentCount,
    needsReviewCount,
    suspiciousNumberCount,
    missingVisualContentCount,
    autoSplitCount,
  }
}
