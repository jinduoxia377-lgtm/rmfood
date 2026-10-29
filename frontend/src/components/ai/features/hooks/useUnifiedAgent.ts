/**
 * useUnifiedAgent v3.3 - 集成 LLM Adapter 和增强错误处理
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { agentApi, type AgentTool, type AgentExecution } from '@/api/agent';
import { workflowApi, type WorkflowExecution } from '@/api/deep_dev';
import { logger } from '@/utils/safeLogger';
import { getWaterfallEmitter } from '../utils/waterfall';
import { scheduleToolCalls } from '../utils/parallelScheduler';
import {
  EventSourcedSession,
  checkCompactionTrigger,
  tokenEstimator,
  createTurnStartEvent,
  createTurnEndEvent,
  createStepStartEvent,
  createStepEndEvent,
} from '../utils/eventSourcing';
import { tryAcquireCompactionLock, releaseCompactionLock } from '../utils/compactionLock';
import type {
  AgentMessage,
  ToolCall,
  ExecutionStage,
  TurnState,
  StepState,
} from '@/components/ai/shared/types';

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
  availableTools: import('@/api/agent').AgentTool[];
  workflowTemplates: import('@/api/deep_dev').WorkflowTemplate[];
  currentTurn: TurnState | null;
  turnHistory: TurnState[];
  tokenCount: number;
  setWorkflowType: (type: string) => void;
  sendMessage: (content: string, workflowTypeParam?: string) => Promise<void>;
  clearMessages: () => void;
  reloadTemplates: () => Promise<void>;
  execute: (query: string, workflowTypeParam?: string) => Promise<void>;
}

// ── 常量配置 ───────────────────────────────────────────────

const MAX_PARALLEL_TOOLS = 10;
const COMPACTION_MAX_TOKENS = 128000;
const MAX_INPUT_LENGTH = 4000;

// ── 默认工作流模板 ─────────────────────────────────────────

const DEFAULT_WORKFLOW_TEMPLATES: import('@/api/deep_dev').WorkflowTemplate[] = [
  {
    template_id: 'formula_design',
    id: 'formula_design',
    name: '配方设计',
    label: '配方设计',
    description: 'RAG检索 → 配方生成 → 合规检查 → 报告输出',
    category: 'design',
    icon: null,
    node_count: null,
    estimated_duration: null,
    nodes: [],
    edges: [],
    preset_config: {},
  },
  {
    template_id: 'compliance_check',
    id: 'compliance_check',
    name: '合规预审',
    label: '合规预审',
    description: '多维度合规检查 + 自动修复建议',
    category: 'compliance',
    icon: null,
    node_count: null,
    estimated_duration: null,
    nodes: [],
    edges: [],
    preset_config: {},
  },
  {
    template_id: 'experiment_plan',
    id: 'experiment_plan',
    name: '实验方案',
    label: '实验方案',
    description: '配方 → 体外/体内实验设计 → 指标体系',
    category: 'experiment',
    icon: null,
    node_count: null,
    estimated_duration: null,
    nodes: [],
    edges: [],
    preset_config: {},
  },
  {
    template_id: 'ingredient_lookup',
    id: 'ingredient_lookup',
    name: '原料查询',
    label: '原料查询',
    description: '药材功效/法规/配伍禁忌查询',
    category: 'lookup',
    icon: null,
    node_count: null,
    estimated_duration: null,
    nodes: [],
    edges: [],
    preset_config: {},
  },
  {
    template_id: 'full_pipeline',
    id: 'full_pipeline',
    name: '全流程',
    label: '全流程',
    description: 'RAG→配方→合规→实验→报告完整链路',
    category: 'pipeline',
    icon: null,
    node_count: null,
    estimated_duration: null,
    nodes: [],
    edges: [],
    preset_config: {},
  },
];

export function useUnifiedAgent(options: UseUnifiedAgentOptions = {}): UseUnifiedAgentReturn {
  const {
    initialWorkflowType = 'formula_design',
    onComplete,
    onError,
  } = options;

  // ── 核心状态 ─────────────────────────────────────────────
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [stages, setStages] = useState<ExecutionStage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executedCount, setExecutedCount] = useState(0);
  const [workflowType, setWorkflowType] = useState(initialWorkflowType);
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<import('@/api/deep_dev').WorkflowTemplate[]>(DEFAULT_WORKFLOW_TEMPLATES);
  const [currentTurn, setCurrentTurn] = useState<TurnState | null>(null);
  const [turnHistory, setTurnHistory] = useState<TurnState[]>([]);
  const [tokenCount, setTokenCount] = useState(0);

  // ── 引用 ──────────────────────────────────────────────────
  const sessionRef = useRef<EventSourcedSession | null>(null);
  const emitterRef = useRef<ReturnType<typeof getWaterfallEmitter> | null>(null);
  const turnIdRef = useRef<string>('');

  // ── 初始化 ────────────────────────────────────────────────
  useEffect(() => {
    const session = new EventSourcedSession();
    session.open().catch((err) => logger.error('[useUnifiedAgent] Failed to open session:', err));
    sessionRef.current = session;

    const emitter = getWaterfallEmitter();
    emitterRef.current = emitter;

    // 注册 pre-step 监听器 (输入验证)
    const offPreStep = emitter.on('agent/pre-step', async (data, next) => {
      const { input } = data as { input: string; turnId: string };

      // 输入验证
      if (!input || input.trim().length === 0) {
        logger.warn('[useUnifiedAgent] Empty input, rejecting turn');
        return; // 不调用 next()，turn 以空 step 关闭
      }

      // 输入长度检查
      if (input.length > MAX_INPUT_LENGTH) {
        data.input = input.slice(0, MAX_INPUT_LENGTH) + '...[truncated]';
        logger.warn('[useUnifiedAgent] Input truncated to max length');
      }

      // 敏感信息过滤
      data.input = filterSensitiveData(input);

      // Compaction 检查
      const session = sessionRef.current;
      if (session) {
        const decision = checkCompactionTrigger(session, COMPACTION_MAX_TOKENS);
        if (decision.trigger && decision.canCompact) {
          logger.info(`[useUnifiedAgent] Pre-step compaction check: ${decision.trigger}`);
        }
      }

      next();
    });

    // 注册 request-error 监听器 (增强版)
    const offRequestError = emitter.on('agent/request-error', async (data, next) => {
      const { error, turnId, stepId } = data as {
        error: unknown;
        turnId: string;
        stepId: string;
      };

      const normalized = normalizeError(error);
      logger.warn(`[useUnifiedAgent] Request error in turn ${turnId}:`, normalized);

      switch (normalized.code) {
        case 'EMPTY_RESPONSE':
          logger.info('[useUnifiedAgent] Empty response, will retry');
          await sleep(1000);
          // 重试逻辑由调用方处理
          return;
        
        case 'CONTEXT_WINDOW_EXCEEDED':
          logger.info('[useUnifiedAgent] Context window exceeded, triggering compaction');
          try {
            await doCompaction();
            // 压缩后重试
            await executeStep(turnId, stepId);
            return;
          } catch (compactionErr) {
            logger.error('[useUnifiedAgent] Compaction failed:', compactionErr);
            next();
            return;
          }
        
        case 'RATE_LIMITED':
          logger.info('[useUnifiedAgent] Rate limited, waiting');
          await sleep(5000);
          await executeStep(turnId, stepId);
          return;
        
        case 'INVALID_AUTH':
          logger.error('[useUnifiedAgent] Invalid auth, aborting');
          next();
          return;
        
        default:
          next();
      }
    });

    // 注册 turn-stopping 监听器
    const offTurnStopping = emitter.onSerial('agent/turn-stopping', (data) => {
      logger.info(`[useUnifiedAgent] Turn stopping: ${data.turnId}, reason=${data.reason}`);
    });

    return () => {
      offPreStep();
      offRequestError();
      offTurnStopping();
      session.close();
      // P2-F1 修复：原调用 emitter.setEnabled(false) 禁用的是全局单例 waterfall
      // emitter，用户从 Chief 视图切走后被永久禁用，再次进入时事件失效。
      // 订阅者已在上方 off*() 注销，无需也不应禁用全局单例。
    };
  }, []);

  // ── 工具函数 ──────────────────────────────────────────────
  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const normalizeError = (error: unknown) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('context') || msg.includes('too long') || msg.includes('maximum')) {
        return { message: error.message, code: 'CONTEXT_WINDOW_EXCEEDED', retryable: false };
      }
      if (msg.includes('empty') || msg.includes('no response') || msg.includes('invalid')) {
        return { message: error.message, code: 'EMPTY_RESPONSE', retryable: true };
      }
      if (msg.includes('timeout')) {
        return { message: error.message, code: 'TIMEOUT', retryable: true };
      }
      if (msg.includes('429') || msg.includes('rate limit')) {
        return { message: error.message, code: 'RATE_LIMITED', retryable: true };
      }
      if (msg.includes('401') || msg.includes('auth') || msg.includes('unauthorized')) {
        return { message: error.message, code: 'INVALID_AUTH', retryable: false };
      }
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed')) {
        return { message: error.message, code: 'NETWORK_ERROR', retryable: true };
      }
    }
    return { message: String(error), code: 'UNKNOWN_ERROR', retryable: false };
  };

  const filterSensitiveData = (input: string): string => {
    // 简单的敏感信息过滤
    return input
      .replace(/(\d{4})\s*(\d{4})\s*(\d{4})\s*(\d{4})/g, '$1**** **** $4')
      .replace(/\b\d{17,19}\b/g, '***')
      .replace(/[\u4e00-\u9fa5]{2,4}(?:身份证|护照|银行卡)\s*[:：]?\s*\S+/g, '$1***');
  };

  // ── 加载工具列表 ─────────────────────────────────────────
  const loadTools = useCallback(async () => {
    try {
      const res = await agentApi.listTools();
      setAvailableTools(res.tools || []);
    } catch (err) {
      logger.warn('[useUnifiedAgent] Failed to load tools, using defaults:', err);
    }
  }, []);

  // ── 加载工作流模板 ───────────────────────────────────────
  const reloadTemplates = useCallback(async () => {
    try {
      // 必须使用 Agent 工作流模板（listAgentTemplates → /agent/workflows/templates），
      // 与 execute()（→ /agent/workflow/{type}/execute）同源，保证模板展示与执行类型一致。
      // 不能改用 listTemplates()（→ /workflows/templates，那是 workflow_exec 模板，
      // 且 WorkflowVisualEditor 依赖它，二者类型/用途不同）。
      const res = await workflowApi.listAgentTemplates();
      setWorkflowTemplates(
        (res.items || []).map((t) => ({
          template_id: t.template_id,
          // Agent 工作流模板接口仅返回 template_id，无 id；回退到 template_id 保证
          // AgentWorkflowTab 的 `t.id === workflowType` 比较命中。
          id: t.id ?? t.template_id,
          name: t.name,
          label: t.name,
          description: t.description ?? undefined,
          category: t.category ?? '',
          icon: t.icon ?? undefined,
          node_count: t.node_count ?? undefined,
          estimated_duration: t.estimated_duration ?? undefined,
          nodes: t.nodes ?? [],
          edges: t.edges ?? [],
          preset_config: t.preset_config ?? {},
        }))
      );
    } catch (err) {
      logger.warn('[useUnifiedAgent] Failed to load templates from API:', err);
    }
  }, []);

  useEffect(() => {
    loadTools();
    reloadTemplates();
  }, [loadTools, reloadTemplates]);

  // ── 添加消息 ─────────────────────────────────────────────
  const addMessage = useCallback(
    (role: AgentMessage['role'], content: string, metadata?: Record<string, unknown>) => {
      const msg: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        content,
        timestamp: new Date(),
        ...metadata,
      };
      setMessages((prev) => [...prev, msg]);

      const session = sessionRef.current;
      if (session) {
        session.append(
          role === 'user' ? 'user/message' : 'assistant/message',
          { content, id: msg.id, metadata }
        ).catch((err) => logger.error('[useUnifiedAgent] Failed to persist message:', err));
      }

      return msg;
    },
    []
  );

  // ── 更新最后一条助手消息 ─────────────────────────────────
  const updateLastAssistantMessage = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        if (lastIdx >= 0 && newMsgs[lastIdx].role === 'assistant') {
          newMsgs[lastIdx] = { ...newMsgs[lastIdx], content, ...metadata };
        }
        return newMsgs;
      });
    },
    []
  );

  // ── 开始新 Turn ──────────────────────────────────────────
  const startTurn = useCallback((input: string, wfType: string): string => {
    const turnId = `turn-${Date.now()}`;
    turnIdRef.current = turnId;
    const turnState: TurnState = {
      turnId,
      status: 'running',
      steps: [],
      startedAt: Date.now(),
      input,
    };
    setCurrentTurn(turnState);

    const session = sessionRef.current;
    if (session) {
      session.append('turn/start', createTurnStartEvent(turnId, input, wfType))
        .catch((err) => logger.error('[useUnifiedAgent] 持久化 turn/start 失败:', err));
    }

    const emitter = emitterRef.current;
    if (emitter) {
      emitter.emit('agent/pre-step', { input, turnId })
        .catch((err) => logger.error('[useUnifiedAgent] 发送 pre-step 事件失败:', err));
    }

    return turnId;
  }, []);

  // ── 添加 Step (前置声明以避免循环依赖) ──────────────────────
  const addStep = useCallback((stepType: StepState['type'], toolName?: string) => {
    const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const stepState: StepState = {
      stepId,
      type: stepType,
      status: 'running',
      latencyMs: 0,
      toolName,
      startedAt: Date.now(),
    };
    setCurrentTurn((prev) => {
      if (!prev) return prev;
      return { ...prev, steps: [...prev.steps, stepState] };
    });

    const session = sessionRef.current;
    if (session) {
      session.append('step/start', createStepStartEvent(stepId, stepType, toolName))
        .catch((err) => logger.error('[useUnifiedAgent] 持久化 step/start 失败:', err));
    }

    return stepId;
  }, []);

  // ── 完成 Step (前置声明以避免循环依赖) ──────────────────────
  const completeStep = useCallback(
    (stepId: string, success: boolean, error?: string, result?: unknown) => {
      const latencyMs = Date.now() - (currentTurn?.steps.find((s) => s.stepId === stepId)?.startedAt ?? Date.now());
      setCurrentTurn((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.stepId === stepId
              ? { ...s, status: success ? 'success' : 'failed', latencyMs, error, result, completedAt: Date.now() }
              : s
          ),
        };
      });

      const session = sessionRef.current;
      if (session) {
        const stepType = currentTurn?.steps.find((s) => s.stepId === stepId)?.type ?? 'llm_request';
        session.append('step/end', createStepEndEvent(stepId, stepType, latencyMs, success, error))
          .catch((err) => logger.error('[useUnifiedAgent] 持久化 step/end 失败:', err));
      }
    },
    [currentTurn]
  );

  // ── 执行 Step ────────────────────────────────────────────
  const executeStep = useCallback(async (
    turnId: string,
    stepId?: string,
    query?: string
  ): Promise<AgentExecution | null> => {
    const emitter = emitterRef.current;
    const stepId_ = stepId ?? `step-${Date.now()}`;
    // 优先使用传入的 query，回退到 currentTurn.input（React 闭包安全）
    const effectiveQuery = query || currentTurn?.input || '';

    if (!effectiveQuery) {
      logger.warn('[executeStep] Empty query, skipping');
      completeStep(stepId_, true);
      return null;
    }

    // 触发 request 事件
    await emitter?.emit('agent/request', { turnId, model: 'deepseek-chat' }).catch(() => {});

    // 执行 Step (使用真实 LLM Adapter)
    try {
      const res = await agentApi.execute({ query: effectiveQuery, mode: 'smart', max_steps: 8 });
      const execution = res.data;
      // 保存执行结果，供 UI 展示工具调用详情
      completeStep(stepId_, true, undefined, execution);
      return execution;
    } catch (err) {
      logger.error('[executeStep] Execution error:', err);
      completeStep(stepId_, false, err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [completeStep, currentTurn]);

  // ── 结束 Turn ────────────────────────────────────────────
  const endTurn = useCallback(
    (turnId: string, reason: 'completed' | 'cancelled' | 'timeout' = 'completed') => {
      const durationMs = Date.now() - (currentTurn?.startedAt ?? Date.now());
      setCurrentTurn(null);

      const session = sessionRef.current;
      if (session) {
        session.append('turn/end', createTurnEndEvent(turnId, durationMs, reason))
          .catch((err) => logger.error('[useUnifiedAgent] 持久化 turn/end 失败:', err));
      }

      const emitter = emitterRef.current;
      if (emitter) {
        emitter.emitSerial('agent/turn-stopping', { turnId, reason })
          .catch((err) => logger.error('[useUnifiedAgent] 发送 turn-stopping 事件失败:', err));
      }

      if (currentTurn) {
        setTurnHistory((prev) => [...prev, { ...currentTurn, completedAt: Date.now() }]);
      }
    },
    [currentTurn]
  );

  // ── 执行工具调用 (有界并行) ────────────────────────────────
  const executeToolCalls = useCallback(
    async (calls: ToolCall[]): Promise<ToolCall[]> => {
      const emitter = emitterRef.current;

      await emitter?.emit('tools/pre-execute', { toolCalls: calls });

      const results = await scheduleToolCalls(calls, MAX_PARALLEL_TOOLS);

      const updatedCalls: ToolCall[] = calls.map((call, idx) => {
        const result = results[idx];
        return {
          ...call,
          status: result?.error ? 'failed' : 'success',
          latencyMs: result?.latencyMs ?? call.latencyMs,
          output: result?.result as Record<string, unknown>,
          error: result?.error,
        };
      });

      await emitter?.emit('tools/post-execute', { results });

      setTools(updatedCalls);
      return updatedCalls;
    },
    []
  );

  // ── Compaction ───────────────────────────────────────────
  const doCompaction = useCallback(async (): Promise<boolean> => {
    const session = sessionRef.current;
    if (!session) return false;

    const decision = checkCompactionTrigger(session, COMPACTION_MAX_TOKENS);
    if (!decision.trigger) return false;

    const lock = await tryAcquireCompactionLock(null);
    if (!lock) {
      logger.warn('[useUnifiedAgent] Could not acquire compaction lock');
      return false;
    }

    try {
      logger.info(`[useUnifiedAgent] Compaction triggered: ${decision.trigger}`);

      const allMessages = session.deriveMessages();
      const keepCount = Math.max(10, Math.floor(allMessages.length * 0.2));
      const remaining = allMessages.slice(-keepCount);

      const summary: AgentMessage = {
        id: `msg-compact-${Date.now()}`,
        role: 'assistant',
        content: `[上下文已压缩] 保留最近 ${remaining.length} 条消息，压缩了 ${allMessages.length - remaining.length} 条历史消息。`,
        timestamp: new Date(),
      };

      setMessages([summary, ...remaining]);
      setTokenCount(tokenEstimator.estimate([summary, ...remaining]));

      if (session.seq > keepCount + 5) {
        const toReplaceFrom = Math.max(0, session.seq - keepCount - 10);
        const replacementEvents: any[] = [{
          seq: 0,
          type: 'assistant/message',
          data: { content: summary.content, id: summary.id },
          timestamp: Date.now(),
        }];
        for (const msg of remaining) {
          replacementEvents.push({
            seq: replacementEvents.length,
            type: msg.role === 'user' ? 'user/message' : 'assistant/message',
            data: { content: msg.content, id: msg.id },
            timestamp: msg.timestamp.getTime(),
          });
        }
        await session.replaceEvents(toReplaceFrom, session.seq, replacementEvents);
      }

      // 使消息缓存失效
      session.invalidateMessageCache();

      return true;
    } finally {
      releaseCompactionLock(lock.compactionId, 'completed');
    }
  }, []);

  // ── 核心执行方法 ─────────────────────────────────────────
  const execute = useCallback(
    async (query: string, workflowTypeParam?: string): Promise<void> => {
      if (!query.trim() || isRunning) return;

      const wfType = workflowTypeParam || workflowType;
      setIsRunning(true);
      setTools([]);
      setStages([]);

      addMessage('user', query);

      const session = sessionRef.current;
      if (session) {
        const decision = checkCompactionTrigger(session, COMPACTION_MAX_TOKENS);
        if (decision.trigger) {
          await doCompaction();
        }
        setTokenCount(session.estimateTokenCount());
      }

      const turnId = startTurn(query, wfType);
      addMessage('assistant', '', { executionId: turnId, workflowType: wfType });

      // 真实 stepId 跟踪：addStep 生成 `step-<ts>-<rand>`，completeStep 必须复用同一个 id，
      // 不能再用字面量 'final-response'（否则找不到对应 step，步骤状态/耗时无法更新）。
      let finalStepId: string | null = null;

      try {
        const emitter = emitterRef.current;
        await emitter?.emit('agent/request', { turnId, model: 'deepseek-chat' }).catch(() => {});

        // 尝试工作流执行（优先路径）
        let result: AgentExecution | WorkflowExecution | null = null;
        let workflowSucceeded = false;

        try {
          const wfRes = await workflowApi.execute(wfType, { query, max_steps: 8 });
          result = wfRes.data;
          workflowSucceeded = true;

          if ('stages' in result) {
            setStages(result.stages.map((s) => ({
              stage: s.stage,
              success: s.success,
              latencyMs: s.latency_ms,
              error: s.error,
            })));
          }
        } catch (wfErr) {
          logger.info('Workflow execution failed, fallback to smart mode:', wfErr);
        }

        // 工作流失败时使用 smart 模式（含 LLM 调用）
        if (!workflowSucceeded) {
          const stepId = addStep('llm_request');
          finalStepId = stepId;
          const exec = await executeStep(turnId, stepId, query);

          // 将 smart 模式的工具调用结果呈现给 UI，避免详情丢失
          if (exec && 'steps' in exec && exec.steps.length > 0) {
            result = exec;
            const toolCalls: ToolCall[] = exec.steps.map((s) => ({
              tool: s.tool,
              status: (s.status === 'success' ? 'success' : s.status === 'failed' ? 'failed' : 'running') as ToolCall['status'],
              latencyMs: s.latency_ms || 0,
              error: s.error,
              isConcurrencySafe: true,
            }));
 await executeToolCalls(toolCalls);
          }
        } else {
          // 工作流成功时补全 final-response step（记录真实 stepId 供 completeStep 使用）
          finalStepId = addStep('final_response');
        }

        // 若工作流成功但未获取到 result（异常），降级到 smart 模式
        if (!result) {
          // 兜底 smart 模式：若此前没有可追踪的 step，为其补建一个（避免 completeStep 空转）
          if (!finalStepId) finalStepId = addStep('llm_request');
          const smartRes = await agentApi.execute({ query, mode: 'smart', max_steps: 5 });
          result = smartRes.data;

          if ('steps' in result) {
            const toolCalls: ToolCall[] = result.steps.map((s) => ({
              tool: s.tool,
              status: (s.status === 'success' ? 'success' : s.status === 'failed' ? 'failed' : 'running') as ToolCall['status'],
              latencyMs: s.latency_ms || 0,
              error: s.error,
              isConcurrencySafe: true,
            }));
            await executeToolCalls(toolCalls);
          }
        }

        const finalContent = ('final_response' in result && result.final_response
          ? result.final_response
          : ('final_response_preview' in result
            ? result.final_response_preview
            : '')) || '执行完成';

        updateLastAssistantMessage(finalContent, { executionId: turnId });
        if (finalStepId) completeStep(finalStepId, true, undefined, finalContent);

        setExecutedCount((c) => c + 1);
        onComplete?.(undefined);

        if (session) setTokenCount(session.estimateTokenCount());

        endTurn(turnId, 'completed');
      } catch (err) {
        logger.error('[useUnifiedAgent] Execution failed:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateLastAssistantMessage(`执行失败：${errorMsg}`);
        if (finalStepId) completeStep(finalStepId, false, errorMsg);
        onError?.(err instanceof Error ? err : new Error(String(err)));
        endTurn(turnId, 'cancelled');
      } finally {
        setIsRunning(false);
      }
    },
    [
      isRunning, workflowType, addMessage, updateLastAssistantMessage,
      startTurn, endTurn, completeStep, executeToolCalls, doCompaction,
      onComplete, onError, addStep, executeStep,
    ]
  );

  const sendMessage = useCallback(async (content: string, workflowTypeParam?: string): Promise<void> => {
    // P1-F2：允许调用方显式传入智能路由推荐的工作流类型，
    // 避免 setWorkflowType 异步未生效导致 execute 读到旧类型（stale-closure）。
    await execute(content, workflowTypeParam);
  }, [execute]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setTools([]);
    setStages([]);
    setExecutedCount(0);
    setCurrentTurn(null);
    setTurnHistory([]);
    setTokenCount(0);

    const session = sessionRef.current;
    if (session) await session.clear();
  }, []);

  return {
    messages,
    tools,
    stages,
    isRunning,
    executedCount,
    workflowType,
    availableTools,
    workflowTemplates,
    currentTurn,
    turnHistory,
    tokenCount,
    setWorkflowType,
    sendMessage,
    clearMessages,
    reloadTemplates,
    execute,
  };
}


