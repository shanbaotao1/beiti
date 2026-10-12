import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionsByBank } from '../store/questions'
import { recordWrong } from '../store/wrong'
import { saveExam } from '../store/exams'
import { makeId } from '../store/backup'
import type { Exam, ExamItem, QType, Question } from '../types'
import { EXAM_QUOTA, QTYPE_LABEL } from '../types'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'

type Phase = 'config' | 'doing' | 'result'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isCorrect(selected: string[], answer: string[]): boolean {
  if (selected.length !== answer.length) return false
  const a = [...selected].sort()
  const b = [...answer].sort()
  return a.every((v, i) => v === b[i])
}

export default function ExamPage() {
  const { bankId = '' } = useParams()
  const navigate = useNavigate()
  const [all, setAll] = useState<Question[]>([])
  const [phase, setPhase] = useState<Phase>('config')
  const [examQs, setExamQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const answersRef = useRef<Record<string, string[]>>({})
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [startAt, setStartAt] = useState(0)
  const [result, setResult] = useState<Exam | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    getQuestionsByBank(bankId).then(setAll)
  }, [bankId])

  const counts = useMemo(() => {
    const c: Record<QType, number> = { single: 0, multiple: 0, judge: 0 }
    all.forEach((q) => (c[q.type] += 1))
    return c
  }, [all])

  const plan = useMemo(() => {
    const types: QType[] = ['single', 'multiple', 'judge']
    let full = 0
    const detail: { type: QType; need: number; got: number }[] = []
    const shortages: string[] = []
    for (const t of types) {
      const need = EXAM_QUOTA[t].count
      const got = Math.min(need, counts[t])
      full += got * EXAM_QUOTA[t].points
      detail.push({ type: t, need, got })
      if (got < need) shortages.push(`${QTYPE_LABEL[t]}仅 ${got} 道（需 ${need}）`)
    }
    return { full, detail, shortages }
  }, [counts])

  const buildExam = () => {
    const byType: Record<QType, Question[]> = { single: [], multiple: [], judge: [] }
    all.forEach((q) => byType[q.type].push(q))
    const picked: Question[] = []
    ;(['single', 'multiple', 'judge'] as QType[]).forEach((t) => {
      picked.push(...shuffle(byType[t]).slice(0, EXAM_QUOTA[t].count))
    })
    setExamQs(shuffle(picked))
    setAnswers({})
    setIdx(0)
    setSelected([])
    setStartAt(Date.now())
    setPhase('doing')
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      const q = examQs[idx]
      if (q.type === 'multiple') {
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      }
      return [key]
    })
  }

  const saveCurrent = () => {
    answersRef.current[examQs[idx].id] = selected
    setAnswers({ ...answersRef.current })
  }

  const goNext = () => {
    saveCurrent()
    if (idx < examQs.length - 1) {
      setIdx(idx + 1)
      setSelected(answersRef.current[examQs[idx + 1].id] ?? [])
    } else {
      finish()
    }
  }

  const finish = async () => {
    saveCurrent()
    const items: ExamItem[] = []
    let score = 0
    let correctCount = 0
    for (const q of examQs) {
      const choice = answersRef.current[q.id] ?? []
      const ok = isCorrect(choice, q.answer)
      const scoreGot = ok ? EXAM_QUOTA[q.type].points : 0
      score += scoreGot
      if (ok) correctCount += 1
      // 仅「答了且答错」入错题本；未答题（choice 为空）只计 0 分，不进错题库
      else if (choice.length > 0) await recordWrong(q.id, bankId, choice.join(','))
      items.push({ questionId: q.id, choice, correct: ok, scoreGot })
    }
    const exam: Exam = {
      id: makeId(),
      bankId,
      createdAt: Date.now(),
      totalQuestions: examQs.length,
      totalScore: plan.full,
      score,
      correctCount,
      durationSec: Math.round((Date.now() - startAt) / 1000),
      items
    }
    await saveExam(exam)
    setResult(exam)
    setPhase('result')
  }

  // 随时交卷：把当前题的选择先存下，再统计未答题
  const submitNow = () => {
    saveCurrent()
    const unanswered = examQs.filter((q) => (answersRef.current[q.id] ?? []).length === 0).length
    const msg =
      unanswered > 0
        ? `还有 ${unanswered} 题未作答，未作答将按 0 分计入。确定现在交卷吗？`
        : '确定提交试卷并阅卷吗？'
    if (window.confirm(msg)) finish()
  }

  // 退出考试（放弃本次答卷，二次确认）
  const exitExam = () => {
    if (window.confirm('退出将放弃本次答卷，确定吗？')) setPhase('config')
  }

  if (all.length === 0) {
    return (
      <div className="safe-top flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-4xl">📝</span>
        <p className="text-slate-500">该题库还没有题目，请先导入。</p>
      </div>
    )
  }

  // —— 配置页 ——
  if (phase === 'config') {
    return (
      <div className="safe-top min-h-full bg-slate-100 p-4">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-brand">
            ‹ 返回
          </button>
          <h1 className="text-lg font-semibold text-slate-800">组卷自测（百分制）</h1>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm text-slate-500">本卷组成</div>
          {plan.detail.map((d) => (
            <div key={d.type} className="mb-2 flex items-center justify-between text-sm">
              <span>
                {QTYPE_LABEL[d.type]}：{d.got} 道 × {EXAM_QUOTA[d.type].points} 分
              </span>
              <span className="text-slate-400">
                题库共 {counts[d.type]} 道
                {d.got < d.need ? '（不足，全取）' : ''}
              </span>
            </div>
          ))}
          <div className="mt-3 border-t border-slate-100 pt-3 text-base font-semibold text-slate-800">
            满分：{plan.full} 分
          </div>
          {plan.shortages.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">⚠ {plan.shortages.join('；')}，满分相应折减</p>
          )}
        </div>
        <button
          onClick={buildExam}
          className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white"
        >
          开始考试（共 {plan.detail.reduce((s, d) => s + d.got, 0)} 题）
        </button>
      </div>
    )
  }

  // —— 答题页 ——
  if (phase === 'doing' && examQs[idx]) {
    const q = examQs[idx]
    const answered = selected.length > 0
    const answeredCount = Object.keys(answers).length + (answered ? 1 : 0)
    return (
      <div className="safe-top flex h-full flex-col bg-slate-100">
        <div className="flex items-center gap-2 px-4 pt-3">
          <button onClick={exitExam} className="text-brand">
            ‹ 退出
          </button>
          <span className="text-sm text-slate-400">
            第 {idx + 1} / {examQs.length} 题 · {QTYPE_LABEL[q.type]}
          </span>
          <button
            onClick={submitNow}
            className="ml-auto rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white"
          >
            交卷
          </button>
        </div>
        <div className="px-4 pt-2">
          <ProgressBar value={answeredCount} total={examQs.length} label="已作答" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <QuestionCard question={q} selected={selected} revealed={false} onToggle={toggle} />
          <button
            onClick={goNext}
            disabled={!answered}
            className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-40"
          >
            {idx === examQs.length - 1 ? '提交试卷' : '下一题'}
          </button>
          {!answered && (
            <p className="mt-2 text-center text-xs text-slate-400">请选择答案后再继续</p>
          )}
        </div>
      </div>
    )
  }

  // —— 结果页 ——
  if (phase === 'result' && result) {
    const total = result.totalQuestions
    const wrongItems = result.items.filter((i) => !i.correct)
    const reviewItems = showAll ? result.items : wrongItems
    const qMap = new Map(examQs.map((q) => [q.id, q]))
    const pass = result.score >= 60
    return (
      <div className="safe-top min-h-full bg-slate-100 p-4">
        <div className="mb-4 text-lg font-semibold text-slate-800">考试成绩</div>
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <div className={`text-4xl font-bold ${pass ? 'text-emerald-600' : 'text-rose-600'}`}>
            {result.score}
            <span className="text-lg text-slate-400"> / {result.totalScore}</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {pass ? '✓ 及格' : '✗ 不及格'} · 正确 {result.correctCount}/{total} · 用时{' '}
            {Math.floor(result.durationSec / 60)}分{result.durationSec % 60}秒
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">
            错题回顾（{wrongItems.length}）
          </span>
          <button onClick={() => setShowAll((v) => !v)} className="text-sm text-brand">
            {showAll ? '只看错题' : '显示全部'}
          </button>
        </div>

        <div className="mt-2 space-y-3">
          {reviewItems.map((it) => {
            const q = qMap.get(it.questionId)!
            return (
              <div key={it.questionId}>
                <div className="mb-1 text-xs text-slate-400">
                  你的答案：{it.choice.length ? it.choice.join('、') : '（未答）'} · 本题{' '}
                  {it.scoreGot} 分
                </div>
                <QuestionCard
                  question={q}
                  selected={it.choice}
                  revealed
                  onToggle={() => {}}
                />
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setPhase('config')}
          className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white"
        >
          再考一次
        </button>
      </div>
    )
  }

  return null
}
