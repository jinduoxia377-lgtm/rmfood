/**
 * 推理链数据结构类型定义
 *
 * 参考LangChain的Thought-Action-Observation模式设计
 *
 * 推理过程三要素：
 * - Thought: 思考 - AI对当前状态的分析和推理
 * - Action: 行动 - AI执行的工具调用或操作
 * - Observation: 观察 - 行动执行后的结果或反馈
 */

// ==================== 推理步骤类型枚举 ====================

/**
 * 推理步骤类型
 */
export enum InferenceStepType {
  /** 思考步骤 */
  THOUGHT = 'THOUGHT',
  /** 行动步骤（工具调用） */
  ACTION = 'ACTION',
  /** 观察结果 */
  OBSERVATION = 'OBSERVATION',
  /** 最终总结 */
  SUMMARY = 'SUMMARY',
}

/**
 * 推理步骤状态
 */
export enum InferenceStepStatus {
  /** 等待执行 */
  PENDING = 'PENDING',
  /** 执行中 */
  RUNNING = 'RUNNING',
  /** 成功完成 */
  SUCCESS = 'SUCCESS',
  /** 执行失败 */
  FAILED = 'FAILED',
  /** 被跳过 */
  SKIPPED = 'SKIPPED',
}

/**
 * 工具调用类型
 */
export enum ToolType {
  /** 搜索工具 */
  SEARCH = 'SEARCH',
  /** 数据库查询 */
  DATABASE_QUERY = 'DATABASE_QUERY',
  /** API调用 */
  API_CALL = 'API_CALL',
  /** 计算工具 */
  CALCULATOR = 'CALCULATOR',
  /** 配方分析 */
  FORMULA_ANALYSIS = 'FORMULA_ANALYSIS',
  /** 协同效应评估 */
  SYNERGY_ANALYSIS = 'SYNERGY_ANALYSIS',
  /** 安全检查 */
  SAFETY_CHECK = 'SAFETY_CHECK',
  /** 文件读取 */
  FILE_READ = 'FILE_READ',
  /** 报告生成 */
  REPORT_GENERATION = 'REPORT_GENERATION',
}

// ==================== 工具定义 ====================

/**
 * 工具参数接口
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  value: unknown;
  description?: string;
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  /** 工具类型 */
  toolType: ToolType;
  /** 工具名称 */
  toolName: string;
  /** 工具描述 */
  description?: string;
  /** 调用参数 */
  parameters: ToolParameter[];
  /** 工具唯一标识 */
  toolId: string;
}

/**
 * 工具执行结果接口
 */
export interface ToolResult {
  /** 工具调用ID */
  toolCallId: string;
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: Record<string, unknown>;
  /** 返回消息 */
  message?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 执行耗时（毫秒） */
  executionTime?: number;
}

// ==================== 推理步骤接口 ====================

/**
 * 单个推理步骤接口
 */
export interface InferenceStep {
  /** 步骤唯一标识 */
  id: string;
  /** 步骤类型 */
  type: InferenceStepType;
  /** 步骤状态 */
  status: InferenceStepStatus;
  /** 步骤索引（在链中的位置） */
  index: number;
  /** 步骤标题 */
  title: string;
  /** 步骤内容 */
  content: string;
  /** 工具调用（仅Action类型） */
  toolCall?: ToolCall;
  /** 工具执行结果（仅Action/Observation类型） */
  toolResult?: ToolResult;
  /** 关联的前序步骤ID */
  previousStepId?: string;
  /** 关联的后续步骤ID */
  nextStepId?: string;
  /** 思考深度（嵌套层级） */
  depth?: number;
  /** 置信度（0-1） */
  confidence?: number;
  /** 执行耗时（毫秒） */
  executionTime?: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 推理链接口
 */
export interface InferenceChain {
  /** 推理链唯一标识 */
  id: string;
  /** 推理链标题 */
  title: string;
  /** 推理链描述 */
  description?: string;
  /** 推理步骤列表 */
  steps: InferenceStep[];
  /** 起始步骤ID */
  startStepId: string;
  /** 结束步骤ID */
  endStepId: string;
  /** 总执行耗时（毫秒） */
  totalExecutionTime?: number;
  /** 整体置信度（0-1） */
  overallConfidence?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt?: number;
  /** 关联的任务/查询ID */
  taskId?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 推理链统计信息
 */
export interface InferenceChainStats {
  /** 步骤总数 */
  totalSteps: number;
  /** 思考步骤数 */
  thoughtCount: number;
  /** 行动步骤数 */
  actionCount: number;
  /** 观察步骤数 */
  observationCount: number;
  /** 成功步骤数 */
  successCount: number;
  /** 失败步骤数 */
  failedCount: number;
  /** 总执行耗时 */
  totalExecutionTime: number;
  /** 平均步骤耗时 */
  avgStepTime: number;
  /** 最大步骤耗时 */
  maxStepTime: number;
  /** 最小步骤耗时 */
  minStepTime: number;
}

// ==================== 可视化相关类型 ====================

/**
 * 步骤展开状态
 */
export interface StepExpansionState {
  stepId: string;
  isExpanded: boolean;
}

/**
 * 导航位置
 */
export interface NavigationPosition {
  currentStepId: string;
  currentIndex: number;
}

/**
 * 视图模式
 */
export type ViewMode = 'linear' | 'tree' | 'timeline';

/**
 * 过滤选项
 */
export interface FilterOptions {
  stepTypes: InferenceStepType[];
  statuses: InferenceStepStatus[];
  searchQuery: string;
}
