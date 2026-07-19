/**
 * useThinkingProcess V3 - 增强型思考过程管理Hook
 *
 * 核心增强：
 * - 集成 ProblemDecomposer 实现复杂问题自动拆解
 * - 生成多维度、层级化的 ThinkingStepV3 数据
 * - 支持用户反馈循环（批准/拒绝/修订步骤）
 * - 思考分支管理与路径追溯
 * - 会话元数据记录与导出
 * - 兼容旧版 ThinkingStep 类型（向后兼容）
 *
 * @version 3.0.0
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type {
  ThinkingStepV3,
  ThinkingStepType,
  ThinkingDimension,
  DecomposedSubProblem,
  ThinkingSessionMetadata,
  ProblemDecompositionResult,
} from '../types/thinkingTypes'
import { STEP_TYPE_CONFIG, DIMENSION_CONFIG } from '../types/thinkingTypes'
import { problemDecomposer } from '../services/problemDecomposer'
import { eventBus } from '../services/eventBus'
import type { ThinkingStep } from '../components/ThinkingVisualizer'

export interface ThinkingProcessStateV3 {
  steps: ThinkingStepV3[]
  legacySteps: ThinkingStep[]
  currentStepId: string | null
  isThinking: boolean
  isVisible: boolean
  decomposition: ProblemDecompositionResult | null
  activeDimensionFilter: ThinkingDimension | 'all'
  sessionMetadata: ThinkingSessionMetadata | null
}

export interface UseThinkingProcessV3Return {
  state: ThinkingProcessStateV3
  startThinking: (question: string) => Promise<void>
  stopThinking: () => void
  toggleVisibility: () => void
  setDimensionFilter: (dimension: ThinkingDimension | 'all') => void
  onStepAction: (stepId: string, action: 'approve' | 'reject' | 'revise' | 'expand' | 'collapse', detail?: string) => void
  getSessionExport: () => string
  getLegacySteps: () => ThinkingStep[]
  loadExternalSteps: (steps: BackendThinkingStep[], answer: string) => void
}

/** 后端返回的 thinking_steps 格式 */
export interface BackendThinkingStep {
  step: string
  content: string
  status: string
  detail?: string
  formula_data?: any
}

interface StepGeneratorConfig {
  type: ThinkingStepType
  dimension: ThinkingDimension
  title: string
  description: string
  confidence: number
  details?: string
  parentId?: string | null
  tags?: string[]
  evidence?: ThinkingStepV3['evidence']
}

function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function createStep(config: StepGeneratorConfig): ThinkingStepV3 {
  return {
    id: config.parentId ? generateId() : generateId(),
    type: config.type,
    dimension: config.dimension,
    title: config.title,
    description: config.description,
    confidence: config.confidence,
    status: 'pending',
    parentId: config.parentId ?? null,
    childrenIds: [],
    branchId: null,
    details: config.details,
    evidence: config.evidence,
    relatedData: undefined,
    metadata: {
      timestamp: Date.now(),
      durationMs: undefined,
      retryCount: 0,
      userFeedback: null,
      revisionNote: undefined,
      tags: config.tags || [],
    },
  }
}

function buildDomainSpecificSteps(question: string): StepGeneratorConfig[] {
  const steps: StepGeneratorConfig[] = []

  if (/配方|产品|饮料|片剂|胶囊|制剂|开发|设计/.test(question)) {
    steps.push({
      type: 'decomposition', dimension: 'domain',
      title: '问题结构拆解',
      description: `将"${question.slice(0, 30)}..."分解为核心分析维度和子任务`,
      confidence: 0.92, details: '识别产品类型、目标功效、核心原料、剂型要求等关键要素，构建分析框架',
      tags: ['结构化', '顶层设计'],
    })
  }

  if (/降三高|血压|血糖|血脂|代谢|调节|辅助|改善/.test(question)) {
    steps.push({
      type: 'analysis', dimension: 'efficacy',
      title: '功效靶点与作用机制分析',
      description: '解析目标功效的生理学路径、关键分子靶点及活性成分作用机理',
      confidence: 0.89,
      details: '①识别主要病理生理环节(如RAAS系统/胰岛素通路/脂质代谢)\n②映射可干预的关键节点\n③评估各成分的靶点覆盖度\n④分析协同/拮抗可能性',
      tags: ['机制', '分子水平'],
      evidence: [
        { id: 'ev-1', type: 'research', title: '功能性食品降血糖作用机制研究进展', snippet: '多肽通过抑制α-糖苷酶、改善胰岛素敏感性、保护胰岛β细胞等多途径发挥降血糖作用', source: '食品科学期刊', credibility: 0.85, relevance: 0.92 },
        { id: 'ev-2', type: 'document', title: 'GB 28050-2011 食品安全国家标准 营养标签通则', snippet: '关于功能声称的法规要求和限制条件', source: '国家标准', credibility: 0.98, relevance: 0.78 },
      ],
    })

    steps.push({
      type: 'hypothesis', dimension: 'domain',
      title: '活性成分组合假设生成',
      description: '基于功效需求和多组分协同原理，生成候选成分组合方案',
      confidence: 0.84,
      details: '假设1: 大豆肽+苦瓜提取物+桑叶DNJ → 多靶点协同降糖\n假设2: 黄芪多糖+铬酵母 → 胰岛素增敏+微量元素补充\n假设3: 复合膳食纤维+益生元 → 肠道菌群介导的代谢调节',
      tags: ['假设驱动', '方案探索'],
    })
  }

  if (/多肽|蛋白(?:质)?|氨基酸|酶解|发酵|提取/.test(question)) {
    steps.push({
      type: 'retrieval', dimension: 'technical',
      title: '技术参数与工艺文献检索',
      description: '检索目标成分的制备工艺、质量标准、稳定性数据等技术资料',
      confidence: 0.91,
      details: '检索范围：\n①制备工艺参数(酶种类/温度/pH/时间)\n②质量指标(分子量分布/纯度/活性)\n③稳定性数据(温度/湿度/pH耐受性)\n④安全性数据(毒理学/过敏原)',
      tags: ['文献调研', '技术数据库'],
    })
  }

  if (/固体饮料|片剂|胶囊|粉剂|冲剂|口服液|软糖/.test(question)) {
    steps.push({
      type: 'reasoning', dimension: 'process',
      title: '剂型工艺路线推理',
      description: '基于目标剂型和原料特性，推理最优工艺流程及关键控制点',
      confidence: 0.87,
      details: '固体饮料典型路径:\n原料预处理 → 配料混合 → 制粒(湿法/干法) → 干燥 → 筛分 → 混合均匀性检验 → 包装\n关键CCP: 微生物控制、水分含量(<5%)、颗粒度分布(D50)',
      tags: ['工艺推理', 'CCP识别'],
    })
  }

  if (/合规|法规|GB|标准|备案|申报|注册|SC|保健食品|新资源|药食同源/.test(question)) {
    steps.push({
      type: 'validation', dimension: 'regulatory',
      title: '法规合规性多维验证',
      description: '从原料合规、生产许可、标签声称三个维度进行合规性审查',
      confidence: 0.93,
      details: `验证清单:
① 原料合规: GB2760/新资源食品目录/药食同源目录/保健品原料目录
② 生产许可: SC分类(固体饮料0106)/保健食品蓝帽/特医食品注册
③ 标签声称: GB7718/GB28050/《广告法》红线规避
④ 特殊限制: 不得涉及疾病治疗/功能承诺需有依据`,
      tags: ['合规审查', '风险防控'],
    })
  }

  if (/安全|毒性|副作用|禁忌|不良反应|过敏|重金属|农残|微生物/.test(question)) {
    steps.push({
      type: 'validation', dimension: 'safety',
      title: '安全风险评估矩阵',
      description: '构建包含原料安全、配伍安全、人群安全的三维风险评估模型',
      confidence: 0.88,
      details: `安全维度:
【原料安全】原料本身毒理数据、杂质谱控制、供应商审计
【配伍安全】成分间相互作用(物理/化学/药理)、已知配伍禁忌库比对
【人群安全】特殊人群(孕妇/儿童/过敏体质/慢性病)使用注意事项
【过程安全】HACCP体系建立、CCP监控计划`,
      tags: ['风险管理', 'HACCP'],
    })
  }

  steps.push(
    {
      type: 'decision', dimension: 'domain',
      title: '综合决策与方案优选',
      description: '基于多维度分析结果，运用加权评分法进行方案综合排序与推荐',
      confidence: 0.86,
      details: '评估维度权重: 有效性(30%) + 安全性(25%) + 可行性(20%) + 合规性(15%) + 成本(10%)\n输出: 推荐方案 + 替代方案 + 风险提示',
      tags: ['决策支持', '多属性评价'],
    },
    {
      type: 'synthesis', dimension: 'semantic',
      title: '多维度结论整合',
      description: '整合各维度的分析发现，形成逻辑连贯的综合结论与建议',
      confidence: 0.90,
      details: '综合各维度关键发现 → 识别一致性与矛盾点 → 形成最终推荐 → 明确不确定性与后续建议',
      tags: ['结论整合', '逻辑闭环'],
    },
    {
      type: 'generation', dimension: 'semantic',
      title: '专业回复内容生成',
      description: '基于完整思考链路，生成结构清晰、论据充分的专业回复',
      confidence: 0.94,
      details: '回复结构: 问题理解 → 分析概述 → 分维度详述 → 综合建议 → 参考来源',
      tags: ['内容生成', '专业表达'],
    },
  )

  return steps
}

export const useThinkingProcessV3 = (): UseThinkingProcessV3Return => {
  const [state, setState] = useState<ThinkingProcessStateV3>({
    steps: [],
    legacySteps: [],
    currentStepId: null,
    isThinking: false,
    isVisible: true,
    decomposition: null,
    activeDimensionFilter: 'all',
    sessionMetadata: null,
  })

  const sessionRef = useRef<string>('')
  const interactionsRef = useRef<ThinkingSessionMetadata['userInteractions']>([])

  const addStep = useCallback((stepConfig: StepGeneratorConfig & { status?: ThinkingStepV3['status'] }): string => {
    const id = generateId()
    const fullStep: ThinkingStepV3 = {
      type: stepConfig.type,
      dimension: stepConfig.dimension,
      title: stepConfig.title,
      description: stepConfig.description,
      confidence: stepConfig.confidence,
      status: stepConfig.status || 'pending',
      parentId: stepConfig.parentId ?? null,
      childrenIds: [],
      branchId: null,
      details: stepConfig.details,
      evidence: stepConfig.evidence,
      id,
      metadata: {
        timestamp: Date.now(),
        retryCount: 0,
        userFeedback: null,
        tags: stepConfig.tags || [],
      },
    }

    setState(prev => {
      const newSteps = [...prev.steps, fullStep]
      if (fullStep.parentId) {
        return {
          ...prev,
          steps: newSteps.map(s =>
            s.id === fullStep.parentId
              ? { ...s, childrenIds: [...(s.childrenIds || []), id] }
              : s,
          ),
        }
      }
      return { ...prev, steps: newSteps }
    })

    return id
  }, [])

  const updateStepStatus = useCallback((stepId: string, status: ThinkingStepV3['status'], extra?: { metadata?: Partial<ThinkingStepV3['metadata']> }) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId
          ? { ...step, status, metadata: { ...step.metadata, ...extra?.metadata } }
          : step,
      ),
      currentStepId: status === 'processing' ? stepId : prev.currentStepId,
    }))
  }, [])

  const startThinking = useCallback(async (question: string): Promise<void> => {
    const sessionId = `session-${Date.now()}`
    sessionRef.current = sessionId
    interactionsRef.current = []

    setState({
      steps: [],
      legacySteps: [],
      currentStepId: null,
      isThinking: true,
      isVisible: true,
      decomposition: null,
      activeDimensionFilter: 'all',
      sessionMetadata: {
        sessionId,
        startTime: Date.now(),
        question,
        totalSteps: 0,
        completedSteps: 0,
        branchesExplored: 0,
        dimensionsCovered: [],
        finalConfidence: 0,
        userInteractions: [],
      },
    })

    const decompResult = problemDecomposer.decompose(question)
    setState(prev => ({ ...prev, decomposition: decompResult }))

    const stepConfigs = buildDomainSpecificSteps(question)

    for (let i = 0; i < stepConfigs.length; i++) {
      const config = stepConfigs[i]

      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 250))

      const stepId = addStep(config)

      await new Promise(resolve => setTimeout(resolve, 150))

      updateStepStatus(stepId, 'processing')

      const processTime = 400 + Math.random() * 500
      await new Promise(resolve => setTimeout(resolve, processTime))

      updateStepStatus(stepId, 'completed', { metadata: { durationMs: Math.round(processTime) } })

      if (i === 0 && decompResult.subProblems.length > 2) {
        await new Promise(resolve => setTimeout(resolve, 200))
        const subStepId = addStep({
          type: 'decomposition',
          dimension: decompResult.subProblems[0]?.dimension || 'domain',
          title: `子问题 #1: ${decompResult.subProblems[0]?.title || '深度分析'}`,
          description: decompResult.subProblems[0]?.description || '执行拆解后的首个高优先级子任务',
          confidence: 0.85,
          parentId: stepId,
          tags: ['子任务', '自动拆解'],
        })
        updateStepStatus(subStepId, 'completed', {
          metadata: { durationMs: 200 },
        })
      }
    }

    setState(prev => ({
      ...prev,
      isThinking: false,
      sessionMetadata: prev.sessionMetadata ? {
        ...prev.sessionMetadata,
        endTime: Date.now(),
        totalSteps: prev.steps.length,
        completedSteps: prev.steps.filter(s => s.status === 'completed').length,
        dimensionsCovered: [...new Set(prev.steps.map(s => s.dimension))],
        finalConfidence: prev.steps.length > 0
          ? prev.steps.reduce((sum, s) => sum + s.confidence, 0) / prev.steps.length
          : 0,
        userInteractions: interactionsRef.current,
      } : null,
    }))
  }, [addStep, updateStepStatus])

  const stopThinking = useCallback(() => {
    setState(prev => ({
      ...prev,
      isThinking: false,
      steps: prev.steps.map(step =>
        step.status === 'processing' ? { ...step, status: 'completed' as const } : step,
      ),
      sessionMetadata: prev.sessionMetadata ? {
        ...prev.sessionMetadata,
        endTime: Date.now(),
      } : null,
    }))
  }, [])

  const toggleVisibility = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: !prev.isVisible }))
  }, [])

  const setDimensionFilter = useCallback((dimension: ThinkingDimension | 'all') => {
    setState(prev => ({ ...prev, activeDimensionFilter: dimension }))
  }, [])

  const onStepAction = useCallback((stepId: string, action: 'approve' | 'reject' | 'revise' | 'expand' | 'collapse', detail?: string) => {
    const interaction = {
      timestamp: Date.now(),
      action: action as ThinkingSessionMetadata['userInteractions'][number]['action'],
      stepId,
      detail,
    }
    interactionsRef.current.push(interaction)

    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.id !== stepId) return step

        switch (action) {
          case 'approve':
            return { ...step, metadata: { ...step.metadata, userFeedback: 'approved' }, confidence: Math.min(step.confidence + 0.05, 1.0) }
          case 'reject':
            return { ...step, status: 'revised' as const, metadata: { ...step.metadata, userFeedback: 'rejected', revisionNote: detail || '用户拒绝此步骤' } }
          case 'revise':
            return { ...step, status: 'revised' as const, metadata: { ...step.metadata, userFeedback: 'revised', revisionNote: detail || '用户请求修订' } }
          default:
            return step
        }
      }),
      sessionMetadata: prev.sessionMetadata ? {
        ...prev.sessionMetadata,
        userInteractions: [...prev.sessionMetadata.userInteractions, interaction],
      } : null,
    }))
  }, [])

  const getSessionExport = useCallback((): string => {
    const meta = state.sessionMetadata
    if (!meta) return ''

    const exportObj = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      session: meta,
      steps: state.steps.map(s => ({
        id: s.id,
        type: s.type,
        dimension: s.dimension,
        title: s.title,
        confidence: s.confidence,
        status: s.status,
        userFeedback: s.metadata.userFeedback,
        hasChildren: (s.childrenIds || []).length > 0,
      })),
      decomposition: state.decomposition ? {
        question: state.decomposition.originalQuestion,
        subProblemCount: state.decomposition.subProblems.length,
        executionOrder: state.decomposition.executionOrder,
      } : null,
    }

    return JSON.stringify(exportObj, null, 2)
  }, [state])

  const getLegacySteps = useCallback((): ThinkingStep[] => {
    return state.steps.map(s => ({
      id: s.id,
      type: s.type as ThinkingStep['type'],
      title: s.title,
      description: s.description,
      confidence: s.confidence,
      details: s.details,
      relatedData: s.relatedData,
      timestamp: s.metadata.timestamp,
      status: s.status as ThinkingStep['status'],
    }))
  }, [state.steps])

  // 加载后端返回的 thinking_steps
  const loadExternalSteps = useCallback((steps: BackendThinkingStep[], answer: string) => {
    const stepTypeMap: Record<string, ThinkingStepType> = {
      '问题理解': 'analysis',
      '知识检索': 'retrieval',
      '推理分析': 'reasoning',
      '配方设计': 'generation',
      '生成回答': 'synthesis',
    }
    const dimensionMap: Record<string, ThinkingDimension> = {
      '问题理解': 'domain',
      '知识检索': 'technical',
      '推理分析': 'domain',
      '配方设计': 'domain',
      '生成回答': 'semantic',
    }

    const converted: ThinkingStepV3[] = steps.map((s, i) => ({
      id: `ext-${i}`,
      type: stepTypeMap[s.step] || 'reasoning',
      dimension: dimensionMap[s.step] || 'domain',
      title: s.step,
      description: s.content + (s.detail ? '\n' + s.detail : ''),
      status: s.status === 'complete' ? 'completed' as const : 'processing' as const,
      confidence: 0.85,
      parentId: i > 0 ? `ext-${i - 1}` : null,
      childrenIds: [],
      branchId: null,
      details: s.detail || '',
      evidence: s.formula_data ? [{
        id: `ev-${i}`,
        type: 'document',
        title: 'AI推理引擎',
        source: 'AI推理引擎',
        content: JSON.stringify(s.formula_data),
        relevance: 0.9,
        credibility: 0.85,
      }] : [],
      metadata: {
        timestamp: Date.now() - (steps.length - i) * 1000,
        retryCount: 0,
        userFeedback: null,
        tags: [],
      },
    }))

    setState({
      steps: converted,
      legacySteps: [],
      currentStepId: converted.length > 0 ? converted[converted.length - 1].id : null,
      isThinking: false,
      isVisible: true,
      decomposition: null,
      activeDimensionFilter: 'all',
      sessionMetadata: {
        sessionId: `ext-session-${Date.now()}`,
        startTime: Date.now() - steps.length * 1000,
        question: steps[0]?.content || '',
        totalSteps: steps.length,
        completedSteps: steps.filter(s => s.status === 'complete').length,
        branchesExplored: 0,
        dimensionsCovered: [...new Set(steps.map(s => dimensionMap[s.step] || 'domain'))],
        finalConfidence: 0,
        userInteractions: [],
      },
    })
  }, [])

  useEffect(() => {
    return () => { stopThinking() }
  }, [stopThinking])

  // ── 监听后端 SSE 实时思考步骤（eventBus 桥接）──
  useEffect(() => {
    const unsub = eventBus.subscribe('thinking:step', (data: { step: string; content: string }) => {
      // 后端通过 SSE type=step 事件发送的实时思考步骤
      const stepTypeMap: Record<string, ThinkingStepType> = {
        '问题理解': 'analysis', '意图识别': 'analysis',
        '知识检索': 'retrieval', '搜索': 'retrieval',
        '推理分析': 'reasoning', '评估': 'reasoning',
        '配方设计': 'generation', '生成': 'generation', '优化': 'generation',
        '回答': 'synthesis', '整合': 'synthesis', '结论': 'synthesis',
      }
      const dimMap: Record<string, ThinkingDimension> = {
        '问题理解': 'domain', '意图识别': 'domain',
        '知识检索': 'domain', '搜索': 'domain',
        '推理分析': 'domain', '评估': 'domain',
        '配方设计': 'domain', '生成': 'domain', '优化': 'domain',
        '回答': 'semantic', '整合': 'semantic', '结论': 'semantic',
      }

      const stepName = data.step || '处理中'
      const matchedType = stepTypeMap[stepName] || 'reasoning'
      const matchedDim = dimMap[stepName] || 'domain'

      addStep({
        type: matchedType,
        dimension: matchedDim,
        title: stepName,
        description: data.content || '',
        confidence: 0.9,
        status: 'completed' as const,  // 后端发来的步骤视为已完成
        tags: ['后端实时'],
      })
    })
    return unsub
  }, [addStep])

  return {
    state,
    startThinking,
    stopThinking,
    toggleVisibility,
    setDimensionFilter,
    onStepAction,
    getSessionExport,
    getLegacySteps,
    loadExternalSteps,
  }
}

export default useThinkingProcessV3
