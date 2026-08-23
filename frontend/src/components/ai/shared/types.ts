/**
 * Agent 共享类型定义
 *
 * 供 AgentWorkflowTab 和 ChatTab 共用
 */

// ── 消息类型 ───────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AgentMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  executionId?: string;
  workflowType?: string;
  metadata?: Record<string, unknown>;
}

// ── 工具调用类型 ───────────────────────────────────────────

export type ToolCallStatus = 'running' | 'success' | 'failed';

export interface ToolCall {
  tool: string;
  status: ToolCallStatus;
  latencyMs: number;
  error?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

// ── 执行阶段类型 ───────────────────────────────────────────

export interface ExecutionStage {
  stage: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  progress?: number; // 0-100
}

// ── 执行状态类型 ───────────────────────────────────────────

export interface ExecutionState {
  isRunning: boolean;
  messages: AgentMessage[];
  tools: ToolCall[];
  stages: ExecutionStage[];
  executedCount: number;
  error?: string;
}

// ── 工作流模板类型 ─────────────────────────────────────────

export interface WorkflowTemplate {
  template_id: string;
  id: string;
  name: string;
  label: string;
  description?: string;
  desc?: string;
  icon?: string;
  node_count?: number;
  estimated_duration?: string;
  category: string;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  preset_config?: Record<string, unknown>;
}

// ── Agent 工具类型 ─────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}
