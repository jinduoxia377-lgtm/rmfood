/**
 * 药食同源 / 多肽术语词典加载器
 *
 * 数据源：`src/knowledge/terminology-dict.json`（此前为全库无 import 的孤儿文件）。
 * 本模块将其接入真实使用点：知识库面板（KnowledgeBasePanel）的「术语词典」查询。
 *
 * 用法：
 * ```ts
 * import { searchTerminology, getTerminologyCount } from '@/knowledge/terminology'
 * const hits = searchTerminology('抗氧化')
 * ```
 */

import terminologyDict from './terminology-dict.json'

export interface TerminologyEntry {
  /** 术语名（键名） */
  term: string
  /** 所属分类 key，如 tcm_fundamentals / peptide_science / bioactivity / food_sources */
  categoryKey: string
  /** 所属分类显示名 */
  categoryName: string
  /** 中文定义 */
  zh: string
  /** 英文定义 */
  en: string
  /** 缩写（如有） */
  abbreviation?: string
  /** 单位（如有） */
  unit?: string
  /** 示例（如有） */
  examples?: string[]
  /** 作用机制（bioactivity 类目下） */
  mechanism?: string
  /** 相关多肽（bioactivity 类目下） */
  relatedPeptides?: string[]
}

interface RawTerm {
  zh?: string
  en?: string
  abbreviation?: string
  unit?: string
  examples?: string[]
  mechanism?: string
  related_peptides?: string[]
  category?: string
}

interface RawCategory {
  name: string
  terms: Record<string, RawTerm>
}

interface TerminologyDictShape {
  categories: Record<string, RawCategory>
}

const dict = terminologyDict as TerminologyDictShape

/** 展平后的全量术语条目（加载时计算一次） */
export const TERMINOLOGY_ENTRIES: TerminologyEntry[] = Object.entries(
  dict.categories ?? {},
).flatMap(([categoryKey, category]) =>
  Object.entries(category.terms ?? {}).map(([term, data]) => ({
    term,
    categoryKey,
    categoryName: category.name ?? categoryKey,
    zh: data.zh ?? '',
    en: data.en ?? '',
    abbreviation: data.abbreviation,
    unit: data.unit,
    examples: data.examples,
    mechanism: data.mechanism,
    relatedPeptides: data.related_peptides,
  })),
)

/** 术语总数 */
export function getTerminologyCount(): number {
  return TERMINOLOGY_ENTRIES.length
}

/**
 * 按术语名 / 中文 / 英文 / 缩写 / 示例模糊搜索术语。
 * @param query 搜索关键词（大小写不敏感）
 * @param limit 返回条数上限
 */
export function searchTerminology(query: string, limit = 8): TerminologyEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return TERMINOLOGY_ENTRIES.filter((entry) => {
    if (entry.term.toLowerCase().includes(q)) return true
    if (entry.zh.toLowerCase().includes(q)) return true
    if (entry.en.toLowerCase().includes(q)) return true
    if (entry.abbreviation?.toLowerCase().includes(q)) return true
    if (entry.examples?.some((ex) => ex.toLowerCase().includes(q))) return true
    return false
  }).slice(0, limit)
}

export default TERMINOLOGY_ENTRIES