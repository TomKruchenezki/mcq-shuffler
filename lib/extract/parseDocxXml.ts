const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

const HEBREW_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
  'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
]

interface LevelDef {
  numFmt: string
  start: number
}

interface AbstractNum {
  levels: Map<number, LevelDef>
}

export interface NumberingData {
  abstractNums: Map<number, AbstractNum>
  numIds: Record<number, number>
}

// Robustly read a w:-namespaced attribute from an element.
// Tries getAttributeNS first (correct XML namespaces), then the prefixed form as a
// fallback for parsers that attach prefix+colon to the attribute name.
function wAttr(el: Element, local: string): string | null {
  return el.getAttributeNS(W_NS, local) ?? el.getAttribute(`w:${local}`) ?? null
}

export function parseNumberingXml(xml: string): NumberingData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('numbering.xml parse error')
  }

  const abstractNums = new Map<number, AbstractNum>()
  for (const an of doc.getElementsByTagNameNS(W_NS, 'abstractNum')) {
    const id = parseInt(wAttr(an, 'abstractNumId') ?? '-1', 10)
    if (id < 0) continue
    const levels = new Map<number, LevelDef>()
    for (const lvl of an.getElementsByTagNameNS(W_NS, 'lvl')) {
      const ilvl = parseInt(wAttr(lvl, 'ilvl') ?? '0', 10)
      const fmtEl = lvl.getElementsByTagNameNS(W_NS, 'numFmt')[0]
      const startEl = lvl.getElementsByTagNameNS(W_NS, 'start')[0]
      levels.set(ilvl, {
        numFmt: (fmtEl ? wAttr(fmtEl, 'val') : null) ?? 'decimal',
        start: startEl ? parseInt(wAttr(startEl, 'val') ?? '1', 10) : 1,
      })
    }
    abstractNums.set(id, { levels })
  }

  const numIds: Record<number, number> = {}
  for (const num of doc.getElementsByTagNameNS(W_NS, 'num')) {
    const numId = parseInt(wAttr(num, 'numId') ?? '-1', 10)
    if (numId <= 0) continue
    const absEl = num.getElementsByTagNameNS(W_NS, 'abstractNumId')[0]
    const absId = absEl ? parseInt(wAttr(absEl, 'val') ?? '-1', 10) : -1
    if (absId >= 0) numIds[numId] = absId
  }

  return { abstractNums, numIds }
}

function resolveLevel(data: NumberingData, numId: number, ilvl: number): LevelDef | null {
  const absId = data.numIds[numId]
  if (absId === undefined) return null
  return data.abstractNums.get(absId)?.levels.get(ilvl) ?? null
}

function formatMarker(numFmt: string, counter: number): string {
  switch (numFmt) {
    case 'decimal':
      return `${counter}.`
    case 'hebrew1': {
      const idx = counter - 1
      if (idx >= 0 && idx < HEBREW_LETTERS.length) return `${HEBREW_LETTERS[idx]}.`
      return `${counter}.`
    }
    case 'lowerLetter':
      return `${String.fromCharCode(96 + counter)}.`
    case 'upperLetter':
      return `${String.fromCharCode(64 + counter)}.`
    default:
      return `${counter}.`
  }
}

export async function extractDocxParagraphs(buffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await new JSZip().loadAsync(buffer)

  // Parse numbering (optional — documents without lists won't have this file)
  let numberingData: NumberingData | null = null
  const numberingFile = zip.file('word/numbering.xml')
  if (numberingFile) {
    try {
      const xml = await numberingFile.async('text')
      numberingData = parseNumberingXml(xml)
    } catch {
      numberingData = null
    }
  }

  // Parse document body
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('word/document.xml not found in DOCX')

  const docXml = await docFile.async('text')
  const parser = new DOMParser()
  const doc = parser.parseFromString(docXml, 'application/xml')

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('word/document.xml parse error')
  }

  // Counters: Record<numId, Record<ilvl, currentCounter>>
  const counters: Record<number, Record<number, number>> = {}

  const lines: string[] = []

  for (const para of doc.getElementsByTagNameNS(W_NS, 'p')) {
    // Collect paragraph text from all w:t elements
    const runs = para.getElementsByTagNameNS(W_NS, 't')
    const text = Array.from(runs)
      .map(t => t.textContent ?? '')
      .join('')
      .trim()

    // Detect numbering on this paragraph
    const numPrEl = para.getElementsByTagNameNS(W_NS, 'numPr')[0] ?? null
    let numId: number | null = null
    let ilvl = 0

    if (numPrEl) {
      const numIdEl = numPrEl.getElementsByTagNameNS(W_NS, 'numId')[0]
      const ilvlEl = numPrEl.getElementsByTagNameNS(W_NS, 'ilvl')[0]
      const numIdVal = numIdEl ? parseInt(wAttr(numIdEl, 'val') ?? '0', 10) : 0
      if (numIdVal !== 0) {
        numId = numIdVal
        ilvl = ilvlEl ? parseInt(wAttr(ilvlEl, 'val') ?? '0', 10) : 0
      }
    }

    if (numId === null || !numberingData) {
      // Plain paragraph (no list marker)
      if (text) lines.push(text)
      continue
    }

    // Initialize counter bucket for this numId
    if (!counters[numId]) counters[numId] = {}

    // Reset all deeper levels (child levels restart when parent advances)
    for (const key of Object.keys(counters[numId]).map(Number)) {
      if (key > ilvl) delete counters[numId][key]
    }

    // Advance counter for this level
    const levelDef = resolveLevel(numberingData, numId, ilvl)
    const start = levelDef?.start ?? 1
    if (counters[numId][ilvl] === undefined) {
      counters[numId][ilvl] = start
    } else {
      counters[numId][ilvl]++
    }

    const counter = counters[numId][ilvl]
    const numFmt = levelDef?.numFmt ?? 'decimal'
    const marker = formatMarker(numFmt, counter)

    // Empty list items advance the counter but emit nothing
    if (text) lines.push(`${marker} ${text}`)
  }

  return lines.join('\n')
}
