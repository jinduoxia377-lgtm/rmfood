/**
 * Prompt Assembly - 基于 DeepSeek Harness 的提示词组装
 *
 * 实现：
 * - 有序段落组装
 * - 动态变量插值
 * - Tool Schema 注入
 * - Complete 标记检查
 */

import { logger } from '@/utils/safeLogger';

// ── 类型定义 ────────────────────────────────────────────────

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ── 类型定义 ────────────────────────────────────────────────

export interface PromptSection {
  name: string;
  order: number;
  text: string;
  complete?: boolean;
}

export interface VariableResolver {
  name: string;
  resolve: (context: AssemblyContext) => string;
}

export interface AssemblyContext {
  agentId?: string;
  sessionId?: string;
  model?: string;
  provider?: string;
  cwd?: string;
  [key: string]: unknown;
}

export interface Prompt {
  text: string;
  tools: ToolSchema[];
}

// ── PromptAssembler 类 ──────────────────────────────────────

export class PromptAssembler {
  private sections: PromptSection[] = [];
  private variables: Map<string, (ctx: AssemblyContext) => string> = new Map();
  private toolSchemas: ToolSchema[] = [];

  /** 添加段落 */
  addSection(section: PromptSection): this {
    this.sections.push(section);
    return this;
  }

  /** 注册变量解析器 */
  addVariable(name: string, resolver: (ctx: AssemblyContext) => string): this {
    this.variables.set(name, resolver);
    return this;
  }

  /** 设置工具 Schema */
  setToolSchemas(schemas: ToolSchema[]): this {
    this.toolSchemas = schemas;
    return this;
  }

  /** 组装提示词 */
  assemble(context: AssemblyContext): Prompt {
    // 1. 按 order 排序
    const ordered = [...this.sections].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });

    // 2. 解析变量
    const resolved = ordered.map(s => ({
      ...s,
      text: this.interpolate(s.text, context),
    }));

    // 3. 检查 complete 声明
    const completions = resolved.filter(s => s.complete);
    if (completions.length > 1) {
      logger.warn('[PromptAssembler] Multiple complete sections detected');
    }
    if (completions.length === 1) {
      logger.info('[PromptAssembler] Using complete section, skipping rest');
      return {
        text: completions[0].text,
        tools: this.toolSchemas,
      };
    }

    // 4. 拼接
    const text = resolved
      .filter(s => s.text.length > 0)
      .map(s => s.text)
      .join('\n\n');

    return { text, tools: this.toolSchemas };
  }

  /** 变量插值 */
  private interpolate(text: string, context: AssemblyContext): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      const resolver = this.variables.get(name);
      if (resolver) {
        try {
          return resolver(context) ?? '';
        } catch (err) {
          logger.warn(`[PromptAssembler] Variable resolver failed for ${name}:`, err);
          return '';
        }
      }
      // 检查 context 直接值
      const value = (context as Record<string, unknown>)[name];
      if (value !== undefined) return String(value);
      
      return '';
    });
  }

  /** 清空 */
  clear(): this {
    this.sections = [];
    this.variables.clear();
    this.toolSchemas = [];
    return this;
  }
}

// ── 预设模板 ────────────────────────────────────────────────

export const PRESET_PROMPTS = {
  /** 配方设计助手 */
  formulaAssistant: (options: {
    persona?: string;
    constraints?: string[];
    style?: 'professional' | 'friendly' | 'academic';
  } = {}) => {
    const assembler = new PromptAssembler();
    
    const { persona = '药食同源配方专家', constraints = [], style = 'professional' } = options;

    const styleGuides: Record<string, string> = {
      professional: '使用准确的专业术语，关键结论需提供通俗解释。',
      friendly: '使用通俗易懂的语言，适当举例说明。',
      academic: '引用相关研究文献，提供机制解释。',
    };

    assembler
      .addSection({
        name: 'system',
        order: 0,
        text: `你是一位${persona}。

核心能力：
1. 数据融合：整合《中华本草》、TCMSP、PubMed等现代科研文献
2. 精准计算：精通营养成分与活性成分的理论计算
3. 算法驱动：采用多目标优化算法进行配方设计

工作流程：
1. 输入诊断：主动引导用户提供症状、指标、约束、目标
2. 分析与设计：中医体质与现代健康指标交叉分析
3. 输出格式：辨证与目标 → 推荐配方 → 方解与机理 → 适配与禁忌 → 监测与迭代

语言风格：
${styleGuides[style]}

重要声明：本建议为辅助调理，不能替代医师诊断与治疗。`,
      })
      .addSection({
        name: 'constraints',
        order: 1,
        text: constraints.length > 0 
          ? `额外约束：\n${constraints.map(c => `- ${c}`).join('\n')}` 
          : '',
      });

    return assembler;
  },
};

// ── Hook ────────────────────────────────────────────────────

export function usePromptAssembler() {
  const assembler = new PromptAssembler();
  return { assembler };
}
