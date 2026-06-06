import type { ParsedExam } from '@/lib/parser/parseQuestions'

interface Props {
  exam: ParsedExam
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

  return (
    <section className="my-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800">תוצאות ניתוח — {count} שאלות</h2>
      {exam.questions.map(q => (
        <article key={q.number} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p dir="rtl" className="font-semibold text-gray-800 leading-relaxed">
            <strong className="text-blue-600 ml-2">שאלה {q.number}:</strong>
            {q.questionText}
          </p>
          {q.options.length < 2 && (
            <p className="text-amber-600 text-sm" role="alert">
              ⚠ שאלה {q.number}: פחות מ-2 תשובות זוהו
            </p>
          )}
          <ol className="space-y-1.5 list-none p-0 m-0">
            {q.options.map(opt => (
              <li key={opt.originalIndex} className="flex gap-2 py-0.5">
                <span className="flex-shrink-0 font-medium text-gray-400 w-6 text-center select-none">
                  {opt.originalLabel}.
                </span>
                <span dir="auto" className="flex-1 text-gray-700 text-start">
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
