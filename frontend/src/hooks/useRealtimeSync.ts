/**
 * 实时数据同步 Hook
 *
 * 监听 CDC WebSocket 消息，自动刷新相关数据。
 * 当数据库发生变更时，前端 UI 自动更新，无需手动刷新。
 *
 * 使用方式:
 *   // 在 App 或 Layout 组件中调用
 *   useRealtimeSync()
 *
 * 架构:
 *   WebSocket → CDC 消息 → React Query 缓存失效 → UI 自动更新
 */
import { useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { wsService } from '@/services/websocket'
import { logger } from '@/utils/safeLogger'

/** CDC 变更事件数据 */
export interface CDCChangeEvent {
  entity_type: string
  entity_id: number
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_fields?: string[]
  user_id?: number
  timestamp?: string
}

/** WebSocket CDC 消息 */
interface CDCMessage {
  type: 'data_change'
  data: CDCChangeEvent
  channel?: string
}

/** 实体类型到 React Query key 的映射 */
const ENTITY_QUERY_KEY_MAP: Record<string, string[]> = {
  formulas: ['formulas', 'formula', 'dashboard'],
  experiments: ['experiments', 'experiment', 'dashboard'],
  users: ['users', 'user', 'auth', 'admin-users'],
  teams: ['teams', 'team'],
  team_members: ['teams', 'team'],
  notifications: ['notifications'],
  workflows: ['workflows', 'workflow'],
  ingredients: ['ingredients'],
  peptides: ['peptides', 'peptide'],
  comments: ['comments'],
  formula_versions: ['formulas', 'formula'],
  chat_sessions: ['chat-sessions', 'chat-session'],
  chat_messages: ['chat-messages', 'chat-session'],
  peptide_designs: ['peptide-designs', 'peptide-design'],
  peptide_analyses: ['peptide-analyses', 'peptide-analysis'],
  audit_logs: ['audit-logs', 'admin-audit-logs'],
  sync_logs: ['sync-logs'],
  ai_suggestions: ['ai-suggestions'],
  prompt_templates: ['prompt-templates'],
  prompt_versions: ['prompt-versions'],
}

/**
 * 实时数据同步 Hook
 *
 * 监听 WebSocket CDC 消息，自动失效相关 React Query 缓存。
 * 使用防抖机制避免频繁刷新。
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const pendingInvalidations = useRef<Set<string>>(new Set())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 批量刷新缓存（防抖 200ms） */
  const flushInvalidations = useCallback(() => {
    if (pendingInvalidations.current.size === 0) return

    const keys = Array.from(pendingInvalidations.current)
    pendingInvalidations.current.clear()

    logger.info(`🔄 CDC 触发缓存刷新: ${keys.join(', ')}`)

    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }, [queryClient])

  /** 计划刷新（防抖） */
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
    }
    flushTimer.current = setTimeout(flushInvalidations, 200)
  }, [flushInvalidations])

  /** 处理 CDC 消息 */
  const handleCDCMessage = useCallback(
    (message: CDCMessage) => {
      if (message.type !== 'data_change') return

      const { entity_type, entity_id, action, changed_fields } = message.data
      logger.debug(
        `📡 CDC 事件: ${action} ${entity_type}:${entity_id} fields=${changed_fields?.join(',')}`,
      )

      // 获取需要刷新的查询 key
      const queryKeys = ENTITY_QUERY_KEY_MAP[entity_type]
      if (!queryKeys) {
        logger.debug(`⚠️ 未知实体类型: ${entity_type}`)
        return
      }

      // 添加到待刷新集合
      for (const key of queryKeys) {
        pendingInvalidations.current.add(key)
      }

      // 如果是特定实体的更新，也刷新该实体的详情
      if (action === 'UPDATE' || action === 'DELETE') {
        pendingInvalidations.current.add(`${entity_type.slice(0, -1)}`) // formulas → formula
      }

      // 计划刷新
      scheduleFlush()
    },
    [scheduleFlush],
  )

  useEffect(() => {
    // 订阅 WebSocket CDC 消息
    const unsubscribe = wsService.onMessage((rawMessage: unknown) => {
      try {
        const message = rawMessage as CDCMessage
        if (message.type === 'data_change') {
          handleCDCMessage(message)
        }
      } catch (error) {
        // 忽略非 CDC 消息
      }
    })

    logger.info('📡 实时数据同步已启动')

    return () => {
      unsubscribe()
      if (flushTimer.current) {
        clearTimeout(flushTimer.current)
      }
      logger.info('📡 实时数据同步已停止')
    }
  }, [handleCDCMessage])
}

/**
 * 实时实体 Hook
 *
 * 监听特定实体类型的变更，当该实体发生变更时触发回调。
 *
 * 使用方式:
 *   useRealtimeEntity('formulas', (change) => {
 *     logger.log('配方变更:', change)
 *   })
 */
export function useRealtimeEntity(
  entityType: string,
  onChange?: (change: CDCChangeEvent) => void,
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = wsService.onMessage((rawMessage: unknown) => {
      try {
        const message = rawMessage as CDCMessage
        if (message.type === 'data_change' && message.data.entity_type === entityType) {
          // 刷新相关查询
          queryClient.invalidateQueries({ queryKey: [entityType] })

          // 触发回调
          onChange?.(message.data)
        }
      } catch {
        // 忽略非 CDC 消息
      }
    })

    return unsubscribe
  }, [entityType, onChange, queryClient])
}

/**
 * 实时计数 Hook
 *
 * 监听实体变更并维护一个计数器（用于未读数等场景）。
 *
 * 使用方式:
 *   const changeCount = useRealtimeCount('notifications')
 */
export function useRealtimeCount(entityType: string): number {
  const countRef = useRef(0)

  useEffect(() => {
    const unsubscribe = wsService.onMessage((rawMessage: unknown) => {
      try {
        const message = rawMessage as CDCMessage
        if (message.type === 'data_change' && message.data.entity_type === entityType) {
          if (message.data.action === 'INSERT') {
            countRef.current += 1
          }
        }
      } catch {
        // 忽略
      }
    })

    return unsubscribe
  }, [entityType])

  return countRef.current
}
