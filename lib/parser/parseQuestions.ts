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
// Restricted to 1-2 digits to prevent matching ".70" (from decimal 0.70)
const RE_RTL_PERIOD = /^\.(\d{1,2})\b/
// Hebrew א–ת (full alphabet) or Latin A–Z, with . or ) delimiter
const RE_OPTION = /^([א-ת]|[A-Z])[.)]\s*(.*)/

// Keywords that suggest a question references a visual element (graph, table, diagram, etc.)
const VISUAL_CONTENT_PATTERNS: RegExp[] = [
  /נתוי?נ[הת]\s+ה(?:דיאגרמה|גרף|טבלה|סכמה|erd|ציור|תרשים)/i,
  /ב(?:גרף|טבלה|דיאגרמה|תרשים)/,
  /הגרף\s+הבא/,
  /הטבלה\s+הבא/,
]

function hasVisualKeywords(text: string): boolean {
  return VISUAL_CONTENT_PATTERNS.some(re => re.test(text))
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
  const outputQuestionNumber = acc.sequenceIndex + 1

  let status: QuestionStatus = 'ok'
  if (acc.number === 0) status = 'suspicious-number'
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

  for (const line of lines) {
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
      questionNumber = parseInt(mHebFull[1], 10)
      // Strip leading colon/spaces to handle "שאלה מספר 2: text"
      const rest = line.slice(mHebFull[0].length).replace(/^[:\s]+/, '').trim()
      questionInlineText = rest || null
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

    // Guard: a parsed number of 0 or negative is not a valid question number
    if (questionNumber !== null && questionNumber <= 0) questionNumber = null

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
  }
}
