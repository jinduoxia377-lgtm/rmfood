/**
 * 工作流 API 客户端
 *
 * 封装 Agent 工作流相关后端接口:
 *  - 执行工作流
 *  - 查询执行结果
 *  - 流式执行（SSE）
 *  - WebSocket 实时进度
 *  - 图谱推理
 */

export interface WorkflowExecuteRequest {
  query: string;
  max_steps?: number;
}

export interface WorkflowStageResult {
  stage: string;
  success: boolean;
  latency_ms: number;
  error?: string;
}

export interface WorkflowExecution {
  execution_id: string;
  workflow_type: string;
  user_query: string;
  status: string;
  total_latency_ms: number;
  stages: WorkflowStageResult[];
  final_response: string;
  final_response_preview: string;
  error?: string;
}

export interface WorkflowTemplate {
  /**
   * 逻辑模板 ID（如 'formula_design'），与 workflowType 比较；勿改为 number。
   * Agent 工作流模板（GET /api/v1/agent/workflows/templates）仅返回 template_id，
   * 故此处可缺省，消费方应使用 `id ?? template_id` 取逻辑 ID。
   */
  id?: string;
  template_id: string;
  name: string;
  label?: string;
  description?: string | null;
  desc?: string;
  category?: string;
  icon?: string | null;
  node_count?: number | null;
  estimated_duration?: string | null;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  preset_config?: Record<string, unknown>;
  /** Agent 工作流模板（/agent/workflows/templates）新增字段 */
  stage_count?: number;
  stages?: string[];
}

export interface WorkflowExecuteResponse {
  success: boolean;
  data: WorkflowExecution;
}

export interface KGInferenceRequest {
  herbs: string[];
  reasoning_type: 'path' | 'synergy' | 'conflict' | 'all';
  population?: 'adults' | 'children' | 'pregnancy';
  source_herb?: string;
  target_disease?: string;
}

export interface KGPathResult {
  source: string;
  target: string;
  path: string[];
  length: number;
  confidence: number;
  description: string;
}

export interface KGSynergyResult {
  herb_a: string;
  herb_b: string;
  type: string;
  confidence: number;
  shared_compounds: string[];
  shared_targets: string[];
  reasoning: string;
}

export interface KGConflictResult {
  herb_a: string;
  herb_b: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

export interface KGInferenceResponse {
  query: string;
  paths: KGPathResult[];
  synergies: KGSynergyResult[];
  conflicts: KGConflictResult[];
  total_inferences: number;
}

export interface MultiTenantPolicy {
  level: number;
  name: string;
  description: string;
  features: string[];
  price_tier: string;
}

export interface TenantAIConfig {
  org_id: number;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  optimization_weights: Record<string, number>;
  compliance_overrides: Record<string, unknown>;
}

const API_BASE = '/api/v1';

// ── CSRF Token 管理 ──
let _csrfToken: string | null = null;
let _csrfLoading = false;

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  if (_csrfToken) return _csrfToken;
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
    // 发 GET 触发 CsrfProtectMiddleware 设置 csrf_token cookie，然后从 cookie 读取
    await fetch(`${API_BASE}/agent/csrf-token`, {
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

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const workflowApi = {
  /** 执行工作流 */
  execute: (workflowType: string, body: WorkflowExecuteRequest) =>
    request<WorkflowExecuteResponse>(
      `/agent/workflow/${workflowType}/execute`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  /** 查询工作流执行结果 */
  getExecution: (executionId: string) =>
    request<{ success: boolean; data: WorkflowExecution }>(
      `/agent/workflow/executions/${executionId}`
    ),

  /** 流式执行工作流（SSE） */
  executeStream(
    workflowType: string,
    body: WorkflowExecuteRequest,
    onEvent: (event: string, data: unknown) => void,
    onComplete: (data: WorkflowExecution) => void,
    onError: (error: Error) => void,
  ): () => void {
    const controller = new AbortController();

    // SSE POST 同样需要 CSRF token 与凭证（与 agent.ts executeStream 保持一致）
    ensureCsrfToken().then((csrfToken) => {
      fetch(`${API_BASE}/agent/workflow/${workflowType}/execute/stream`, {
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

              if (parsed.event === 'done' && parsed.data) {
                onComplete(parsed.data as WorkflowExecution);
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

  /**
   * 列出 workflow_exec 工作流模板（WorkflowVisualEditor 画布编辑用）。
   *
   * 注意：此端点返回 workflow_exec 模板（id 为数字、含 nodes/edges/preset_config），
   * 供可视化编辑器使用；与 Agent 工作流的 execute() 类型不同源。
   * 如需 Agent 工作流模板（formula_design 等，与 execute() 同源），请用 listAgentTemplates()。
   */
  listTemplates: () =>
    request<{ items: WorkflowTemplate[]; total: number }>('/workflows/templates'),

  /**
   * 列出 Agent 工作流模板（Chief 工作台 useUnifiedAgent 用）。
   *
   * 必须与 execute() 同源 —— 均走 agent_router（/api/v1/agent/...）。
   * GET /api/v1/agent/workflows/templates 返回 Agent 工作流模板
   * （formula_design / compliance_check / experiment_plan / ingredient_lookup / full_pipeline），
   * 与 POST /api/v1/agent/workflow/{workflow_type}/execute 接受的类型一致，
   * 保证模板展示与执行类型一致。
   */
  listAgentTemplates: () =>
    request<{ success: boolean; items: WorkflowTemplate[]; total: number }>(
      '/agent/workflows/templates'
    ),

  /** 获取单个模板详情 */
  getTemplate: (templateId: string) =>
    request<WorkflowTemplate>(`/workflows/templates/${templateId}`),
};

/**
 * 知识图谱推理 API
 */
export const kgInferenceApi = {
  /** 执行图谱推理 */
  infer: (body: KGInferenceRequest) =>
    request<KGInferenceResponse>('/kg/infer', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 路径推理 */
  inferPath: (source: string, target: string) =>
    request<KGInferenceResponse>('/kg/infer/path', {
      method: 'POST',
      body: JSON.stringify({ source_herb: source, target_disease: target }),
    }),

  /** 协同效应推理 */
  inferSynergy: (herbs: string[]) =>
    request<KGInferenceResponse>('/kg/infer/synergy', {
      method: 'POST',
      body: JSON.stringify({ herbs, reasoning_type: 'synergy' }),
    }),

  /** 配伍冲突检测 */
  inferConflicts: (herbs: string[], population: string = 'adults') =>
    request<KGInferenceResponse>('/kg/infer/conflict', {
      method: 'POST',
      body: JSON.stringify({ herbs, reasoning_type: 'conflict', population }),
    }),
};

/**
 * 多租户管理 API
 */
export const tenantApi = {
  /** 获取租户隔离级别 */
  getIsolationLevel: (orgId: number) =>
    request<{ success: boolean; level: number; policy: MultiTenantPolicy }>(
      `/teams/${orgId}/isolation-level`
    ),

  /** 设置租户隔离级别 */
  setIsolationLevel: (orgId: number, level: number) =>
    request<{ success: boolean }>(
      `/teams/${orgId}/isolation-level`,
      { method: 'PUT', body: JSON.stringify({ level }) }
    ),

  /** 获取租户 AI 配置 */
  getAIConfig: (orgId: number) =>
    request<{ success: boolean; data: TenantAIConfig }>(
      `/teams/${orgId}/ai-config`
    ),

  /** 更新租户 AI 配置 */
  updateAIConfig: (orgId: number, config: Partial<TenantAIConfig>) =>
    request<{ success: boolean }>(
      `/teams/${orgId}/ai-config`,
      { method: 'PUT', body: JSON.stringify(config) }
    ),

  /** 列出所有隔离策略 */
  listPolicies: () =>
    request<{ success: boolean; policies: MultiTenantPolicy[] }>('/tenant/policies'),
};

/**
 * 产品方案报告 API
 */
export const reportApi = {
  /** 生成产品方案报告 */
  generate: (formulaData: Record<string, unknown>) =>
    request<{ success: boolean; data: Record<string, unknown> }>(
      '/reports/product-plan',
      { method: 'POST', body: JSON.stringify(formulaData) }
    ),

  /** 导出报告为 PDF */
  exportPDF: (executionId: string) =>
    request<{ success: boolean; url: string }>(
      `/reports/${executionId}/pdf`,
      { method: 'POST' }
    ),

  /** 导出报告为 Markdown */
  exportMarkdown: (executionId: string) =>
    request<{ success: boolean; content: string }>(
      `/reports/${executionId}/markdown`,
      { method: 'POST' }
    ),
};
