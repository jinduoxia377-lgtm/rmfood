/**
 * Agent 对话页
 *
 * 提供与 RMFOOD AI Agent 交互的聊天界面：
 * - 自然语言输入，Agent 自动调用工具链
 * - 实时显示工具调用步骤
 * - SSE 流式输出最终回复
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { agentApi, type AgentExecution, type AgentTool } from '@/api/agent';
import { workflowApi, type WorkflowExecution } from '@/api/deep_dev';
import { logger } from '@/utils/safeLogger';

// ── 类型定义 ────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  executionId?: string;
  workflowType?: string;
}

interface ToolCallLog {
  tool: string;
  status: 'running' | 'success' | 'failed';
  latencyMs: number;
  error?: string;
}

interface WorkflowStageLog {
  stage: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

// ── 组件 ────────────────────────────────────────────────────

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentTools, setCurrentTools] = useState<ToolCallLog[]>([]);
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [executedCount, setExecutedCount] = useState(0);
  const [workflowType, setWorkflowType] = useState<string>('formula_design');
  const [workflowStages, setWorkflowStages] = useState<WorkflowStageLog[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<
    { id: string; name: string; description?: string }[]
  >([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    agentApi.listTools().then((res) => setAvailableTools(res.tools)).catch(logger.error);
    workflowApi.listTemplates().then((res) =>
      setWorkflowTemplates(res.items.map((t) => ({ id: t.template_id, name: t.name, description: t.description ?? undefined })))
    ).catch(logger.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTools, workflowStages]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || isRunning) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
      workflowType,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsRunning(true);
    setCurrentTools([]);
    setWorkflowStages([]);

    const assistantId = `msg-${Date.now() + 1}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      workflowType,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // 优先使用工作流执行
      const resp = await workflowApi.execute(workflowType, { query, max_steps: 8 });
      const exec: WorkflowExecution = resp.data;

      // 解析阶段日志
      setWorkflowStages(
        exec.stages.map((s) => ({
          stage: s.stage,
          success: s.success,
          latencyMs: s.latency_ms,
          error: s.error,
        }))
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: exec.final_response_preview || '执行完成，请查看阶段详情。',
                executionId: exec.execution_id,
              }
            : m,
        )
      );
      setExecutedCount((c) => c + 1);
    } catch (err) {
      logger.error('Workflow execution failed:', err);
      // 降级到普通 Agent
      try {
        const resp = await agentApi.execute({ query, mode: 'smart', max_steps: 5 });
        const exec: AgentExecution = resp.data;
        setCurrentTools(
          exec.steps.map((s) => ({
            tool: s.tool,
            status: s.status === 'success' ? 'success' : s.status === 'failed' ? 'failed' : 'running',
            latencyMs: s.latency_ms,
            error: s.error,
          }))
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: exec.final_response_preview || '执行完成', executionId: exec.execution_id }
              : m,
          )
        );
        setExecutedCount((c) => c + 1);
      } catch (innerErr) {
        logger.error('Agent fallback failed:', innerErr);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `执行失败：${innerErr instanceof Error ? innerErr.message : String(innerErr)}` }
              : m,
          )
        );
      }
    } finally {
      setIsRunning(false);
      setCurrentTools([]);
      setWorkflowStages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
          A
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            AI 研发助手
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {availableTools.length} 个工具可用
          </p>
        </div>

        {/* 工作流选择器 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">工作流:</span>
          <select
            value={workflowType}
            onChange={(e) => setWorkflowType(e.target.value)}
            disabled={isRunning}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          >
            {(workflowTemplates.length > 0 ? workflowTemplates : [
              { id: 'formula_design', name: '配方设计' },
              { id: 'compliance_check', name: '合规预审' },
              { id: 'experiment_plan', name: '实验方案' },
              { id: 'ingredient_lookup', name: '原料查询' },
              { id: 'full_pipeline', name: '全流程' },
            ]).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {executedCount > 0 && (
          <span className="ml-3 text-xs text-gray-400">
            已执行 {executedCount} 次
          </span>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
            <div className="text-4xl mb-3">🧪</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              输入您的需求，AI 助手将自动调用知识库、生成配方并检查合规性
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center max-w-md">
              {[
                '帮我设计一款针对高血糖人群的饮品配方',
                '查询黄芪的功效和合规用量',
                '生成一款抗氧化配方的实验方案',
                '检测枸杞和黄芪搭配的协同效应',
                '检查人参和藜芦是否可同用',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-500 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Workflow stage animation */}
        {isRunning && workflowStages.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
              <p className="text-gray-500 dark:text-gray-400 mb-2 text-xs font-medium uppercase tracking-wide">
                工作流执行中 · {workflowType}
              </p>
              <div className="space-y-1">
                {workflowStages.map((ws, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        ws.success
                          ? 'text-green-500'
                          : 'text-yellow-500 animate-pulse'
                      }
                    >
                      {ws.success ? '✓' : '⋯'}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono">{ws.stage}</span>
                    <span className="text-gray-400">{ws.latencyMs}ms</span>
                    {ws.error && (
                      <span className="text-red-400 ml-1">{ws.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tool call animation */}
        {isRunning && currentTools.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
              <p className="text-gray-500 dark:text-gray-400 mb-2 text-xs font-medium uppercase tracking-wide">
                正在调用工具
              </p>
              <div className="space-y-1">
                {currentTools.map((tc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        tc.status === 'success'
                          ? 'text-green-500'
                          : tc.status === 'failed'
                          ? 'text-red-500'
                          : 'text-yellow-500 animate-pulse'
                      }
                    >
                      {tc.status === 'success' ? '✓' : tc.status === 'failed' ? '✗' : '⋯'}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono">{tc.tool}</span>
                    <span className="text-gray-400">{tc.latencyMs}ms</span>
                    {tc.error && (
                      <span className="text-red-400 ml-1">{tc.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isRunning && currentTools.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-2 animate-pulse" />
              Agent 思考中...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的研发需求，AI 将自动检索知识、生成配方并检查合规性…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            disabled={isRunning}
          />
          <button
            onClick={sendMessage}
            disabled={isRunning || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
