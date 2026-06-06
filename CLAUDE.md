# MCQ Shuffler — CLAUDE.md

MCQ Shuffler is a client-side Hebrew web app that shuffles multiple-choice answer options
while preserving question text and answer text exactly.

---

## Core Invariant

The original **first** answer option in every question is the correct answer.
After shuffling, the app must track where that original first option moved
and generate an answer key.

---

## RTL Rules

These apply to every UI component, parser, and export module.

| Rule |
|---|
| Hebrew RTL is a core requirement, not a styling concern. |
| Never manually reverse Hebrew strings or characters. |
| Never inject hidden Unicode direction marks (U+202A, U+202C, etc.) into stored exam text. |
| Do not modify source question or answer text to fix visual direction. |
| RTL helpers (`wrapLtr`, `.ltr-isolate`) are allowed **only** for UI/display/export rendering. |
| Mixed Hebrew, English, numbers, SQL, formulas, dates, and percentages must remain readable. |
| Use `dir="rtl"` / `dir="auto"` HTML attributes and CSS `unicode-bidi` — never `bidi-override` on mixed content. |

---

## Privacy Rules

| Rule |
|---|
| Client-side only — no backend, no server. |
| No file upload to any external server or API. |
| No external APIs of any kind. |
| No paid AI or LLM calls. |
| Exams are processed locally in the browser only. |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, static export for GitHub Pages)
- **UI:** React 19 + TypeScript (strict) + Tailwind CSS v3
- **Tests:** Vitest + jsdom
- **Libraries (browser-only):** mammoth (DOCX extraction), pdfjs-dist (PDF), docx (DOCX generation)

---

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at localhost:3000
npm test             # run Vitest once
npm run typecheck    # tsc --noEmit (type check only)
npm run build        # static export to out/
```

---

## Workflow Rules

1. **Work in small, focused steps.** Do not implement multiple major features in one change.
2. **After every meaningful change:** run `npm test` and `npm run typecheck`.
3. **Before moving to the next step:** summarize what changed, what was tested, and known limitations.
4. **Mock / fixture data first** — prototype against `fixtures/` before wiring real file input.

---

## Project Subagents

| Agent | When to use |
|---|---|
| `mcq-core-engineer` | Parser contracts, shuffle logic, answer key, invariant review, Step 4+ |
| `hebrew-rtl-reviewer` | Any change touching Hebrew text, RTL rendering, parser text, UI, or export |
| `qa-verifier` | Before completing each step — tests, typecheck, coverage audit |

---

## Phase Order

| Step | Description | Status |
|---|---|---|
| 1 | Scaffold (Next.js, Tailwind, Vitest, folder structure) | Done |
| 2 | Hebrew RTL infrastructure (CSS, fixtures, QuestionCard, FixturePreview) | Done |
| 2.5 | CLAUDE.md + RTL skill | Done |
| 2.6 | GitHub Pages deployment workflow | Done |
| 3 | Plain-text parser (detect questions + options from raw text) | Done |
| 4 | Shuffle logic and answer key | — |
| 5 | UI flow (upload → parse → shuffle → preview) | — |
| 6 | DOCX and CSV export | — |
| 7 | DOCX / PDF file upload | — |
| 8 | GitHub Pages deployment | — |

---

## Where Things Live

| Need | File |
|---|---|
| RTL CSS utilities | `app/globals.css` |
| RTL helper functions | `lib/rtl/rtlUtils.ts` |
| RTL fixture questions | `fixtures/rtlFixtures.ts` |
| Question display components | `components/rtl/` |
| Question type definition | `lib/parser/parseQuestions.ts` |
| Shuffle logic | `lib/shuffle/shuffleOptions.ts` |
| RTL regression tests | `tests/fixtures.test.ts`, `tests/rtl.test.ts` |
| RTL QA workflow | `.claude/skills/hebrew-rtl-qa/SKILL.md` |
