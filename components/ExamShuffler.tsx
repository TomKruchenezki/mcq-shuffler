'use client'

import { useState } from 'react'
import { parseExam } from '@/lib/parser/parseQuestions'
import { shuffleExam, generateAnswerKey } from '@/lib/shuffle/shuffleExam'
import { shuffleVisualExam, generateVisualAnswerKey } from '@/lib/shuffle/shuffleVisualExam'
import type { ParsedExam, ParsedQuestion } from '@/lib/parser/parseQuestions'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'
import type { VisualQuestion, ShuffledVisualExam } from '@/lib/extract/pdfEngine/visualTypes'
import type { VisualExtractionResult } from '@/lib/extract/pdfEngine/visualTypes'
import { parsedToEditable, editableToParsed } from '@/lib/editor/editableExam'
import { validateEditableExam } from '@/lib/editor/validateEditableExam'
import type { EditableExam } from '@/lib/editor/editableExam'
import ParsedExamPreview from './ParsedExamPreview'
import ShuffledExamView from './ShuffledExamView'
import VisualShuffledExamView from './VisualShuffledExamView'
import VisualPrintableExam from './VisualPrintableExam'
import AnswerKeyTable from './AnswerKeyTable'
import ExportButtons from './ExportButtons'
import FileUpload from './FileUpload'
import PrintableExam from './PrintableExam'
import ManualExamEditor from './ManualExamEditor'

const SAMPLE_EXAM_TEXT = `1. מה מחזירה הפונקציה getUserName כאשר user_id=123?
א. היא מחזירה string תקין
ב. היא מחזירה null
ג. היא זורקת Exception
ד. היא מחזירה number

2. אם accuracy=95% ו־precision=80%, מה נכון?
א. הטענה הראשונה נכונה
ב. הטענה השנייה נכונה
ג. שתי הטענות נכונות
ד. אף טענה אינה נכונה

3. איזו שאילתה מחזירה משתמש לפי id?
א. SELECT * FROM users WHERE id = 5
ב. DELETE FROM users WHERE id = 5
ג. UPDATE users SET id = 5
ד. INSERT INTO users(id) VALUES(5)`

const TEXTAREA_PLACEHOLDER = `שאלה 1
מה הערך שמחזירה פונקציה ריקה?
א. null
ב. undefined
ג. 0
ד. ""`

export default function ExamShuffler() {
  const [rawText, setRawText] = useState('')
  const [parsedExam, setParsedExam] = useState<ParsedExam | null>(null)
  const [editableExam, setEditableExam] = useState<EditableExam | null>(null)
  const [shuffledExam, setShuffledExam] = useState<ShuffledExam | null>(null)
  const [answerKey, setAnswerKey] = useState<AnswerKeyRow[] | null>(null)
  const [questionOrder, setQuestionOrder] = useState<'file' | 'numeric'>('file')

  // Parallel visual pipeline state
  const [visualQuestions, setVisualQuestions] = useState<VisualQuestion[] | null>(null)
  const [shuffledVisualExam, setShuffledVisualExam] = useState<ShuffledVisualExam | null>(null)

  /** Returns questions in the selected display/shuffle order. Stable: same number → preserve file order. */
  function sortedForOrder(exam: ParsedExam): ParsedQuestion[] {
    if (questionOrder === 'file') return exam.questions
    return [...exam.questions].sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number
      return a.sequenceIndex - b.sequenceIndex
    })
  }

  const canShuffle =
    (editableExam !== null && editableExam.questions.length > 0) ||
    (parsedExam !== null && parsedExam.questions.length > 0) ||
    (visualQuestions !== null && visualQuestions.length > 0)

  function handleParse() {
    const result = parseExam(rawText)
    setParsedExam(result)
    setEditableExam(parsedToEditable(result))
    setShuffledExam(null)
    setAnswerKey(null)
  }

  function handleShuffle() {
    // Visual pipeline takes priority when visual questions are loaded
    if (visualQuestions && visualQuestions.length > 0) {
      const shuffled = shuffleVisualExam(visualQuestions)
      setShuffledVisualExam(shuffled)
      setAnswerKey(generateVisualAnswerKey(shuffled))
      return
    }
    // Use editableExam (post-manual-edit) if available, otherwise fall back to parsedExam
    const examToShuffle = editableExam
      ? editableToParsed(editableExam)
      : parsedExam
    if (!examToShuffle || examToShuffle.questions.length === 0) return
    const orderedExam: ParsedExam = { questions: sortedForOrder(examToShuffle) }
    const shuffled = shuffleExam(orderedExam)
    setShuffledExam(shuffled)
    setAnswerKey(generateAnswerKey(shuffled))
  }

  function handleVisualExtracted(r: VisualExtractionResult) {
    setVisualQuestions(r.visualQuestions)
    setShuffledVisualExam(null)
    setAnswerKey(null)
  }

  function handleReset() {
    setRawText('')
    setParsedExam(null)
    setEditableExam(null)
    setShuffledExam(null)
    setAnswerKey(null)
    setQuestionOrder('file')
    setVisualQuestions(null)
    setShuffledVisualExam(null)
  }

  const showReset = parsedExam !== null || shuffledExam !== null || visualQuestions !== null || shuffledVisualExam !== null

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-8 no-print" dir="rtl">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
        מערבל תשובות אמריקאיות
      </h1>

      {/* File upload */}
      <FileUpload
        onExtracted={(t) => setRawText(t)}
        onVisualExtracted={handleVisualExtracted}
      />

      {/* Quick-fill demo button */}
      <div className="mb-3 text-start">
        <button
          type="button"
          onClick={() => setRawText(SAMPLE_EXAM_TEXT)}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          טען דוגמה
        </button>
      </div>

      {/* Textarea */}
      <div className="mb-4">
        <label className="block font-medium text-gray-700 mb-2" htmlFor="exam-input">
          הדבק כאן את המבחן
        </label>
        <textarea
          id="exam-input"
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          placeholder={TEXTAREA_PLACEHOLDER}
          dir="rtl"
          className="w-full h-48 border border-gray-300 rounded-lg p-3 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        />
      </div>

      {/* Action buttons row */}
      <div className="flex gap-3 flex-wrap mb-2">
        <button
          type="button"
          onClick={handleParse}
          disabled={!rawText.trim()}
          className="px-5 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          נתח מבחן
        </button>

        <button
          type="button"
          onClick={handleShuffle}
          disabled={!canShuffle}
          className="px-5 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ערבב תשובות
        </button>

        {showReset && (
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            נקה הכל
          </button>
        )}
      </div>

      {/* Question ordering toggle — shown once questions are parsed */}
      {parsedExam !== null && parsedExam.questions.length > 0 && (
        <div className="flex items-center gap-3 mb-2 mt-1 text-sm" dir="rtl">
          <span className="text-gray-600">סידור שאלות:</span>
          {(['file', 'numeric'] as const).map(order => (
            <label key={order} className="flex items-center gap-1 cursor-pointer text-gray-700">
              <input
                type="radio"
                name="questionOrder"
                value={order}
                checked={questionOrder === order}
                onChange={() => setQuestionOrder(order)}
                className="accent-gray-600"
              />
              {order === 'file' ? 'לפי סדר הקובץ' : 'לפי מספר שאלה'}
            </label>
          ))}
        </div>
      )}

      {/* Parsed preview (text mode only) */}
      {parsedExam !== null && (
        <ParsedExamPreview
          exam={{ questions: sortedForOrder(parsedExam) }}
        />
      )}

      {/* Manual exam editor — shown after parsing */}
      {editableExam !== null && (
        <ManualExamEditor
          exam={editableExam}
          onChange={setEditableExam}
        />
      )}

      {/* Validation summary + secondary shuffle button */}
      {editableExam !== null && (() => {
        const validation = validateEditableExam(editableExam)
        const hasWarnings = validation.warnings.length > 0
        return (
          <div className="mt-2 mb-4 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2" dir="rtl">
            <div className="flex items-center gap-3 flex-wrap text-sm font-medium">
              <span className="text-green-700">✅ {validation.counts.ok} תקינות</span>
              {validation.counts.noCorrectAnswer > 0 && (
                <span className="text-red-600">❌ {validation.counts.noCorrectAnswer} ללא תשובה נכונה</span>
              )}
              {validation.counts.tooFewOptions > 0 && (
                <span className="text-red-600">⚠ {validation.counts.tooFewOptions} עם פחות מ-2 תשובות</span>
              )}
              {validation.counts.emptyOptions > 0 && (
                <span className="text-amber-600">⚠ {validation.counts.emptyOptions} עם תשובות ריקות</span>
              )}
              {validation.counts.missingVisualContent > 0 && (
                <span className="text-orange-600">📊 {validation.counts.missingVisualContent} חסרות תוכן חזותי</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleShuffle}
              className={`px-5 py-2 rounded-lg font-semibold text-white transition-colors ${
                hasWarnings
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {hasWarnings ? 'המשך לערבוב למרות האזהרות ↓' : 'המשך לערבוב ↓'}
            </button>
          </div>
        )
      })()}

      {/* Shuffled exam — text mode */}
      {shuffledExam !== null && <ShuffledExamView exam={shuffledExam} />}

      {/* Shuffled exam — visual mode */}
      {shuffledVisualExam !== null && <VisualShuffledExamView exam={shuffledVisualExam} />}

      {/* Answer key */}
      {answerKey !== null && answerKey.length > 0 && <AnswerKeyTable rows={answerKey} />}

      {/* Export buttons */}
      <ExportButtons
        shuffledExam={shuffledExam}
        shuffledVisualExam={shuffledVisualExam}
        answerKey={answerKey}
      />
    </div>

    {shuffledExam && (
      <div className="print-only">
        <PrintableExam exam={shuffledExam} />
      </div>
    )}

    {shuffledVisualExam && (
      <div className="print-only">
        <VisualPrintableExam exam={shuffledVisualExam} />
      </div>
    )}
    </>
  )
}
