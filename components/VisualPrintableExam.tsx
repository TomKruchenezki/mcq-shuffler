import type { ShuffledVisualExam } from '@/lib/extract/pdfEngine/visualTypes'

interface Props {
  exam: ShuffledVisualExam
  title?: string
}

export default function VisualPrintableExam({ exam, title = 'מבחן מעורבב' }: Props) {
  return (
    <div className="visual-printable-exam" dir="rtl" lang="he">
      <h1
        style={{
          textAlign: 'right',
          marginBottom: '1.5rem',
          fontSize: '1.5rem',
          fontWeight: 'bold',
        }}
      >
        {title}
      </h1>
      {exam.questions.map(q => (
        <article
          key={q.number}
          className="printable-question"
          style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', flexShrink: 0 }}>{q.number}.</span>
            <img
              src={q.stemDataUrl}
              alt={`שאלה ${q.number}`}
              style={{ maxWidth: '100%', display: 'block' }}
            />
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {q.options.map(opt => (
              <li
                key={opt.originalIndex}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: '0.3rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 'bold',
                    flexShrink: 0,
                    minWidth: '1.5rem',
                    textAlign: 'right',
                  }}
                >
                  {opt.label}.
                </span>
                <img
                  src={opt.dataUrl}
                  alt={`תשובה ${opt.label}`}
                  style={{ maxWidth: '100%', display: 'block' }}
                />
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  )
}
