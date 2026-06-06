import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { extractDocxText } from '@/lib/extract/extractDocx'
import { parseNumberingXml } from '@/lib/extract/parseDocxXml'
import { parseExam } from '@/lib/parser/parseQuestions'

// ── XML helpers ────────────────────────────────────────────────────────────────

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

function para(text: string, numId?: number, ilvl = 0): string {
  const numPr =
    numId != null
      ? `<w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>`
      : ''
  return `<w:p>${numPr}<w:r><w:t>${text}</w:t></w:r></w:p>`
}

function makeDoc(...paras: string[]): string {
  return `<?xml version="1.0"?><w:document ${W}><w:body>${paras.join('')}</w:body></w:document>`
}

function makeNumbering(fmt0 = 'decimal', fmt1 = 'hebrew1'): string {
  return `<?xml version="1.0"?><w:numbering ${W}>
    <w:abstractNum w:abstractNumId="0">
      <w:lvl w:ilvl="0"><w:numFmt w:val="${fmt0}"/><w:start w:val="1"/></w:lvl>
      <w:lvl w:ilvl="1"><w:numFmt w:val="${fmt1}"/><w:start w:val="1"/></w:lvl>
    </w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  </w:numbering>`
}

async function buildDocx(documentXml: string, numberingXml?: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('word/document.xml', documentXml)
  if (numberingXml) zip.file('word/numbering.xml', numberingXml)
  return zip.generateAsync({ type: 'arraybuffer' })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DOCX numbered-list extraction', () => {
  it('reconstructs decimal question numbers', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('שאלה ראשונה', 1, 0),
        para('שאלה שניה', 1, 0),
      ),
      makeNumbering('decimal', 'hebrew1'),
    )
    const { text } = await extractDocxText(buf)
    expect(text).toContain('1. שאלה ראשונה')
    expect(text).toContain('2. שאלה שניה')
  })

  it('reconstructs Hebrew1 option labels', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('תשובה א', 1, 1),
        para('תשובה ב', 1, 1),
        para('תשובה ג', 1, 1),
      ),
      makeNumbering('decimal', 'hebrew1'),
    )
    const { text } = await extractDocxText(buf)
    expect(text).toContain('א. תשובה א')
    expect(text).toContain('ב. תשובה ב')
    expect(text).toContain('ג. תשובה ג')
  })

  it('reconstructs mixed question + option structure', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('שאלה?', 1, 0),
        para('נכון', 1, 1),
        para('לא נכון', 1, 1),
      ),
      makeNumbering(),
    )
    const { text } = await extractDocxText(buf)
    expect(text).toBe('1. שאלה?\nא. נכון\nב. לא נכון')
  })

  it('resets Hebrew labels for each new question', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('שאלה 1', 1, 0),
        para('X', 1, 1),
        para('Y', 1, 1),
        para('שאלה 2', 1, 0),
        para('X', 1, 1),
        para('Y', 1, 1),
      ),
      makeNumbering(),
    )
    const { text } = await extractDocxText(buf)
    expect(text).toBe('1. שאלה 1\nא. X\nב. Y\n2. שאלה 2\nא. X\nב. Y')
  })

  it('returns plain text when word/numbering.xml is absent', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('שאלה ראשונה', 1, 0),
        para('תשובה', 1, 1),
      ),
      // no numberingXml
    )
    const { text } = await extractDocxText(buf)
    expect(text).toContain('שאלה ראשונה')
    expect(text).toContain('תשובה')
    expect(text).not.toMatch(/^\d+\./)
  })

  it('treats w:numId val="0" as plain text (suppressed list marker)', async () => {
    const buf = await buildDocx(
      makeDoc(para('paragraph text', 0, 0)),
      makeNumbering(),
    )
    const { text } = await extractDocxText(buf)
    expect(text).toBe('paragraph text')
    expect(text).not.toMatch(/^1\./)
  })

  it('advances counter for empty list items but does not emit blank marker lines', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('', 1, 0),        // empty list item — counter advances to 1, not emitted
        para('שאלה', 1, 0),    // becomes "2. שאלה"
      ),
      makeNumbering(),
    )
    const { text } = await extractDocxText(buf)
    // The second paragraph should get counter=2
    expect(text).toContain('2. שאלה')
    expect(text).not.toMatch(/^1\.\s*$/m)
  })

  it('round-trip: extracted DOCX → parseExam returns correct questions and options', async () => {
    const buf = await buildDocx(
      makeDoc(
        para('מה מחזירה הפונקציה?', 1, 0),
        para('string', 1, 1),
        para('null', 1, 1),
        para('מה נכון לגבי הנוסחה?', 1, 0),
        para('היא שגויה', 1, 1),
        para('היא נכונה', 1, 1),
      ),
      makeNumbering(),
    )
    const { text } = await extractDocxText(buf)
    const exam = parseExam(text)
    expect(exam.questions).toHaveLength(2)
    expect(exam.questions[0].options).toHaveLength(2)
    expect(exam.questions[1].options).toHaveLength(2)
    expect(exam.questions[0].questionText).toContain('מה מחזירה הפונקציה?')
    expect(exam.questions[0].options[0].originalLabel).toBe('א')
  })

  it('parseNumberingXml parses abstractNum and numId mappings correctly', () => {
    const xml = makeNumbering('decimal', 'hebrew1')
    const data = parseNumberingXml(xml)
    expect(data.numIds[1]).toBe(0)
    const abs = data.abstractNums.get(0)
    expect(abs).toBeDefined()
    expect(abs?.levels.get(0)?.numFmt).toBe('decimal')
    expect(abs?.levels.get(1)?.numFmt).toBe('hebrew1')
    expect(abs?.levels.get(0)?.start).toBe(1)
  })
})
