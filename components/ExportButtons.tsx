'use client'

import { useState } from 'react'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'
import { exportDocx } from '@/lib/export/exportDocx'
import { exportCsv } from '@/lib/export/exportCsv'

interface Props {
  shuffledExam: ShuffledExam | null
  answerKey: AnswerKeyRow[] | null
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportButtons({ shuffledExam, answerKey }: Props) {
  const [error, setError] = useState<string | null>(null)
  const disabled = shuffledExam === null

  async function handleDocx() {
    if (!shuffledExam) return
    setError(null)
    try {
      const blob = await exportDocx(shuffledExam)
      triggerDownload(blob, 'מבחן_מעורבב.docx')
    } catch {
      setError('שגיאה ביצירת קובץ Word')
    }
  }

  function handleCsv() {
    if (!answerKey) return
    setError(null)
    try {
      const csv = exportCsv(answerKey)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      triggerDownload(blob, 'מפתח_תשובות.csv')
    } catch {
      setError('שגיאה ביצירת קובץ CSV')
    }
  }

  function handlePdf() {
    window.print()
  }

  return (
    <div className="my-4 flex gap-3 flex-wrap items-center" dir="rtl">
      {error && (
        <p role="alert" className="w-full text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleDocx}
        disabled={disabled}
        className="px-5 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        הורד מבחן כ-Word
      </button>
      <button
        type="button"
        onClick={handleCsv}
        disabled={disabled || !answerKey?.length}
        className="px-5 py-2 rounded-lg font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        הורד מפתח תשובות כ-CSV
      </button>
      <button
        type="button"
        onClick={handlePdf}
        disabled={disabled}
        className="px-5 py-2 rounded-lg font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        הורד מבחן כ-PDF
      </button>
      {!disabled && (
        <p className="w-full text-sm text-gray-500 mt-1">
          הדפדפן יפתח חלון הדפסה — בחר &quot;שמירה כ-PDF&quot;.
        </p>
      )}
    </div>
  )
}
