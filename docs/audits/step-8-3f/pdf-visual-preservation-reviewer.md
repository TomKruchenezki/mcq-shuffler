# PDF Visual Preservation Review — Step 8-3f

**Reviewer:** pdf-visual-preservation-reviewer
**Date:** 2026-06-07
**Files audited:**
- `lib/extract/pdfEngine/extractPdfVisual.ts`
- `lib/extract/pdfEngine/detectQuestionRegions.ts`
- `lib/extract/pdfEngine/cropPageRegion.ts`
- `lib/extract/pdfEngine/visualTypes.ts`
- `components/VisualShuffledExamView.tsx`
- `components/VisualPrintableExam.tsx`
- `components/FileUpload.tsx`
- `components/ExamShuffler.tsx` (supporting context)
- `components/ExportButtons.tsx` (supporting context)
- `lib/extract/pdfEngine/renderPdfPage.ts` (supporting context)

---

## Checklist Results

### 1. Visual mode (high-fidelity) is implemented and accessible from FileUpload.tsx
**✅ PASS** — `FileUpload.tsx` exposes a `PdfMode` radio button group with `'visual'` as an explicit option labelled "נאמנות גבוהה"; selecting it routes extraction through `extractPdfVisual` and calls `onVisualExtracted`. The visual pipeline is fully wired end-to-end via `ExamShuffler`.

---

### 2. Visual mode never renders null, undefined, or placeholder data for question images
**✅ PASS** — `extractPdfVisual.ts` filters out any detected region with zero options (`completeQuestions.filter(q => q.options.length > 0)`) before returning. `cropPageRegion` guards against zero-dimension canvases (`Math.max(1, ...)`) and returns `'data:,'` only when the 2D context is unavailable — an edge case that cannot produce a null `src`. `VisualShuffledExamView` and `VisualPrintableExam` render images by directly binding `opt.dataUrl` / `q.stemDataUrl`, both of which are always set to a string by `cropPageRegion`. No conditional `|| undefined` or `?? ''` branches are present that could silently pass a blank src through.

---

### 3. If extraction returns 0 visual questions → fallback to text mode with Hebrew warning
**✅ PASS** — In `FileUpload.tsx` (lines 86-103), when `visualResult.visualQuestions.length === 0`, the code sets a Hebrew warning combining `visualResult.warning` with "עובר לחילוץ טקסטואלי אוטומטי במקום.", then calls `extractPdfHybrid` in `'auto'` mode and routes the result through the normal text pipeline. `onVisualExtracted` is deliberately NOT called in this branch, so the app stays in text mode.

---

### 4. Coordinate flip: PDF origin (bottom-left) → canvas origin (top-left) correctly applied
**✅ PASS** — `cropPageRegion.ts` implements `pdfRectToCanvasRect` with the formula `canvasY = (pageHeightPdf - pdfRect.y - pdfRect.height) * scale`, which correctly flips the bottom-left PDF origin to the top-left canvas origin. The inline comment documents the math explicitly. `labelBoxToCanvasRect` delegates to the same function.

---

### 5. RENDER_SCALE = 2.0 for sharp canvas rendering
**✅ PASS** — `renderPdfPage.ts` declares `const RENDER_SCALE = 2.0` and passes it as the default `scale` argument. `cropPageRegion.ts` also declares `const RENDER_SCALE = 2.0` as its default scale for coordinate conversion, keeping crop coordinates consistent with the rendered canvas dimensions.

---

### 6. Original option labels are erased (white-fill) before crop image is returned
**✅ PASS** — For each option crop, `extractPdfVisual.ts` builds a `LabelBox` from the label `PdfTextItem`, converts it to `labelCanvasRect` via `labelBoxToCanvasRect`, and passes it in the `labelsToWhiteFill` array to `cropPageRegion`. Inside `cropPageRegion`, each entry is white-filled with `ctx.fillStyle = '#ffffff'` before the data URL is generated. Stem crops correctly pass an empty `[]` for `labelsToWhiteFill`.

---

### 7. Shuffled Hebrew labels display correctly in VisualShuffledExamView
**✅ PASS** — `VisualShuffledExamView.tsx` renders `{opt.label}.` as a bold `<span>` preceding each option image, where `opt.label` is the shuffled Hebrew letter assigned by the shuffle layer (`ShuffledVisualOption.label`). Direction is set to `dir="rtl"` on the section container. The label span uses `select-none` to prevent accidental copying. No RTL-specific rendering bug is apparent from static review; the structure mirrors the working text-mode `ShuffledExamView`.

---

### 8. Cross-page questions handled gracefully (partial detection acknowledged in UI or docs)
**⚠ PARTIAL** — Cross-page questions are acknowledged in three places: (a) the file-level JSDoc comment in `extractPdfVisual.ts` (limitation #1), (b) the Hebrew warning string returned when only partial regions (stems without options) are detected: "ייתכן שהשאלות משתרעות על פני עמודים — נסה מצב אוטומטי", (c) the filter `completeQuestions.filter(q => q.options.length > 0)` silently drops incomplete cross-page questions. However, there is no per-question inline indicator in the UI when a cross-page question is silently dropped (only the aggregate warning is shown if ALL questions fail). A question that has options on the same page will pass through while its cross-page sibling is silently discarded — this gap is not surfaced to the user.

---

### 9. Visual mode export: only PDF print; DOCX export button is disabled in visual mode
**✅ PASS** — `ExportButtons.tsx` sets `isVisualMode = shuffledVisualExam != null` and applies `disabled={disabled || isVisualMode}` to the Word export button. A `title` tooltip and an inline amber warning paragraph "ייצוא Word אינו זמין במצב נאמנות גבוהה — השתמש ב-PDF" are both rendered when `isVisualMode` is true. The PDF button (`window.print()`) remains enabled. The print-only `<VisualPrintableExam>` div is rendered in `ExamShuffler` via `shuffledVisualExam` state, so browser print captures the visual layout.

---

### 10. hasVisualContent per-question flag present and shown as badge in preview
**⚠ PARTIAL** — `hasVisualContent` exists on `ParsedQuestion` (text pipeline) and is displayed as a "📊 תוכן חזותי" badge in `ParsedExamPreview.tsx`. However, `VisualQuestion` and `ShuffledVisualQuestion` (visual pipeline types in `visualTypes.ts`) do NOT carry a `hasVisualContent` field, and `VisualShuffledExamView` does not render any per-question visual-mode badge. In visual mode the "נאמנות גבוהה" badge appears only as a single section-level label, not per question.

---

### 11. Visual mode does not corrupt or interfere with text-mode exam state
**✅ PASS** — `ExamShuffler` maintains separate state variables for the two pipelines: `visualQuestions`/`shuffledVisualExam` (visual) and `parsedExam`/`shuffledExam`/`rawText` (text). `handleVisualExtracted` resets only visual state; `handleParse`/`handleShuffle` operate on text state and are guarded by `if (visualQuestions && visualQuestions.length > 0)` which short-circuits to the visual shuffle path without touching text state. `handleReset` clears all state together. There is no shared mutable structure between the two pipelines that could cause cross-contamination.

---

## Verdict

**PASS_WITH_WARNINGS**

- Item 8 (cross-page questions): silently dropped incomplete questions are not individually flagged in the UI — only an aggregate warning appears when ALL visual questions fail; a partial per-question warning is absent.
- Item 10 (hasVisualContent badge): the flag and badge exist in the text-mode pipeline but are not carried forward to `VisualQuestion` / `VisualShuffledExamView`, so the per-question visual-content indicator is missing in visual mode.
- All safety-critical properties (coordinate flip, RENDER_SCALE, white-fill, DOCX disable, null guard, text-mode isolation) are correctly implemented.
