import { Paragraph, TextRun, AlignmentType } from 'docx'

// Create a right-aligned, bidirectional paragraph for Hebrew RTL documents.
// text is passed verbatim — Word's UBA handles mixed Hebrew/English/SQL direction.
// Do NOT set rightToLeft on TextRun; that forces every run RTL and breaks LTR code/formulas.
export function rtlParagraph(
  text: string,
  options?: { bold?: boolean; size?: number }
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: options?.bold, size: options?.size, language: { bidirectional: 'he-IL' } }),
    ],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
  })
}
