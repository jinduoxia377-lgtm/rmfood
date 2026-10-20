/**
 * Workflow Engine - 本地工作流执行引擎（备用）
 *
 * 用于在离线或后端不可用时执行简单工作流。
 * 当前主执行路径通过 workflowApi.execute() 直接调用后端；
 * 此类保留供未来本地编排扩展使用。
 */

import { logger } from '@/utils/safeLogger';
import { fetchWithCsrf } from '@/utils/csrf';
import { chatService } from '../services/chatService';
import type { ExecutionStage } from '@/components/ai/shared/types';

// ── 类型定义 ────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'tool' | 'llm' | 'condition' | 'loop' | 'parallel';
  config: Record<string, unknown>;
  dependencies?: string[];
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNode: string;
}

export interface WorkflowResult {
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stages: ExecutionStage[];
  output?: Record<string, unknown>;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

// ── Workflow Engine ─────────────────────────────────────────

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowResult> = new Map();

  /**
   * 注册工作流定义
   */
  registerWorkflow(def: WorkflowDefinition): void {
    this.workflows.set(def.id, def);
    logger.info(`[WorkflowEngine] Registered workflow: ${def.id}`);
  }

  /**
   * 执行工作流
   */
  async execute(workflowId: string, input: Record<string, unknown>): Promise<WorkflowResult> {
    const def = this.workflows.get(workflowId);
    if (!def) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const result: WorkflowResult = {
      workflowId,
      status: 'running',
      stages: [],
      output: {},
      startedAt: Date.now(),
    };

    this.executions.set(workflowId, result);

    try {
      // 拓扑排序执行节点
      const sorted = this.topologicalSort(def);
      const context = { ...input };

      for (const nodeId of sorted) {
        const node = def.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        const stage: ExecutionStage = {
          stage: node.name,
          success: false,
          latencyMs: 0,
        };

        const startTime = Date.now();
        try {
          // 执行节点
          const output = await this.executeNode(node, context);
          stage.success = true;
          stage.output = output;
          context[nodeId] = output;
        } catch (err) {
          stage.error = err instanceof Error ? err.message : String(err);
          stage.success = false;
          result.error = stage.error;
          result.status = 'failed';
          break;
        } finally {
          stage.latencyMs = Date.now() - startTime;
        }

        result.stages.push(stage);
      }

      if (result.status === 'running') {
        result.status = 'completed';
        result.output = context;
      }
    } finally {
      result.completedAt = Date.now();
      this.executions.delete(workflowId);
    }

    return result;
  }

  /**
   * 执行单个节点
   */
  private async executeNode(node: WorkflowNode, context: Record<string, unknown>): Promise<unknown> {
    switch (node.type) {
      case 'tool':
        return this.executeTool(node);
      case 'llm':
        return this.executeLLM(node);
      case 'condition':
        return this.evaluateCondition(node, context);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  private async executeTool(node: WorkflowNode): Promise<unknown> {
    const toolName = node.config.tool as string;
    const args = node.config.args as Record<string, unknown>;

    if (!toolName || typeof toolName !== 'string') {
      throw new Error('工具节点缺少 tool 配置（config.tool），请检查工作流定义');
    }

    logger.info(`[WorkflowEngine] Executing tool: ${toolName}`, args);

    try {
      // 根据工具名称路由到真实存在的后端 API（2026-10-12 修复：此前指向不存在的端点导致 404）
      if (toolName.includes('rag') || toolName.includes('search') || toolName.includes('knowledge')) {
        // RAG 知识检索端点尚未接入后端，明确报错而非调用不存在的路径
        throw new Error('RAG 知识检索工具暂未接入后端，请使用 /ai 页面的搜索功能替代');
      }
      if (toolName.includes('formula') || toolName.includes('generate') || toolName.includes('design')) {
        // 指向真实 GA 配方生成端点（/api/v1/ai/generate），需要 target_effects
        const effectsRaw = Array.isArray(args?.target_effects) ? args.target_effects : (args?.query || args?.description || '增强免疫');
        const effects = Array.isArray(effectsRaw) ? effectsRaw.map(String) : [String(effectsRaw)];
        return await this.callApi('/api/v1/ai/generate', {
          target_effects: effects.slice(0, 5),
          use_llm: true,
        });
      }
      if (toolName.includes('compliance') || toolName.includes('check') || toolName.includes('safety')) {
        // 指向真实合规检查端点（/api/v1/compliance/check/realtime）
        const ingredients = Array.isArray(args?.ingredients) ? args.ingredients : (Array.isArray(args?.current_ingredients) ? args.current_ingredients : []);
        return await this.callApi('/api/v1/compliance/check/realtime', { current_ingredients: ingredients });
      }
      if (toolName.includes('experiment') || toolName.includes('plan')) {
        // 实验方案规划端点尚未接入后端，明确报错
        throw new Error('实验方案规划工具暂未接入后端');
      }
      if (toolName.includes('kg') || toolName.includes('graph') || toolName.includes('inference')) {
        // 指向真实知识图谱推理端点（/api/v1/kg/infer/all）
        return await this.callApi('/api/v1/kg/infer/all', args ?? {});
      }
      // 默认：通过通用 Agent API 执行（真实端点 /api/v1/agent/execute）
      return await this.callApi('/api/v1/agent/execute', { tool: toolName, arguments: args });
    } catch (err) {
      throw new Error(`Tool execution failed: ${toolName} - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async callApi(path: string, body: Record<string, unknown>): Promise<unknown> {
    return fetchWithCsrf(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async executeLLM(node: WorkflowNode): Promise<string> {
    const prompt = node.config.prompt as string;
    const systemPrompt = node.config.system_prompt as string | undefined;

    logger.info(`[WorkflowEngine] Executing LLM node`, { promptLength: prompt?.length });

    try {
      // 复用 chatService.sendMessage：统一走 axios 认证拦截器（cookie 自动携带 + 401 自动刷新），
      // 并获得去重、重试、CSRF 等能力，避免裸 fetchWithCsrf 在 401 时认证链路断裂
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const response = await chatService.sendMessage(fullPrompt, undefined, { temperature: 0.3, maxTokens: 2048 });
      return response.content?.trim() ?? '[LLM response unavailable]';
    } catch (err) {
      logger.warn('[WorkflowEngine] LLM 调用失败，降级为本地占位响应:', err);
      // 降级：返回本地占位而非伪造 LLM 回复，调用方可据此判断
      return `[LLM response for ${prompt?.slice(0, 30)}...]`;
    }
  }

  private evaluateCondition(node: WorkflowNode, context: Record<string, unknown>): boolean {
    const condition = node.config.condition as string;
    if (!condition) return true;
    // 简单的条件评估：支持 "if_result_success" 等语义
    if (condition === 'if_result_success') {
      return !!context[node.dependencies?.[0] ?? ''];
    }
    // 默认放行
    return true;
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(def: WorkflowDefinition): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = def.nodes.find(n => n.id === nodeId);
      if (!node) return;

      for (const dep of node.dependencies ?? []) {
        visit(dep);
      }

      result.push(nodeId);
    };

    visit(def.entryNode);
    return result;
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(workflowId: string): WorkflowResult | undefined {
    return this.executions.get(workflowId);
  }
}

// 全局单例
let _engine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!_engine) {
    _engine = new WorkflowEngine();
  }
  return _engine;
}