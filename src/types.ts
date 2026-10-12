// 全局类型定义

export type QType = 'single' | 'multiple' | 'judge'

export const QTYPE_LABEL: Record<QType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断'
}

/** 题型配额（组卷百分制） */
export const EXAM_QUOTA: Record<QType, { count: number; points: number }> = {
  single: { count: 50, points: 1 },
  multiple: { count: 15, points: 2 },
  judge: { count: 20, points: 1 }
}

export interface Bank {
  id: string
  name: string
  sourceType: 'docx' | 'excel'
  createdAt: number
  questionCount: number
}

export interface Question {
  id: string
  bankId: string
  orderNo: number
  type: QType
  stem: string
  /** 选项：键 A-E，判断为 正确/错误 */
  options: Record<string, string>
  /** 答案：单选/判断为单元素，多选为多元素 */
  answer: string[]
  explanation: string
  source: string
  parseStatus: 'ok' | 'needsReview'
}

export interface Progress {
  questionId: string
  bankId: string
  covered: boolean
  lastResult: 'know' | 'unknown'
  reviewedAt: number
  updatedAt: number
}

export interface Wrong {
  questionId: string
  bankId: string
  wrongCount: number
  lastWrongAt: number
  lastChoice: string // 上一次错误选择（逗号分隔）
  updatedAt: number
}

export interface ExamItem {
  questionId: string
  choice: string[] // 用户选择
  correct: boolean
  scoreGot: number
}

export interface Exam {
  id: string
  bankId: string
  createdAt: number
  totalQuestions: number
  totalScore: number // 满分
  score: number // 实际得分
  correctCount: number
  durationSec: number
  items: ExamItem[]
}

/** 解析报告 */
export interface ParseReport {
  bank: Bank
  questions: Question[]
  stats: { single: number; multiple: number; judge: number; needsReview: number }
  warnings: string[]
}
