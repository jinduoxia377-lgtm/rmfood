/**
 * Agent 智能路由 Hook
 *
 * 根据用户输入自动判断应该使用哪种模式：
 * - "工作流模式"：涉及配方设计、合规检查、实验方案等结构化任务
 * - "对话模式"：开放式问题、多轮对话、查询类问题
 *
 * 使用方式：
 * const { mode, setMode, isAutoMode } = useAgentSmartRouter();
 */
import { useState, useCallback, useMemo } from 'react';

export type AgentMode = 'workflow' | 'chat' | 'auto';

export interface AgentRouteResult {
  mode: AgentMode;
  workflowType?: string;
  confidence: number;
  reason: string;
}

// 工作流关键词映射
const WORKFLOW_KEYWORDS: Record<string, string[]> = {
  formula_design: ['配方', '设计配方', '生成配方', '研发配方'],
  compliance_check: ['合规', '检查', '安全性', '禁忌', '配伍'],
  experiment_plan: ['实验', '方案', '测试', '验证'],
  ingredient_lookup: ['查询', '功效', '用量', '是什么', '有什么用'],
  full_pipeline: ['全流程', '完整流程', '一站式'],
};

// 对话关键词
const CHAT_KEYWORDS = [
  '你好', '帮助', '介绍', '怎么', '如何', '为什么',
  '告诉我', '解释', '说明', '什么是',
];

/**
 * 根据用户输入判断应该使用的模式
 */
export function useAgentSmartRouter() {
  const [userMode, setUserMode] = useState<AgentMode>('auto');

  /**
   * 智能路由：根据输入自动判断模式
   */
  const route = useCallback(
    (input: string): AgentRouteResult => {
      if (userMode !== 'auto') {
        return {
          mode: userMode,
          workflowType: userMode === 'workflow' ? 'formula_design' : undefined,
          confidence: 1.0,
          reason: userMode === 'workflow' ? '用户选择工作流模式' : '用户选择对话模式',
        };
      }

      const lowerInput = input.toLowerCase();

      // 检查是否匹配工作流关键词
      for (const [type, keywords] of Object.entries(WORKFLOW_KEYWORDS)) {
        const matchCount = keywords.filter((kw) => lowerInput.includes(kw)).length;
        if (matchCount > 0) {
          return {
            mode: 'workflow',
            workflowType: type as keyof typeof WORKFLOW_KEYWORDS,
            confidence: Math.min(0.95, 0.6 + matchCount * 0.1),
            reason: `匹配到工作流关键词: ${keywords.find((kw) => lowerInput.includes(kw))}`,
          };
        }
      }

      // 检查是否匹配对话关键词
      const chatMatch = CHAT_KEYWORDS.some((kw) => lowerInput.includes(kw));
      if (chatMatch) {
        return {
          mode: 'chat',
          confidence: 0.8,
          reason: '匹配到对话关键词',
        };
      }

      // 默认使用工作流模式（更符合 RMFOOD 场景）
      return {
        mode: 'workflow',
        workflowType: 'formula_design',
        confidence: 0.5,
        reason: '默认工作流模式',
      };
    },
    [userMode]
  );

  /**
   * 预检输入模式（用于输入框 placeholder 提示）
   */
  const previewMode = useCallback(
    (input: string): AgentMode => {
      if (!input.trim()) return 'auto';
      return route(input).mode;
    },
    [route]
  );

  return {
    mode: userMode,
    setMode: setUserMode,
    route,
    previewMode,
    isAutoMode: userMode === 'auto',
  };
}
