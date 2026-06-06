import UploadZone from '@/components/UploadZone'
import QuestionList from '@/components/QuestionList'
import ExportButton from '@/components/ExportButton'
import FixturePreview from '@/components/rtl/FixturePreview'
import { rtlFixtures } from '@/fixtures/rtlFixtures'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2 text-center">MCQ Shuffler</h1>
      <p className="text-center text-gray-500 mb-8">
        העלה קובץ מבחן ובצע ערבוב אוטומטי של תשובות
      </p>
      <div className="max-w-3xl mx-auto space-y-8">
        <FixturePreview questions={rtlFixtures} title="דוגמאות תצוגה" />
        <div className="space-y-6">
          <UploadZone />
          <QuestionList />
          <ExportButton />
        </div>
      </div>
    </main>
  )
}
