# MCQ Shuffler

A browser-only web app that shuffles Hebrew multiple-choice exam answer options.  
No backend. No APIs. Files are processed locally in the browser.

**Live site:** https://tomkruchenezki.github.io/mcq-shuffler/

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
mammoth (DOCX extraction) · pdfjs-dist (PDF extraction) · docx (DOCX generation)

## Project guidance

**`CLAUDE.md`** (project root) — Project purpose, core invariants, RTL rules, privacy rules,
commands, workflow rules, and phase order. Read this before starting any session.

**`.claude/skills/hebrew-rtl-qa/SKILL.md`** — RTL QA checklist skill. Invoke via
`/hebrew-rtl-qa` whenever changing UI rendering, text preview, parser text handling,
or DOCX export. Verifies RTL layout, mixed-direction text, and that no source text is
modified or reversed.

**`.claude/agents/`** — Three project-specific subagents: `mcq-core-engineer` (core logic invariants),
`hebrew-rtl-reviewer` (RTL and text fidelity), `qa-verifier` (test coverage and build health).
