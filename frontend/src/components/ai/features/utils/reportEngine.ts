import type { ProfessionalReport, AIRecognizedFormula, ReportSection, ReportMetadata } from '@/types/ai.types'

export function generateReportId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `RPT-${timestamp}-${randomPart}`.toUpperCase()
}

export function generateContentHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function generateSingleFormulaReport(formula: AIRecognizedFormula): ProfessionalReport {
  const now = new Date()
  const reportId = `rpt_${now.getTime()}_${formula.id.slice(0, 8)}`

  const ingredients = formula.ingredients || []
  const totalIngredients = ingredients.length

  const allEfficacyTags = ingredients
    .map(ing => ing.efficacy)
    .filter((tag): tag is string => !!tag && tag.trim().length > 0)

  const uniqueEfficacyTags = [...new Set(allEfficacyTags)]
  const mainEfficacies = uniqueEfficacyTags.slice(0, 3)

  const applicableScenarios: string[] = []
  if (uniqueEfficacyTags.some(tag => tag.includes('免疫') || tag.includes('抗氧化'))) {
    applicableScenarios.push('日常保健')
  }
  if (uniqueEfficacyTags.some(tag => tag.includes('睡眠') || tag.includes('安神'))) {
    applicableScenarios.push('改善睡眠质量')
  }
  if (uniqueEfficacyTags.some(tag => tag.includes('美容') || tag.includes('抗衰老'))) {
    applicableScenarios.push('美容养颜')
  }
  if (applicableScenarios.length === 0) {
    applicableScenarios.push('功能性食品研发', '健康调理方案')
  }

  const sections: ReportSection[] = [
    {
      id: 'cover',
      type: 'cover',
      title: '封面',
      content: {
        title: formula.name,
        subtitle: '专业配方分析报告',
        generatedAt: now.toLocaleString('zh-CN'),
        version: '1.0.0',
        confidence: formula.confidence,
        ingredientCount: totalIngredients,
      },
      order: 0,
    },
    {
      id: 'executive-summary',
      type: 'executive-summary',
      title: '执行摘要',
      content: {
        summary: `本报告针对"${formula.name}"进行专业分析，该配方包含${totalIngredients}种成分，识别置信度为${(formula.confidence * 100).toFixed(1)}%。${mainEfficacies.length > 0 ? `主要功效包括：${mainEfficacies.join('、')}。` : ''}`,
        keyPoints: [
          `成分总数: ${totalIngredients}种`,
          `识别置信度: ${(formula.confidence * 100).toFixed(1)}%`,
          mainEfficacies.length > 0 ? `核心功效: ${mainEfficacies.join('、')}` : '功效待进一步分析',
          `适用场景: ${applicableScenarios.slice(0, 2).join('、')}`,
          `分析时间: ${now.toLocaleString('zh-CN')}`,
        ],
        overallScore: Math.round(formula.confidence * 100),
        recommendation: formula.confidence >= 0.8 ? '推荐使用' : formula.confidence >= 0.6 ? '建议优化后使用' : '需重新评估',
      },
      order: 1,
    },
    {
      id: 'formula-details',
      type: 'formula-details',
      title: '配方详情',
      content: {
        formulaName: formula.name,
        formulaId: formula.id,
        parsedAt: formula.parsedAt.toLocaleString('zh-CN'),
        sourceMessageId: formula.sourceMessageId,
        confidence: formula.confidence,
        ingredientTable: {
          headers: ['序号', '成分名称', '用量', '单位', '功效说明'],
          rows: ingredients.map((ing, idx) => [
            (idx + 1).toString(),
            ing.name,
            ing.dosage || '-',
            ing.unit || '-',
            ing.efficacy || '-',
          ]),
        },
        rawData: formula.rawData,
      },
      order: 2,
    },
    {
      id: 'ingredient-analysis',
      type: 'ingredient-analysis',
      title: '成分分析',
      content: {
        totalIngredients,
        ingredientDetails: ingredients.map((ing, idx) => ({
          index: idx + 1,
          name: ing.name,
          dosage: ing.dosage,
          unit: ing.unit,
          efficacy: ing.efficacy || '待分析',
          notes: ing.notes || '',
          role: idx === 0 ? '主成分' : idx < 3 ? '辅助成分' : '添加剂',
        })),
        efficacyDistribution: uniqueEfficacyTags.reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
      order: 3,
    },
    {
      id: 'synergy-assessment',
      type: 'synergy-assessment',
      title: '协同效应评估',
      content: {
        synergyScore: totalIngredients > 1 ? Math.min(95, 60 + totalIngredients * 5) : 40,
        assessment: totalIngredients <= 2
          ? '成分较少，协同效应有限'
          : totalIngredients <= 5
            ? '成分搭配合理，存在潜在协同作用'
            : '成分丰富，需关注相互作用',
        keySynergies: totalIngredients > 1 ? [
          {
            combination: ingredients.slice(0, 2).map(i => i.name).join(' + '),
            effect: '可能产生协同增强效果',
            evidenceLevel: '理论推测',
          },
        ] : [],
        precautions: ingredients.filter(ing => ing.notes).map(ing => ({
          ingredient: ing.name,
          note: ing.notes!,
        })),
      },
      order: 4,
    },
    {
      id: 'recommendations',
      type: 'recommendations',
      title: '建议与结论',
      content: {
        usageRecommendations: applicableScenarios.map(scenario => ({
          scenario,
          description: `适用于${scenario}的应用场景`,
          priority: scenario === applicableScenarios[0] ? 'high' : 'medium',
        })),
        optimizationSuggestions: formula.confidence < 0.9 ? [
          '建议补充各成分的具体用量范围',
          '建议明确各成分的功效机制',
          '建议添加安全性评估信息',
        ] : ['当前配方信息完整，可直接用于后续开发'],
        nextSteps: [
          '进行小规模实验验证',
          '开展稳定性测试',
          '完成安全性评价',
          '制定生产工艺参数',
        ],
        conclusion: `"${formula.name}"是一个${totalIngredients > 5 ? '复杂' : totalIngredients > 2 ? '中等复杂度' : '简单'}配方，包含${totalIngredients}种成分，综合评估置信度为${(formula.confidence * 100).toFixed(1)}%。${mainEfficacies.length > 0 ? `具有${mainEfficacies.slice(0, 2).join('、')}等潜在功效。` : ''}${applicableScenarios.length > 0 ? `推荐应用于${applicableScenarios[0]}等领域。` : ''}`,
      },
      order: 5,
    },
    {
      id: 'appendix',
      type: 'appendix',
      title: '附录',
      content: {
        dataSources: [
          { name: 'AI对话解析', description: `从消息 ${formula.sourceMessageId} 中自动提取` },
          { name: '配方数据库', description: '基于内置成分知识库匹配' },
        ],
        methodology: '本报告采用AI智能识别技术，结合规则引擎和机器学习算法对配方数据进行结构化分析和专业评估。',
        disclaimer: '本报告由系统自动生成，仅供参考。实际应用前请咨询专业人士并进行实验验证。',
        versionInfo: {
          analysisEngine: 'RMFOOD Formula Analyzer v5.0',
          generatedAt: now.toISOString(),
          processingTime: '<1s',
          dataQuality: formula.confidence >= 0.9 ? '优秀' : formula.confidence >= 0.7 ? '良好' : '一般',
        },
      },
      order: 6,
    },
  ]

  const report: ProfessionalReport = {
    id: reportId,
    title: formula.name,
    generatedAt: now,
    version: '1.0.0',
    sections,
    metadata: {
      formulaId: formula.id,
      author: 'AI 分析引擎',
      projectName: 'RMFOOD 配方平台',
      tags: [...mainEfficacies, ...applicableScenarios.slice(0, 2)],
      analysisVersion: '5.0.0',
    },
  }

  return report
}

export function generateComprehensiveReport(formulas: AIRecognizedFormula[]): ProfessionalReport {
  if (!formulas || formulas.length === 0) {
    throw new Error('配方列表为空，无法生成综合报告')
  }

  const now = new Date()
  const reportId = `rpt_comprehensive_${now.getTime()}`

  const totalIngredients = formulas.reduce((sum, f) => sum + (f.ingredients?.length || 0), 0)

  const allEfficacyTags = formulas.flatMap(f =>
    (f.ingredients || [])
      .map(ing => ing.efficacy)
      .filter((tag): tag is string => !!tag && tag.trim().length > 0),
  )
  const uniqueEfficacyTags = [...new Set(allEfficacyTags)]

  const avgConfidence = formulas.reduce((sum, f) => sum + f.confidence, 0) / formulas.length

  const sections: ReportSection[] = [
    {
      id: 'cover',
      type: 'cover',
      title: '封面',
      content: {
        title: `综合分析报告（${formulas.length}个配方）`,
        subtitle: '多配方对比分析与综合评估',
        generatedAt: now.toLocaleString('zh-CN'),
        version: '1.0.0',
        formulaCount: formulas.length,
        totalIngredients,
      },
      order: 0,
    },
    {
      id: 'executive-summary',
      type: 'executive-summary',
      title: '执行摘要',
      content: {
        summary: `本报告对${formulas.length}个配方进行综合分析，共涉及${totalIngredients}种不同成分。平均识别置信度为${(avgConfidence * 100).toFixed(1)}%。${uniqueEfficacyTags.length > 0 ? `涵盖的主要功效领域包括：${uniqueEfficacyTags.slice(0, 4).join('、')}等。` : ''}`,
        keyPoints: [
          `配方总数: ${formulas.length}个`,
          `成分种类总计: ${totalIngredients}种`,
          `平均置信度: ${(avgConfidence * 100).toFixed(1)}%`,
          uniqueEfficacyTags.length > 0 ? `功效标签数: ${uniqueEfficacyTags.length}种` : '',
          `最高置信度: ${(Math.max(...formulas.map(f => f.confidence)) * 100).toFixed(1)}%`,
          `最低置信度: ${(Math.min(...formulas.map(f => f.confidence)) * 100).toFixed(1)}%`,
        ].filter(Boolean),
        overallScore: Math.round(avgConfidence * 100),
        recommendation: avgConfidence >= 0.8 ? '整体质量优秀，推荐深入分析' : avgConfidence >= 0.6 ? '整体质量良好，部分配方可优化' : '整体质量一般，建议补充完善',
      },
      order: 1,
    },
    {
      id: 'formula-details',
      type: 'formula-details',
      title: '配方汇总详情',
      content: {
        formulaSummaryTable: {
          headers: ['序号', '配方名称', '成分数量', '置信度', '识别时间'],
          rows: formulas.map((f, idx) => [
            (idx + 1).toString(),
            f.name,
            (f.ingredients?.length || 0).toString(),
            `${(f.confidence * 100).toFixed(1)}%`,
            f.parsedAt.toLocaleString('zh-CN'),
          ]),
        },
        formulas: formulas.map(f => ({
          name: f.name,
          id: f.id,
          ingredientCount: f.ingredients?.length || 0,
          confidence: f.confidence,
          ingredients: (f.ingredients || []).map(ing => ({
            name: ing.name,
            dosage: ing.dosage,
            unit: ing.unit,
            efficacy: ing.efficacy,
          })),
        })),
      },
      order: 2,
    },
    {
      id: 'ingredient-analysis',
      type: 'ingredient-analysis',
      title: '成分统计分析',
      content: {
        totalUniqueIngredients: totalIngredients,
        ingredientFrequency: (() => {
          const freqMap: Record<string, { count: number; formulas: string[] }> = {}
          formulas.forEach(f => {
            (f.ingredients || []).forEach(ing => {
              if (!freqMap[ing.name]) {
                freqMap[ing.name] = { count: 0, formulas: [] }
              }
              freqMap[ing.name].count++
              freqMap[ing.name].formulas.push(f.name)
            })
          })
          return Object.entries(freqMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([name, data]) => ({ name, ...data }))
        })(),
        efficacyTagDistribution: uniqueEfficacyTags.reduce((acc, tag) => {
          acc[tag] = allEfficacyTags.filter(t => t === tag).length
          return acc
        }, {} as Record<string, number>),
      },
      order: 3,
    },
    {
      id: 'synergy-assessment',
      type: 'synergy-assessment',
      title: '跨配方协同分析',
      content: {
        crossFormulaSynergies: totalIngredients > formulas.length ? [
          {
            type: '成分复用',
            description: '多个配方共享相同成分，可能存在协同优化空间',
            potentialScore: 75,
          },
          {
            type: '功效互补',
            description: '不同配方覆盖不同功效领域，可组合使用',
            potentialScore: 80,
          },
        ] : [
          {
            type: '独立配方',
            description: '各配方成分独立性较强，协同潜力有限',
            potentialScore: 50,
          },
        ],
        optimizationOpportunities: [
          '可考虑将高频成分标准化以提升效率',
          '建议研究跨配方成分组合的新应用',
          '关注功效互补性，探索组合产品可能性',
        ],
      },
      order: 4,
    },
    {
      id: 'recommendations',
      type: 'recommendations',
      title: '综合建议',
      content: {
        prioritizedFormulas: formulas
          .sort((a, b) => b.confidence - a.confidence)
          .map((f, idx) => ({
            rank: idx + 1,
            formulaName: f.name,
            confidence: f.confidence,
            recommendation: f.confidence >= 0.8 ? '优先级高，建议重点开发' : f.confidence >= 0.6 ? '优先级中，适合并行开发' : '优先级低，需要补充验证',
          })),
        strategicRecommendations: [
          `优先推进置信度最高的配方（${formulas.sort((a, b) => b.confidence - a.confidence)[0]?.name}）进入实验阶段`,
          `建立成分库管理体系，复用${Math.min(totalIngredients, 10)}种核心成分`,
          uniqueEfficacyTags.length > 3 ? `聚焦${uniqueEfficacyTags.slice(0, 3).join('、')}三大功效方向进行深度开发` : '明确核心功效定位',
          '制定分阶段的产品开发路线图',
        ],
        conclusion: `本次综合分析涵盖${formulas.length}个配方，涉及${totalIngredients}种成分。平均置信度为${(avgConfidence * 100).toFixed(1)}%，整体质量${avgConfidence >= 0.8 ? '优秀' : avgConfidence >= 0.6 ? '良好' : '有待提升'}。建议采用分层推进策略，优先开发高质量配方，同时持续优化和完善其他配方数据。`,
      },
      order: 5,
    },
    {
      id: 'appendix',
      type: 'appendix',
      title: '附录',
      content: {
        dataSources: formulas.map(f => ({
          name: f.name,
          source: `消息ID: ${f.sourceMessageId}`,
          parsedAt: f.parsedAt.toLocaleString('zh-CN'),
        })),
        methodology: '本综合报告采用批量分析引擎，对多个配方进行横向对比和纵向挖掘，结合统计学方法和专业知识库提供综合性评估。',
        disclaimer: '本报告由系统自动生成，仅供研发参考。实际决策应结合实验数据和专家意见。',
        versionInfo: {
          analysisEngine: 'RMFOOD Comprehensive Analyzer v5.0',
          generatedAt: now.toISOString(),
          formulasAnalyzed: formulas.length,
          processingTime: '<2s',
          dataQuality: avgConfidence >= 0.8 ? '优秀' : avgConfidence >= 0.7 ? '良好' : '一般',
        },
      },
      order: 6,
    },
  ]

  const report: ProfessionalReport = {
    id: reportId,
    title: `综合分析报告（${formulas.length}个配方）`,
    generatedAt: now,
    version: '1.0.0',
    sections,
    metadata: {
      author: 'AI 综合分析引擎',
      projectName: 'RMFOOD 配方平台 - 批量分析',
      tags: ['综合分析', `配方数:${formulas.length}`, ...uniqueEfficacyTags.slice(0, 3)],
      analysisVersion: '5.0.0',
    },
  }

  return report
}

export function calculateMetadata(formulas: AIRecognizedFormula[]): ReportMetadata {
  const totalIngredients = formulas.reduce((sum, f) => sum + (f.ingredients?.length || 0), 0)
  const allTags = formulas.flatMap(f =>
    (f.ingredients || [])
      .map(ing => ing.efficacy)
      .filter((tag): tag is string => !!tag && tag.trim().length > 0),
  )
  const uniqueTags = [...new Set(allTags)]
  const avgConfidence = formulas.reduce((sum, f) => sum + f.confidence, 0) / formulas.length

  return {
    tags: uniqueTags.slice(0, 10),
    analysisVersion: '5.0.0',
  }
}

export function validateReport(report: ProfessionalReport): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!report.id || typeof report.id !== 'string') {
    errors.push('报告ID缺失或格式错误')
  }

  if (!report.title || typeof report.title !== 'string') {
    errors.push('报告标题缺失或格式错误')
  }

  if (!(report.generatedAt instanceof Date)) {
    errors.push('生成时间缺失或格式错误')
  }

  if (!Array.isArray(report.sections) || report.sections.length === 0) {
    errors.push('报告章节列表为空或格式错误')
  } else {
    const requiredSections = ['cover', 'executive-summary']
    const existingTypes = report.sections.map(s => s.type)
    requiredSections.forEach(requiredType => {
      if (!existingTypes.includes(requiredType) {
        errors.push('缺少必需章节: ' + requiredType)
      }
    })
  }

  if (!report.metadata || typeof report.metadata !== 'object') {
    errors.push('报告元数据缺失或格式错误')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
