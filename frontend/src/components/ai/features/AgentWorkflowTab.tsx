/**
 * Agent 工作流 Tab 组件 v3.0
 *
 * 基于 DeepSeek Harness 核心算法完整实现：
 * - Turn/Step 细粒度状态追踪
 * - Waterfall 事件拦截 (6 Waterfall + 1 Serial)
 * - 有界并行工具调度 (maxParallel=10)
 * - 事件溯源会话日志 (IndexedDB)
 * - CompactionLock 防并发压缩
 * - Token 实时统计
 * - 真实 Agent API 集成
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot, Send, Brain, FlaskConical, FileText,
  Loader2, Circle, CheckCircle2, XCircle, Activity, Trash2,
  Maximize2, Minimize2,
} from 'lucide-react';
import { AgentMessageList, ToolCallDisplay } from '@/components/ai/shared';
import { WorkflowNodeVisualizer } from './components/pro/WorkflowNodeVisualizer';
import { useUnifiedAgent } from './hooks/useUnifiedAgent';
import { useAgentSmartRouter } from './hooks/useAgentSmartRouter';

// ── 默认工作流模板 ──────────────────────────────────────────

const DEFAULT_WORKFLOW_TEMPLATES = [
  { id: 'formula_design', label: '配方设计', desc: 'RAG检索 → 配方生成 → 合规检查 → 报告输出' },
  { id: 'compliance_check', label: '合规预审', desc: '多维度合规检查 + 自动修复建议' },
  { id: 'experiment_plan', label: '实验方案', desc: '配方 → 体外/体内实验设计 → 指标体系' },
  { id: 'ingredient_lookup', label: '原料查询', desc: '药材功效/法规/配伍禁忌查询' },
  { id: 'full_pipeline', label: '全流程', desc: 'RAG→配方→合规→实验→报告完整链路' },
] as const;

// ── Step 状态徽章 ────────────────────────────────────────────

function StepBadge({ step }: { step: import('@/components/ai/shared/types').StepState }) {
  const iconMap = {
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    success: <CheckCircle2 className="w-3 h-3 text-success-500" />,
    failed: <XCircle className="w-3 h-3 text-error-500" />,
    pending: <Circle className="w-3 h-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />,
  };

  const colorMap = {
    running: 'bg-secondary-50 dark:bg-secondary-300/20 text-secondary-700 dark:text-secondary-700 border-secondary-200 dark:border-secondary-800',
    success: 'bg-success-50 dark:bg-success-300/20 text-success-600 dark:text-success-700 border-success-200 dark:border-success-800',
    failed: 'bg-error-50 dark:bg-error-300/20 text-error-600 dark:text-error-700 border-error-200 dark:border-error-800',
    pending: 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700',
  };

  const labelMap: Record<string, string> = {
    llm_request: 'LLM',
    tool_call: step.toolName ?? 'Tool',
    compaction: '压缩',
    final_response: '输出',
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${colorMap[step.status]}`}>
      {iconMap[step.status]}
      <span>{labelMap[step.type]}</span>
      {step.latencyMs > 0 && <span className="opacity-60">{step.latencyMs}ms</span>}
    </div>
  );
}

// ── 组件 ────────────────────────────────────────────────────

export function AgentWorkflowTab() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showCompactionInfo, setShowCompactionInfo] = useState(false);
  // 放大/全屏状态：内容较多时铺满视口，减少上下翻动
  const [expanded, setExpanded] = useState(false);

  // 智能路由
  const { route, previewMode } = useAgentSmartRouter();

  // 统一 Agent Hook (v3.0)
  const {
    messages,
    tools,
    stages,
    isRunning,
    executedCount,
    workflowType,
    workflowTemplates,
    currentTurn,
    tokenCount,
    setWorkflowType,
    sendMessage,
    clearMessages,
  } = useUnifiedAgent({ initialWorkflowType: 'formula_design' });

  // 根据输入预览推荐模式，点击可切换工作流类型
  const recommendedRoute = previewMode(input) === 'workflow' ? route(input) : null;
  const handleRecommendedRouteClick = useCallback(() => {
    if (recommendedRoute?.workflowType) {
      setWorkflowType(recommendedRoute.workflowType);
    }
  }, [recommendedRoute, setWorkflowType]);

  // Token 比例
  const tokenRatio = tokenCount / 128000;

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isRunning) {
        const result = route(input.trim());
        if (result.workflowType) setWorkflowType(result.workflowType);
        sendMessage(input.trim());
        setInput('');
      }
    }
  };

  // 自动滚动（jsdom 无 scrollIntoView，用可选调用）
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, tools, stages]);

  // 获取模板信息
  const selectedTemplate = DEFAULT_WORKFLOW_TEMPLATES.find((t) => t.id === workflowType)
    ?? workflowTemplates.find((t) => t.id === workflowType)
    ?? DEFAULT_WORKFLOW_TEMPLATES[0];

  // 清空对话
  const handleClear = useCallback(() => {
    clearMessages();
    setInput('');
  }, [clearMessages]);

  const content = (
    <div className="flex flex-col h-full bg-gradient-to-br from-neutral-50 to-secondary-50 dark:from-neutral-900 dark:to-neutral-800" data-testid="agent-workflow-tab">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent-surface)] to-[var(--color-accent-surface-deep)] flex items-center justify-center text-white">
          <Bot size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            AI 研发助手
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-100 dark:bg-accent-300/25 text-accent-700 dark:text-accent-700">
              Agent v3.0
            </span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Turn/Step 驱动 · Waterfall 事件 · IndexedDB 持久化 · CompactionLock
          </p>
        </div>

        {/* 智能模式指示器 — 可点击切换 */}
        {recommendedRoute && (
          <button
            onClick={handleRecommendedRouteClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-50 dark:bg-accent-300/20 border border-accent-200 dark:border-accent-800 hover:bg-accent-100 dark:hover:bg-accent-900/40 transition-colors cursor-pointer"
            title="点击切换到此工作流模式"
          >
            <Brain className="w-3.5 h-3.5 text-accent-600 dark:text-accent-700" />
            <span className="text-xs text-accent-700 dark:text-accent-700">
              {recommendedRoute.workflowType === 'formula_design' && '配方设计'}
              {recommendedRoute.workflowType === 'compliance_check' && '合规检查'}
              {recommendedRoute.workflowType === 'experiment_plan' && '实验方案'}
              {recommendedRoute.workflowType === 'ingredient_lookup' && '原料查询'}
              {recommendedRoute.workflowType === 'full_pipeline' && '全流程'}
            </span>
          </button>
        )}

        {/* 统计信息 */}
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          {executedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-700">
              <CheckCircle2 size={12} />
              <span>已执行 {executedCount} 次</span>
            </div>
          )}
          <button
            onClick={() => setShowCompactionInfo(!showCompactionInfo)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            title="查看 Token 使用情况"
            data-testid="token-indicator"
          >
            <Activity size={12} />
            <span>{tokenCount.toLocaleString()} tokens</span>
          </button>
          <button
            onClick={handleClear}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-neutral-500 hover:text-error-500 transition-colors disabled:opacity-50"
            title="清空对话"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-colors"
            title={expanded ? '退出全屏' : '放大对话框'}
            aria-label={expanded ? '退出全屏' : '放大对话框'}
            data-testid="workflow-expand"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{expanded ? '退出全屏' : '放大'}</span>
          </button>
        </div>
      </div>

      {/* Token 使用详情 */}
      {showCompactionInfo && (
        <div className="px-6 py-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
            <span>已用: {tokenCount.toLocaleString()} tokens</span>
            <span>消息数: {messages.length}</span>
            <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tokenRatio >= 0.95 ? 'bg-error-500' :
                  tokenRatio >= 0.8 ? 'bg-warning-500' : 'bg-success-500'
                }`}
                style={{ width: `${Math.min(tokenRatio * 100, 100)}%` }}
              />
            </div>
            <span>阈值: 80% / 95%</span>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center mb-4">
              <FlaskConical className="w-8 h-8 text-white" />
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium mb-2">
              AI 研发助手就绪 (v3.0)
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mb-6">
              Turn/Step 驱动 · Waterfall 事件拦截 · 有界并行调度(10) · IndexedDB 持久化 · CompactionLock
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {(() => {
                const quickPrompts: Record<string, string[]> = {
                  formula_design: ['帮我设计一款针对高血糖人群的饮品配方', '生成一款抗氧化配方的实验方案'],
                  compliance_check: ['查询黄芪的功效和合规用量', '检测枸杞和黄芪搭配的协同效应'],
                  experiment_plan: ['生成一款抗氧化配方的实验方案', '设计体外细胞实验验证流程'],
                  ingredient_lookup: ['查询黄芪的功效和合规用量', '查一下当归的性味归经'],
                  full_pipeline: ['帮我设计一款针对高血糖人群的饮品配方，并完成合规检查'],
                };
                return (quickPrompts[workflowType] || quickPrompts.formula_design).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-accent-400 hover:text-accent-600 dark:hover:border-accent-500 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-all"
                  >
                    {s}
                  </button>
                ));
              })()}
            </div>

            {/* 模板说明 */}
            {selectedTemplate && (
              <div className="mt-8 p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 max-w-md">
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-accent-600 dark:text-accent-700" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {selectedTemplate?.label ?? selectedTemplate?.name ?? ''}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {selectedTemplate?.desc ?? selectedTemplate?.description ?? ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <AgentMessageList messages={messages} isRunning={isRunning} executedCount={executedCount} data-testid="message-list" />
        )}

        {/* 当前 Turn 详情 */}
        {currentTurn && (
          <div className="mt-4 p-3 rounded-xl bg-accent-50 dark:bg-accent-300/15 border border-accent-200 dark:border-accent-800">
            <div className="flex items-center gap-2 text-xs text-accent-700 dark:text-accent-700 mb-2">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>Turn: {currentTurn.turnId.slice(-8)}</span>
              <span className="ml-auto">{currentTurn.status}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentTurn.steps.map((step) => (
                <StepBadge key={step.stepId} step={step} />
              ))}
            </div>
          </div>
        )}

        {/* Workflow node visualizer */}
        <WorkflowNodeVisualizer stages={stages} isRunning={isRunning} workflowType={workflowType} />

        {/* Tool call animation */}
        {isRunning && tools.length > 0 && (
          <ToolCallDisplay tools={tools} isLoading={false} />
        )}

        {/* Running indicator */}
        {isRunning && tools.length === 0 && !currentTurn && (
          <div className="flex justify-start mt-4">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500 shadow-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-500 mr-2 animate-pulse" />
              Agent 思考中...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的研发需求，AI 将自动检索知识、生成配方并检查合规性…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all"
            disabled={isRunning}
            data-testid="agent-input"
          />
          <button
            onClick={() => sendMessage(input.trim())}
            disabled={isRunning || !input.trim()}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--color-accent-surface)] to-[var(--color-accent-surface-deep)] hover:from-[var(--color-accent-surface-deep)] hover:to-[var(--color-accent-surface-deep)] disabled:bg-neutral-300 dark:disabled:bg-neutral-600 text-white text-sm font-medium transition-all disabled:cursor-not-allowed shadow-lg shadow-accent-500/20 hover:shadow-accent-500/30 flex items-center gap-2"
          >
            <Send size={16} />
            <span className="hidden sm:inline">发送</span>
          </button>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 text-center">
          Enter 发送 · Shift+Enter 换行 · 并行工具 max=10 · IndexedDB 持久化 · CompactionLock
        </p>
      </div>
    </div>
  );

  // 放大/全屏：通过 Portal 渲染到 body，逃出 main 的堆叠上下文，覆盖整个视口
  if (expanded) {
    return createPortal(
      <div className="fixed inset-0 z-[2000] flex flex-col bg-neutral-50 dark:bg-neutral-950" data-testid="workflow-expanded">
        {content}
      </div>,
      document.body,
    );
  }
  return content;
}
