/**
 * useRAGContext - RAG 知识库上下文 Hook
 *
 * 管理 RAG 开关状态、检索结果缓存，
 * 提供消息发送时的 RAG 增强注入功能。
 * v2.0: 添加种子注入状态检查
 */

import { useState, useCallback, useRef, useEffect } from 'react'
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
  /** 对用户输入进行 RAG 增强，返回增强后的文本 */
  augment: (question: string) => Promise<string>
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
  /** 触发种子注入 */
  triggerSeed: () => Promise<void>
}

export function useRAGContext(): RAGContextState {
  const [isEnabled, setIsEnabled] = useState(false)
  const [chunks, setChunks] = useState<RAGChunkResult[]>([])
  const [hasActiveChunks, setHasActiveChunks] = useState(false)
  const [lastSources, setLastSources] = useState<string[]>([])
  const [lastQuerySuccess, setLastQuerySuccess] = useState(false)
  const [isSeeded, setIsSeeded] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [totalChunks, setTotalChunks] = useState(0)

  // 启动时检查种子注入状态
  useEffect(() => {
    const checkSeedStatus = async () => {
      try {
        const status = await getSeedStatus()
        setIsSeeded(status.is_seeded)
        setTotalChunks(status.total_chunks ?? 0)
        if (!status.is_seeded) {
          logger.info('[useRAGContext] 知识库尚未注入种子数据，建议手动触发')
        }
      } catch (error) {
        logger.warn('[useRAGContext] 检查种子状态失败:', error)
      }
    }
    checkSeedStatus()
  }, [])

  const triggerSeed = useCallback(async () => {
    setIsSeeding(true)
    try {
      const result = await seedKnowledgeBase()
      setIsSeeded(result.seeded)
      // 注入后刷新真实块数
      try {
        const status = await getSeedStatus()
        setIsSeeded(status.is_seeded)
        setTotalChunks(status.total_chunks ?? 0)
      } catch {
        /* 状态刷新失败不影响注入结果 */
      }
      logger.info('[useRAGContext] 种子注入完成:', result)
    } catch (error) {
      logger.error('[useRAGContext] 种子注入失败:', error)
    } finally {
      setIsSeeding(false)
    }
  }, [])

  const augment = useCallback(async (question: string): Promise<string> => {
    if (!isEnabled || !question.trim()) return question

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

        return result.augmented_prompt
      }

      // 无结果时返回原始问题
      setLastQuerySuccess(false)
      setLastSources([])
      return question
    } catch (error) {
      logger.warn('[useRAGContext] RAG 检索失败，使用原始问题:', error)
      setLastQuerySuccess(false)
      return question
    }
  }, [isEnabled])

  const toggleRAG = useCallback(() => {
    setIsEnabled(prev => !prev)
    if (isEnabled) {
      setChunks([])
      setHasActiveChunks(false)
    }
  }, [isEnabled])

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

  return {
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
  }
}
