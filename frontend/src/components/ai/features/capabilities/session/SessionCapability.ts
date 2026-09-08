/**
 * SessionCapability — 会话管理能力
 *
 * 参照 DeepSeek Harness Session fork/resume 设计：
 * - fork: 在指定位置创建会话分支
 * - resumeTo: 恢复到历史节点
 * - 完整的会话生命周期管理
 *
 * @version 1.0.0
 */

import type { ChatMessage } from '../../types'
import { chatStorageService } from '../storage/ChatStorageService'
import { logger } from '@/utils/safeLogger'

export interface SessionForkOptions {
  /** 从哪条消息开始分叉（不传则从最后一条消息之后） */
  boundaryMessageId?: string
  /** 子会话 ID（不传则自动生成） */
  childSessionId?: string
  /** 子会话标题 */
  title?: string
}

export interface SessionResumeResult {
  sessionId: string
  messages: ChatMessage[]
  boundarySeq: number
}

export class SessionCapability {
  /**
   * 在当前会话指定位置创建分支
   * 参照 DSH: session.fork(source, boundary)
   */
  async fork(parentSessionId: string, options: SessionForkOptions = {}): Promise<string> {
    const messages = (await chatStorageService.loadMessages(parentSessionId)) as ChatMessage[]

    // 确定分叉边界
    let boundaryIndex = messages.length
    if (options.boundaryMessageId) {
      const idx = messages.findIndex((m: ChatMessage) => m.id === options.boundaryMessageId)
      if (idx !== -1) {
        boundaryIndex = idx + 1
      }
    }

    // 生成子会话 ID
    const childId = options.childSessionId ??
      `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    // 保存分支消息
    const branchMessages = messages.slice(0, boundaryIndex)
    await chatStorageService.saveMessages(childId, branchMessages)

    // 更新元数据
    await chatStorageService.saveSessionMeta(childId, {
      title: options.title || `分支-${childId.slice(-6)}`,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: branchMessages.length,
    })

    logger.info(`[SessionCapability] 会话分支已创建: ${parentSessionId} → ${childId} (${boundaryIndex}条消息)`)
    return childId
  }

  /**
   * 恢复到指定历史节点
   * 参照 DSH: session.resume(sessionId)
   */
  async resumeTo(sessionId: string, targetMessageId: string): Promise<SessionResumeResult | null> {
    const messages = (await chatStorageService.loadMessages(sessionId)) as ChatMessage[]
    const targetIndex = messages.findIndex((m: ChatMessage) => m.id === targetMessageId)

    if (targetIndex === -1) {
      logger.warn('[SessionCapability] resumeTo: 目标消息未找到', { targetMessageId })
      return null
    }

    // 返回目标节点及之前的所有消息
    const history = messages.slice(0, targetIndex + 1)

    logger.info(`[SessionCapability] 会话已恢复到: ${sessionId}@${targetMessageId} (${history.length}条消息)`)
    return {
      sessionId,
      messages: history,
      boundarySeq: targetIndex,
    }
  }

  /**
   * 创建新会话
   */
  async createSession(title?: string): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    await chatStorageService.saveSessionMeta(sessionId, {
      title: title || '新对话',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    })
    logger.info(`[SessionCapability] 新会话已创建: ${sessionId}`)
    return sessionId
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    await chatStorageService.deleteMessages(sessionId)
    logger.info(`[SessionCapability] 会话已删除: ${sessionId}`)
  }

  /**
   * 获取会话摘要列表
   */
  async listSessions(): Promise<Array<{ id: string; title: string; messageCount: number; updatedAt: number }>> {
    const summaries = await chatStorageService.listSessions()
    return summaries.map((s: any) => ({
      id: s.id,
      title: s.meta.title,
      messageCount: s.messageCount,
      updatedAt: s.meta.updatedAt,
    }))
  }

  /**
   * 重命名会话
   */
  async renameSession(sessionId: string, title: string): Promise<void> {
    const meta = await chatStorageService.loadSessionMeta(sessionId)
    if (meta) {
      await chatStorageService.saveSessionMeta(sessionId, {
        ...meta,
        title,
        updatedAt: Date.now(),
      })
    }
  }
}

export const sessionCapability = new SessionCapability()
export default SessionCapability
