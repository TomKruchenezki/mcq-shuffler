'use client'

import { useState, type ChangeEvent } from 'react'
import { extractDocxText } from '@/lib/extract/extractDocx'
import { extractPdfText } from '@/lib/extract/extractPdf'

interface Props {
  onExtracted: (text: string) => void
}

type Status = 'idle' | 'extracting' | 'done' | 'error'

export default function FileUpload({ onExtracted }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setError(null)
    setWarning(null)
    setPreviewText('')

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
      } else {
        const result = await extractPdfText(buffer)
        if (result.error) {
          setStatus('error')
          setError(result.error)
          return
        }
        setStatus('done')
        if (result.warning) setWarning(result.warning)
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
