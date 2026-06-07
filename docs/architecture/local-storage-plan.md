# Local Storage Architecture Plan

This document describes the browser-side persistence strategy for the MCQ shuffler's exam library, practice attempts, and related data.

---

## Decision: IndexedDB over localStorage

| Concern | localStorage | IndexedDB |
|---|---|---|
| Max data size | ~5–10 MB (strict) | 50–80% of free disk (generous) |
| Async API | No (synchronous, blocks main thread) | Yes (fully async) |
| Structured data | String-only (must JSON.stringify) | Native JS objects; stores Blobs |
| Image data URLs | Risky — a 30-question exam with images easily exceeds 5 MB | Fine — no practical limit for our use case |
| Indexes / querying | None | Compound indexes, range queries |
| Transactions | No | Yes |
| Available in SSR | No | No (browser-only — same restriction, no advantage either way) |

**localStorage remains only for:**
- `mcq-shuffler-draft` — small ManualExamEditor draft (no images, JSON < 3.5 MB)
- Any future small UI preferences (e.g. last-used PDF mode)

---

## Dexie.js as the IndexedDB wrapper

[Dexie.js](https://dexie.org/) is a thin, well-maintained wrapper that adds:
- TypeScript generics with full inference
- Declarative schema migrations (`db.version(N).stores(...)`)
- `liveQuery()` — reactive queries that re-render React components when data changes (useful for the exam list and practice session in Steps 9–10)
- Simple promise-based API (no raw `IDBRequest` callbacks)

**Installation (Step 9):** `npm install dexie`

No other dependencies are introduced. Dexie is client-only and ships no telemetry.

---

## Proposed Schema

### Database name: `mcq-shuffler-db`

```typescript
// lib/storage/db.ts  (Step 9)
import Dexie, { type Table } from 'dexie'
import type { StoredExam, StoredExamVersion, PracticeAttempt } from './types'

class McqShufflerDb extends Dexie {
  exams!: Table<StoredExam>
  examVersions!: Table<StoredExamVersion>
  practiceAttempts!: Table<PracticeAttempt>

  constructor() {
    super('mcq-shuffler-db')
    this.version(1).stores({
      exams:            'id, createdAt, updatedAt, status, sourceType',
      examVersions:     'id, examId, createdAt, [examId+createdAt]',
      practiceAttempts: 'id, examId, startedAt, [examId+startedAt]',
    })
  }
}

export const db = new McqShufflerDb()
```

### Object stores and indexes

| Store | Primary key | Secondary indexes | Usage |
|---|---|---|---|
| `exams` | `id` | `createdAt`, `updatedAt`, `status`, `sourceType` | Library list, filter by status/type |
| `examVersions` | `id` | `examId`, `[examId+createdAt]` | History per exam, ordered chronologically |
| `practiceAttempts` | `id` | `examId`, `[examId+startedAt]` | Attempts per exam, most recent first |

### Data size estimates

| Scenario | Approximate size |
|---|---|
| 30-question exam, no images | ~40–80 KB |
| 30-question exam, 4 question images (100 KB JPEG each) | ~450 KB |
| 30-question exam, 120 option images (50 KB each) | ~6 MB |
| 10 exams, mixed | < 20 MB |
| 100 practice attempts | < 1 MB |

All of these are comfortably within browser IndexedDB limits.

---

## Data flow

```
User action (upload / paste / manual)
  │
  ▼
ParsedExam → EditableExam (in-memory)
  │
  ├─ [Step 9] Save button → StoredExam written to IndexedDB
  │
  ▼
Shuffle → ShuffledExam (in-memory)
  │
  ├─ [Step 9] Auto-save → StoredExam.shuffledExam updated in IndexedDB
  │
  ▼
[Step 10] Practice mode → PracticeAttempt written to IndexedDB
  │
  ▼
[Step 11] Explanation → prompt built in memory, copied to clipboard
          (nothing stored, nothing sent)
```

---

## Migration path from localStorage

When Step 9 is deployed, users may have a draft exam in `localStorage` under the key `mcq-shuffler-draft`.

**Migration strategy (one-time, on first load after Step 9):**

```typescript
// lib/storage/migrateDraft.ts  (Step 9)
async function migrateLocalStorageDraft(): Promise<void> {
  const raw = localStorage.getItem('mcq-shuffler-draft')
  if (!raw) return
  const exam = JSON.parse(raw) as EditableExam
  const existing = await db.exams.where('sourceType').equals('manual').count()
  if (existing > 0) return  // already migrated or user has other exams
  await db.exams.add({
    id: crypto.randomUUID(),
    title: 'טיוטה שמורה',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: 'manual',
    status: 'draft',
    editableExam: exam,
  })
  localStorage.removeItem('mcq-shuffler-draft')
}
```

This runs once on app startup and is idempotent.

---

## React integration

Dexie's `useLiveQuery` hook makes IndexedDB data reactive in React components:

```typescript
// In ExamLibrary component (Step 9)
import { useLiveQuery } from 'dexie-react-hooks'

const exams = useLiveQuery(
  () => db.exams.orderBy('updatedAt').reverse().toArray(),
  []
)
```

The component re-renders automatically whenever an exam is saved, renamed, or deleted — no manual state management needed.

---

## Privacy guarantees

- All data remains in the user's browser. Nothing leaves the device.
- IndexedDB is not accessible by other origins (same-origin policy).
- No analytics, no telemetry, no third-party SDKs touching stored data.
- Clearing browser data / site data removes everything cleanly.
- Export (DOCX/CSV/PDF) produces files on the local filesystem only.
