'use client'

import { useState, type ChangeEvent } from 'react'
import { extractDocxText } from '@/lib/extract/extractDocx'
import { extractPdfHybrid, type PdfMode } from '@/lib/extract/pdfEngine/extractPdfHybrid'
import type { PdfExtractionQuality } from '@/lib/extract/extractPdf'
import type { VisualExtractionResult, ComplexityFlags } from '@/lib/extract/pdfEngine/visualTypes'

const PDF_MODE_LABELS: Record<PdfMode, string> = {
  auto: 'אוטומטי',
  fast: 'טקסט מהיר',
  ocr: 'OCR מקומי',
  visual: 'נאמנות גבוהה',
}

interface Props {
  onExtracted: (text: string) => void
  onVisualExtracted?: (result: VisualExtractionResult) => void
}

type Status = 'idle' | 'extracting' | 'done' | 'error'

export default function FileUpload({ onExtracted, onVisualExtracted }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [quality, setQuality] = useState<PdfExtractionQuality | null>(null)
  const [complexity, setComplexity] = useState<ComplexityFlags | null>(null)
  const [pdfMode, setPdfMode] = useState<PdfMode>('auto')
  const [ocrProgress, setOcrProgress] = useState<{ page: number; total: number; percent?: number } | null>(null)
  const [usedMode, setUsedMode] = useState<string | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError(null)
    setWarning(null)
    setPreviewText('')
    setQuality(null)
    setComplexity(null)
    setOcrProgress(null)
    setUsedMode(null)

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext !== 'docx' && ext !== 'pdf') {
      setStatus('error')
      setError('קובץ לא נתמך. יש להעלות קובץ DOCX או PDF בלבד.')
      return
    }

    setStatus('extracting')

    try {
      const buffer = await file.arrayBuffer()

      if (ext === 'docx') {
        const result = await extractDocxText(buffer)
        if (result.error) {
          setStatus('error')
          setError(result.error)
          return
        }
        setStatus('done')
        setPreviewText(result.text.slice(0, 300))
        onExtracted(result.text)

      } else if (pdfMode === 'visual') {
        // High-fidelity visual mode: bypass text pipeline
        const { extractPdfVisual } = await import('@/lib/extract/pdfEngine/extractPdfVisual')
        const visualResult = await extractPdfVisual(buffer, (page, total) => {
          setOcrProgress({ page, total })
        })
        setOcrProgress(null)

        if (visualResult.error) {
          setStatus('error')
          setError(visualResult.error)
          return
        }

        if (visualResult.visualQuestions.length === 0) {
          // Visual detection returned no usable questions — fall back to text extraction automatically
          setWarning(
            (visualResult.warning ? visualResult.warning + '\n' : '') +
            'עובר לחילוץ טקסטואלי אוטומטי במקום.',
          )
          const textResult = await extractPdfHybrid(buffer, 'auto', undefined)
          setStatus('done')
          if (!textResult.error && textResult.text) {
            if (textResult.quality) setQuality(textResult.quality)
            setComplexity(textResult.complexity ?? null)
            setPreviewText(textResult.text.slice(0, 300))
            setUsedMode('נאמנות גבוהה (עם חזרה לטקסט)')
            onExtracted(textResult.text)
          }
          // Note: does NOT call onVisualExtracted — stays in text mode
          return
        }

        if (visualResult.warning) setWarning(visualResult.warning)
        setUsedMode('נאמנות גבוהה')
        setStatus('done')
        onVisualExtracted?.(visualResult)
        onExtracted('')  // satisfies caller contract; ExamShuffler ignores empty string in visual mode

      } else {
        // Text-based modes: fast / auto / ocr
        let ocrWasUsed = false
        const result = await extractPdfHybrid(buffer, pdfMode, (page, total, percent) => {
          ocrWasUsed = true
          setOcrProgress({ page, total, percent })
        })
        setOcrProgress(null)

        if (result.error) {
          setStatus('error')
          setError(result.error)
          return
        }

        if (pdfMode === 'auto') {
          setUsedMode(ocrWasUsed ? 'אוטומטי (OCR)' : 'אוטומטי (טקסט)')
        } else {
          setUsedMode(PDF_MODE_LABELS[pdfMode])
        }

        setStatus('done')
        if (result.warning) setWarning(result.warning)
        if (result.quality) setQuality(result.quality)
        setComplexity(result.complexity ?? null)
        setPreviewText(result.text.slice(0, 300))
        onExtracted(result.text)
      }
    } catch {
      setStatus('error')
      setError('אירעה שגיאה בעת קריאת הקובץ.')
    }
  }

  return (
    <div className="mb-4 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50" dir="rtl">
      <label className="block font-medium text-gray-700 mb-2">
        העלה קובץ מבחן
      </label>

      <div className="mb-3">
        <p className="text-sm font-medium text-gray-700 mb-1">מצב עיבוד PDF:</p>
        <div className="flex gap-4 flex-wrap">
          {(['auto', 'fast', 'ocr', 'visual'] as PdfMode[]).map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600">
              <input
                type="radio"
                name="pdfMode"
                value={m}
                checked={pdfMode === m}
                onChange={() => setPdfMode(m)}
                className="accent-gray-600"
              />
              {PDF_MODE_LABELS[m]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          אוטומטי: מנסה טקסט, עובר ל-OCR בעת הצורך.
          נאמנות גבוהה: שומר שאלות כתמונות — מומלץ לשאלות עם גרפים, טבלאות ותרשימים.
          כל העיבוד מתבצע מקומית בדפדפן.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-colors">
          בחר קובץ
          <input
            type="file"
            accept=".docx,.pdf"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
        <span className="text-sm text-gray-500">קבצים נתמכים: DOCX או PDF טקסטואלי</span>
      </div>

      {fileName && (
        <p className="mt-2 text-sm text-gray-600">
          {status === 'extracting' ? `מחלץ טקסט מ: ${fileName}…` : `קובץ: ${fileName}`}
        </p>
      )}

      {ocrProgress && (
        <p className="mt-2 text-sm text-blue-600" dir="rtl">
          {pdfMode === 'visual'
            ? `מעבד עמוד ${ocrProgress.page} מתוך ${ocrProgress.total}…`
            : `מריץ OCR על עמוד ${ocrProgress.page} מתוך ${ocrProgress.total}${ocrProgress.percent != null ? ` (${ocrProgress.percent}%)` : ''}…`}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {warning && (
        <p role="alert" className="mt-2 text-sm text-amber-600">
          {warning}
        </p>
      )}

      {quality && (
        <div className="mt-2 text-xs text-gray-500 space-y-0.5" dir="rtl">
          <span className="inline-block ml-3">עמודים: {quality.pages}</span>
          <span className="inline-block ml-3">שאלות שזוהו: {quality.detectedQuestionMarkers}</span>
          <span className="inline-block ml-3">תשובות שזוהו: {quality.detectedOptionMarkers}</span>
          {usedMode && <span className="inline-block ml-3">מצב: {usedMode}</span>}
          {(!quality.hasEnoughLineBreaks || quality.suspiciousJoinedWords > 5) && (
            <p className="text-amber-600 mt-1">
              נראה שחלוץ הטקסט חלקי — בדוק את תצוגת המקדימה וודא שהשאלות נראות תקין.
            </p>
          )}
          {complexity && (complexity.hasImages || complexity.hasTables) && (
            <p className="text-blue-600 mt-1">
              זוהה מבנה מורכב — נסה מצב נאמנות גבוהה לשאלות עם גרפים וטבלאות
            </p>
          )}
        </div>
      )}

      {previewText && (
        <pre
          dir="auto"
          className="mt-3 text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono"
        >
          {previewText}
          {previewText.length === 300 ? '…' : ''}
        </pre>
      )}
    </div>
  )
}
