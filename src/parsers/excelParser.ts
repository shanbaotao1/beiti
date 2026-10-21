import * as XLSX from 'xlsx'
import type { Bank, Question, ParseReport, QType } from '../types'
import { newId } from '../store/id'

interface ColumnMap {
  seq: number
  stem: number
  optA: number
  optB: number
  optC: number
  optD: number
  answer: number
  type: number
  explanation: number
}

/**
 * 根据首行表头识别各角色所在列。
 * - 优先「列名关键词」匹配（容错中文别名与常见英文）；
 * - 若表头无法识别（无表头或词差异大），回退到「标准位置」：
 *   序号(0) | 题干(1) | 选项A-D(2~5) | 答案(6) | 题型(7)。
 */
function detectColumns(headers: string[]): ColumnMap {
  const norm = headers.map((h) => String(h ?? '').trim().toLowerCase())
  const find = (...cands: string[]) =>
    norm.findIndex((n) => cands.some((c) => n.includes(c)))

  const map: ColumnMap = {
    seq: find('序号', '编号', '题号', 'no', 'number', 'id'),
    stem: find('题目', '题干', '问题', 'stem', 'question'),
    optA: find('选项a', '选项1'),
    optB: find('选项b', '选项2'),
    optC: find('选项c', '选项3'),
    optD: find('选项d', '选项4'),
    answer: find('答案', 'answer', '标准答案', '正确答案'),
    type: find('题型', '类型', 'type', 'kind'),
    explanation: find('解析', 'explanation', '试题解析', '答案解析')
  }

  // 位置兜底（仅在表头未命中时才有意义）
  if (map.stem < 0) map.stem = 1
  if (map.optA < 0) map.optA = 2
  if (map.optB < 0) map.optB = 3
  if (map.optC < 0) map.optC = 4
  if (map.optD < 0) map.optD = 5
  if (map.answer < 0) map.answer = 6
  if (map.type < 0) map.type = 7
  // explanation 无兜底（默认 -1 表示无解析列）
  return map
}

/**
 * 是否为标准判断题形状：恰好两个选项，且选项值「精确等于」正确/错误（或 对/错）。
 * 用精确匹配而非「包含」，避免选项文本里恰含「正确」二字（如"正确的做法"）被误判为判断题。
 */
function judgeShape(options: Record<string, string>): boolean {
  const ks = Object.keys(options)
  if (ks.length !== 2) return false
  const clean = (v: string) => v.replace(/[。.（）()\s]/g, '')
  const isWord = (v: string) => ['正确', '错误', '对', '错'].includes(clean(v))
  return isWord(options[ks[0]]) && isWord(options[ks[1]])
}

const OPT_KEYS = ['A', 'B', 'C', 'D']

export async function parseExcel(
  arrayBuffer: ArrayBuffer,
  bankName: string
): Promise<ParseReport> {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  // 限制列范围：避免某些从 Word 复制来的超宽空表（上万列）导致解析爆炸
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    range.e.c = Math.min(range.e.c, 59) // 只看前 60 列，足够覆盖任何正常题库
    ws['!ref'] = XLSX.utils.encode_range(range)
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  }) as string[][]

  if (rows.length === 0) {
    return emptyReport(bankName)
  }

  const map = detectColumns(rows[0])
  // 是否首行为表头：命中的关键列至少其一
  const hasHeader =
    map.stem >= 0 && rows[0][map.stem] !== undefined
      ? true
      : map.optA >= 0 || map.answer >= 0 || map.type >= 0
  const startRow = hasHeader ? 1 : 0

  const questions: Question[] = []
  const warnings: string[] = []

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r]
    const stemRaw = (row[map.stem] ?? '').toString().trim()
    if (!stemRaw) continue // 跳过空行

    // 选项
    const options: Record<string, string> = {}
    ;[map.optA, map.optB, map.optC, map.optD].forEach((col, idx) => {
      const v = row[col]
      if (v != null) {
        let s = v.toString().trim()
        // 轻量清理：部分题库选项文本末尾会粘连「正确答案/答案」标记（源文件脏数据）
        const trailing = s.match(/(正确答案|答案)\s*$/)
        if (trailing) {
          s = s.slice(0, s.length - trailing[0].length).trim()
          warnings.push(
            `第 ${r + 1} 行：已清理选项末尾粘连的「${trailing[0]}」标记`
          )
        }
        if (s) options[OPT_KEYS[idx]] = s
      }
    })

    const ansRaw = map.answer >= 0 ? (row[map.answer] ?? '') : ''
    const typeRaw =
      map.type >= 0 ? (row[map.type] ?? '').toString().trim() : ''

    // 题型判定
    let type: QType
    if (typeRaw.includes('多选')) type = 'multiple'
    else if (typeRaw.includes('判断') || typeRaw.includes('是非')) type = 'judge'
    else if (typeRaw.includes('单选')) type = 'single'
    else {
      const ar = ansRaw.toString().trim()
      if (/^[A-Ea-e]{2,}$/.test(ar.replace(/[\s,，、]/g, ''))) type = 'multiple'
      else if (judgeShape(options)) type = 'judge'
      else type = 'single'
    }
    // 兜底：题型列未标注，且选项恰好是「正确/错误」两值 → 判为判断题
    if (type === 'single' && judgeShape(options)) type = 'judge'

    let answer: string[] = []
    let status: 'ok' | 'needsReview' = 'ok'
    const explanation =
      map.explanation >= 0 ? (row[map.explanation] ?? '').toString().trim() : ''

    if (type === 'judge') {
      const aVal = options['A'] ?? '正确'
      const bVal = options['B'] ?? '错误'
      const ar = ansRaw.toString().trim()
      let ansWord = aVal
      const up = ar.toUpperCase()
      if (ar.includes('正确') || up === 'A' || ar === '对') ansWord = aVal
      else if (ar.includes('错误') || up === 'B' || ar === '错') ansWord = bVal
      else if (up === 'A' || up === 'B') ansWord = up === 'A' ? aVal : bVal
      else {
        status = 'needsReview'
        warnings.push(`第 ${r + 1} 行：判断题答案无法识别（原文「${ar}」）`)
      }
      answer = [ansWord]
      // 判断题选项统一为汉字键，与 docx 来源判断题格式一致
      options['正确'] = aVal
      options['错误'] = bVal
      delete options['A']
      delete options['B']
      delete options['C']
      delete options['D']
    } else {
      const ar = ansRaw.toString().trim().toUpperCase()
      const letters = ar.match(/[A-E]/g)
      if (letters && letters.length > 0) {
        const valid = letters.filter((L) => options[L] !== undefined)
        answer = valid
        if (valid.length === 0) {
          status = 'needsReview'
          warnings.push(`第 ${r + 1} 行：答案字母不在选项中（原文「${ar}」）`)
        } else if (valid.length !== letters.length) {
          status = 'needsReview'
          warnings.push(`第 ${r + 1} 行：部分答案字母无效（原文「${ar}」）`)
        }
      } else {
        status = 'needsReview'
        warnings.push(`第 ${r + 1} 行：答案缺失或无法识别（原文「${ansRaw}」）`)
      }
      // 单选项却有多字母答案 → 修正为多选
      if (type === 'single' && answer.length > 1) type = 'multiple'
    }

    questions.push({
      id: newId(),
      bankId: '',
      orderNo: questions.length + 1,
      type,
      stem: stemRaw,
      options,
      answer,
      explanation,
      source: bankName,
      parseStatus: status
    })
  }

  if (questions.length === 0) return emptyReport(bankName)

  const stats = {
    single: questions.filter((q) => q.type === 'single').length,
    multiple: questions.filter((q) => q.type === 'multiple').length,
    judge: questions.filter((q) => q.type === 'judge').length,
    needsReview: questions.filter((q) => q.parseStatus === 'needsReview').length
  }

  const bank: Bank = {
    id: newId(),
    name: bankName,
    sourceType: 'excel',
    createdAt: Date.now(),
    questionCount: questions.length
  }

  return { bank, questions, stats, warnings }
}

function emptyReport(bankName: string): ParseReport {
  const bank: Bank = {
    id: newId(),
    name: bankName,
    sourceType: 'excel',
    createdAt: Date.now(),
    questionCount: 0
  }
  return {
    bank,
    questions: [],
    stats: { single: 0, multiple: 0, judge: 0, needsReview: 0 },
    warnings: ['未从文件中识别到任何题目，请检查文件格式']
  }
}
