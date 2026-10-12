import Dexie, { type Table } from 'dexie'
import type { Bank, Question, Progress, Wrong, Exam } from '../types'

export class BeitiDB extends Dexie {
  banks!: Table<Bank, string>
  questions!: Table<Question, string>
  progresses!: Table<Progress, string>
  wrongs!: Table<Wrong, string>
  exams!: Table<Exam, string>

  constructor() {
    super('beiti')
    this.version(1).stores({
      banks: 'id, createdAt, name',
      questions: 'id, bankId, orderNo, type',
      progresses: 'questionId, bankId',
      wrongs: 'questionId, bankId',
      exams: 'id, bankId, createdAt'
    })
  }
}

export const db = new BeitiDB()
