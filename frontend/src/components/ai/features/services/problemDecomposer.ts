import type {
  ThinkingDimension,
  DecomposedSubProblem,
  ProblemDecompositionResult,
} from '../types/thinkingTypes'

interface DecompositionRule {
  pattern: RegExp
  dimension: ThinkingDimension
  subProblemTemplate: (match: RegExpMatchArray, question: string) => Omit<DecomposedSubProblem, 'id' | 'status'>
}

const DECOMPOSITION_RULES: DecompositionRule[] = [
  {
    pattern: /(?:设计|开发|研制|研发|创建).{0,10}(?:配方|产品|制剂|饮料|片剂|胶囊|粉末|口服液)/,
    dimension: 'domain',
    subProblemTemplate: (match) => ({
      title: '核心配方体系构建',
      description: `分析"${match[0]}"的功能定位、目标人群、核心成分框架`,
      priority: 'critical',
      dimension: 'domain',
      dependencies: [],
      estimatedComplexity: 0.9,
    }),
  },
  {
    pattern: /(?:降|调节|改善|控制|辅助).{0,6}(?:血压|血糖|血脂|三高|胆固醇|尿酸|体重)/,
    dimension: 'efficacy',
    subProblemTemplate: (match) => ({
      title: `功效机制分析：${match[0]}`,
      description: `解析${match[0]}的生理作用路径、活性成分筛选、剂量效应关系`,
      priority: 'critical',
      dimension: 'efficacy',
      dependencies: [],
      estimatedComplexity: 0.85,
    }),
  },
  {
    pattern: /(?:多肽|蛋白(?:质)?|氨基酸|酶|益生菌|益生元|膳食纤维|多糖|黄酮|皂苷|生物碱|萜类)/,
    dimension: 'technical',
    subProblemTemplate: (match) => ({
      title: `活性成分技术分析：${match[0]}`,
      description: `${match[0]}的提取/制备工艺、稳定性参数、生物利用度优化`,
      priority: 'high',
      dimension: 'technical',
      dependencies: [],
      estimatedComplexity: 0.8,
    }),
  },
  {
    pattern: /(?:固体饮料|片剂|胶囊|软糖|粉剂|口服液|冲剂|丸剂|膏方)/,
    dimension: 'process',
    subProblemTemplate: (match) => ({
      title: `剂型工艺路线：${match[0]}`,
      description: `${match[0]}的生产工艺流程关键控制点、设备选型、质量标准`,
      priority: 'high',
      dimension: 'process',
      dependencies: [],
      estimatedComplexity: 0.75,
    }),
  },
  {
    pattern: /(?:合规|法规|GB|标准|备案|申报|注册|SC|保健食品|特医食品|新资源食品)/,
    dimension: 'regulatory',
    subProblemTemplate: () => ({
      title: '法规合规性评估',
      description: `产品属性判定（普食/保健/特医）、原料合规性审查、标签声称合规检查`,
      priority: 'critical',
      dimension: 'regulatory',
      dependencies: [],
      estimatedComplexity: 0.85,
    }),
  },
  {
    pattern: /(?:安全|毒性|副作用|禁忌|不良反应|相互作用|过敏)/,
    dimension: 'safety',
    subProblemTemplate: () => ({
      title: '安全性综合评估',
      description: `原料安全性文献综述、潜在风险识别、特殊人群使用注意事项、配伍禁忌分析`,
      priority: 'high',
      dimension: 'safety',
      dependencies: ['efficacy'],
      estimatedComplexity: 0.8,
    }),
  },
  {
    pattern: /(?:成本|价格|性价比|预算|经济|商业化|市场|竞品|差异化)/,
    dimension: 'market',
    subProblemTemplate: () => ({
      title: '市场与成本分析',
      description: `目标市场规模评估、竞品分析、成本结构优化建议、差异化定位策略`,
      priority: 'medium',
      dimension: 'market',
      dependencies: ['domain', 'technical'],
      estimatedComplexity: 0.65,
    }),
  },
  {
    pattern: /(?:工艺|制备|提取|纯化|干燥|造粒|压片|包衣|灭菌|稳定性)/,
    dimension: 'process',
    subProblemTemplate: (match) => ({
      title: `关键技术工艺：${match[0]}`,
      description: `${match[0]}的关键工艺参数优化、质量控制点设定、中试放大考量`,
      priority: 'high',
      dimension: 'process',
      dependencies: ['technical'],
      estimatedComplexity: 0.78,
    }),
  },
  {
    pattern: /(?:临床|实验|验证|检测|指标|评价|证据|文献|研究)/,
    dimension: 'efficacy',
    subProblemTemplate: () => ({
      title: '功效验证方案设计',
      description: `功效评价指标选择、实验设计方案（体外/动物/人体）、文献证据等级评估`,
      priority: 'high',
      dimension: 'efficacy',
      dependencies: ['domain'],
      estimatedComplexity: 0.82,
    }),
  },
  {
    pattern: /(?:如何|怎么|方法|方案|步骤|流程|路线图)/,
    dimension: 'semantic',
    subProblemTemplate: () => ({
      title: '实施路径规划',
      description: `将问题拆解为可执行的阶段步骤，明确各阶段的输入输出和里程碑`,
      priority: 'high',
      dimension: 'semantic',
      dependencies: [],
      estimatedComplexity: 0.7,
    }),
  },
]

const DOMAIN_SPECIFIC_PATTERNS: {
  patterns: string[]
  dimension: ThinkingDimension
  defaultSubProblem: () => Omit<DecomposedSubProblem, 'id' | 'status'>
}[] = [
  {
    patterns: ['黄芪', '人参', '灵芝', '枸杞', '当归', '党参', '山药', '茯苓'],
    dimension: 'domain',
    defaultSubProblem: () => ({
      title: '药食同源原料深度分析',
      description: '传统应用现代研究、活性成分谱、配伍禁忌、用量范围、质量标准',
      priority: 'high',
      dimension: 'domain',
      dependencies: [],
      estimatedComplexity: 0.8,
    }),
  },
  {
    patterns: ['大豆肽', '胶原肽', '鱼肽', '玉米肽', '卵白肽', '乳清肽', '大米肽', '海洋肽'],
    dimension: 'technical',
    defaultSubProblem: () => ({
      title: '多肽类原料技术特性分析',
      description: '分子量分布、酶解工艺参数、生物活性谱（ACE抑制/抗氧化/免疫调节等）、稳定性特征',
      priority: 'high',
      dimension: 'technical',
      dependencies: [],
      estimatedComplexity: 0.85,
    }),
  },
  {
    patterns: ['HACCP', 'ISO22000', 'GMP', 'SSOP', 'CCP', '微生物', '菌落', '大肠杆菌', '霉菌', '酵母菌', '重金属', '农残'],
    dimension: 'safety',
    defaultSubProblem: () => ({
      title: '质量安全控制体系',
      description: '危害分析与关键控制点（HACCP）建立、微生物限量标准、污染物控制方案、检验计划制定',
      priority: 'critical',
      dimension: 'safety',
      dependencies: ['process'],
      estimatedComplexity: 0.88,
    }),
  },
  {
    patterns: ['复配', '协同', '增效', '配伍', '君臣佐使', '复方'],
    dimension: 'domain',
    defaultSubProblem: () => ({
      title: '多组分协同效应分析',
      description: '成分间相互作用（协同/拮抗/加和）、最优配比区间、作用机制整合',
      priority: 'high',
      dimension: 'domain',
      dependencies: ['technical', 'efficacy'],
      estimatedComplexity: 0.83,
    }),
  },
]

export class ProblemDecomposer {
  decompose(question: string): ProblemDecompositionResult {
    const matchedProblems = new Map<string, DecomposedSubProblem>()
    const dependencyGraph: ProblemDecompositionResult['dependencyGraph'] = []

    for (const rule of DECOMPOSITION_RULES) {
      const match = question.match(rule.pattern)
      if (match) {
        const subProblemData = rule.subProblemTemplate(match, question)
        const id = `sub-${matchedProblems.size + 1}-${Date.now().toString(36)}`
        matchedProblems.set(id, { ...subProblemData, id, status: 'pending' })
      }
    }

    for (const domainGroup of DOMAIN_SPECIFIC_PATTERNS) {
      for (const pattern of domainGroup.patterns) {
        if (question.includes(pattern)) {
          const existing = Array.from(matchedProblems.values()).find(
            sp => sp.dimension === domainGroup.dimension && sp.title.includes(domainGroup.defaultSubProblem().title.slice(0, 6)),
          )
          if (!existing) {
            const subProblemData = domainGroup.defaultSubProblem()
            const id = `sub-${matchedProblems.size + 1}-${Date.now().toString(36)}`
            matchedProblems.set(id, { ...subProblemData, id, status: 'pending' })
          }
        }
      }
    }

    if (matchedProblems.size === 0) {
      const genericId = `sub-generic-${Date.now().toString(36)}`
      matchedProblems.set(genericId, {
        id: genericId,
        title: '通用问题分析',
        description: `对问题 "${question}" 进行多维度分解分析`,
        priority: 'medium',
        dimension: 'semantic',
        dependencies: [],
        estimatedComplexity: 0.5,
        status: 'pending',
      })

      const deepId = `sub-deep-${Date.now().toString(36)}`
      matchedProblems.set(deepId, {
        id: deepId,
        title: '深度语义理解',
        description: '识别问题中的隐含需求、约束条件和期望输出格式',
        priority: 'high',
        dimension: 'semantic',
        dependencies: [genericId],
        estimatedComplexity: 0.6,
        status: 'pending',
      })
    }

    const subProblems = Array.from(matchedProblems.values())

    for (const sp of subProblems) {
      for (const depId of sp.dependencies) {
        const exists = subProblems.find(s => s.id === depId)
        if (exists) {
          dependencyGraph.push({
            from: sp.id,
            to: depId,
            relation: 'requires' as const,
          })
        }
      }

      const sameDimOthers = subProblems.filter(s => s.dimension === sp.dimension && s.id !== sp.id)
      for (const other of sameDimOthers) {
        const hasRelation = dependencyGraph.some(d => d.from === sp.id && d.to === other.id || d.from === other.id && d.to === sp.id)
        if (!hasRelation) {
          dependencyGraph.push({
            from: sp.id,
            to: other.id,
            relation: 'informs' as const,
          })
        }
      }
    }

    const executionOrder = this.topologicalSort(subProblems, dependencyGraph)

    return {
      originalQuestion: question,
      subProblems,
      dependencyGraph,
      executionOrder,
      totalEstimatedComplexity: subProblems.reduce((sum, sp) => sum + sp.estimatedComplexity, 0) / Math.max(subProblems.length, 1),
      domainContext: this.inferDomainContext(question, subProblems),
    }
  }

  private topologicalSort(
    nodes: DecomposedSubProblem[],
    edges: { from: string; to: string; relation: string }[],
  ): string[] {
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    for (const edge of edges) {
      if (edge.relation === 'requires') {
        inDegree.set(edge.from, (inDegree.get(edge.from) || 0) + 1)
        adjList.get(edge.to)?.push(edge.from)
      }
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)
      for (const neighbor of adjList.get(current) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1)
        if (inDegree.get(neighbor) === 0) queue.push(neighbor)
      }
    }

    for (const node of nodes) {
      if (!result.includes(node.id)) result.push(node.id)
    }

    return result
  }

  private inferDomainContext(question: string, subProblems: DecomposedSubProblem[]): string {
    const dimensions = [...new Set(subProblems.map(sp => sp.dimension))]
    const dimLabels: Record<ThinkingDimension, string> = {
      semantic: '语义理解', domain: '领域知识', regulatory: '法规合规',
      technical: '技术参数', process: '工艺路线', efficacy: '功效验证',
      safety: '安全评估', market: '市场定位', cost: '成本分析',
    }
    return dimensions.map(d => dimLabels[d]).join(' → ')
  }

  getComplexityLevel(complexity: number): { label: string; color: string } {
    if (complexity >= 0.85) return { label: '极高复杂度', color: 'text-error-600 bg-error-50' }
    if (complexity >= 0.7) return { label: '高复杂度', color: 'text-warning-600 bg-warning-50' }
    if (complexity >= 0.5) return { label: '中等复杂度', color: 'text-warning-600 bg-warning-50' }
    return { label: '基础复杂度', color: 'text-success-600 bg-success-50' }
  }
}

export const problemDecomposer = new ProblemDecomposer()
export default problemDecomposer
