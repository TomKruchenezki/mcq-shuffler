import type { AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

export function escapeCsvField(value: string | number): string {
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportCsv(rows: AnswerKeyRow[]): string {
  const BOM = '﻿'
  const header = [
    'questionNumber',
    'correctAnswerText',
    'newCorrectLabel',
    'newCorrectIndex',
    'originalCorrectIndex',
  ].join(',')

  const dataRows = rows.map(row =>
    [
      escapeCsvField(row.questionNumber),
      escapeCsvField(row.correctAnswerText),
      escapeCsvField(row.newCorrectLabel),
      escapeCsvField(row.newCorrectIndex),
      escapeCsvField(row.originalCorrectIndex ?? 0),
    ].join(',')
  )

  return BOM + [header, ...dataRows].join('\r\n')
}
