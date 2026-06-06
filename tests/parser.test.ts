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
