/**
 * lib/storage/db.ts
 *
 * Dexie (IndexedDB) singleton for the MCQ shuffler local exam library.
 *
 * IMPORTANT: The db instance is created lazily via getDb() so that the
 * Dexie constructor (which accesses `indexedDB`) never runs during
 * Next.js server-side build where `indexedDB` does not exist.
 */

import Dexie, { type Table } from 'dexie'
import type { StoredExam, StoredExamVersion, PracticeAttempt } from './types'

// ─── Database class ───────────────────────────────────────────────────────────

export class McqShufflerDb extends Dexie {
  exams!: Table<StoredExam>
  examVersions!: Table<StoredExamVersion>
  practiceAttempts!: Table<PracticeAttempt>

  constructor() {
    super('mcq-shuffler-db')
    this.version(1).stores({
      // Only indexed fields listed here; all other fields are stored but not indexed.
      exams:            'id, createdAt, updatedAt, status, sourceType',
      examVersions:     'id, examId, createdAt, [examId+createdAt]',
      practiceAttempts: 'id, examId, startedAt, [examId+startedAt]',
    })
  }
}

// ─── Lazy singleton ───────────────────────────────────────────────────────────

let _db: McqShufflerDb | null = null

/**
 * Returns the shared McqShufflerDb instance, creating it on first call.
 * Safe to call from client components; never called during server build.
 */
export function getDb(): McqShufflerDb {
  if (!_db) _db = new McqShufflerDb()
  return _db
}

/**
 * Replace the singleton — used in tests to inject a fresh db backed by
 * fake-indexeddb without affecting other modules.
 */
export function _setDb(db: McqShufflerDb | null): void {
  _db = db
}
