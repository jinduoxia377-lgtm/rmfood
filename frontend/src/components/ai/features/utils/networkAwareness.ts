/**
 * networkAwareness — 网络状态感知工具
 *
 * 功能：
 * - 检测在线/离线状态（navigator.onLine + online/offline 事件）
 * - 连接质量评估（NetworkInformation API：effectiveType / rtt / downlink）
 * - 所有网络 API 做特性检测，fallback 到 navigator.onLine
 */
import { logger } from '@/utils/safeLogger'

export interface NetworkStatus {
  isOnline: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  rtt?: number          // 往返时间 ms
  downlink?: number     // 下行速度 Mbps
  saveData?: boolean    // 是否开启省流模式
  isSlowConnection: boolean // <3g 或 rtt > 300ms
}

type NetworkChangeListener = (status: NetworkStatus) => void

/** 网络类型排序（用于判断慢速连接） */
const SLOW_TYPES = new Set(['slow-2g', '2g'])
const RTT_SLOW_THRESHOLD = 300 // ms

/**
 * 获取当前网络连接信息（特性检测 + fallback）
 */
function getConnectionInfo(): Partial<NetworkStatus> {
  if (typeof navigator === 'undefined') {
    return { isOnline: true, isSlowConnection: false }
  }

  const nav = navigator

  // 尝试获取 NetworkInformation API
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection

  if (!connection) {
    // fallback：仅使用 onLine
    return {
      isOnline: navigator.onLine ?? true,
      isSlowConnection: false,
    }
  }

  const effectiveType = connection.effectiveType as NetworkStatus['effectiveType'] | undefined
  const rtt = typeof connection.rtt === 'number' ? connection.rtt : undefined
  const downlink = typeof connection.downlink === 'number' ? connection.downlink : undefined
  const saveData = !!connection.saveData

  const isSlowConnection =
    (effectiveType !== undefined && SLOW_TYPES.has(effectiveType)) ||
    (rtt !== undefined && rtt > RTT_SLOW_THRESHOLD)

  return {
    isOnline: navigator.onLine ?? true,
    effectiveType,
    rtt,
    downlink,
    saveData,
    isSlowConnection,
  }
}

class NetworkAwareness {
  private listeners: Set<NetworkChangeListener> = new Set()
  private currentStatus: NetworkStatus
  private boundOnlineHandler: () => void
  private boundOfflineHandler: () => void
  private boundChangeHandler: () => void
  private connectionEventListener: EventListener | null = null

  constructor() {
    this.currentStatus = this.buildStatus()
    this.boundOnlineHandler = this.handleOnline.bind(this)
    this.boundOfflineHandler = this.handleOffline.bind(this)
    this.boundChangeHandler = this.handleChange.bind(this)

    if (typeof window !== 'undefined') {
      this.setupListeners()
    }
  }

  private buildStatus(): NetworkStatus {
    const info = getConnectionInfo()
    return info as NetworkStatus
  }

  private setupListeners(): void {
    window.addEventListener('online', this.boundOnlineHandler)
    window.addEventListener('offline', this.boundOfflineHandler)

    // 监听 NetworkInformation 变化
    const nav = navigator
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection

    if (connection) {
      this.connectionEventListener = this.boundChangeHandler
      connection.addEventListener('change', this.connectionEventListener)
      logger.debug('[NetworkAwareness] NetworkInformation API 已监听')
    }
  }

  private handleOnline(): void {
    logger.info('[NetworkAwareness] 网络已恢复在线')
    this.updateStatus()
  }

  private handleOffline(): void {
    logger.warn('[NetworkAwareness] 网络已断开离线')
    this.updateStatus()
  }

  private handleChange(): void {
    logger.debug('[NetworkAwareness] 网络连接质量变化')
    this.updateStatus()
  }

  private updateStatus(): void {
    this.currentStatus = this.buildStatus()
    this.notifyListeners()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus)
      } catch (error) {
        logger.error('[NetworkAwareness] 监听器回调异常:', error)
      }
    }
  }

  /** 获取当前网络状态快照 */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus }
  }

  /** 订阅网络状态变化 */
  subscribe(listener: NetworkChangeListener): () => void {
    this.listeners.add(listener)

    // 立即推送一次当前状态
    try {
      listener(this.currentStatus)
    } catch (_error) {
      // 忽略首次调用异常
    }

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 销毁实例，清理所有监听器 */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnlineHandler)
      window.removeEventListener('offline', this.boundOfflineHandler)

      const nav = navigator
      const connection = nav.connection || nav.mozConnection || nav.webkitConnection
      if (connection && this.connectionEventListener) {
        connection.removeEventListener('change', this.connectionEventListener)
      }
    }

    this.listeners.clear()
    logger.debug('[NetworkAwareness] 实例已销毁')
  }
}

// ===== 单例模式 =====
let instance: NetworkAwareness | null = null

export function getNetworkAwareness(): NetworkAwareness {
  if (!instance) {
    instance = new NetworkAwareness()
  }
  return instance
}

export { NetworkAwareness }
export default getNetworkAwareness
