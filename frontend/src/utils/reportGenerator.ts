import { logger } from '@/utils/safeLogger';
export type ReportSectionType = 'cover' | 'executive-summary' | 'formula-details' | 'ingredient-analysis' | 'synergy-assessment' | 'recommendations' | 'appendix'

export type ExportFormat = 'pdf' | 'word' | 'excel' | 'html'

export interface ReportTemplateMetadata {
  author?: string
  organization?: string
  logoUrl?: string
  defaultExportFormat: ExportFormat
  createdAt: Date
  updatedAt: Date
}

export interface TemplateSectionConfig {
  type: ReportSectionType
  title: string
  order: number
  required: boolean
  detailLevel: 'brief' | 'standard' | 'detailed'
  customFields?: Record<string, any>
}

export interface ReportTemplate {
  id: string
  name: string
  version: string
  sections: TemplateSectionConfig[]
  metadata: ReportTemplateMetadata
}

export interface FormulaTableData {
  id: string
  name: string
  ingredients: IngredientData[]
  totalWeight: number
  unit: string
  createdAt: Date
  updatedAt: Date
}

export interface IngredientData {
  id: string
  name: string
  percentage: number
  weight: number
  unit: string
  category: string
  function?: string
  notes?: string
}

export interface SynergyAnalysisData {
  overallScore: number
  pairs: SynergyPair[]
  recommendations: string[]
  chartData: RadarChartData
}

export interface SynergyPair {
  ingredient1: string
  ingredient2: string
  score: number
  description: string
}

export interface RadarChartData {
  labels: string[]
  datasets: DatasetItem[]
}

export interface DatasetItem {
  label: string
  data: number[]
  backgroundColor?: string
  borderColor?: string
}

export interface AIConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ReportInputData {
  formulaData: FormulaTableData
  synergyAnalysis?: SynergyAnalysisData
  aiConversation?: AIConversationMessage[]
  customVariables?: Record<string, any>
  reportTitle?: string
  author?: string
  organization?: string
}

export interface ReportStatistics {
  totalIngredients: number
  categories: Record<string, number>
  averagePercentage: number
  maxIngredient: { name: string; percentage: number } | null
  minIngredient: { name: string; percentage: number } | null
  synergyScore?: number
}

export interface SectionContent {
  type: ReportSectionType
  title: string
  content: any
  order: number
  renderedAt: Date
}

export interface ProfessionalReport {
  id: string
  templateId: string
  templateName: string
  templateVersion: string
  title: string
  generatedAt: Date
  author: string
  organization: string
  sections: SectionContent[]
  statistics: ReportStatistics
  metadata: ReportMetadata
  validationStatus: 'valid' | 'invalid' | 'pending'
  exportFormat: ExportFormat
}

export interface ReportMetadata {
  totalPages?: number
  wordCount?: number
  keywords: string[]
  references: ReferenceItem[]
  version: string
  checksum: string
}

export interface ReferenceItem {
  id: string
  title: string
  source: string
  url?: string
  year?: number
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  score: number
}

export interface ValidationError {
  field: string
  message: string
  code: string
  severity: 'error' | 'warning'
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

export function generateReportId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `RPT-${timestamp}-${randomPart}`.toUpperCase()
}

export function formatReportDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

export function calculateStatistics(data: FormulaTableData): ReportStatistics {
  if (!data.ingredients || data.ingredients.length === 0) {
    return {
      totalIngredients: 0,
      categories: {},
      averagePercentage: 0,
      maxIngredient: { name: '', percentage: 0 },
      minIngredient: { name: '', percentage: 0 },
    }
  }

  const totalPercentage = data.ingredients.reduce((sum, ing) => sum + ing.percentage, 0)
  const averagePercentage = data.ingredients.length > 0 ? totalPercentage / data.ingredients.length : 0

  const maxIngredient = data.ingredients.reduce((max: IngredientData | null, ing) =>
    (!max || ing.percentage > max.percentage) ? ing : max, null)

  const minIngredient = data.ingredients.reduce((min: IngredientData | null, ing) =>
    (!min || ing.percentage < min.percentage) ? ing : min, null)

  const categories: Record<string, number> = {}
  data.ingredients.forEach(ing => {
    categories[ing.category] = (categories[ing.category] || 0) + 1
  })

  return {
    totalIngredients: data.ingredients.length,
    categories,
    averagePercentage: Math.round(averagePercentage * 100) / 100,
    maxIngredient: maxIngredient ? { name: maxIngredient.name, percentage: maxIngredient.percentage } : null,
    minIngredient: minIngredient ? { name: minIngredient.name, percentage: minIngredient.percentage } : null,
  }
}

export function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) return []

  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  ])

  const words = text.toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word))

  const frequencyMap: Record<string, number> = {}
  words.forEach(word => {
    frequencyMap[word] = (frequencyMap[word] || 0) + 1
  })

  return Object.entries(frequencyMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word)
}

function generateChecksum(report: ProfessionalReport): string {
  const reportString = JSON.stringify({
    id: report.id,
    generatedAt: report.generatedAt,
    sections: report.sections.map(s => ({ type: s.type, order: s.order })),
  })

  let hash = 0
  for (let i = 0; i < reportString.length; i++) {
    const char = reportString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()
}

export function replaceVariables(template: string, variables: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template

  let result = template

  result = processConditionals(result, variables)
  result = processLoops(result, variables)
  result = processSimpleVariables(result, variables)

  return result
}

function processSimpleVariables(template: string, variables: Record<string, any>): string {
  const variablePattern = /\{\{([^#/]\w+?)\}\}/g
  return template.replace(variablePattern, (match, varName) => {
    const trimmedName = varName.trim()
    if (Object.prototype.hasOwnProperty.call(variables, trimmedName)) {
      const value = variables[trimmedName]
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    }
    return match
  })
}

function processConditionals(template: string, variables: Record<string, any>): string {
  const conditionalPattern = /\{\{#if\s+(\w+?)\}\}([\s\S]*?)\{\{\/if\}\}/g

  let result = template
  let match = conditionalPattern.exec(template)

  while (match !== null) {
    const conditionVar = match[1]?.trim() || ''
    const content = match[2] || ''
    const fullMatch = match[0]

    const shouldRender = Boolean(variables[conditionVar])
    const replacement = shouldRender ? content : ''

    result = result.replace(fullMatch, replacement)
    match = conditionalPattern.exec(template)
  }

  return result
}

function processLoops(template: string, variables: Record<string, any>): string {
  const loopPattern = /\{\{#each\s+(\w+?)\}\}([\s\S]*?)\{\{\/each\}\}/g

  let result = template
  let match = loopPattern.exec(template)

  while (match !== null) {
    const arrayVar = match[1]?.trim() || ''
    const itemTemplate = match[2] || ''
    const fullMatch = match[0]

    const arrayValue = variables[arrayVar]

    if (Array.isArray(arrayValue)) {
      const renderedItems = arrayValue.map((item, index) => {
        let rendered = itemTemplate

        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            const value = item[key]
            rendered = rendered.replace(pattern, value !== undefined ? String(value) : '')
          })
        }

        rendered = rendered.replace(/\{\{@index\}\}/g, String(index))
        rendered = rendered.replace(/\{\{@first\}\}/g, index === 0 ? 'true' : 'false')
        rendered = rendered.replace(/\{\{@last\}\}/g, index === arrayValue.length - 1 ? 'true' : 'false')

        return rendered
      })

      result = result.replace(fullMatch, renderedItems.join(''))
    } else {
      result = result.replace(fullMatch, '')
    }

    match = loopPattern.exec(template)
  }

  return result
}

export function buildTemplateVariables(data: ReportInputData, template?: ReportTemplate): Record<string, any> {
  const now = new Date()
  const stats = calculateStatistics(data.formulaData)

  const baseVariables: Record<string, any> = {
    title: data.reportTitle || data.formulaData.name,
    date: formatReportDate(now),
    version: template?.version || '1.0.0',
    author: data.author || template?.metadata.author || '',
    organization: data.organization || template?.metadata.organization || '',
    formula_name: data.formulaData.name,
    formula_count: stats.totalIngredients,
    formula_unit: data.formulaData.unit,
    total_weight: data.formulaData.totalWeight,
    average_percentage: stats.averagePercentage,
    max_ingredient: stats.maxIngredient?.name ?? '',
    max_percentage: stats.maxIngredient?.percentage ?? 0,
    min_ingredient: stats.minIngredient?.name ?? '',
    min_percentage: stats.minIngredient?.percentage ?? 0,
    synergy_score: data.synergyAnalysis?.overallScore ?? 'N/A',
    generated_at: now.toISOString(),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    has_synergy: Boolean(data.synergyAnalysis),
    has_conversation: Boolean(data.aiConversation && data.aiConversation.length > 0),
    conversation_count: data.aiConversation?.length ?? 0,
  }

  if (data.customVariables) {
    Object.assign(baseVariables, data.customVariables)
  }

  if (data.formulaData.ingredients) {
    baseVariables.ingredients = data.formulaData.ingredients.map(ing => ({
      name: ing.name,
      percentage: ing.percentage,
      weight: ing.weight,
      unit: ing.unit,
      category: ing.category,
      function: ing.function || '',
    }))
  }

  if (data.synergyAnalysis?.pairs) {
    baseVariables.synergy_pairs = data.synergyAnalysis.pairs.map(pair => ({
      ingredient1: pair.ingredient1,
      ingredient2: pair.ingredient2,
      score: pair.score,
      description: pair.description,
    }))
  }

  if (data.synergyAnalysis?.recommendations) {
    baseVariables.recommendations = data.synergyAnalysis.recommendations
  }

  return baseVariables
}

export function getDefaultTemplate(): ReportTemplate {
  const now = new Date()

  return {
    id: 'TPL-DEFAULT-001',
    name: '标准专业配方报告模板',
    version: '1.0.0',
    sections: [
      {
        type: 'cover',
        title: '封面',
        order: 1,
        required: true,
        detailLevel: 'standard',
      },
      {
        type: 'executive-summary',
        title: '执行摘要',
        order: 2,
        required: true,
        detailLevel: 'standard',
      },
      {
        type: 'formula-details',
        title: '配方详情',
        order: 3,
        required: true,
        detailLevel: 'detailed',
      },
      {
        type: 'ingredient-analysis',
        title: '成分分析',
        order: 4,
        required: true,
        detailLevel: 'detailed',
      },
      {
        type: 'synergy-assessment',
        title: '协同效应评估',
        order: 5,
        required: false,
        detailLevel: 'standard',
      },
      {
        type: 'recommendations',
        title: '应用建议',
        order: 6,
        required: true,
        detailLevel: 'standard',
      },
      {
        type: 'appendix',
        title: '附录',
        order: 7,
        required: false,
        detailLevel: 'brief',
      },
    ],
    metadata: {
      author: '',
      organization: '',
      logoUrl: '',
      defaultExportFormat: 'pdf',
      createdAt: now,
      updatedAt: now,
    },
  }
}

export interface ReportSection {
  type: ReportSectionType
  title: string
  order: number
  detailLevel: 'brief' | 'standard' | 'detailed'
  customFields?: Record<string, any>
}

export function renderSection(section: ReportSection, data: ReportInputData): any {
  const variables = buildTemplateVariables(data)

  switch (section.type) {
    case 'cover':
      return renderCoverSection(section, data, variables)
    case 'executive-summary':
      return renderExecutiveSummary(section, data, variables)
    case 'formula-details':
      return renderFormulaDetails(section, data, variables)
    case 'ingredient-analysis':
      return renderIngredientAnalysis(section, data, variables)
    case 'synergy-assessment':
      return renderSynergyAssessment(section, data, variables)
    case 'recommendations':
      return renderRecommendations(section, data, variables)
    case 'appendix':
      return renderAppendix(section, data, variables)
    default:
      return null
  }
}

function renderCoverSection(section: ReportSection, data: ReportInputData, variables: Record<string, any>): any {
  return {
    type: 'cover',
    title: section.title,
    content: {
      reportTitle: variables.title,
      subtitle: '专业配方分析报告',
      date: variables.date,
      version: variables.version,
      author: variables.author,
      organization: variables.organization,
      logoUrl: data.customVariables?.logoUrl || '',
    },
    template: `
<div class="report-cover">
  <h1 class="report-title">{{title}}</h1>
  <p class="report-subtitle">专业配方分析报告</p>
  <div class="report-meta">
    <p>生成日期：{{date}}</p>
    <p>版本号：{{version}}</p>
    {{#if author}}<p>作者：{{author}}</p>{{/if}}
    {{#if organization}}<p>机构：{{organization}}</p>{{/if}}
  </div>
</div>`,
  }
}

function renderExecutiveSummary(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  const stats = calculateStatistics(data.formulaData)

  let summary = `本报告对配方"${data.formulaData.name}"进行了全面分析。该配方共包含${stats.totalIngredients}种成分，`
  summary += `总重量为${data.formulaData.totalWeight}${data.formulaData.unit}。`

  if (data.synergyAnalysis) {
    summary += `协同效应评估得分为${data.synergyAnalysis.overallScore}/100，表明成分间具有良好的协同作用。`
  }

  if (stats.maxIngredient && stats.minIngredient) {
    summary += `主要成分为${stats.maxIngredient.name}（占比${stats.maxIngredient.percentage}%），`
    summary += `最小占比成分为${stats.minIngredient.name}（${stats.minIngredient.percentage}%）。`
  }

  return {
    type: 'executive-summary',
    title: section.title,
    content: {
      summary,
      keyMetrics: {
        totalIngredients: stats.totalIngredients,
        totalWeight: data.formulaData.totalWeight,
        synergyScore: data.synergyAnalysis?.overallScore ?? null,
        categoryCount: Object.keys(stats.categories).length,
      },
      highlights: generateHighlights(data, stats),
    },
  }
}

function renderFormulaDetails(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  const detailLevel = section.detailLevel

  const ingredients = data.formulaData.ingredients

  if (detailLevel === 'brief') {
    const briefIngredients = ingredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      percentage: ing.percentage,
      weight: ing.weight,
      unit: ing.unit,
      category: ing.category,
    }))
    return {
      type: 'formula-details',
      title: section.title,
      content: {
        formulaName: data.formulaData.name,
        totalWeight: data.formulaData.totalWeight,
        unit: data.formulaData.unit,
        createdAt: formatReportDate(data.formulaData.createdAt),
        updatedAt: formatReportDate(data.formulaData.updatedAt),
        ingredients: briefIngredients,
        detailLevel,
        tableData: {
          headers: getTableHeaders(detailLevel),
          rows: briefIngredients.map(ing => getTableRow(ing, detailLevel)),
        },
      },
    }
  }

  return {
    type: 'formula-details',
    title: section.title,
    content: {
      formulaName: data.formulaData.name,
      totalWeight: data.formulaData.totalWeight,
      unit: data.formulaData.unit,
      createdAt: formatReportDate(data.formulaData.createdAt),
      updatedAt: formatReportDate(data.formulaData.updatedAt),
      ingredients,
      detailLevel,
      tableData: {
        headers: getTableHeaders(detailLevel),
        rows: ingredients.map(ing => getTableRow(ing, detailLevel)),
      },
    },
  }
}

function renderIngredientAnalysis(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  const analyses = data.formulaData.ingredients.map(ingredient => ({
    ingredient: ingredient.name,
    percentage: ingredient.percentage,
    weight: ingredient.weight,
    unit: ingredient.unit,
    category: ingredient.category,
    function: ingredient.function || '未指定功能',
    role: determineIngredientRole(ingredient.percentage, data.formulaData.ingredients.length),
    notes: ingredient.notes || '',
    analysis: generateIngredientAnalysis(ingredient, data.formulaData),
  }))

  return {
    type: 'ingredient-analysis',
    title: section.title,
    content: {
      analyses,
      categorySummary: buildCategorySummary(data.formulaData.ingredients),
      recommendations: generateIngredientRecommendations(analyses),
    },
  }
}

function renderSynergyAssessment(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  if (!data.synergyAnalysis) {
    return {
      type: 'synergy-assessment',
      title: section.title,
      content: {
        available: false,
        message: '暂无协同效应分析数据',
      },
    }
  }

  return {
    type: 'synergy-assessment',
    title: section.title,
    content: {
      available: true,
      overallScore: data.synergyAnalysis.overallScore,
      scoreInterpretation: interpretSynergyScore(data.synergyAnalysis.overallScore),
      pairs: data.synergyAnalysis.pairs.map(pair => ({
        ...pair,
        level: classifySynergyLevel(pair.score),
      })),
      chartData: data.synergyAnalysis.chartData,
      recommendations: data.synergyAnalysis.recommendations,
    },
  }
}

function renderRecommendations(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  const allRecommendations: string[] = []

  if (data.synergyAnalysis?.recommendations) {
    allRecommendations.push(...data.synergyAnalysis.recommendations)
  }

  const stats = calculateStatistics(data.formulaData)
  allRecommendations.push(...generateFormulaRecommendations(stats, data))

  if (data.aiConversation && data.aiConversation.length > 0) {
    const aiInsights = extractAIInsights(data.aiConversation)
    allRecommendations.push(...aiInsights)
  }

  return {
    type: 'recommendations',
    title: section.title,
    content: {
      recommendations: allRecommendations.map((rec, index) => ({
        id: `REC-${String(index + 1).padStart(3, '0')}`,
        text: rec,
        priority: determineRecommendationPriority(rec),
        category: categorizeRecommendation(rec),
      })),
      summary: generateRecommendationSummary(allRecommendations),
    },
  }
}

function renderAppendix(section: ReportSection, data: ReportInputData, _variables: Record<string, any>): any {
  void _variables;
  const allText = collectAllText(data)
  const keywords = extractKeywords(allText)

  const references: ReferenceItem[] = [
    {
      id: 'REF-001',
      title: `配方数据来源 - ${data.formulaData.name}`,
      source: 'RMFOOD配方平台',
      year: new Date().getFullYear(),
    },
  ]

  if (data.synergyAnalysis) {
    references.push({
      id: 'REF-002',
      title: '协同效应分析报告',
      source: 'RMFOOD配方平台 - AI分析模块',
      year: new Date().getFullYear(),
    })
  }

  const glossary = buildGlossary(data)

  return {
    type: 'appendix',
    title: section.title,
    content: {
      keywords,
      references,
      glossary,
      methodology: '本报告采用多维度分析方法，结合定量数据分析与AI智能评估，确保结论的科学性和可靠性。',
      disclaimer: '本报告内容仅供参考，实际应用请结合具体场景和专业判断。',
    },
  }
}

function getTableHeaders(detailLevel: 'brief' | 'standard' | 'detailed'): string[] {
  switch (detailLevel) {
    case 'brief':
      return ['成分名称', '百分比']
    case 'standard':
      return ['成分名称', '百分比', '重量', '类别']
    case 'detailed':
      return ['成分名称', '百分比', '重量', '单位', '类别', '功能说明']
    default:
      return []
  }
}

function getTableRow(ingredient: IngredientData, detailLevel: 'brief' | 'standard' | 'detailed'): any {
  switch (detailLevel) {
    case 'brief':
      return [ingredient.name, `${ingredient.percentage}%`]
    case 'standard':
      return [ingredient.name, `${ingredient.percentage}%`, `${ingredient.weight}${ingredient.unit}`, ingredient.category]
    case 'detailed':
      return [
        ingredient.name,
        `${ingredient.percentage}%`,
        `${ingredient.weight}`,
        ingredient.unit,
        ingredient.category,
        ingredient.function || '-',
      ]
    default:
      return []
  }
}

function generateHighlights(data: ReportInputData, stats: ReportStatistics): string[] {
  const highlights: string[] = []

  highlights.push(`配方包含 ${stats.totalIngredients} 种成分`)

  if (data.synergyAnalysis && data.synergyAnalysis.overallScore >= 80) {
    highlights.push('协同效应优秀')
  } else if (data.synergyAnalysis && data.synergyAnalysis.overallScore >= 60) {
    highlights.push('协同效应良好')
  }

  if (Object.keys(stats.categories).length > 3) {
    highlights.push(`涵盖 ${Object.keys(stats.categories).length} 个成分类别`)
  }

  return highlights
}

function determineIngredientRole(percentage: number, totalCount: number): string {
  const ratio = percentage / totalCount

  if (ratio > 2) return '主要成分'
  if (ratio > 0.5) return '核心成分'
  if (ratio > 0.2) return '辅助成分'
  return '微量成分'
}

function generateIngredientAnalysis(ingredient: IngredientData, formulaData: FormulaTableData): string {
  const role = determineIngredientRole(ingredient.percentage, formulaData.ingredients.length)
  let analysis = `${ingredient.name}作为${role}，`

  if (ingredient.function) {
    analysis += `主要功能为${ingredient.function}。`
  } else {
    analysis += `属于${ingredient.category}类别。`
  }

  if (ingredient.percentage > 30) {
    analysis += '占比较高，需关注其与其他成分的相互作用。'
  } else if (ingredient.percentage < 5) {
    analysis += '虽占比较低，但可能起到关键的调节作用。'
  }

  return analysis
}

function buildCategorySummary(ingredients: IngredientData[]): Record<string, { count: number; totalPercentage: number; items: string[] }> {
  const summary: Record<string, { count: number; totalPercentage: number; items: string[] }> = {}

  ingredients.forEach(ing => {
    const category = ing.category || '未分类'
    if (!summary[category]) {
      summary[category] = { count: 0, totalPercentage: 0, items: [] }
    }
    const categorySummary = summary[category]
    categorySummary.count++
    categorySummary.totalPercentage += ing.percentage
    categorySummary.items.push(ing.name)
  })

  return summary
}

function generateIngredientRecommendations(analyses: any[]): string[] {
  const recommendations: string[] = []

  const highPercentages = analyses.filter(a => a.percentage > 30)
  if (highPercentages.length > 0) {
    recommendations.push(`注意监控高浓度成分：${highPercentages.map(a => a.ingredient).join('、')}的配比稳定性`)
  }

  const categories = new Set(analyses.map(a => a.category))
  if (categories.size < 2) {
    recommendations.push('建议增加成分多样性，以提升配方的综合效果')
  }

  return recommendations
}

function interpretSynergyScore(score: number): string {
  if (score >= 90) return '卓越 - 成分间具有极强的协同增效作用'
  if (score >= 80) return '优秀 - 成分间协同效应显著'
  if (score >= 70) return '良好 - 成分间存在积极的协同作用'
  if (score >= 60) return '一般 - 成分间协同效应中等'
  if (score >= 50) return '较弱 - 成分间协同作用有限'
  return '待优化 - 建议重新评估成分组合'
}

function classifySynergyLevel(score: number): 'excellent' | 'good' | 'moderate' | 'weak' {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  return 'weak'
}

function generateFormulaRecommendations(stats: ReportStatistics, _data: ReportInputData): string[] {
  void _data;
  const recommendations: string[] = []

  if (stats.totalIngredients === 0) {
    recommendations.push('配方缺少成分数据，请补充完整信息')
  } else if (stats.totalIngredients < 5) {
    recommendations.push('建议考虑增加成分种类，以提升配方的完整性和效果')
  } else if (stats.totalIngredients > 20) {
    recommendations.push('配方成分较多，建议评估是否可以简化以提高可控性')
  }

  if (stats.maxIngredient && stats.maxIngredient.percentage > 50) {
    recommendations.push(`${stats.maxIngredient.name} 占比过高（${stats.maxIngredient.percentage}%），建议评估其对整体配方的影响`)
  }

  return recommendations
}

function extractAIInsights(conversations: AIConversationMessage[]): string[] {
  const insights: string[] = []

  conversations
    .filter(msg => msg.role === 'assistant')
    .forEach(msg => {
      const sentences = msg.content.split(/[。！？.!?]/).filter(s => s.trim().length > 10)
      insights.push(...sentences.slice(0, 2))
    })

  return [...new Set(insights)].slice(0, 5)
}

function determineRecommendationPriority(text: string): 'high' | 'medium' | 'low' {
  const highPriorityKeywords = ['必须', '重要', '关键', '注意', '警告', '风险']
  const mediumPriorityKeywords = ['建议', '推荐', '考虑', '可以']

  if (highPriorityKeywords.some(keyword => text.includes(keyword))) return 'high'
  if (mediumPriorityKeywords.some(keyword => text.includes(keyword))) return 'medium'
  return 'low'
}

function categorizeRecommendation(text: string): string {
  if (text.includes('安全') || text.includes('风险')) return '安全性'
  if (text.includes('效果') || text.includes('协同')) return '效果优化'
  if (text.includes('成本') || text.includes('经济')) return '成本控制'
  if (text.includes('工艺') || text.includes('生产')) return '生产工艺'
  return '一般建议'
}

function generateRecommendationSummary(recommendations: string[]): string {
  if (recommendations.length === 0) return '暂无特别建议'

  const highCount = recommendations.filter(r =>
    ['必须', '重要', '关键', '注意'].some(kw => r.includes(kw)),
  ).length

  if (highCount > 0) {
    return `共生成 ${recommendations.length} 条建议，其中 ${highCount} 条需要重点关注`
  }
  return `共生成 ${recommendations.length} 条改进建议`
}

function collectAllText(data: ReportInputData): string {
  let text = data.formulaData.name + ' '

  data.formulaData.ingredients.forEach(ing => {
    text += ing.name + ' ' + (ing.function || '') + ' ' + (ing.notes || '') + ' '
  })

  if (data.synergyAnalysis) {
    data.synergyAnalysis.pairs.forEach(pair => {
      text += pair.description + ' '
    })
    text += data.synergyAnalysis.recommendations.join(' ') + ' '
  }

  if (data.aiConversation) {
    data.aiConversation.forEach(msg => {
      text += msg.content + ' '
    })
  }

  return text
}

function buildGlossary(data: ReportInputData): Record<string, string> {
  const glossary: Record<string, string> = {
    '协同效应': '多种成分共同作用时产生的增强或减弱效果',
    '配方': '按照特定比例组合的成分集合',
    '主要成分': '在配方中占比较高（通常>20%）的核心物质',
    '辅助成分': '用于调节或增强主成分效果的次要物质',
  }

  data.formulaData.ingredients.forEach(ing => {
    if (ing.category && !glossary[ing.category]) {
      glossary[ing.category] = `${ing.category}类成分`
    }
  })

  return glossary
}

export function generateReport(data: ReportInputData, template?: ReportTemplate): ProfessionalReport {
  const reportTemplate = template || getDefaultTemplate()
  const now = new Date()
  const reportId = generateReportId()

  const statistics = calculateStatistics(data.formulaData)

  if (data.synergyAnalysis) {
    statistics.synergyScore = data.synergyAnalysis.overallScore
  }

  const sortedSections = [...reportTemplate.sections].sort((a, b) => a.order - b.order)
  const renderedSections: SectionContent[] = []

  sortedSections.forEach(sectionConfig => {
    try {
      const sectionData: ReportSection = {
        type: sectionConfig.type,
        title: sectionConfig.title,
        order: sectionConfig.order,
        detailLevel: sectionConfig.detailLevel,
        customFields: sectionConfig.customFields,
      }

      if (sectionConfig.type === 'synergy-assessment' && !data.synergyAnalysis) {
        if (sectionConfig.required) {
          logger.warn(`Required section '${sectionConfig.type}' skipped due to missing data`)
        }
        return
      }

      const renderedContent = renderSection(sectionData, data)

      if (renderedContent) {
        renderedSections.push({
          type: sectionConfig.type,
          title: sectionConfig.title,
          content: renderedContent.content || renderedContent,
          order: sectionConfig.order,
          renderedAt: now,
        })
      }
    } catch (error) {
      logger.error(`Error rendering section ${sectionConfig.type}:`, error)

      if (sectionConfig.required) {
        renderedSections.push({
          type: sectionConfig.type,
          title: sectionConfig.title,
          content: { error: '章节渲染失败', details: error instanceof Error ? error.message : '未知错误' },
          order: sectionConfig.order,
          renderedAt: now,
        })
      }
    }
  })

  const allText = collectAllText(data)
  const keywords = extractKeywords(allText)

  const report: ProfessionalReport = {
    id: reportId,
    templateId: reportTemplate.id,
    templateName: reportTemplate.name,
    templateVersion: reportTemplate.version,
    title: data.reportTitle || data.formulaData.name,
    generatedAt: now,
    author: data.author || reportTemplate.metadata.author || '',
    organization: data.organization || reportTemplate.metadata.organization || '',
    sections: renderedSections,
    statistics,
    metadata: {
      keywords,
      references: buildReferences(data),
      version: reportTemplate.version,
      checksum: '',
    },
    validationStatus: 'pending',
    exportFormat: reportTemplate.metadata.defaultExportFormat,
  }

  report.metadata.checksum = generateChecksum(report)

  const validation = validateReport(report)
  report.validationStatus = validation.isValid ? 'valid' : 'invalid'

  return report
}

export async function generateReportAsync(
  data: ReportInputData,
  template?: ReportTemplate,
  options?: { fetchAdditionalData?: boolean; onProgress?: (progress: number) => void },
): Promise<ProfessionalReport> {
  if (options?.onProgress) {
    options.onProgress(10)
  }

  let enrichedData = { ...data }

  if (options?.fetchAdditionalData) {
    if (options.onProgress) options.onProgress(30)

    await new Promise(resolve => setTimeout(resolve, 100))

    if (!enrichedData.synergyAnalysis && enrichedData.formulaData.ingredients.length > 0) {
      enrichedData = await fetchSynergyData(enrichedData)
    }

    if (options.onProgress) options.onProgress(70)
  }

  if (options?.onProgress) {
    options.onProgress(90)
  }

  const report = generateReport(enrichedData, template)

  if (options?.onProgress) {
    options.onProgress(100)
  }

  return report
}

async function fetchSynergyData(data: ReportInputData): Promise<ReportInputData> {
  return data
}

function buildReferences(data: ReportInputData): ReferenceItem[] {
  const references: ReferenceItem[] = [
    {
      id: 'REF-001',
      title: `配方数据 - ${data.formulaData.name}`,
      source: 'RMFOOD配方平台',
      year: new Date().getFullYear(),
    },
  ]

  if (data.synergyAnalysis) {
    references.push({
      id: 'REF-002',
      title: '协同效应分析',
      source: 'AI分析引擎',
      year: new Date().getFullYear(),
    })
  }

  return references
}

export function validateReport(report: ProfessionalReport): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!report.id || report.id.trim() === '') {
    errors.push({
      field: 'id',
      message: '报告ID不能为空',
      code: 'MISSING_ID',
      severity: 'error',
    })
  }

  if (!report.title || report.title.trim() === '') {
    errors.push({
      field: 'title',
      message: '报告标题不能为空',
      code: 'MISSING_TITLE',
      severity: 'error',
    })
  }

  if (!report.generatedAt || !(report.generatedAt instanceof Date) || isNaN(report.generatedAt.getTime())) {
    errors.push({
      field: 'generatedAt',
      message: '生成时间无效或缺失',
      code: 'INVALID_DATE',
      severity: 'error',
    })
  }

  if (!report.sections || report.sections.length === 0) {
    errors.push({
      field: 'sections',
      message: '报告至少需要包含一个章节',
      code: 'NO_SECTIONS',
      severity: 'error',
    })
  } else {
    validateSections(report, errors, warnings)
  }

  if (!report.statistics) {
    warnings.push({
      field: 'statistics',
      message: '缺少统计数据，可能影响报告完整性',
      code: 'MISSING_STATISTICS',
    })
  } else {
    validateStatistics(report.statistics, errors, warnings)
  }

  if (report.metadata && !report.metadata.checksum) {
    warnings.push({
      field: 'metadata.checksum',
      message: '报告缺少校验和，无法验证数据完整性',
      code: 'MISSING_CHECKSUM',
    })
  }

  const errorScore = Math.max(0, 100 - (errors.length * 20))
  const warningDeduction = warnings.length > 0 ? Math.min(warnings.length * 5, 20) : 0
  const finalScore = Math.max(0, errorScore - warningDeduction)

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: finalScore,
  }
}

function validateSections(
  report: ProfessionalReport,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  const requiredTypes: ReportSectionType[] = ['cover', 'executive-summary', 'formula-details']
  const presentTypes = new Set(report.sections.map(s => s.type))

  requiredTypes.forEach(type => {
    if (!presentTypes.has(type)) {
      errors.push({
        field: `sections.${type}`,
        message: `缺少必需章节：${type}`,
        code: `MISSING_SECTION_${type.toUpperCase()}`,
        severity: 'error',
      })
    }
  })

  const orderSet = new Set<number>()
  report.sections.forEach((section, index) => {
    if (orderSet.has(section.order)) {
      warnings.push({
        field: `sections[${index}].order`,
        message: `章节顺序号重复：${section.order}`,
        code: 'DUPLICATE_ORDER',
      })
    }
    orderSet.add(section.order)

    if (!section.content) {
      errors.push({
        field: `sections[${index}].content`,
        message: `章节 "${section.title}" 内容为空`,
        code: 'EMPTY_SECTION_CONTENT',
        severity: 'error',
      })
    }

    if (section.content?.error) {
      errors.push({
        field: `sections[${index}].content`,
        message: `章节 "${section.title}" 渲染错误：${section.content.details || '未知错误'}`,
        code: 'SECTION_RENDER_ERROR',
        severity: 'error',
      })
    }
  })

  if (report.sections.some(s => s.order < 1)) {
    warnings.push({
      field: 'sections',
      message: '存在无效的章节序号（应从1开始）',
      code: 'INVALID_ORDER_RANGE',
    })
  }
}

function validateStatistics(
  statistics: ReportStatistics,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  if (typeof statistics.totalIngredients !== 'number' || statistics.totalIngredients < 0) {
    errors.push({
      field: 'statistics.totalIngredients',
      message: '成分总数必须为非负数',
      code: 'INVALID_INGREDIENT_COUNT',
      severity: 'error',
    })
  }

  if (statistics.totalIngredients === 0) {
    warnings.push({
      field: 'statistics.totalIngredients',
      message: '成分数量为0，可能表示数据不完整',
      code: 'ZERO_INGREDIENTS',
    })
  }

  if (statistics.averagePercentage !== undefined &&
      (statistics.averagePercentage < 0 || statistics.averagePercentage > 100)) {
    warnings.push({
      field: 'statistics.averagePercentage',
      message: '平均百分比超出合理范围（0-100）',
      code: 'UNUSUAL_AVERAGE_PERCENTAGE',
    })
  }

  if (statistics.synergyScore !== undefined &&
      (statistics.synergyScore < 0 || statistics.synergyScore > 100)) {
    errors.push({
      field: 'statistics.synergyScore',
      message: '协同效应分数必须在0-100范围内',
      code: 'INVALID_SYNERGY_SCORE',
      severity: 'error',
    })
  }
}

export function createCustomTemplate(config: Partial<ReportTemplate>): ReportTemplate {
  const defaultTemplate = getDefaultTemplate()
  const now = new Date()

  return {
    id: config.id || generateReportId().replace('RPT-', 'TPL-'),
    name: config.name || defaultTemplate.name,
    version: config.version || '1.0.0',
    sections: config.sections || defaultTemplate.sections,
    metadata: {
      author: config.metadata?.author || defaultTemplate.metadata.author,
      organization: config.metadata?.organization || defaultTemplate.metadata.organization,
      logoUrl: config.metadata?.logoUrl || defaultTemplate.metadata.logoUrl,
      defaultExportFormat: config.metadata?.defaultExportFormat || defaultTemplate.metadata.defaultExportFormat,
      createdAt: config.metadata?.createdAt || now,
      updatedAt: config.metadata?.updatedAt || now,
    },
  }
}

export function exportReportToJSON(report: ProfessionalReport): string {
  return JSON.stringify(report, null, 2)
}

export function parseReportFromJSON(jsonString: string): ProfessionalReport | null {
  try {
    const data = JSON.parse(jsonString)

    if (!data.id || !data.title || !data.sections) {
      throw new Error('Invalid report format')
    }

    data.generatedAt = new Date(data.generatedAt)
    data.sections.forEach((section: SectionContent) => {
      section.renderedAt = new Date(section.renderedAt)
    })

    return data as ProfessionalReport
  } catch (error) {
    logger.error('Failed to parse report JSON:', error)
    return null
  }
}

export function getSectionByType(report: ProfessionalReport, type: ReportSectionType): SectionContent | null {
  return report.sections.find(s => s.type === type) || null
}

export function reorderSections(report: ProfessionalReport, newOrder: ReportSectionType[]): ProfessionalReport {
  const reorderedSections: SectionContent[] = []

  newOrder.forEach((type, index) => {
    const section = report.sections.find(s => s.type === type)
    if (section) {
      reorderedSections.push({
        ...section,
        order: index + 1,
      })
    }
  })

  report.sections.forEach(section => {
    if (!newOrder.includes(section.type)) {
      reorderedSections.push(section)
    }
  })

  return {
    ...report,
    sections: reorderedSections.sort((a, b) => a.order - b.order),
  }
}
