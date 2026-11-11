/**
 * 知识图谱异步分析通用辅助（②b）。
 *
 * betweenness/communities/kcore 在 B表全谱(14749节点)纯Python同步会超时
 * (161s/12min/34s)，故走 AsyncTaskQueue 提交→轮询→取结果。
 * 此 helper 封装「提交→轮询→缓存直返」通用流程，供 GraphTab / KnowledgeGraphPanel 复用。
 */
import { databaseApi } from '../../../../api/database'

export type AsyncSubmitResponse = {
  success: boolean
  cached: boolean
  task_id: string | null
  status: string
  result?: any
}

export type KgAsyncKind = 'betweenness' | 'communities' | 'kcore'

/** 提交异步分析任务；缓存命中时直接返回 {cached:true, result}，否则返回 {task_id} 供轮询。 */
export async function submitKgAnalysis(kind: KgAsyncKind): Promise<AsyncSubmitResponse> {
  switch (kind) {
    case 'betweenness':
      return databaseApi.submitBetweennessAsync(20)
    case 'communities':
      return databaseApi.submitCommunitiesAsync(10)
    case 'kcore':
      return databaseApi.submitKCoreAsync()
    default:
      throw new Error(`未知分析类型: ${kind}`)
  }
}

/**
 * 轮询直到任务完成，返回最终 result。
 * @param taskId  任务 ID
 * @param onTick  可选进度回调（每轮调用，参数为当前 status）
 * @param intervalMs 轮询间隔，默认 3s
 * @param maxWaitMs 最长等待，默认 20min（communities 较重）
 */
export async function pollKgTask(
  taskId: string,
  onTick?: (status: string) => void,
  intervalMs = 3000,
  maxWaitMs = 20 * 60_000,
): Promise<any> {
  const start = Date.now()
  for (;;) {
    const resp = await databaseApi.getTaskResult(taskId)
    const data = resp?.data
    const status = data?.status
    onTick?.(status ?? 'unknown')
    if (status === 'success') return data?.result
    if (status === 'failed' || status === 'timeout') {
      throw new Error(data?.error || `任务${status === 'timeout' ? '超时' : '失败'}`)
    }
    if (Date.now() - start > maxWaitMs) throw new Error('任务等待超时')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/**
 * 一站式：提交并（必要时）轮询到完成，返回 result。
 * 缓存命中时直接返回，不轮询。
 */
export async function runKgAnalysis(kind: KgAsyncKind, onTick?: (status: string) => void): Promise<any> {
  const sub = await submitKgAnalysis(kind)
  if (sub.cached && sub.result) return sub.result
  if (!sub.task_id) throw new Error(sub.status || '任务提交失败')
  return pollKgTask(sub.task_id, onTick)
}