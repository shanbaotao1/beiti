import { db } from './db'
import type { Wrong } from '../types'

/** 答错 / 标记不会：写入或累加错题本 */
export async function recordWrong(
  questionId: string,
  bankId: string,
  lastChoice: string
): Promise<void> {
  const now = Date.now()
  const existing = await db.wrongs.get(questionId)
  if (existing) {
    await db.wrongs.update(questionId, {
      wrongCount: existing.wrongCount + 1,
      lastWrongAt: now,
      lastChoice,
      updatedAt: now
    })
  } else {
    const w: Wrong = {
      questionId,
      bankId,
      wrongCount: 1,
      lastWrongAt: now,
      lastChoice,
      updatedAt: now
    }
    await db.wrongs.put(w)
  }
}

/** 答对毕业：从错题本移除 */
export async function graduateWrong(questionId: string): Promise<void> {
  await db.wrongs.delete(questionId)
}

export async function listWrongsByBank(bankId: string): Promise<Wrong[]> {
  const all = await db.wrongs.where('bankId').equals(bankId).toArray()
  return all.sort((a, b) => b.wrongCount - a.wrongCount)
}

export async function countWrongsByBank(bankId: string): Promise<number> {
  return db.wrongs.where('bankId').equals(bankId).count()
}

export async function clearWrongsByBank(bankId: string): Promise<void> {
  await db.wrongs.where('bankId').equals(bankId).delete()
}
