import type { Question } from '../types'
import OptionList from './OptionList'

interface QuestionCardProps {
  question: Question
  selected: string[]
  revealed: boolean
  onToggle: (key: string) => void
  /** 是否显示来源/解析（自测回顾时可能隐藏） */
  showExplanation?: boolean
  /** 用户的作答（错题本/回顾时展示，便于对比正确答案） */
  userAnswer?: string[]
}

export default function QuestionCard({
  question,
  selected,
  revealed,
  onToggle,
  showExplanation = true,
  userAnswer
}: QuestionCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 whitespace-pre-wrap text-[17px] font-medium leading-relaxed text-slate-800">
        {question.stem}
      </div>
      <OptionList
        options={question.options}
        type={question.type}
        selected={selected}
        revealed={revealed}
        answer={question.answer}
        onToggle={onToggle}
      />
      {revealed && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">
          {userAnswer && (
            <div className="mb-1 font-semibold text-rose-600">
              你的答案：{userAnswer.length ? userAnswer.join('、') : '（未答）'}
            </div>
          )}
          <div className="mb-1 font-semibold text-emerald-700">
            正确答案：{question.answer.join('、')}
          </div>
          {showExplanation && question.explanation && (
            <div className="whitespace-pre-wrap leading-relaxed text-slate-600">
              {question.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
