# Hebrew RTL Audit — Step 8-3f

**Reviewer:** hebrew-rtl-reviewer
**Date:** 2026-06-07
**Scope:** Hebrew/RTL correctness across parser, shuffle, components, and export layers

---

## Files Reviewed

| File | Status |
|---|---|
| `components/ShuffledExamView.tsx` | Read |
| `components/ParsedExamPreview.tsx` | Read |
| `components/PrintableExam.tsx` | Read |
| `lib/export/exportDocx.ts` | Read |
| `lib/export/rtlDocx.ts` | Read |
| `lib/export/exportCsv.ts` | Read |
| `lib/rtl/rtlUtils.ts` | Read |
| `fixtures/rtlFixtures.ts` | Read |
| `app/globals.css` | Read (print/RTL rules) |

---

## Checklist

### 1. No manual Hebrew string reversal in parser, shuffle, or export code
**✅ PASS**
No `.reverse()`, `.split('').reverse().join('')`, or equivalent string-reversal logic was found in any parser, shuffle, or export file. The `pdfNormalize.ts` and `detectQuestionRegions.ts` reference "reversed question markers" only in regex detection of mis-rendered PDF text (pattern matching, not string manipulation). No reversal of Hebrew text is performed.

---

### 2. No hidden Unicode direction marks (U+202A LRE, U+202B RLE, U+202C PDF) injected into stored exam text
**⚠ PARTIAL**
`lib/rtl/rtlUtils.ts` defines `wrapLtr()` which injects U+202A (LRE) and U+202C (PDF) around wrapped text. The function is exported and available to callers. However, inspection of all parser (`lib/parser/`), shuffle (`lib/shuffle/`), and export (`lib/export/`) files confirms that `wrapLtr` is **not called** from any of those paths — it is only referenced in `tests/rtl.test.ts`. The direction marks exist in the utility file's string literals (lines 14-15 of `rtlUtils.ts`) as named constants, not injected into stored text.
Risk: if a future caller invokes `wrapLtr` at parse/store time, stored text would be contaminated. The utility should carry a `@renderOnly` JSDoc warning. No actual violation today, but the exposure exists.

---

### 3. RTL helpers (`wrapLtr`, `.ltr-isolate` or similar) used ONLY for rendering/export, never stored in parsed text
**✅ PASS**
`wrapLtr` is confined to `lib/rtl/rtlUtils.ts` and `tests/rtl.test.ts`. It is not imported or invoked in any parser, shuffle engine, or storage layer. The `.ltr-isolate` CSS class is defined in `app/globals.css` (line 13) for rendering use only and is not applied programmatically to stored text. No direction-wrapper logic touches the data store.

---

### 4. Question text and option text stored verbatim with no direction marks appended
**✅ PASS**
`exportDocx.ts` passes `q.questionText` and `opt.text` directly to `rtlParagraph()` without transformation. `rtlDocx.ts` passes the text string verbatim to `new TextRun({ text, ... })`. `exportCsv.ts` passes values through `escapeCsvField()` which only wraps in quotes if the string contains commas, double-quotes, or newlines — no direction marks added. All component files render text fields as-is.

---

### 5. UI uses `dir="rtl"` and/or `lang="he"` appropriately on containers
**✅ PASS**
- `ShuffledExamView.tsx` line 9: `<section ... dir="rtl">`. Individual question `<p>` elements also carry `dir="rtl"` (line 13).
- `ParsedExamPreview.tsx` line 31: `<section ... dir="rtl">`. Empty-state div also has `dir="rtl"` (line 21). Individual question `<p>` has `dir="rtl"` (line 69).
- `PrintableExam.tsx` line 10: `<div className="printable-exam" dir="rtl" lang="he">`. This is the only component that also sets `lang="he"` — appropriate for the print/PDF export path.
- `globals.css` line 6: `body { direction: rtl; }` provides a document-level RTL baseline.

---

### 6. `unicode-bidi: 'plaintext'` or `dir="auto"` used for mixed Hebrew+English inline content (not `bidi-override`)
**✅ PASS**
- `ShuffledExamView.tsx` line 18: question text span uses `unicodeBidi: 'plaintext'`. Line 28: option text span uses `dir="auto"` + `unicodeBidi: 'plaintext'`.
- `ParsedExamPreview.tsx` line 79: question text span uses `unicodeBidi: 'plaintext'`. Line 89: option text span uses `dir="auto"` + `unicodeBidi: 'plaintext'`.
- `globals.css` uses `unicode-bidi: isolate` (not `bidi-override`) for `code`, `kbd`, `samp`, `pre` elements and the `.ltr-isolate` helper class. `bidi-override` is never used anywhere in the codebase.

---

### 7. DOCX output: `<w:bidi/>` present in `sectPr`; paragraph alignment is right/both
**✅ PASS**
- `exportDocx.ts` calls `injectSectPrBidi()` (lines 22, 35-59) which post-processes the DOCX ZIP, locates `<w:sectPr>`, and injects `<w:bidi/>` if not already present. The injection handles both self-closing and full `</w:sectPr>` variants.
- `rtlDocx.ts` line 12: each paragraph is created with `alignment: AlignmentType.RIGHT` and `bidirectional: true`, which the `docx` library translates to `<w:jc w:val="right"/>` and `<w:bidi/>` in each paragraph's `<w:pPr>`.

---

### 8. CSV output: UTF-8 BOM present for Excel RTL compatibility
**✅ PASS**
`exportCsv.ts` line 12: `const BOM = '﻿'` (U+FEFF confirmed via byte inspection). Line 31: the BOM is prepended to the output string. The value U+FEFF at position 0 is the correct UTF-8 BOM for Excel to recognize encoding and render Hebrew without mojibake.

---

### 9. Print-to-PDF: browser CSS `direction: rtl` applied to printed section
**✅ PASS**
`app/globals.css` lines 43-48: the `@media print` block contains:
```css
.printable-exam {
  direction: rtl;
  ...
}
```
`PrintableExam.tsx` applies `className="printable-exam"` to its root `<div>`, so the print-time `direction: rtl` rule activates for PDF output. The `@page` margin rule (line 39) is also present.

---

### 10. `ShuffledExamView`: `unicodeBidi plaintext` + `whiteSpace pre-wrap` applied to question/option text
**✅ PASS**
- Question text span (line 18): `style={{ direction: 'rtl', unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}`.
- Option text span (line 28): `style={{ unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}` with `dir="auto"`.
Both properties are present on both text-bearing spans.

---

### 11. `ParsedExamPreview`: same RTL CSS applied as `ShuffledExamView`
**✅ PASS**
`ParsedExamPreview.tsx` mirrors `ShuffledExamView.tsx` exactly:
- Question text span (line 79): `style={{ direction: 'rtl', unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}`.
- Option text span (line 89): `dir="auto"` + `style={{ unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}`.

---

### 12. Mixed-direction examples not broken: Hebrew with inline SQL, percentages, English function names
**⚠ PARTIAL**
`fixtures/rtlFixtures.ts` contains three well-constructed mixed-direction test cases:
- Hebrew question with inline `getUserName` English function name and `user_id=123` (line 5).
- Hebrew with `accuracy=95%` and `precision=80%` percentages (line 14).
- Hebrew question where the answer options are pure SQL (`SELECT`, `DELETE`, `UPDATE`, `INSERT`) (lines 22-29).

These fixtures confirm the data shapes are correct. The rendering path (`dir="auto"` + `unicodeBidi: 'plaintext'`) is correct for these cases and will let UBA handle SQL/numeric direction without forced override.

**Gap:** `PrintableExam.tsx` option spans use `dir="auto"` (line 26) but do NOT apply `unicodeBidi: 'plaintext'` or `whiteSpace: pre-wrap`. For mixed Hebrew+SQL options in print/PDF, the browser may misrender without `unicodeBidi: plaintext`. The question `<p>` element (line 17) also lacks any `unicodeBidi` style, relying solely on `dir="rtl"` from the container — adequate for pure Hebrew but fragile for mixed content printed to PDF.
Reference: `PrintableExam.tsx` lines 17-27.

---

## Verdict

**PASS_WITH_WARNINGS**

- Item 2 warning: `wrapLtr()` (U+202A/U+202C injection) in `lib/rtl/rtlUtils.ts` is exported and accessible to any future caller; a `@renderOnly` JSDoc guard is missing to prevent accidental use at parse/store time.
- Item 12 warning: `PrintableExam.tsx` option spans (line 26) lack `unicodeBidi: 'plaintext'` and `whiteSpace: pre-wrap`, making mixed Hebrew+SQL/English content in the print/PDF path potentially fragile for edge-case bidi rendering compared to the screen components.
