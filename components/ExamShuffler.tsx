'use client'

import { useState } from 'react'
import { parseExam } from '@/lib/parser/parseQuestions'
import { shuffleExam, generateAnswerKey } from '@/lib/shuffle/shuffleExam'
import type { ParsedExam } from '@/lib/parser/parseQuestions'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'
import ParsedExamPreview from './ParsedExamPreview'
import ShuffledExamView from './ShuffledExamView'
import AnswerKeyTable from './AnswerKeyTable'

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
  const [shuffledExam, setShuffledExam] = useState<ShuffledExam | null>(null)
  const [answerKey, setAnswerKey] = useState<AnswerKeyRow[] | null>(null)

  const canShuffle = parsedExam !== null && parsedExam.questions.length > 0

  function handleParse() {
    const result = parseExam(rawText)
    setParsedExam(result)
    setShuffledExam(null)
    setAnswerKey(null)
  }

  function handleShuffle() {
    if (!parsedExam) return
    const shuffled = shuffleExam(parsedExam)
    setShuffledExam(shuffled)
    setAnswerKey(generateAnswerKey(shuffled))
  }

  function handleReset() {
    setRawText('')
    setParsedExam(null)
    setShuffledExam(null)
    setAnswerKey(null)
  }

  const showReset = parsedExam !== null || shuffledExam !== null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir="rtl">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
        מערבל תשובות אמריקאיות
      </h1>

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

      {/* Parsed preview */}
      {parsedExam !== null && <ParsedExamPreview exam={parsedExam} />}

      {/* Shuffled exam */}
      {shuffledExam !== null && <ShuffledExamView exam={shuffledExam} />}

      {/* Answer key */}
      {answerKey !== null && answerKey.length > 0 && <AnswerKeyTable rows={answerKey} />}
    </div>
  )
}
