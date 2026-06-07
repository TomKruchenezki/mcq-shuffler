'use client'

import type { ShuffledVisualExam } from '@/lib/extract/pdfEngine/visualTypes'

interface Props {
  exam: ShuffledVisualExam
}

export default function VisualShuffledExamView({ exam }: Props) {
  return (
    <section className="my-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        מבחן מעורבב
        <span className="text-xs font-normal px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
          מצב: נאמנות גבוהה
        </span>
      </h2>
      {exam.questions.map(q => (
        <article
          key={q.number}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
        >
          <div className="flex items-start gap-2">
            <span className="font-semibold text-blue-600 flex-shrink-0">{q.number}.</span>
            {/* visual-content badge — all visual-mode questions contain visual content */}
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full self-center">
              📊 תוכן חזותי
            </span>
            <img
              src={q.stemDataUrl}
              alt={`שאלה ${q.number}`}
              className="max-w-full block"
              dir="rtl"
            />
          </div>
          <ol className="space-y-2 list-none p-0 m-0">
            {q.options.map(opt => (
              <li key={opt.originalIndex} className="flex items-start gap-2">
                <span className="font-bold text-gray-700 flex-shrink-0 w-6 text-right select-none">
                  {opt.label}.
                </span>
                <img
                  src={opt.dataUrl}
                  alt={`תשובה ${opt.label}`}
                  className="max-w-full block"
                  dir="rtl"
                />
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  )
}
