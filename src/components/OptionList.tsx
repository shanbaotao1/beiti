import type { QType } from '../types'

interface OptionListProps {
  options: Record<string, string>
  type: QType
  selected: string[]
  revealed: boolean
  answer: string[]
  onToggle: (key: string) => void
}

export default function OptionList({
  options,
  type,
  selected,
  revealed,
  answer,
  onToggle
}: OptionListProps) {
  const keys = Object.keys(options).sort()
  const multi = type === 'multiple'

  const handle = (key: string) => {
    if (revealed) return
    if (multi) {
      onToggle(key)
    } else {
      // 单选/判断：直接替换选择
      onToggle(key)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((key) => {
        const isSelected = selected.includes(key)
        const isCorrect = answer.includes(key)
        let cls = 'opt'
        if (revealed) {
          if (isCorrect) cls += ' opt-correct'
          else if (isSelected) cls += ' opt-wrong'
        } else if (isSelected) {
          cls += ' opt-active'
        }
        return (
          <button
            key={key}
            type="button"
            className={cls}
            onClick={() => handle(key)}
            disabled={revealed}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${
                isSelected ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-500'
              }`}
            >
              {key}
            </span>
            <span className="flex-1">{options[key]}</span>
          </button>
        )
      })}
      {multi && !revealed && (
        <p className="text-center text-xs text-slate-400">多选题：可勾选多个，集合需完全正确才得分</p>
      )}
    </div>
  )
}
