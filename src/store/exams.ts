import { db } from './db'
import type { Exam } from '../types'

export async function saveExam(exam: Exam): Promise<void> {
  await db.exams.put(exam)
}

export async function listExamsByBank(bankId: string): Promise<Exam[]> {
  const all = await db.exams.where('bankId').equals(bankId).reverse().toArray()
  return all.sort((a, b) => b.createdAt - a.createdAt)
}
