/**
 * PromptOptimizer - AI提示词质量优化器
 *
 * 提供完整的提示词分析和优化功能：
 * - 语法检查（实时高亮问题）
 * - 结构分析（四要素完整性）
 * - 效果预测（评分模型）
 * - LLM智能优化建议
 * - 一键应用修复
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Sparkles,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  TrendingUp,
  FileText,
  Bug,
  Layout,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { Button, Textarea, Badge, Card, Progress } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

type OptimizationLevel = 'basic' | 'advanced' | 'expert'

interface SyntaxIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  rule_id: string
  message: string
  line_number: number
  snippet: string
  suggestion: string
}

interface StructureSection {
  name: string
  is_present: boolean
  position: number
  quality_score: number
}

interface StructureReport {
  overall_score: number
  sections: Record<string, StructureSection>
  strengths: string[]
  weaknesses: string[]
  structure_type: string
}

interface EffectivenessPrediction {
  score: number
  confidence_interval: [number, number]
  feature_scores: Record<string, number>
  strengths: string[]
  weaknesses: string[]
  improvement_potential: number
}

interface OptimizationSuggestion {
  id: string
  severity: 'critical' | 'major' | 'minor' | 'suggestion'
  category: string
  title: string
  description: string
  location: string
  before: string
  after: string
  impact_estimate: string
  is_auto_fixable: boolean
}

interface OptimizationResult {
  original_content: string
  optimized_content: string | null
  syntax_issues: SyntaxIssue[]
  structure_report: StructureReport | null
  effectiveness_prediction: EffectivenessPrediction | null
  suggestions: OptimizationSuggestion[]
  overall_score_before: number
  overall_score_after: number
  score_improvement: number
  processing_time_ms: number
}

// ===== 常量配置 =====

const LEVEL_CONFIG = {
  basic: {
    label: '基础分析',
    description: '语法检查 + 结构评估',
    color: 'blue',
  },
  advanced: {
    label: '深度优化',
    description: '全部分析 + LLM建议',
    color: 'purple',
  },
  expert: {
    label: '专家级',
    description: '完整优化 + 自动改写',
    color: 'orange',
  },
} as const

// ===== 主组件 =====

interface PromptOptimizerProps {
  initialContent?: string
  onOptimizeComplete?: (result: OptimizationResult) => void
  className?: string
}

export function PromptOptimizer({
  initialContent = '',
  onOptimizeComplete,
  className = '',
}: PromptOptimizerProps) {
  const [content, setContent] = useState(initialContent)
  const [level, setLevel] = useState<OptimizationLevel>('advanced')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<OptimizationResult | null>(null)
  const [activeTab, setActiveTab] = useState<'issues' | 'structure' | 'effectiveness' | 'suggestions'>('issues')
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null)
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set())
  const [showOptimizedVersion, setShowOptimizedVersion] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (initialContent && !result) {
      handleAnalyze()
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!content.trim()) return

    setIsAnalyzing(true)
    setResult(null)
    setAppliedFixes(new Set())

    try {
      const response = await fetch('/api/v1/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_content: content,
          optimization_level: level,
          goals: [],
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data: OptimizationResult = await response.json()
      setResult(data)

      onOptimizeComplete?.(data)

      logger.info('Optimization completed', {
        score_before: data.overall_score_before,
        score_after: data.overall_score_after,
        improvement: data.score_improvement,
      })
    } catch (err: unknown) {
      logger.error('Optimization failed:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [content, level, onOptimizeComplete])

  const handleApplyFix = useCallback(
    (suggestion: OptimizationSuggestion) => {
      if (!suggestion.is_auto_fixable || !suggestion.before || !suggestion.after) return

      setContent((prev) => prev.replace(suggestion.before, suggestion.after))
      setAppliedFixes((prev) => new Set(prev).add(suggestion.id))
    },
    [],
  )

  const handleApplyAllAutoFixes = useCallback(() => {
    if (!result) return

    let updatedContent = content
    const newlyApplied = new Set(appliedFixes)

    result.suggestions.forEach((suggestion) => {
      if (
        suggestion.is_auto_fixable &&
        suggestion.before &&
        suggestion.after &&
        !appliedFixes.has(suggestion.id)
      ) {
        if (updatedContent.includes(suggestion.before)) {
          updatedContent = updatedContent.replace(suggestion.before, suggestion.after)
          newlyApplied.add(suggestion.id)
        }
      }
    })

    setContent(updatedContent)
    setAppliedFixes(newlyApplied)
  }, [result, content, appliedFixes])

  const handleCopyOptimized = useCallback(async () => {
    const textToCopy = showOptimizedVersion && result?.optimized_content
      ? result.optimized_content
      : content

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Copy failed:', err)
    }
  }, [content, result, showOptimizedVersion])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
      case 'critical':
        return <XCircle size={16} className="text-error-600" />
      case 'warning':
      case 'major':
        return <AlertTriangle size={16} className="text-yellow-600" />
      default:
        return <Info size={16} className="text-secondary-600" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-error-600'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 输入区域 */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText size={16} />
              待优化的提示词
            </h3>

            <div className="flex items-center gap-2">
              {(Object.keys(LEVEL_CONFIG) as OptimizationLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    level === lvl
                      ? `bg-${LEVEL_CONFIG[lvl].color}-100 text-${LEVEL_CONFIG[lvl].color}-700 border border-${LEVEL_CONFIG[lvl].color}-300`
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {LEVEL_CONFIG[lvl].label}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此粘贴或输入需要优化的提示词..."
            rows={8}
            className="font-mono text-sm"
            disabled={isAnalyzing}
          />

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-neutral-500">
              字符数: {content.length} · 建议长度: 200-1500字符
            </p>

            <Button onClick={handleAnalyze} disabled={!content.trim() || isAnalyzing} variant="primary" size="sm">
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-1" />
                  分析中...
                </>
              ) : (
                <>
                  <Wrench size={16} className="mr-1" />
                  开始优化
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* 分析结果区域 */}
      {result && (
        <Card className="p-4">
          {/* 总览卡片 */}
          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-1">原始分数</p>
              <p className={`text-2xl font-bold ${getScoreColor(result.overall_score_before)}`}>
                {result.overall_score_before.toFixed(0)}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-1">优化后预估</p>
              <p className={`text-2xl font-bold ${getScoreColor(result.overall_score_after)}`}>
                {result.overall_score_after.toFixed(0)}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-1">提升幅度</p>
              <p className="text-2xl font-bold text-success-600 flex items-center justify-center gap-1">
                <TrendingUp size={18} />
                +{result.score_improvement.toFixed(0)}
              </p>
            </div>
          </div>

          {/* 标签页切换 */}
          <div className="flex items-center gap-2 border-b mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
                activeTab === 'issues'
                  ? 'bg-white dark:bg-neutral-800 border-b-2 border-blue-600 text-secondary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Bug size={14} className="inline mr-1" />
              问题 ({result.syntax_issues.length})
            </button>

            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
                activeTab === 'structure'
                  ? 'bg-white dark:bg-neutral-800 border-b-2 border-blue-600 text-secondary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Layout size={14} className="inline mr-1" />
              结构 ({result.structure_report?.overall_score.toFixed(0) || '-'})
            </button>

            <button
              onClick={() => setActiveTab('effectiveness')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
                activeTab === 'effectiveness'
                  ? 'bg-white dark:bg-neutral-800 border-b-2 border-blue-600 text-secondary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <BarChart3 size={14} className="inline mr-1" />
              效果预测 ({result.effectiveness_prediction?.score.toFixed(0) || '-'})
            </button>

            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
                activeTab === 'suggestions'
                  ? 'bg-white dark:bg-neutral-800 border-b-2 border-blue-600 text-secondary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Sparkles size={14} className="inline mr-1" />
              建议 ({result.suggestions.length})
            </button>
          </div>

          {/* 标签内容 */}
          <div className="min-h-[300px]">
            {/* 问题列表 */}
            {activeTab === 'issues' && (
              <div className="space-y-2">
                {result.syntax_issues.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    <CheckCircle2 size={48} className="mx-auto mb-2 text-success-500" />
                    <p>未发现语法问题 ✓</p>
                  </div>
                ) : (
                  result.syntax_issues.map((issue, index) => (
                    <div
                      key={`${issue.rule_id}-${index}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIssueIndex === index
                          ? 'bg-secondary-50 border-blue-300 dark:bg-secondary-900/20'
                          : 'bg-slate-50 hover:bg-neutral-100 border-transparent'
                      }`}
                      onClick={() =>
                        setSelectedIssueIndex(selectedIssueIndex === index ? null : index)
                      }
                    >
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {issue.message}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                            第{issue.line_number}行: {issue.snippet}
                          </p>
                          {selectedIssueIndex === index && issue.suggestion && (
                            <p className="text-xs text-secondary-600 mt-2 p-2 bg-secondary-50 rounded">
                              💡 {issue.suggestion}
                            </p>
                          )}
                        </div>
                        <Badge variant={
                          issue.severity === 'error' ? 'danger' :
                          issue.severity === 'warning' ? 'warning' : 'info'
                        }>
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 结构分析 */}
            {activeTab === 'structure' && result.structure_report && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">结构类型</p>
                    <p className="text-lg font-semibold capitalize">
                      {result.structure_report.structure_type.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">总体得分</p>
                    <p className={`text-lg font-semibold ${getScoreColor(result.structure_report.overall_score)}`}>
                      {result.structure_report.overall_score.toFixed(0)}/100
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(result.structure_report.sections).map(([name, section]) => (
                    <div key={name} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm font-medium">{name}</span>
                      <div className="flex items-center gap-2">
                        {section.is_present ? (
                          <CheckCircle2 size={16} className="text-success-600" />
                        ) : (
                          <XCircle size={16} className="text-error-600" />
                        )}
                        <span className="text-sm text-neutral-600">
                          {section.is_present ? `${(section.quality_score * 100).toFixed(0)}%` : '缺失'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-success-700 mb-2">✅ 优势</p>
                    <ul className="space-y-1">
                      {result.structure_report.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-neutral-600 pl-2">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-error-700 mb-2">⚠️ 不足</p>
                    <ul className="space-y-1">
                      {result.structure_report.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-neutral-600 pl-2">• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 效果预测 */}
            {activeTab === 'effectiveness' && result.effectiveness_prediction && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg text-center">
                  <p className="text-xs text-neutral-500 mb-1">综合效果评分</p>
                  <p className={`text-4xl font-bold ${getScoreColor(result.effectiveness_prediction.score)}`}>
                    {result.effectiveness_prediction.score.toFixed(0)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    置信区间: [{result.effectiveness_prediction.confidence_interval[0]},{' '}
                    {result.effectiveness_prediction.confidence_interval[1]}]
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-neutral-700 mb-2">特征得分详情</p>
                  <div className="space-y-2">
                    {Object.entries(result.effectiveness_prediction.feature_scores).map(([feature, score]) => (
                      <div key={feature}>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{feature.replace(/_/g, ' ')}</span>
                          <span>{(score * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={score * 100} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-success-700 mb-1">✨ 优势特征</p>
                    <ul className="space-y-0.5">
                      {result.effectiveness_prediction.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-neutral-600">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-orange-700 mb-1">⚡ 提升空间</p>
                    <ul className="space-y-0.5">
                      {result.effectiveness_prediction.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-neutral-600">• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 优化建议 */}
            {activeTab === 'suggestions' && (
              <div className="space-y-3">
                {result.suggestions.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    <Sparkles size={48} className="mx-auto mb-2 text-neutral-400" />
                    <p>暂无优化建议，您的提示词已经很棒了！</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-neutral-600">
                        可自动修复: {result.suggestions.filter((s) => s.is_auto_fixable).length}项
                      </p>
                      <Button
                        onClick={handleApplyAllAutoFixes}
                        variant="secondary"
                        size="sm"
                        disabled={appliedFixes.size === result.suggestions.filter((s) => s.is_auto_fixable).length}
                      >
                        <RefreshCw size={14} className="mr-1" />
                        应用所有修复
                      </Button>
                    </div>

                    {result.suggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className={`p-3 rounded-lg border ${
                          appliedFixes.has(suggestion.id)
                            ? 'bg-success-50 border-green-200'
                            : 'bg-slate-50 border-neutral-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getSeverityIcon(suggestion.severity)}
                              <p className="text-sm font-semibold text-neutral-900">
                                {suggestion.title}
                              </p>
                              {appliedFixes.has(suggestion.id) && (
                                <Badge variant="success" size="sm">已修复</Badge>
                              )}
                            </div>
                            <p className="text-xs text-neutral-600 mb-2">{suggestion.description}</p>

                            {suggestion.before && suggestion.after && (
                              <div className="text-xs space-y-1">
                                <div className="p-2 bg-error-50 rounded font-mono line-clamp-2">
                                  <span className="text-error-600 font-bold">-</span> {suggestion.before}
                                </div>
                                <ChevronRight size={14} className="mx-auto text-neutral-400" />
                                <div className="p-2 bg-success-50 rounded font-mono line-clamp-2">
                                  <span className="text-success-600 font-bold">+</span> {suggestion.after}
                                </div>
                              </div>
                            )}

                            {suggestion.impact_estimate && (
                              <p className="text-xs text-secondary-600 mt-2">
                                📈 预期提升: {suggestion.impact_estimate}
                              </p>
                            )}
                          </div>

                          {suggestion.is_auto_fixable && !appliedFixes.has(suggestion.id) && (
                            <Button
                              onClick={() => handleApplyFix(suggestion)}
                              variant="outline"
                              size="sm"
                            >
                              应用
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 优化后版本切换 */}
          {result.optimized_content && level === 'expert' && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOptimizedVersion}
                    onChange={(e) => setShowOptimizedVersion(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-neutral-900">
                    查看LLM优化后的完整版本
                  </span>
                </label>

                <Button onClick={handleCopyOptimized} variant="outline" size="sm">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>

              {showOptimizedVersion && (
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg max-h-[400px] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {result.optimized_content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default PromptOptimizer
