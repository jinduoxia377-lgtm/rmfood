/**
 * ProfessionalReport.tsx - 专业报告预览与导出组件
 *
 * 功能：
 * - 7章节专业报告预览（封面、摘要、配方、成分、协同、建议、附录）
 * - 左侧目录导航 + 右侧内容区域
 * - PDF/Word/Excel多格式导出
 * - 编辑模式支持
 * - 深色模式 + 打印优化
 */

import { logger } from '@/utils/safeLogger'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  X, FileText, FileSpreadsheet, Printer,
  Edit3, Check, Loader2, AlertCircle, ChevronRight,
  BookOpen, BarChart3, FlaskConical, Network, Lightbulb,
  Archive, Target, Star, Users, ClipboardList,
} from 'lucide-react'
import type { ReportSection, ReportSectionType } from '@/types/ai.types'
// 导入枚举值和接口（不仅是类型）
import { ExportFormat } from '@/types/ai.types'
import type { ProfessionalReport as ProfessionalReportType } from '@/types/ai.types'
import { FormulaTable } from './FormulaTable'
import { SynergyRadarChart } from './SynergyRadarChart'

// ==================== Types ====================

interface ProfessionalReportProps {
  report: ProfessionalReportType | null
  isLoading?: boolean
  error?: string | null
  onExport?: (format: ExportFormat) => Promise<void>
  onEdit?: (updates: Partial<ProfessionalReportType>) => void
  onClose?: () => void
  editable?: boolean
}

interface ExportState {
  isExporting: boolean
  format: ExportFormat | null
  progress: number
  error: string | null
}

// ==================== Constants ====================

const SECTION_ICONS: Record<ReportSectionType, React.ReactNode> = {
  'cover': <BookOpen className="w-4 h-4" />,
  'executive-summary': <BarChart3 className="w-4 h-4" />,
  'formula-details': <FlaskConical className="w-4 h-4" />,
  'ingredient-analysis': <Network className="w-4 h-4" />,
  'synergy-assessment': <Network className="w-4 h-4" />,
  'recommendations': <Lightbulb className="w-4 h-4" />,
  'appendix': <Archive className="w-4 h-4" />,
}

const SECTION_TITLES: Record<ReportSectionType, string> = {
  'cover': '封面',
  'executive-summary': '执行摘要',
  'formula-details': '配方详情',
  'ingredient-analysis': '成分分析',
  'synergy-assessment': '协同效果评估',
  'recommendations': '应用建议',
  'appendix': '附录',
}

const EXPORT_FORMAT_CONFIG: Record<ExportFormat, { icon: React.ReactNode; label: string; color: string }> = {
  [ExportFormat.PDF]: { icon: <FileText className="w-4 h-4" />, label: 'PDF', color: 'text-error-600 hover:bg-error-50' },
  [ExportFormat.WORD]: { icon: <FileText className="w-4 h-4" />, label: 'Word', color: 'text-secondary-600 hover:bg-secondary-50' },
  [ExportFormat.EXCEL]: { icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Excel', color: 'text-success-600 hover:bg-success-50' },
  [ExportFormat.CSV]: { icon: <FileSpreadsheet className="w-4 h-4" />, label: 'CSV', color: 'text-accent-600 hover:bg-accent-50' },
  [ExportFormat.JSON]: { icon: <FileText className="w-4 h-4" />, label: 'JSON', color: 'text-warning-600 hover:bg-warning-50' },
}

// ==================== Component ====================

export const ProfessionalReport: React.FC<ProfessionalReportProps> = ({
  report,
  isLoading = false,
  error,
  onExport,
  onEdit,
  onClose,
  editable = false,
}) => {
  // State
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [activeSection, setActiveSection] = useState<ReportSectionType>('cover')
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    format: null,
    progress: 0,
    error: null,
  })

  // Refs
  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Initialize edit title when report changes
  useEffect(() => {
    if (report) {
      setEditTitle(report.title)
    }
  }, [report?.title])

  // ==================== Handlers ====================

  const handleClose = useCallback(() => {
    if (onClose) onClose()
  }, [onClose])

  const handleToggleEdit = useCallback(() => {
    if (!isEditing && report) {
      setEditTitle(report.title)
    }
    setIsEditing(!isEditing)
  }, [isEditing, report])

  const handleSaveTitle = useCallback(() => {
    if (onEdit && report && editTitle.trim()) {
      onEdit({ ...report, title: editTitle.trim() })
    }
    setIsEditing(false)
  }, [onEdit, report, editTitle])

  const handleScrollToSection = useCallback((sectionType: ReportSectionType) => {
    setActiveSection(sectionType)
    const element = sectionRefs.current[sectionType]
    if (element && contentRef.current) {
      const container = contentRef.current
      const offsetTop = element.offsetTop - container.offsetTop
      container.scrollTo({ top: offsetTop - 20, behavior: 'smooth' })
    }
  }, [])

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!onExport || exportState.isExporting) return

    setExportState({
      isExporting: true,
      format,
      progress: 0,
      error: null,
    })

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 20, 90),
        }))
      }, 200)

      await onExport(format)

      clearInterval(progressInterval)
      setExportState({
        isExporting: false,
        format: null,
        progress: 100,
        error: null,
      })

      // Reset success state after 3 seconds
      setTimeout(() => {
        setExportState(prev => ({ ...prev, progress: 0 }))
      }, 3000)
    } catch (err) {
      setExportState({
        isExporting: false,
        format: null,
        progress: 0,
        error: err instanceof Error ? err.message : '导出失败',
      })
    }
  }, [onExport, exportState.isExporting])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ==================== Computed Values ====================

  const sortedSections = useMemo(() => {
    if (!report?.sections) return []
    return [...report.sections].sort((a, b) => a.order - b.order)
  }, [report?.sections])

  // ==================== Render Helpers ====================

  const renderSectionContent = (section: ReportSection) => {
    switch (section.type) {
      case 'cover':
        return renderCoverPage()
      case 'executive-summary':
        return renderExecutiveSummary(section)
      case 'formula-details':
        return renderFormulaDetails(section)
      case 'ingredient-analysis':
        return renderIngredientAnalysis(section)
      case 'synergy-assessment':
        return renderSynergyAssessment(section)
      case 'recommendations':
        return renderRecommendations(section)
      case 'appendix':
        return renderAppendix(section)
      default:
        return <div className="p-8 text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未知章节类型</div>
    }
  }

  const renderCoverPage = () => (
    <div className="min-h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-secondary-50 to-accent-100 dark:from-neutral-800 dark:to-neutral-900 rounded-lg p-12">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white">
          {report?.title || 'RMFOOD 专业分析报告'}
        </h1>
        <div className="w-32 h-1 bg-secondary-600 mx-auto rounded"></div>
        <div className="space-y-2 text-neutral-600 dark:text-neutral-300">
          <p className="text-lg">{report?.metadata?.projectName || '配方研发项目'}</p>
          <p>生成时间：{report?.generatedAt ? new Date(report.generatedAt).toLocaleString('zh-CN') : '-'}</p>
          <p>报告版本：{report?.version || '1.0.0'}</p>
          {report?.metadata?.author && <p>编制：{report.metadata.author}</p>}
        </div>
        <div className="pt-8 text-sm text-neutral-500 dark:text-neutral-400">
          莱茵（厦门）分子生物科技有限公司
        </div>
      </div>
    </div>
  )

  const renderExecutiveSummary = (section: ReportSection) => {
    const content = section.content || {}
    const formulaName = content.formulaName || '待补充'
    const ingredientCount = content.ingredientCount ?? 0
    const sources = content.sources || []
    const totalDosage = content.totalDosage ?? 0
    const keyFindings = content.keyFindings || []
    const recommendationScore = content.recommendationScore ?? 85

    if (process.env.NODE_ENV === 'development') {
      logger.log('[ProfessionalReport] 📊 渲染执行摘要', {
        formulaName,
        ingredientCount,
        sourcesCount: sources.length,
        totalDosage,
        hasKeyFindings: keyFindings.length > 0,
      })
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: '配方名称',
              value: formulaName,
              icon: <Lightbulb className="w-6 h-6 text-warning-500" />,
              highlight: true,
            },
            {
              label: '核心发现',
              value: keyFindings.length > 0 ? keyFindings[0] : '基于AI分析的配方优化方案',
              icon: <Target className="w-6 h-6 text-error-500" />,
            },
            {
              label: '推荐指数',
              value: `${recommendationScore}%`,
              icon: <Star className="w-6 h-6 text-warning-500" />,
            },
          ].map((item, idx) => (
            <div key={idx} className={`bg-white dark:bg-neutral-800 p-6 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 ${item.highlight ? 'ring-2 ring-secondary-100 dark:ring-secondary-900/30' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                {item.icon}
                <h4 className="font-semibold text-neutral-700 dark:text-neutral-300">{item.label}</h4>
              </div>
              <p className={`text-neutral-600 dark:text-neutral-400 ${item.highlight ? 'font-medium text-secondary-600 dark:text-secondary-700' : ''}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-secondary-50 dark:bg-neutral-800 p-6 rounded-lg border-l-4 border-secondary-500">
          <h4 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-200">📋 配方概览</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary-600 dark:text-secondary-700">{ingredientCount}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">成分数量</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-success-600 dark:text-success-600">{sources.length}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">来源类型</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent-600 dark:text-accent-700">{totalDosage > 0 ? totalDosage.toFixed(1) : 'N/A'}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">总用量</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-warning-600 dark:text-warning-700">{recommendationScore}%</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">推荐度</p>
            </div>
          </div>

          {sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-secondary-200 dark:border-secondary-800">
              <p className="text-sm text-secondary-800 dark:text-secondary-200">
                <strong>成分来源分布：</strong>{sources.join('、') || '待分析'}
              </p>
            </div>
          )}
        </div>

        {(keyFindings.length > 0 || content.summary) && (
          <div className="bg-gradient-to-r from-success-50 to-success-50 dark:from-neutral-800 dark:to-neutral-800 p-6 rounded-lg border-l-4 border-success-500">
            <h4 className="font-semibold mb-2 text-success-900 dark:text-success-200">✨ 摘要概述</h4>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {content.summary || `本报告针对"${formulaName}"进行了全面分析，包含${ingredientCount}种有效成分。`}
            </p>

            {keyFindings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {keyFindings.map((finding: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-success-800 dark:text-success-200">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-success-500 rounded-full shrink-0"></span>
                    {finding}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderFormulaDetails = (section: ReportSection) => {
    const formulaData = section.content?.formulaData
    const statistics = section.content?.statistics || {}

    if (process.env.NODE_ENV === 'development') {
      logger.log('[ProfessionalReport] 🧪 渲染配方详情', {
        hasFormulaData: !!formulaData,
        formulaName: formulaData?.name,
        ingredientCount: formulaData?.ingredients?.length,
        statistics,
      })
    }

    return (
      <div className="space-y-6">
        {formulaData ? (
          <>
            <div className="bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 p-4 rounded-lg border border-secondary-200 dark:border-secondary-800">
              <h3 className="font-bold text-lg text-secondary-900 dark:text-secondary-200 mb-2 flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                {formulaData.name || '未命名配方'}
              </h3>
              {formulaData.description && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2">{formulaData.description}</p>
              )}
            </div>

            <FormulaTable data={formulaData} isLoading={false} />

            {statistics && Object.keys(statistics).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(statistics).map(([key, value]) => (
                  <div key={key} className="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow text-center border border-neutral-200 dark:border-neutral-700">
                    <p className="text-2xl font-bold text-secondary-600 dark:text-secondary-700">{String(value)}</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{key}</p>
                  </div>
                ))}
              </div>
            )}

            {formulaData.ingredients && formulaData.ingredients.length > 0 && (
              <div className="bg-warning-50 dark:bg-neutral-800 p-4 rounded-lg border-l-4 border-warning-500">
                <h4 className="font-semibold mb-2 text-warning-900 dark:text-warning-200">📊 成分统计</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">总成分数：</span>
                    <strong className="text-warning-800 dark:text-warning-200">{formulaData.ingredients.length} 种</strong>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">唯一成分：</span>
                    <strong className="text-warning-800 dark:text-warning-200">{new Set(formulaData.ingredients.map((i: { name: string }) => i.name)).size} 种</strong>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">来源数：</span>
                    <strong className="text-warning-800 dark:text-warning-200">
                      {[...new Set(formulaData.ingredients.map((i: any) => i.source).filter(Boolean))].length} 类
                    </strong>
                  </div>
                </div>

                {formulaData.confidence && (
                  <div className="mt-3 pt-3 border-t border-warning-200 dark:border-warning-800">
                    <span className="text-neutral-600 dark:text-neutral-400">解析置信度：</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-100 dark:bg-success-300/25 text-success-800 dark:text-success-200 rounded-full text-xs font-medium">
                      {(formulaData.confidence * 100).toFixed(0)}%
                      <Star className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-warning-50 dark:bg-neutral-800 p-8 rounded-lg text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-warning-500" />
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">暂无配方数据</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">请在对话中生成配方后查看详细数据</p>
            <div className="inline-block bg-warning-100 dark:bg-warning-300/25 px-4 py-2 rounded-lg text-sm text-warning-800 dark:text-warning-200">
              💡 提示：可以让AI以表格形式提供配方信息
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderIngredientAnalysis = (section: ReportSection) => (
    <div className="space-y-4">
      {(section.content?.ingredients || []).map((ingredient: any, idx: number) => (
        <details key={idx} className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 group">
          <summary className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-750 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronRight className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-open:rotate-90 transition-transform" />
              <div>
                <h4 className="font-semibold text-neutral-900 dark:text-white">{ingredient.name}</h4>
                {ingredient.latinName && <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic">{ingredient.latinName}</p>}
              </div>
            </div>
            <span className="px-3 py-1 bg-secondary-100 dark:bg-secondary-900 text-secondary-800 dark:text-secondary-200 text-xs rounded-full">
              {ingredient.percentage || ingredient.amount}{ingredient.unit}
            </span>
          </summary>
          <div className="p-4 pt-0 border-t border-neutral-200 dark:border-neutral-700 space-y-3">
            {ingredient.description && (
              <p className="text-neutral-700 dark:text-neutral-300"><strong>药理作用：</strong>{ingredient.description}</p>
            )}
            {ingredient.mechanism && (
              <p className="text-neutral-700 dark:text-neutral-300"><strong>作用机制：</strong>{ingredient.mechanism}</p>
            )}
            {ingredient.references && (
              <div><strong>参考文献：</strong>
                <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {ingredient.references.map((ref: string, i: number) => <li key={i}>{ref}</li>)}
                </ul>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  )

  const renderSynergyAssessment = (section: ReportSection) => (
    <div className="space-y-6">
      {section.content?.radarData ? (
        <>
          <SynergyRadarChart data={section.content.radarData} height={400} showLegend interactive />

          <div className="bg-success-50 dark:bg-neutral-800 p-6 rounded-lg border-l-4 border-success-500">
            <h4 className="font-semibold mb-2 text-success-900 dark:text-success-200">协同机制说明</h4>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {section.content.mechanismDescription || '各成分间存在显著的协同增效作用，能够提升整体配方的生物利用度和功效表现。'}
            </p>
          </div>

          {section.content?.warnings && section.content.warnings.length > 0 && (
            <div className="bg-error-50 dark:bg-neutral-800 p-6 rounded-lg border-l-4 border-error-500">
              <h4 className="font-semibold mb-2 text-error-900 dark:text-error-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> 潜在相互作用警告
              </h4>
              <ul className="list-disc list-inside space-y-1 text-error-800 dark:text-error-600">
                {section.content.warnings.map((warning: string, idx: number) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="bg-warning-50 dark:bg-neutral-800 p-6 rounded-lg text-center">
          <Network className="w-12 h-12 mx-auto mb-3 text-warning-500" />
          <p className="text-neutral-600 dark:text-neutral-400">暂无协同分析数据</p>
        </div>
      )}
    </div>
  )

  const renderRecommendations = (section: ReportSection) => (
    <div className="space-y-6">
      {section.content?.targetAudience && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-500" /> 目标人群
          </h4>
          <div className="flex flex-wrap gap-2">
            {section.content.targetAudience.map((audience: string, idx: number) => (
              <span key={idx} className="px-3 py-1 bg-accent-100 dark:bg-accent-900 text-accent-800 dark:text-accent-200 rounded-full text-sm">
                {audience}
              </span>
            ))}
          </div>
        </div>
      )}

      {section.content?.usageInstructions && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-secondary-500" /> 使用方法
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-neutral-700 dark:text-neutral-300">
            {section.content.usageInstructions.map((step: string, idx: number) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {section.content?.storageConditions && (
        <div className="bg-secondary-50 dark:bg-neutral-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-secondary-900 dark:text-secondary-200">储存条件</h4>
          <p className="text-neutral-700 dark:text-neutral-300">{section.content.storageConditions}</p>
        </div>
      )}

      {section.content?.precautions && (
        <div className="bg-warning-50 dark:bg-neutral-800 p-4 rounded-lg border-l-4 border-warning-500">
          <h4 className="font-semibold mb-2 text-warning-900 dark:text-warning-200">注意事项</h4>
          <ul className="list-disc list-inside space-y-1 text-warning-800 dark:text-warning-700">
            {section.content.precautions.map((precaution: string, idx: number) => (
              <li key={idx}>{precaution}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const renderAppendix = (section: ReportSection) => (
    <div className="space-y-6">
      {section.content?.references && section.content.references.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white">参考文献</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            {section.content.references.map((ref: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{ref}</li>
            ))}
          </ol>
        </div>
      )}

      {section.content?.glossary && section.content.glossary.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white">术语表</h4>
          <div className="grid gap-3">
            {section.content.glossary.map((term: any, idx: number) => (
              <div key={idx} className="flex gap-3 bg-neutral-50 dark:bg-neutral-800 p-3 rounded">
                <span className="font-semibold text-secondary-600 dark:text-secondary-700 min-w-[120px]">{term.term}</span>
                <span className="text-neutral-600 dark:text-neutral-400 text-sm">{term.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section.content?.dataSource && (
        <div className="text-sm text-neutral-500 dark:text-neutral-400 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <strong>数据来源：</strong>{section.content.dataSource}
        </div>
      )}
    </div>
  )

  // ==================== Loading & Error States ====================

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-16 h-16 animate-spin text-secondary-600 mx-auto" />
            <p className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">正在生成专业报告...</p>
            <p className="text-neutral-500 dark:text-neutral-400">请稍候，正在整合分析数据</p>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <p>✓ 提取配方数据</p>
              <p>✓ 分析成分信息</p>
              <p>✓ 评估协同效应</p>
              <p>✓ 生成报告章节</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-error-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">无法加载报告</h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{error || '暂无报告数据。请先在对话中获取配方或分析数据，然后生成报告。'}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleClose} className="px-6 py-2 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors">
              关闭
            </button>
            {onClose && (
              <button onClick={() => { onClose?.(); setTimeout(() => window.location.reload(), 100) }} className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                刷新页面
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 边界条件验证：检查报告数据完整性
  const hasValidData = report.sections && report.sections.length > 0

  if (!hasValidData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-warning-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">报告数据不完整</h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">生成的报告缺少必要的数据内容。</p>
          <div className="bg-warning-50 dark:bg-warning-300/20 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-warning-800 dark:text-warning-200"><strong>可能的原因：</strong></p>
            <ul className="list-disc list-inside mt-2 text-sm text-warning-700 dark:text-warning-700 space-y-1">
              <li>对话中尚未包含配方或分析内容</li>
              <li>AI回复中的数据格式无法识别</li>
              <li>网络请求失败导致数据丢失</li>
            </ul>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleClose} className="px-6 py-2 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors">
              关闭
            </button>
            <button onClick={() => window.location.reload()} className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
              重试生成
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== Main Render ====================

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:p-0 print:bg-white dark:bg-neutral-800">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-7xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden print:h-auto print:shadow-none print:rounded-none">

        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 print:hidden">
          <div className="flex items-center gap-3 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-secondary-500"
                  placeholder="输入报告标题..."
                />
                <button onClick={handleSaveTitle} className="p-2 text-success-600 hover:bg-success-50 dark:hover:bg-success-900 rounded-lg">
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
                {report.title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Export Buttons */}
            {Object.entries(EXPORT_FORMAT_CONFIG).map(([format, config]) => (
              <button
                key={format}
                onClick={() => handleExport(format as ExportFormat)}
                disabled={exportState.isExporting}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${config.color} disabled:opacity-50`}
                title={`导出为${config.label}格式`}
              >
                {config.icon}
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            ))}

            {/* Print Button */}
            <button onClick={handlePrint} className="p-2 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg" title="打印">
              <Printer className="w-5 h-5" />
            </button>

            {/* Edit Toggle */}
            {editable && (
              <button onClick={handleToggleEdit} className={`p-2 rounded-lg ${isEditing ? 'text-success-600 bg-success-50' : 'text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`} title={isEditing ? '保存' : '编辑'}>
                <Edit3 className="w-5 h-5" />
              </button>
            )}

            {/* Close Button */}
            <button onClick={handleClose} className="p-2 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg" title="关闭">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Export Progress */}
        {exportState.isExporting && (
          <div className="px-6 py-3 bg-secondary-50 dark:bg-neutral-800 border-b border-secondary-200 dark:border-secondary-900 print:hidden">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-secondary-600" />
              <span className="text-sm text-secondary-800 dark:text-secondary-200 font-medium">
                正在导出为{EXPORT_FORMAT_CONFIG[exportState.format!]?.label || exportState.format}格式...
              </span>
              <span className="text-sm font-bold text-secondary-600">{exportState.progress}%</span>
              <div className="flex-1 bg-secondary-200 dark:bg-secondary-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-secondary-500 to-secondary-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${exportState.progress}%` }}
                ></div>
              </div>
            </div>
            <p className="text-xs text-secondary-600 dark:text-secondary-700 mt-2 ml-8">
              {exportState.progress < 30 && '📊 正在准备数据...'}
              {exportState.progress >= 30 && exportState.progress < 60 && '✍️ 正在生成文档内容...'}
              {exportState.progress >= 60 && exportState.progress < 90 && '📦 正在打包文件...'}
              {exportState.progress >= 90 && '⬇️ 准备下载...'}
            </p>
          </div>
        )}

        {/* Success Message */}
        {exportState.progress === 100 && !exportState.isExporting && !exportState.error && (
          <div className="px-6 py-3 bg-success-50 dark:bg-success-300/20 border-b border-success-200 dark:border-success-800 print:hidden animate-fadeIn">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-success-600" />
              <span className="text-sm font-medium text-success-800 dark:text-success-200 flex-1">
                ✅ 导出成功！文件已开始下载
              </span>
              <button
                onClick={() => setExportState({ isExporting: false, format: null, progress: 0, error: null })}
                className="text-xs text-success-700 hover:text-success-900 underline"
              >
                关闭提示
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {exportState.error && (
          <div className="px-6 py-3 bg-error-50 dark:bg-neutral-800 border-b border-error-200 dark:border-error-900 print:hidden">
            <p className="text-sm text-error-800 dark:text-error-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {exportState.error}
              <button onClick={() => handleExport(exportState.format!)} className="underline ml-2">重试</button>
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden print:block">
          {/* Left Sidebar Navigation */}
          <nav className="w-56 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto print:hidden">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">目录导航</h3>
              <ul className="space-y-1">
                {sortedSections.map((section) => (
                  <li key={section.type}>
                    <button
                      onClick={() => handleScrollToSection(section.type)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        activeSection === section.type
                          ? 'bg-secondary-100 dark:bg-secondary-900 text-secondary-700 dark:text-secondary-200'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {SECTION_ICONS[section.type]}
                      <span>{SECTION_TITLES[section.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Right Content */}
          <main ref={contentRef} className="flex-1 overflow-y-auto p-8 bg-white dark:bg-neutral-900 print:p-0">
            <div className="max-w-4xl mx-auto space-y-12">
              {sortedSections.map((section) => (
                <section
                  key={section.id || section.type}
                  ref={(el) => { sectionRefs.current[section.type] = el as HTMLDivElement | null }}
                  id={`section-${section.type}`}
                  className="scroll-mt-20"
                >
                  <h2 className="h2 text-neutral-900 dark:text-white mb-6 pb-3 border-b-2 border-neutral-200 dark:border-neutral-700 flex items-center gap-3">
                    {SECTION_ICONS[section.type]}
                    {section.title || SECTION_TITLES[section.type]}
                  </h2>
                  {renderSectionContent(section)}
                </section>
              ))}
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-700 text-center text-sm text-neutral-500 dark:text-neutral-400 print:hidden">
              <p>© 2026 莱茵（厦门）分子生物科技有限公司 | RMFOOD 配方设计平台</p>
              <p className="mt-1">报告生成时间：{new Date().toLocaleString('zh-CN')}</p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ProfessionalReport
