/**
 * tests/realPdfPatterns.test.ts
 *
 * Sanitized regression tests for failure patterns found in real Hebrew exam PDFs.
 * ALL tests use tiny fabricated snippets — NO real exam content is committed here.
 * These tests run in every CI environment without any PDF fixture files.
 *
 * Patterns covered:
 *   - Embedded question markers after slash options ("ו. / שאלה מספר N text")
 *   - Decimal false positives (".70%", ".95%", ".2%")
 *   - Formula/variable text in option or question body (K=3, n=77, d=23)
 *   - Valid question markers still work (שאלה מספר 29)
 *   - PPV/statistics snippet stays in one question
 *   - Missing visual content detection (graph, diagram, table)
 *   - RTL/Hebrew text with parenthetical Latin phrases — no Unicode injection
 *   - No directional Unicode marks injected by normalization
 */

import { describe, it, expect } from 'vitest'
import { parseExam } from '@/lib/parser/parseQuestions'
import { normalizePdfText } from '@/lib/extract/pdfNormalize'

describe('Real-PDF failure patterns — sanitized regression', () => {

  // ── 1. Embedded slash marker splits into two questions ────────────────────

  it('1: "ו. / שאלה מספר N text" on one line is split into two questions', () => {
    // "ו. / שאלה מספר 2 ..." on a single PDF-extracted line.
    // normalizePdfText detects the embedded marker and splits the line.
    const pages = [
      [
        'שאלה מספר 1',
        'שאלה ראשונה',
        'א. כן',
        'ב. לא',
        'ג. אולי',
        'ד. לא ברור',
        'ה. תלוי',
        'ו. / שאלה מספר 2 שאלה שניה',  // embedded marker on same line as option ו
      ].join('\n'),
    ]
    const normalized = normalizePdfText(pages)
    const exam = parseExam(normalized.join('\n\n'))
    expect(exam.questions).toHaveLength(2)
    expect(exam.questions[0]!.number).toBe(1)
    expect(exam.questions[1]!.number).toBe(2)
    // The second question was auto-split from an embedded marker
    expect(exam.questions[1]!.splitFromEmbedded).toBe(true)
  })

  // ── 2. Multi-line "ו. /" then "שאלה מספר 0" on the next line ─────────────

  it('2: "ו. /" on one line and "שאלה מספר 0" on the next creates a suspicious-number question', () => {
    // When the "/" and question marker are on SEPARATE PDF-extracted lines,
    // the parser directly sees the question marker and creates question 0.
    const rawText = [
      'שאלה מספר 1',
      'שאלה ראשונה',
      'א. כן',
      'ב. לא',
      'ג. אולי',
      'ד. לא ברור',
      'ה. תלוי',
      'ו. /',              // option ו with text "/" — slash alone, no question marker
      'שאלה מספר 0',      // question number 0 on next line
      'טקסט שאלה חשודה',
      'א. כן',
      'ב. לא',
    ].join('\n')
    const exam = parseExam(rawText)
    const q0 = exam.questions.find(q => q.number === 0)
    expect(q0).toBeDefined()
    expect(q0!.status).toBe('suspicious-number')
  })

  // ── 3. ".70%" — decimal false positive guard ──────────────────────────────

  it('3: ".70%" at line start does NOT create question 70', () => {
    // ".70%" can appear as a PDF-extracted decimal value (e.g. Specificity = .70%)
    // RE_RTL_PERIOD has (?!\s*%) lookahead to prevent this from matching as question 70.
    const rawText = [
      'שאלה מספר 1',
      'ספציפיות הבדיקה:',
      '.70%',               // decimal at line start — must NOT be treated as question 70
      'א. כן',
      'ב. לא',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.number).toBe(1)
    // No phantom question 70
    expect(exam.questions.some(q => q.number === 70)).toBe(false)
  })

  // ── 4. ".95%" — decimal false positive guard ──────────────────────────────

  it('4: ".95%" at line start does NOT create question 95', () => {
    const rawText = [
      'שאלה מספר 1',
      'רגישות:',
      '.95%',               // decimal at line start — must NOT be treated as question 95
      'א. כן',
      'ב. לא',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.number).toBe(1)
    expect(exam.questions.some(q => q.number === 95)).toBe(false)
  })

  // ── 5. ".2%" — single-digit decimal false positive guard ─────────────────

  it('5: ".2%" at line start does NOT create question 2', () => {
    const rawText = [
      'שאלה מספר 1',
      'שיעור שגיאה:',
      '.2%',                // single-digit decimal at line start
      'א. כן',
      'ב. לא',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.number).toBe(1)
    expect(exam.questions.some(q => q.number === 2)).toBe(false)
  })

  // ── 6. "K=3" in option text does NOT create question 3 ───────────────────

  it('6: "K=3" in option text does not create question 3', () => {
    const rawText = [
      'שאלה מספר 1',
      'מה הערך האופטימלי?',
      'א. K=3',             // formula text in option — NOT a question start
      'ב. K=4',
      'ג. K=5',
      'ד. K=6',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions.some(q => q.number === 3)).toBe(false)
  })

  // ── 7. "n=77" in option text does NOT create question 77 ─────────────────

  it('7: "n=77" in option text does not create question 77', () => {
    const rawText = [
      'שאלה מספר 1',
      'מה גודל המדגם?',
      'א. n=77',            // variable assignment in option text
      'ב. n=88',
      'ג. n=99',
      'ד. n=100',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions.some(q => q.number === 77)).toBe(false)
  })

  // ── 8. "d=23" in question body does NOT create question 23 ───────────────

  it('8: "d=23" in question body does not create question 23', () => {
    const rawText = [
      'שאלה מספר 1',
      'נתון: d=23 ו-n=100',  // formula in question body
      'מה הסטיית תקן?',
      'א. 2.3',
      'ב. 4.6',
      'ג. 9.2',
      'ד. 18.4',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions.some(q => q.number === 23)).toBe(false)
    // "d=23" should appear in the question text
    expect(exam.questions[0]!.questionText).toContain('d=23')
  })

  // ── 9. Valid "שאלה מספר 29" still works ──────────────────────────────────

  it('9: "שאלה מספר 29" is correctly parsed as a valid question marker', () => {
    // Guards should not block valid question numbers.
    const rawText = [
      'שאלה מספר 28',
      'שאלה ראשונה',
      'א. כן',
      'ב. לא',
      'שאלה מספר 29',
      'שאלה שניה',
      'א. כן',
      'ב. לא',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(2)
    expect(exam.questions[1]!.number).toBe(29)
    expect(exam.questions[1]!.status).toBe('ok')
    expect(exam.questions[1]!.outputQuestionNumber).toBe(2)
  })

  // ── 10. PPV statistics snippet stays in one question ─────────────────────

  it('10: Sensitivity=95%; Specificity=70% snippet stays inside one question', () => {
    // This fabricated snippet mimics a common Hebrew medical statistics question.
    // Before Part B fix, ".70%" on its own line would have created phantom question 70.
    const rawText = [
      'שאלה מספר 1',
      'נתונים: Sensitivity=95%; Specificity=70%; PPV=0.8',
      'מה הוא ה-NPV המשוקלל?',
      'א. 10%',
      'ב. 20%',
      'ג. 30%',
      'ד. 40%',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.number).toBe(1)
    // No phantom questions from the statistics values
    expect(exam.questions.some(q => q.number === 70)).toBe(false)
    expect(exam.questions.some(q => q.number === 95)).toBe(false)
    // The question text contains the full statistics line
    expect(exam.questions[0]!.questionText).toContain('Specificity=70%')
  })

  // ── 11. "הגרף הבא" marks question as missing-visual-content ──────────────

  it('11: "הגרף הבא" in question text → hasMissingVisualContent: true (no inline code)', () => {
    // "הגרף הבא" appears in both VISUAL_CONTENT_PATTERNS and MISSING_VISUAL_KEYWORDS.
    // No SELECT/FROM/WHERE or {}-code follows → hasMissingVisualContent is true.
    const rawText = [
      'שאלה מספר 1',
      'הגרף הבא מציג תוצאות ניסוי',
      'מה ניתן להסיק?',
      'א. תוצאה א',
      'ב. תוצאה ב',
      'ג. תוצאה ג',
      'ד. תוצאה ד',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.hasVisualContent).toBe(true)
    expect(exam.questions[0]!.hasMissingVisualContent).toBe(true)
  })

  // ── 12. "נתונה הדיאגרמה הבאה" marks question as missing-visual-content ───

  it('12: "נתונה הדיאגרמה הבאה" → hasMissingVisualContent: true', () => {
    // "נתונה הדיאגרמה" matches VISUAL_CONTENT_PATTERNS[0] and
    // "הדיאגרמה" matches MISSING_VISUAL_KEYWORDS[1].
    const rawText = [
      'שאלה מספר 1',
      'נתונה הדיאגרמה הבאה של מסד הנתונים',
      'מה היחס בין הישויות?',
      'א. 1:1',
      'ב. 1:N',
      'ג. N:M',
      'ד. כל התשובות',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.hasVisualContent).toBe(true)
    expect(exam.questions[0]!.hasMissingVisualContent).toBe(true)
  })

  // ── 13. "הטבלה הבאה" marks question as missing-visual-content ─────────────

  it('13: "הטבלה הבאה" → hasMissingVisualContent: true', () => {
    // "הטבלה הבא" (matches "הטבלה הבאה") appears in both
    // VISUAL_CONTENT_PATTERNS[3] and MISSING_VISUAL_KEYWORDS[3].
    const rawText = [
      'שאלה מספר 1',
      'הטבלה הבאה מציגה ביצועי אלגוריתמים',
      'איזה אלגוריתם הכי מהיר?',
      'א. BFS',
      'ב. DFS',
      'ג. Dijkstra',
      'ד. A*',
    ].join('\n')
    const exam = parseExam(rawText)
    expect(exam.questions).toHaveLength(1)
    expect(exam.questions[0]!.hasVisualContent).toBe(true)
    expect(exam.questions[0]!.hasMissingVisualContent).toBe(true)
  })

  // ── 14. Hebrew + Latin parenthetical: no Unicode injection ────────────────

  it('14: Hebrew text with "(K Nearest Neighbors)" stores question text unchanged', () => {
    // Verifies that normalization does NOT inject directional Unicode or alter
    // parenthetical Latin phrases embedded in Hebrew text.
    const pages = [
      [
        'שאלה מספר 1',
        'אלגוריתם KNN (K Nearest Neighbors) משמש לסיווג',
        'כמה שכנים נבחרים?',
        'א. K=1',
        'ב. K=3',
        'ג. K=5',
        'ד. תלוי בבעיה',
      ].join('\n'),
    ]
    const normalized = normalizePdfText(pages)
    const exam = parseExam(normalized.join('\n\n'))
    expect(exam.questions).toHaveLength(1)
    // The parenthetical Latin phrase must survive normalization unchanged
    expect(exam.questions[0]!.questionText).toContain('(K Nearest Neighbors)')
    expect(exam.questions[0]!.questionText).toContain('KNN')
  })

  // ── 15. No directional Unicode marks injected by normalization ────────────

  it('15: normalizePdfText does not inject directional Unicode marks (LRM/RLM/BiDi)', () => {
    // LRM (U+200E), RLM (U+200F), and BiDi controls (U+202A-U+202E, U+2066-U+2069)
    // must never be inserted by our normalizer.
    // Note: ZWSP (U+200B) IS used intentionally as an auto-split marker — excluded here.
    const pages = [
      [
        'שאלה מספר 1',
        'אלגוריתם KNN (K Nearest Neighbors) מסווג לפי מרחק',
        'שאילתת SQL: SELECT name FROM users',
        'א. כן',
        'ב. לא',
        'שאלה מספר 2',
        'ביטוי: f(x) = 2x + 3 לכל x ∈ R',
        'א. נכון',
        'ב. לא נכון',
      ].join('\n'),
    ]
    const normalized = normalizePdfText(pages)
    const fullText = normalized.join('\n')

    // These are directional marks that should NEVER appear in normalized output
    // U+200E=LRM, U+200F=RLM, U+202A-U+202E=BiDi controls, U+2066-U+2069=isolates
    // Build from explicit code points so there are no invisible chars in source.
    const DIRECTIONAL_CODEPOINTS = [
      0x200E, 0x200F,
      0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
      0x2066, 0x2067, 0x2068, 0x2069,
    ]
    const DIRECTIONAL_MARKS = new RegExp(
      DIRECTIONAL_CODEPOINTS.map(cp => String.fromCodePoint(cp)).join('|'),
    )
    expect(DIRECTIONAL_MARKS.test(fullText)).toBe(false)

    // Verify the useful text is still present (normalization did not destroy content)
    expect(fullText).toContain('KNN')
    expect(fullText).toContain('SELECT')
  })

})
