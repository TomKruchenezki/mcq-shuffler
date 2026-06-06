import { describe, it, expect } from 'vitest'
import { rtlFixtures } from '@/fixtures/rtlFixtures'
import { containsHebrew, textDirection } from '@/lib/rtl/rtlUtils'

describe('rtlFixtures — data integrity', () => {
  it('exports exactly 3 questions', () => {
    expect(rtlFixtures).toHaveLength(3)
  })

  it('each question has exactly 4 options', () => {
    for (const q of rtlFixtures) {
      expect(q.options).toHaveLength(4)
    }
  })

  it('no question text or option is an empty string', () => {
    for (const q of rtlFixtures) {
      expect(q.text.trim()).not.toBe('')
      for (const opt of q.options) {
        expect(opt.trim()).not.toBe('')
      }
    }
  })

  it('fixture 1 text contains getUserName', () => {
    expect(rtlFixtures[0].text).toContain('getUserName')
  })

  it('fixture 1 text contains user_id=123', () => {
    expect(rtlFixtures[0].text).toContain('user_id=123')
  })

  it('fixture 1 option[0] is correct', () => {
    expect(rtlFixtures[0].options[0]).toBe('היא מחזירה string תקין')
  })

  it('fixture 1 option[2] is correct', () => {
    expect(rtlFixtures[0].options[2]).toBe('היא זורקת Exception')
  })

  it('fixture 2 text contains accuracy=95%', () => {
    expect(rtlFixtures[1].text).toContain('accuracy=95%')
  })

  it('fixture 2 text contains precision=80%', () => {
    expect(rtlFixtures[1].text).toContain('precision=80%')
  })

  it('fixture 3 option[0] is SELECT exactly', () => {
    expect(rtlFixtures[2].options[0]).toBe('SELECT * FROM users WHERE id = 5')
  })

  it('fixture 3 option[1] is DELETE exactly', () => {
    expect(rtlFixtures[2].options[1]).toBe('DELETE FROM users WHERE id = 5')
  })

  it('fixture 3 option[2] is UPDATE exactly', () => {
    expect(rtlFixtures[2].options[2]).toBe('UPDATE users SET id = 5')
  })

  it('fixture 3 option[3] is INSERT exactly', () => {
    expect(rtlFixtures[2].options[3]).toBe('INSERT INTO users(id) VALUES(5)')
  })
})

describe('rtlFixtures — bidi detection', () => {
  it('all question texts contain Hebrew', () => {
    for (const q of rtlFixtures) {
      expect(containsHebrew(q.text)).toBe(true)
    }
  })

  it('textDirection returns rtl for all question texts', () => {
    for (const q of rtlFixtures) {
      expect(textDirection(q.text)).toBe('rtl')
    }
  })

  it('fixture 1 option[0] contains Hebrew (mixed Hebrew+English)', () => {
    expect(containsHebrew(rtlFixtures[0].options[0])).toBe(true)
  })

  it('fixture 3 SQL options do not contain Hebrew (pure LTR)', () => {
    for (const opt of rtlFixtures[2].options) {
      expect(containsHebrew(opt)).toBe(false)
    }
  })

  it('textDirection for SQL option is ltr', () => {
    expect(textDirection('SELECT * FROM users WHERE id = 5')).toBe('ltr')
  })
})
