/**
 * lib/storage/types.ts
 *
 * Pure TypeScript type declarations for the local exam library, practice mode,
 * and explanation helper (Steps 9–11). No runtime code; these types are fully
 * erased at compile time and have zero impact on bundle size.
 *
 * Storage engine: IndexedDB (via Dexie.js — wired in Step 9).
 * localStorage remains only for the small ManualExamEditor draft key.
 */

import type { EditableExam } from '@/lib/editor/editableExam'
import type { ShuffledExam, AnswerKeyRow } from '@/lib/shuffle/shuffleExam'

// ─── Enum-like literals ───────────────────────────────────────────────────────

/** How the original exam source arrived in the app. */
export type ExamSourceType = 'paste' | 'docx' | 'pdf' | 'manual'

/** Lifecycle stage of a stored exam. */
export type ExamStatus = 'draft' | 'parsed' | 'edited' | 'shuffled' | 'practice'

/** Which snapshot type a StoredExamVersion records. */
export type ExamVersionType = 'original' | 'edited' | 'shuffled'

/** Whether the user is doing free practice or a timed simulation. */
export type PracticeMode = 'practice' | 'simulation'

// ─── Exam library ─────────────────────────────────────────────────────────────

/**
 * The top-level record stored in IndexedDB's `exams` object store.
 *
 * Contains the full editable exam and optionally the most recent shuffle.
 * This single record captures the exam's entire lifecycle; historical
 * snapshots are kept separately in StoredExamVersion (optional, Step 9+).
 */
export interface StoredExam {
  /** Client-generated UUID via crypto.randomUUID(). */
  id: string
  /** User-visible name. Defaults to sourceFileName or 'מבחן ללא שם'. */
  title: string
  sourceFileName?: string
  /** Unix ms timestamp (Date.now()). JSON-safe and IndexedDB-native. */
  createdAt: number
  updatedAt: number
  sourceType: ExamSourceType
  status: ExamStatus
  /** The editable (pre-shuffle) form of the exam. Always present. */
  editableExam: EditableExam
  /** The most recent shuffle result. Absent until the user shuffles. */
  shuffledExam?: ShuffledExam
  /** Answer key matching the most recent shuffledExam. */
  answerKey?: AnswerKeyRow[]
  tags?: string[]
  notes?: string
}

/**
 * Optional version history record stored in `examVersions` object store.
 *
 * Not required for Step 9 MVP — recorded here for the design so that
 * practice attempts can reference a specific shuffle for replay.
 */
export interface StoredExamVersion {
  /** Client-generated UUID. */
  id: string
  /** FK → StoredExam.id */
  examId: string
  createdAt: number
  type: ExamVersionType
  /**
   * The snapshot payload.
   * - 'original' | 'edited' → EditableExam
   * - 'shuffled'            → ShuffledExam
   */
  data: EditableExam | ShuffledExam
}

// ─── Practice / solve mode ────────────────────────────────────────────────────

/**
 * A single answer given by the user for one question during a practice attempt.
 *
 * Both IDs are UUID references into the *editableExam* (not the shuffled copy),
 * so answers remain valid even if the exam is reshuffled later.
 */
export interface UserAnswer {
  /** EditableQuestion.id — stable UUID, survives reshuffles. */
  questionId: string
  /**
   * EditableOption.id, or null if the user left the question unanswered.
   * Resolved to label/text at display time by looking up through
   * storedExam.editableExam.questions[*].options[*].
   */
  selectedOptionId: string | null
  /** Set after the answer is checked (single-question or full-exam check). */
  isCorrect?: boolean
  /** Unix ms timestamp when the user checked this question. */
  checkedAt?: number
}

/**
 * A complete practice session stored in `practiceAttempts` object store.
 */
export interface PracticeAttempt {
  /** Client-generated UUID. */
  id: string
  /** FK → StoredExam.id */
  examId: string
  /**
   * FK → StoredExamVersion.id of the shuffled snapshot used.
   * Allows replaying the exact shuffle the user answered.
   * Absent if version history is not yet enabled (Step 9 MVP).
   */
  shuffledVersionId?: string
  startedAt: number
  completedAt?: number
  answers: UserAnswer[]
  /** Number of correct answers (set after full-exam check). */
  score?: number
  /** Total number of questions in this attempt. */
  total?: number
  mode: PracticeMode
}

// ─── Explanation / ChatGPT helper ─────────────────────────────────────────────

/**
 * Data bundle passed to the explanation prompt builder (Step 11).
 *
 * No API calls are made. The prompt is assembled locally and copied to
 * the clipboard. The user then pastes it manually into ChatGPT or any
 * other AI assistant of their choice.
 */
export interface QuestionExplanationContext {
  questionText: string
  options: Array<{
    label: string        // Hebrew letter, e.g. 'א'
    text: string         // option text (may be empty if image-only)
    hasImage: boolean    // true if a visualImageDataUrl is attached
  }>
  correctAnswerLabel: string
  /** Empty string if the correct answer is image-only. */
  correctAnswerText: string
  /** Set only when building a prompt from a completed practice attempt. */
  selectedAnswerLabel?: string
  selectedAnswerText?: string
}
