import type { Question } from '@/lib/parser/parseQuestions'

export const rtlFixtures: Question[] = [
  {
    text: 'מה מחזירה הפונקציה getUserName כאשר user_id=123?',
    options: [
      'היא מחזירה string תקין',
      'היא מחזירה null',
      'היא זורקת Exception',
      'היא מחזירה number',
    ],
  },
  {
    text: 'אם accuracy=95% ו־precision=80%, מה נכון?',
    options: [
      'הטענה הראשונה נכונה',
      'הטענה השנייה נכונה',
      'שתי הטענות נכונות',
      'אף טענה אינה נכונה',
    ],
  },
  {
    text: 'איזו שאילתה מחזירה משתמש לפי id?',
    options: [
      'SELECT * FROM users WHERE id = 5',
      'DELETE FROM users WHERE id = 5',
      'UPDATE users SET id = 5',
      'INSERT INTO users(id) VALUES(5)',
    ],
  },
]
