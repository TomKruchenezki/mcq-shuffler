# MCQ Shuffler — Product Roadmap

This document describes the planned evolution of the MCQ shuffler beyond its current shuffle-and-export core.

---

## Current capabilities (Steps 1–8)

| Feature | Status |
|---|---|
| Paste text input | ✅ |
| DOCX upload | ✅ |
| PDF upload — native text / OCR / high-fidelity modes | ✅ |
| Automatic PDF mode selection (parseExam comparison) | ✅ |
| Manual exam editor (add/edit/move/delete questions & options) | ✅ |
| Image attachments on questions and options | ✅ |
| Shuffle options per question | ✅ |
| Answer key generation | ✅ |
| Export: Word DOCX / CSV / browser Print/PDF | ✅ |
| Full RTL / Hebrew support | ✅ |
| Local exam library (IndexedDB / Dexie) | ✅ |

---

## ✅ Step 9F — Real PDF Fixture Hardening (COMPLETE)

**Goal:** Use real local MoedA/MoedB fixtures to harden PDF parsing, visual warnings, and diagnostics based on actual diagnostic output from Step 9E.

### Changes

- **Part A — Path support:** `scripts/checkManualFixturesNotTracked.js` and `scripts/diagnosePdfFixtures.ts` now scan both `manual-fixtures/*.pdf` and `manual-fixtures/pdf/*.pdf`; `tests/pdfFixtureDiagnostics.test.ts` uses `findFixturePdf()` helper that checks both paths
- **Part B — Normalization colon-format fix:** RE_FORWARD_SLASH and RE_PAGE_QUESTION in `pdfNormalize.ts` updated with `\s*:?\s*` before `\d+` — now correctly handles embedded "שאלה מספר :N" markers (colon-before-digit form) on the same line
- **Part C — Missing visual keyword expansion:** Added `/שאילתת\s+SQL/i` and `/הנוסחה\s+הבאה/` to VISUAL_CONTENT_PATTERNS; added `/שאילתת\s+SQL/i` and `/DataFrame/i` to MISSING_VISUAL_KEYWORDS in `parseQuestions.ts`; updated `MISSING_VISUAL_KEYWORD_MAP` in diagnostic script to match
- **Part D — Diagnostic false alarm fix:** `detectFalseMarkerCandidates` in `diagnosePdfFixtures.ts` now cross-references formula/percentage matches against a set of genuine "שאלה מספר N" marker numbers — eliminates false alarms (MoedA FalseMarkers: 2→0, MoedB: 1→0)
- **Part E — ParsedExamPreview amber badge:** Source number badge now shows "(מקור חשוד: N)" in amber for `suspicious-number` questions vs. gray "(מקור: N)" for non-sequential source numbers
- **Part F — 5 new sanitized tests (tests 16–20):** colon-format suspicious-number, colon-format valid question, SQL missing-visual, e=7 formula guard, non-sequential source → sequential output

**Test count after step:** 546 passing (541 previous + 5 new), 0 failures, 0 TS errors.

**Before/after diagnostic comparison:**
- MoedA_2026.pdf: FalseMarkers 2→**0**, MissingVisual unchanged at 2
- MoedB_2026.pdf: FalseMarkers 1→**0**, MissingVisual unchanged at 3

---

## ✅ Step 9E — Local Real-PDF Fixture Diagnostics & Sanitized Regression Tests (COMPLETE)

**Goal:** Build a local-only diagnostic workflow that analyzes real PDFs through the full extraction/parsing pipeline, generates structured reports, and turns recurring failure patterns into committed sanitized regression tests — without committing any real exam files or content.

### Changes

- **Part A — Git safety:** Added `.tmp/`, `diagnostics-output/`, `.local-diagnostics/` to `.gitignore`; created `scripts/checkManualFixturesNotTracked.js` + `npm run check:fixtures` script
- **Part B — Diagnostic CLI:** Created `scripts/diagnosePdfFixtures.ts`; added `tsx@^4.22.4` devDependency; added `npm run diagnose:pdf` and `npm run diagnose:pdf:all` scripts. The script uses pdfjs-dist legacy Node.js build + `reconstructPageText` + `normalizePdfText` + `parseExam` + `diagnoseParsedExam`
- **Parts C+D — Reports:** Per-PDF reports in `.tmp/pdf-diagnostics/<name>/` (extracted-text.txt, normalized-text.txt, parsed-questions.json, diagnostics.json, report.md); combined `.tmp/pdf-diagnostics/summary.md`; false marker candidate detection; missing visual content detection; RTL mixed-text examples
- **Part E — Tests:** `tests/realPdfPatterns.test.ts` — 15 sanitized regression tests covering embedded markers, decimal false positives, formula/variable text, valid markers, PPV statistics snippets, missing visual patterns, Unicode safety; `tests/pdfFixtureDiagnostics.test.ts` — 5 local-only tests with `// @vitest-environment node` + `describe.skipIf(!fixturesExist)` guard (always skip in CI)
- **Part F — Expectations:** Optional `.expect.json` files alongside PDFs in `manual-fixtures/` for advisory assertions in diagnostic reports
- **Part G — Developer docs:** `docs/manual-fixtures.md` covering the full workflow

**Test count after step:** 541 passing (521 previous + 15 sanitized + 5 fixture), 0 failures, 0 TS errors.
**CI test count** (without fixtures): 536 passing (fixture tests auto-skip).

**Diagnostic output on real exams:**
- MoedA_2026.pdf: 14 pages, 25 questions, 150 options, 1 suspicious-number, 2 missing-visual-content
- MoedB_2026.pdf: 12 pages, 24 questions, 150 options, 1 suspicious-number, 3 missing-visual-content

---

## ✅ Step 9D — Targeted Real-PDF Bugfixes & Manual Split/Merge Tools (COMPLETE)

**Goal:** Fix two parser bugs exposed by MoedA_2026 QA, soften an alarming UX warning, add manual split/merge tools to the editor, and add a debug diagnostics download.

### Changes

- **Part A — Question number 0 guard fix:** Changed guard `questionNumber <= 0` → `< 0` in `parseQuestions.ts`, so `שאלה מספר 0` on its own line now correctly starts a new suspicious-number question instead of being silently absorbed into the previous option's text
- **Part B — RE_RTL_PERIOD decimal guard:** Added `(?!\s*%)` lookahead to `RE_RTL_PERIOD`, preventing `.70%` (decimal Specificity value) from creating a spurious question 70
- **Part C — Soften non-sequential warning:** Changed "⚠ מספרי שאלות לא עולים בסדר — ייתכן שגיאת קריאה" to neutral grey "ℹ מספרי מקור לא עולים בסדר (מספור הפלט 1..N תקין)" in `ParsedExamPreview.tsx`
- **Part D — Manual split/merge tools:** Added `splitQuestionAtCursor()` and `mergeWithPrevious()` helpers to `editableExam.ts`; added ✂ (split at cursor) and ⊞ (merge with previous) buttons to each `QuestionCard` in `ManualExamEditor.tsx`; added `qTextRef` for cursor tracking
- **Part G — Debug diagnostics download:** Added `downloadDiagnosticsReport()` to `ExamShuffler.tsx` + "הורד דוח ניתוח (JSON)" button after ParsedExamPreview
- **10 new/updated tests:** parser (2 new + 1 updated existing) + editableExam (6 new) + ManualExamEditor (2 new)

**Test count after step:** 521 passing, 0 failures, 0 TS errors.

---

## ✅ Step 9C — Real PDF / Manual Editor Hardening (COMPLETE)

**Goal:** Harden real PDF parsing, manual review warnings, RTL display, and image workflow based on MoedA_2026 QA testing.

### Changes

- **Part A — Forward marker splitting:** `pdfNormalize.ts` now splits lines like `"ו. / שאלה מספר 5 text"` into two lines; ZWSP marker on auto-split question lines enables parser to count them; `splitFromEmbedded?: boolean` on `ParsedQuestion`
- **Part B — Percentage protection + suspicious > 999:** parser rejects `"שאלה מספר 70%"` as a question start; `suspicious-number` status now also fires when `acc.number > 999`; `suspiciousNumberCount` added to `ParseDiagnostics`
- **Part C — Missing visual content:** `hasMissingVisualContent` field on `ParsedQuestion`; `MISSING_VISUAL_KEYWORDS` + `INLINE_CODE_PATTERNS` arrays; `checkMissingVisualContent()`; `mapStatus()` updated to return `missing-visual-content` before `visual-content`; `missingVisualContentCount` + `autoSplitCount` in `ParseDiagnostics`
- **Part D — ManualExamEditor alert:** orange `role="alert"` block for `missing-visual-content` questions with no image; `data-testid="question-img-input"` on hidden file input; Ctrl+V hint for `visual-content` questions
- **Part E — AnswerKeyTable RTL:** `unicodeBidi: 'plaintext'` on answer text cell
- **Part F — ParsedExamPreview chips:** converted to client component; 3 new interactive chips (suspicious count, missing-visual count, auto-split count) with expandable question-number lists; sort-by-source-number toggle
- **19 new tests:** pdfNormalize (3) + parser (9) + editableExam (2) + examStore (1) + ManualExamEditor (2) + corrections to 2 test assertions

**Test count after step:** 511 passing, 0 failures, 0 TS errors.

---

## ✅ Step 9B — Workflow QA Hardening (COMPLETE)

**Goal:** Harden the complete upload → parse → edit → save → reload → shuffle → export pipeline before adding Practice Mode. No new features.

### Changes

- **Bug fix:** `handleShuffle` auto-save now persists `editableExam` (not just `shuffledExam + answerKey`) — manual edits can no longer be lost by a shuffle
- **Bug fix:** `handleVisualExtracted` now sets `sourceType = 'pdf'` so visual-mode PDFs show the correct icon in the library
- **Layout fix:** `PrintableExam.tsx` — option images moved from inline flex row to block element below text (correct in Print/PDF export)
- **7 new tests:** examStore workflow integration (5) + ExamShuffler isDirty warning and auto-save (2)
- **1 strengthened test:** PrintableExam option image now asserts DOM structure (direct `<li>` child)
- **README:** Added Complete Workflow QA Checklist + Known Limitations table

**Test count after step:** 492 passing, 0 failures, 0 TS errors.

---

## ✅ Step 9 — Local Exam Library (COMPLETE)

**Goal:** Save, browse, and manage multiple exams in the browser — no backend required.

### Storage engine

- **IndexedDB** via [Dexie.js](https://dexie.org/) (`npm install dexie`)
- Three object stores: `exams`, `examVersions` (optional v1), `practiceAttempts`
- Full schema described in `docs/architecture/local-storage-plan.md`
- `localStorage` remains only for the small `mcq-shuffler-draft` key

### Features

| Feature | Notes |
|---|---|
| Save current exam | Saves `editableExam` + optional `shuffledExam` + metadata |
| Open saved exam | Loads into the editor; restores shuffle if present |
| Delete exam | Confirmation dialog |
| Rename exam | Inline edit of `StoredExam.title` |
| Duplicate exam | New UUID, timestamp reset |
| Exam list / library view | Sort by `updatedAt`; show title, question count, source, date |
| Metadata display | Created date, updated date, question count, source file name |
| Source type badge | paste / docx / pdf / manual |
| Status badge | draft / parsed / edited / shuffled / practice |
| Auto-save on shuffle | Updates `shuffledExam` and `answerKey` in existing record |

### Data types (already defined)

`StoredExam`, `StoredExamVersion` — see `lib/storage/types.ts`.

### Key implementation files

- `lib/storage/db.ts` — Dexie database singleton
- `lib/storage/examStore.ts` — CRUD helpers (save, load, delete, rename, list)
- `components/ExamLibrary.tsx` — library list UI
- `components/ExamLibraryItem.tsx` — single row card

---

## Step 10 — Practice / Solve Mode

**Goal:** Let the user answer a shuffled exam in the browser, check answers, and see their score.

### Features

| Feature | Notes |
|---|---|
| Answer selection | One option per question, radio-button style |
| Check single question | Shows ✅ / ❌ immediately after clicking |
| Check entire exam | Reveals all answers at once |
| Score summary | "X נכון מתוך Y" |
| Unanswered warning | Alert if submitting with blank questions |
| Save attempt | Writes `PracticeAttempt` to IndexedDB |
| Review past attempts | List of attempts with date, score, mode |
| Replay attempt | Restores the exact shuffle via `shuffledVersionId` |

### Answer identity

Answers reference `EditableQuestion.id` and `EditableOption.id` (UUIDs from the stored `editableExam`).  
This makes attempts portable across reshuffles: the same question is always identified by the same UUID.

### Checking correctness

```
isCorrect = (userAnswer.selectedOptionId === correctOptionId)
```
Where `correctOptionId` is read from `editableExam.questions[*].correctOptionId`.

### Key implementation files

- `lib/storage/attemptStore.ts` — save/load/list attempts
- `components/PracticeExam.tsx` — main practice UI (option selection, check, score)
- `components/AttemptHistory.tsx` — past attempts list

### Data types

`PracticeAttempt`, `UserAnswer` — see `lib/storage/types.ts`.

---

## Step 11 — Explanations / ChatGPT helper

**Goal:** Let the user copy a structured prompt to clipboard and paste it into any AI assistant. No API calls, no telemetry.

### Features

| Button | Action |
|---|---|
| העתק שאלה להסבר ב-ChatGPT | Copies a prompt for the focused question |
| העתק את כל הטעויות להסבר | Copies prompts for all wrong answers from the most recent attempt |

### Prompt format (Hebrew)

```
אני לומד לקראת מבחן. להלן שאלה מרובת בחירה:

שאלה: [questionText]

תשובות אפשריות:
א. [option text]
ב. [option text]
...

התשובה הנכונה היא: [label]. [text]
[אם הוגשה תשובה שגויה]: בחרתי: [label]. [text]

אנא הסבר לי למה התשובה הנכונה נכונה, ולמה התשובה שבחרתי שגויה.
```

### Privacy notice (shown in UI)

> המידע מועתק ללוח בלבד. שום מידע לא נשלח אוטומטית לשום שרת.
> הדבקת הטקסט ב-ChatGPT או כל עוזר AI אחר היא בשליטתך.

### Image-only options

If the correct or selected answer is image-only, the prompt includes `[תמונה — לא ניתן להדביק]` as the text.

### Key implementation files

- `lib/explanation/buildExplanationPrompt.ts` — pure function, builds the Hebrew prompt string
- `components/ExplanationCopyButton.tsx` — copy-to-clipboard button with privacy tooltip

### Data types

`QuestionExplanationContext` — see `lib/storage/types.ts`.

---

## Step 12 — Optional Future Cloud Sync

**Status: Not planned. Documented for awareness.**

The local-first architecture is the permanent default. Cloud sync is a potential opt-in for users who want to access their exam library across devices.

### Candidate approaches

| Option | Notes |
|---|---|
| **Supabase** | Open-source; Postgres + Auth + realtime; generous free tier |
| **Firebase Firestore** | Google; easy real-time; 1 GB free storage |
| **Custom backend** | Full control; FastAPI or Next.js API routes; requires hosting |
| **CRDTs (Yjs / Automerge)** | Peer-to-peer sync without central server; complex |

### Design principle

If cloud sync is added, the local IndexedDB copy remains the source of truth and cloud is a mirror. Users who never opt in are unaffected.
