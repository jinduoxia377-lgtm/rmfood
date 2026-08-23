/**
 * Agent 工作流 Tab 组件
 *
 * 集成到 AI 助手页面的 Agent 工作流功能：
 * - 自然语言交互，Agent 自动调用工具链
 * - 工作流模板选择（配方设计/合规预审/实验方案等）
 * - 实时显示执行阶段和工具调用状态
 * - SSE 流式输出最终回复
 *
 * 使用方法：
 * <AgentWorkflowTab />
 */
'use client';

import React, { useState, useRef } from 'react';
import { Bot, Send, Sparkles, CheckCircle, Brain } from 'lucide-react';
import {
  AgentMessageList,
  ToolCallDisplay,
  StageProgress,
} from '@/components/ai/shared';
import { useUnifiedAgent } from './hooks/useUnifiedAgent';
import { useAgentSmartRouter } from './hooks/useAgentSmartRouter';

// ── 工作流模板列表（从 API 加载）─────────────────────────────

interface WorkflowTemplateOption {
  template_id?: string;
  id?: string;
  name?: string;
  label?: string;
  desc?: string;
  description?: string;
  icon?: string | null;
  node_count?: number | null;
  estimated_duration?: string | null;
  category?: string;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  preset_config?: Record<string, unknown>;
}

const DEFAULT_WORKFLOW_TEMPLATES: WorkflowTemplateOption[] = [
  { id: 'formula_design', label: '配方设计', desc: 'RAG检索 → 配方生成 → 合规检查 → 报告输出' },
  { id: 'compliance_check', label: '合规预审', desc: '多维度合规检查 + 自动修复建议' },
  { id: 'experiment_plan', label: '实验方案', desc: '配方 → 体外/体内实验设计 → 指标体系' },
  { id: 'ingredient_lookup', label: '原料查询', desc: '药材功效/法规/配伍禁忌查询' },
  { id: 'full_pipeline', label: '全流程', desc: 'RAG→配方→合规→实验→报告完整链路' },
] as const;

// ── 组件 ────────────────────────────────────────────────────

export function AgentWorkflowTab() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 智能路由
  const { route, previewMode } = useAgentSmartRouter();

  // 使用统一 Hook
  const {
    messages,
    tools,
    stages,
    isRunning,
    executedCount,
    workflowType,
    workflowTemplates,
    setWorkflowType,
    sendMessage,
  } = useUnifiedAgent({ initialWorkflowType: 'formula_design' });

  // 根据输入预览推荐模式和工作流
  const recommendedRoute = previewMode(input) === 'workflow'
    ? route(input)
    : null;

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isRunning) {
        // 根据智能路由结果选择工作流类型
        const result = route(input.trim());
        if (result.workflowType) {
          setWorkflowType(result.workflowType);
        }
        sendMessage(input.trim());
        setInput('');
      }
    }
  };
  // 获取当前选中的模板信息（兼容 API 和默认模板）
  const apiTemplate = workflowTemplates.find((t) => t.id === workflowType);
  const defaultTemplate = DEFAULT_WORKFLOW_TEMPLATES.find((t) => t.id === workflowType);
  const selectedTemplate: any = apiTemplate || defaultTemplate;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
          <Bot size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            AI 研发助手
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
              Agent
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            自然语言驱动配方研发 · {workflowTemplates.length} 个工作流可用
          </p>
        </div>

        {/* 智能模式指示器 */}
        {recommendedRoute && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
            <Brain className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-xs text-violet-700 dark:text-violet-300">
              {recommendedRoute.workflowType === 'formula_design' && '🧪 配方设计模式'}
              {recommendedRoute.workflowType === 'compliance_check' && '🔍 合规检查模式'}
              {recommendedRoute.workflowType === 'experiment_plan' && '🧬 实验方案模式'}
              {recommendedRoute.workflowType === 'ingredient_lookup' && '📚 原料查询模式'}
              {recommendedRoute.workflowType === 'full_pipeline' && '⚡ 全流程模式'}
            </span>
          </div>
        )}

        {/* 工作流选择器 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles size={14} />
            <span>工作流:</span>
          </div>
          <select
            value={workflowType}
            onChange={(e) => setWorkflowType(e.target.value)}
            disabled={isRunning}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 min-w-[140px]"
          >
            {(workflowTemplates.length > 0 ? workflowTemplates : DEFAULT_WORKFLOW_TEMPLATES).map((t) => (
              <option key={t.id} value={t.id}>
                {String((t as any).name || (t as any).label || "")}
              </option>
            ))}
          </select>
        </div>

        {executedCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
            <CheckCircle size={12} />
            <span>已执行 {executedCount} 次</span>
          </div>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-2xl mb-4">
              🧪
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-2">
              AI 研发助手就绪
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6">
              输入您的需求，AI 助手将自动调用知识库、生成配方并检查合规性
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
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
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* 模板说明 */}
            {selectedTemplate && (
              <div className="mt-8 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-md">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{selectedTemplate.icon || '📋'}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {selectedTemplate.name || selectedTemplate.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedTemplate.description || selectedTemplate.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      {selectedTemplate.node_count && (
                        <span>· {selectedTemplate.node_count} 个节点</span>
                      )}
                      {selectedTemplate.estimated_duration && (
                        <span>· 预估 {selectedTemplate.estimated_duration}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <AgentMessageList
            messages={messages}
            isRunning={isRunning}
            executedCount={executedCount}
          />
        )}

        {/* Workflow stage animation */}
        {isRunning && stages.length > 0 && (
          <StageProgress stages={stages} isRunning={true} />
        )}

        {/* Tool call animation */}
        {isRunning && tools.length > 0 && (
          <ToolCallDisplay tools={tools} isLoading={false} />
        )}

        {/* Running indicator */}
        {isRunning && tools.length === 0 && stages.length === 0 && (
          <div className="flex justify-start mt-4">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 shadow-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-2 animate-pulse" />
              Agent 思考中...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的研发需求，AI 将自动检索知识、生成配方并检查合规性…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            disabled={isRunning}
          />
          <button
            onClick={() => sendMessage(input.trim())}
            disabled={isRunning || !input.trim()}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-sm font-medium transition-all disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 flex items-center gap-2"
          >
            <Send size={16} />
            <span className="hidden sm:inline">发送</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
