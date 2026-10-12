import mammoth from 'mammoth'
import type { Bank, Question, ParseReport } from '../types'
import { newId } from '../store/id'
import { normalizeAnswer } from './normalize'

const RE_STEM = /^\s*\d+[\.、．]\s*(?=\S)/
const RE_ANSWER =
  /【正确答[一-鿿]】|正确答案|【参考答案】|参考答案|【答案】/
const RE_EXP = /【试题解析】/
const MARKERS = /【正确答[一-鿿]】|正确答案|【参考答案】|参考答案|【试题解析】/

/**
 * 把 mammoth 输出的 HTML 拆成「行」数组，并在此基础上做两层强制断行，
 * 以处理 mammoth 把整段题库（题库二/三）压成一条巨行的情况：
 *  1) 在「答案 / 解析」标记前断行；
 *  2) 仅对【含标记的巨行】，在「句末标点 + 题号」(如 。2.  】3.  ) 处断行，
 *     从而把紧挨着上一题解析的下一题题号拆出来。
 */
export function htmlToLines(html: string): string[] {
  let s = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li)\s*>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // 1) 答案 / 解析标记前断行
  s = s.replace(/(【正确答案】|正确答案|【参考答案】|参考答案|【试题解析】)/g, '\n$1')

  // 2) 仅对含标记的巨行做题号断行：题号前若是句末标点 / 右括号 / 空白 / 行首，
  //    且题号后不是数字（排除小数）。注意：只用句末标点（。！？）与右括号，
  //    不能用 ；：，、 —— 解析里常用「1.…；2.…；3.…」列举，会误判为题号。
  s = s
    .split('\n')
    .map((line) => {
      if (!MARKERS.test(line)) return line
      return line.replace(
        /([。！？）】」]|\s|^)(\d{1,3})([\.、．])(?!\d)/g,
        '$1\n$2$3'
      )
    })
    .join('\n')

  return s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

interface Marker {
  key: string
  start: number
  end: number
  precededOk: boolean
  hard: boolean
}

/**
 * 在一行文本中找出「选项起点」，兼容多种写法：
 *  - A.文本 / A、文本 / A)文本          明确分隔符 → 硬标记
 *  - A文本 B文本 C文本 D文本            空格/标点分隔、无点 → 软标记（题库二/三常见）
 *  - ...C.值D策略制定...                末选项无点、紧贴上一选项 → 软标记
 * 仅当标记构成「≥2 个且字母严格递增」的序列时才认定为选项，避免误吃题干里的孤立字母。
 */
export function findOptionMarkers(text: string): Marker[] {
  const hard: Marker[] = []
  const soft: Marker[] = []
  let m: RegExpExecArray | null

  const reHard = /([A-Ea-e])([\.、)．])/g
  while ((m = reHard.exec(text))) {
    hard.push({ key: m[1].toUpperCase(), start: m.index, end: m.index + 2, precededOk: false, hard: true })
  }

  const reSoft = /([A-Ea-e])\s*(?=[一-鿿])/g
  while ((m = reSoft.exec(text))) {
    const idx = m.index
    const prev = idx > 0 ? text[idx - 1] : ''
    const precededOk =
      idx === 0 || /[\s：，、；。！？）】」(（]/.test(prev)
    soft.push({ key: m[1].toUpperCase(), start: idx, end: idx + 1, precededOk, hard: false })
  }

  const all: Marker[] = [...hard]
  for (const s of soft) {
    // 软标记有效条件：前导是「空白/标点/括号/行首」，或前面已有一个有效标记（承接上一选项）
    if (s.precededOk || all.length > 0) all.push(s)
  }

  if (all.length === 0) return []
  all.sort((a, b) => a.start - b.start)
  // 去重（同位置硬/软不重叠，但保险起见）
  const uniq: Marker[] = []
  for (const x of all) {
    if (uniq.length && uniq[uniq.length - 1].start === x.start) continue
    uniq.push(x)
  }
  // 取「按键严格递增」的最长子序列（而非前缀）：题干/选项正文里常夹带字母
  // （如选项文本“被评价为D级”中的 D），用 LIS 可跳过这些孤立字母，保留 A<B<C<D<E 的真实序列。
  return lisByKey(uniq)
}

function keyNum(k: string): number {
  return k.charCodeAt(0) - 65
}

function lisByKey(arr: Marker[]): Marker[] {
  const n = arr.length
  if (n === 0) return []
  const dp = new Array(n).fill(1)
  const prev = new Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (keyNum(arr[j].key) < keyNum(arr[i].key) && dp[j] + 1 > dp[i]) {
        dp[i] = dp[j] + 1
        prev[i] = j
      }
    }
  }
  let best = 0
  for (let i = 0; i < n; i++) if (dp[i] > dp[best]) best = i
  const out: Marker[] = []
  for (let k = best; k !== -1; k = prev[k]) out.unshift(arr[k])
  return out
}

/**
 * 从一行中拆分出所有「选项」。要求该行以选项标记起头（行首选项，兼容一行多选项 / 末选项无点）。
 */
function extractOptions(line: string): { options: Record<string, string>; trailing: string } | null {
  // 规则 1：整行就是单个选项（空格分隔单选项占整行，如 `A 纳税缴费信用级别不为C级或D级`、
  // `B "请进来"现场交流`、`E 12366…`）。行首为大写 A-E 紧跟空白或行尾即判定为这种格式，
  // 整行剩余文本作为该选项内容（不向内扫描，避免选项文本里夹带的字母被误判）。
  if (/^[A-Ea-e](\s|$)/.test(line)) {
    const key = line[0].toUpperCase()
    const val = line.slice(1).trim()
    if (val) return { options: { [key]: val }, trailing: '' }
    return null
  }

  const markers = findOptionMarkers(line)
  if (markers.length === 0) return null
  // 行首必须是选项；若首标记不在行首，仅当存在「硬标记」(X.)时才允许（如首选项缺省字母
  // 「按月B.按季…」），否则视为题干续行，不提取。
  if (markers[0].start !== 0 && !markers.some((mk) => mk.hard)) return null

  const opts: Record<string, string> = {}
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].end
    const end = i + 1 < markers.length ? markers[i + 1].start : line.length
    opts[markers[i].key] = line.slice(start, end).trim()
  }
  let trailing = ''
  const keys = Object.keys(opts)
  const lastKey = keys[keys.length - 1]
  const lastVal = opts[lastKey]
  // 末段若以单个字母结尾（如「按年D」），剥离为答案
  if (lastVal && /[A-Ea-e]$/.test(lastVal) && lastVal.length > 1) {
    opts[lastKey] = lastVal.slice(0, -1).trim()
    trailing = lastVal.slice(-1).toUpperCase()
  }
  withImplicitA(line, markers, opts)
  return { options: opts, trailing }
}

/**
 * 个别题库首选项缺省字母（如「表述正确的是：\n按月B.按季C.按半年D.按年」——
 * 第一个选项「按月」无字母，实为 A）。检测到首个标记不是 A 且前面有文本时，把前置文本补为 A。
 */
function withImplicitA(line: string, markers: Marker[], opts: Record<string, string>): void {
  if (markers.length === 0) return
  // 仅在「仅缺首项」时把前置文本补为 A（如「按月B.按季C.按半年D.按年」）。
  // 若首项已是 C/D/E 等，则前置文本属于中段/末段缺失标签选项，不应冒领为 A。
  if (markers[0].key !== 'B') return
  const lead = line.slice(0, markers[0].start).trim()
  if (lead && !opts['A']) opts['A'] = lead
}

/**
 * 题干行里可能直接贴着选项（题库二/三 题干与选项挤在一行）。
 * 拆出「题干文本」与「后续选项」。
 */
function splitStemAndOptions(rest: string): {
  stem: string
  options: Record<string, string>
  trailing: string
} {
  const markers = findOptionMarkers(rest)
  if (markers.length === 0) return { stem: rest, options: {}, trailing: '' }
  const p = markers[0].start
  // 仅当首选项在行首，或存在多个选项时，才认定为「题干 + 选项」
  if (p > 0 && markers.length < 2) return { stem: rest, options: {}, trailing: '' }
  const stem = rest.slice(0, p).trim()
  const optText = rest.slice(p)
  const ex = extractOptions(optText) // optText 以选项标记起头
  if (!ex) return { stem: rest, options: {}, trailing: '' }
  return { stem, options: ex.options, trailing: ex.trailing }
}

/** 题干行尾部贴答案：如 `…。A正确` `…（错误）` `…。正确` */
function extractStemTrailingAnswer(stem: string): { stem: string; answer: string } | null {
  const m = stem.match(/(?:。|．|\.)\s*([AB])\s*(正确|错误|对|错)\s*$/)
  if (m) {
    let word = m[2]
    if (word === '对') word = '正确'
    if (word === '错') word = '错误'
    return { stem: stem.slice(0, m.index).trim(), answer: word }
  }
  const m2 = stem.match(/(?:。|．)\s*(正确|错误|对|错)\s*$/)
  if (m2) {
    let word = m2[1]
    if (word === '对') word = '正确'
    if (word === '错') word = '错误'
    return { stem: stem.slice(0, m2.index).trim(), answer: word }
  }
  return null
}

export async function parseHtml(html: string, bankName: string): Promise<ParseReport> {
  const lines = htmlToLines(html)

  const questions: Question[] = []
  const warnings: string[] = []
  let cur: Temp | null = null
  let orderNo = 0
  let pending: string | null = null

  const maxOptKey = (opts: Record<string, string>): string | null => {
    const ks = Object.keys(opts).filter((k) => /^[A-E]$/.test(k))
    if (ks.length === 0) return null
    return ks.sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0))[ks.length - 1]
  }
  const nextKey = (k: string): string => String.fromCharCode(k.charCodeAt(0) + 1)

  const finalize = () => {
    if (pending !== null) {
      const curMax = cur ? maxOptKey(cur.options) : null
      if (cur && curMax && curMax < 'E' && cur.answerRaw === undefined) {
        cur.options[nextKey(curMax)] = pending.trim()
      } else if (cur) {
        cur.explanation += (cur.explanation ? '\n' : '') + pending
      }
      pending = null
    }
    if (!cur) return
    if (!cur.stem) {
      cur = null
      return
    }
    let options = cur.options
    let answerRaw = (cur.answerRaw ?? '').replace(/^[:：\s]+/, '').trim()
    let norm = normalizeAnswer(answerRaw, options)
    let type = norm.type
    let answer = norm.answer
    let status = norm.status

    // 判断题合成隐含选项（无显式 A.正确/B.错误 行，答案直接是 正确/错误 或 A正确/B错误）
    if (status === 'needsReview') {
      const jm =
        answerRaw.match(/^([AB])\s*(正确|错误|对|错)$/) ||
        answerRaw.match(/^(正确|错误|对|错)$/)
      if (jm) {
        let word = (jm[2] ?? jm[1]) as string
        if (word === '对') word = '正确'
        if (word === '错') word = '错误'
        options = { 正确: '正确', 错误: '错误' }
        answer = [word]
        type = 'judge'
        status = 'ok'
      }
    }

    if (status === 'needsReview') {
      warnings.push(`第 ${cur.orderNo} 题：答案缺失或无法识别（原文「${answerRaw || '空'}」）`)
    }
    questions.push({
      id: newId(),
      bankId: '',
      orderNo: cur.orderNo,
      type,
      stem: cur.stem.replace(/^\s*\d+[\.、．]\s*/, '').trim(),
      options,
      answer,
      explanation: cur.explanation.trim(),
      source: bankName,
      parseStatus: status
    })
    cur = null
  }

  for (const line of lines) {
    if (RE_STEM.test(line)) {
      finalize()
      orderNo++
      const numMatch = line.match(RE_STEM)!
      const rest = line.slice(numMatch[0].length)
      const trail = extractStemTrailingAnswer(rest)
      const stemRest = trail ? trail.stem : rest
      const so = splitStemAndOptions(stemRest)
      cur = {
        orderNo,
        stem: so.stem,
        options: so.options,
        explanation: ''
      }
      if (trail) cur.answerRaw = trail.answer
      else if (so.trailing) cur.answerRaw = so.trailing
      continue
    }
    if (!cur) continue

    // 处理上一轮缓存的「疑似缺失标签选项」：若本行是选项且序号出现断层
    // （如已收集 A/B/C，本行以 E 开头），则缓存行即为缺失的那一项（D）。
    if (pending !== null) {
      const ex2 = extractOptions(line)
      const firstKey = ex2 && Object.keys(ex2.options).length ? Object.keys(ex2.options)[0] : null
      const curMax = maxOptKey(cur.options)
      if (ex2 && firstKey && curMax && firstKey > nextKey(curMax)) {
        cur.options[nextKey(curMax)] = pending.trim()
        pending = null
      } else {
        if (Object.keys(cur.options).length === 0 && cur.answerRaw === undefined) {
          cur.stem += ' ' + pending
        } else {
          cur.explanation += (cur.explanation ? '\n' : '') + pending
        }
        pending = null
      }
    }

    // 解析行：纯「【试题解析】...」（与答案不在同一行时）
    if (RE_EXP.test(line) && !RE_ANSWER.test(line)) {
      const rest = line.replace(RE_EXP, '').trim()
      if (rest) cur.explanation += (cur.explanation ? '\n' : '') + rest
      continue
    }

    // 答案行（含「解析」同段）
    if (RE_ANSWER.test(line) && cur.answerRaw === undefined) {
      let rest = line.replace(RE_ANSWER, '')
      const ei = rest.indexOf('【试题解析】')
      if (ei >= 0) {
        cur.explanation += (cur.explanation ? '\n' : '') + rest.slice(ei + 6).trim()
        rest = rest.slice(0, ei)
      }
      cur.answerRaw = rest.replace(/[【】]/g, '').trim()
      continue
    }

    // 选项（含挤在一行 / 末尾贴答案 / 末选项无点）
    if (cur.answerRaw === undefined) {
      const ex = extractOptions(line)
      if (ex) {
        Object.assign(cur.options, ex.options)
        if (ex.trailing) cur.answerRaw = ex.trailing
        continue
      }
    }

    // 无标记的答案行：纯字母组合（如 `B,C,D,E`）——部分题型缺失【正确答案】标记
    if (cur.answerRaw === undefined && /^[A-Ea-e](?:[，,、\s][A-Ea-e])*$/.test(line.trim())) {
      cur.answerRaw = line.trim()
      continue
    }

    // 其余：题干续行 or 解析
    if (Object.keys(cur.options).length === 0 && cur.answerRaw === undefined) {
      cur.stem += ' ' + line
    } else if (cur.answerRaw === undefined && Object.keys(cur.options).length > 0) {
      // 正在收集选项却遇到无标记行：疑似「缺失标签选项」，先缓存，下一行再判定
      pending = line
    } else {
      cur.explanation += (cur.explanation ? '\n' : '') + line
    }
  }
  if (pending !== null) {
    // 文件末尾或题末仍有缓存：若还能补一个选项就补上，否则并入解析
    const curMax = cur ? maxOptKey(cur.options) : null
    if (cur && curMax && curMax < 'E' && cur.answerRaw === undefined) {
      cur.options[nextKey(curMax)] = pending.trim()
    } else if (cur) {
      cur.explanation += (cur.explanation ? '\n' : '') + pending
    }
    pending = null
  }
  finalize()

  const stats = {
    single: questions.filter((q) => q.type === 'single').length,
    multiple: questions.filter((q) => q.type === 'multiple').length,
    judge: questions.filter((q) => q.type === 'judge').length,
    needsReview: questions.filter((q) => q.parseStatus === 'needsReview').length
  }

  const bank: Bank = {
    id: newId(),
    name: bankName,
    sourceType: 'docx',
    createdAt: Date.now(),
    questionCount: questions.length
  }

  return { bank, questions, stats, warnings }
}

export async function parseDocx(
  arrayBuffer: ArrayBuffer,
  bankName: string
): Promise<ParseReport> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
  return parseHtml(html, bankName)
}

interface Temp {
  orderNo: number
  stem: string
  options: Record<string, string>
  answerRaw?: string
  explanation: string
}
