'use client'

import { useState } from 'react'
import { HEBREW_LABELS } from '@/lib/shuffle/shuffleExam'
import type {
  EditableExam,
  EditableQuestion,
  EditableOption,
  EditableReviewStatus,
} from '@/lib/editor/editableExam'
import {
  addQuestion,
  deleteQuestion,
  duplicateQuestion,
  moveQuestion,
  setCorrectOption,
  addOption,
  deleteOption,
  updateOptionText,
  moveOption,
  resetOutputNumbers,
} from '@/lib/editor/editableExam'

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'mcq-shuffler-draft'

const REVIEW_STATUS_LABELS: Record<EditableReviewStatus, string> = {
  'ok': '✅ תקין',
  'needs-review': '⚠ דורש בדיקה',
  'manually-edited': '✏ נערך ידנית',
  'missing-options': '⚠ חסר תשובות',
  'missing-correct-answer': '❌ אין תשובה נכונה',
  'visual-content': '📊 תוכן חזותי',
  'missing-visual-content': '📊 חסר תוכן חזותי',
  'suspicious-number': '⚠ מספר חשוד',
  'incomplete': '⚠ לא שלם',
}

const REVIEW_STATUS_BADGE: Record<EditableReviewStatus, string> = {
  'ok': 'bg-green-100 text-green-700',
  'needs-review': 'bg-amber-100 text-amber-700',
  'manually-edited': 'bg-blue-100 text-blue-700',
  'missing-options': 'bg-red-100 text-red-700',
  'missing-correct-answer': 'bg-red-100 text-red-700',
  'visual-content': 'bg-orange-100 text-orange-700',
  'missing-visual-content': 'bg-orange-100 text-orange-700',
  'suspicious-number': 'bg-amber-100 text-amber-700',
  'incomplete': 'bg-red-100 text-red-700',
}

// ─── Draft helpers ────────────────────────────────────────────────────────────

function hasDraftInStorage(): boolean {
  try { return localStorage.getItem(DRAFT_KEY) !== null } catch { return false }
}

function saveDraftToStorage(exam: EditableExam): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(exam)) } catch { /* storage full */ }
}

function loadDraftFromStorage(): EditableExam | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EditableExam
  } catch { return null }
}

function deleteDraftFromStorage(): void {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

// ─── ManualExamEditor (main export) ──────────────────────────────────────────

interface Props {
  exam: EditableExam
  onChange: (exam: EditableExam) => void
}

export default function ManualExamEditor({ exam, onChange }: Props) {
  const [draftExists, setDraftExists] = useState(() => hasDraftInStorage())

  function handleSaveDraft() {
    saveDraftToStorage(exam)
    setDraftExists(true)
  }

  function handleLoadDraft() {
    const draft = loadDraftFromStorage()
    if (draft) onChange(draft)
  }

  function handleDeleteDraft() {
    if (!window.confirm('למחוק את הטיוטה השמורה?')) return
    deleteDraftFromStorage()
    setDraftExists(false)
  }

  function handleMarkAllReviewed() {
    onChange({
      questions: exam.questions.map(q =>
        q.reviewStatus === 'needs-review' ? { ...q, reviewStatus: 'ok' } : q,
      ),
    })
  }

  return (
    <section className="my-6 space-y-4" dir="rtl">
      {/* Section heading */}
      <h2 className="text-xl font-bold text-gray-800">
        עריכה ידנית לפני ערבוב
        <span className="text-sm font-normal text-gray-500 mr-2">
          — {exam.questions.length} שאלות
        </span>
      </h2>

      {/* Global action bar */}
      <div className="flex gap-2 flex-wrap text-sm">
        <button
          type="button"
          onClick={() => onChange(addQuestion(exam))}
          className="px-3 py-1.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          + הוסף שאלה
        </button>
        <button
          type="button"
          onClick={() => onChange({ questions: resetOutputNumbers(exam.questions) })}
          className="px-3 py-1.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          אפס מספור
        </button>
        <button
          type="button"
          onClick={handleMarkAllReviewed}
          className="px-3 py-1.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          סמן הכל כבדוק
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          className="px-3 py-1.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          שמור טיוטה
        </button>
        {draftExists && (
          <>
            <button
              type="button"
              onClick={handleLoadDraft}
              className="px-3 py-1.5 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              טען טיוטה
            </button>
            <button
              type="button"
              onClick={handleDeleteDraft}
              className="px-3 py-1.5 rounded-lg font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              מחק טיוטה
            </button>
          </>
        )}
      </div>

      {/* Question cards */}
      {exam.questions.map((q, qIdx) => (
        <QuestionCard
          key={q.id}
          question={q}
          qIdx={qIdx}
          total={exam.questions.length}
          onChange={updatedQ =>
            onChange({
              questions: exam.questions.map(x => (x.id === updatedQ.id ? updatedQ : x)),
            })
          }
          onDelete={() => {
            if (window.confirm('למחוק שאלה זו? לא ניתן לבטל פעולה זו.')) {
              onChange(deleteQuestion(exam, q.id))
            }
          }}
          onDuplicate={() => onChange(duplicateQuestion(exam, q.id))}
          onMoveUp={() => onChange(moveQuestion(exam, q.id, 'up'))}
          onMoveDown={() => onChange(moveQuestion(exam, q.id, 'down'))}
          onAddOption={() => onChange(addOption(exam, q.id))}
          onDeleteOption={optId => onChange(deleteOption(exam, q.id, optId))}
          onMoveOption={(optId, dir) => onChange(moveOption(exam, q.id, optId, dir))}
          onSetCorrect={optId => onChange(setCorrectOption(exam, q.id, optId))}
          onUpdateOptionText={(optId, text) => onChange(updateOptionText(exam, q.id, optId, text))}
        />
      ))}

      {exam.questions.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-6">
          אין שאלות — לחץ על &ldquo;הוסף שאלה&rdquo; להוספה ידנית.
        </p>
      )}
    </section>
  )
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: EditableQuestion
  qIdx: number
  total: number
  onChange: (q: EditableQuestion) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddOption: () => void
  onDeleteOption: (optId: string) => void
  onMoveOption: (optId: string, dir: 'up' | 'down') => void
  onSetCorrect: (optId: string) => void
  onUpdateOptionText: (optId: string, text: string) => void
}

function QuestionCard({
  question: q,
  qIdx,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAddOption,
  onDeleteOption,
  onMoveOption,
  onSetCorrect,
  onUpdateOptionText,
}: QuestionCardProps) {
  const [showNotes, setShowNotes] = useState(false)

  const noCorrectAnswer =
    q.correctOptionId === null || !q.options.some(o => o.id === q.correctOptionId)

  function handleTextChange(text: string) {
    const reviewStatus = q.reviewStatus === 'ok' ? 'manually-edited' : q.reviewStatus
    onChange({ ...q, text, reviewStatus })
  }

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-gray-500 text-sm" htmlFor={`qnum-${q.id}`}>שאלה</label>
        <input
          id={`qnum-${q.id}`}
          type="number"
          min={1}
          value={q.outputQuestionNumber}
          onChange={e =>
            onChange({ ...q, outputQuestionNumber: Math.max(1, Number(e.target.value) || 1) })
          }
          className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-sm text-center"
          aria-label="מספר שאלה"
        />
        {q.sourceQuestionNumber !== undefined &&
          q.sourceQuestionNumber !== q.outputQuestionNumber && (
            <span className="text-xs text-gray-400">(מקור: {q.sourceQuestionNumber})</span>
          )}

        {/* Status badge */}
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${REVIEW_STATUS_BADGE[q.reviewStatus]}`}
        >
          {REVIEW_STATUS_LABELS[q.reviewStatus]}
        </span>

        {/* No-correct-answer warning */}
        {noCorrectAnswer && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            ❌ אין תשובה נכונה
          </span>
        )}

        {/* Action buttons (push to left) */}
        <div className="flex gap-1 mr-auto">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={qIdx === 0}
            title="הזז למעלה"
            aria-label="הזז שאלה למעלה"
            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >↑</button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={qIdx === total - 1}
            title="הזז למטה"
            aria-label="הזז שאלה למטה"
            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >↓</button>
          <button
            type="button"
            onClick={onDuplicate}
            title="שכפל שאלה"
            aria-label="שכפל שאלה"
            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 transition-colors"
          >⧉</button>
          <button
            type="button"
            onClick={onDelete}
            title="מחק שאלה"
            aria-label="מחק שאלה"
            className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
          >🗑</button>
        </div>
      </div>

      {/* ── Question text ───────────────────────────────────────────────────── */}
      <textarea
        value={q.text}
        onChange={e => handleTextChange(e.target.value)}
        dir="auto"
        rows={3}
        placeholder="טקסט השאלה..."
        style={{ unicodeBidi: 'plaintext', whiteSpace: 'pre-wrap' }}
        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
        aria-label={`טקסט שאלה ${q.outputQuestionNumber}`}
      />

      {/* ── Status + notes toggle ───────────────────────────────────────────── */}
      <div className="flex gap-3 items-center text-sm flex-wrap">
        <select
          value={q.reviewStatus}
          onChange={e => onChange({ ...q, reviewStatus: e.target.value as EditableReviewStatus })}
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          aria-label="סטטוס בדיקה"
        >
          {(Object.keys(REVIEW_STATUS_LABELS) as EditableReviewStatus[]).map(s => (
            <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNotes(n => !n)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {showNotes ? '▲ הסתר הערות' : '▼ הוסף הערה'}
        </button>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      {showNotes && (
        <textarea
          value={q.notes ?? ''}
          onChange={e => onChange({ ...q, notes: e.target.value })}
          dir="auto"
          rows={2}
          placeholder="הערות על שאלה זו (לא יופיעו בפלט)..."
          className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      )}

      {/* ── Options ────────────────────────────────────────────────────────── */}
      <ol className="space-y-2 list-none p-0 m-0">
        {q.options.map((opt, optIdx) => (
          <OptionRow
            key={opt.id}
            option={opt}
            optIdx={optIdx}
            totalOptions={q.options.length}
            isCorrect={q.correctOptionId === opt.id}
            radioGroupName={`correct-${q.id}`}
            onSetCorrect={() => onSetCorrect(opt.id)}
            onUpdateText={text => onUpdateOptionText(opt.id, text)}
            onMoveUp={() => onMoveOption(opt.id, 'up')}
            onMoveDown={() => onMoveOption(opt.id, 'down')}
            onDelete={() => onDeleteOption(opt.id)}
            canDelete={q.options.length > 1}
          />
        ))}
      </ol>

      {/* ── Add option ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onAddOption}
        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        + הוסף תשובה
      </button>
    </article>
  )
}

// ─── OptionRow ────────────────────────────────────────────────────────────────

interface OptionRowProps {
  option: EditableOption
  optIdx: number
  totalOptions: number
  isCorrect: boolean
  radioGroupName: string
  onSetCorrect: () => void
  onUpdateText: (text: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  canDelete: boolean
}

function OptionRow({
  option: opt,
  optIdx,
  totalOptions,
  isCorrect,
  radioGroupName,
  onSetCorrect,
  onUpdateText,
  onMoveUp,
  onMoveDown,
  onDelete,
  canDelete,
}: OptionRowProps) {
  const label = HEBREW_LABELS[optIdx] ?? String(optIdx + 1)

  return (
    <li className="flex items-center gap-2">
      {/* Correct-answer radio */}
      <input
        type="radio"
        name={radioGroupName}
        checked={isCorrect}
        onChange={onSetCorrect}
        className="flex-shrink-0 accent-green-600"
        title="סמן כתשובה נכונה"
        aria-label={`תשובה נכונה — ${label}`}
      />

      {/* Hebrew label (computed from position, read-only) */}
      <span className="flex-shrink-0 font-medium text-gray-500 w-5 text-center select-none text-sm">
        {label}.
      </span>

      {/* Option text input */}
      <input
        type="text"
        value={opt.text}
        onChange={e => onUpdateText(e.target.value)}
        dir="auto"
        placeholder={`תשובה ${label}...`}
        style={{ unicodeBidi: 'plaintext' }}
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
        aria-label={`טקסט תשובה ${label}`}
      />

      {/* Move up/down */}
      <button
        type="button"
        onClick={onMoveUp}
        disabled={optIdx === 0}
        title="הזז למעלה"
        aria-label={`הזז תשובה ${label} למעלה`}
        className="px-1.5 py-0.5 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
      >↑</button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={optIdx === totalOptions - 1}
        title="הזז למטה"
        aria-label={`הזז תשובה ${label} למטה`}
        className="px-1.5 py-0.5 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
      >↓</button>

      {/* Delete option */}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="מחק תשובה"
          aria-label={`מחק תשובה ${label}`}
          className="px-1.5 py-0.5 text-xs rounded bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
        >✕</button>
      )}
    </li>
  )
}
