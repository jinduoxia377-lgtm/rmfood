/**
 * followUpSuggestionApi — 追问建议动态生成 API
 *
 * 优先调用后端 LLM 动态生成贴合当前对话的追问建议；
 * 网络错误/超时/非 200 时返回 unavailable，由调用方降级到本地规则引擎。
 *
 * 关键：后端返回 source='fallback'（LLM 未走通）时**不再丢弃 source**，
 * 而是通过 result.source 透传给调用方，使 UI 能给出「智能追问暂不可用」的
 * 轻量降级标识（此前 fallback 与失败一律返回 null，用户对降级完全无感知）。
 *
 * 请求风格与 chatService 保持一致：直接使用 fetch（携带 Cookie 与 CSRF token）。
 */
import { API_ENDPOINTS } from '@/config/apiEndpoints'
import { fetchWithCsrf } from '@/utils/csrf'
import { logger } from '@/utils/safeLogger'
import type { FollowUpSuggestion } from './followUpSuggestionService'

/** 动态追问请求超时时间（毫秒）
 * 超时链路对齐：前端必须略大于后端 wait_for，否则后端已返回的 LLM 结果会被前端先掐断 → 长期降级到本地固定池。
 * 历史：10s（必然超时）→ 20s → 15s（对齐后端旧 12s）。
 *     → 35s（当前：后端 follow-up 端点 LLM wait_for 已提升到 30s——上游 agnes-3.0-flash 单次
 *       chat_with_json 稳定耗时 15~22s，旧 12s 必然超时走 fallback；见 chat.py:2403。
 *       前端须 > 30s，取 35s 留 5s 网络余量，确保后端 30s 内能返回的 LLM 结果不被前端先掐断）。
 * 不阻塞 UI：FollowUpSuggestionsBar 先显示本地结果，成功后异步替换。
 */
const DYNAMIC_SUGGESTION_TIMEOUT_MS = 35_000

/** 后端返回的追问建议元素 */
export interface FollowUpSuggestionApiItem {
  question: string
  category: string
}

/** 后端响应体 */
export interface FollowUpSuggestionApiResponse {
  success: boolean
  source?: 'llm' | 'fallback'
  suggestions?: FollowUpSuggestionApiItem[]
}

/**
 * 结构化领域上下文（透传给后端 LLM，使追问贴合当前配方/体质/约束/知识块/辨证）。
 * 全部可选：取不到就不传（向后兼容旧后端）。字段名与后端对齐（snake_case）。
 */
export interface FollowUpDomainContext {
  /** 当前配方上下文（药材+克重文本，如「黄芪 10g、枸杞 5g」） */
  formula_context?: string | null
  /** 体质倾向（辨证结果或用户画像，如「湿热质」） */
  constitution?: string | null
  /** 个人约束摘要（过敏原/饮食禁忌/健康目标等，来自用户健康画像） */
  user_constraints?: string | null
  /** RAG 知识块内容列表（最近一次检索命中的知识片段） */
  rag_context?: string[] | null
  /** 辨证摘要（证候要点 + 调理目标） */
  dialectics_summary?: string | null
  /**
   * 合规结论上下文（药食同源目录/十八反十九畏/日用总量等，来自 AI 回复结构化内容里的
   * 合规/禁忌/用量校验 callout）。可选：取不到就不传（向后兼容旧后端）。
   */
  compliance_context?: string | null
}

/** 动态追问请求参数 */
export interface FetchDynamicFollowUpSuggestionsParams extends FollowUpDomainContext {
  /** 用户最近的问题（最后一条 user 消息内容） */
  question: string
  /** AI 最后一条回复内容 */
  answer: string
  /** 最近若干条对话历史（可选） */
  history?: Array<{ role: 'user' | 'assistant'; content: string }> | null
  /** 最大建议数 */
  maxSuggestions?: number
}

/**
 * 动态追问结果（透传 source，使调用方能区分「LLM 成功」与「降级」）。
 *
 * - llm：后端 LLM 动态结果，suggestions 非空，可直接替换本地池。
 * - fallback：后端 LLM 未走通（不可用/超时/解析空），返回了固定兜底问题。
 *   suggestions 为后端兜底问题，供调用方**参考**；当前调用方保留本地规则池展示
 *   （本地池已按领域上下文增强，质量优于后端固定 3 条泛泛问题），仅标记降级态。
 * - unavailable：网络错误/前端超时/非 200/响应无效，suggestions 为 null，降级本地池。
 */
export type DynamicFollowUpResult =
  | { source: 'llm'; suggestions: FollowUpSuggestion[] }
  | { source: 'fallback'; suggestions: FollowUpSuggestion[] }
  | { source: 'unavailable'; suggestions: null }

/** 后端返回的分类中文 → 前端 i18n categoryKey 映射 */
const CATEGORY_KEY_MAP: Record<string, string> = {
  药材知识: 'herbKnowledge',
  配伍知识: 'compatibilityKnowledge',
  配伍禁忌: 'compatibilityTaboo',
  配方设计: 'formulaDesign',
  成分知识: 'ingredientKnowledge',
  安全合规: 'safetyCompliance',
  体质辨识: 'constitution',
}

/** 映射不到时的兜底分类 key */
const FALLBACK_CATEGORY_KEY = 'herbKnowledge'

/**
 * 将后端返回的分类中文映射到现有 categories 的 i18n key
 * （如 "配方设计" → "formulaDesign"），映射不到时返回兜底 key。
 */
export function mapCategoryToKey(category: string): string {
  return CATEGORY_KEY_MAP[category] ?? FALLBACK_CATEGORY_KEY
}

/** 将后端建议元素映射为 FollowUpSuggestion[]（过滤空问题） */
function mapSuggestions(items: FollowUpSuggestionApiItem[]): FollowUpSuggestion[] {
  const now = Date.now()
  return items
    .map((item, index) => ({
      id: `dynamic-${now}-${index}`,
      question: item.question || '',
      category: item.category || '药材知识',
      categoryKey: mapCategoryToKey(item.category),
      confidence: 1,
      source: 'llm' as const,
    }))
    .filter(s => s.question.length > 0)
}

/**
 * 调用后端 LLM 动态生成追问建议。
 *
 * 返回 DynamicFollowUpResult（不抛异常）：
 * - source='llm'：LLM 动态结果，调用方可替换本地池。
 * - source='fallback'：后端 LLM 未走通（固定兜底问题），调用方保留本地池 + 标记降级态。
 * - source='unavailable'：网络/超时/非 200/无效响应，调用方保留本地池（静默降级）。
 */
export async function fetchDynamicFollowUpSuggestions(
  params: FetchDynamicFollowUpSuggestionsParams,
): Promise<DynamicFollowUpResult> {
  // 防御：question 为空（极端场景下最后一条 user 消息缺失）时直接降级本地，
  // 避免向后端发送空 question 触发 422。
  if (!params.question || !params.question.trim()) {
    logger.debug('[FollowUpSuggestionApi] question 为空，跳过动态追问，降级到本地规则引擎')
    return { source: 'unavailable', suggestions: null }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DYNAMIC_SUGGESTION_TIMEOUT_MS)

  // 组装结构化领域上下文：仅包含有值的字段，取不到就不传（向后兼容旧后端）。
  const domainContext: Record<string, unknown> = {}
  if (params.formula_context) domainContext.formula_context = params.formula_context
  if (params.constitution) domainContext.constitution = params.constitution
  if (params.user_constraints) domainContext.user_constraints = params.user_constraints
  if (params.rag_context && params.rag_context.length > 0) domainContext.rag_context = params.rag_context
  if (params.dialectics_summary) domainContext.dialectics_summary = params.dialectics_summary
  if (params.compliance_context) domainContext.compliance_context = params.compliance_context

  try {
    const data = await fetchWithCsrf<FollowUpSuggestionApiResponse>(
      API_ENDPOINTS.AI.FOLLOW_UP_SUGGESTIONS,
      {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          question: params.question,
          answer: params.answer,
          history: params.history && params.history.length > 0 ? params.history : null,
          max_suggestions: params.maxSuggestions ?? 3,
          ...domainContext,
        }),
      },
    )

    const suggestions = data && Array.isArray(data.suggestions) ? mapSuggestions(data.suggestions) : []

    // 响应无效 → 不可用
    if (!data || data.success !== true || !Array.isArray(data.suggestions) || suggestions.length === 0) {
      logger.debug('[FollowUpSuggestionApi] 动态追问响应无效，降级到本地规则引擎')
      return { source: 'unavailable', suggestions: null }
    }

    // 后端自身返回 fallback（LLM 未走通）→ 透传 source，调用方标记降级态
    if (data.source === 'fallback') {
      logger.debug('[FollowUpSuggestionApi] 后端返回 fallback（LLM 未走通），调用方标记降级并保留本地池')
      return { source: 'fallback', suggestions }
    }

    // LLM 动态结果
    return { source: 'llm', suggestions }
  } catch (error) {
    const errName = (error as { name?: string } | null)?.name
    if (errName === 'AbortError') {
      logger.warn('[FollowUpSuggestionApi] 动态追问请求超时，降级到本地规则引擎')
    } else {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.warn('[FollowUpSuggestionApi] 动态追问请求失败，降级到本地规则引擎:', errMsg)
    }
    return { source: 'unavailable', suggestions: null }
  } finally {
    clearTimeout(timeoutId)
  }
}
