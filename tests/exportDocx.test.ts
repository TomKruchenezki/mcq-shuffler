import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { exportDocx, exportDocxBuffer } from '@/lib/export/exportDocx'
import type { ShuffledExam, ShuffledQuestion, ShuffledOption } from '@/lib/shuffle/shuffleExam'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'

function makeOption(text: string, pos: number): ShuffledOption {
  return {
    label: HEBREW_LABELS[pos] as string,
    text,
    originalIndex: pos,
    isCorrectAnswer: pos === 0,
  }
}

function makeQuestion(num: number, texts: string[]): ShuffledQuestion {
  return {
    number: num,
    questionText: `שאלה ${num}`,
    options: texts.map((t, i) => makeOption(t, i)),
  }
}

function makeShuffledExam(optCount: number): ShuffledExam {
  const texts = Array.from({ length: optCount }, (_, i) => `אפשרות ${i + 1}`)
  return { questions: [makeQuestion(1, texts)] }
}

async function getDocXml(exam: ShuffledExam): Promise<string> {
  const buffer = await exportDocxBuffer(exam)
  const zip = await new JSZip().loadAsync(buffer)
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('word/document.xml not found')
  return docFile.async('text')
}

describe('exportDocx', () => {
  it('resolves to a Blob', async () => {
    const blob = await exportDocx(makeShuffledExam(4))
    expect(blob).toBeInstanceOf(Blob)
  })

  it('Blob is non-empty', async () => {
    const blob = await exportDocx(makeShuffledExam(4))
    expect(blob.size).toBeGreaterThan(0)
  })

  it('works with 2-option question', async () => {
    await expect(exportDocx(makeShuffledExam(2))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 4-option question', async () => {
    await expect(exportDocx(makeShuffledExam(4))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 6-option question', async () => {
    await expect(exportDocx(makeShuffledExam(6))).resolves.toBeInstanceOf(Blob)
  })

  it('works with 8-option question', async () => {
    await expect(exportDocx(makeShuffledExam(8))).resolves.toBeInstanceOf(Blob)
  })

  it('works with Hebrew-only option text', async () => {
    const exam: ShuffledExam = {
      questions: [makeQuestion(1, ['ערך נכון', 'ערך שגוי', 'אולי', 'תלוי'])],
    }
    await expect(exportDocx(exam)).resolves.toBeInstanceOf(Blob)
  })

  it('works with mixed Hebrew-English-number-SQL option text', async () => {
    const exam: ShuffledExam = {
      questions: [
        makeQuestion(1, [
          'SELECT * FROM users WHERE id = 5',
          'היא מחזירה null',
          'accuracy=95%, precision=80%',
          'user_id=123 מחזיר string',
        ]),
      ],
    }
    await expect(exportDocx(exam)).resolves.toBeInstanceOf(Blob)
  })

  it('does not mutate the input ShuffledExam', async () => {
    const exam = makeShuffledExam(4)
    const snapshot = JSON.stringify(exam)
    await exportDocx(exam)
    expect(JSON.stringify(exam)).toBe(snapshot)
  })

  it('does not mutate ShuffledQuestion objects', async () => {
    const exam = makeShuffledExam(4)
    const qSnapshot = JSON.stringify(exam.questions[0])
    await exportDocx(exam)
    expect(JSON.stringify(exam.questions[0])).toBe(qSnapshot)
  })

  it('accepts a custom title without crashing', async () => {
    await expect(exportDocx(makeShuffledExam(3), 'מבחן מתמטיקה')).resolves.toBeInstanceOf(Blob)
  })

  it('sectPr contains <w:bidi/>', async () => {
    const xml = await getDocXml(makeShuffledExam(4))
    const sectPrStart = xml.indexOf('<w:sectPr')
    const sectPrEnd = xml.indexOf('</w:sectPr>', sectPrStart)
    const sectPrBlock = xml.slice(sectPrStart, sectPrEnd + '</w:sectPr>'.length)
    expect(sectPrBlock).toContain('<w:bidi/>')
  })

  it('every paragraph has <w:bidi/>', async () => {
    const exam = makeShuffledExam(2)
    const xml = await getDocXml(exam)
    // 1 title + 1 blank + 1 question + 2 options + 1 blank = 6 paragraphs
    const bidiInPPr = (xml.match(/<w:bidi\/>/g) ?? []).length
    expect(bidiInPPr).toBeGreaterThanOrEqual(6)
  })

  it('every paragraph has right alignment', async () => {
    const xml = await getDocXml(makeShuffledExam(2))
    expect(xml).toContain('<w:jc w:val="right"/>')
  })

  it('injectSectPrBidi is idempotent', async () => {
    const xml = await getDocXml(makeShuffledExam(2))
    const sectPrStart = xml.indexOf('<w:sectPr')
    const sectPrEnd = xml.indexOf('</w:sectPr>', sectPrStart)
    const sectPrBlock = xml.slice(sectPrStart, sectPrEnd + '</w:sectPr>'.length)
    const bidiCount = (sectPrBlock.match(/<w:bidi\/>/g) ?? []).length
    expect(bidiCount).toBe(1)
  })

  it('language annotation is present', async () => {
    const xml = await getDocXml(makeShuffledExam(2))
    expect(xml).toContain('he-IL')
  })
})
