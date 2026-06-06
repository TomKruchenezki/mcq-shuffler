import { describe, it, expect } from 'vitest'
import { parseQuestions } from '@/lib/parser/parseQuestions'

describe('parseQuestions (stub)', () => {
  it('returns an empty array for empty input', () => {
    expect(parseQuestions('')).toEqual([])
  })

  it('returns an empty array for any input until implemented', () => {
    const sample = '1. מה זה?\nא. כן\nב. לא\nג. אולי\nד. לא יודע'
    expect(parseQuestions(sample)).toEqual([])
  })
})
