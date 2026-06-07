/**
 * lib/storage/migrateDraft.ts
 *
 * One-time migration: moves the legacy `mcq-shuffler-draft` localStorage key
 * to IndexedDB on first app load after Step 9.
 *
 * Safe to call multiple times — idempotent (skips if exams already exist).
 */

import type { EditableExam } from '@/lib/editor/editableExam'
import { getDb } from './db'
import { saveExam } from './examStore'

export async function migrateLocalStorageDraft(): Promise<void> {
  if (typeof window === 'undefined') return

  const raw = localStorage.getItem('mcq-shuffler-draft')
  if (!raw) return

  try {
    const count = await getDb().exams.count()
    if (count > 0) return // already migrated, or user already has exams

    const editableExam = JSON.parse(raw) as EditableExam
    if (!editableExam?.questions?.length) return

    await saveExam({ editableExam, sourceType: 'manual', title: 'טיוטה שמורה' })
    localStorage.removeItem('mcq-shuffler-draft')
  } catch {
    // Migration is best-effort; never crash the app
  }
}
