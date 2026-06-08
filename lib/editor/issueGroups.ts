import type { EditableQuestion } from './editableExam'

/**
 * A group of questions that share the same issue type.
 * Used by IssueNavigator to render the repair dashboard.
 */
export interface IssueGroup {
  type: string
  labelHe: string
  questionIds: string[]
  outputNumbers: number[]
}

/**
 * Group questions by issue type.
 * Returns only groups with at least one question.
 * Order matters: most critical issues appear first.
 */
export function groupIssues(questions: EditableQuestion[]): IssueGroup[] {
  function make(
    type: string,
    labelHe: string,
    qs: EditableQuestion[],
  ): IssueGroup {
    return {
      type,
      labelHe,
      questionIds: qs.map(q => q.id),
      outputNumbers: qs.map(q => q.outputQuestionNumber),
    }
  }

  const groups: IssueGroup[] = [
    make(
      'missing-visual',
      'תוכן חזותי/קוד חסר',
      questions.filter(q => q.hasVisualContent && !q.visualImageDataUrl),
    ),
    make(
      'missing-answer',
      'חסרה תשובה נכונה',
      questions.filter(q => q.correctOptionId === null),
    ),
    make(
      'few-options',
      'פחות מ-2 תשובות',
      questions.filter(q => q.options.length < 2),
    ),
    make(
      'suspicious-source',
      'מספר מקור חשוד',
      questions.filter(q => q.reviewStatus === 'suspicious-number'),
    ),
    make(
      'needs-review',
      'דורשות בדיקה',
      questions.filter(q => q.reviewStatus === 'needs-review'),
    ),
  ]

  return groups.filter(g => g.questionIds.length > 0)
}

/**
 * Returns all question IDs that appear in any issue group, in order.
 * Used by IssueNavigator to implement "jump to next issue".
 */
export function allIssueQuestionIds(groups: IssueGroup[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const g of groups) {
    for (const id of g.questionIds) {
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }
  return ids
}
