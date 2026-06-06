import type { Question } from '@/lib/parser/parseQuestions'

const OPTION_LABELS = ['א', 'ב', 'ג', 'ד'] as const

interface Props {
  question: Question
  index: number
}

export default function QuestionCard({ question, index }: Props) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <p dir="rtl" className="font-semibold text-gray-800 leading-relaxed">
        <span className="text-blue-600 ml-2 font-bold">{index + 1}.</span>
        {question.text}
      </p>
      <ol className="space-y-1.5 list-none p-0 m-0">
        {question.options.map((opt, i) => (
          <li key={i} className="flex gap-2 py-0.5">
            <span className="flex-shrink-0 font-medium text-gray-400 w-6 text-center select-none">
              {OPTION_LABELS[i] ?? String(i + 1)}.
            </span>
            {/*
              dir="auto": browser detects direction from first strong character.
              Hebrew options → RTL; pure SQL/code options → LTR.
              text-start aligns text to the start of its own detected direction.
            */}
            <span dir="auto" className="flex-1 text-gray-700 text-start">
              {opt}
            </span>
          </li>
        ))}
      </ol>
    </article>
  )
}
