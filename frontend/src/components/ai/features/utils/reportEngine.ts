import type { ProfessionalReport, AIRecognizedFormula, ReportSection, ReportMetadata, Ingredient } from '@/types/ai.types'
import { IngredientSource } from '@/types/ai.types'
import type { SynergyDimension } from '@/components/ai/components/SynergyRadarChart'
import { parseDosageToGramsOrZero } from './dosage'

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

  // 总用量（g）：用 dosage 解析为克后求和，供执行摘要 totalDosage 卡片使用
  const totalDosage = ingredients.reduce(
    (sum, ing) => sum + parseDosageToGramsOrZero(ing.dosage),
    0,
  )

  // 来源类型分布：统计各成分来源类别（TCM/PEPTIDE/EXCIPIENT），去重后作为来源列表。
  // RecognizedFormulaIngredient 未声明 source 字段，运行时可能带（来自 rawData），这里用 in 守卫安全读取，缺失兜底为 TCM。
  const resolveIngredientSource = (ing: unknown): IngredientSource => {
    if (ing && typeof ing === 'object' && 'source' in ing) {
      const s = (ing as { source?: unknown }).source
      if (typeof s === 'string' && Object.values(IngredientSource).includes(s as IngredientSource)) {
        return s as IngredientSource
      }
    }
    return IngredientSource.TCM
  }
  const sources: string[] = [...new Set(ingredients.map(resolveIngredientSource))]
  if (sources.length === 0) sources.push('AI对话解析')

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

  const synergyScore = totalIngredients > 1 ? Math.min(95, 60 + totalIngredients * 5) : 40

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
        formulaName: formula.name,
        keyFindings: [
          `成分总数: ${totalIngredients}种`,
          `识别置信度: ${(formula.confidence * 100).toFixed(1)}%`,
          mainEfficacies.length > 0 ? `核心功效: ${mainEfficacies.join('、')}` : '功效待进一步分析',
          `适用场景: ${applicableScenarios.slice(0, 2).join('、')}`,
          `总用量: ${totalDosage > 0 ? `${totalDosage.toFixed(1)}g` : '待明确'}`,
        ],
        recommendationScore: Math.round(formula.confidence * 100),
        ingredientCount: totalIngredients,
        sources,
        totalDosage,
        summary: `"${formula.name}"是一个${totalIngredients > 5 ? '复杂' : totalIngredients > 2 ? '中等复杂度' : '简单'}配方，包含${totalIngredients}种成分，综合评估置信度为${(formula.confidence * 100).toFixed(1)}%。${mainEfficacies.length > 0 ? `具有${mainEfficacies.slice(0, 2).join('、')}等潜在功效。` : ''}${applicableScenarios.length > 0 ? `推荐应用于${applicableScenarios[0]}等领域。` : ''}${formula.confidence >= 0.8 ? '整体质量优秀，推荐深入开发。' : formula.confidence >= 0.6 ? '整体质量良好，建议优化后使用。' : '需重新评估配方数据。'}`,
      },
      order: 1,
    },
    {
      id: 'formula-details',
      type: 'formula-details',
      title: '配方详情',
      content: {
        // FormulaTableData 形状，直接传给 <FormulaTable data={...}>
        formulaData: {
          title: formula.name,
          ingredients: ingredients.map(ing => ({
            name: ing.name,
            amount: parseDosageToGramsOrZero(ing.dosage),
            unit: ing.unit || 'g',
            source: resolveIngredientSource(ing),
            role: ing.efficacy || undefined,
          })) as Ingredient[],
          totalAmount: totalDosage,
          description: mainEfficacies.length > 0 ? `主要功效：${mainEfficacies.join('、')}` : undefined,
          confidence: formula.confidence,
          score: Math.round(formula.confidence * 100),
        },
        statistics: {
          '成分总数': `${totalIngredients} 种`,
          '总用量': totalDosage > 0 ? `${totalDosage.toFixed(1)} g` : '待明确',
          '识别置信度': `${(formula.confidence * 100).toFixed(1)}%`,
          '功效标签': `${uniqueEfficacyTags.length} 项`,
        },
      },
      order: 2,
    },
    {
      id: 'ingredient-analysis',
      type: 'ingredient-analysis',
      title: '成分分析',
      content: {
        ingredients: ingredients.map((ing, idx) => ({
          name: ing.name,
          amount: parseDosageToGramsOrZero(ing.dosage),
          unit: ing.unit || 'g',
          description: ing.efficacy || '待进一步分析其药理作用',
          mechanism: ing.notes || `作为${idx === 0 ? '主成分' : idx < 3 ? '辅助成分' : '配伍成分'}参与配方整体功效的构建`,
          references: [
            `来源消息: ${formula.sourceMessageId}`,
            '成分知识库: RMFOOD 内置药食同源数据库',
          ],
        })),
      },
      order: 3,
    },
    {
      id: 'synergy-assessment',
      type: 'synergy-assessment',
      title: '协同效应评估',
      content: {
        // SynergyRadarChart 的 SynergyRadarData[]：{ id, name, scores: { dimension, value }[] }
        radarData: [
          {
            id: `${formula.id}-synergy`,
            name: formula.name,
            scores: [
              { dimension: 'synergyStrength' as SynergyDimension, value: synergyScore },
              { dimension: 'bioavailabilityEnhancement' as SynergyDimension, value: Math.min(90, 55 + totalIngredients * 4) },
              { dimension: 'efficacyMultiplication' as SynergyDimension, value: Math.min(92, 58 + uniqueEfficacyTags.length * 6) },
              { dimension: 'safetyIndex' as SynergyDimension, value: Math.round(formula.confidence * 100) },
              { dimension: 'stabilityImprovement' as SynergyDimension, value: Math.min(85, 60 + totalIngredients * 3) },
              { dimension: 'tasteBalance' as SynergyDimension, value: Math.min(80, 50 + totalIngredients * 4) },
            ],
          },
        ],
        mechanismDescription: totalIngredients <= 2
          ? `成分较少（${totalIngredients}种），配伍协同效应有限，建议适当增加君臣佐使结构以增强整体功效。`
          : totalIngredients <= 5
            ? `成分搭配合理（${totalIngredients}种），各成分功效互补，存在潜在协同增强作用，综合协同评分${synergyScore}。`
            : `成分丰富（${totalIngredients}种），需关注成分间相互作用，在保证功效倍增的同时监控安全性指标。`,
        warnings: ingredients.filter(ing => ing.notes).map(ing => `${ing.name}：${ing.notes}`),
      },
      order: 4,
    },
    {
      id: 'recommendations',
      type: 'recommendations',
      title: '建议与结论',
      content: {
        targetAudience: applicableScenarios,
        usageInstructions: [
          `建议单次用量参照配方总量的1/10，每日1-2次${formula.recommendedDosage ? `（推荐剂量：${formula.recommendedDosage}）` : ''}`,
          '温水冲调或煎煮后服用，建议餐后30分钟食用以促进吸收',
          '连续服用2-4周为一个观察周期，期间记录身体反应',
          '如出现不适，立即停用并咨询专业人士',
        ],
        storageConditions: '密封、阴凉干燥处保存，避免阳光直射与高温高湿环境；开封后建议冷藏并于30日内用完。',
        precautions: [
          ...ingredients.filter(ing => ing.notes).map(ing => `${ing.name}：${ing.notes}`),
          ...(formula.contraindications ? [formula.contraindications] : []),
          '本报告由系统自动生成，仅供参考，不能替代医师诊断与治疗；特殊人群（孕妇、儿童、慢病患者）使用前请咨询专业人士。',
        ],
      },
      order: 5,
    },
    {
      id: 'appendix',
      type: 'appendix',
      title: '附录',
      content: {
        references: [
          `AI对话解析：从消息 ${formula.sourceMessageId} 中自动提取`,
          '配方数据库：基于内置成分知识库匹配（药食同源物质国家标准）',
          '分析方法：RMFOOD Formula Analyzer v5.0，结合规则引擎与机器学习算法',
          `数据质量评级：${formula.confidence >= 0.9 ? '优秀' : formula.confidence >= 0.7 ? '良好' : '一般'}（置信度 ${(formula.confidence * 100).toFixed(1)}%）`,
        ],
        glossary: [
          { term: '君臣佐使', definition: '中医方剂配伍原则，主药为君、辅药为臣、佐使调和，指导配方结构与剂量层级。' },
          { term: '置信度', definition: 'AI识别配方结构的可信程度（0-1），越高表示解析结果越可靠。' },
          { term: '协同效应', definition: '多种成分配伍后产生的整体功效大于各成分单独作用之和的现象。' },
          { term: '药食同源', definition: '既可作为食品又具有药用价值的物质，符合国家食药物质目录。' },
        ],
        dataSource: '本报告由 RMFOOD 配方平台 AI 分析引擎自动生成，数据来源为 AI 对话解析结果与内置成分知识库。本报告仅供参考，实际应用前请咨询专业人士并进行实验验证。',
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
        prioritizedFormulas: [...formulas]
          .sort((a, b) => b.confidence - a.confidence)
          .map((f, idx) => ({
            rank: idx + 1,
            formulaName: f.name,
            confidence: f.confidence,
            recommendation: f.confidence >= 0.8 ? '优先级高，建议重点开发' : f.confidence >= 0.6 ? '优先级中，适合并行开发' : '优先级低，需要补充验证',
          })),
        strategicRecommendations: [
          `优先推进置信度最高的配方（${[...formulas].sort((a, b) => b.confidence - a.confidence)[0]?.name}）进入实验阶段`,
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
  const allTags = formulas.flatMap(f =>
    (f.ingredients || [])
      .map(ing => ing.efficacy)
      .filter((tag): tag is string => !!tag && tag.trim().length > 0),
  )
  const uniqueTags = [...new Set(allTags)]

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
    requiredSections.forEach((requiredType: any) => {
      if (!existingTypes.includes(requiredType)) {
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
