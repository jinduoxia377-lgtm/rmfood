/**
 * SubagentDelegation — 子智能体委托能力
 *
 * 参照 DeepSeek Harness Delegation 设计：
 * - 当用户请求涉及多步骤/多主题时，自动拆解为子任务
 * - 每个子任务可独立发送到后端 API 并行处理
 * - 结果聚合后合并输出
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'
import type { ChatMessage } from '../../types'
import { chatService } from '../../services/chatService'

export interface SubTask {
  /** 唯一 ID */
  id: string
  /** 子任务描述 */
  description: string
  /** 任务类型 */
  type: 'analyze' | 'design' | 'evaluate' | 'compare' | 'summary'
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 输入提示词 */
  prompt: string
  /** 输出结果 */
  result?: string
  /** 错误信息 */
  error?: string
}

export interface DelegationResult {
  taskId: string
  subtasks: SubTask[]
  finalOutput: string
  /** 是否成功并行完成 */
  parallelDone: boolean
}

export class SubagentDelegationService {
  private runningTasks: Map<string, AbortController> = new Map()

  /**
   * 判断是否需要启动子任务委托
   * 策略：请求包含多个不同主题关键词时触发
   */
  shouldDelegate(input: string, messages: ChatMessage[]): boolean {
    if (messages.length > 30) return false // 长对话不触发（已在压缩中）

    const keywords = input.toLowerCase()
    const topicSignals = [
      /分析|检测|验证|检查/i,
      /设计|配方|方案|制备/i,
      /评估|对比|比较|优劣/i,
      /总结|概括|汇总|整理/i,
    ]

    const matchedCount = topicSignals.filter(pattern => pattern.test(keywords)).length
    return matchedCount >= 2
  }

  /**
   * 拆解任务为子任务列表
   */
  decompose(input: string, messages: ChatMessage[]): SubTask[] {
    const lastMessages = messages.slice(-6)
    const context = lastMessages.map(m => `${m.role}: ${m.content}`).join('\n')

    const subtasks: SubTask[] = []
    const keywords = input.toLowerCase()

    if (/分析|检测|验证|检查/.test(keywords)) {
      subtasks.push({
        id: `task-analyze-${Date.now()}`,
        description: '成分与功效分析',
        type: 'analyze',
        status: 'pending',
        prompt: `基于以下上下文，分析核心食材的功效成分与作用机理：\n${context}\n\n请输出结构化的分析结果。`,
      })
    }

    if (/设计|配方|方案|制备/.test(keywords)) {
      subtasks.push({
        id: `task-design-${Date.now()}`,
        description: '配方方案设计',
        type: 'design',
        status: 'pending',
        prompt: `基于以下上下文，设计一个精确到克的药食同源配方：\n${context}\n\n输出格式：君臣佐使结构 + 克重配比 + 制备SOP。`,
      })
    }

    if (/评估|对比|比较|优劣/.test(keywords)) {
      subtasks.push({
        id: `task-evaluate-${Date.now()}`,
        description: '方案评估对比',
        type: 'evaluate',
        status: 'pending',
        prompt: `基于以下上下文，对现有方案进行安全性与有效性评估：\n${context}\n\n从配伍禁忌、剂量安全、适口性三个维度评估。`,
      })
    }

    // 确保至少有一个子任务
    if (subtasks.length === 0) {
      subtasks.push({
        id: `task-summary-${Date.now()}`,
        description: '综合处理',
        type: 'summary',
        status: 'pending',
        prompt: `请完整回答以下问题：\n${input}`,
      })
    }

    logger.info(`[SubagentDelegation] 任务拆解完成: ${subtasks.length} 个子任务`)
    return subtasks
  }

  /**
   * 执行子任务委托（串行 fallback，后续可扩展为并行）
   */
  async execute(
    input: string,
    messages: ChatMessage[],
    onProgress?: (task: SubTask) => void,
  ): Promise<DelegationResult> {
    const subtasks = this.decompose(input, messages)
    const taskId = `delegation-${Date.now()}`
    const abortController = new AbortController()
    this.runningTasks.set(taskId, abortController)

    logger.info(`[SubagentDelegation] 开始执行 ${subtasks.length} 个子任务: ${taskId}`)

    const results: SubTask[] = []
    let finalOutput = ''

    for (const task of subtasks) {
      if (abortController.signal.aborted) {
        logger.warn('[SubagentDelegation] 任务已取消')
        break
      }

      task.status = 'running'
      onProgress?.(task)

      try {
        const result = await this.runTask(task, abortController.signal)
        task.result = result
        task.status = 'completed'
        finalOutput += result + '\n\n'
        logger.info(`[SubagentDelegation] 子任务完成: ${task.id}`)
      } catch (error) {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : String(error)
        logger.error(`[SubagentDelegation] 子任务失败: ${task.id}`, error)
      }

      results.push(task)
      onProgress?.(task)
    }

    this.runningTasks.delete(taskId)

    const result: DelegationResult = {
      taskId,
      subtasks: results,
      finalOutput: finalOutput.trim(),
      parallelDone: subtasks.length === 1,
    }

    logger.info(`[SubagentDelegation] 委托完成: ${taskId}`)
    return result
  }

  /**
   * 运行单个子任务
   */
  private async runTask(task: SubTask, signal: AbortSignal): Promise<string> {
    void signal;
    const response = await chatService.sendMessage(task.prompt)
    return response.content || '（无输出）'
  }

  /**
   * 取消正在执行的委托
   */
  cancel(taskId: string): void {
    const controller = this.runningTasks.get(taskId)
    if (controller) {
      controller.abort()
      this.runningTasks.delete(taskId)
      logger.info(`[SubagentDelegation] 任务已取消: ${taskId}`)
    }
  }

  /**
   * 获取正在运行的任务数
   */
  get activeCount(): number {
    return this.runningTasks.size
  }
}

export const subagentDelegation = new SubagentDelegationService()
export default SubagentDelegationService
