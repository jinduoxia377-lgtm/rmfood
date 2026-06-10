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
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    description: '解析用户输入的语义结构和意图',
  },
  decomposition: {
    icon: 'GitFork',
    label: '问题拆解',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
    description: '将复杂问题分解为可处理的子问题',
  },
  retrieval: {
    icon: 'Search',
    label: '信息检索',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    description: '从知识库中检索相关信息和资料',
  },
  reasoning: {
    icon: 'GitBranch',
    label: '逻辑推理',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    description: '基于已知信息进行逻辑推导',
  },
  hypothesis: {
    icon: 'Lightbulb',
    label: '假设生成',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
    description: '生成可能的解决方案假设',
  },
  validation: {
    icon: 'ShieldCheck',
    label: '验证评估',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    description: '验证假设的可行性和有效性',
  },
  decision: {
    icon: 'Target',
    label: '决策制定',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-700 dark:text-orange-300',
    description: '基于分析结果做出决策判断',
  },
  synthesis: {
    icon: 'Layers',
    label: '综合整合',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    description: '整合多维度分析结果形成完整结论',
  },
  generation: {
    icon: 'Sparkles',
    label: '内容生成',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-800',
    textColor: 'text-pink-700 dark:text-pink-300',
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
  semantic: { icon: 'MessageSquare', label: '语义理解', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', priority: 1 },
  domain: { icon: 'FlaskConical', label: '领域知识', color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-900/20', priority: 2 },
  regulatory: { icon: 'Scale', label: '法规合规', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20', priority: 3 },
  technical: { icon: 'Microscope', label: '技术参数', color: 'text-teal-500', bgColor: 'bg-teal-50 dark:bg-teal-900/20', priority: 4 },
  process: { icon: 'Cog', label: '工艺路线', color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-900/20', priority: 5 },
  efficacy: { icon: 'TrendingUp', label: '功效验证', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20', priority: 6 },
  safety: { icon: 'ShieldAlert', label: '安全评估', color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20', priority: 7 },
  market: { icon: 'BarChart3', label: '市场定位', color: 'text-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', priority: 8 },
  cost: { icon: 'DollarSign', label: '成本分析', color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', priority: 9 },
}
