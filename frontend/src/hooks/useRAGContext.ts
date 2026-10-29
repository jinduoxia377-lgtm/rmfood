/**
 * useRAGContext - RAG 知识库上下文 Hook
 *
 * 管理 RAG 开关状态、检索结果缓存，
 * 提供消息发送时的 RAG 增强注入功能。
 * v2.0: 添加种子注入状态检查
 * v3.0 (P0-6): 改造为真实 React Context + Provider —— 消除「面板注入后 TopBar 不同步」。
 *
 * 此前 useRAGContext 是普通 Hook（内部 useState），每次调用都会新建一套独立状态：
 * - ChatStateProvider.tsx（实例 A，TopBar/聊天读取）
 * - RAGKnowledgePanel.tsx（实例 B，面板自用）
 * 面板的 seed/upload/delete 只更新实例 B，实例 A 不变 → TopBar 状态、isSeeded 门控、
 * augment 注入相互脱节。现改为 Context + Provider：AIAssistantPage 顶层挂载唯一
 * RAGContextProvider，ChatStateProvider 与 knowledge tab 的 KnowledgeBasePanel 均从
 * 同一个 Provider 读取，实现状态全局共享。
 */

import {
  useState, useCallback, useEffect, useMemo, createContext, useContext, createElement,
  type ReactNode,
} from 'react'
import { queryRAG, seedKnowledgeBase, getSeedStatus, type RAGChunkResult } from '@/api/rag'
import { logger } from '@/utils/safeLogger'

export interface RAGContextState {
  /** RAG 增强是否启用 */
  isEnabled: boolean
  /** 切换 RAG 状态 */
  toggleRAG: () => void
  /** 设置 RAG 状态 */
  setRAGEnabled: (enabled: boolean) => void
  /** 当前检索到的文档块 */
  chunks: RAGChunkResult[]
  /** 最后一次检索的源文件列表 */
  lastSources: string[]
  /** 对用户输入进行 RAG 增强，返回增强后的文本和 rag_context */
  augment: (question: string) => Promise<{ question: string; rag_context: string[] | null }>
  /** 清除检索结果 */
  clearChunks: () => void
  /** 是否有知识库数据（用于显示） */
  hasActiveChunks: boolean
  /** 最后一次检索是否成功 */
  lastQuerySuccess: boolean
  /** 知识库是否已注入种子数据 */
  isSeeded: boolean
  /** 种子注入是否进行中 */
  isSeeding: boolean
  /** 知识库当前文档块总数（未 seed 时为 0） */
  totalChunks: number
  /** 触发种子注入（成功时返回 true 并自动启用 RAG） */
  triggerSeed: () => Promise<boolean>
  /**
   * P0-6: 重新拉取种子状态并同步 isSeeded / totalChunks。
   * 面板 upload/delete 成功后调用，使 TopBar 与面板共享同一份 Context 状态。
   * P3 修复：返回最新状态，供 onSeedComplete 等回调拿到最新 totalChunks（避免 stale 闭包）。
   */
  refreshSeedStatus: () => Promise<{ is_seeded: boolean; total_chunks: number }>
  /**
   * P2-5: 种子注入失败原因码（embedding_unavailable / network / server / unknown），
   * 成功时为 null。面板据此显示「种子注入失败：<原因>」而非静默。
   */
  seedError: string | null
  /** 清除种子注入错误提示 */
  clearSeedError: () => void
}

// ── 兜底默认值（未挂载 Provider 时返回，与 usePermission.tsx 的 usePermissionContext 模式一致）──
const noop = () => {}
const defaultAugment = async (question: string) => ({ question, rag_context: null })
const defaultTriggerSeed = async () => false
const defaultRefreshSeedStatus = async () => ({ is_seeded: false, total_chunks: 0 })

/** 模块级常量，引用稳定，避免外部（未挂 Provider）调用时产生新对象引发重渲染循环 */
const DEFAULT_RAG_STATE: RAGContextState = {
  isEnabled: false,
  toggleRAG: noop,
  setRAGEnabled: noop,
  chunks: [],
  lastSources: [],
  augment: defaultAugment,
  clearChunks: noop,
  hasActiveChunks: false,
  lastQuerySuccess: false,
  isSeeded: false,
  isSeeding: false,
  totalChunks: 0,
  triggerSeed: defaultTriggerSeed,
  refreshSeedStatus: defaultRefreshSeedStatus,
  seedError: null,
  clearSeedError: noop,
}

const RAGContext = createContext<RAGContextState | null>(null)

/**
 * P2-5: 从种子注入错误中提取可区分的原因码（供面板 i18n 映射显示）。
 * - 503 → embedding_unavailable（Embedding 服务不可用，/rag/seed 明确返回 503）
 * - 其他 5xx → server
 * - 网络/超时/连接中断 → network
 * - 其余 → unknown
 */
function toSeedErrorCode(error: unknown): string {
  const err = error as { code?: string; response?: { status?: number } }
  const status = err?.response?.status
  if (status === 503) return 'embedding_unavailable'
  if (status && status >= 500) return 'server'
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET' || !status) return 'network'
  return 'unknown'
}

/**
 * RAGContextProvider - RAG 知识库共享状态的唯一来源。
 * 挂载于 AIAssistantPage 顶层，包裹 ChatStateProvider 与 knowledge tab 的 KnowledgeBasePanel。
 */
export function RAGContextProvider({ children }: { children: ReactNode }) {
  // RAG 启用状态持久化到 sessionStorage（刷新后保持，关闭标签页后重置）
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('rag_enabled') === 'true'
    } catch {
      return false
    }
  })
  const [chunks, setChunks] = useState<RAGChunkResult[]>([])
  const [hasActiveChunks, setHasActiveChunks] = useState(false)
  const [lastSources, setLastSources] = useState<string[]>([])
  const [lastQuerySuccess, setLastQuerySuccess] = useState(false)
  const [isSeeded, setIsSeeded] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [totalChunks, setTotalChunks] = useState(0)
  // P2-5: 种子注入失败原因码（成功为 null），供面板显示「种子注入失败：<原因>」
  const [seedError, setSeedError] = useState<string | null>(null)

  // P0-6: 重新拉取种子状态并同步 isSeeded / totalChunks（供面板 upload/delete 后调用）。
  // P3 修复：返回最新状态，供 onSeedComplete 等回调拿到最新 totalChunks（避免 stale 闭包）。
  const refreshSeedStatus = useCallback(async (): Promise<{ is_seeded: boolean; total_chunks: number }> => {
    try {
      const status = await getSeedStatus()
      setIsSeeded(status.is_seeded)
      setTotalChunks(status.total_chunks ?? 0)
      return { is_seeded: status.is_seeded, total_chunks: status.total_chunks ?? 0 }
    } catch (error) {
      logger.warn('[useRAGContext] 刷新种子状态失败:', error)
      return { is_seeded: false, total_chunks: 0 }
    }
  }, [])

  // 启动时检查种子注入状态（与旧版行为一致：以接口返回的 is_seeded 为准记录日志）
  useEffect(() => {
    getSeedStatus()
      .then(status => {
        setIsSeeded(status.is_seeded)
        setTotalChunks(status.total_chunks ?? 0)
        if (!status.is_seeded) {
          logger.info('[useRAGContext] 知识库尚未注入种子数据，建议手动触发')
        }
      })
      .catch(error => {
        logger.warn('[useRAGContext] 检查种子状态失败:', error)
      })
  }, [])

  // 持久化 RAG 启用状态到 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('rag_enabled', String(isEnabled))
    } catch {
      // sessionStorage 不可用时静默失败
    }
  }, [isEnabled])

  const triggerSeed = useCallback(async (): Promise<boolean> => {
    setIsSeeding(true)
    setSeedError(null)
    try {
      const result = await seedKnowledgeBase()
      // 以后端实际状态为准（seed 接口可能在 Embedding 不可用时仍返回 seeded=true，
      // 但向量库为空；以 seed/status 的 is_seeded 判断是否真正可用）
      let seeded = result.seeded
      try {
        const status = await getSeedStatus()
        setIsSeeded(status.is_seeded)
        setTotalChunks(status.total_chunks ?? 0)
        seeded = status.is_seeded
      } catch {
        // 状态刷新失败时退回到接口返回值
        setIsSeeded(result.seeded)
        setTotalChunks(result.total_chunks ?? 0)
      }
      // 真正注入成功才开启 RAG 增强
      if (seeded) {
        setIsEnabled(true)
      } else {
        // P2-5: 后端返回 seeded=false（Embedding 不可用，/rag/seed 通常返回 503）
        // 此前静默返回 false 无任何提示；现暴露可区分原因码供面板显示。
        setSeedError('embedding_unavailable')
      }
      logger.info('[useRAGContext] 种子注入完成:', { ...result, seeded })
      return seeded
    } catch (error) {
      logger.error('[useRAGContext] 种子注入失败:', error)
      // P2-5: 暴露可区分的原因码，供面板显示「种子注入失败：<原因>」而非静默
      setSeedError(toSeedErrorCode(error))
      return false
    } finally {
      setIsSeeding(false)
    }
  }, [])

  const clearSeedError = useCallback(() => setSeedError(null), [])

  const augment = useCallback(async (question: string): Promise<{ question: string; rag_context: string[] | null }> => {
    if (!isEnabled || !question.trim()) return { question, rag_context: null }

    try {
      const result = await queryRAG(question, 5)

      if (result.chunks && result.chunks.length > 0) {
        setChunks(result.chunks)
        setHasActiveChunks(true)
        setLastQuerySuccess(true)

        // 提取唯一源文件列表
        const sources = [...new Set(result.chunks.map(c => c.source))]
        setLastSources(sources)

        logger.info('[useRAGContext] RAG 检索成功:', {
          chunks: result.chunks.length,
          sources: sources.length,
          totalInKB: result.total_chunks,
        })

        // 返回原始问题 + rag_context（chunks 内容列表）
        // 后端 _build_system_prompt 会将 rag_context 注入 system prompt
        return {
          question,
          rag_context: result.chunks.map(c => c.content),
        }
      }

      // 无结果时返回原始问题，无 rag_context
      setLastQuerySuccess(false)
      setLastSources([])
      return { question, rag_context: null }
    } catch (error) {
      // 区分超时与网关错误，便于定位「后端 RAG 检索慢」根因
      // （queryRAG 已在 12s 超时 + 2s 重试后仍失败才走到这里）
      const err = error as { code?: string; response?: { status?: number }; message?: string }
      const isTimeout = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message ?? '')
      logger.warn('[useRAGContext] RAG 检索失败，使用原始问题:', {
        timeout: isTimeout || undefined,
        status: err?.response?.status ?? undefined,
        error: error instanceof Error ? error.message : String(error),
      })
      setLastQuerySuccess(false)
      return { question, rag_context: null }
    }
  }, [isEnabled])

  const toggleRAG = useCallback(() => {
    setIsEnabled(prev => {
      const next = !prev
      if (!next) {
        // 关闭时清除检索缓存
        setChunks([])
        setHasActiveChunks(false)
      }
      return next
    })
  }, [])

  const setRAGEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled)
    if (!enabled) {
      setChunks([])
      setHasActiveChunks(false)
    }
  }, [])

  const clearChunks = useCallback(() => {
    setChunks([])
    setHasActiveChunks(false)
    setLastSources([])
    setLastQuerySuccess(false)
  }, [])

  // P0 修复：用 useMemo 包裹返回值 — 原实现返回普通对象字面量，
  // 每次渲染产生新引用 → ChatStateProvider 的 useMemo 依赖 rag 永远变化 →
  // contextValue 永远重算 → 所有 ChatStateContext 消费者重渲染 →
  // FollowUpSuggestionsBar useEffect 无限循环（4秒内生成30+次）。
  const value = useMemo<RAGContextState>(() => ({
    isEnabled,
    toggleRAG,
    setRAGEnabled,
    chunks,
    lastSources,
    augment,
    clearChunks,
    hasActiveChunks,
    lastQuerySuccess,
    isSeeded,
    isSeeding,
    totalChunks,
    triggerSeed,
    refreshSeedStatus,
    seedError,
    clearSeedError,
  }), [isEnabled, toggleRAG, setRAGEnabled, chunks, lastSources, augment, clearChunks, hasActiveChunks, lastQuerySuccess, isSeeded, isSeeding, totalChunks, triggerSeed, refreshSeedStatus, seedError, clearSeedError])

  // 本文件为 .ts（非 .tsx），用 createElement 而非 JSX 渲染 Provider
  return createElement(RAGContext.Provider, { value }, children)
}

/**
 * useRAGContext - 读取共享 RAG 上下文。
 * 必须在 RAGContextProvider 内使用；未挂载时返回默认值（与 usePermission 模式一致）。
 */
export function useRAGContext(): RAGContextState {
  const context = useContext(RAGContext)
  return context ?? DEFAULT_RAG_STATE
}
