import { describe, it, expect } from 'vitest'
import { exportCsv, escapeCsvField } from '@/lib/export/exportCsv'
import type { AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

function makeRow(overrides?: Partial<AnswerKeyRow>): AnswerKeyRow {
  return {
    questionNumber: 1,
    correctAnswerText: 'תשובה נכונה',
    newCorrectLabel: 'ג',
    newCorrectIndex: 2,
    originalCorrectIndex: 0,
    ...overrides,
  }
}

describe('escapeCsvField', () => {
  it('returns plain value unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps field containing comma in double quotes', () => {
    expect(escapeCsvField('yes, no')).toBe('"yes, no"')
  })

  it('doubles embedded double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps field containing newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('wraps field containing carriage return', () => {
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('converts numbers to strings', () => {
    expect(escapeCsvField(42)).toBe('42')
  })
})

describe('exportCsv', () => {
  it('starts with UTF-8 BOM (U+FEFF)', () => {
    const csv = exportCsv([makeRow()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('includes correct header row', () => {
    const csv = exportCsv([])
    const firstLine = csv.slice(1).split('\r\n')[0]
    expect(firstLine).toBe(
      'questionNumber,correctAnswerText,newCorrectLabel,newCorrectIndex,originalCorrectIndex'
    )
  })

  it('generates one data row per AnswerKeyRow', () => {
    const csv = exportCsv([makeRow({ questionNumber: 1 }), makeRow({ questionNumber: 2 })])
    const lines = csv.slice(1).split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2 data rows
  })

  it('preserves Hebrew text in correctAnswerText', () => {
    const csv = exportCsv([makeRow({ correctAnswerText: 'שלום עולם' })])
    expect(csv).toContain('שלום עולם')
  })

  it('escapes comma in correctAnswerText', () => {
    const csv = exportCsv([makeRow({ correctAnswerText: 'a, b' })])
    expect(csv).toContain('"a, b"')
  })

  it('escapes double-quote in correctAnswerText', () => {
    const csv = exportCsv([makeRow({ correctAnswerText: 'say "hi"' })])
    expect(csv).toContain('"say ""hi"""')
  })

  it('escapes newline in correctAnswerText', () => {
    const csv = exportCsv([makeRow({ correctAnswerText: 'line1\nline2' })])
    expect(csv).toContain('"line1\nline2"')
  })

  it('uses 0 for originalCorrectIndex when field is undefined', () => {
    const row: AnswerKeyRow = {
      questionNumber: 1,
      correctAnswerText: 'text',
      newCorrectLabel: 'א',
      newCorrectIndex: 0,
    }
    const csv = exportCsv([row])
    const dataLine = csv.slice(1).split('\r\n')[1]
    expect(dataLine?.endsWith(',0')).toBe(true)
  })

  it('does not mutate input rows array', () => {
    const rows = [makeRow()]
    const snapshot = JSON.stringify(rows)
    exportCsv(rows)
    expect(JSON.stringify(rows)).toBe(snapshot)
  })

  it('does not mutate individual AnswerKeyRow objects', () => {
    const row = makeRow()
    const snapshot = JSON.stringify(row)
    exportCsv([row])
    expect(JSON.stringify(row)).toBe(snapshot)
  })
})
