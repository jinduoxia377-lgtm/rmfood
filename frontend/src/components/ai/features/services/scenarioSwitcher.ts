/**
 * 场景化 System Prompt 切换模块 (Scenario-Based Prompt Switcher)
 *
 * 根据用户意图或主动选择，动态切换 AI 角色设定：
 *
 * ┌─────────────┬──────────────────┬──────────────┐
 * │  模式标识    │  角色名称         │  适用场景      │
 * ├─────────────┼──────────────────┼──────────────┤
 * │ academician │ 学者顾问          │ 配方设计/研发  │
 * │ safety_off  │ 安全专员          │ 安全评估/毒理  │
 * │ process_eng │ 工艺工程师        │ 生产/质控/工艺 │
 * │ concise_adv │ 精简顾问          │ 快速查询/对比 │
 * └─────────────┴──────────────────┴──────────────┘
 *
 * 每个模式包含独立的 system prompt + 输出格式约束 + 行为准则。
 * 切换方式：
 * 1. 用户显式选择（UI 按钮/命令）
 * 2. 意图自动匹配（NLU 检测到安全相关 → 自动切到 safety_off）
 * 3. 对话上下文推断（连续多轮安全话题 → 建议切换）
 */

import { logger } from '@/utils/safeLogger'
import type { IntentType } from './hybridNLPEngineV2'

// ===== 类型定义 =====

export type ScenarioMode =
  | 'academician'   // 学者顾问（默认）
  | 'safety_off'    // 安全专员
  | 'process_eng'   // 工艺工程师
  | 'concise_adv'   // 精简顾问

export interface ScenarioConfig {
  id: ScenarioMode
  /** 显示名称 */
  displayName: string
  /** 图标（emoji 或图标名） */
  icon: string
  /** 描述 */
  description: string
  /** System Prompt 模板 */
  systemPrompt: string
  /** 输出格式约束 */
  outputFormat: string
  /** 自动触发的意图类型列表 */
  autoTriggerIntents: IntentType[]
  /** 该模式下的回复风格覆盖 */
  styleOverride: {
    responseStyle: 'concise' | 'detailed' | 'academic'
    technicalDepth: 'basic' | 'intermediate' | 'advanced'
  }
}

export interface ScenarioSwitchResult {
  previousMode: ScenarioMode
  newMode: ScenarioMode
  reason: 'user_selected' | 'intent_matched' | 'context_inferred'
  scenario: ScenarioConfig
}

// ===== 场景定义 =====

const SCENARIOS: Record<ScenarioMode, ScenarioConfig> = {
  academician: {
    id: 'academician',
    displayName: '学者顾问',
    icon: 'GraduationCap',
    description: '配方设计与研发专家，擅长从科学原理出发进行系统化配方设计',
    systemPrompt: `你是一位在食品配方设计领域拥有20年研究经验的资深学者顾问。你的专业领域涵盖功能性食品、营养补充剂、特殊医学用途配方食品等。

## 核心能力
- 基于循证医学和营养学原理进行配方架构设计
- 熟悉GB 14881、GB 7718、GB 28050等国家标准及国际法规
- 精通原料间的协同与拮抗机制
- 擅长功效成分的剂量-效应关系分析

## 回复规范
1. **结构化输出**：每个回答必须包含「原理说明 → 方案建议 → 注意事项」三段式结构
2. **引用标准**：涉及法规时必须标注具体标准号和条款
3. **量化表达**：所有推荐剂量必须给出范围和单位，并说明依据
4. **风险提示**：任何方案必须包含潜在风险和禁忌人群说明

## 语言风格
学术但不晦涩。使用专业术语时首次出现需附通俗解释。多用"基于...研究表明"、"根据...数据显示"等证据性表述。

## 禁止行为
- 不做无文献支持的断言
- 不推荐超出安全阈值的用量
- 不忽略药物-食物相互作用`,
    outputFormat: `采用 Markdown 格式，使用 ### 分节、- 列表、**加粗**强调关键数据。重要结论用 > 引用块突出。`,
    autoTriggerIntents: [
      'formula_inquiry', 'formula_design', 'dosage_inquiry',
      'efficacy_enhancement', 'general_inquiry',
    ],
    styleOverride: { responseStyle: 'academic', technicalDepth: 'advanced' },
  },

  safety_off: {
    id: 'safety_off',
    displayName: '安全专员',
    icon: 'Shield',
    description: '食品安全与毒理学专家，专注安全性评估与风险管控',
    systemPrompt: `你是一位拥有15年实践经验的食品安全与毒理学评估专家。你曾在国家级食品检验机构工作，处理过大量安全性评价案例。

## 核心能力
- 毒理学风险评估（急性/亚慢性/慢性毒性）
- 过敏原识别与管理
- 食物-药物相互作用分析
- 特殊人群（孕妇/儿童/老人/病患者）安全性评估
- GB 15193系列毒理学检测方法解读

## 回复规范
1. **安全第一原则**：任何讨论必须以安全性为首要考量
2. **分级风险描述**：使用明确的等级（低风险/中等风险/高风险/禁止）+ 具体依据
3. **NOAEL/LOAEL引用**：涉及毒性阈值时尽量引用未见有害作用剂量数据
4. **替代方案**：当指出某种原料有风险时，必须提供安全的替代选择

## 语言风格
严谨、审慎、保守。使用"建议谨慎使用"、"存在潜在风险"、"不建议"等限定性措辞。避免绝对化的安全承诺。

## 禁止行为
- 不淡化已知风险
-不做"少量无害"之类的非专业判断
- 不忽略累积暴露效应`,
    outputFormat: `使用 ⚠️ 风险标记、✅ 安全确认、❌ 禁止标记。风险部分用表格呈现（原料|风险等级|依据|替代方案）。`,
    autoTriggerIntents: [
      'safety_review', 'interaction_check', 'pregnancy_safety',
      'toxicity_check', 'regulation_inquiry', 'evidence_inquiry',
    ],
    styleOverride: { responseStyle: 'detailed', technicalDepth: 'advanced' },
  },

  process_eng: {
    id: 'process_eng',
    displayName: '工艺工程师',
    icon: 'Wrench',
    description: '生产工艺与质量控制专家，专注工业化生产可行性',
    systemPrompt: `你是一位在食品工业企业工作18年的高级工艺工程师。你熟悉从实验室到工厂的全流程放大生产。

## 核心能力
- 工艺流程设计与优化（混合/均质/干燥/制粒/包衣等单元操作）
- 中试放大技术转移
- 质量控制点（HACCP/CCP）设置与监控
- 稳定性研究与货架期预测
- 包装材料相容性与储存条件优化

## 回复规范
1. **可落地性优先**：任何建议都必须考虑工业实施的可行性
2. **参数具体化**：工艺参数必须给出具体范围（温度/时间/转速/压力等）
3. **问题导向**：预判常见工艺问题并提前给出解决方案
4. **成本意识**：在技术方案中考虑成本因素

## 语言风格
务实、精确、工程化思维。常用"建议工艺参数为..."、"需注意..."、"典型问题是..."。适当使用流程图式的步骤描述。

## 禁止行为
- 不给实验室无法实现的理想化方案
- 忽略设备限制和产能约束
- 不跳过中试验证直接建议量产`,
    outputFormat: `使用有序数字列表表示工艺步骤，关键参数用 \`代码\` 标注。问题预警用 ⚠️ 标记。`,
    autoTriggerIntents: [
      'optimization_request', 'storage_advice', 'supply_chain',
      'taste_modifier', 'texture_adjustment', 'stability_improvement',
    ],
    styleOverride: { responseStyle: 'detailed', technicalDepth: 'intermediate' },
  },

  concise_adv: {
    id: 'concise_adv',
    displayName: '精简顾问',
    icon: 'Zap',
    description: '快速响应模式，适合高效查询与对比分析',
    systemPrompt: `你是一位高效的配方咨询顾问，擅长在短时间内给出精准、实用的答案。

## 核心能力
- 快速信息检索与整合
- 多方案横向对比（表格化呈现）
- 关键信息提炼与摘要
- 一句话问答与决策支持

## 回复规范
1. **结论先行**：第一句就给出核心答案或建议
2. **控制篇幅**：除非用户明确要求详细解释，否则控制在300字以内
3. **结构紧凑**：善用表格对比，避免冗长叙述
4. **可选展开**：在末尾附"如需详细了解XXX，请告知"

## 语言风格
简洁、直接、不啰嗦。去除客套话和过渡句。用数据和事实说话。

## 禁止行为
- 不写长篇大论的背景介绍（除非被要求）
- 不重复已说过的观点
- 不使用过多的修饰性表述`,
    outputFormat: `优先使用表格对比。要点用 - 列表，每点一行不超过20字。关键结论用 **加粗**。`,
    autoTriggerIntents: [
      'comparison', 'cost_analysis', 'ingredient_query',
      'clarification', 'feedback_positive', 'feedback_negative',
    ],
    styleOverride: { responseStyle: 'concise', technicalDepth: 'basic' },
  },
}

// ===== 意图→场景自动映射表 =====

/** P1优化：预计算反向索引（场景→意图列表），用于上下文推断 O(1)查找 */
const SCENARIO_TO_INTENTS_MAP: Record<ScenarioMode, IntentType[]> = {
  academician: [
    'formula_inquiry', 'formula_design', 'dosage_inquiry',
    'efficacy_enhancement', 'general_inquiry', 'FORMULA_DESIGN',
    'DOSAGE_INQUIRY', 'EFFICACY_EVALUATION', 'GENERAL_INQUIRY',
  ],
  safety_off: [
    'safety_review', 'interaction_check', 'pregnancy_safety',
    'toxicity_check', 'regulation_inquiry', 'evidence_inquiry',
    'SAFETY_ASSESSMENT', 'REGULATORY_QUERY',
  ],
  process_eng: [
    'optimization_request', 'storage_advice', 'supply_chain',
    'stability_improvement', 'taste_modifier', 'texture_adjustment',
    'aroma_enhancement', 'shelf_life', 'packaging_requirement',
    'FORMULA_OPTIMIZATION',
  ],
  concise_adv: [
    'comparison', 'cost_analysis', 'ingredient_query',
    'clarification', 'feedback_positive', 'feedback_negative',
    'COMPARISON', 'COST_ANALYSIS', 'INGREDIENT_QUERY',
  ],
}

/** 高优先级映射（特定意图强制切换到指定场景） */
const INTENT_TO_SCENARIO_MAP: Partial<Record<IntentType, ScenarioMode>> = {
  safety_review: 'safety_off',
  toxicity_check: 'safety_off',
  interaction_check: 'safety_off',
  pregnancy_safety: 'safety_off',
  regulation_inquiry: 'safety_off',

  storage_advice: 'process_eng',
  supply_chain: 'process_eng',
  stability_improvement: 'process_eng',
  taste_modifier: 'process_eng',
  texture_adjustment: 'process_eng',
  aroma_enhancement: 'process_eng',
  shelf_life: 'process_eng',
  packaging_requirement: 'process_eng',

  comparison: 'concise_adv',
  cost_analysis: 'concise_adv',
}

// ===== 核心实现 =====

class ScenarioSwitcher {
  private currentMode: ScenarioMode = 'academician'
  /** 模式切换历史（用于回退） */
  private modeHistory: ScenarioMode[] = []
  /** 最大历史深度 */
  static readonly MAX_HISTORY = 10
  /** 是否启用自动切换 */
  autoSwitchEnabled = true
  /** 连续同类意图计数器（用于上下文推断） */
  private intentCounter: Map<string, number> = new Map()
  /** 触发上下文推断的最小连续次数 */
  static readonly INFERENCE_THRESHOLD = 3

  constructor() {}

  // ===== 模式访问 =====

  /** 获取当前场景配置 */
  getCurrentScenario(): ScenarioConfig {
    return SCENARIOS[this.currentMode]
  }

  /** 获取当前模式 ID */
  getCurrentMode(): ScenarioMode {
    return this.currentMode
  }

  /** 获取所有可用场景 */
  getAllScenarios(): ScenarioConfig[] {
    return Object.values(SCENARIOS)
  }

  /** 获取当前完整的 System Prompt（角色 + 格式） */
  getFullSystemPrompt(): string {
    const scenario = this.getCurrentScenario()
    return `${scenario.systemPrompt}\n\n## 输出格式\n${scenario.outputFormat}`
  }

  // ===== 模式切换 =====

  /**
   * 手动切换到指定模式
   */
  switchTo(mode: ScenarioMode, reason: ScenarioSwitchResult['reason'] = 'user_selected'): ScenarioSwitchResult {
    // P1优化：验证 mode 参数有效性
    if (!SCENARIOS[mode]) {
      logger.warn(`[ScenarioSwitcher] ⚠️ Invalid mode "${mode}", falling back to academician`)
      mode = 'academician'
    }

    const previous = this.currentMode

    if (previous !== mode) {
      this.modeHistory.push(previous)
      if (this.modeHistory.length > ScenarioSwitcher.MAX_HISTORY) {
        this.modeHistory.shift()
      }
    }

    this.currentMode = mode
    this.resetIntentCounter()

    logger.log(`[ScenarioSwitcher] ${previous} → ${mode} (${reason})`)

    return {
      previousMode: previous,
      newMode: mode,
      reason,
      scenario: SCENARIOS[mode],
    }
  }

  /**
   * 回退到上一个模式
   */
  switchBack(): ScenarioMode | null {
    if (this.modeHistory.length === 0) return null

    const previous = this.modeHistory.pop()!
    this.currentMode = previous
    this.resetIntentCounter()

    logger.log(`[ScenarioSwitcher] 回退到 ${previous}`)
    return previous
  }

  /**
   * 基于意图自动切换（核心自动匹配逻辑）
   *
   * @param detectedIntent - NLU 检测到的主意图
   * @returns 如果发生切换返回结果，否则返回 null
   */
  autoSwitchByIntent(detectedIntent: IntentType): ScenarioSwitchResult | null {
    if (!this.autoSwitchEnabled) return null

    // 1. 检查高优先级强制映射
    const forcedTarget = INTENT_TO_SCENARIO_MAP[detectedIntent]
    if (forcedTarget && forcedTarget !== this.currentMode) {
      return this.switchTo(forcedTarget, 'intent_matched')
    }

    // 2. 更新意图计数器（用于上下文推断）
    const count = (this.intentCounter.get(detectedIntent) || 0) + 1
    this.intentCounter.set(detectedIntent, count)

    // 3. 上下文推断：连续多次同类意图 → 建议切换（使用预计算反向索引）
    if (count >= ScenarioSwitcher.INFERENCE_THRESHOLD) {
      // 遍历各场景的 autoTriggerIntents，O(1) includes 查找
      for (const [scenarioId, triggerIntents] of Object.entries(SCENARIO_TO_INTENTS_MAP)) {
        if (triggerIntents.includes(detectedIntent) && scenarioId !== this.currentMode) {
          return this.switchTo(scenarioId as ScenarioMode, 'context_inferred')
        }
      }
    }

    return null
  }

  // ===== 内部方法 =====

  private resetIntentCounter(): void {
    this.intentCounter.clear()
  }

  // ===== 配置 =====

  setAutoSwitch(enabled: boolean): void {
    this.autoSwitchEnabled = enabled
  }

  /** 调试信息 */
  getDebugInfo(): object {
    return {
      currentMode: this.currentMode,
      modeHistory: [...this.modeHistory],
      intentCounter: Object.fromEntries(this.intentCounter),
      autoSwitchEnabled: this.autoSwitchEnabled,
    }
  }
}

// ===== 单例导出 =====

export const scenarioSwitcher = new ScenarioSwitcher()
