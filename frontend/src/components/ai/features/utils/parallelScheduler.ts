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
import { fetchWithCsrf } from '@/utils/csrf';
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
 *
 * 真实端点：POST /api/v1/rag/search（rag_router.py），查询词走 query param。
 */
async function executeRagSearch(call: ToolCall): Promise<unknown> {
  const input = call.input ?? {};
  const question = typeof input.question === 'string' ? input.question
    : typeof input.query === 'string' ? input.query
    : typeof input.q === 'string' ? input.q
    : '';
  if (!question.trim()) {
    throw new Error('RAG 检索缺少查询词（input.question/query）');
  }
  const topK = typeof input.top_k === 'number' ? input.top_k : 5;
  const params = new URLSearchParams({ question: question.trim(), top_k: String(topK) });
  return fetchWithCsrf(`/api/v1/rag/search?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * 配方生成执行
 *
 * 后端端点是 /ai/generate（ai_modules/generation.py:77），不是 /ai/formula/generate。
 */
async function executeFormulaGeneration(call: ToolCall): Promise<unknown> {
  return fetchWithCsrf('/api/v1/ai/generate', {
    method: 'POST',
    body: JSON.stringify(call.input),
  });
}

/**
 * 合规检查执行
 *
 * P2-F2 修复：接入真实后端端点 /api/v1/compliance/check/realtime。
 * 后端入参为 current_ingredients: {name, dosage_mg}[] + population
 * （adults|children|elderly），与 LLM 工具调用传来的 ingredients/target_population
 * 做最佳努力映射。
 */
async function executeComplianceCheck(call: ToolCall): Promise<unknown> {
  const input = (call.input ?? {}) as Record<string, unknown>;
  const rawIngredients = Array.isArray(input.ingredients)
    ? (input.ingredients as Array<Record<string, unknown>>)
    : [];
  const current_ingredients = rawIngredients
    .filter((i) => typeof i?.name === 'string')
    .map((i) => ({
      name: i.name as string,
      dosage_mg: Number(i.dosage_mg ?? i.dosage ?? 0) || 0,
    }));
  if (!current_ingredients.length) {
    throw new Error('合规检查失败：ingredients 不能为空');
  }
  const popRaw =
    (input.target_population as string | undefined) ??
    (input.population as string | undefined) ??
    'adults';
  const population = ['adults', 'children', 'elderly'].includes(popRaw) ? popRaw : 'adults';
  return fetchWithCsrf('/api/v1/compliance/check/realtime', {
    method: 'POST',
    body: JSON.stringify({ current_ingredients, population }),
  });
}

/**
 * 实验方案执行
 *
 * 后端只有 /ai/analyze/experiment（实验结果分析），没有"生成实验方案"端点。
 */
async function executeExperimentPlan(call: ToolCall): Promise<unknown> {
  void call;
  throw new Error('工具暂不可用：后端未提供实验方案生成端点');
}

/**
 * 知识图谱推理执行
 *
 * 后端端点是 /kg/infer/all（InferAllRequest: herbs + reasoning_type，
 * reasoning_type 取值 path|synergy|conflict|all）。此前用 /kg/infer，必然 404。
 */
async function executeKGInference(call: ToolCall): Promise<unknown> {
  const herbs = (call.input?.herbs as string[] | undefined) ?? [];
  const reasoningType = (call.input?.reasoning_type as string | undefined) ?? 'all';
  if (!herbs.length) {
    throw new Error('知识图谱推理失败：herbs 不能为空');
  }
  return fetchWithCsrf('/api/v1/kg/infer/all', {
    method: 'POST',
    body: JSON.stringify({ herbs, reasoning_type: reasoningType }),
  });
}

/**
 * 通用工具执行
 *
 * 后端没有 /agent/tools/execute。可用的代理入口是 /agent/execute，
 * 但它按"任务"而非"单个工具调用"执行，语义不等价，先显式失败。
 */
async function executeGenericTool(call: ToolCall): Promise<unknown> {
  void call;
  throw new Error('工具暂不可用：后端未提供 /agent/tools/execute 端点');
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
    return (response.data?.steps ?? []).map((step, idx) => ({
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
