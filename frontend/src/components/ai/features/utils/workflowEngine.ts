/**
 * Workflow Engine - 工作流引擎增强
 *
 * 基于 DeepSeek Harness 的 Workflow 能力：
 * - 脚本化编排
 * - 节点执行
 * - 结果聚合
 */

import { logger } from '@/utils/safeLogger';
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
        return this.executeTool(node, context);
      case 'llm':
        return this.executeLLM(node, context);
      case 'condition':
        return this.evaluateCondition(node, context);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  private async executeTool(node: WorkflowNode, context: Record<string, unknown>): Promise<unknown> {
    const toolName = node.config.tool as string;
    const args = node.config.args as Record<string, unknown>;

    // 这里可以集成实际的工具调用
    logger.info(`[WorkflowEngine] Executing tool: ${toolName}`);
    return { tool: toolName, args, result: 'executed' };
  }

  private async executeLLM(node: WorkflowNode, context: Record<string, unknown>): Promise<string> {
    const prompt = node.config.prompt as string;
    // 这里可以集成 LLM Adapter
    logger.info(`[WorkflowEngine] Executing LLM node`);
    return `LLM response for ${prompt}`;
  }

  private evaluateCondition(node: WorkflowNode, context: Record<string, unknown>): boolean {
    const condition = node.config.condition as string;
    // 简单的条件评估
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