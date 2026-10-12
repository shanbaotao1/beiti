import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listWrongsByBank, graduateWrong, recordWrong } from '../store/wrong'
import { getQuestionsByIds } from '../store/questions'
import type { Question } from '../types'
import QuestionCard from '../components/QuestionCard'

export default function WrongBookPage() {
  const { bankId = '' } = useParams()
  const navigate = useNavigate()
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const wrongs = useLiveQuery(() => listWrongsByBank(bankId), [bankId])
  const questions = useLiveQuery(
    () => (wrongs ? getQuestionsByIds(wrongs.map((w) => w.questionId)) : Promise.resolve([])),
    [wrongs]
  )

  const qMap = useMemo(() => {
    const m = new Map<string, Question>()
    questions?.forEach((q) => m.set(q.id, q))
    return m
  }, [questions])

  if (!wrongs) return <div className="safe-top p-4 text-center text-slate-400">加载中…</div>

  const practicing = practiceId ? qMap.get(practiceId) : null

  const startPractice = (id: string) => {
    setPracticeId(id)
    setSelected([])
    setSubmitted(false)
  }

  const toggle = (key: string) => {
    if (submitted) return
    setSelected((prev) => {
      const q = practicing!
      if (q.type === 'multiple') {
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      }
      return [key]
    })
  }

  const submit = async () => {
    if (!practicing) return
    setSubmitted(true)
    const correct = isCorrect(selected, practicing.answer)
    if (!correct) {
      await recordWrong(practicing.id, bankId, selected.join(','))
    }
  }

  const onGraduate = async () => {
    if (practiceId) await graduateWrong(practiceId)
    setPracticeId(null)
  }

  if (practicing) {
    const correct = isCorrect(selected, practicing.answer)
    return (
      <div className="safe-top flex h-full flex-col bg-slate-100">
        <div className="flex items-center gap-2 px-4 pt-3">
          <button onClick={() => setPracticeId(null)} className="text-brand">
            ‹ 返回错题本
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <QuestionCard
            question={practicing}
            selected={selected}
            revealed={submitted}
            onToggle={toggle}
          />
          {!submitted ? (
            <button
              onClick={submit}
              className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white"
            >
              提交
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div
                className={`rounded-xl py-3 text-center font-semibold ${
                  correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {correct ? '✓ 答对了' : '✗ 答错了'}
              </div>
              {correct ? (
                <button
                  onClick={onGraduate}
                  className="w-full rounded-xl bg-brand py-3 font-semibold text-white"
                >
                  毕业（移出错题本）
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelected([])
                    setSubmitted(false)
                  }}
                  className="w-full rounded-xl border border-rose-400 py-3 font-semibold text-rose-600"
                >
                  再练一次
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const onDelete = async (id: string) => {
    if (window.confirm('确定要从错题本移除（已掌握）吗？')) {
      await graduateWrong(id)
    }
  }

  return (
    <div className="safe-top min-h-full bg-slate-100 p-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-brand">
          ‹ 返回
        </button>
        <h1 className="text-lg font-semibold text-slate-800">错题本（{wrongs.length}）</h1>
      </div>

      {wrongs.length === 0 && (
        <div className="mt-16 text-center text-slate-400">暂无错题 🎉</div>
      )}

      <div className="space-y-4">
        {wrongs.map((w) => {
          const q = qMap.get(w.questionId)
          if (!q) return null
          const userAns = w.lastChoice ? w.lastChoice.split(',').filter(Boolean) : []
          return (
            <div key={w.questionId} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-600">
                  错 {w.wrongCount} 次
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {new Date(w.lastWrongAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => onDelete(w.questionId)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500"
                  >
                    删除
                  </button>
                </div>
              </div>
              <QuestionCard
                question={q}
                selected={userAns}
                revealed
                onToggle={() => {}}
                userAnswer={userAns}
              />
              <button
                onClick={() => startPractice(w.questionId)}
                className="mt-3 w-full rounded-xl border border-brand py-2.5 font-medium text-brand"
              >
                练习这题
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function isCorrect(selected: string[], answer: string[]): boolean {
  if (selected.length !== answer.length) return false
  const a = [...selected].sort()
  const b = [...answer].sort()
  return a.every((v, i) => v === b[i])
}
