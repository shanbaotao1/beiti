import { db } from './db'
import type { Question } from '../types'

export async function bulkAddQuestions(questions: Question[]): Promise<void> {
  if (questions.length === 0) return
  await db.questions.bulkAdd(questions)
}

export async function getQuestionsByBank(bankId: string): Promise<Question[]> {
  return db.questions.where('bankId').equals(bankId).sortBy('orderNo')
}

export async function countQuestionsByBank(bankId: string): Promise<number> {
  return db.questions.where('bankId').equals(bankId).count()
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return []
  const map = new Map<string, Question>()
  const all = await db.questions.bulkGet(ids)
  for (const q of all) if (q) map.set(q.id, q)
  // 保持传入顺序
  return ids.map((id) => map.get(id)).filter((q): q is Question => !!q)
}

export async function getQuestion(id: string): Promise<Question | undefined> {
  return db.questions.get(id)
}
