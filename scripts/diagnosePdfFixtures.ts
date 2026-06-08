/**
 * scripts/diagnosePdfFixtures.ts
 *
 * Local-only CLI tool: analyzes PDF files in manual-fixtures/ (or a specific PDF)
 * using the same extraction/parsing pipeline as the main app.
 * Writes structured diagnostic reports to .tmp/pdf-diagnostics/
 *
 * Usage:
 *   npm run diagnose:pdf:all
 *   npm run diagnose:pdf -- manual-fixtures/MoedA_2026.pdf
 *
 * OUTPUT: .tmp/pdf-diagnostics/<name>/ per PDF + .tmp/pdf-diagnostics/summary.md
 * None of the output is committed to git (.tmp/ is in .gitignore).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { reconstructPageText } from '@/lib/extract/pdfLines'
import type { PdfTextItem } from '@/lib/extract/pdfLines'
import { normalizePdfText } from '@/lib/extract/pdfNormalize'
import {
  parseExam,
  diagnoseParsedExam,
} from '@/lib/parser/parseQuestions'
import type {
  ParseDiagnostics,
  ParsedQuestion,
  ParsedExam,
} from '@/lib/parser/parseQuestions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FalseMarkerCandidate {
  number: number
  context: string
  type: string
}

interface MissingVisualEntry {
  outputNumber: number
  keyword: string
}

interface PdfDiagnosticsResult {
  filename: string
  numPages: number
  charCount: number
  normalizedCharCount: number
  questionsCount: number
  optionsCount: number
  suspicious: number
  missingVisual: number
  falseMarkers: number
  diag: ParseDiagnostics
}

interface ExpectJson {
  expectedMinParsedQuestions?: number
  expectedNoFalseSourceNumbers?: number[]
  expectedWarnings?: string[]
  knownIssues?: string[]
}

// ── PDF extraction ────────────────────────────────────────────────────────────

async function extractPageTexts(filePath: string): Promise<{
  pages: string[]
  numPages: number
  charCount: number
}> {
  // Use the legacy build — recommended by pdfjs-dist for Node.js environments.
  // The legacy build bundles its worker inline and does not require GlobalWorkerOptions.workerSrc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const buffer = fs.readFileSync(filePath)
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items = (content.items as unknown[]).filter(
      (it): it is PdfTextItem =>
        typeof it === 'object' && it !== null && 'str' in it,
    ) as PdfTextItem[]
    pages.push(reconstructPageText(items))
  }

  const charCount = pages.reduce((s, p) => s + p.length, 0)
  return { pages, numPages: doc.numPages, charCount }
}

// ── Analysis helpers ──────────────────────────────────────────────────────────

const FALSE_MARKER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(\d+)\s*%/g, label: 'percentage' },
  { re: /[KNMknedc]\s*=\s*(\d+)/g, label: 'formula/variable' },
  { re: /\b(\d{4})\b/g, label: 'possible year/ID' },
  { re: /(?:page|עמוד)\s+(\d+)/gi, label: 'page number' },
]

function detectFalseMarkerCandidates(
  normalizedPages: string[],
  questions: ParsedQuestion[],
): FalseMarkerCandidate[] {
  const fullText = normalizedPages.join('\n')
  const questionNumbers = new Set(questions.map(q => q.number))
  const candidates: FalseMarkerCandidate[] = []

  // Build set of numbers confirmed by a genuine "שאלה מספר N" marker in the text.
  // If a number N also appears in a formula/percentage context, it is NOT a false alarm
  // if there is an actual question marker for N — it's a coincidence.
  const GENUINE_MARKER_RE = /שאלה\s+מספר\s*:?\s*(\d+)/g
  const genuineNumbers = new Set<number>()
  let gm: RegExpExecArray | null
  while ((gm = GENUINE_MARKER_RE.exec(fullText)) !== null) {
    genuineNumbers.add(parseInt(gm[1], 10))
  }

  for (const { re, label } of FALSE_MARKER_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(fullText)) !== null) {
      const capGroup = m[1]
      if (!capGroup) continue
      const num = parseInt(capGroup, 10)
      if (!questionNumbers.has(num)) continue
      // Skip: this number is backed by a genuine "שאלה מספר N" marker → not a false alarm
      if (genuineNumbers.has(num)) continue
      // Grab context around the match (truncated)
      const start = Math.max(0, m.index - 20)
      const end = Math.min(fullText.length, m.index + m[0].length + 20)
      const context = fullText.slice(start, end).replace(/\n/g, ' ').trim()
      // Avoid duplicates for same number+type
      if (!candidates.some(c => c.number === num && c.type === label)) {
        candidates.push({ number: num, context, type: label })
      }
    }
  }

  return candidates
}

const MISSING_VISUAL_KEYWORD_MAP: Array<[RegExp, string]> = [
  [/הגרף\s+הבא/, 'הגרף הבא'],
  [/הדיאגרמה/, 'הדיאגרמה'],
  [/התרשים/, 'התרשים'],
  [/הטבלה\s+הבא/, 'הטבלה הבא'],
  [/נתון\s+קטע\s+הקוד\s+הבא/, 'קטע קוד'],
  [/הקוד\s+הבא/, 'הקוד הבא'],
  [/השאילתה\s+הבא/, 'שאילתה'],
  [/הפלט\s+הבא/, 'הפלט הבא'],
  [/הרלציות\s+הבאות/, 'רלציות'],
  [/שאילתת\s+SQL/i, 'שאילתת SQL'],
  [/DataFrame/i, 'DataFrame'],
]

function detectMissingVisualQuestions(questions: ParsedQuestion[]): MissingVisualEntry[] {
  return questions
    .filter(q => q.hasMissingVisualContent)
    .map(q => {
      let keyword = 'unknown'
      for (const [re, name] of MISSING_VISUAL_KEYWORD_MAP) {
        if (re.test(q.questionText)) {
          keyword = name
          break
        }
      }
      return { outputNumber: q.outputQuestionNumber, keyword }
    })
}

function detectRtlMixedExamples(normalizedPages: string[]): string[] {
  const examples: string[] = []
  for (const page of normalizedPages) {
    for (const line of page.split('\n')) {
      const t = line.trim()
      if (t.length < 8) continue
      if (/[א-ת]/.test(t) && /[A-Za-z]/.test(t)) {
        examples.push(t.length > 80 ? t.slice(0, 80) + '…' : t)
        if (examples.length >= 5) return examples
      }
    }
  }
  return examples
}

// ── Expectations ──────────────────────────────────────────────────────────────

function checkExpectations(
  expectPath: string,
  exam: ParsedExam,
  diag: ParseDiagnostics,
): string[] {
  const lines: string[] = []
  let expectJson: ExpectJson
  try {
    expectJson = JSON.parse(fs.readFileSync(expectPath, 'utf8')) as ExpectJson
  } catch {
    lines.push(`⚠ Could not read ${path.basename(expectPath)}`)
    return lines
  }

  if (expectJson.expectedMinParsedQuestions !== undefined) {
    const pass = diag.parsedQuestionCount >= expectJson.expectedMinParsedQuestions
    lines.push(
      `${pass ? '✅' : '⚠'} Parsed questions: ${diag.parsedQuestionCount} ` +
        `(expected ≥ ${expectJson.expectedMinParsedQuestions})`,
    )
  }

  if (expectJson.expectedNoFalseSourceNumbers) {
    const actual = exam.questions.map(q => q.number)
    for (const n of expectJson.expectedNoFalseSourceNumbers) {
      const found = actual.includes(n)
      lines.push(
        `${found ? '⚠' : '✅'} Source number ${n}: ${found ? 'PRESENT (unexpected false positive)' : 'absent (good)'}`,
      )
    }
  }

  if (expectJson.knownIssues && expectJson.knownIssues.length > 0) {
    lines.push(`ℹ Known issues: ${expectJson.knownIssues.join('; ')}`)
  }

  return lines
}

// ── Acceptance summary ────────────────────────────────────────────────────────

function buildAcceptanceSummary(opts: {
  questionsCount: number
  needsReviewCount: number
  missingVisualContentCount: number
  suspiciousNumberCount: number
  falseMarkersCount: number
}): string {
  const { questionsCount, needsReviewCount, missingVisualContentCount, suspiciousNumberCount, falseMarkersCount } = opts
  const pct = questionsCount > 0 ? Math.round((needsReviewCount / questionsCount) * 100) : 0

  let recommendation: string
  if (questionsCount === 0) {
    recommendation = 'PDF לא קריא — נסה OCR מקומי'
  } else if (pct === 0 && missingVisualContentCount === 0) {
    recommendation = 'מצב אוטומטי בסדר — תיקון ידני מינימלי נדרש'
  } else if (pct <= 25) {
    recommendation = 'מצב אוטומטי + תיקון ידני (צרף צילומי מסך לשאלות עם גרפים)'
  } else {
    recommendation = 'תיקון ידני מקיף נדרש — שקול להשתמש ב-OCR'
  }

  let s = `## Acceptance Summary\n\n`
  s += `| Metric | Value |\n`
  s += `|--------|-------|\n`
  s += `| Parsed questions | ${questionsCount} |\n`
  s += `| Questions needing review | ${needsReviewCount} (${pct}%) |\n`
  s += `| Missing visual/code | ${missingVisualContentCount} |\n`
  s += `| Suspicious source numbers | ${suspiciousNumberCount} |\n`
  s += `| False marker candidates | ${falseMarkersCount} |\n`
  s += `| Recommended workflow | ${recommendation} |\n`
  s += '\n'
  return s
}

// ── Report generation ─────────────────────────────────────────────────────────

function buildReport(opts: {
  filename: string
  numPages: number
  charCount: number
  normalizedCharCount: number
  exam: ParsedExam
  diag: ParseDiagnostics
  falseMarkers: FalseMarkerCandidate[]
  missingVisual: MissingVisualEntry[]
  rtlMixed: string[]
  expectLines: string[] | null
}): string {
  const { filename, numPages, charCount, normalizedCharCount,
    exam, diag, falseMarkers, missingVisual, rtlMixed, expectLines } = opts

  const totalOptions = exam.questions.reduce((s, q) => s + q.options.length, 0)
  const fewOpts = diag.questionsWithFewerThanTwoOptions.length > 0
    ? diag.questionsWithFewerThanTwoOptions.join(', ')
    : 'none'
  const hugeBlocks = diag.suspiciousHugeBlocks.length > 0
    ? diag.suspiciousHugeBlocks.join(', ')
    : 'none'
  const autoSplits = diag.autoSplitCount > 0
    ? exam.questions
        .filter(q => q.splitFromEmbedded)
        .map(q => q.outputQuestionNumber)
        .join(', ')
    : 'none'
  const suspicious = exam.questions
    .filter(q => q.status === 'suspicious-number')
    .map(q => q.number)
    .join(', ') || 'none'

  let r = `# PDF Diagnostic Report: ${filename}\n\n`

  r += `## General\n`
  r += `- File: ${filename}\n`
  r += `- Page count: ${numPages}\n`
  r += `- Extracted chars: ${charCount}\n`
  r += `- Normalized chars: ${normalizedCharCount}\n`
  r += `- Parsed questions: ${diag.parsedQuestionCount}\n`
  r += `- Total options: ${totalOptions}\n\n`

  r += `## Question Numbering\n`
  r += `- Output sequence: ${exam.questions.map(q => q.outputQuestionNumber).join(', ') || 'none'}\n`
  r += `- Source numbers: ${diag.questionNumbers.join(', ') || 'none'}\n`
  r += `- Duplicates: ${diag.duplicateQuestionNumbers.join(', ') || 'none'}\n`
  r += `- Suspicious (0 or >999): ${suspicious}\n`
  r += `- Non-sequential: ${diag.nonSequentialNumbers.join(', ') || 'none'}\n\n`

  r += `## Quality Issues\n`
  r += `- Questions with < 2 options: ${fewOpts}\n`
  r += `- Questions with huge text (>500 chars): ${hugeBlocks}\n`
  r += `- Auto-split from embedded marker: ${autoSplits}\n`
  r += `- Missing visual content: ${diag.missingVisualContentCount}\n`
  r += `- Needs review (any non-ok status): ${diag.needsReviewCount}\n\n`

  r += `## False Marker Candidates\n`
  if (falseMarkers.length === 0) {
    r += `None detected.\n\n`
  } else {
    r += `| Source # | Context | Type |\n`
    r += `|---------|---------|------|\n`
    for (const c of falseMarkers) {
      r += `| ${c.number} | \`${c.context.replace(/\|/g, '\\|').replace(/`/g, "'")}\` | ${c.type} |\n`
    }
    r += '\n'
  }

  r += `## Missing Visual / Code Content\n`
  if (missingVisual.length === 0) {
    r += `None detected.\n\n`
  } else {
    r += `| Output # | Keyword |\n`
    r += `|---------|--------|\n`
    for (const m of missingVisual) {
      r += `| ${m.outputNumber} | ${m.keyword} |\n`
    }
    r += '\n'
  }

  r += `## RTL / Mixed Text Examples\n`
  if (rtlMixed.length === 0) {
    r += `None detected.\n\n`
  } else {
    for (const ex of rtlMixed) {
      r += `- \`${ex.replace(/`/g, "'")}\`\n`
    }
    r += '\n'
  }

  if (expectLines !== null) {
    r += `## Expectations\n`
    for (const line of expectLines) {
      r += `${line}\n`
    }
    r += '\n'
  }

  r += buildAcceptanceSummary({
    questionsCount: diag.parsedQuestionCount,
    needsReviewCount: diag.needsReviewCount,
    missingVisualContentCount: diag.missingVisualContentCount,
    suspiciousNumberCount: diag.suspiciousNumberCount,
    falseMarkersCount: falseMarkers.length,
  })

  return r
}

function buildSummary(results: PdfDiagnosticsResult[], dateStr: string): string {
  let s = `# PDF Diagnostics Summary — ${dateStr}\n\n`

  s += `## Files analyzed\n`
  s += `| File | Pages | Questions | Options | Suspicious | MissingVisual | FalseMarkers |\n`
  s += `|------|-------|-----------|---------|------------|---------------|----------|\n`
  for (const r of results) {
    s += `| ${r.filename} | ${r.numPages} | ${r.questionsCount} | ${r.optionsCount} | ${r.suspicious} | ${r.missingVisual} | ${r.falseMarkers} |\n`
  }
  s += '\n'

  s += `## Recurring sanitized failure patterns\n\n`
  s += `Sanitized regression tests for these patterns are in \`tests/realPdfPatterns.test.ts\`\n`
  s += `(always runs in CI — no real PDFs required).\n\n`
  s += `1. **Embedded question marker after slash option**\n   Pattern: \`"ו. / שאלה מספר 0 ..."\`\n\n`
  s += `2. **Decimal false positive**\n   Pattern: \`"Specificity = 70%"\`\n\n`
  s += `3. **Missing code block**\n   Pattern: \`"נתון קטע הקוד הבא:"\`\n\n`
  s += `4. **Missing diagram / graph**\n   Pattern: \`"הדיאגרמה הבאה"\`, \`"הגרף הבא"\`\n\n`
  s += `5. **Mixed RTL/LTR**\n   Patterns: \`"KNN (K Nearest Neighbors)"\`, \`"SELECT p.ProductID"\`\n\n`

  s += `## Next steps\n\n`
  s += `- Review per-PDF \`report.md\` for specific question numbers\n`
  s += `- Add sanitized regression tests for any newly found patterns to \`tests/realPdfPatterns.test.ts\`\n`
  s += `- Run again after parser fixes to verify improvement\n`

  return s
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function analyzePdf(
  filePath: string,
  outputDir: string,
): Promise<PdfDiagnosticsResult> {
  const filename = path.basename(filePath)
  const basename = path.basename(filePath, path.extname(filePath))
  const pdfOutputDir = path.join(outputDir, basename)

  fs.mkdirSync(pdfOutputDir, { recursive: true })

  console.log(`\n📄 Analyzing: ${filename}`)
  console.log('  Extracting text...')

  const { pages, numPages, charCount } = await extractPageTexts(filePath)

  const normalizedPages = normalizePdfText(pages)
  const normalizedText = normalizedPages.join('\n')
  const normalizedCharCount = normalizedText.length

  const rawText = normalizedPages.join('\n\n').trim()
  console.log('  Parsing exam...')
  const exam = parseExam(rawText)
  const diag = diagnoseParsedExam(exam)

  const optionsCount = exam.questions.reduce((s, q) => s + q.options.length, 0)
  console.log(`  Questions: ${diag.parsedQuestionCount}, Options: ${optionsCount}`)

  const falseMarkers = detectFalseMarkerCandidates(normalizedPages, exam.questions)
  const missingVisual = detectMissingVisualQuestions(exam.questions)
  const rtlMixed = detectRtlMixedExamples(normalizedPages)

  // Write output files
  fs.writeFileSync(
    path.join(pdfOutputDir, 'extracted-text.txt'),
    pages.join('\n\n--- PAGE BREAK ---\n\n'),
  )
  fs.writeFileSync(path.join(pdfOutputDir, 'normalized-text.txt'), normalizedText)
  fs.writeFileSync(
    path.join(pdfOutputDir, 'parsed-questions.json'),
    JSON.stringify(exam.questions, null, 2),
  )

  const diagnosticsJson = {
    ...diag,
    pageCount: numPages,
    charCount,
    normalizedCharCount,
    falseMarkerCandidates: falseMarkers,
    missingVisualQuestions: missingVisual,
    rtlMixedExamples: rtlMixed,
  }
  fs.writeFileSync(
    path.join(pdfOutputDir, 'diagnostics.json'),
    JSON.stringify(diagnosticsJson, null, 2),
  )

  // Check optional .expect.json alongside the PDF
  const expectPath = path.join(
    path.dirname(filePath),
    `${basename}.expect.json`,
  )
  const expectLines = fs.existsSync(expectPath)
    ? checkExpectations(expectPath, exam, diag)
    : null

  const report = buildReport({
    filename, numPages, charCount, normalizedCharCount,
    exam, diag, falseMarkers, missingVisual, rtlMixed, expectLines,
  })
  fs.writeFileSync(path.join(pdfOutputDir, 'report.md'), report)

  console.log(`  ✅ Report: .tmp/pdf-diagnostics/${basename}/report.md`)

  return {
    filename, numPages, charCount, normalizedCharCount,
    questionsCount: diag.parsedQuestionCount,
    optionsCount,
    suspicious: diag.suspiciousNumberCount,
    missingVisual: diag.missingVisualContentCount,
    falseMarkers: falseMarkers.length,
    diag,
  }
}

/**
 * Collect all PDF files in a directory, including the optional pdf/ subdirectory.
 * Supports both `manual-fixtures/*.pdf` and `manual-fixtures/pdf/*.pdf`.
 */
function collectPdfFiles(dirArg: string): string[] {
  const dirsToScan: string[] = []
  if (fs.existsSync(dirArg)) dirsToScan.push(dirArg)
  const subdir = path.join(dirArg, 'pdf')
  if (fs.existsSync(subdir) && fs.statSync(subdir).isDirectory()) dirsToScan.push(subdir)

  return dirsToScan.flatMap(dir =>
    fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(dir, f))
  )
}

async function main(): Promise<void> {
  const arg = process.argv[2]
  const OUTPUT_DIR = path.join(process.cwd(), '.tmp', 'pdf-diagnostics')

  if (!arg) {
    console.log('PDF Fixture Diagnostics')
    console.log('=======================')
    console.log('Usage:')
    console.log('  npm run diagnose:pdf:all')
    console.log('  npm run diagnose:pdf -- manual-fixtures/MoedA_2026.pdf')
    console.log('')
    console.log('Output: .tmp/pdf-diagnostics/<name>/report.md')
    console.log('')
    console.log('Put local PDFs under manual-fixtures/ (git-ignored, never committed).')
    process.exit(0)
  }

  // Collect PDF files
  let pdfFiles: string[]
  if (arg.toLowerCase().endsWith('.pdf')) {
    if (!fs.existsSync(arg)) {
      console.error(`❌ File not found: ${arg}`)
      process.exit(1)
    }
    pdfFiles = [arg]
  } else {
    // Treat as directory — scan both the given dir and its pdf/ subdirectory
    if (!fs.existsSync(arg)) {
      console.log(`ℹ️  Directory not found: ${arg}`)
      console.log('Put local PDFs under manual-fixtures/ or manual-fixtures/pdf/ and run: npm run diagnose:pdf:all')
      process.exit(0)
    }
    pdfFiles = collectPdfFiles(arg)

    if (pdfFiles.length === 0) {
      console.log(`ℹ️  No PDF files found in ${arg} or ${arg}/pdf/`)
      console.log('Put local PDFs under manual-fixtures/ or manual-fixtures/pdf/ and run: npm run diagnose:pdf:all')
      process.exit(0)
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log(`\n🔍 PDF Fixture Diagnostics`)
  console.log(`   Processing ${pdfFiles.length} file(s)...`)

  const results: PdfDiagnosticsResult[] = []
  for (const filePath of pdfFiles) {
    const result = await analyzePdf(filePath, OUTPUT_DIR)
    results.push(result)
  }

  // Write combined summary
  const dateStr = new Date().toISOString().slice(0, 10)
  const summary = buildSummary(results, dateStr)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.md'), summary)

  console.log(`\n📊 Summary: .tmp/pdf-diagnostics/summary.md`)
  console.log(`   Done! All reports in: .tmp/pdf-diagnostics/`)
}

main().catch(err => {
  console.error('❌ Diagnostic script failed:', err)
  process.exit(1)
})
