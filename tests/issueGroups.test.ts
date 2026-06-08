import { describe, it, expect } from 'vitest'
import { groupIssues, allIssueQuestionIds } from '@/lib/editor/issueGroups'
import type { EditableQuestion } from '@/lib/editor/editableExam'

function makeQ(overrides: Partial<EditableQuestion>): EditableQuestion {
  return {
    id: crypto.randomUUID(),
    outputQuestionNumber: 1,
    sequenceIndex: 0,
    text: 'שאלה לדוגמה',
    options: [
      { id: 'opt1', text: 'א' },
      { id: 'opt2', text: 'ב' },
      { id: 'opt3', text: 'ג' },
      { id: 'opt4', text: 'ד' },
    ],
    correctOptionId: 'opt1',
    reviewStatus: 'ok',
    hasVisualContent: false,
    ...overrides,
  }
}

describe('groupIssues', () => {
  it('returns empty array when all questions are ok', () => {
    const qs = [
      makeQ({ outputQuestionNumber: 1 }),
      makeQ({ outputQuestionNumber: 2 }),
    ]
    expect(groupIssues(qs)).toEqual([])
  })

  it('groups questions with hasVisualContent=true and no visualImageDataUrl as missing-visual', () => {
    const qs = [
      makeQ({ outputQuestionNumber: 1, hasVisualContent: true, visualImageDataUrl: undefined }),
      makeQ({ outputQuestionNumber: 2 }),
    ]
    const groups = groupIssues(qs)
    const g = groups.find(g => g.type === 'missing-visual')
    expect(g).toBeDefined()
    expect(g!.questionIds).toHaveLength(1)
    expect(g!.outputNumbers).toEqual([1])
  })

  it('does NOT include visual question that has an image in missing-visual', () => {
    const qs = [
      makeQ({
        outputQuestionNumber: 1,
        hasVisualContent: true,
        visualImageDataUrl: 'data:image/png;base64,abc',
      }),
    ]
    expect(groupIssues(qs)).toEqual([])
  })

  it('groups questions with reviewStatus=suspicious-number as suspicious-source', () => {
    const qs = [
      makeQ({ outputQuestionNumber: 3, reviewStatus: 'suspicious-number', sourceQuestionNumber: 99 }),
      makeQ({ outputQuestionNumber: 4 }),
    ]
    const groups = groupIssues(qs)
    const g = groups.find(g => g.type === 'suspicious-source')
    expect(g).toBeDefined()
    expect(g!.questionIds).toHaveLength(1)
    expect(g!.outputNumbers).toEqual([3])
  })

  it('groups questions with correctOptionId=null as missing-answer', () => {
    const qs = [
      makeQ({ outputQuestionNumber: 2, correctOptionId: null }),
    ]
    const groups = groupIssues(qs)
    const g = groups.find(g => g.type === 'missing-answer')
    expect(g).toBeDefined()
    expect(g!.questionIds).toHaveLength(1)
  })
})

describe('allIssueQuestionIds', () => {
  it('deduplicates a question that appears in multiple groups', () => {
    // A question with correctOptionId=null AND suspicious-number appears in both groups
    const q = makeQ({ reviewStatus: 'suspicious-number', correctOptionId: null })
    const groups = groupIssues([q])
    const ids = allIssueQuestionIds(groups)
    // Should appear once even if in two groups
    const count = ids.filter(id => id === q.id).length
    expect(count).toBe(1)
  })

  it('returns empty array for no groups', () => {
    expect(allIssueQuestionIds([])).toEqual([])
  })
})
