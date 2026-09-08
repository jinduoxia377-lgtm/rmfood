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

// ── CSRF Token 管理 ──
// 与 security_middleware.py 的 CsrfProtectMiddleware 保持一致：
// 1. 先发 GET 请求触发中间件设置 csrf_token cookie
// 2. 从 document.cookie 读取（中间件生成的 token），不要用 /csrf-token 端点的返回值（会不一致）
function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

let _csrfToken: string | null = null;
let _csrfLoading = false;

async function ensureCsrfToken(): Promise<string | null> {
  // 优先从已有缓存读取
  if (_csrfToken) return _csrfToken;
  // 其次尝试从 cookie 读取（如果之前已有请求设置了 cookie）
  const cookieToken = getCookieValue('csrf_token');
  if (cookieToken) {
    _csrfToken = cookieToken;
    return _csrfToken;
  }
  if (_csrfLoading) {
    return new Promise((resolve) => {
      const check = () => {
        const t = getCookieValue('csrf_token') || _csrfToken;
        if (t || !_csrfLoading) resolve(t);
        else setTimeout(check, 50);
      };
      check();
    });
  }
  _csrfLoading = true;
  try {
    // 发一个 GET 请求触发 CsrfProtectMiddleware 设置 csrf_token cookie
    await fetch(`${BASE_URL}/tools`, {
      method: 'GET',
      credentials: 'include',
    });
    _csrfToken = getCookieValue('csrf_token');
  } catch {
    // 忽略错误
  } finally {
    _csrfLoading = false;
  }
  return _csrfToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // 确保有 CSRF token
  const csrfToken = await ensureCsrfToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  // POST/PUT/PATCH/DELETE 需要携带 CSRF token
  const method = (options?.method || 'GET').toUpperCase();
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    credentials: 'include',
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

    ensureCsrfToken().then((csrfToken) => {
      fetch(`${BASE_URL}/execute/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        credentials: 'include',
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
    });

    return () => controller.abort();
  },
};
