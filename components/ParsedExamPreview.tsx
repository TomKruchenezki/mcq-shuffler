'use client'

import { useState } from 'react'
import type { ParsedExam, QuestionStatus } from '@/lib/parser/parseQuestions'
import { diagnoseParsedExam } from '@/lib/parser/parseQuestions'

interface Props {
  exam: ParsedExam
}

const STATUS_LABEL: Record<QuestionStatus, string> = {
  ok: '',
  'few-options': '⚠ פחות מ-2 תשובות',
  'visual-content': '📊 תוכן חזותי',
  'suspicious-number': '⚠ מספר שאלה חשוד',
  'huge-block': '⚠ שאלה גדולה / ייתכן מיזוג',
}

export default function ParsedExamPreview({ exam }: Props) {
  const [sortBySource, setSortBySource] = useState(false)
  const [expandedChip, setExpandedChip] = useState<string | null>(null)

  const count = exam.questions.length

  if (count === 0) {
    return (
      <div className="my-6 p-4 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800" dir="rtl">
        <p role="alert">לא זוהו שאלות — ודא שהטקסט כולל מספרי שאלות (כגון שאלה 1 או 1.)</p>
      </div>
    )
  }

  const diag = diagnoseParsedExam(exam)
  const okCount = exam.questions.filter(q => q.status === 'ok').length

  const displayQuestions = sortBySource
    ? [...exam.questions].sort((a, b) => a.number - b.number)
    : exam.questions

  const hasNonTrivialSourceNumbers = exam.questions.some(
    q => q.number !== q.outputQuestionNumber,
  )

  return (
    <section className="my-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800">תוצאות ניתוח — {count} שאלות</h2>

      {/* Summary status bar */}
      {(diag.hasVisualContentCount > 0 || diag.needsReviewCount > 0 ||
        diag.suspiciousNumberCount > 0 || diag.missingVisualContentCount > 0 ||
        diag.autoSplitCount > 0) && (
        <div className="space-y-1">
          <div className="text-sm text-gray-500 flex gap-3 flex-wrap py-1 items-center">
            <span>✅ תקין: {okCount}</span>
            {diag.needsReviewCount > 0 && (
              <span>⚠ דורש בדיקה: {diag.needsReviewCount}</span>
            )}
            {diag.hasVisualContentCount > 0 && (
              <span>📊 תוכן חזותי: {diag.hasVisualContentCount}</span>
            )}
            {diag.suspiciousNumberCount > 0 && (
              <button
                type="button"
                onClick={() => setExpandedChip(c => c === 'suspicious' ? null : 'suspicious')}
                className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer"
              >
                ⚠ מספר חשוד: {diag.suspiciousNumberCount}
              </button>
            )}
            {diag.missingVisualContentCount > 0 && (
              <button
                type="button"
                onClick={() => setExpandedChip(c => c === 'missingVisual' ? null : 'missingVisual')}
                className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors cursor-pointer"
              >
                📊 חסר תוכן חזותי/קוד: {diag.missingVisualContentCount}
              </button>
            )}
            {diag.autoSplitCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                ✂ פוצלו אוטומטית: {diag.autoSplitCount}
              </span>
            )}
          </div>

          {/* Expandable lists */}
          {expandedChip === 'suspicious' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
              שאלות עם מספר מקור חשוד (פלט):{' '}
              {exam.questions
                .filter(q => q.status === 'suspicious-number')
                .map(q => q.outputQuestionNumber)
                .join(', ')}
            </p>
          )}
          {expandedChip === 'missingVisual' && (
            <p className="text-xs text-orange-700 bg-orange-50 rounded p-2">
              שאלות עם תוכן חזותי/קוד חסר (פלט):{' '}
              {exam.questions
                .filter(q => q.hasMissingVisualContent)
                .map(q => q.outputQuestionNumber)
                .join(', ')}
            </p>
          )}
        </div>
      )}

      {diag.duplicateQuestionNumbers.length > 0 && (
        <p className="text-amber-600 text-sm" role="alert">
          ⚠ מספרי שאלות כפולים: {diag.duplicateQuestionNumbers.join(', ')}
        </p>
      )}
      {diag.questionsWithFewerThanTwoOptions.length > 1 && (
        <p className="text-amber-600 text-sm" role="alert">
          ⚠ {diag.questionsWithFewerThanTwoOptions.length} שאלות עם פחות מ-2 תשובות
        </p>
      )}
      {diag.suspiciousHugeBlocks.length > 0 && (
        <p className="text-amber-600 text-sm" role="alert">
          ⚠ בלוק טקסט חשוד גדול — ייתכן שמספר שאלות הוכנסו לאחת: שאלות {diag.suspiciousHugeBlocks.join(', ')}
        </p>
      )}
      {diag.nonSequentialNumbers.length > 0 && (
        <p className="text-gray-500 text-sm">
          ℹ מספרי מקור לא עולים בסדר (מספור הפלט 1..N תקין): {diag.nonSequentialNumbers.join(', ')}
        </p>
      )}

      {/* Sort toggle */}
      {hasNonTrivialSourceNumbers && (
        <button
          type="button"
          onClick={() => setSortBySource(s => !s)}
          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          {sortBySource ? 'סדר לפי רצף (1,2,3...)' : 'סדר לפי מספר מקור'}
        </button>
      )}

      {displayQuestions.map(q => (
        <article key={q.sequenceIndex} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p dir="rtl" className="font-semibold text-gray-800 leading-relaxed">
            <strong className="text-blue-600 ml-2">
              שאלה {q.outputQuestionNumber}:
              {q.number !== q.outputQuestionNumber && (
                <span
                  className={`text-xs font-normal mr-1 ${
                    q.status === 'suspicious-number' ? 'text-amber-500' : 'text-gray-400'
                  }`}
                >
                  {q.status === 'suspicious-number'
                    ? ` (מקור חשוד: ${q.number})`
                    : ` (מקור: ${q.number})`}
                </span>
              )}
            </strong>
            {q.status !== 'ok' && (
              <span className="text-xs font-normal text-amber-600 mr-2">{STATUS_LABEL[q.status]}</span>
            )}
            <span style={{ direction: 'rtl', unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}>
              {q.questionText}
            </span>
          </p>
          <ol className="space-y-1.5 list-none p-0 m-0">
            {q.options.map(opt => (
              <li key={opt.originalIndex} className="flex gap-2 py-0.5">
                <span className="flex-shrink-0 font-medium text-gray-400 w-6 text-center select-none">
                  {opt.originalLabel}.
                </span>
                <span dir="auto" style={{ unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }} className="flex-1 text-gray-700 text-start">
                  {opt.text}
                </span>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  )
}
