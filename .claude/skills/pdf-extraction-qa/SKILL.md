# Skill: pdf-extraction-qa

## When to Use

Invoke this skill whenever a change may affect PDF text extraction quality or fidelity:

- Changes to `lib/extract/pdfLines.ts`, `pdfNormalize.ts`, or `extractPdf.ts`
- Changes to `lib/parser/parseQuestions.ts` (new question/option patterns)
- Any OCR implementation work
- Any change that touches how pdfjs-dist `TextItem[]` data is consumed

## PDF Extraction Checklist

Work through each item in order. Do not mark a step done until verified.

### 1 — PDF Text Extraction Rules

- [ ] Text items are NEVER joined with `items.map(x => x.str).join('')` (empty-string join)
- [ ] `TextItem.transform[4]` is used for x-coordinate, `transform[5]` for y-coordinate
- [ ] Items with `str.trim() === ''` are filtered before grouping
- [ ] Lines are grouped by y-coordinate within `Y_TOLERANCE = 3.0` PDF units
- [ ] Lines are sorted top-to-bottom (highest y first in PDF coordinate space)

### 2 — Hebrew RTL Rules

- [ ] RTL items sorted by x DESCENDING within a line (rightmost = reading order for Hebrew)
- [ ] LTR items sorted by x ASCENDING within a line
- [ ] RTL gap formula: `(prev.x - prev.width) - curr.x`
- [ ] LTR gap formula: `curr.x - (prev.x + prev.width)`
- [ ] Space inserted only when gap > `fontSize * SPACE_THRESHOLD_FACTOR (0.25)`
- [ ] No Hebrew strings reversed; no hidden Unicode direction marks (U+202A / U+202C) in output
- [ ] Dominant direction: `isRtl = rtlCount >= group.length / 2`

### 3 — Parser Compatibility

- [ ] Extracted text allows `parseExam` to detect `שאלה מספר N` question markers
- [ ] Extracted text allows `parseExam` to detect Hebrew option labels (`א.`, `ב.` etc.)
- [ ] RTL-flipped labels (`text .א`) are normalized to `א. text` before parsing
- [ ] `.N` (RTL period-number) patterns handled by `RE_RTL_PERIOD`
- [ ] Colon variants (`שאלה מספר:2`) handled by `RE_HEBREW_FULL`

### 4 — Quality Scoring

- [ ] `PdfExtractionQuality` populated: `pages`, `textItems`, `chars`
- [ ] `detectedQuestionMarkers` > 0 for an exam PDF
- [ ] `detectedOptionMarkers` > 0 for an exam PDF
- [ ] `suspiciousJoinedWords` = 0 for well-spaced text (Hebrew tokens > 20 chars)
- [ ] `hasEnoughLineBreaks`: `lines.length > Math.max(3, totalItems * 0.05)`
- [ ] Quality badge appears in `FileUpload.tsx` after extraction
- [ ] Amber warning shown when `!hasEnoughLineBreaks || suspiciousJoinedWords > 5`

### 5 — OCR Rules (when implementing)

- [ ] OCR engine runs ENTIRELY IN THE BROWSER (Tesseract.js WASM or equivalent)
- [ ] NO server calls, NO external API calls, NO paid AI/LLM calls
- [ ] NO cloud OCR (Google Vision, AWS Textract, Azure, etc.)
- [ ] OCR activated ONLY when `PdfExtractionResult.warning` indicates a scanned PDF
- [ ] OCR output passes through `reconstructPageText` + `normalizePdfText` pipeline

### 6 — Visual Preservation

- [ ] Question text is not truncated, reordered, or modified between extraction and display
- [ ] Option text is not truncated, reordered, or modified
- [ ] Mixed Hebrew + English + numbers + SQL/code remains readable (not garbled)
- [ ] Header/footer removal does not accidentally delete question content
- [ ] Safety guard: lines matching `/^(שאלה|\d+\.?\s|\.[א-ת]|[א-ת][.)])/` are NEVER removed

### 7 — Tests

- [ ] `tests/pdfLines.test.ts` covers: empty, single, LTR sort, RTL sort, gap, overlap, tolerance, majority
- [ ] `tests/pdfIntegration.test.ts` covers: question detection, option detection, quality, no reversal, header removal
- [ ] `tests/extractPdf.test.ts` covers: quality defined, pages count, `detectedQuestionMarkers`
- [ ] Real exam PDF placed in `manual-fixtures/` (gitignored) and verified manually
- [ ] `npm test` passes with 0 failures

### 8 — Verification

```bash
npm test           # all tests pass
npm run typecheck  # zero TypeScript errors
npm run build      # static export succeeds
```

## Key Files

- `lib/extract/pdfLines.ts` — coordinate-aware line reconstruction (`reconstructPageText`)
- `lib/extract/pdfNormalize.ts` — header/footer removal, RTL label normalization (`normalizePdfText`)
- `lib/extract/extractPdf.ts` — main entry point, quality computation (`extractPdfText`)
- `lib/parser/parseQuestions.ts` — question/option detection (`parseExam`)
- `components/FileUpload.tsx` — quality badge display
- `tests/pdfLines.test.ts`, `tests/pdfIntegration.test.ts`, `tests/extractPdf.test.ts`
- `manual-fixtures/` — real exam PDFs (gitignored, local only)
