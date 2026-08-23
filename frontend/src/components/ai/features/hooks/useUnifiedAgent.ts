/**
 * 统一的 Agent 执行 Hook
 *
 * 为 AgentWorkflowTab 和 ChatTab 提供统一的状态管理和执行逻辑
 *
 * 使用方式：
 * const { messages, tools, stages, execute, isRunning } = useUnifiedAgent();
 */
import { useState, useCallback, useEffect } from 'react';
import { agentApi, type AgentExecution, type AgentTool } from '@/api/agent';
import { workflowApi, type WorkflowExecution } from '@/api/deep_dev';
import { logger } from '@/utils/safeLogger';
import type {
  AgentMessage,
  ToolCall,
  ExecutionStage,
} from '@/components/ai/shared/types';

export interface UseUnifiedAgentOptions {
  /** 初始工作流类型，默认为 'formula_design' */
  initialWorkflowType?: string;
  /** 是否自动执行（用于 ChatTab，默认 false） */
  autoExecute?: boolean;
  /** 执行完成回调 */
  onComplete?: (result: AgentExecution | WorkflowExecution) => void;
  /** 执行错误回调 */
  onError?: (error: Error) => void;
}

export interface UseUnifiedAgentReturn {
  // 状态
  messages: AgentMessage[];
  tools: ToolCall[];
  stages: ExecutionStage[];
  isRunning: boolean;
  executedCount: number;
  workflowType: string;
  availableTools: AgentTool[];
  workflowTemplates: { id: string; name: string; description?: string; icon?: string }[];

  // 操作
  setWorkflowType: (type: string) => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  reloadTemplates: () => Promise<void>;
}

export function useUnifiedAgent(options: UseUnifiedAgentOptions = {}): UseUnifiedAgentReturn {
  const {
    initialWorkflowType = 'formula_design',
    autoExecute = false,
    onComplete,
    onError,
  } = options;

  // ── 状态 ───────────────────────────────────────────────────
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [stages, setStages] = useState<ExecutionStage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [executedCount, setExecutedCount] = useState(0);
  const [workflowType, setWorkflowType] = useState(initialWorkflowType);
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<
    { id: string; name: string; description?: string; icon?: string }[]
  >([]);

  const loadTools = useCallback(async () => {
    try {
      const res = await agentApi.listTools();
      setAvailableTools(res.tools || []);
    } catch (err) {
      logger.error('Failed to load tools:', err);
    }
  }, []);

  // ── 加载工作流模板 ─────────────────────────────────────────
  const reloadTemplates = useCallback(async () => {
    try {
      const res = await workflowApi.listTemplates();
      setWorkflowTemplates(
        res.items.map((t) => ({
          id: t.template_id,
          name: t.name,
          description: t.description || undefined,
          icon: t.icon || undefined,
        }))
      );
    } catch (err) {
      logger.error('Failed to load templates:', err);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadTools();
    reloadTemplates();
  }, [loadTools, reloadTemplates]);

  // ── 添加消息 ───────────────────────────────────────────────
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
      return msg;
    },
    []
  );

  // ── 更新最后一条助手消息 ───────────────────────────────────
  const updateLastAssistantMessage = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      setMessages((prev) => {
        const newMsgs = [...prev];
        const lastIdx = newMsgs.length - 1;
        if (lastIdx >= 0 && newMsgs[lastIdx].role === 'assistant') {
          newMsgs[lastIdx] = {
            ...newMsgs[lastIdx],
            content,
            ...metadata,
          };
        }
        return newMsgs;
      });
    },
    []
  );

  // ── 执行 Agent ─────────────────────────────────────────────
  const execute = useCallback(
    async (query: string, workflowTypeParam?: string) => {
      if (!query.trim() || isRunning) return;

      setIsRunning(true);
      setTools([]);
      setStages([]);

      // 添加用户消息
      addMessage('user', query);

      // 添加助手消息占位
      const assistantMsg = addMessage('assistant', '', {
        executionId: `exec-${Date.now()}`,
        workflowType: workflowTypeParam || workflowType,
      });

      try {
        // 优先尝试工作流执行
        let result: AgentExecution | WorkflowExecution | null = null;

        try {
          const wfRes = await workflowApi.execute(
            workflowTypeParam || workflowType,
            { query, max_steps: 8 }
          );
          result = wfRes.data;

          // 更新阶段状态
          if ('stages' in result) {
            setStages(
              result.stages.map((s) => ({
                stage: s.stage,
                success: s.success,
                latencyMs: s.latency_ms,
                error: s.error,
              }))
            );
          }
        } catch (wfErr) {
          logger.info('Workflow execution failed, fallback to smart mode:', wfErr);
        }

        // 降级到智能模式
        if (!result) {
          const smartRes = await agentApi.execute({
            query,
            mode: 'smart',
            max_steps: 5,
          });
          result = smartRes.data;

          // 更新工具状态
          if ('steps' in result) {
            setTools(
              result.steps.map((s) => ({
                tool: s.tool,
                status:
                  s.status === 'success'
                    ? 'success'
                    : s.status === 'failed'
                    ? 'failed'
                    : 'running',
                latencyMs: s.latency_ms || 0,
                error: s.error,
              }))
            );
          }
        }

        // 更新最终消息
        const finalContent =
          ('final_response_preview' in (result as any)
            ? (result as any).final_response_preview
            : '') || '执行完成';

        updateLastAssistantMessage(finalContent, {
          executionId: result.execution_id,
        });

        setExecutedCount((c) => c + 1);
        onComplete?.(result);
      } catch (err) {
        logger.error('Agent execution failed:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        updateLastAssistantMessage(`执行失败：${errorMsg}`);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsRunning(false);
        setTools([]);
        setStages([]);
      }
    },
    [
      isRunning,
      workflowType,
      addMessage,
      updateLastAssistantMessage,
      onComplete,
      onError,
    ]
  );

  // ── 发送消息 ───────────────────────────────────────────────
  const sendMessage = useCallback<(
    content: string,
  ) => Promise<void>>(
    async (content: string) => {
      await execute(content);
    },
    [execute]
  );

  // ── 清空消息 ───────────────────────────────────────────────
  const clearMessages = useCallback(() => {
    setMessages([]);
    setTools([]);
    setStages([]);
    setExecutedCount(0);
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
    setWorkflowType,
    sendMessage,
    clearMessages,
    reloadTemplates,
  };
}
