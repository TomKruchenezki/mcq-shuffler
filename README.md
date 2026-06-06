# MCQ Shuffler

A browser-only web app that shuffles Hebrew multiple-choice exam answer options.  
No backend. No APIs. Files are processed locally in the browser.

## Features (planned)

- Upload DOCX or text-based PDF Hebrew exams
- Shuffle answer options per question independently
- Track the correct answer (always option A in the original) → generate an answer key
- Export the shuffled exam as DOCX
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
```

## Static build

```bash
npm run build      # outputs to out/
```

## GitHub Pages deployment

Set the `NEXT_PUBLIC_BASE_PATH` environment variable to `/mcq-shuffler` in your Actions workflow before building.

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Vitest  
mammoth (DOCX extraction) · pdfjs-dist (PDF extraction) · docx (DOCX generation)
