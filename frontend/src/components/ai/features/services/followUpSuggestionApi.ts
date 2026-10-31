/**
 * followUpSuggestionApi — 追问建议动态生成 API
 *
 * 优先调用后端 LLM 动态生成贴合当前对话的追问建议；
 * 网络错误/超时/非 200/返回 fallback 时返回 null，由调用方降级到本地规则引擎。
 *
 * 请求风格与 chatService 保持一致：直接使用 fetch（携带 Cookie 与 CSRF token）。
 */
import { API_ENDPOINTS } from '@/config/apiEndpoints'
import { fetchWithCsrf } from '@/utils/csrf'
import { logger } from '@/utils/safeLogger'
import type { FollowUpSuggestion } from './followUpSuggestionService'

/** 动态追问请求超时时间（毫秒）
 * 10s → 20s：agnes-ai 上游响应慢时，10s 几乎必然超时降级，导致 LLM 动态生成追问从未生效；
 * 20s 给上游更多时间，且不阻塞 UI（FollowUpSuggestionsBar 先显示本地结果，成功后异步替换）。
 */
const DYNAMIC_SUGGESTION_TIMEOUT_MS = 20_000

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

/** 动态追问请求参数 */
export interface FetchDynamicFollowUpSuggestionsParams {
  /** 用户最近的问题（最后一条 user 消息内容） */
  question: string
  /** AI 最后一条回复内容 */
  answer: string
  /** 最近若干条对话历史（可选） */
  history?: Array<{ role: 'user' | 'assistant'; content: string }> | null
  /** 最大建议数 */
  maxSuggestions?: number
}

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

/**
 * 调用后端 LLM 动态生成追问建议。
 *
 * 成功（HTTP 200 且 source !== "fallback" 且 suggestions 非空）时返回映射后的
 * FollowUpSuggestion[]；任何失败情况（网络错误/超时/非 200/响应无效/后端 fallback）
 * 一律返回 null，不抛异常，由调用方降级到本地规则引擎。
 */
export async function fetchDynamicFollowUpSuggestions(
  params: FetchDynamicFollowUpSuggestionsParams,
): Promise<FollowUpSuggestion[] | null> {
  // 防御：question 为空（极端场景下最后一条 user 消息缺失）时直接降级本地，
  // 避免向后端发送空 question 触发 422。
  if (!params.question || !params.question.trim()) {
    logger.debug('[FollowUpSuggestionApi] question 为空，跳过动态追问，降级到本地规则引擎')
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DYNAMIC_SUGGESTION_TIMEOUT_MS)

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
        }),
      },
    )

    // 响应无效或后端自身返回 fallback → 视为不可用，降级到本地规则引擎
    if (
      !data ||
      data.success !== true ||
      data.source === 'fallback' ||
      !Array.isArray(data.suggestions) ||
      data.suggestions.length === 0
    ) {
      logger.debug('[FollowUpSuggestionApi] 动态追问响应无效或后端返回 fallback，降级到本地规则引擎')
      return null
    }

    const now = Date.now()
    return data.suggestions
      .map((item, index) => ({
        id: `dynamic-${now}-${index}`,
        question: item.question || '',
        category: item.category || '药材知识',
        categoryKey: mapCategoryToKey(item.category),
        confidence: 1,
        source: 'llm' as const,
      }))
      .filter(s => s.question.length > 0)
  } catch (error) {
    const errName = (error as { name?: string } | null)?.name
    if (errName === 'AbortError') {
      logger.warn('[FollowUpSuggestionApi] 动态追问请求超时，降级到本地规则引擎')
    } else {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.warn('[FollowUpSuggestionApi] 动态追问请求失败，降级到本地规则引擎:', errMsg)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}