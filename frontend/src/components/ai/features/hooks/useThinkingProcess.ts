/**
 * useThinkingProcess - 思考过程管理Hook
 *
 * 负责管理AI思考过程的状态、步骤更新及可视化逻辑。
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-22
 */

import { useState, useCallback, useEffect } from 'react'
import type { ThinkingStep } from '../components/ThinkingVisualizer'

export interface ThinkingProcessState {
  steps: ThinkingStep[]
  currentStepIndex: number
  isThinking: boolean
  isVisible: boolean
}

export interface UseThinkingProcessReturn {
  state: ThinkingProcessState
  startThinking: (question: string) => void
  stopThinking: () => void
  toggleVisibility: () => void
  addStep: (step: Omit<ThinkingStep, 'id' | 'timestamp' | 'status'>) => void
  completeStep: (stepId: string) => void
}

// 模拟思考步骤生成器
const generateMockThinkingSteps = (question: string): Omit<ThinkingStep, 'id' | 'timestamp' | 'status'>[] => {
  return [
    {
      type: 'analysis',
      title: '语义解析',
      description: `分析用户问题："${question.substring(0, 30)}${question.length > 30 ? '...' : ''}"`,
      confidence: 0.92,
      details: '识别问题中的关键实体和意图，分析用户需求类型。',
      relatedData: [
        {
          type: 'knowledge',
          title: '问题意图分类体系',
          snippet: '识别用户问题属于配方设计、成分分析、功效查询等类别',
          source: '领域知识库',
        },
      ],
    },
    {
      type: 'analysis',
      title: '实体识别',
      description: '提取问题中的关键实体：原料、功效、剂型等',
      confidence: 0.88,
      details: '识别黄芪、降三高、复合多肽等核心实体及其关系。',
      relatedData: [
        {
          type: 'knowledge',
          title: '药食同源原料库',
          snippet: '黄芪：补气升阳，固表止汗，利水消肿...',
          source: '原料知识库',
        },
        {
          type: 'knowledge',
          title: '功效术语映射',
          snippet: '降三高：指降低血压、血糖、血脂...',
          source: '功效词典',
        },
      ],
    },
    {
      type: 'retrieval',
      title: '知识库检索',
      description: '检索与黄芪相关的配方案例和研究资料',
      confidence: 0.95,
      details: '从配方数据库中检索包含黄芪成分的相关配方案例。',
      relatedData: [
        {
          type: 'document',
          title: '黄芪在功能性食品中的应用研究',
          snippet: '黄芪多糖具有调节免疫、降血糖等生物活性...',
          source: '学术文献',
        },
        {
          type: 'formula',
          title: '传统黄芪复方配方',
          snippet: '经典黄芪配伍：黄芪+当归+枸杞...',
          source: '配方数据库',
        },
      ],
    },
    {
      type: 'retrieval',
      title: '肽类知识库查询',
      description: '查询多肽相关的功能特性和应用案例',
      confidence: 0.89,
      details: '检索复合多肽的制备技术和生物活性研究。',
      relatedData: [
        {
          type: 'research',
          title: '复合多肽制备工艺优化',
          snippet: '酶解条件对多肽活性的影响研究...',
          source: '研究报告',
        },
      ],
    },
    {
      type: 'reasoning',
      title: '配方设计推理',
      description: '基于检索结果进行配方设计推理',
      confidence: 0.87,
      details: '综合原料特性、功效需求、配伍原则进行配方设计。',
      relatedData: [
        {
          type: 'knowledge',
          title: '中药配伍原则',
          snippet: '君臣佐使理论在配方设计中的应用...',
          source: '配伍知识库',
        },
      ],
    },
    {
      type: 'reasoning',
      title: '功效匹配分析',
      description: '验证配方与降三高功效的匹配度',
      confidence: 0.91,
      details: '分析各成分对血压、血糖、血脂的调节作用。',
      relatedData: [
        {
          type: 'knowledge',
          title: '成分功效矩阵',
          snippet: '黄芪：调节免疫、降血糖；山楂：消食化积、降血脂...',
          source: '功效数据库',
        },
      ],
    },
    {
      type: 'decision',
      title: '配方方案决策',
      description: '综合评估并确定最优配方方案',
      confidence: 0.93,
      details: '基于多维度评估选择最适合的配方组合。',
      relatedData: [
        {
          type: 'knowledge',
          title: '配方评估标准',
          snippet: '安全性、有效性、可生产性综合评估...',
          source: '评估体系',
        },
      ],
    },
    {
      type: 'generation',
      title: '回复内容生成',
      description: '生成专业、易懂的回复内容',
      confidence: 0.96,
      details: '将分析结果组织成结构化的专业回复。',
      relatedData: [],
    },
  ]
}

export const useThinkingProcess = (): UseThinkingProcessReturn => {
  const [state, setState] = useState<ThinkingProcessState>({
    steps: [],
    currentStepIndex: -1,
    isThinking: false,
    isVisible: true,
  })

  const addStep = useCallback((step: Omit<ThinkingStep, 'id' | 'timestamp' | 'status'>) => {
    const newStep: ThinkingStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending',
    }

    setState(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }))
  }, [])

  const completeStep = useCallback((stepId: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, status: 'completed' as const } : step,
      ),
    }))
  }, [])

  const startThinking = useCallback(async (question: string) => {
    setState({
      steps: [],
      currentStepIndex: -1,
      isThinking: true,
      isVisible: true,
    })

    const mockSteps = generateMockThinkingSteps(question)

    for (let i = 0; i < mockSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300))

      addStep(mockSteps[i])

      await new Promise(resolve => setTimeout(resolve, 200))

      setState(prev => ({
        ...prev,
        currentStepIndex: i,
        steps: prev.steps.map((step, idx) =>
          idx === i ? { ...step, status: 'processing' as const } : step,
        ),
      }))

      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400))

      setState(prev => ({
        ...prev,
        steps: prev.steps.map((step, idx) =>
          idx === i ? { ...step, status: 'completed' as const } : step,
        ),
      }))
    }

    setState(prev => ({
      ...prev,
      isThinking: false,
    }))
  }, [addStep])

  const stopThinking = useCallback(() => {
    setState(prev => ({
      ...prev,
      isThinking: false,
      steps: prev.steps.map(step =>
        step.status === 'processing' ? { ...step, status: 'completed' as const } : step,
      ),
    }))
  }, [])

  const toggleVisibility = useCallback(() => {
    setState(prev => ({
      ...prev,
      isVisible: !prev.isVisible,
    }))
  }, [])

  useEffect(() => {
    return () => {
      stopThinking()
    }
  }, [stopThinking])

  return {
    state,
    startThinking,
    stopThinking,
    toggleVisibility,
    addStep,
    completeStep,
  }
}

export default useThinkingProcess
