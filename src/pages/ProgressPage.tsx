import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { listBanks, deleteBank } from '../store/banks'
import { getBankStats } from '../store/progress'
import { countWrongsByBank } from '../store/wrong'
import { useCurrentBank } from '../store/currentBank'
import ProgressBar from '../components/ProgressBar'

interface Enriched {
  id: string
  name: string
  questionCount: number
  covered: number
  known: number
  wrongCount: number
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const setBank = useCurrentBank((s) => s.setBank)

  const banks = useLiveQuery(async () => {
    const list = await listBanks()
    const enriched: Enriched[] = await Promise.all(
      list.map(async (b) => {
        const stats = await getBankStats(b.id)
        const wrongCount = await countWrongsByBank(b.id)
        return {
          id: b.id,
          name: b.name,
          questionCount: b.questionCount,
          covered: stats.covered,
          known: stats.known,
          wrongCount
        }
      })
    )
    return enriched
  }, [])

  const open = (id: string, path: 'study' | 'wrong' | 'exam') => {
    setBank(id)
    navigate(`/${path}/${id}`)
  }

  const onDelete = async (id: string) => {
    if (confirm('确定删除该题库及其进度、错题？此操作不可恢复。')) {
      await deleteBank(id)
    }
  }

  return (
    <div className="safe-top min-h-full bg-slate-100 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">我的题库</h1>
        <button
          onClick={() => navigate('/import')}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + 导入
        </button>
      </div>

      {!banks && <p className="text-center text-slate-400">加载中…</p>}

      {banks && banks.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <span className="text-6xl">📚</span>
          <p className="text-slate-500">还没有题库</p>
          <button
            onClick={() => navigate('/import')}
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-white"
          >
            导入 Word 题库
          </button>
        </div>
      )}

      <div className="space-y-3">
        {banks?.map((b) => (
          <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <h2 className="text-base font-semibold text-slate-800">{b.name}</h2>
              <button onClick={() => onDelete(b.id)} className="text-xs text-slate-300">
                删除
              </button>
            </div>
            <ProgressBar value={b.covered} total={b.questionCount} label="覆盖率" />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>已掌握 {b.known}</span>
              <span>错题 {b.wrongCount}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Action label="背题" onClick={() => open(b.id, 'study')} primary />
              <Action label="错题" onClick={() => open(b.id, 'wrong')} />
              <Action label="自测" onClick={() => open(b.id, 'exam')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Action({
  label,
  onClick,
  primary
}: {
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl py-2 text-sm font-medium ${
        primary ? 'bg-brand text-white' : 'border border-slate-200 text-slate-600'
      }`}
    >
      {label}
    </button>
  )
}
