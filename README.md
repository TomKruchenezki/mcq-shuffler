# MCQ Shuffler

A browser-only web app that shuffles Hebrew multiple-choice exam answer options.  
No backend. No APIs. Files are processed locally in the browser.

**Live site:** https://tomkruchenezki.github.io/mcq-shuffler/

## Features

- Upload DOCX or text-based PDF Hebrew exams, or paste text directly
- Reconstruct Word automatic numbered lists (question numbers + Hebrew labels א. ב. ג.)
- Shuffle answer options per question independently
- Track the correct answer (always option A in the original) → generate an answer key
- Export the shuffled exam as DOCX, answer key as CSV, or print to PDF
- Full Hebrew RTL with mixed English, numbers, code, SQL, and formulas

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

## Tests

```bash
npm test           # run once
npm run test:watch # watch mode
npm run typecheck  # TypeScript type check (tsc --noEmit)
```

## Static build

```bash
npm run build      # outputs to out/
```

## Deploy to GitHub Pages

### First-time setup

1. Create a **public** repository named `mcq-shuffler` at https://github.com/new  
   (no template, no README — push the existing code)

2. Add the remote and push:

   ```bash
   git remote add origin https://github.com/TomKruchenezki/mcq-shuffler.git
   git push -u origin main
   ```

3. In the GitHub repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**

4. The `deploy.yml` workflow triggers automatically on every push to `main`.  
   First deploy takes ~1–2 minutes.

5. Open https://tomkruchenezki.github.io/mcq-shuffler/

### Subsequent deploys

Push to `main`. The workflow runs: typecheck → test → build → deploy.  
You can also trigger it manually from **Actions → Deploy to GitHub Pages → Run workflow**.

### How the basePath works

| Environment | `NEXT_PUBLIC_BASE_PATH` | Result |
|---|---|---|
| Local dev (`npm run dev`) | (not set) | `localhost:3000/` |
| Local build (`npm run build`) | (not set) | `out/` rooted at `/` |
| GitHub Pages build | `/mcq-shuffler` | assets at `/mcq-shuffler/_next/…` |

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Vitest  
mammoth (DOCX extraction) · pdfjs-dist (PDF extraction) · docx (DOCX generation) · jszip (DOCX parsing)

## Privacy

All processing happens locally in your browser.

- Uploaded files are read into memory and processed client-side — they are never sent to any server.
- No backend, no database, no external APIs.
- No AI or cloud services are used.
- No analytics or tracking of any kind.
- Closing the tab discards everything.

## Manual QA Checklist

Run these checks before deploying or releasing.

### Paste text
- [ ] Click "טען דוגמה" → "נתח מבחן" → 3 questions appear in the parse preview
- [ ] Shuffle → answer key table appears with original first option marked correct
- [ ] Export Word — file downloads and opens with RTL text
- [ ] Export CSV — file downloads and opens in Excel with Hebrew column headers
- [ ] Export PDF — browser print dialog opens; save as PDF; output is RTL with no app UI

### DOCX upload
- [ ] Upload a DOCX that uses Word automatic numbered lists (e.g. InfoSystems_MoedA_2025.docx)
- [ ] Questions and Hebrew option labels (א. ב. ג.) appear correctly in the parse preview
- [ ] Shuffle → export Word/CSV/PDF all work

### PDF upload
- [ ] Upload a text-based PDF (exported from Word, not scanned) → questions parse correctly
- [ ] Upload a scanned or image-only PDF → amber warning appears in the upload area

### Answer option counts
- [ ] Exam with 2 options per question → shuffles and exports correctly
- [ ] Exam with 4 options (standard) → works
- [ ] Exam with 6 options → works, labels reach ו
- [ ] Exam with 8 options → works, labels reach ח

### Exports
- [ ] Word export: text is right-to-left, Hebrew labels on right, no answer key
- [ ] CSV export: opens in Excel without garbled Hebrew (UTF-8 BOM present)
- [ ] PDF print: app UI hidden, exam text only, Hebrew RTL, SQL/English readable left-to-right

### Edge cases
- [ ] Mixed Hebrew + English + numbers + SQL in a question → text not reversed or garbled
- [ ] Empty textarea → "נתח מבחן" button is disabled
- [ ] No shuffled exam yet → all three export buttons are disabled
- [ ] "נקה הכל" resets all state and clears preview

## Troubleshooting

**"לא זוהו שאלות" (no questions detected)**  
The parser expects question numbers (`1.`, `2.`, or `שאלה 1`) and Hebrew option labels
(`א.`, `ב.`). If your DOCX uses Word automatic numbering, the app reconstructs these
labels automatically. If you see this error, try pasting the text manually from Word
and check that each question starts with a number and each option starts with `א.` etc.

**"PDF סרוק" warning appears after upload**  
The PDF is image-based (scanned). The app cannot extract text from images. Export the
exam from Word as a PDF, or use the DOCX upload instead.

**DOCX uploaded but questions not detected**  
If the DOCX does not use Word automatic numbered lists, the labels may not be present in
the extracted text. Open the file in Word, select all text, and confirm the numbering
style is "Automatic" (not manually typed). As a workaround, copy–paste the text directly.

**Hebrew text looks reversed or garbled in the export**  
The Word export sets paragraph direction to RTL. If your version of Word or another app
shows text reversed, check that the paragraph direction is set to Right-to-Left
(Format → Paragraph → Direction in Word).

**App works locally but not on GitHub Pages**  
Confirm `NEXT_PUBLIC_BASE_PATH=/mcq-shuffler` is set in the GitHub Actions workflow
(`deploy.yml`). The local build does not set this variable, but the Pages build must.
Check: Settings → Pages → Build and deployment → Source → GitHub Actions.

## Release Checklist

Before pushing a new version to `main`:

- [ ] `npm test` — all tests pass
- [ ] `npm run typecheck` — zero TypeScript errors
- [ ] `npm run build` — static export succeeds
- [ ] Push to `main` → GitHub Actions workflow passes (typecheck + test + build + deploy)
- [ ] Open https://tomkruchenezki.github.io/mcq-shuffler/ and confirm the page loads
- [ ] Run the Manual QA Checklist above with a real Hebrew exam DOCX
- [ ] Confirm Word, CSV, and PDF exports open correctly

## Manual test fixtures

Real exam files for manual testing go in `manual-fixtures/` (gitignored — local only).
Do NOT commit real exam files to this repository.

## Project guidance

**`CLAUDE.md`** (project root) — Project purpose, core invariants, RTL rules, privacy rules,
commands, workflow rules, and phase order. Read this before starting any session.

**`.claude/skills/hebrew-rtl-qa/SKILL.md`** — RTL QA checklist skill. Invoke via
`/hebrew-rtl-qa` whenever changing UI rendering, text preview, parser text handling,
or DOCX export. Verifies RTL layout, mixed-direction text, and that no source text is
modified or reversed.

**`.claude/agents/`** — Three project-specific subagents: `mcq-core-engineer` (core logic invariants),
`hebrew-rtl-reviewer` (RTL and text fidelity), `qa-verifier` (test coverage and build health).

**`.claude/skills/pdf-extraction-qa/SKILL.md`** — PDF extraction QA checklist. Invoke
whenever changing `lib/extract/` files. Covers coordinate-based extraction rules, Hebrew RTL
gap formulas, quality scoring, OCR constraints, visual preservation, and test verification.

**`.claude/agents/pdf-extraction-engineer.md`** — coordinate-aware PDF extraction work
(`pdfLines.ts`, `pdfNormalize.ts`, `extractPdf.ts`). Enforces gap formulas, y-grouping,
header removal safety, and quality scoring.

**`.claude/agents/ocr-browser-engineer.md`** — browser-side OCR for scanned PDFs.
Enforces local/browser-only OCR (no backend, no cloud, no paid AI), scanned-detection gating,
and pipeline integration.

**`.claude/agents/pdf-visual-preservation-reviewer.md`** — read-only reviewer for question
text, option text, and mixed Hebrew-English-SQL content fidelity after PDF extraction or OCR changes.
