# PDF Extraction Engineer Audit — Step 8-3f

**Files audited:**
- `lib/extract/pdfLines.ts`
- `lib/extract/extractPdf.ts`
- `lib/extract/pdfNormalize.ts`
- `lib/extract/pdfEngine/extractPdfHybrid.ts`
- `lib/extract/pdfEngine/detectQuestionRegions.ts`

---

## Checklist

### 1. `reconstructPageText` does NOT call `.join('')` on raw pdfjs items; uses coordinate-based reconstruction
✅ PASS — `reconstructPageText` in `pdfLines.ts` maps items to `PositionedItem` structs (extracting `x`/`y` from `transform[4]`/`transform[5]`), groups by Y-coordinate via `groupByY`, sorts by reading direction, and joins via `joinWithSpacing` which inserts spaces based on gap calculation. No raw `.join('')` is used anywhere.

### 2. `transform[4]` = x, `transform[5]` = y (verify actual indexing in usage)
✅ PASS — `pdfLines.ts` line 8 documents `// [a, b, c, d, x, y] — we use indices 4 (x) and 5 (y)`. Lines 38–39 use `item.transform[4]` for x and `item.transform[5]` for y. `detectQuestionRegions.ts` line 24 also uses `transform[5]` for y-sorting, and `extractPdfHybrid.ts` line 55 uses `transform[4]` for x. All usages are consistent.

### 3. RTL gap formula: `(prev.x - prev.width) - curr.x` (or equivalent correct formula)
✅ PASS — `pdfLines.ts` line 106: `(prev.x - prev.width) - curr.x` with comment `// RTL: prev left edge minus curr right edge`. This correctly computes the gap between the left edge of the previous item and the right edge of the current item in RTL reading order.

### 4. LTR gap formula: `curr.x - (prev.x + prev.width)`
✅ PASS — `pdfLines.ts` line 107: `curr.x - (prev.x + prev.width)` with comment `// LTR: curr left edge minus prev right edge`. Correct formula.

### 5. `Y_TOLERANCE = 3.0` (verify actual constant)
✅ PASS — `pdfLines.ts` line 21: `const Y_TOLERANCE = 3.0`. Also mirrored in `detectQuestionRegions.ts` line 5 as `const Y_TOLERANCE = 3.0   // same as pdfLines.ts`.

### 6. `SPACE_THRESHOLD_FACTOR = 0.35` (verify actual constant; was changed from 0.25)
✅ PASS — `pdfLines.ts` line 22: `const SPACE_THRESHOLD_FACTOR = 0.35`. Confirmed at 0.35; no trace of 0.25 remains.

### 7. Header/footer removal in `pdfNormalize.ts` does NOT strip question/option lines
✅ PASS — `pdfNormalize.ts` `isHeaderOrFooter()` (lines 93–100) has an explicit guard on line 95: `if (/^(שאלה|\d+\.?\s|\.[א-ת]|[א-ת][.)])/.test(line)) return false`. Lines matching question or option patterns are unconditionally preserved before any frequency or pattern check is applied.

### 8. `isNativeQualityPoor()` (or equivalent) conditions are sensible (not too aggressive / too lenient)
✅ PASS — `extractPdfHybrid.ts` lines 10–17: returns `true` if `chars < 100` (scanned/empty), `suspiciousJoinedWords > 5` (garbled text), `!hasEnoughLineBreaks` (structure lost), or `detectedQuestionMarkers === 0 && chars > 200` (non-trivial text but no question structure found). All four conditions are individually reasonable; together they cover the main failure modes without being excessively aggressive.

### 9. `detectComplexity()` / quality check handles empty pages gracefully (no crash)
✅ PASS — `detectComplexity()` in `extractPdfHybrid.ts` wraps each page iteration in `try/catch` (outer: line 36 `try`, catch at line 67 `continue`; inner: lines 42–44 for `getOperatorList`). Line 39 adds a defensive `if (!page) continue` check. Empty items arrays are handled because the `xs.length > 10` guard at line 56 skips multi-column and table detection for sparse pages.

### 10. Scanned PDF detection produces a Hebrew warning to the user
✅ PASS — `extractPdf.ts` line 44: `warning = 'נראה שה-PDF סרוק או שהטקסט לא חולץ טוב. מומלץ להשתמש בקובץ Word אם אפשר.'` is emitted when `text.trim().length < SCANNED_THRESHOLD` (100 chars). A secondary Hebrew warning at line 46 covers partial extraction quality. Both are proper Hebrew user-facing messages.

### 11. `QUESTION_RE` / question detection regex handles reversed RTL number markers (e.g. `:2 שאלה מספר`)
✅ PASS — `detectQuestionRegions.ts` line 9: `QUESTION_RE = /^(:?\s*\d+(?::\s+|\s+)שאלה|שאלה\s*\d*|(\d+)\s*[\.\)]\s|[\.\)]\s*(\d+)(?:\s|$))/`. The first alternative `:?\s*\d+(?::\s+|\s+)שאלה` matches both `:2 שאלה` and `2 שאלה` forms. `pdfNormalize.ts` also has `RE_REVERSED_START` / `RE_REVERSED_MID` that normalise these markers before they reach downstream parsers.

### 12. Auto mode: native extraction preferred; OCR fallback only when native quality is poor
✅ PASS — `extractPdfHybrid.ts` lines 104–113: in `auto` mode, native extraction (`extractPdfTextFromProxy`) runs first (line 105), quality is checked via `isNativeQualityPoor()` (line 110), and `extractPdfOcr` is called only when native quality is poor. When native quality is acceptable, `nativeResult` is returned immediately.

### 13. Hebrew option labels (א. ב. ג. ד.) are preserved through normalization pipeline
✅ PASS — `pdfNormalize.ts` `isHeaderOrFooter()` guard (line 95) explicitly matches `[א-ת][.)]` to prevent option lines from being stripped. `normalizeOptionLabel()` (lines 102–105) corrects RTL-flipped labels (e.g. `.א` at line end → `א.` at start) rather than removing them. The `normalizePdfText` pipeline therefore both protects and fixes option labels.

---

## Verdict

**PASS**

- All 13 checklist items verified against source code; no failures or partial items found.
- Constants `Y_TOLERANCE = 3.0` and `SPACE_THRESHOLD_FACTOR = 0.35` are confirmed at their expected values.
- Coordinate-based reconstruction, RTL/LTR gap formulas, Hebrew warning, and scanned-PDF fallback are all correctly implemented.
