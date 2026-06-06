import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExamShuffler from '@/components/ExamShuffler'

const SAMPLE = `1. שאלה\nא. ראשון\nב. שני\nג. שלישי\nד. רביעי`

const MIXED = `1. הפונקציה getUserName מחזירה user_id=123\nא. string תקין\nב. null\nג. Exception\nד. number`

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('ExamShuffler', () => {
  it('renders Hebrew title', () => {
    render(<ExamShuffler />)
    expect(screen.getByText('מערבל תשובות אמריקאיות')).toBeInTheDocument()
  })

  it('renders textarea', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shuffle button is disabled initially', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).toBeDisabled()
  })

  it('parse button is disabled when textarea is empty', () => {
    render(<ExamShuffler />)
    expect(screen.getByRole('button', { name: 'נתח מבחן' })).toBeDisabled()
  })

  it('parse button becomes enabled when text is entered', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: 'some text' } })
    expect(screen.getByRole('button', { name: 'נתח מבחן' })).not.toBeDisabled()
  })

  it('shows warning when no questions are detected', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: 'some text with no questions' } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByText(/לא זוהו שאלות/)).toBeInTheDocument()
  })

  it('shows parse results heading after successful parse', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByText(/תוצאות ניתוח/)).toBeInTheDocument()
  })

  it('shuffle button becomes enabled after successful parse', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    expect(screen.getByRole('button', { name: 'ערבב תשובות' })).not.toBeDisabled()
  })

  it('shows shuffled exam heading after shuffling', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    expect(screen.getAllByText('מבחן מעורבב').length).toBeGreaterThan(0)
  })

  it('shows answer key heading after shuffling', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    expect(screen.getByText('מפתח תשובות')).toBeInTheDocument()
  })

  it('mixed Hebrew-English-number content renders without error', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: MIXED } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    // getUserName appears in both textarea and parsed preview — just check it rendered
    expect(screen.getAllByText(/getUserName/).length).toBeGreaterThan(0)
  })

  it('reset clears shuffled state', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'ערבב תשובות' }))
    fireEvent.click(screen.getByRole('button', { name: 'נקה הכל' }))
    expect(screen.queryByText('מבחן מעורבב')).not.toBeInTheDocument()
    expect(screen.queryByText('מפתח תשובות')).not.toBeInTheDocument()
  })

  it('reset clears textarea', () => {
    render(<ExamShuffler />)
    fireEvent.change(getTextarea(), { target: { value: SAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: 'נתח מבחן' }))
    fireEvent.click(screen.getByRole('button', { name: 'נקה הכל' }))
    expect(getTextarea().value).toBe('')
  })

  it('quick-fill button populates textarea with sample text', () => {
    render(<ExamShuffler />)
    fireEvent.click(screen.getByRole('button', { name: 'טען דוגמה' }))
    expect(getTextarea().value.length).toBeGreaterThan(0)
    expect(getTextarea().value).toContain('getUserName')
  })
})
