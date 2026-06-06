import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExtractRawText = vi.hoisted(() => vi.fn())

vi.mock('mammoth', () => ({
  extractRawText: mockExtractRawText,
  default: { extractRawText: mockExtractRawText },
}))

import { extractDocxText } from '@/lib/extract/extractDocx'

describe('extractDocxText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns extracted text on success', async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: 'שאלה 1\nא. כן\nב. לא', messages: [] })
    const result = await extractDocxText(new ArrayBuffer(8))
    expect(result.text).toBe('שאלה 1\nא. כן\nב. לא')
    expect(result.error).toBeUndefined()
  })

  it('returns Hebrew error message on failure', async () => {
    mockExtractRawText.mockRejectedValueOnce(new Error('corrupted file'))
    const result = await extractDocxText(new ArrayBuffer(8))
    expect(result.text).toBe('')
    expect(result.error).toContain('Word')
  })
})
