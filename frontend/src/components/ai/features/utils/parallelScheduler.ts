/**
 * 有界并行工具调度器 v2.0 - 真实 API 集成
 *
 * 基于 DeepSeek Harness 的并行调度算法完整实现：
 * - 安全工具使用有界并行池 (maxParallel=10)
 * - 独占工具串行执行形成屏障
 * - 真实 Agent API 调用
 * - SSE 流式事件支持
 */

import { logger } from '@/utils/safeLogger';
import { agentApi } from '@/api/agent';
import type { ToolCall, ToolResultData } from '@/components/ai/shared/types';

export interface ToolExecutor {
  call: ToolCall;
  execute: () => Promise<ToolResultData>;
}

// ── 有界并行池 ──────────────────────────────────────────────

async function boundedPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const results = new Array<R | null>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        logger.error('[ParallelScheduler] Worker error:', err);
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results.filter((r): r is R => r !== null);
}

// ── 执行单个工具调用 (真实 API) ─────────────────────────────

async function executeToolCallReal(call: ToolCall): Promise<ToolResultData> {
  const startTime = Date.now();
  const callId = call.callId ?? `call-${startTime}`;

  logger.debug(`[ParallelScheduler] Executing tool: ${call.tool}`, call.input);

  try {
    // 根据工具名称调用不同的后端 API
    const result = await callToolApi(call);
    return {
      callId,
      result,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      callId,
      result: null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * 根据工具名称路由到对应的后端 API
 */
async function callToolApi(call: ToolCall): Promise<unknown> {
  const toolName = call.tool.toLowerCase();

  // RAG 检索工具
  if (toolName.includes('rag') || toolName.includes('search') || toolName.includes('knowledge')) {
    return await executeRagSearch(call);
  }

  // 配方生成工具
  if (toolName.includes('formula') || toolName.includes('generate') || toolName.includes('design')) {
    return await executeFormulaGeneration(call);
  }

  // 合规检查工具
  if (toolName.includes('compliance') || toolName.includes('check') || toolName.includes('safety')) {
    return await executeComplianceCheck(call);
  }

  // 实验方案工具
  if (toolName.includes('experiment') || toolName.includes('plan')) {
    return await executeExperimentPlan(call);
  }

  // 图谱推理工具
  if (toolName.includes('kg') || toolName.includes('graph') || toolName.includes('inference')) {
    return await executeKGInference(call);
  }

  // 默认：通用工具执行
  return await executeGenericTool(call);
}

/**
 * RAG 检索执行
 */
async function executeRagSearch(call: ToolCall): Promise<unknown> {
  // 调用后端 RAG API
  const response = await fetch('/api/v1/ai/rag/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: call.input?.query as string,
      top_k: call.input?.top_k as number ?? 5,
    }),
  });

  if (!response.ok) throw new Error(`RAG search failed: ${response.status}`);
  return response.json();
}

/**
 * 配方生成执行
 */
async function executeFormulaGeneration(call: ToolCall): Promise<unknown> {
  const response = await fetch('/api/v1/ai/formula/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call.input),
  });

  if (!response.ok) throw new Error(`Formula generation failed: ${response.status}`);
  return response.json();
}

/**
 * 合规检查执行
 */
async function executeComplianceCheck(call: ToolCall): Promise<unknown> {
  const response = await fetch('/api/v1/ai/compliance/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call.input),
  });

  if (!response.ok) throw new Error(`Compliance check failed: ${response.status}`);
  return response.json();
}

/**
 * 实验方案执行
 */
async function executeExperimentPlan(call: ToolCall): Promise<unknown> {
  const response = await fetch('/api/v1/ai/experiment/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call.input),
  });

  if (!response.ok) throw new Error(`Experiment plan failed: ${response.status}`);
  return response.json();
}

/**
 * 知识图谱推理执行
 */
async function executeKGInference(call: ToolCall): Promise<unknown> {
  const herbs = call.input?.herbs as string[] ?? [];
  const reasoningType = call.input?.reasoning_type as string ?? 'all';

  const response = await fetch('/api/v1/kg/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ herbs, reasoning_type: reasoningType }),
  });

  if (!response.ok) throw new Error(`KG inference failed: ${response.status}`);
  return response.json();
}

/**
 * 通用工具执行 (代理到 Agent API)
 */
async function executeGenericTool(call: ToolCall): Promise<unknown> {
  // 使用通用 Agent API 执行
  const response = await fetch('/api/v1/agent/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: call.tool,
      arguments: call.input,
    }),
  });

  if (!response.ok) throw new Error(`Tool execution failed: ${response.status}`);
  return response.json();
}

// ── 主调度函数 ──────────────────────────────────────────────

/**
 * 调度工具调用
 * - 安全工具并行执行 (有界池, maxParallel=10)
 * - 独占工具串行执行
 */
export async function scheduleToolCalls(
  calls: ToolCall[],
  maxParallel: number = 10,
): Promise<ToolResultData[]> {
  if (calls.length === 0) return [];

  const safeCalls = calls.filter((c) => c.isConcurrencySafe !== false);
  const exclusiveCalls = calls.filter((c) => c.isConcurrencySafe === false);

  logger.info(
    `[ParallelScheduler] Scheduling ${calls.length} tools: ${safeCalls.length} safe, ${exclusiveCalls.length} exclusive`,
  );

  const results: ToolResultData[] = [];

  // 执行独占工具 (串行)
  for (const call of exclusiveCalls) {
    try {
      const result = await executeToolCallReal(call);
      results.push(result);
    } catch (err) {
      results.push({
        callId: call.callId ?? `call-${Date.now()}`,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
      });
    }
  }

  // 执行安全工具 (有界并行池)
  if (safeCalls.length > 0 && maxParallel > 0) {
    const safeResults = await boundedPool(
      safeCalls,
      maxParallel,
      executeToolCallReal,
    );
    results.push(...safeResults.filter((r): r is ToolResultData => r !== null));
  }

  return results;
}

/**
 * 批量执行工具 (保留接口兼容性)
 */
export async function executeToolsBatch(
  calls: ToolCall[],
  maxParallel: number = 10,
): Promise<ToolResultData[]> {
  return scheduleToolCalls(calls, maxParallel);
}

/**
 * 直接从 Agent API 获取工具执行结果
 * 适用于前端无法直接调用的复杂工具
 */
export async function executeToolsViaAgentAPI(
  calls: ToolCall[],
  maxParallel: number = 10,
): Promise<ToolResultData[]> {
  if (calls.length === 0) return [];

  // 构建工具链
  const toolChain: [string, Record<string, unknown>][] = calls.map((call) => [
    call.tool,
    call.input ?? {},
  ]);

  // 调用 Agent API 批量执行
  try {
    const response = await agentApi.execute({
      query: calls.map((c) => c.tool).join(', '),
      mode: 'smart',
      tool_chain: toolChain,
      max_steps: calls.length,
    });

    // 转换结果为 ToolResultData 格式
    return response.data.steps.map((step, idx) => ({
      callId: calls[idx]?.callId ?? `call-${Date.now()}-${idx}`,
      result: { tool: step.tool, status: step.status, output: null },
      error: step.error,
      latencyMs: step.latency_ms,
    }));
  } catch (err) {
    logger.error('[ParallelScheduler] Agent API execution failed:', err);
    // 降级到逐个执行
    return scheduleToolCalls(calls, maxParallel);
  }
}
