/**
 * Agent API 客户端
 *
 * 封装 Agent 相关后端接口：
 * - 执行 Agent 任务
 * - 查询执行结果
 * - 流式执行（SSE）
 */

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentExecuteRequest {
  query: string;
  mode: 'fast' | 'smart';
  tool_chain?: [string, Record<string, unknown>][];
  max_steps?: number;
}

export interface AgentStep {
  step_id: string;
  tool: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  latency_ms: number;
  error?: string;
}

export interface AgentExecution {
  execution_id: string;
  user_query: string;
  status: string;
  total_latency_ms: number;
  steps: AgentStep[];
  final_response_preview: string;
}

export interface AgentExecuteResponse {
  success: boolean;
  data: AgentExecution;
}

const BASE_URL = '/api/v1/agent';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agent API ${res.status}: ${text}`);
  }
  return res.json();
}

export const agentApi = {
  /** 列出可用工具 */
  listTools: () => request<{ success: boolean; tools: AgentTool[]; count: number }>('/tools'),

  /** 执行 Agent 任务（非流式） */
  execute: (body: AgentExecuteRequest) =>
    request<AgentExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 查询执行结果 */
  getExecution: (id: string) =>
    request<{ success: boolean; data: AgentExecution }>(`/executions/${id}`),

  /** 列出最近执行记录 */
  listExecutions: (limit = 10) =>
    request<{ success: boolean; data: AgentExecution[]; total: number }>(
      `/executions?limit=${limit}`
    ),

  /** 删除执行记录 */
  deleteExecution: (id: string) =>
    request<{ success: boolean }>(`/executions/${id}`, { method: 'DELETE' }),

  /** 流式执行（SSE） */
  executeStream(
    body: AgentExecuteRequest,
    onEvent: (event: string, data: unknown) => void,
    onComplete: (data: AgentExecution) => void,
    onError: (error: Error) => void,
  ): () => void {
    const controller = new AbortController();

    fetch(`${BASE_URL}/execute/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              onEvent(parsed.event, parsed.data);

              if (parsed.event === 'complete' && parsed.data) {
                onComplete(parsed.data as AgentExecution);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      })
      .catch(onError);

    return () => controller.abort();
  },
};
