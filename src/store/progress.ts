import { db } from './db'
import type { Progress } from '../types'

export interface BankProgressStats {
  total: number
  covered: number
  known: number
}

export async function upsertProgress(p: Progress): Promise<void> {
  await db.progresses.put(p)
}

/** 标记某题已覆盖 + 结果 */
export async function markProgress(
  questionId: string,
  bankId: string,
  covered: boolean,
  lastResult: 'know' | 'unknown'
): Promise<void> {
  const now = Date.now()
  await db.progresses.put({
    questionId,
    bankId,
    covered,
    lastResult,
    reviewedAt: now,
    updatedAt: now
  })
}

export async function getProgressMap(bankId: string): Promise<Map<string, Progress>> {
  const all = await db.progresses.where('bankId').equals(bankId).toArray()
  return new Map(all.map((p) => [p.questionId, p]))
}

export async function getBankStats(bankId: string): Promise<BankProgressStats> {
  const all = await db.progresses.where('bankId').equals(bankId).toArray()
  let covered = 0
  let known = 0
  for (const p of all) {
    if (p.covered) covered++
    if (p.lastResult === 'know') known++
  }
  return { total: all.length, covered, known }
}
