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
