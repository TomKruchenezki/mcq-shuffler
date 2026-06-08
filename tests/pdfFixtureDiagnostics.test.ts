// @vitest-environment node
/**
 * tests/pdfFixtureDiagnostics.test.ts
 *
 * Local-only fixture regression tests: run the full extraction/parsing pipeline
 * on real PDFs in manual-fixtures/ and assert structural expectations.
 *
 * CI SAFETY: If manual-fixtures/ does not exist (CI environment), ALL tests in
 * this file are SKIPPED. The standard `npm test` suite always passes without fixtures.
 *
 * To run locally:
 *   npm test                           (skips these tests if manual-fixtures/ absent)
 *   npm test tests/pdfFixtureDiagnostics.test.ts   (explicit, will skip if absent)
 *
 * Real PDFs belong in manual-fixtures/ which is git-ignored.
 * For a full diagnostic report: npm run diagnose:pdf:all
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { reconstructPageText } from '@/lib/extract/pdfLines'
import type { PdfTextItem } from '@/lib/extract/pdfLines'
import { normalizePdfText } from '@/lib/extract/pdfNormalize'
import { parseExam, diagnoseParsedExam } from '@/lib/parser/parseQuestions'
import type { ParsedExam, ParseDiagnostics } from '@/lib/parser/parseQuestions'

// ── Fixture path ──────────────────────────────────────────────────────────────
// Supports both manual-fixtures/<name>.pdf and manual-fixtures/pdf/<name>.pdf

function findFixturePdf(name: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'manual-fixtures', name),
    path.join(process.cwd(), 'manual-fixtures', 'pdf', name),
  ]
  return candidates.find(p => fs.existsSync(p)) ?? null
}

const fixturesExist =
  findFixturePdf('MoedA_2026.pdf') !== null ||
  findFixturePdf('MoedB_2026.pdf') !== null

// ── Shared extraction helper ──────────────────────────────────────────────────

async function extractAndParse(
  pdfPath: string,
): Promise<{ exam: ParsedExam; diag: ParseDiagnostics; numPages: number }> {
  // Use the legacy build — recommended by pdfjs-dist for Node.js environments.
  // The legacy build bundles its worker inline; no GlobalWorkerOptions.workerSrc needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const buffer = fs.readFileSync(pdfPath)
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

  const normalizedPages = normalizePdfText(pages)
  const rawText = normalizedPages.join('\n\n').trim()
  const exam = parseExam(rawText)
  const diag = diagnoseParsedExam(exam)

  return { exam, diag, numPages: doc.numPages }
}

// ── Fixture tests (skip if manual-fixtures/ absent) ───────────────────────────

describe.skipIf(!fixturesExist)(
  'PDF fixture regression (local-only — skipped in CI)',
  () => {
    // ── Test 1: MoedA minimum question count ────────────────────────────────

    it(
      'MoedA_2026.pdf: extracts at least 20 parsed questions',
      { timeout: 30_000 },
      async () => {
        const pdfPath = findFixturePdf('MoedA_2026.pdf') ?? ''
        if (!pdfPath) return  // file-level skip (fixture may be absent)

        const { diag } = await extractAndParse(pdfPath)
        expect(diag.parsedQuestionCount).toBeGreaterThanOrEqual(20)
      },
    )

    // ── Test 2: MoedB minimum question count ────────────────────────────────

    it(
      'MoedB_2026.pdf: extracts at least 15 parsed questions',
      { timeout: 30_000 },
      async () => {
        const pdfPath = findFixturePdf('MoedB_2026.pdf') ?? ''
        if (!pdfPath) return

        const { diag } = await extractAndParse(pdfPath)
        expect(diag.parsedQuestionCount).toBeGreaterThanOrEqual(15)
      },
    )

    // ── Test 3: No phantom questions from known false markers ─────────────────
    // Verifies that the ".70%" and ".95%" decimal false-positive fix (Step 9D Part B)
    // is effective on the real MoedA exam.

    it(
      'MoedA_2026.pdf: source numbers do not include known false markers [70, 95] for standard-length exams',
      { timeout: 30_000 },
      async () => {
        const pdfPath = findFixturePdf('MoedA_2026.pdf') ?? ''
        if (!pdfPath) return

        const { exam, diag } = await extractAndParse(pdfPath)
        const sourceNumbers = exam.questions.map(q => q.number)

        // Only check if the exam appears to be standard-length (< N questions)
        // so we don't falsely fail on a very long exam where these could be valid.
        if (diag.parsedQuestionCount < 70) {
          expect(sourceNumbers).not.toContain(70)
        }
        if (diag.parsedQuestionCount < 95) {
          expect(sourceNumbers).not.toContain(95)
        }
      },
    )

    // ── Test 4: Real exams always have at least one non-ok question ──────────
    // Visual content, missing visual, suspicious numbers — real exams have edge cases.

    it(
      'MoedA_2026.pdf: at least one question has status !== "ok" (real exams have edge cases)',
      { timeout: 30_000 },
      async () => {
        const pdfPath = findFixturePdf('MoedA_2026.pdf') ?? ''
        if (!pdfPath) return

        const { diag } = await extractAndParse(pdfPath)
        // Real Hebrew university exams reliably have visual content questions
        expect(diag.needsReviewCount).toBeGreaterThan(0)
      },
    )

    // ── Test 5: MoedB option density ─────────────────────────────────────────
    // Multiple-choice exams should have at least 4 options per question on average.

    it(
      'MoedB_2026.pdf: parsed option count >= 4 × parsed question count',
      { timeout: 30_000 },
      async () => {
        const pdfPath = findFixturePdf('MoedB_2026.pdf') ?? ''
        if (!pdfPath) return

        const { exam, diag } = await extractAndParse(pdfPath)
        const totalOptions = exam.questions.reduce(
          (sum, q) => sum + q.options.length,
          0,
        )
        // Expect an average of at least 4 options per question
        expect(totalOptions).toBeGreaterThanOrEqual(diag.parsedQuestionCount * 4)
      },
    )
  },
)
