import { db } from './db'
import { newId } from './id'
import type { Bank, Question, Progress, Wrong, Exam } from '../types'

interface BackupFile {
  app: 'beiti'
  version: 1
  exportedAt: number
  banks: Bank[]
  questions: Question[]
  progresses: Progress[]
  wrongs: Wrong[]
  exams: Exam[]
}

export async function exportBackup(): Promise<BackupFile> {
  const [banks, questions, progresses, wrongs, exams] = await Promise.all([
    db.banks.toArray(),
    db.questions.toArray(),
    db.progresses.toArray(),
    db.wrongs.toArray(),
    db.exams.toArray()
  ])
  return {
    app: 'beiti',
    version: 1,
    exportedAt: Date.now(),
    banks,
    questions,
    progresses,
    wrongs,
    exams
  }
}

/** 覆盖式恢复：清空本地后写入备份内容（兜底迁移用） */
export async function importBackup(data: BackupFile): Promise<void> {
  if (data?.app !== 'beiti') throw new Error('不是有效的背题软件备份文件')
  await db.transaction(
    'rw',
    db.banks,
    db.questions,
    db.progresses,
    db.wrongs,
    db.exams,
    async () => {
      await Promise.all([
        db.banks.clear(),
        db.questions.clear(),
        db.progresses.clear(),
        db.wrongs.clear(),
        db.exams.clear()
      ])
      if (data.banks?.length) await db.banks.bulkPut(data.banks)
      if (data.questions?.length) await db.questions.bulkPut(data.questions)
      if (data.progresses?.length) await db.progresses.bulkPut(data.progresses)
      if (data.wrongs?.length) await db.wrongs.bulkPut(data.wrongs)
      if (data.exams?.length) await db.exams.bulkPut(data.exams)
    }
  )
}

export function makeId() {
  return newId()
}
