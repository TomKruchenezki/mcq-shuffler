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

  return (
    <section className="my-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800">תוצאות ניתוח — {count} שאלות</h2>

      {/* Summary status bar */}
      {(diag.hasVisualContentCount > 0 || diag.needsReviewCount > 0) && (
        <div className="text-sm text-gray-500 flex gap-3 flex-wrap py-1">
          <span>✅ תקין: {okCount}</span>
          {diag.needsReviewCount > 0 && (
            <span>⚠ דורש בדיקה: {diag.needsReviewCount}</span>
          )}
          {diag.hasVisualContentCount > 0 && (
            <span>📊 תוכן חזותי: {diag.hasVisualContentCount}</span>
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
        <p className="text-amber-600 text-sm" role="alert">
          ⚠ מספרי שאלות לא עולים בסדר — ייתכן שגיאת קריאה: שאלות {diag.nonSequentialNumbers.join(', ')}
        </p>
      )}
      {exam.questions.map(q => (
        <article key={q.sequenceIndex} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p dir="rtl" className="font-semibold text-gray-800 leading-relaxed">
            <strong className="text-blue-600 ml-2">
              שאלה {q.outputQuestionNumber}:
              {q.number !== q.outputQuestionNumber && (
                <span className="text-xs text-gray-400 font-normal mr-1"> (מקור: {q.number})</span>
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
