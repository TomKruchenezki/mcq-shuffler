import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'

interface Props {
  exam: ShuffledExam
}

export default function ShuffledExamView({ exam }: Props) {
  return (
    <section className="my-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800">מבחן מעורבב</h2>
      {exam.questions.map(q => (
        <article key={q.number} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p dir="rtl" className="font-semibold text-gray-800 leading-relaxed">
            <strong className="text-blue-600 ml-2">שאלה {q.number}:</strong>
            {q.questionText}
          </p>
          <ol className="space-y-1.5 list-none p-0 m-0">
            {q.options.map(opt => (
              <li key={opt.originalIndex} className="flex gap-2 py-0.5">
                <span className="flex-shrink-0 font-medium text-gray-400 w-6 text-center select-none">
                  {opt.label}.
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
