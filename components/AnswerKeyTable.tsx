import type { AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

interface Props {
  rows: AnswerKeyRow[]
}

export default function AnswerKeyTable({ rows }: Props) {
  return (
    <section className="my-6" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800 mb-3">מפתח תשובות</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="border border-gray-200 px-4 py-2 text-right font-semibold">שאלה</th>
              <th className="border border-gray-200 px-4 py-2 text-right font-semibold">תשובה נכונה</th>
              <th className="border border-gray-200 px-4 py-2 text-center font-semibold">תווית</th>
              <th className="border border-gray-200 px-4 py-2 text-center font-semibold">מיקום</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.questionNumber} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-4 py-2 text-center font-medium text-blue-600">
                  {row.questionNumber}
                </td>
                <td
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext' }}
                  className="border border-gray-200 px-4 py-2 text-start text-gray-800"
                >
                  {row.correctAnswerText}
                </td>
                <td className="border border-gray-200 px-4 py-2 text-center font-bold text-green-700">
                  {row.newCorrectLabel}
                </td>
                <td className="border border-gray-200 px-4 py-2 text-center text-gray-600">
                  {row.newCorrectIndex + 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
