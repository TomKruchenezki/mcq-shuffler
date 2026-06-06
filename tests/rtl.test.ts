import { describe, it, expect } from 'vitest'
import { isHebrew, containsHebrew, wrapLtr, textDirection } from '@/lib/rtl/rtlUtils'

describe('isHebrew', () => {
  it('returns true for Hebrew letters', () => {
    expect(isHebrew('א')).toBe(true)
    expect(isHebrew('ש')).toBe(true)
    expect(isHebrew('ת')).toBe(true)
  })

  it('returns false for Latin letters', () => {
    expect(isHebrew('A')).toBe(false)
    expect(isHebrew('z')).toBe(false)
  })

  it('returns false for digits and symbols', () => {
    expect(isHebrew('5')).toBe(false)
    expect(isHebrew('%')).toBe(false)
    expect(isHebrew(' ')).toBe(false)
  })
})

describe('containsHebrew', () => {
  it('returns true for pure Hebrew text', () => {
    expect(containsHebrew('שלום')).toBe(true)
  })

  it('returns true for mixed Hebrew and English text', () => {
    expect(containsHebrew('שלום world')).toBe(true)
  })

  it('returns false for pure English text', () => {
    expect(containsHebrew('SELECT * FROM users')).toBe(false)
  })

  it('returns false for numbers and symbols', () => {
    expect(containsHebrew('100% = 1/1')).toBe(false)
  })
})

describe('wrapLtr', () => {
  it('wraps the text between LTR embedding marks', () => {
    const result = wrapLtr('SELECT')
    expect(result).toContain('SELECT')
    // U+202A LEFT-TO-RIGHT EMBEDDING
    expect(result.charCodeAt(0)).toBe(0x202a)
    // U+202C POP DIRECTIONAL FORMATTING
    expect(result.charCodeAt(result.length - 1)).toBe(0x202c)
  })

  it('preserves the inner text exactly', () => {
    const inner = 'SELECT * FROM users WHERE id = 1'
    const result = wrapLtr(inner)
    expect(result.slice(1, -1)).toBe(inner)
  })
})

describe('textDirection', () => {
  it('returns rtl for Hebrew text', () => {
    expect(textDirection('שלום')).toBe('rtl')
  })

  it('returns ltr for English text', () => {
    expect(textDirection('Hello world')).toBe('ltr')
  })

  it('returns rtl for mixed Hebrew and English', () => {
    expect(textDirection('שלום world')).toBe('rtl')
  })
})
