import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseDocx } from '../parsers/docxParser'
import { parseExcel } from '../parsers/excelParser'
import type { ParseReport } from '../types'
import { listBanks, deleteBank } from '../store/banks'
import { bulkAddQuestions } from '../store/questions'
import { db } from '../store/db'
import { useCurrentBank } from '../store/currentBank'
import QuestionCard from '../components/QuestionCard'

export default function ImportPage() {
  const navigate = useNavigate()
  const setBank = useCurrentBank((s) => s.setBank)
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [report, setReport] = useState<ParseReport | null>(null)
  const [bankName, setBankName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setReport(null)
    const fname = file.name
    const isExcel = /\.xlsx?$/i.test(fname)
    const baseName = fname.replace(/\.xlsx?$/i, '').replace(/\.docx$/i, '')
    setBankName(baseName)
    setParsing(true)
    try {
      const buf = await file.arrayBuffer()
      const rep = isExcel
        ? await parseExcel(buf, baseName)
        : await parseDocx(buf, baseName)
      setReport(rep)
    } catch (ex) {
      setErr('解析失败：' + (ex as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const onConfirm = async () => {
    if (!report) return
    setSaving(true)
    try {
      const name = bankName.trim() || report.bank.name
      const existing = (await listBanks()).find((b) => b.name === name)
      let bankId = report.bank.id
      if (existing) {
        await deleteBank(existing.id)
        bankId = existing.id
      }
      report.bank.id = bankId
      report.bank.name = name
      report.questions.forEach((q) => (q.bankId = bankId))
      await db.transaction('rw', db.banks, db.questions, async () => {
        await db.banks.put(report.bank)
        await bulkAddQuestions(report.questions)
      })
      setBank(bankId)
      navigate('/')
    } catch (ex) {
      setErr('保存失败：' + (ex as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="safe-top min-h-full bg-slate-100 p-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-brand">
          ‹ 返回
        </button>
        <h1 className="text-lg font-semibold text-slate-800">导入题库</h1>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".docx,.xlsx"
        className="hidden"
        onChange={onPick}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-white py-10 text-center"
      >
        <span className="text-4xl">📄</span>
        <span className="font-medium text-brand">点击选择 Word / Excel 题库（.docx / .xlsx）</span>
        <span className="text-xs text-slate-400">支持单选 / 多选 / 判断，自动识别题型与答案</span>
      </button>

      {parsing && <p className="mt-4 text-center text-slate-500">解析中…</p>}
      {err && <p className="mt-4 text-center text-rose-600">{err}</p>}

      {report && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm text-slate-400">题库名称</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            />
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              <Stat label="总题数" value={report.questions.length} />
              <Stat label="单选" value={report.stats.single} />
              <Stat label="多选" value={report.stats.multiple} />
              <Stat label="判断" value={report.stats.judge} />
            </div>
            {report.stats.needsReview > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠ {report.stats.needsReview} 题答案缺失/异常，已标黄，可稍后手动核对
              </p>
            )}
          </div>

          {report.warnings.length > 0 && (
            <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">
              <div className="mb-1 font-semibold">导入提示（前 10 条）</div>
              {report.warnings.slice(0, 10).map((w, i) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium text-slate-500">样例预览（前 3 题）</div>
            {report.questions.slice(0, 3).map((q) => (
              <div key={q.id} className="mb-3">
                <QuestionCard
                  question={q}
                  selected={[]}
                  revealed
                  onToggle={() => {}}
                  showExplanation={false}
                />
              </div>
            ))}
          </div>

          <button
            onClick={onConfirm}
            disabled={saving}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? '保存中…' : '确认导入并开始背题'}
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-xl font-semibold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}
