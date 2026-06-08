# Manual PDF Fixtures — Developer Guide

This document explains how to work with real local PDF exam files for testing and diagnosis.

---

## Where to put real PDFs

Place real exam PDF files in the `manual-fixtures/` directory at the project root:

```
manual-fixtures/
  MoedA_2026.pdf
  MoedB_2026.pdf
  MoedA_2026.expect.json   ← optional expectations (see below)
```

> **This directory is git-ignored and must never be committed.**

---

## Git safety

`manual-fixtures/` is listed in `.gitignore`. Run the following to verify nothing was accidentally tracked:

```bash
npm run check:fixtures
# ✅ manual-fixtures/ is correctly ignored by git
```

**Never**:
- Add PDF files to `public/`, `tests/fixtures/`, or any committed directory
- Commit full extracted text from real exams
- Copy real question text into committed test files

---

## How to run diagnostics

Analyze all PDFs in `manual-fixtures/`:

```bash
npm run diagnose:pdf:all
```

Analyze a single PDF:

```bash
npm run diagnose:pdf -- manual-fixtures/MoedA_2026.pdf
```

Output is written to `.tmp/pdf-diagnostics/` (also git-ignored):

```
.tmp/pdf-diagnostics/
  MoedA_2026/
    extracted-text.txt    ← raw pdfjs-dist output
    normalized-text.txt   ← after normalizePdfText()
    parsed-questions.json ← full ParsedExam JSON
    diagnostics.json      ← ParseDiagnostics + extended fields
    report.md             ← human-readable summary
  MoedB_2026/
    ...
  summary.md              ← combined table across all PDFs
```

---

## Diagnostic workflow

1. **Run**: `npm run diagnose:pdf:all`
2. **Inspect**: open `.tmp/pdf-diagnostics/<name>/report.md`
3. **Look for**:
   - Questions with `< 2 options` → likely parse failure
   - `False Marker Candidates` → numbers that might be decimal false positives
   - `Missing Visual / Code Content` → questions referencing unseen diagrams/code
   - `Auto-split from embedded marker` → normal, these are handled correctly
4. **Create sanitized tests**: if you find a NEW failure pattern, add a small fabricated test snippet to `tests/realPdfPatterns.test.ts` (no real question text)
5. **Fix the parser** if needed
6. **Re-run** to verify improvement

---

## Sanitized regression tests

All committed regression tests live in:

- `tests/realPdfPatterns.test.ts` — 15 sanitized tests (always run in CI, no fixtures needed)
- `tests/pdfFixtureDiagnostics.test.ts` — 5 real-fixture tests (auto-skipped when fixtures absent)

**Rule**: committed tests must use tiny fabricated Hebrew/Latin snippets that reproduce the failure pattern. Never copy real exam questions into test files.

---

## Optional expectations files

You can create a `<name>.expect.json` file alongside a PDF to declare what you expect the diagnostic script to find:

```json
// manual-fixtures/MoedA_2026.expect.json
{
  "expectedMinParsedQuestions": 25,
  "expectedNoFalseSourceNumbers": [70, 95],
  "knownIssues": ["source order may be non-sequential"]
}
```

Fields:

| Field | Type | Meaning |
|---|---|---|
| `expectedMinParsedQuestions` | `number` | Warn if parsed count is less than this |
| `expectedNoFalseSourceNumbers` | `number[]` | Warn if any of these appear as source question numbers (likely false positives) |
| `expectedWarnings` | `string[]` | Reserved for future use |
| `knownIssues` | `string[]` | Informational — shown in the report as context |

The expectations are advisory: the script always exits 0 regardless. Results appear in `report.md` under `## Expectations`.

These files are also git-ignored (covered by `/manual-fixtures/` in `.gitignore`).

---

## What NOT to do

| ❌ Do not | ✅ Do instead |
|---|---|
| Commit PDFs to any folder | Keep them only in `manual-fixtures/` |
| Copy full question text into tests | Create a tiny fabricated snippet that reproduces the failure pattern |
| Add PDF paths to `public/` or `tests/fixtures/` | Use the `manual-fixtures/` convention |
| Run `diagnose:pdf:all` in CI | It's a local developer tool only |
| Expect `npm test` to test the real PDFs | The fixture tests auto-skip; use `npm run diagnose:pdf:all` locally |
