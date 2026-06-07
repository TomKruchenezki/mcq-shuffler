'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDb } from '@/lib/storage/db'
import { renameExam, deleteExam, duplicateExam } from '@/lib/storage/examStore'
import type { StoredExam, ExamStatus, ExamSourceType } from '@/lib/storage/types'

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ExamStatus, string> = {
  draft: 'טיוטה',
  parsed: 'נותח',
  edited: 'נערך',
  shuffled: 'עורבב',
  practice: 'תרגול',
}

const STATUS_COLORS: Record<ExamStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  parsed: 'bg-blue-100 text-blue-600',
  edited: 'bg-amber-100 text-amber-600',
  shuffled: 'bg-green-100 text-green-600',
  practice: 'bg-purple-100 text-purple-600',
}

const SOURCE_ICONS: Record<ExamSourceType, string> = {
  paste: '📋',
  docx: '📄',
  pdf: '📑',
  manual: '✏️',
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExamLibraryProps {
  currentExamId: string | null
  onLoad: (exam: StoredExam) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExamLibrary({ currentExamId, onLoad }: ExamLibraryProps) {
  const exams = useLiveQuery(
    () => getDb().exams.orderBy('updatedAt').reverse().toArray(),
    [],
  )

  const [isOpen, setIsOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // ── Handlers ──────────────────────────────────────────────────────────────

  function startRename(exam: StoredExam) {
    setEditingId(exam.id)
    setEditingTitle(exam.title)
  }

  async function commitRename(id: string) {
    const trimmed = editingTitle.trim()
    if (trimmed) await renameExam(id, trimmed)
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('האם למחוק מבחן זה לצמיתות?')) return
    await deleteExam(id)
  }

  async function handleDuplicate(id: string) {
    await duplicateExam(id)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const count = exams?.length ?? 0

  return (
    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden" dir="rtl">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
        aria-expanded={isOpen}
      >
        <span>המבחנים שלי ({count})</span>
        <span className="text-gray-400 text-base">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {isOpen && (
        <div>
          {exams === undefined && (
            <p className="px-4 py-3 text-sm text-gray-400">טוען…</p>
          )}
          {exams !== undefined && exams.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">
              אין מבחנים שמורים עדיין. שמור מבחן כדי שיופיע כאן.
            </p>
          )}
          {exams && exams.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {exams.map(exam => (
                <li
                  key={exam.id}
                  className={`px-4 py-3 flex flex-col gap-1 hover:bg-gray-50 transition-colors ${
                    exam.id === currentExamId ? 'border-r-4 border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  {/* Title row */}
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-base" title={SOURCE_ICONS[exam.sourceType]}>
                      {SOURCE_ICONS[exam.sourceType]}
                    </span>

                    {editingId === exam.id ? (
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={() => commitRename(exam.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename(exam.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 min-w-0 border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <button
                        type="button"
                        title="לחץ לשינוי שם"
                        onClick={() => startRename(exam)}
                        className="flex-1 min-w-0 text-right text-sm font-medium text-gray-800 truncate hover:text-blue-700 hover:underline"
                      >
                        {exam.title}
                      </button>
                    )}

                    <span
                      className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[exam.status]}`}
                    >
                      {STATUS_LABELS[exam.status]}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span>{exam.editableExam.questions.length} שאלות</span>
                    {exam.sourceFileName && <span>{exam.sourceFileName}</span>}
                    <span>{formatDate(exam.updatedAt)}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onLoad(exam)}
                      className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      פתח
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(exam.id)}
                      className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      שכפל
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exam.id)}
                      className="px-2 py-0.5 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      מחק
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
