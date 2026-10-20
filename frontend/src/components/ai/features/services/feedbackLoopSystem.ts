/**
 * 建议质量评估反馈闭环系统 V4.0
 *
 * 核心特性：
 * - 多维度质量评分（相关性、新颖性、可操作性、证据强度）
 * - 用户行为追踪与分析（点击、采纳、忽略、修改）
 * - A/B测试框架支持
 * - 自动化模型迭代优化
 */

import { logger } from '@/utils/safeLogger'
import { type ExpertSuggestionV2 } from '../services/professionalIntelligenceEngine'

export interface FeedbackRecord {
  id: string
  suggestionId: string
  action: 'impression' | 'click' | 'adopt' | 'dismiss' | 'modify' | 'report'
  timestamp: number
  context: {
    inputText: string
    position: number
    visibleSuggestions: number
  }
  metadata: {
    sessionDuration: number
    deviceType: string
    userAgent: string
    reportReason?: string
  }
}

export interface QualityScore {
  overallScore: number
  relevanceScore: number
  noveltyScore: number
  actionabilityScore: number
  evidenceStrength: number
  userSatisfactionPredicted: number
  breakdown: {
    terminologyPrecision: number
    domainCoverage: number
    solutionCompleteness: number
    riskAwareness: number
    referenceQuality: number
  }
}

// ============ 用户行为追踪器 ============

export class FeedbackTracker {
  private feedbackRecords: Map<string, FeedbackRecord[]>
  private sessionStats: {
    totalImpressions: number
    totalClicks: number
    totalAdoptions: number
    totalDismissals: number
    averageDwellTime: number
  }
  private maxRecordsPerSession: number

  constructor(maxRecordsPerSession = 1000) {
    this.feedbackRecords = new Map()
    this.sessionStats = {
      totalImpressions: 0,
      totalClicks: 0,
      totalAdoptions: 0,
      totalDismissals: 0,
      averageDwellTime: 0,
    }
    this.maxRecordsPerSession = maxRecordsPerSession

    this.initializeFromStorage()
  }

  recordImpression(suggestionId: string, inputText: string, position: number, visibleCount: number): void {
    this.sessionStats.totalImpressions++

    this.addRecord(suggestionId, 'click', { // impression作为弱点击信号
      inputText,
      position,
      visibleSuggestions: visibleCount,
    })
  }

  recordClick(suggestionId: string, inputText: string, position: number, visibleCount: number): void {
    this.sessionStats.totalClicks++

    this.addRecord(suggestionId, 'click', {
      inputText,
      position,
      visibleSuggestions: visibleCount,
    })
  }

  recordAdoption(suggestionId: string, inputText: string, position: number): void {
    this.sessionStats.totalAdoptions++

    this.addRecord(suggestionId, 'adopt', {
      inputText,
      position,
      visibleSuggestions: 0,
    })
  }

  recordDismissal(suggestionId: string, inputText: string, position: number, visibleCount: number): void {
    this.sessionStats.totalDismissals++

    this.addRecord(suggestionId, 'dismiss', {
      inputText,
      position,
      visibleSuggestions: visibleCount,
    })
  }

  recordModification(suggestionId: string, originalText: string, _modifiedText: string): void {
    void _modifiedText;
    this.addRecord(suggestionId, 'modify', {
      inputText: originalText,
      position: 0,
      visibleSuggestions: 0,
    })
  }

  recordReport(suggestionId: string, inputText: string, reason: string): void {
    const record = this.addRecord(suggestionId, 'report', {
      inputText,
      position: 0,
      visibleSuggestions: 0,
    })

    if (record) {
      record.metadata.reportReason = reason;
    }
  }

  getFeedbackForSuggestion(suggestionId: string): FeedbackRecord[] {
    return this.feedbackRecords.get(suggestionId) || []
  }

  getSessionStats() {
    return { ...this.sessionStats }
  }

  calculateCTR(): number {
    return this.sessionStats.totalImpressions > 0
      ? this.sessionStats.totalClicks / this.sessionStats.totalImpressions
      : 0
  }

  calculateAdoptionRate(): number {
    return this.sessionStats.totalClicks > 0
      ? this.sessionStats.totalAdoptions / this.sessionStats.totalClicks
      : 0
  }

  exportFeedbackData(): FeedbackRecord[] {
    const allRecords: FeedbackRecord[] = []
    this.feedbackRecords.forEach(records => {
      allRecords.push(...records)
    })
    return allRecords.sort((a, b) => b.timestamp - a.timestamp)
  }

  clearSessionData(): void {
    this.feedbackRecords.clear()
    this.sessionStats = {
      totalImpressions: 0,
      totalClicks: 0,
      totalAdoptions: 0,
      totalDismissals: 0,
      averageDwellTime: 0,
    }
  }

  private addRecord(
    suggestionId: string,
    action: FeedbackRecord['action'],
    context: FeedbackRecord['context'],
  ): FeedbackRecord | null {
    if (this.getTotalRecordCount() >= this.maxRecordsPerSession) {
      logger.warn('[FeedbackTracker] 达到最大记录数限制，丢弃新记录')
      return null
    }

    const record: FeedbackRecord = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      suggestionId,
      action,
      timestamp: Date.now(),
      context,
      metadata: {
        sessionDuration: window.performance.now(),
        deviceType: this.detectDeviceType(),
        userAgent: navigator.userAgent.substring(0, 100),
      },
    }

    const existing = this.feedbackRecords.get(suggestionId) || []
    existing.push(record)
    this.feedbackRecords.set(suggestionId, existing)

    return record
  }

  private getTotalRecordCount(): number {
    let count = 0
    this.feedbackRecords.forEach(records => {
      count += records.length
    })
    return count
  }

  private detectDeviceType(): string {
    const ua = navigator.userAgent
    if (/Mobile|Android|iPhone/i.test(ua)) return 'mobile'
    if (/Tablet|iPad/i.test(ua)) return 'tablet'
    return 'desktop'
  }

  private initializeFromStorage(): void {
    try {
      const stored = localStorage.getItem('pie_v4_feedback_session')
      if (stored) {
        const data = JSON.parse(stored)
        this.sessionStats = data.stats || this.sessionStats
      }
    } catch (error) {
      logger.warn('[FeedbackTracker] 初始化失败:', error)
    }
  }
}

// ============ 质量评分引擎 ============

export class QualityScorer {
  private feedbackTracker: FeedbackTracker
  private weights: {
    relevance: number
    novelty: number
    actionability: number
    evidenceStrength: number
    userSatisfaction: number
  }

  constructor(feedbackTracker: FeedbackTracker) {
    this.feedbackTracker = feedbackTracker

    this.weights = {
      relevance: 0.30,       // 相关性权重最高
      novelty: 0.15,         // 新颖性
      actionability: 0.25,   // 可操作性
      evidenceStrength: 0.20, // 证据强度
      userSatisfaction: 0.10,  // 用户满意度预测
    }
  }

  calculateQualityScore(
    suggestion: ExpertSuggestionV2,
    userInput: string,
    recognizedTerms: string[],
  ): QualityScore {
    const relevanceScore = this.calculateRelevanceScore(suggestion, userInput, recognizedTerms)
    const noveltyScore = this.calculateNoveltyScore(suggestion, userInput)
    const actionabilityScore = this.calculateActionabilityScore(suggestion)
    const evidenceStrength = this.calculateEvidenceStrength(suggestion)
    const userSatisfactionPredicted = this.predictUserSatisfaction(suggestion.id)

    const overallScore =
      relevanceScore * this.weights.relevance +
      noveltyScore * this.weights.novelty +
      actionabilityScore * this.weights.actionability +
      evidenceStrength * this.weights.evidenceStrength +
      userSatisfactionPredicted * this.weights.userSatisfaction

    return {
      overallScore: Math.round(overallScore),
      relevanceScore: Math.round(relevanceScore),
      noveltyScore: Math.round(noveltyScore),
      actionabilityScore: Math.round(actionabilityScore),
      evidenceStrength: Math.round(evidenceStrength),
      userSatisfactionPredicted: Math.round(userSatisfactionPredicted * 100),
      breakdown: {
        terminologyPrecision: this.evaluateTerminologyPrecision(suggestion, recognizedTerms),
        domainCoverage: this.evaluateDomainCoverage(suggestion, recognizedTerms),
        solutionCompleteness: this.evaluateSolutionCompleteness(suggestion),
        riskAwareness: this.evaluateRiskAwareness(suggestion),
        referenceQuality: this.evaluateReferenceQuality(suggestion),
      },
    }
  }

  private calculateRelevanceScore(
    suggestion: ExpertSuggestionV2,
    userInput: string,
    recognizedTerms: string[],
  ): number {
    let score = 50 // 基础分

    // 标题匹配度
    const titleLower = suggestion.title.toLowerCase()
    const inputLower = userInput.toLowerCase()

    recognizedTerms.forEach(term => {
      if (titleLower.includes(term.toLowerCase())) score += 10
      if (inputLower.includes(term.toLowerCase())) score += 5
    })

    // 领域匹配
    if (suggestion.metadata.domain && recognizedTerms.length > 0) {
      score += 15
    }

    return Math.min(score, 100)
  }

  private calculateNoveltyScore(suggestion: ExpertSuggestionV2, _userInput: string): number {
    void _userInput;
    const feedbackRecords = this.feedbackTracker.getFeedbackForSuggestion(suggestion.id)

    if (feedbackRecords.length === 0) return 80 // 新建议默认高分

    const recentAdoptions = feedbackRecords.filter(r =>
      r.action === 'adopt' &&
      Date.now() - r.timestamp < 7 * 24 * 60 * 60 * 1000, // 最近7天
    ).length

    if (recentAdoptions > 10) return 40 // 过度使用降分
    if (recentAdoptions > 5) return 60
    return 75
  }

  private calculateActionabilityScore(suggestion: ExpertSuggestionV2): number {
    if (!suggestion.content.actionableSteps || suggestion.content.actionableSteps.length === 0) {
      return 20
    }

    let score = 40

    suggestion.content.actionableSteps.forEach(step => {
      if (step.action && step.rationale && step.expectedOutcome) score += 10
      if (step.resources && step.resources.length > 0) score += 5
      if (step.timeEstimate) score += 3
    })

    return Math.min(score, 100)
  }

  private calculateEvidenceStrength(suggestion: ExpertSuggestionV2): number {
    if (!suggestion.content.references || suggestion.content.references.length === 0) {
      return 30
    }

    let score = 30

    suggestion.content.references.forEach(ref => {
      switch (ref.type) {
        case 'clinical_trial':
          score += 20
          break
        case 'meta_analysis':
          score += 18
          break
        case 'guideline':
          score += 15
          break
        case 'industry_report':
          score += 10
          break
        case 'patent':
          score += 8
          break
      }

      if (ref.year && ref.year >= 2020) score += 5 // 近年文献加分
      if (ref.doi) score += 3 // 有DOI加分
    })

    return Math.min(score, 100)
  }

  private predictUserSatisfaction(suggestionId: string): number {
    const records = this.feedbackTracker.getFeedbackForSuggestion(suggestionId)

    if (records.length === 0) return 0.7 // 默认70%满意度预测

    const adoptions = records.filter(r => r.action === 'adopt').length
    const clicks = records.filter(r => r.action === 'click').length
    const dismissals = records.filter(r => r.action === 'dismiss').length

    const totalInteractions = adoptions + clicks + dismissals
    if (totalInteractions === 0) return 0.7

    const satisfactionRate = (adoptions * 1.0 + clicks * 0.6 - dismissals * 0.3) / totalInteractions
    return Math.max(0, Math.min(1, satisfactionRate))
  }

  private evaluateTerminologyPrecision(suggestion: ExpertSuggestionV2, recognizedTerms: string[]): number {
    const titleTerms = suggestion.title.match(/[\u4e00-\u9fa5]{2,}/g) || []
    const matchedTerms = titleTerms.filter(term =>
      recognizedTerms.some(rt => term.includes(rt) || rt.includes(term)),
    )

    return recognizedTerms.length > 0
      ? (matchedTerms.length / recognizedTerms.length) * 100
      : 50
  }

  private evaluateDomainCoverage(suggestion: ExpertSuggestionV2, recognizedTerms: string[]): number {
    const domains = new Set(recognizedTerms.map(t => {
      // 简化的域名映射
      if (['黄芪', '复合多肽', '人参'].includes(t)) return 'functional_ingredients'
      if (['降三高', '免疫调节'].includes(t)) return 'health_claims'
      if (['固体饮料'].includes(t)) return 'product_forms'
      return 'general'
    }))

    return domains.has(suggestion.metadata.domain as 'functional_ingredients' | 'health_claims' | 'product_forms' | 'general') ? 90 : 60
  }

  private evaluateSolutionCompleteness(suggestion: ExpertSuggestionV2): number {
    const requiredSections = [
      suggestion.content.executiveSummary,
      suggestion.content.detailedAnalysis?.length > 0,
      suggestion.content.actionableSteps?.length > 0,
      suggestion.content.technicalSpecifications?.length > 0,
      suggestion.content.riskAssessment?.length > 0,
      suggestion.content.references?.length > 0,
    ]

    const completedSections = requiredSections.filter(Boolean).length
    return (completedSections / requiredSections.length) * 100
  }

  private evaluateRiskAwareness(suggestion: ExpertSuggestionV2): number {
    if (!suggestion.content.riskAssessment || suggestion.content.riskAssessment.length === 0) {
      return 20
    }

    let score = 40
    suggestion.content.riskAssessment.forEach(risk => {
      if (risk.mitigation && risk.monitoring) score += 20
      if (risk.probability !== undefined && risk.impact !== undefined) score += 10
    })

    return Math.min(score, 100)
  }

  private evaluateReferenceQuality(suggestion: ExpertSuggestionV2): number {
    if (!suggestion.content.references || suggestion.content.references.length === 0) {
      return 0
    }

    const highQualityTypes = ['clinical_trial', 'meta_analysis', 'guideline']
    const highQualityCount = suggestion.content.references.filter(ref =>
      highQualityTypes.includes(ref.type),
    ).length

    return (highQualityCount / suggestion.content.references.length) * 100
  }

  updateWeights(newWeights: Partial<typeof this.weights>): void {
    Object.assign(this.weights, newWeights)
  }
}

// ============ A/B测试管理器 ============

export interface ABTestVariant {
  id: string
  name: string
  description: string
  config: Record<string, any>
  trafficAllocation: number // 0-1 (占比)
}

export interface ABTestExperiment {
  id: string
  name: string
  hypothesis: string
  startDate: string
  endDate?: string
  status: 'draft' | 'running' | 'completed' | 'paused'
  variants: ABTestVariant[]
  primaryMetric: string
  secondaryMetrics: string[]
  targetSampleSize: number
  currentSampleSize: number
  results?: {
    variantId: string
    metricValue: number
    confidenceInterval: [number, number]
    isWinner: boolean
  }[]
}

export class ABTestManager {
  private experiments: Map<string, ABTestExperiment>
  private userAssignments: Map<string, string> // userId → variantId

  constructor() {
    this.experiments = new Map()
    this.userAssignments = new Map()

    this.loadFromStorage()
  }

  createExperiment(config: {
    name: string
    hypothesis: string
    variants: { name: string; description: string; config: Record<string, any>; trafficAllocation?: number }[]
    primaryMetric: string
    secondaryMetrics?: string[]
    targetSampleSize?: number
  }): ABTestExperiment {
    const experiment: ABTestExperiment = {
      id: `ab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: config.name,
      hypothesis: config.hypothesis,
      startDate: new Date().toISOString(),
      status: 'draft',
      variants: config.variants.map((v, index) => ({
        id: `variant-${index}`,
        name: v.name,
        description: v.description,
        config: v.config,
        trafficAllocation: v.trafficAllocation || (1 / config.variants.length),
      })),
      primaryMetric: config.primaryMetric,
      secondaryMetrics: config.secondaryMetrics || [],
      targetSampleSize: config.targetSampleSize || 1000,
      currentSampleSize: 0,
    }

    this.experiments.set(experiment.id, experiment)
    this.saveToStorage()

    return experiment
  }

  startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId)
    if (experiment?.status !== 'draft') return false

    experiment.status = 'running'
    this.saveToStorage()

    logger.log(`[ABTestManager] 🧪 实验 "${experiment.name}" 已启动`)
    return true
  }

  assignVariant(experimentId: string, userId?: string): ABTestVariant | null {
    const experiment = this.experiments.get(experimentId)
    if (experiment?.status !== 'running') return null

    // 检查是否已有分配
    const cacheKey = `${experimentId}_${userId || 'anonymous'}`
    const cachedAssignment = this.userAssignments.get(cacheKey)
    if (cachedAssignment) {
      return experiment.variants.find(v => v.id === cachedAssignment) || null
    }

    // 基于流量分配随机选择
    const random = Math.random()
    let cumulative = 0
    for (const variant of experiment.variants) {
      cumulative += variant.trafficAllocation
      if (random <= cumulative) {
        this.userAssignments.set(cacheKey, variant.id)
        experiment.currentSampleSize++

        logger.log(`[ABTestManager] 👤 用户分配到变体: ${variant.name} (${(variant.trafficAllocation * 100).toFixed(1)}%)`)
        return variant
      }
    }

    return experiment.variants[experiment.variants.length - 1] || null
  }

  recordMetric(experimentId: string, variantId: string, _metricName: string, value: number): void {
    const experiment = this.experiments.get(experimentId)
    if (!experiment) return

    if (!experiment.results) {
      experiment.results = []
    }

    let result = experiment.results.find(r => r.variantId === variantId)
    if (!result) {
      result = {
        variantId,
        metricValue: 0,
        confidenceInterval: [0, 0],
        isWinner: false,
      }
      experiment.results.push(result)
    }

    // 简化的增量更新（实际应使用统计库）
    result.metricValue = (result.metricValue * (experiment.currentSampleSize - 1) + value) / experiment.currentSampleSize

    this.checkExperimentCompletion(experiment)
    this.saveToStorage()
  }

  getExperimentResults(experimentId: string): ABTestExperiment | null {
    return this.experiments.get(experimentId) || null
  }

  getAllExperiments(): ABTestExperiment[] {
    return Array.from(this.experiments.values())
  }

  private checkExperimentCompletion(experiment: ABTestExperiment): void {
    if (experiment.currentSampleSize >= experiment.targetSampleSize) {
      experiment.status = 'completed'

      if (experiment.results) {
        const sortedResults = [...experiment.results].sort((a, b) => b.metricValue - a.metricValue)
        if (sortedResults.length > 0) {
          sortedResults[0].isWinner = true
        }
      }

      logger.log(`[ABTestManager] ✅ 实验 "${experiment.name}" 已完成!`)
      logger.log(`[ABTestManager] 结果:`, experiment.results?.map(r => ({
        变体: r.variantId,
        指标值: r.metricValue.toFixed(4),
        是否获胜: r.isWinner,
      })))
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        experiments: Array.from(this.experiments.entries()),
        assignments: Array.from(this.userAssignments.entries()),
      }
      localStorage.setItem('pie_v4_abtests', JSON.stringify(data))
    } catch (error) {
      logger.warn('[ABTestManager] 保存失败:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('pie_v4_abtests')
      if (stored) {
        const data = JSON.parse(stored)
        this.experiments = new Map(data.experiments)
        this.userAssignments = new Map(data.assignments)
      }
    } catch (error) {
      logger.warn('[ABTestManager] 加载失败:', error)
    }
  }
}

// ============ 导出实例工厂 ============

export function createFeedbackSystem() {
  const tracker = new FeedbackTracker()
  const scorer = new QualityScorer(tracker)
  const abTestManager = new ABTestManager()

  return {
    tracker,
    scorer,
    abTestManager,
  }
}
