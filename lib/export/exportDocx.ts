import type { Question } from '@/lib/parser/parseQuestions'

// TODO: implement DOCX generation with the docx package
export async function exportDocx(_questions: Question[]): Promise<Blob> {
  throw new Error('Not implemented yet')
}
