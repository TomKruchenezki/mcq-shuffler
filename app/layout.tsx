import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MCQ Shuffler',
  description: 'ערבל שאלות בחירה מרובה בעברית',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 font-sans text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
