import { logger } from '@/utils/safeLogger';

/**
 * 冲突解决工具类
 * - 基于时间戳和版本号的冲突检测与处理
 * - 支持乐观锁机制
 * - 提供冲突解决策略
 */

interface ConflictResolverOptions {
  timestampField?: string
  versionField?: string
  defaultStrategy?: ConflictResolutionStrategy
}

export type ConflictResolutionStrategy = 'server_wins' | 'client_wins' | 'merge' | 'prompt'

export interface ConflictContext {
  clientData: any
  serverData: any
  timestamp: number
  entityType: string
  entityId: string
}

export interface ConflictResolution {
  resolvedData: any
  strategy: ConflictResolutionStrategy
  resolvedAt: number
}

export type OperationType = 'insert' | 'delete' | 'update' | 'format'

export interface CollaborationOperation {
  id: string
  userId: string
  type: OperationType
  target: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'code'
    id: string
  }
  before?: unknown
  after?: unknown
  timestamp: Date | number
  version: number
}

export interface CollaborationConflict {
  id: string
  type: 'text' | 'format' | 'delete'
  originalOperation: CollaborationOperation
  incomingOperation: CollaborationOperation
  status: 'pending' | 'detected' | 'resolved'
  resolution?: 'keep-local' | 'keep-remote' | 'merge' | 'manual'
  resolvedAt?: Date | number
  resolvedBy?: string
}

export interface ConflictMarker {
  operationId: string
  type: 'text' | 'format' | 'delete'
  startOffset: number
  endOffset: number
  isLocal: boolean
  timestamp: Date | number
}

export class ConflictResolver {
  private timestampField: string
  private versionField: string
  private defaultStrategy: ConflictResolutionStrategy
  private pendingConflicts = new Map<string, CollaborationConflict>()
  private conflictListeners = new Set<(conflict: CollaborationConflict) => void>()

  constructor(options: ConflictResolverOptions = {}) {
    this.timestampField = options.timestampField || 'updated_at'
    this.versionField = options.versionField || 'version'
    this.defaultStrategy = options.defaultStrategy || 'server_wins'
  }

  detectOperationConflict(
    localOp: CollaborationOperation,
    remoteOp: CollaborationOperation,
  ): boolean {
    if (localOp.target.id !== remoteOp.target.id) {
      return false
    }

    if (localOp.type === 'delete' && remoteOp.type === 'delete') {
      return true
    }

    if (localOp.type === 'update' && remoteOp.type === 'update') {
      return true
    }

    if (localOp.type === 'format' && remoteOp.type === 'format') {
      return true
    }

    const localTime = new Date(localOp.timestamp).getTime()
    const remoteTime = new Date(remoteOp.timestamp).getTime()
    const timeDiff = Math.abs(localTime - remoteTime)

    return timeDiff < 5000 && localOp.userId !== remoteOp.userId
  }

  detectConflict(clientData: any, serverData: any): boolean {
    if (!clientData || !serverData) {
      return false
    }

    // 基于版本号检测
    if (clientData[this.versionField] && serverData[this.versionField]) {
      return clientData[this.versionField] < serverData[this.versionField]
    }

    // 基于时间戳检测
    if (clientData[this.timestampField] && serverData[this.timestampField]) {
      const clientTime = new Date(clientData[this.timestampField]).getTime()
      const serverTime = new Date(serverData[this.timestampField]).getTime()
      return clientTime < serverTime
    }

    return false
  }

  /**
   * 解决冲突
   * @param context 冲突上下文
   * @param strategy 解决策略
   * @returns 解决结果
   */
  resolveConflict(
    context: ConflictContext,
    strategy?: ConflictResolutionStrategy,
  ): ConflictResolution {
    const resolutionStrategy = strategy || this.defaultStrategy
    let resolvedData: any

    switch (resolutionStrategy) {
      case 'server_wins':
        resolvedData = this.serverWins(context)
        break

      case 'client_wins':
        resolvedData = this.clientWins(context)
        break

      case 'merge':
        resolvedData = this.merge(context)
        break

      case 'prompt':
        // 提示用户解决冲突，这里返回服务器数据作为默认
        resolvedData = this.serverWins(context)
        break

      default:
        resolvedData = this.serverWins(context)
    }

    return {
      resolvedData,
      strategy: resolutionStrategy,
      resolvedAt: Date.now(),
    }
  }

  /**
   * 服务器优先策略
   */
  private serverWins(context: ConflictContext): any {
    return {
      ...context.serverData,
      // 保留客户端可能的新字段
      ...this.getNewClientFields(context.clientData, context.serverData),
    }
  }

  /**
   * 客户端优先策略
   */
  private clientWins(context: ConflictContext): any {
    return {
      ...context.clientData,
      // 更新版本号和时间戳
      [this.versionField]: (context.serverData[this.versionField] || 0) + 1,
      [this.timestampField]: new Date().toISOString(),
    }
  }

  /**
   * 合并策略
   */
  private merge(context: ConflictContext): any {
    const clientData = context.clientData
    const serverData = context.serverData

    // 合并对象
    const merged = { ...serverData }

    // 遍历客户端数据，合并不同的字段
    Object.keys(clientData).forEach(key => {
      if (key === this.timestampField || key === this.versionField) {
        return
      }

      const clientValue = clientData[key]
      const serverValue = serverData[key]

      if (clientValue !== serverValue) {
        // 对于嵌套对象，递归合并
        if (typeof clientValue === 'object' && typeof serverValue === 'object') {
          merged[key] = this.mergeObjects(clientValue, serverValue)
        } else {
          // 对于简单值，使用客户端值
          merged[key] = clientValue
        }
      }
    })

    // 更新版本号和时间戳
    merged[this.versionField] = (serverData[this.versionField] || 0) + 1
    merged[this.timestampField] = new Date().toISOString()

    return merged
  }

  /**
   * 合并对象
   */
  private mergeObjects(clientObj: any, serverObj: any): any {
    const merged = { ...serverObj }

    Object.keys(clientObj).forEach(key => {
      const clientValue = clientObj[key]
      const serverValue = serverObj[key]

      if (typeof clientValue === 'object' && typeof serverValue === 'object') {
        merged[key] = this.mergeObjects(clientValue, serverValue)
      } else if (clientValue !== serverValue) {
        merged[key] = clientValue
      }
    })

    return merged
  }

  /**
   * 获取客户端新增的字段
   */
  private getNewClientFields(clientData: any, serverData: any): any {
    const newFields: any = {}

    Object.keys(clientData).forEach(key => {
      if (!(key in serverData)) {
        newFields[key] = clientData[key]
      }
    })

    return newFields
  }

  /**
   * 生成冲突报告
   */
  generateConflictReport(context: ConflictContext): string {
    const { clientData, serverData, entityType, entityId } = context

    const clientTime = clientData[this.timestampField]
      ? new Date(clientData[this.timestampField]).toLocaleString()
      : '未知'

    const serverTime = serverData[this.timestampField]
      ? new Date(serverData[this.timestampField]).toLocaleString()
      : '未知'

    return `
冲突检测报告:
- 实体类型: ${entityType}
- 实体ID: ${entityId}
- 客户端修改时间: ${clientTime}
- 服务器修改时间: ${serverTime}
- 冲突原因: 数据在本地修改后，服务器上也发生了变更
    `.trim()
  }

  createConflict(
    originalOp: CollaborationOperation,
    incomingOp: CollaborationOperation,
  ): CollaborationConflict {
    const conflictType: 'text' | 'format' | 'delete' =
      originalOp.type === 'delete' || incomingOp.type === 'delete'
        ? 'delete'
        : originalOp.type === 'format' || incomingOp.type === 'format'
          ? 'format'
          : 'text'

    const conflict: CollaborationConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: conflictType,
      originalOperation: originalOp,
      incomingOperation: incomingOp,
      status: 'pending',
    }

    this.pendingConflicts.set(conflict.id, conflict)
    this.notifyConflictListeners(conflict)

    return conflict
  }

  resolveCollaborationConflict(
    conflictId: string,
    resolution: 'keep-local' | 'keep-remote' | 'merge' | 'manual',
    resolvedBy: string,
    _manualResult?: CollaborationOperation,
  ): CollaborationConflict | null {
    const conflict = this.pendingConflicts.get(conflictId)
    if (!conflict) {
      return null
    }

    conflict.status = 'resolved'
    conflict.resolution = resolution
    conflict.resolvedAt = Date.now()
    conflict.resolvedBy = resolvedBy

    this.pendingConflicts.delete(conflictId)
    this.notifyConflictListeners(conflict)

    return conflict
  }

  getPendingConflicts(): CollaborationConflict[] {
    return Array.from(this.pendingConflicts.values()).filter(
      c => c.status === 'pending',
    )
  }

  getConflictById(conflictId: string): CollaborationConflict | undefined {
    return this.pendingConflicts.get(conflictId)
  }

  getConflictsForOperation(operationId: string): CollaborationConflict[] {
    return Array.from(this.pendingConflicts.values()).filter(
      c =>
        c.originalOperation.id === operationId ||
        c.incomingOperation.id === operationId,
    )
  }

  markConflict(
    operationId: string,
    type: 'text' | 'format' | 'delete',
    startOffset: number,
    endOffset: number,
    isLocal: boolean,
  ): ConflictMarker {
    return {
      operationId,
      type,
      startOffset,
      endOffset,
      isLocal,
      timestamp: Date.now(),
    }
  }

  applyAutoResolution(
    conflict: CollaborationConflict,
    strategy: 'server_wins' | 'client_wins' | 'merge',
  ): CollaborationOperation {
    switch (strategy) {
      case 'server_wins':
        return conflict.incomingOperation
      case 'client_wins':
        return conflict.originalOperation
      case 'merge':
        return this.mergeOperations(
          conflict.originalOperation,
          conflict.incomingOperation,
        )
      default:
        return conflict.incomingOperation
    }
  }

  private mergeOperations(
    localOp: CollaborationOperation,
    remoteOp: CollaborationOperation,
  ): CollaborationOperation {
    if (localOp.type === 'insert' && remoteOp.type === 'insert') {
      const localTime = new Date(localOp.timestamp).getTime()
      const remoteTime = new Date(remoteOp.timestamp).getTime()

      if (localTime < remoteTime) {
        return {
          ...remoteOp,
          id: `merged-${Date.now()}`,
          timestamp: Date.now(),
        }
      }
      return {
        ...localOp,
        id: `merged-${Date.now()}`,
        timestamp: Date.now(),
      }
    }

    return remoteOp
  }

  onConflictDetected(callback: (conflict: CollaborationConflict) => void): () => void {
    this.conflictListeners.add(callback)
    return () => {
      this.conflictListeners.delete(callback)
    }
  }

  private notifyConflictListeners(conflict: CollaborationConflict): void {
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        logger.error('Error in conflict listener:', error)
      }
    })
  }

  clearResolvedConflicts(): void {
    const resolved = Array.from(this.pendingConflicts.values()).filter(
      c => c.status === 'resolved',
    )
    resolved.forEach(c => this.pendingConflicts.delete(c.id))
  }
}

// 导出默认实例
export const conflictResolver = new ConflictResolver()
