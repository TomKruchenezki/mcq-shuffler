import { describe, it, expect } from 'vitest'
import { shuffleArray, shuffleOptions } from '@/lib/shuffle/shuffleOptions'

// Deterministic LCG for reproducible test shuffles
function makeLcg(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('shuffleArray', () => {
  it('returns a new array with the same elements', () => {
    const arr = ['א', 'ב', 'ג', 'ד']
    const result = shuffleArray(arr)
    expect(result).toHaveLength(arr.length)
    expect([...result].sort()).toEqual([...arr].sort())
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3]
    const copy = [...arr]
    shuffleArray(arr)
    expect(arr).toEqual(copy)
  })

  it('produces the same result for the same seed', () => {
    const a = shuffleArray([1, 2, 3, 4], makeLcg(42))
    const b = shuffleArray([1, 2, 3, 4], makeLcg(42))
    expect(a).toEqual(b)
  })

  it('returns a single-element array unchanged', () => {
    expect(shuffleArray(['only'])).toEqual(['only'])
  })

  it('returns an empty array unchanged', () => {
    expect(shuffleArray([])).toEqual([])
  })
})

describe('shuffleOptions', () => {
  it('contains all original options', () => {
    const options = ['נכון', 'לא נכון', 'אולי', 'תלוי']
    const { shuffled } = shuffleOptions(options)
    expect([...shuffled].sort()).toEqual([...options].sort())
  })

  it('tracks the correct answer (original index 0)', () => {
    const options = ['נכון', 'לא נכון', 'אולי']
    const { shuffled, answerKeyIndex } = shuffleOptions(options)
    expect(shuffled[answerKeyIndex]).toBe('נכון')
  })

  it('answerKeyIndex points to the original first option', () => {
    // Force a known shuffle order with seeded rng
    const { shuffled, answerKeyIndex } = shuffleOptions(['A', 'B', 'C', 'D'], makeLcg(7))
    expect(shuffled[answerKeyIndex]).toBe('A')
  })

  it('handles empty options', () => {
    const { shuffled, answerKeyIndex } = shuffleOptions([])
    expect(shuffled).toEqual([])
    expect(answerKeyIndex).toBe(-1)
  })

  it('handles a single option', () => {
    const { shuffled, answerKeyIndex } = shuffleOptions(['בלעדי'])
    expect(shuffled).toEqual(['בלעדי'])
    expect(answerKeyIndex).toBe(0)
  })
})
