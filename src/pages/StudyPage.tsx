import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getQuestionsByBank } from '../store/questions'
import { getProgressMap, markProgress } from '../store/progress'
import { recordWrong, graduateWrong } from '../store/wrong'
import type { Question } from '../types'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'

/** 每个题库记住「上次背到哪一题」（存 questionId，避免题库变动导致错位） */
const studyPosKey = (bankId: string) => `beiti:study-pos:${bankId}`

export default function StudyPage() {
  const { bankId = '' } = useParams()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Map<string, { covered: boolean }>>(new Map())
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // 直接显示答案：第一遍通读背诵用（答案绿色高亮 + 解析同屏）；关闭则回到「点按翻面」自测模式
  const [showAnswer, setShowAnswer] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const qs = await getQuestionsByBank(bankId)
      const pm = await getProgressMap(bankId)
      if (!alive) return
      setQuestions(qs)
      setProgress(new Map([...pm].map(([k, v]) => [k, { covered: v.covered }])))
      // 恢复上次背题位置（接着上次那题继续）
      const savedId = localStorage.getItem(studyPosKey(bankId))
      if (savedId) {
        const i = qs.findIndex((x) => x.id === savedId)
        if (i >= 0) setIdx(i)
      }
    })()
    return () => {
      alive = false
    }
  }, [bankId])

  const q = questions[idx]

  // 进入新题时重置状态
  useEffect(() => {
    setFlipped(false)
    setSelected([])
  }, [idx, q?.id])

  // 直接显示答案模式：始终展开；否则按翻面状态
  const revealed = flipped || showAnswer

  const coveredCount = useMemo(
    () => questions.filter((qq) => progress.get(qq.id)?.covered).length,
    [questions, progress]
  )

  if (questions.length === 0) {
    return (
      <div className="safe-top flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-4xl">🃏</span>
        <p className="text-slate-500">该题库还没有题目，请先导入。</p>
        <button onClick={() => navigate('/import')} className="rounded-xl bg-brand px-5 py-2 text-white">
          去导入
        </button>
      </div>
    )
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (q.type === 'multiple') {
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      }
      return [key]
    })
  }

  // 跳转到指定题并记住位置，下次进入接着背
  const go = (i: number) => {
    const target = Math.max(0, Math.min(i, questions.length - 1))
    setIdx(target)
    const qq = questions[target]
    if (qq) localStorage.setItem(studyPosKey(bankId), qq.id)
  }

  const markKnow = async () => {
    await markProgress(q.id, bankId, true, 'know')
    await graduateWrong(q.id) // 会了就从错题本毕业
    setProgress((prev) => new Map(prev).set(q.id, { covered: true }))
    go(idx + 1)
  }
  const markUnknown = async () => {
    await markProgress(q.id, bankId, true, 'unknown')
    await recordWrong(q.id, bankId, selected.join(','))
    setProgress((prev) => new Map(prev).set(q.id, { covered: true }))
    go(idx + 1)
  }
  const next = () => go(idx + 1)
  const prev = () => go(idx - 1)

  return (
    <div className="safe-top flex h-full flex-col bg-slate-100">
      <div className="flex items-center gap-2 px-4 pt-3">
        <button onClick={() => navigate(-1)} className="text-brand">
          ‹ 返回
        </button>
        <span className="text-sm text-slate-400">
          第 {idx + 1} / {questions.length} 题
        </span>
        <button
          onClick={() => setShowAnswer((v) => !v)}
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            showAnswer
              ? 'bg-brand/10 text-brand'
              : 'bg-slate-200 text-slate-500'
          }`}
        >
          {showAnswer ? '👁 直接显示答案：开' : '🙈 直接显示答案：关'}
        </button>
      </div>
      <div className="px-4 pt-2">
        <ProgressBar value={coveredCount} total={questions.length} label="已覆盖" />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <QuestionCard question={q} selected={selected} revealed={revealed} onToggle={toggle} />
        {!revealed && (
          <button
            onClick={() => setFlipped(true)}
            className="mt-4 w-full rounded-xl border border-brand py-3 font-medium text-brand"
          >
            显示答案 / 翻面
          </button>
        )}
        {revealed && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={markUnknown}
              className="rounded-xl border border-rose-400 py-3 font-semibold text-rose-600"
            >
              不会（入错题）
            </button>
            <button
              onClick={markKnow}
              className="rounded-xl bg-brand py-3 font-semibold text-white"
            >
              会了
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-slate-200 bg-white p-3">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-slate-600 disabled:opacity-40"
        >
          上一题
        </button>
        <button
          onClick={next}
          disabled={idx === questions.length - 1}
          className="flex-1 rounded-xl bg-slate-800 py-3 font-medium text-white disabled:opacity-40"
        >
          下一题
        </button>
      </div>
    </div>
  )
}
