export type ThinkingStepType =
  | 'analysis'
  | 'decomposition'
  | 'retrieval'
  | 'reasoning'
  | 'hypothesis'
  | 'validation'
  | 'decision'
  | 'synthesis'
  | 'generation'

export type ThinkingDimension =
  | 'semantic'
  | 'domain'
  | 'regulatory'
  | 'technical'
  | 'process'
  | 'efficacy'
  | 'safety'
  | 'market'
  | 'cost'

export interface ThinkingEvidence {
  id: string
  type: 'document' | 'knowledge' | 'formula' | 'research' | 'regulation' | 'patent' | 'standard' | 'case_study'
  title: string
  snippet?: string
  source?: string
  credibility: number
  relevance: number
}

export interface ThinkingBranch {
  id: string
  label: string
  hypothesis: string
  steps: string[]
  outcome?: 'accepted' | 'rejected' | 'pending' | 'merged'
  confidence: number
}

export interface ThinkingStepV3 {
  id: string
  type: ThinkingStepType
  dimension: ThinkingDimension
  title: string
  description: string
  confidence: number
  status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped' | 'revised'

  parentId: string | null
  childrenIds: string[]
  branchId: string | null

  details?: string
  evidence?: ThinkingEvidence[]
  relatedData?: {
    type: 'document' | 'knowledge' | 'formula' | 'research'
    title: string
    snippet?: string
    source?: string
  }[]

  metadata: {
    timestamp: number
    durationMs?: number
    retryCount?: number
    userFeedback?: 'approved' | 'rejected' | 'revised' | null
    revisionNote?: string
    tags: string[]
  }
}

export interface DecomposedSubProblem {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  dimension: ThinkingDimension
  dependencies: string[]
  estimatedComplexity: number
  status: 'pending' | 'analyzing' | 'completed' | 'blocked'
  output?: string
}

export interface ProblemDecompositionResult {
  originalQuestion: string
  subProblems: DecomposedSubProblem[]
  dependencyGraph: { from: string; to: string; relation: 'requires' | 'informs' | 'conflicts_with' }[]
  executionOrder: string[]
  totalEstimatedComplexity: number
  domainContext: string
}

export interface ThinkingSessionMetadata {
  sessionId: string
  startTime: number
  endTime?: number
  question: string
  totalSteps: number
  completedSteps: number
  branchesExplored: number
  dimensionsCovered: ThinkingDimension[]
  finalConfidence: number
  userInteractions: {
    timestamp: number
    action: 'approve' | 'reject' | 'revise' | 'branch' | 'skip'
    stepId: string
    detail?: string
  }[]
}

export const STEP_TYPE_CONFIG: Record<ThinkingStepType, {
  icon: string
  label: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  description: string
}> = {
  analysis: {
    icon: 'Brain',
    label: '语义分析',
    color: 'text-secondary-600 dark:text-secondary-700',
    bgColor: 'bg-secondary-50 dark:bg-secondary-300/20',
    borderColor: 'border-secondary-200 dark:border-secondary-800',
    textColor: 'text-secondary-700 dark:text-secondary-700',
    description: '解析用户输入的语义结构和意图',
  },
  decomposition: {
    icon: 'GitFork',
    label: '问题拆解',
    color: 'text-accent-600 dark:text-accent-700',
    bgColor: 'bg-accent-50 dark:bg-accent-300/20',
    borderColor: 'border-accent-200 dark:border-accent-800',
    textColor: 'text-accent-700 dark:text-accent-700',
    description: '将复杂问题分解为可处理的子问题',
  },
  retrieval: {
    icon: 'Search',
    label: '信息检索',
    color: 'text-success-600 dark:text-success-600',
    bgColor: 'bg-success-50 dark:bg-success-300/20',
    borderColor: 'border-success-200 dark:border-success-800',
    textColor: 'text-success-700 dark:text-success-600',
    description: '从知识库中检索相关信息和资料',
  },
  reasoning: {
    icon: 'GitBranch',
    label: '逻辑推理',
    color: 'text-accent-600 dark:text-accent-700',
    bgColor: 'bg-accent-50 dark:bg-accent-300/20',
    borderColor: 'border-accent-200 dark:border-accent-800',
    textColor: 'text-accent-700 dark:text-accent-700',
    description: '基于已知信息进行逻辑推导',
  },
  hypothesis: {
    icon: 'Lightbulb',
    label: '假设生成',
    color: 'text-warning-600 dark:text-warning-700',
    bgColor: 'bg-warning-50 dark:bg-warning-300/20',
    borderColor: 'border-warning-200 dark:border-warning-800',
    textColor: 'text-warning-700 dark:text-warning-700',
    description: '生成可能的解决方案假设',
  },
  validation: {
    icon: 'ShieldCheck',
    label: '验证评估',
    color: 'text-primary-700 dark:text-primary-700',
    bgColor: 'bg-primary-50 dark:bg-primary-300/20',
    borderColor: 'border-success-200 dark:border-success-800',
    textColor: 'text-primary-700 dark:text-primary-700',
    description: '验证假设的可行性和有效性',
  },
  decision: {
    icon: 'Target',
    label: '决策制定',
    color: 'text-warning-600 dark:text-warning-700',
    bgColor: 'bg-warning-50 dark:bg-warning-300/20',
    borderColor: 'border-warning-200 dark:border-warning-800',
    textColor: 'text-warning-700 dark:text-warning-700',
    description: '基于分析结果做出决策判断',
  },
  synthesis: {
    icon: 'Layers',
    label: '综合整合',
    color: 'text-info-600 dark:text-info-700',
    bgColor: 'bg-info-50 dark:bg-info-300/20',
    borderColor: 'border-info-200 dark:border-info-800',
    textColor: 'text-info-700 dark:text-info-700',
    description: '整合多维度分析结果形成完整结论',
  },
  generation: {
    icon: 'Sparkles',
    label: '内容生成',
    color: 'text-danger-600 dark:text-danger-700',
    bgColor: 'bg-danger-50 dark:bg-danger-300/20',
    borderColor: 'border-danger-200 dark:border-danger-800',
    textColor: 'text-danger-700 dark:text-danger-700',
    description: '生成最终回复内容',
  },
}

export const DIMENSION_CONFIG: Record<ThinkingDimension, {
  icon: string
  label: string
  color: string
  bgColor: string
  priority: number
}> = {
  semantic: { icon: 'MessageSquare', label: '语义理解', color: 'text-secondary-500', bgColor: 'bg-secondary-50 dark:bg-secondary-300/20', priority: 1 },
  domain: { icon: 'FlaskConical', label: '领域知识', color: 'text-accent-500', bgColor: 'bg-accent-50 dark:bg-accent-300/20', priority: 2 },
  regulatory: { icon: 'Scale', label: '法规合规', color: 'text-error-500', bgColor: 'bg-error-50 dark:bg-error-300/20', priority: 3 },
  technical: { icon: 'Microscope', label: '技术参数', color: 'text-success-500', bgColor: 'bg-success-50 dark:bg-success-300/20', priority: 4 },
  process: { icon: 'Cog', label: '工艺路线', color: 'text-neutral-500', bgColor: 'bg-neutral-50 dark:bg-neutral-900/20', priority: 5 },
  efficacy: { icon: 'TrendingUp', label: '功效验证', color: 'text-success-500', bgColor: 'bg-success-50 dark:bg-success-300/20', priority: 6 },
  safety: { icon: 'ShieldAlert', label: '安全评估', color: 'text-warning-500', bgColor: 'bg-warning-50 dark:bg-warning-300/20', priority: 7 },
  market: { icon: 'BarChart3', label: '市场定位', color: 'text-accent-500', bgColor: 'bg-accent-50 dark:bg-accent-300/20', priority: 8 },
  cost: { icon: 'DollarSign', label: '成本分析', color: 'text-warning-500', bgColor: 'bg-warning-50 dark:bg-warning-300/20', priority: 9 },
}
