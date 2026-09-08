/**
 * 动态 Prompt 变量插值系统
 *
 * 基于 DeepSeek Harness 的 Prompt Assembly 算法：
 * - 多片段提示词按 order 排序拼接
 * - 动态变量解析 ({variable_name})
 * - complete 标记优先
 */

import { useMemo, useState, useCallback } from 'react';
import { logger } from '@/utils/safeLogger';

// ── 类型定义 ────────────────────────────────────────────────

export interface PromptSection {
  name: string;
  order: number;
  text: string;
  complete?: boolean; // 完全替代其他片段
  variables?: Record<string, VariableResolver>;
}

export type VariableResolver = (context: ResolutionContext) => string;

export interface ResolutionContext {
  model?: string;
  provider?: string;
  systemPrompt?: string;
  toolSchemas?: ToolSchema[];
  userId?: string;
  orgId?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface PromptResult {
  text: string;
  tools?: ToolSchema[];
  variableCounts: Record<string, number>;
}

// ── 变量插值正则 ────────────────────────────────────────────

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

// ── 组装算法 ────────────────────────────────────────────────

/**
 * 组装提示词
 * 对应 DeepSeek Harness 的 assemblePrompt()
 */
export function assemblePrompt(
  sections: PromptSection[],
  variables: Map<string, VariableResolver>,
  context: ResolutionContext,
  toolSchemas?: ToolSchema[],
): PromptResult {
  // 1. 合并全局与变量作用域的变量
  const mergedVariables = new Map(variables);

  // 2. 按 order 排序
  const ordered = [...sections].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name);
  });

  // 3. 解析变量并插值
  const resolved = ordered.map((section) => ({
    ...section,
    text: interpolateVariables(section.text, mergedVariables, context),
  }));

  // 4. 检查 complete 声明
  const completions = resolved.filter((s) => s.complete);
  if (completions.length > 1) {
    logger.warn('[PromptAssembler] Multiple complete sections detected, using first');
  }
  if (completions.length === 1) {
    return {
      text: completions[0].text,
      tools: toolSchemas,
      variableCounts: countVariables(completions[0].text),
    };
  }

  // 5. 拼接
  const text = resolved
    .filter((s) => s.text.length > 0)
    .map((s) => s.text)
    .join('\n\n');

  return {
    text,
    tools: toolSchemas,
    variableCounts: countVariables(text),
  };
}

/**
 * 插值变量
 */
function interpolateVariables(
  text: string,
  variables: Map<string, VariableResolver>,
  context: ResolutionContext,
): string {
  return text.replace(VARIABLE_REGEX, (_, name) => {
    const resolver = variables.get(name);
    if (!resolver) {
      logger.warn(`[PromptAssembler] Unknown variable: ${name}`);
      return '';
    }
    try {
      return resolver(context) ?? '';
    } catch (err) {
      logger.error(`[PromptAssembler] Variable resolution error for ${name}:`, err);
      return '';
    }
  });
}

/**
 * 统计变量使用情况
 */
function countVariables(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const matches = text.matchAll(VARIABLE_REGEX);
  for (const match of matches) {
    const name = match[1];
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

// ── React Hook ──────────────────────────────────────────────

export function usePromptAssembler(initialSections: PromptSection[] = []) {
  const [sections, setSections] = useState<PromptSection[]>(initialSections);
  const [variables] = useState<Map<string, VariableResolver>>(() => new Map());
  const [context, setContext] = useState<ResolutionContext>({});

  /**
   * 注册变量解析器
   */
  const registerVariable = useMemo(() => {
    return (name: string, resolver: VariableResolver) => {
      variables.set(name, resolver);
    };
  }, [variables]);

  /**
   * 更新上下文
   */
  const updateContext = useCallback((partial: Partial<ResolutionContext>) => {
    setContext((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * 组装最终提示词
   */
  const prompt = useMemo(() => {
    return assemblePrompt(sections, variables, context);
  }, [sections, variables, context]);

  return {
    sections,
    setSections,
    registerVariable,
    updateContext,
    prompt: prompt.text,
    toolSchemas: prompt.tools,
    variableCounts: prompt.variableCounts,
  };
}

// ── 预置变量解析器 ──────────────────────────────────────────

/**
 * 常用的变量解析器工厂
 */
export const variableResolvers = {
  /** 当前模型名 */
  model: (context: ResolutionContext) => context.model ?? 'deepseek-chat',

  /** 当前提供者 */
  provider: (context: ResolutionContext) => context.provider ?? 'deepseek',

  /** 时间戳 */
  timestamp: (context: ResolutionContext) =>
    context.timestamp?.toString() ?? new Date().toISOString(),

  /** 日期 */
  date: () => new Date().toLocaleDateString('zh-CN'),

  /** 时间 */
  time: () => new Date().toLocaleTimeString('zh-CN'),

  /** 工作日 */
  workday: () => {
    const day = new Date().getDay();
    return day >= 1 && day <= 5 ? '工作日' : '周末';
  },
};
