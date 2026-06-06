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

export interface ParsedQuestion {
  number: number
  questionText: string
  options: ParsedOption[]
}

export interface ParsedExam {
  questions: ParsedQuestion[]
}

// "שאלה מספר N" — must be tested before RE_HEBREW_SHORT
const RE_HEBREW_FULL = /^שאלה\s+מספר\s+(\d+)/
// "שאלה N"
const RE_HEBREW_SHORT = /^שאלה\s+(\d+)/
// "N. text" or "N." alone — requires \s+ before inline text to avoid matching 1.5
const RE_PERIOD = /^(\d+)\.(?:\s+(.+)|\s*$)/
// "N) text" or "N)" alone
const RE_PAREN = /^(\d+)\)(?:\s+(.+)|\s*$)/
// Hebrew א–ה (U+05D0–U+05D4) or Latin A–E, with . or ) delimiter
const RE_OPTION = /^([א-ה]|[A-E])[.)]\s*(.*)/

interface AccOption {
  label: string
  index: number
  textParts: string[]
}

interface AccQuestion {
  number: number
  questionTextParts: string[]
  options: AccOption[]
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
  return {
    number: acc.number,
    questionText: acc.questionTextParts.join(' ').trim(),
    options: acc.options.map(flushOption),
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

    const mHebFull = RE_HEBREW_FULL.exec(line)
    if (mHebFull) {
      questionNumber = parseInt(mHebFull[1], 10)
      const rest = line.slice(mHebFull[0].length).trim()
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
          }
        }
      }
    }

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
