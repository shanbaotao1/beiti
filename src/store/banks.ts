import { db } from './db'
import type { Bank } from '../types'
import { newId } from './id'

export async function listBanks(): Promise<Bank[]> {
  return db.banks.orderBy('createdAt').reverse().toArray()
}

export async function getBank(id: string): Promise<Bank | undefined> {
  return db.banks.get(id)
}

export async function createBank(name: string, sourceType: Bank['sourceType']): Promise<Bank> {
  const bank: Bank = {
    id: newId(),
    name,
    sourceType,
    createdAt: Date.now(),
    questionCount: 0
  }
  await db.banks.add(bank)
  return bank
}

export async function updateBankQuestionCount(id: string, count: number): Promise<void> {
  await db.banks.update(id, { questionCount: count })
}

export async function deleteBank(id: string): Promise<void> {
  await db.transaction('rw', db.banks, db.questions, db.progresses, db.wrongs, async () => {
    await db.banks.delete(id)
    await db.questions.where('bankId').equals(id).delete()
    await db.progresses.where('bankId').equals(id).delete()
    await db.wrongs.where('bankId').equals(id).delete()
  })
}
