import { useRef, useState } from 'react'
import { exportBackup, importBackup } from '../store/backup'

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const onExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    a.href = url
    a.download = `背题备份_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate()
    ).padStart(2, '0')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('已导出备份文件，请妥善保存（可发到微信文件传输助手）')
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    setMsg('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importBackup(data)
      setMsg('恢复成功！数据已写入本机。')
    } catch (ex) {
      setErr('恢复失败：' + (ex as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="safe-top min-h-full bg-slate-100 p-4">
      <div className="mb-4 text-lg font-semibold text-slate-800">备份与恢复</div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm text-slate-500">
          数据存储在手机本机（IndexedDB）。换手机或清缓存前，请先导出备份；在新设备导入即可恢复题库、进度与错题。
        </p>
        <button
          onClick={onExport}
          className="mb-3 w-full rounded-xl bg-brand py-3 font-semibold text-white"
        >
          导出备份（JSON）
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImport}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border border-slate-200 py-3 font-medium text-slate-600"
        >
          导入备份（覆盖本机）
        </button>
      </div>
      {msg && <p className="mt-3 text-center text-sm text-emerald-600">{msg}</p>}
      {err && <p className="mt-3 text-center text-sm text-rose-600">{err}</p>}
    </div>
  )
}
