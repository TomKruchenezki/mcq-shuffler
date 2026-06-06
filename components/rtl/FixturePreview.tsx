import type { Question } from '@/lib/parser/parseQuestions'
import QuestionCard from './QuestionCard'

interface Props {
  questions: Question[]
  title?: string
}

export default function FixturePreview({ questions, title }: Props) {
  return (
    <section className="space-y-4">
      {title && (
        <h2 dir="rtl" className="text-lg font-semibold text-gray-500 border-b border-gray-200 pb-2">
          {title}
        </h2>
      )}
      {questions.map((q, i) => (
        <QuestionCard key={i} question={q} index={i} />
      ))}
    </section>
  )
}
