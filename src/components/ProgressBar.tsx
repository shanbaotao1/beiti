interface ProgressBarProps {
  value: number
  total: number
  label?: string
}

export default function ProgressBar({ value, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span>
            {value}/{total}（{pct}%）
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
