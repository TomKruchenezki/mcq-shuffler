import { describe, it, expect } from 'vitest'
import { parseExam } from '@/lib/parser/parseQuestions'
import type { ParsedExam } from '@/lib/parser/parseQuestions'

describe('parseExam — basics', () => {
  it('empty string → { questions: [] }', () => {
    const result: ParsedExam = parseExam('')
    expect(result).toEqual({ questions: [] })
  })

  it('whitespace-only → { questions: [] }', () => {
    expect(parseExam('   \n  \n\t  ')).toEqual({ questions: [] })
  })
})

describe('parseExam — question start formats', () => {
  it('שאלה N format', () => {
    const { questions } = parseExam('שאלה 1\nא. תשובה')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(1)
  })

  it('שאלה מספר N format', () => {
    const { questions } = parseExam('שאלה מספר 3\nא. תשובה')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(3)
  })

  it('N. format', () => {
    const { questions } = parseExam('2. מה הצבע של השמיים?\nא. כחול\nב. ירוק')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(2)
    expect(questions[0].questionText).toBe('מה הצבע של השמיים?')
  })

  it('N) format', () => {
    const { questions } = parseExam('4) שאלה עם סוגר\nA. תשובה אחת\nB. תשובה שניה')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(4)
    expect(questions[0].questionText).toBe('שאלה עם סוגר')
  })

  it('שאלה N with text on the same line', () => {
    const { questions } = parseExam('שאלה 5 מהו הערך של X?\nא. 42')
    expect(questions[0].questionText).toBe('מהו הערך של X?')
  })

  it('שאלה N with text on the next line', () => {
    const { questions } = parseExam('שאלה 6\nמהו הערך של Y?\nא. 99')
    expect(questions[0].questionText).toBe('מהו הערך של Y?')
  })

  it('1.5 does NOT match as a question start', () => {
    const { questions } = parseExam('1.5 זוהי לא שאלה')
    expect(questions).toHaveLength(0)
  })

  it('N. alone on a line (text on next line)', () => {
    const { questions } = parseExam('7.\nשאלה שנייה בשורה הבאה\nא. כן\nב. לא')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(7)
    expect(questions[0].questionText).toBe('שאלה שנייה בשורה הבאה')
  })

  it('N) alone on a line (text on next line)', () => {
    const { questions } = parseExam('8)\nתוכן השאלה כאן\nA. option')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(8)
    expect(questions[0].questionText).toBe('תוכן השאלה כאן')
  })
})

describe('parseExam — option label formats', () => {
  const makeQ = (optLines: string) => `1. שאלה\n${optLines}`

  it('Hebrew א. ב. ג. ד. labels', () => {
    const { questions } = parseExam(makeQ('א. ראשון\nב. שני\nג. שלישי\nד. רביעי'))
    const opts = questions[0].options
    expect(opts).toHaveLength(4)
    expect(opts[0].originalLabel).toBe('א')
    expect(opts[1].originalLabel).toBe('ב')
    expect(opts[2].originalLabel).toBe('ג')
    expect(opts[3].originalLabel).toBe('ד')
    expect(opts[0].text).toBe('ראשון')
    expect(opts[3].text).toBe('רביעי')
  })

  it('Hebrew א) ב) ג) ד) labels', () => {
    const { questions } = parseExam(makeQ('א) ראשון\nב) שני\nג) שלישי\nד) רביעי'))
    const opts = questions[0].options
    expect(opts).toHaveLength(4)
    expect(opts[0].originalLabel).toBe('א')
    expect(opts[1].originalLabel).toBe('ב')
  })

  it('English A. B. C. D. labels', () => {
    const { questions } = parseExam(makeQ('A. First\nB. Second\nC. Third\nD. Fourth'))
    const opts = questions[0].options
    expect(opts).toHaveLength(4)
    expect(opts[0].originalLabel).toBe('A')
    expect(opts[1].originalLabel).toBe('B')
    expect(opts[2].originalLabel).toBe('C')
    expect(opts[3].originalLabel).toBe('D')
    expect(opts[0].text).toBe('First')
  })

  it('English A) B) C) D) labels', () => {
    const { questions } = parseExam(makeQ('A) First\nB) Second\nC) Third\nD) Fourth'))
    const opts = questions[0].options
    expect(opts).toHaveLength(4)
    expect(opts[0].originalLabel).toBe('A')
    expect(opts[3].originalLabel).toBe('D')
  })

  it('five options including ה / E', () => {
    const { questions } = parseExam(makeQ('א. א\nב. ב\nג. ג\nד. ד\nה. ה'))
    expect(questions[0].options).toHaveLength(5)
    expect(questions[0].options[4].originalLabel).toBe('ה')
  })
})

describe('parseExam — multi-line content', () => {
  it('multi-line question text joined with space', () => {
    const text = '1. שורה ראשונה של השאלה\nהמשך השאלה בשורה שניה\nא. תשובה'
    const { questions } = parseExam(text)
    expect(questions[0].questionText).toBe('שורה ראשונה של השאלה המשך השאלה בשורה שניה')
  })

  it('multi-line option text joined with space', () => {
    const text = '1. שאלה\nא. שורה ראשונה של תשובה\nהמשך התשובה בשורה שניה\nב. תשובה אחרת'
    const { questions } = parseExam(text)
    const opts = questions[0].options
    expect(opts[0].text).toBe('שורה ראשונה של תשובה המשך התשובה בשורה שניה')
    expect(opts[1].text).toBe('תשובה אחרת')
  })

  it('Windows CRLF line endings are handled', () => {
    const text = '1. שאלה\r\nא. תשובה ראשונה\r\nב. תשובה שניה'
    const { questions } = parseExam(text)
    expect(questions).toHaveLength(1)
    expect(questions[0].options).toHaveLength(2)
    expect(questions[0].options[0].text).toBe('תשובה ראשונה')
  })

  it('blank lines between content are skipped', () => {
    const text = '1. שאלה\n\nא. תשובה\n\nב. תשובה שניה'
    const { questions } = parseExam(text)
    expect(questions[0].options).toHaveLength(2)
  })
})

describe('parseExam — correct answer tracking', () => {
  const FOUR_OPT = ['1. שאלה לדוגמה', 'א. ראשון', 'ב. שני', 'ג. שלישי', 'ד. רביעי'].join('\n')

  it('first option has isOriginalCorrectAnswer: true', () => {
    const { questions } = parseExam(FOUR_OPT)
    expect(questions[0].options[0].isOriginalCorrectAnswer).toBe(true)
  })

  it('other options have isOriginalCorrectAnswer: false', () => {
    const { questions } = parseExam(FOUR_OPT)
    const opts = questions[0].options
    expect(opts[1].isOriginalCorrectAnswer).toBe(false)
    expect(opts[2].isOriginalCorrectAnswer).toBe(false)
    expect(opts[3].isOriginalCorrectAnswer).toBe(false)
  })

  it('originalIndex matches position (0, 1, 2, 3)', () => {
    const { questions } = parseExam(FOUR_OPT)
    const opts = questions[0].options
    expect(opts[0].originalIndex).toBe(0)
    expect(opts[1].originalIndex).toBe(1)
    expect(opts[2].originalIndex).toBe(2)
    expect(opts[3].originalIndex).toBe(3)
  })

  it('originalLabel is preserved exactly', () => {
    const { questions } = parseExam(FOUR_OPT)
    const opts = questions[0].options
    expect(opts[0].originalLabel).toBe('א')
    expect(opts[1].originalLabel).toBe('ב')
    expect(opts[2].originalLabel).toBe('ג')
    expect(opts[3].originalLabel).toBe('ד')
  })
})

describe('parseExam — mixed content preservation', () => {
  it('Hebrew + English + numbers in question text', () => {
    const text = '1. הפונקציה getUserName מקבלת user_id=123 ומחזירה accuracy=95%\nא. נכון\nב. לא נכון'
    const { questions } = parseExam(text)
    expect(questions[0].questionText).toBe(
      'הפונקציה getUserName מקבלת user_id=123 ומחזירה accuracy=95%'
    )
  })

  it('multi-line SQL option joined with space', () => {
    const text = '1. איזה SQL שאילתה נכונה?\nא. SELECT * FROM users\nWHERE id = 5\nב. DELETE FROM users'
    const { questions } = parseExam(text)
    expect(questions[0].options[0].text).toBe('SELECT * FROM users WHERE id = 5')
    expect(questions[0].options[1].text).toBe('DELETE FROM users')
  })

  it('percentage formulas preserved verbatim', () => {
    const text = '1. מה ערך ה-accuracy?\nא. accuracy=95%, precision=80%\nב. accuracy=70%'
    const { questions } = parseExam(text)
    expect(questions[0].options[0].text).toBe('accuracy=95%, precision=80%')
  })

  it('inline English variable names preserved in question text', () => {
    const text = '2. כיצד מחושב user_score בפונקציה calculate_score?\nא. נכון'
    const { questions } = parseExam(text)
    expect(questions[0].questionText).toContain('user_score')
    expect(questions[0].questionText).toContain('calculate_score')
  })
})

describe('parseExam — multiple questions', () => {
  const TWO_Q = [
    '1. שאלה ראשונה',
    'א. תשובה א',
    'ב. תשובה ב',
    '2. שאלה שניה',
    'A. Option A',
    'B. Option B',
    'C. Option C',
  ].join('\n')

  it('parses 2 questions independently', () => {
    const { questions } = parseExam(TWO_Q)
    expect(questions).toHaveLength(2)
    expect(questions[0].options).toHaveLength(2)
    expect(questions[1].options).toHaveLength(3)
  })

  it('correct question numbers assigned', () => {
    const { questions } = parseExam(TWO_Q)
    expect(questions[0].number).toBe(1)
    expect(questions[1].number).toBe(2)
  })

  it('options from question 2 do not leak into question 1', () => {
    const { questions } = parseExam(TWO_Q)
    const q1opts = questions[0].options.map(o => o.text)
    expect(q1opts).not.toContain('Option A')
  })

  it('first option of each question is the correct answer', () => {
    const { questions } = parseExam(TWO_Q)
    expect(questions[0].options[0].isOriginalCorrectAnswer).toBe(true)
    expect(questions[1].options[0].isOriginalCorrectAnswer).toBe(true)
  })

  it('שאלה מספר format across multiple questions', () => {
    const text = [
      'שאלה מספר 10',
      'מהו 2+2?',
      'א. 4',
      'ב. 5',
      'שאלה מספר 11',
      'מהו 3+3?',
      'א. 6',
    ].join('\n')
    const { questions } = parseExam(text)
    expect(questions).toHaveLength(2)
    expect(questions[0].number).toBe(10)
    expect(questions[1].number).toBe(11)
  })
})

describe('parseExam — extended option labels (ז ח G H)', () => {
  const makeQ = (optLines: string) => `1. שאלה\n${optLines}`

  it('Hebrew ז. label', () => {
    const { questions } = parseExam(makeQ('א. א\nב. ב\nג. ג\nד. ד\nה. ה\nו. ו\nז. שביעי'))
    expect(questions[0].options).toHaveLength(7)
    expect(questions[0].options[6].originalLabel).toBe('ז')
    expect(questions[0].options[6].text).toBe('שביעי')
  })

  it('Hebrew ח. label', () => {
    const { questions } = parseExam(makeQ('א. א\nב. ב\nג. ג\nד. ד\nה. ה\nו. ו\nז. ז\nח. שמיני'))
    expect(questions[0].options).toHaveLength(8)
    expect(questions[0].options[7].originalLabel).toBe('ח')
    expect(questions[0].options[7].text).toBe('שמיני')
  })

  it('Hebrew ז) label', () => {
    const { questions } = parseExam(makeQ('א) א\nב) ב\nג) ג\nד) ד\nה) ה\nו) ו\nז) שביעי'))
    expect(questions[0].options[6].originalLabel).toBe('ז')
  })

  it('Hebrew ח) label', () => {
    const { questions } = parseExam(makeQ('א) א\nב) ב\nג) ג\nד) ד\nה) ה\nו) ו\nז) ז\nח) שמיני'))
    expect(questions[0].options[7].originalLabel).toBe('ח')
  })

  it('English G. label', () => {
    const { questions } = parseExam(makeQ('A. a\nB. b\nC. c\nD. d\nE. e\nF. f\nG. seventh'))
    expect(questions[0].options).toHaveLength(7)
    expect(questions[0].options[6].originalLabel).toBe('G')
    expect(questions[0].options[6].text).toBe('seventh')
  })

  it('English H. label', () => {
    const { questions } = parseExam(makeQ('A. a\nB. b\nC. c\nD. d\nE. e\nF. f\nG. g\nH. eighth'))
    expect(questions[0].options).toHaveLength(8)
    expect(questions[0].options[7].originalLabel).toBe('H')
    expect(questions[0].options[7].text).toBe('eighth')
  })

  it('English G) label', () => {
    const { questions } = parseExam(makeQ('A) a\nB) b\nC) c\nD) d\nE) e\nF) f\nG) seventh'))
    expect(questions[0].options[6].originalLabel).toBe('G')
  })

  it('English H) label', () => {
    const { questions } = parseExam(makeQ('A) a\nB) b\nC) c\nD) d\nE) e\nF) f\nG) g\nH) eighth'))
    expect(questions[0].options[7].originalLabel).toBe('H')
  })
})

import { diagnoseParsedExam } from '@/lib/parser/parseQuestions'

describe('reversed question markers — parser fallback (RE_REVERSED_FULL)', () => {
  it(':2 שאלה מספר → question 2 with options', () => {
    const { questions } = parseExam(':2 שאלה מספר\nא. כן\nב. לא')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(2)
    expect(questions[0].options).toHaveLength(2)
  })

  it('2: שאלה מספר → question 2 (N: form)', () => {
    const { questions } = parseExam('2: שאלה מספר\nא. כן\nב. לא')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(2)
    expect(questions[0].options).toHaveLength(2)
  })

  it(':5 שאלה מספר with inline text after marker', () => {
    const { questions } = parseExam(':5 שאלה מספר מהו הפלט?\nא. 0\nב. 1')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(5)
  })

  it('realistic PDF fixture: 5 reversed questions detected', () => {
    const fixture = [
      ':1 שאלה מספר',
      'מהו הפלט של הפונקציה?',
      'א. 0',
      'ב. 1',
      'ג. null',
      'ד. undefined',
      ':2 שאלה מספר',
      'איזו מהשיטות מחזירה מחרוזת?',
      'א. parseInt',
      'ב. toString',
      'ג. toFixed',
      'ד. valueOf',
      ':3 שאלה מספר',
      'מה גודל int ב-Java?',
      'א. 16 ביט',
      'ב. 32 ביט',
      'ג. 64 ביט',
      'ד. 8 ביט',
      ':4 שאלה מספר',
      'מהי סיבוכיות Bubble Sort?',
      'א. O(n)',
      'ב. O(n log n)',
      'ג. O(n²)',
      'ד. O(log n)',
      ':5 שאלה מספר',
      'מה מציין HTTP status code 404?',
      'א. שגיאת שרת',
      'ב. בקשה תקינה',
      'ג. משאב לא נמצא',
      'ד. הפניה',
    ].join('\n')

    const { questions } = parseExam(fixture)
    expect(questions).toHaveLength(5)
    expect(questions.map(q => q.number)).toEqual([1, 2, 3, 4, 5])
    for (const q of questions) {
      expect(q.options).toHaveLength(4)
    }
  })
})

describe('diagnoseParsedExam', () => {
  it('empty exam → zero counts', () => {
    const diag = diagnoseParsedExam({ questions: [] })
    expect(diag.parsedQuestionCount).toBe(0)
    expect(diag.questionsWithFewerThanTwoOptions).toEqual([])
    expect(diag.duplicateQuestionNumbers).toEqual([])
    expect(diag.questionNumbers).toEqual([])
  })

  it('counts questions with fewer than 2 options', () => {
    const { questions } = parseExam('1. שאלה\nא. רק אחד\n2. שאלה\nא. כן\nב. לא')
    const diag = diagnoseParsedExam({ questions })
    expect(diag.questionsWithFewerThanTwoOptions).toContain(1)
    expect(diag.questionsWithFewerThanTwoOptions).not.toContain(2)
  })

  it('detects duplicate question numbers', () => {
    // Two questions with the same number — happens when normalization is imperfect
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא\n1. שאלה\nא. כן\nב. לא')
    const diag = diagnoseParsedExam({ questions })
    expect(diag.duplicateQuestionNumbers).toContain(1)
  })

  it('parsedQuestionCount equals questions array length', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא\n2. שאלה\nא. כן\nב. לא')
    expect(diagnoseParsedExam({ questions }).parsedQuestionCount).toBe(2)
  })
})

describe('sequenceIndex on ParsedQuestion', () => {
  it('first question gets sequenceIndex 0', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא')
    expect(questions[0].sequenceIndex).toBe(0)
  })

  it('second question gets sequenceIndex 1', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא\n2. שאלה\nא. כן\nב. לא')
    expect(questions[1].sequenceIndex).toBe(1)
  })

  it('duplicate question numbers still get distinct sequenceIndex', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא\n1. שאלה שנייה\nא. כן\nב. לא')
    expect(questions).toHaveLength(2)
    expect(questions[0].sequenceIndex).toBe(0)
    expect(questions[1].sequenceIndex).toBe(1)
  })

  it('3 questions with identical numbers have sequenceIndex 0, 1, 2', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\n1. שאלה\nא. כן\n1. שאלה\nא. כן')
    expect(questions).toHaveLength(3)
    expect(questions.map(q => q.sequenceIndex)).toEqual([0, 1, 2])
  })

  it('sequenceIndex is independent of question number value', () => {
    // Out-of-order numbers 5, 1, 3 — sequenceIndex must still be 0, 1, 2
    const { questions } = parseExam('5. שאלה\nא. כן\n1. שאלה\nא. כן\n3. שאלה\nא. כן')
    expect(questions.map(q => q.sequenceIndex)).toEqual([0, 1, 2])
  })
})

describe('nonSequentialNumbers in diagnoseParsedExam', () => {
  it('sequential numbers produce empty nonSequentialNumbers', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא\n2. שאלה\nא. כן\nב. לא')
    expect(diagnoseParsedExam({ questions }).nonSequentialNumbers).toEqual([])
  })

  it('detects a number lower than the previous question number', () => {
    const { questions } = parseExam('3. שאלה\nא. כן\nב. לא\n1. שאלה\nא. כן\nב. לא')
    expect(diagnoseParsedExam({ questions }).nonSequentialNumbers).toContain(1)
  })

  it('empty exam has nonSequentialNumbers []', () => {
    expect(diagnoseParsedExam({ questions: [] }).nonSequentialNumbers).toEqual([])
  })
})

describe('outputQuestionNumber on ParsedQuestion', () => {
  it('is 1 for the first question regardless of source number', () => {
    const { questions } = parseExam('5. שאלה\nא. כן\nב. לא')
    expect(questions[0].outputQuestionNumber).toBe(1)
    expect(questions[0].number).toBe(5)
  })

  it('is sequential 1,2,3 even with duplicate source numbers', () => {
    const { questions } = parseExam(
      '3. שאלה\nא. כן\nב. לא\n3. שאלה\nא. כן\nב. לא\n3. שאלה\nא. כן\nב. לא',
    )
    expect(questions.map(q => q.outputQuestionNumber)).toEqual([1, 2, 3])
  })

  it('RE_RTL_PERIOD: ".70" (3-digit) does NOT create a spurious question', () => {
    // ".70" is a 2-digit number — wait, 70 is 2 digits. Let's use ".123" for 3-digit.
    // The regex restricts to \d{1,2} so ".123" should NOT fire.
    const { questions } = parseExam('1. שאלה\nמהו ערך ה-accuracy?\n.123 הערה בתוך השאלה\nא. 95%\nב. 70%')
    // ".123" (3 digits) must not create question 123
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(1)
  })

  it('RE_RTL_PERIOD: ".5" (1-digit) still creates question 5', () => {
    const { questions } = parseExam('.5\nמהו הפלט?\nא. 0\nב. 1')
    expect(questions).toHaveLength(1)
    expect(questions[0].number).toBe(5)
    expect(questions[0].outputQuestionNumber).toBe(1)
  })

  it('question number 0 is rejected — no question created', () => {
    // ".0" should match RE_RTL_PERIOD but the guard "questionNumber <= 0" rejects it
    const { questions } = parseExam('.0\nטקסט\nא. כן\nב. לא')
    expect(questions).toHaveLength(0)
  })
})

describe('QuestionStatus on ParsedQuestion', () => {
  it('status is ok for a normal 4-option question', () => {
    const { questions } = parseExam('1. שאלה?\nא. ראשון\nב. שני\nג. שלישי\nד. רביעי')
    expect(questions[0].status).toBe('ok')
  })

  it('status is few-options when fewer than 2 options', () => {
    const { questions } = parseExam('1. שאלה?\nא. יחיד')
    expect(questions[0].status).toBe('few-options')
  })

  it('status is few-options for a question with zero options', () => {
    const { questions } = parseExam('1. שאלה ללא תשובות')
    expect(questions[0].status).toBe('few-options')
  })

  it('status is huge-block when questionText.length > 500 chars', () => {
    const longText = 'א'.repeat(501)
    const { questions } = parseExam(`1. ${longText}\nא. כן\nב. לא`)
    expect(questions[0].status).toBe('huge-block')
  })

  it('status is visual-content when question text mentions "הגרף"', () => {
    const { questions } = parseExam('1. בהתייחס להגרף הבא, מה נכון?\nא. עולה\nב. יורד')
    expect(questions[0].status).toBe('visual-content')
  })
})

describe('hasVisualContent on ParsedQuestion', () => {
  it('is true when question text mentions "הגרף הבא"', () => {
    const { questions } = parseExam('1. הגרף הבא מציג נתונים\nא. כן\nב. לא')
    expect(questions[0].hasVisualContent).toBe(true)
  })

  it('is true when all 2+ options have blank/single-char text (≤ 1 char)', () => {
    // Single Hebrew letter per option = label only, no real text = likely visual/image option
    const { questions } = parseExam('1. שאלה\nא. א\nב. ב')
    expect(questions[0].hasVisualContent).toBe(true)
  })

  it('is false for a normal text question with meaningful option text', () => {
    const { questions } = parseExam('1. מהו 2+2?\nא. ארבע\nב. חמש')
    expect(questions[0].hasVisualContent).toBe(false)
  })

  it('is false when options are short valid Hebrew words like כן/לא (2 chars each)', () => {
    // "כן" and "לא" are 2 chars — not flagged as blank visual options
    const { questions } = parseExam('1. מהו הפלט?\nא. כן\nב. לא')
    expect(questions[0].hasVisualContent).toBe(false)
  })
})

describe('diagnoseParsedExam — hasVisualContentCount and needsReviewCount', () => {
  it('hasVisualContentCount is 0 for a normal exam', () => {
    const { questions } = parseExam('1. שאלה?\nא. ראשון\nב. שני\nג. שלישי\nד. רביעי')
    expect(diagnoseParsedExam({ questions }).hasVisualContentCount).toBe(0)
  })

  it('hasVisualContentCount counts visual-content questions', () => {
    const text = [
      '1. הגרף הבא מציג מה?\nא. עולה\nב. יורד',
      '2. שאלה רגילה\nא. ראשון\nב. שני',
    ].join('\n')
    const { questions } = parseExam(text)
    expect(diagnoseParsedExam({ questions }).hasVisualContentCount).toBe(1)
  })

  it('needsReviewCount is 0 when all questions have status ok', () => {
    const { questions } = parseExam('1. שאלה?\nא. ראשון\nב. שני')
    expect(diagnoseParsedExam({ questions }).needsReviewCount).toBe(0)
  })

  it('needsReviewCount counts non-ok questions', () => {
    // Q1 has 1 option → few-options; Q2 is ok
    const { questions } = parseExam('1. שאלה?\nא. בלבד\n2. שאלה?\nא. ראשון\nב. שני')
    expect(diagnoseParsedExam({ questions }).needsReviewCount).toBe(1)
  })
})

describe('hasMissingVisualContent on ParsedQuestion', () => {
  it('"הגרף הבא" with no inline code → hasMissingVisualContent = true', () => {
    const { questions } = parseExam('1. הגרף הבא מציג נתונים — מה נכון?\nא. עולה\nב. יורד')
    expect(questions[0]!.hasMissingVisualContent).toBe(true)
  })

  it('"נתון קטע הקוד הבא" with SELECT query → hasMissingVisualContent is falsy', () => {
    const { questions } = parseExam(
      '1. נתון קטע הקוד הבא: SELECT name FROM users WHERE id=1\nא. מחזיר שם\nב. שגיאה',
    )
    // hasMissingVisualContent is optional; when inline code is present it is false/undefined (falsy)
    expect(questions[0]!.hasMissingVisualContent).toBeFalsy()
  })

  it('"הטבלה הבאה" with no inline table → hasMissingVisualContent = true', () => {
    const { questions } = parseExam('1. הטבלה הבאה מציגה נתוני מכירות:\nא. עולה\nב. יורד')
    expect(questions[0]!.hasMissingVisualContent).toBe(true)
  })

  it('"הדיאגרמה" → hasMissingVisualContent = true', () => {
    const { questions } = parseExam('1. לפי הדיאגרמה, מה נכון?\nא. A\nב. B')
    expect(questions[0]!.hasMissingVisualContent).toBe(true)
  })

  it('normal question without visual keywords → hasMissingVisualContent is falsy', () => {
    const { questions } = parseExam('1. מהו 2+2?\nא. 4\nב. 5')
    expect(questions[0]!.hasMissingVisualContent).toBeFalsy()
  })
})

describe('QuestionStatus — suspicious-number > 999', () => {
  it('status is suspicious-number when source number > 999', () => {
    // Use שאלה מספר N format so the number parses correctly
    const { questions } = parseExam('שאלה מספר 1000\nמה הפלט?\nא. כן\nב. לא')
    expect(questions[0]!.status).toBe('suspicious-number')
    expect(questions[0]!.number).toBe(1000)
  })

  it('status is NOT suspicious-number when source number = 999', () => {
    const { questions } = parseExam('שאלה מספר 999\nמה הפלט?\nא. כן\nב. לא')
    expect(questions[0]!.status).not.toBe('suspicious-number')
  })
})

describe('percentage protection — שאלה מספר N%', () => {
  it('"שאלה מספר 70%" does NOT create question 70', () => {
    // The percentage immediately follows the number → should be rejected as question start
    const { questions } = parseExam('1. שאלה\nא. accuracy=שאלה מספר 70% precision\nב. לא')
    // Question text comes from Q1, not a spurious Q70
    expect(questions).toHaveLength(1)
    expect(questions[0]!.number).toBe(1)
  })
})

describe('diagnoseParsedExam — new count fields', () => {
  it('autoSplitCount is 0 when no splitFromEmbedded questions', () => {
    const { questions } = parseExam('1. שאלה\nא. כן\nב. לא')
    expect(diagnoseParsedExam({ questions }).autoSplitCount).toBe(0)
  })

  it('suspiciousNumberCount counts suspicious-number questions', () => {
    // Number > 999 → suspicious
    const { questions } = parseExam('שאלה מספר 1001\nמה?\nא. א\nב. ב')
    expect(diagnoseParsedExam({ questions }).suspiciousNumberCount).toBe(1)
  })

  it('missingVisualContentCount counts hasMissingVisualContent questions', () => {
    const { questions } = parseExam('1. הגרף הבא מציג:\nא. עולה\nב. יורד')
    expect(diagnoseParsedExam({ questions }).missingVisualContentCount).toBe(1)
  })
})
