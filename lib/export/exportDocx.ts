import { Document, Packer, Paragraph } from 'docx'
import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'
import { rtlParagraph } from './rtlDocx'

export async function exportDocx(exam: ShuffledExam, title = 'מבחן מעורבב'): Promise<Blob> {
  const paragraphs: Paragraph[] = []

  paragraphs.push(rtlParagraph(title, { bold: true, size: 28 }))
  paragraphs.push(new Paragraph({ text: '' }))

  for (const q of exam.questions) {
    paragraphs.push(rtlParagraph(`${q.number}. ${q.questionText}`, { bold: true }))
    for (const opt of q.options) {
      paragraphs.push(rtlParagraph(`${opt.label}. ${opt.text}`))
    }
    paragraphs.push(new Paragraph({ text: '' }))
  }

  const doc = new Document({ sections: [{ children: paragraphs }] })
  return Packer.toBlob(doc)
}
