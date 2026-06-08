import { describe, it, expect } from 'vitest'
import { normalizePdfText } from '@/lib/extract/pdfNormalize'

// Helper: normalize a single page
function norm(text: string): string {
  return normalizePdfText([text])[0]
}

describe('normalizePdfText — reversed question markers', () => {
  it(':2 שאלה מספר → שאלה מספר 2', () => {
    const result = norm(':2 שאלה מספר\nא. כן\nב. לא')
    expect(result).toContain('שאלה מספר 2')
  })

  it(':29 שאלה מספר → שאלה מספר 29', () => {
    expect(norm(':29 שאלה מספר')).toContain('שאלה מספר 29')
  })

  it('2: שאלה מספר → שאלה מספר 2', () => {
    expect(norm('2: שאלה מספר')).toContain('שאלה מספר 2')
  })

  it(':2 שאלה מספר with trailing text splits into two lines', () => {
    const lines = norm(':2 שאלה מספר בהינתן הגרף הבא').split('\n').filter(Boolean)
    expect(lines[0]).toBe('שאלה מספר 2')
    expect(lines[1]).toBe('בהינתן הגרף הבא')
  })

  it('mid-line reversed marker: header prefix filtered, question line preserved', () => {
    // "עמוד 5 מתוך 11" is a known header → filtered out after split
    const result = norm('עמוד 5 מתוך 11 :2 שאלה מספר')
    const lines = result.split('\n').filter(Boolean)
    expect(lines).toContain('שאלה מספר 2')
    expect(result).not.toContain('עמוד 5 מתוך 11')
  })

  it('normal forward question marker unchanged', () => {
    expect(norm('שאלה מספר 5\nא. כן')).toContain('שאלה מספר 5')
  })
})

describe('normalizePdfText — header/footer removal', () => {
  it('עמוד N מתוך M removed (with spaces)', () => {
    const result = norm('עמוד 3 מתוך 10\nשאלה 1\nא. כן')
    expect(result).not.toContain('עמוד 3 מתוך 10')
    expect(result).toContain('שאלה 1')
  })

  it('עמודNמתוךM removed (no spaces — via digit-Hebrew spacing then header pattern)', () => {
    const result = norm('עמוד5מתוך11\nשאלה 1')
    expect(result).not.toMatch(/עמוד\s*5/)
    expect(result).toContain('שאלה 1')
  })

  it('question line not removed as header', () => {
    const result = norm('שאלה מספר 5\nמה הפלט?')
    expect(result).toContain('שאלה מספר 5')
  })

  it('option line not removed as header', () => {
    expect(norm('א. תשובה נכונה')).toContain('א. תשובה נכונה')
  })

  it('repeated line on multiple pages removed from all pages', () => {
    const result = normalizePdfText([
      'כותרת מבחן\nשאלה 1',
      'כותרת מבחן\nשאלה 2',
      'כותרת מבחן\nשאלה 3',
    ])
    for (const page of result) {
      expect(page).not.toContain('כותרת מבחן')
    }
  })
})

describe('normalizePdfText — digit-Hebrew spacing', () => {
  it('inserts space between Hebrew letter and adjacent digit', () => {
    // "שאלה5" → "שאלה 5" (the whole word should get spaced)
    const result = norm('שאלה5\nא. כן')
    expect(result).toContain('שאלה 5')
  })
})

describe('normalizePdfText — option label flip', () => {
  it('text .א → א. text', () => {
    expect(norm('תשובה .א').trim()).toBe('א. תשובה')
  })

  it('text .ב → ב. text', () => {
    expect(norm('תשובה שנייה .ב').trim()).toBe('ב. תשובה שנייה')
  })
})

describe('normalizePdfText — forward marker splitting', () => {
  it('"ו. / שאלה מספר 3 text" produces "ו." then "שאלה מספר 3 text" on separate lines', () => {
    const lines = norm('ו. / שאלה מספר 3 מה מהבאים נכון?').split('\n').filter(Boolean)
    expect(lines[0]).toBe('ו.')
    // The question line may start with a ZWSP marker — strip for comparison
    const qLine = lines[1]!.replace(/^​/, '')
    expect(qLine).toBe('שאלה מספר 3 מה מהבאים נכון?')
  })

  it('"/ שאלה מספר 0 text" (slash-only prefix) — not split because RE_FORWARD_SLASH requires a real prefix', () => {
    const lines = norm('/ שאלה מספר 0 טקסט').split('\n').filter(Boolean)
    // No real content before the slash — regex requires (.*?\S) to match at least one non-space char
    // before the slash, so this line is not split and stays unchanged
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('/ שאלה מספר 0 טקסט')
  })

  it('"specificity = 70% / שאלה מספר 70%" does NOT split due to percentage lookahead', () => {
    const input = 'specificity = 70% / שאלה מספר 70%'
    const result = norm(input)
    // The whole line should remain intact (no split on the % context)
    const lines = result.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('70%')
  })
})
