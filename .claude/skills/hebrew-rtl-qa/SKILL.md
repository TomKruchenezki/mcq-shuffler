# Skill: hebrew-rtl-qa

## When to Use

Invoke this skill whenever a change may affect Hebrew RTL rendering or text fidelity:

- UI rendering or Tailwind class changes in any component
- Text preview or QuestionCard changes
- Parser or text-extraction changes (even whitespace trimming)
- DOCX / CSV export changes
- Any change that touches question text, option text, or directionality

## RTL QA Checklist

Work through each item in order. Do not mark a step done until verified.

- [ ] `<html lang="he" dir="rtl">` is present in `app/layout.tsx`
- [ ] Body has `direction: rtl; text-align: start` in `app/globals.css`
- [ ] Main containers use RTL flex/flow layout (labels on the right)
- [ ] Mixed Hebrew + English + numbers example renders naturally (no garbled order)
- [ ] SQL / code snippets remain readable left-to-right inside Hebrew text
- [ ] No source question or option text has been reversed or modified
- [ ] No hidden Unicode direction marks (U+202A / U+202C) inserted into stored text
- [ ] `wrapLtr()` and `.ltr-isolate` are used only in rendering/export paths, never in stored data
- [ ] Parser / export code preserves exact source text (round-trip test if applicable)
- [ ] Test suite includes cases with Hebrew + English + numbers + SQL
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes

## Key Files

- `lib/rtl/rtlUtils.ts` — `isHebrew`, `containsHebrew`, `wrapLtr`, `textDirection`
- `app/globals.css` — `.ltr-isolate`, `code`/`pre` LTR rules
- `fixtures/rtlFixtures.ts` — 3 regression fixtures (Hebrew + SQL + mixed)
- `tests/rtl.test.ts`, `tests/fixtures.test.ts` — RTL regression tests
