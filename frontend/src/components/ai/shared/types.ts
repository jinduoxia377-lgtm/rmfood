/**
 * 鏇存柊 shared/types.ts - 娣诲姞缂哄け鐨勭被鍨嬪畾涔? */

// 鈹€鈹€ 娑堟伅绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€ 宸ュ叿璋冪敤绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type ToolCallStatus = 'running' | 'success' | 'failed';

export interface ToolCall {
  callId?: string;
  tool: string;
  status: ToolCallStatus;
  latencyMs: number;
  error?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  isConcurrencySafe?: boolean;
}

export interface ToolResultData {
  callId: string;
  result: unknown;
  error?: string;
  latencyMs: number;
}

// 鈹€鈹€ 鎵ц闃舵绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface ExecutionStage {
  stage: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  progress?: number;
  output?: unknown;
}

// 鈹€鈹€ 鎵ц鐘舵€佺被鍨?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface ExecutionState {
  isRunning: boolean;
  messages: AgentMessage[];
  tools: ToolCall[];
  stages: ExecutionStage[];
  executedCount: number;
  error?: string;
}

// 鈹€鈹€ 宸ヤ綔娴佹ā鏉跨被鍨?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€ Agent 宸ュ叿绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface AgentTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

// 鈹€鈹€ Turn/Step 绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type TurnStatus = 'running' | 'completed' | 'cancelled' | 'timeout';
export type StepType = 'llm_request' | 'tool_call' | 'compaction' | 'final_response';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TurnState {
  turnId: string;
  status: TurnStatus;
  steps: StepState[];
  startedAt: number;
  completedAt?: number;
  input: string;
}

export interface StepState {
  stepId: string;
  type: StepType;
  status: StepStatus;
  latencyMs: number;
  toolName?: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

// 鈹€鈹€ Session 浜嬩欢绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type SessionEventType =
  | 'turn/start'
  | 'turn/end'
  | 'step/start'
  | 'step/end'
  | 'user/message'
  | 'assistant/message'
  | 'tool/call'
  | 'tool/result'
  | 'request/header'
  | 'request/context';

export interface SessionEvent {
  seq: number;
  type: SessionEventType;
  data: unknown;
  timestamp: number;
}

export interface TurnStartData {
  turnId: string;
  input: string;
  workflowType: string;
}

export interface TurnEndData {
  turnId: string;
  durationMs: number;
  reason: 'completed' | 'cancelled' | 'timeout';
}

export interface StepStartData {
  stepId: string;
  type: StepType;
  toolName?: string;
}

export interface StepEndData {
  stepId: string;
  type: StepType;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface ToolCallData {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  isConcurrencySafe: boolean;
}

export interface RequestHeader {
  provider: string;
  model: string;
  systemPrompt: string;
  toolSchemas: ToolSchema[];
  reasoningEffort: string;
  maxTokens?: number;
  timestamp: number;
  series?: string; // 娣诲姞 series 鏀寔
}

// 鈹€鈹€ Waterfall 浜嬩欢绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type WaterfallEvent =
  | 'agent/pre-step'
  | 'agent/request'
  | 'agent/request-error'
  | 'llm/stream'
  | 'tools/pre-execute'
  | 'tools/execute'
  | 'tools/post-execute';

export interface WaterfallEventData {
  'agent/pre-step': { input: string; turnId: string };
  'agent/request': { turnId: string; model: string };
  'llm/stream': { turnId: string; chunk: string };
  'tools/pre-execute': { toolCalls: ToolCall[] };
  'tools/execute': { toolCalls: ToolCall[] };
  'tools/post-execute': { results: ToolResultData[] };
}

export type SerialEvent = 'agent/turn-stopping';

export interface SerialEventData {
  'agent/turn-stopping': { turnId: string; reason: 'completed' | 'cancelled' | 'timeout' };
}

// 鈹€鈹€ Compaction 绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export type CompactionTrigger = 'pressure' | 'context-overflow';

export interface CompactionDecision {
  trigger: CompactionTrigger | null;
  canCompact: boolean;
  tokenCount: number;
  messageCount: number;
}

// 鈹€鈹€ Tool Schema 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isConcurrencySafe?: boolean;
}

// 鈹€鈹€ LLM Adapter 绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface LlmFailure {
  message: string;
  code: string;
  retryable: boolean;
}

export type StreamChunkType =
  | 'block-start'
  | 'block-end'
  | 'text-delta'
  | 'tool-call-delta'
  | 'usage'
  | 'finish'
  | 'error';

export interface BlockStartChunk {
  type: 'block-start';
  index: number;
  blockType: string;
}

export interface BlockEndChunk {
  type: 'block-end';
  index: number;
}

export interface TextDeltaChunk {
  type: 'text-delta';
  index: number;
  text: string;
}

export interface ToolCallDeltaChunk {
  type: 'tool-call-delta';
  index: number;
  id: string;
  name?: string;
  argumentsDelta: string;
}

export interface UsageChunk {
  type: 'usage';
  usage: TokenUsage;
}

export interface FinishChunk {
  type: 'finish';
  reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'abort';
  replayState?: ReplayEnvelope;
}

export interface ErrorChunk {
  type: 'error';
  failure: LlmFailure;
}

export type StreamChunk =
  | BlockStartChunk
  | BlockEndChunk
  | TextDeltaChunk
  | ToolCallDeltaChunk
  | UsageChunk
  | FinishChunk
  | ErrorChunk;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ReplayEnvelope {
  replayId: string;
  checkpointSeq: number;
}

export interface ModelRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  tools?: ToolSchema[];
  toolChoice?: string | object;
  stream?: boolean;
}

// 鈹€鈹€ Hook 杩斿洖绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface UseUnifiedAgentOptions {
  initialWorkflowType?: string;
  autoExecute?: boolean;
  onComplete?: (result: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseUnifiedAgentReturn {
  messages: AgentMessage[];
  tools: ToolCall[];
  stages: ExecutionStage[];
  isRunning: boolean;
  executedCount: number;
  workflowType: string;
  availableTools: AgentTool[];
  workflowTemplates: WorkflowTemplate[];
  currentTurn: TurnState | null;
  turnHistory: TurnState[];
  tokenCount: number;
  setWorkflowType: (type: string) => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  reloadTemplates: () => Promise<void>;
  execute: (query: string, workflowTypeParam?: string) => Promise<void>;
}

// ── 基础类型别名 ────────────────────────────────────────────

export type SessionId = string;
export type ToolCallId = string;
export type MessageId = string;
export type GoalId = string;
export type TeamId = string;
export type TeamTaskId = string;
export type TeamMessageId = string;

// ── Content Block 类型 ───────────────────────────────────────

export interface ContentBlock {
  type: string;
  text?: string;
  image?: {
    url: string;
    alt?: string;
  };
  [key: string]: unknown;
}

// ── LLM Adapter 接口 ────────────────────────────────────────

export interface LlmAdapter {
  provider: string;
  model: string;
  stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk>;
  complete(request: ModelRequest): Promise<string>;
  estimateTokens(messages: Array<{ role: string; content: string }>): number;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'abort';

// ── Stream Chunk 扩展类型 ──────────────────────────────────

export interface ToolCallDeltaChunkExtended {
  type: 'tool-call-delta';
  index: number;
  id: string;
  name?: string;
  argumentsDelta: string;
}
