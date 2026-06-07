/**
 * lib/storage/examStore.ts
 *
 * CRUD helpers for the local exam library.
 * All functions are async and call getDb() lazily.
 */

import { getDb } from './db'
import type { StoredExam, ExamSourceType, ExamStatus } from './types'
import type { EditableExam } from '@/lib/editor/editableExam'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

/**
 * Derive the lifecycle status of an exam from its content.
 */
export function deriveStatus(exam: EditableExam, hasShuffled: boolean): ExamStatus {
  if (hasShuffled) return 'shuffled'
  if (exam.questions.some(q => q.reviewStatus === 'manually-edited')) return 'edited'
  return 'parsed'
}

/**
 * Generate a human-readable title from the exam content.
 * Strips the file extension when a sourceFileName is provided.
 */
export function autoTitle(exam: EditableExam, sourceFileName?: string): string {
  if (sourceFileName) return sourceFileName.replace(/\.[^.]+$/, '')
  const first = exam.questions[0]?.text?.trim().slice(0, 40)
  return first || 'מבחן ללא שם'
}

// ─── Save options ─────────────────────────────────────────────────────────────

export interface SaveExamOpts {
  editableExam: EditableExam
  /** Defaults to autoTitle(editableExam, sourceFileName). */
  title?: string
  sourceFileName?: string
  /** Defaults to 'paste'. */
  sourceType?: ExamSourceType
  shuffledExam?: ShuffledExam
  answerKey?: AnswerKeyRow[]
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

/**
 * Create a new StoredExam record and return it.
 */
export async function saveExam(opts: SaveExamOpts): Promise<StoredExam> {
  const now = Date.now()
  const stored: StoredExam = {
    id: crypto.randomUUID(),
    title: opts.title ?? autoTitle(opts.editableExam, opts.sourceFileName),
    sourceFileName: opts.sourceFileName,
    createdAt: now,
    updatedAt: now,
    sourceType: opts.sourceType ?? 'paste',
    status: deriveStatus(opts.editableExam, !!opts.shuffledExam),
    editableExam: opts.editableExam,
    shuffledExam: opts.shuffledExam,
    answerKey: opts.answerKey,
  }
  await getDb().exams.add(stored)
  return stored
}

/**
 * Update an existing exam record. Always updates `updatedAt`.
 */
export async function updateExam(
  id: string,
  patch: Partial<Omit<StoredExam, 'id' | 'createdAt'>>,
): Promise<void> {
  await getDb().exams.update(id, { ...patch, updatedAt: Date.now() })
}

/**
 * Load a single exam by id. Returns undefined if not found.
 */
export async function loadExam(id: string): Promise<StoredExam | undefined> {
  return getDb().exams.get(id)
}

/**
 * List all exams, newest first (ordered by updatedAt descending).
 */
export async function listExams(): Promise<StoredExam[]> {
  return getDb().exams.orderBy('updatedAt').reverse().toArray()
}

/**
 * Permanently delete an exam by id.
 */
export async function deleteExam(id: string): Promise<void> {
  await getDb().exams.delete(id)
}

/**
 * Rename an exam. Only changes the title field.
 */
export async function renameExam(id: string, title: string): Promise<void> {
  await updateExam(id, { title })
}

/**
 * Duplicate an exam — new UUID, current timestamp, title appended with '(עותק)'.
 * Returns the new record.
 */
export async function duplicateExam(id: string): Promise<StoredExam> {
  const original = await loadExam(id)
  if (!original) throw new Error(`Exam not found: ${id}`)
  const now = Date.now()
  const copy: StoredExam = {
    ...original,
    id: crypto.randomUUID(),
    title: `${original.title} (עותק)`,
    createdAt: now,
    updatedAt: now,
  }
  await getDb().exams.add(copy)
  return copy
}

/**
 * Attach or replace the shuffled result on an existing exam.
 * Also updates status to 'shuffled'.
 */
export async function saveShuffledExam(
  id: string,
  shuffledExam: ShuffledExam,
  answerKey: AnswerKeyRow[],
): Promise<void> {
  await updateExam(id, { shuffledExam, answerKey, status: 'shuffled' })
}
