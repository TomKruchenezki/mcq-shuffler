import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'

interface Props {
  exam: ShuffledExam
  title?: string
}

export default function PrintableExam({ exam, title = 'מבחן מעורבב' }: Props) {
  return (
    <div className="printable-exam" dir="rtl" lang="he">
      <h1 style={{ textAlign: 'right', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
        {title}
      </h1>

      {exam.questions.map(q => (
        <article key={q.number} className="printable-question">
          <p dir="rtl" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {q.number}. {q.questionText}
          </p>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {q.options.map(opt => (
              <li key={opt.originalIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ flexShrink: 0, fontWeight: 'bold', minWidth: '1.5rem', textAlign: 'right' }}>
                  {opt.label}.
                </span>
                <span dir="auto">
                  {opt.text}
                </span>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  )
}
