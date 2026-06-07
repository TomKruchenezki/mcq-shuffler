import { Document, Packer, Paragraph } from 'docx'
import JSZip from 'jszip'
import type { ShuffledExam } from '@/lib/shuffle/shuffleExam'
import { rtlParagraph } from './rtlDocx'

export async function exportDocxBuffer(
  exam: ShuffledExam,
  title = 'מבחן מעורבב',
): Promise<Buffer> {
  const paragraphs: Paragraph[] = []
  paragraphs.push(rtlParagraph(title, { bold: true, size: 28 }))
  paragraphs.push(rtlParagraph(''))
  for (const q of exam.questions) {
    paragraphs.push(rtlParagraph(`${q.outputQuestionNumber}. ${q.questionText}`, { bold: true }))
    for (const opt of q.options) {
      // Image-only options: data URLs can't be embedded in DOCX by this library.
      // Use a text placeholder so the option is not silently dropped.
      const optText = opt.text || (opt.visualImageDataUrl ? '[תמונה — לא זמינה בייצוא Word]' : '')
      paragraphs.push(rtlParagraph(`${opt.label}. ${optText}`))
    }
    paragraphs.push(rtlParagraph(''))
  }
  const doc = new Document({ sections: [{ children: paragraphs }] })
  const buffer = await Packer.toBuffer(doc)
  return injectSectPrBidi(buffer)
}

export async function exportDocx(
  exam: ShuffledExam,
  title = 'מבחן מעורבב',
): Promise<Blob> {
  const buffer = await exportDocxBuffer(exam, title)
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

async function injectSectPrBidi(buffer: Buffer): Promise<Buffer> {
  const zip = await new JSZip().loadAsync(buffer)
  const docFile = zip.file('word/document.xml')
  if (!docFile) return buffer
  let xml = await docFile.async('text')
  const sectPrStart = xml.indexOf('<w:sectPr')
  if (sectPrStart === -1) return buffer
  const sectPrClose = xml.indexOf('</w:sectPr>', sectPrStart)
  const sectPrBlock =
    sectPrClose !== -1
      ? xml.slice(sectPrStart, sectPrClose + '</w:sectPr>'.length)
      : xml.slice(sectPrStart)
  if (sectPrBlock.includes('<w:bidi/>') || sectPrBlock.includes('<w:bidi />')) return buffer
  if (sectPrClose === -1) {
    xml = xml.replace(/<w:sectPr([^>]*)\/>/,'<w:sectPr$1><w:bidi/></w:sectPr>')
  } else {
    xml = xml.slice(0, sectPrClose) + '<w:bidi/>' + xml.slice(sectPrClose)
  }
  zip.file('word/document.xml', xml)
  const patched = await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
  return patched as Buffer
}
