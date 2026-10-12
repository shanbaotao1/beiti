import type { QType } from '../types'

export interface NormalizedAnswer {
  answer: string[]
  type: QType
  status: 'ok' | 'needsReview'
}

/**
 * 把「答案原始文本」 + 选项 + 题干，归一成统一结构。
 * - answer 统一存「选项 KEY」（单选/判断为单元素，多选为多元素）
 * - 题型判定：多字母→多选；选项含 正确/错误→判断；其余→单选
 */
export function normalizeAnswer(
  raw: string,
  options: Record<string, string>
): NormalizedAnswer {
  let s = (raw || '').trim()
  // 去冒号前缀
  s = s.replace(/^[:：\s]+/, '')

  const optionValues = Object.values(options)
  const isJudge = optionValues.some((v) => v.includes('正确') || v.includes('错误'))

  // 拆分（支持半角/全角逗号、顿号、空格）
  const tokens = s.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean)

  const answer: string[] = []
  for (let tok of tokens) {
    // 组合形式「A正确」「B错误」：取判断词，忽略前面字母
    const combo = tok.match(/^[AB]\s*(正确|错误|对|错)$/)
    if (combo) {
      const w = combo[1]
      answer.push(w === '对' ? '正确' : w === '错' ? '错误' : w)
      continue
    }
    // 可能是连写字母如 "AC"
    const letters = tok.match(/[A-Ea-e]/g)
    if (/^[A-Ea-e]$/i.test(tok) && letters) {
      answer.push(tok.toUpperCase())
    } else if (letters && tok.length <= 6 && /^[A-Ea-e、，\s]+$/i.test(tok)) {
      // 纯字母组合（无汉字）按多字母处理
      for (const L of letters) answer.push(L.toUpperCase())
    } else if (tok.includes('正确') || tok.includes('对')) {
      const key = findKeyByValue(options, ['正确', '对'])
      answer.push(key ?? '正确')
    } else if (tok.includes('错误') || tok.includes('错')) {
      const key = findKeyByValue(options, ['错误', '错'])
      answer.push(key ?? '错误')
    }
  }

  // 去空 + 去重（保序）
  const seen = new Set<string>()
  const clean = answer.filter((a) => {
    if (!a || seen.has(a)) return false
    seen.add(a)
    return true
  })

  // 题型判定
  let type: QType
  if (clean.length > 1) type = 'multiple'
  else if (isJudge) type = 'judge'
  else type = 'single'

  // 校验：答案不能为空，且答案 key 必须存在于选项
  const valid =
    clean.length > 0 &&
    clean.every((a) => options[a] !== undefined || (isJudge && (a === '正确' || a === '错误')))
  const status: 'ok' | 'needsReview' = valid ? 'ok' : 'needsReview'

  return { answer: clean, type, status }
}

function findKeyByValue(options: Record<string, string>, needles: string[]): string | undefined {
  for (const [k, v] of Object.entries(options)) {
    if (needles.some((n) => v.includes(n))) return k
  }
  return undefined
}
