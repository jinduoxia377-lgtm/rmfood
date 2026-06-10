/**
 * useRAGContext - RAG 知识库上下文 Hook
 *
 * 管理 RAG 开关状态、检索结果缓存，
 * 提供消息发送时的 RAG 增强注入功能。
 */

import { useState, useCallback, useRef } from 'react'
import { queryRAG, type RAGChunkResult } from '@/api/rag'
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
}

export function useRAGContext(): RAGContextState {
  const [isEnabled, setIsEnabled] = useState(false)
  const [chunks, setChunks] = useState<RAGChunkResult[]>([])
  const [hasActiveChunks, setHasActiveChunks] = useState(false)
  const [lastSources, setLastSources] = useState<string[]>([])
  const [lastQuerySuccess, setLastQuerySuccess] = useState(false)

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
  }
}
