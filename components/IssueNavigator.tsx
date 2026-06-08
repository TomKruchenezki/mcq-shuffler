'use client'

import { useRef } from 'react'
import { groupIssues, allIssueQuestionIds } from '@/lib/editor/issueGroups'
import type { EditableQuestion } from '@/lib/editor/editableExam'

interface Props {
  questions: EditableQuestion[]
}

/**
 * Issue navigator panel — shown above the ManualExamEditor question list.
 * Groups questions by issue type and provides scroll-to links and a
 * "jump to next issue" button.
 */
export function IssueNavigator({ questions }: Props) {
  const groups = groupIssues(questions)
  const nextIdxRef = useRef(0)

  if (groups.length === 0) {
    return (
      <p
        dir="rtl"
        data-testid="issue-navigator-clean"
        className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3"
      >
        ✅ אין בעיות שדורשות בדיקה
      </p>
    )
  }

  const allIds = allIssueQuestionIds(groups)
  const totalIssues = allIds.length

  function scrollToQuestion(id: string) {
    document
      .getElementById(`question-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleJumpNext() {
    if (allIds.length === 0) return
    const idx = nextIdxRef.current % allIds.length
    scrollToQuestion(allIds[idx]!)
    nextIdxRef.current = idx + 1
  }

  return (
    <div
      dir="rtl"
      data-testid="issue-navigator"
      className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-amber-800 text-sm">
          בעיות שדורשות בדיקה
          <span className="font-normal text-amber-600 mr-1">({totalIssues})</span>
        </h3>
        <button
          type="button"
          onClick={handleJumpNext}
          className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-lg transition-colors"
        >
          עבור לבעיה הבאה ↓
        </button>
      </div>

      <div className="space-y-1.5">
        {groups.map(g => (
          <div key={g.type} className="text-sm flex flex-wrap items-baseline gap-1">
            <span className="font-medium text-amber-700 ml-1">
              {g.labelHe} ({g.questionIds.length}):
            </span>
            {g.outputNumbers.map((n, i) => (
              <button
                key={g.questionIds[i]}
                type="button"
                onClick={() => scrollToQuestion(g.questionIds[i]!)}
                className="underline text-amber-600 hover:text-amber-800 transition-colors"
                aria-label={`עבור לשאלה ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
