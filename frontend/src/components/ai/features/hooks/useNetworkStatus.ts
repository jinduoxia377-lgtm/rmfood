/**
 * useNetworkStatus — 网络状态感知 React Hook
 *
 * 基于 networkAwareness.ts，提供声明式网络状态访问：
 * - isOnline / effectiveType / rtt / downlink
 * - isSlowConnection（<3g 或 rtt > 300ms）
 * - 自动订阅/取消订阅网络变化事件
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { getNetworkAwareness, type NetworkStatus } from '../utils/networkAwareness'
import { logger } from '@/utils/safeLogger'

interface UseNetworkStatusReturn extends NetworkStatus {
  /** 重新获取最新状态 */
  refresh: () => void
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    return getNetworkAwareness().getStatus()
  })

  useEffect(() => {
    const awareness = getNetworkAwareness()
    const unsubscribe = awareness.subscribe((newStatus) => {
      setStatus(newStatus)
    })

    logger.debug('[useNetworkStatus] Hook 已初始化并订阅')

    return () => {
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(() => {
    const current = getNetworkAwareness().getStatus()
    setStatus(current)
    logger.debug('[useNetworkStatus] 手动刷新状态', current)
  }, [])

  return useMemo(() => ({
    ...status,
    refresh,
  }), [status, refresh])
}

export type { NetworkStatus }
export default useNetworkStatus
