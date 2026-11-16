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
import { useTranslation } from 'react-i18next'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  X, FileText, FileSpreadsheet, Printer,
  Edit3, Check, Loader2, AlertCircle, ChevronRight,
  BookOpen, BarChart3, FlaskConical, Network, Lightbulb,
  Archive, Target, Star, Users, ClipboardList, Sparkles,
} from 'lucide-react'
import type { ReportSection, ReportSectionType } from '@/types/ai.types'
// 导入枚举值和接口（不仅是类型）
import { ExportFormat } from '@/types/ai.types'
import type { ProfessionalReport as ProfessionalReportType } from '@/types/ai.types'
import { FormulaTable } from './FormulaTable'
import { SynergyRadarChart } from './SynergyRadarChart'

// ==================== Types ====================

export interface ProfessionalReportProps {
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
  'cover': 'ai.report.professional.section.cover',
  'executive-summary': 'ai.report.professional.section.executiveSummary',
  'formula-details': 'ai.report.professional.section.formulaDetails',
  'ingredient-analysis': 'ai.report.professional.section.ingredientAnalysis',
  'synergy-assessment': 'ai.report.professional.section.synergyAssessment',
  'recommendations': 'ai.report.professional.section.recommendations',
  'appendix': 'ai.report.professional.section.appendix',
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
  const { t } = useTranslation();
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        error: err instanceof Error ? err.message : t('ai.report.professional.exportFailed'),
      })
    }
  }, [onExport, exportState.isExporting, t])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ==================== Computed Values ====================

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
        return <div className="p-8 text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('ai.report.professional.unknownSection')}</div>
    }
  }

  const renderCoverPage = () => (
    <div className="min-h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-secondary-50 to-accent-100 dark:from-neutral-800 dark:to-neutral-900 rounded-lg p-12">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white">
          {report?.title || t('ai.report.professional.defaultTitle')}
        </h1>
        <div className="w-32 h-1 bg-secondary-600 mx-auto rounded"></div>
        <div className="space-y-2 text-neutral-600 dark:text-neutral-300">
          <p className="text-lg">{report?.metadata?.projectName || t('ai.report.professional.defaultProject')}</p>
          <p>{t('ai.report.professional.generatedAt')}：{report?.generatedAt ? new Date(report.generatedAt).toLocaleString('zh-CN') : '-'}</p>
          <p>{t('ai.report.professional.reportVersion')}：{report?.version || '1.0.0'}</p>
          {report?.metadata?.author && <p>{t('ai.report.professional.author')}：{report.metadata.author}</p>}
        </div>
        <div className="pt-8 text-sm text-neutral-500 dark:text-neutral-400">
          {t('ai.report.professional.companyName')}
        </div>
      </div>
    </div>
  )

  const renderExecutiveSummary = (section: ReportSection) => {
    const content = section.content || {}
    const formulaName = content.formulaName || t('ai.report.professional.toBeFilled')
    const ingredientCount = content.ingredientCount ?? 0
    const sources = content.sources || []
    const totalDosage = content.totalDosage ?? 0
    const keyFindings = content.keyFindings || []
    const recommendationScore = content.recommendationScore ?? 85

    if (process.env.NODE_ENV === 'development') {
      logger.log('[ProfessionalReport] 渲染执行摘要', {
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
              label: t('ai.report.professional.formulaName'),
              value: formulaName,
              icon: <Lightbulb className="w-6 h-6 text-warning-500" />,
              highlight: true,
            },
            {
              label: t('ai.report.professional.keyFinding'),
              value: keyFindings.length > 0 ? keyFindings[0] : t('ai.report.professional.defaultFinding'),
              icon: <Target className="w-6 h-6 text-error-500" />,
            },
            {
              label: t('ai.report.professional.recommendationIndex'),
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
          <h4 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-200 flex items-center gap-2"><ClipboardList className="w-5 h-5" aria-hidden="true" />{t('ai.report.professional.formulaOverview')}</h4>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary-600 dark:text-secondary-700">{ingredientCount}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('ai.report.professional.ingredientCount')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-success-600 dark:text-success-600">{sources.length}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('ai.report.professional.sourceTypes')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent-600 dark:text-accent-700">{totalDosage > 0 ? totalDosage.toFixed(1) : 'N/A'}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('ai.report.professional.totalDosage')}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-warning-600 dark:text-warning-700">{recommendationScore}%</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('ai.report.professional.recommendation')}</p>
            </div>
          </div>

          {sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-secondary-200 dark:border-secondary-800">
              <p className="text-sm text-secondary-800 dark:text-secondary-200">
                <strong>{t('ai.report.professional.sourceDistribution')}：</strong>{sources.join('、') || t('ai.report.professional.toBeAnalyzed')}
              </p>
            </div>
          )}
        </div>

        {(keyFindings.length > 0 || content.summary) && (
          <div className="bg-gradient-to-r from-success-50 to-success-50 dark:from-neutral-800 dark:to-neutral-800 p-6 rounded-lg border-l-4 border-success-500">
            <h4 className="font-semibold mb-2 text-success-900 dark:text-success-200 flex items-center gap-2"><Sparkles className="w-5 h-5" aria-hidden="true" />{t('ai.report.professional.summaryOverview')}</h4>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {content.summary || t('ai.report.professional.defaultSummary', { name: formulaName, count: ingredientCount })}
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
      logger.log('[ProfessionalReport] 渲染配方详情', {
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
                {formulaData.name || t('ai.report.professional.unnamedFormula')}
              </h3>
              {formulaData.description && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2">{formulaData.description}</p>
              )}
            </div>

            <FormulaTable data={formulaData} isLoading={false} />

            {statistics && Object.keys(statistics).length > 0 && (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-4">
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
                <h4 className="font-semibold mb-2 text-warning-900 dark:text-warning-200 flex items-center gap-2"><BarChart3 className="w-5 h-5" aria-hidden="true" />{t('ai.report.professional.ingredientStats')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">{t('ai.report.professional.totalIngredients')}：</span>
                    <strong className="text-warning-800 dark:text-warning-200">{formulaData.ingredients.length} {t('ai.report.professional.kind')}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">{t('ai.report.professional.uniqueIngredients')}：</span>
                    <strong className="text-warning-800 dark:text-warning-200">{new Set(formulaData.ingredients.map((i: { name: string }) => i.name)).size} {t('ai.report.professional.kind')}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-600 dark:text-neutral-400">{t('ai.report.professional.sourceCount')}：</span>
                    <strong className="text-warning-800 dark:text-warning-200">
                      {[...new Set(formulaData.ingredients.map((i: any) => i.source).filter(Boolean))].length} {t('ai.report.professional.category')}
                    </strong>
                  </div>
                </div>

                {formulaData.confidence && (
                  <div className="mt-3 pt-3 border-t border-warning-200 dark:border-warning-800">
                    <span className="text-neutral-600 dark:text-neutral-400">{t('ai.report.professional.parseConfidence')}：</span>
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
            <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t('ai.report.professional.noFormulaData')}</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('ai.report.professional.noFormulaHint')}</p>
            <div className="inline-flex items-center gap-2 bg-warning-100 dark:bg-warning-300/25 px-4 py-2 rounded-lg text-sm text-warning-800 dark:text-warning-200">
              <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t('ai.report.professional.tableHint')}
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
          <summary className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between">
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
              <p className="text-neutral-700 dark:text-neutral-300"><strong>{t('ai.report.professional.pharmacology')}：</strong>{ingredient.description}</p>
            )}
            {ingredient.mechanism && (
              <p className="text-neutral-700 dark:text-neutral-300"><strong>{t('ai.report.professional.mechanism')}：</strong>{ingredient.mechanism}</p>
            )}
            {ingredient.references && (
              <div><strong>{t('ai.report.professional.references')}：</strong>
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
            <h4 className="font-semibold mb-2 text-success-900 dark:text-success-200">{t('ai.report.professional.synergyMechanism')}</h4>
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {section.content.mechanismDescription || t('ai.report.professional.defaultSynergyMechanism')}
            </p>
          </div>

          {section.content?.warnings && section.content.warnings.length > 0 && (
            <div className="bg-error-50 dark:bg-neutral-800 p-6 rounded-lg border-l-4 border-error-500">
              <h4 className="font-semibold mb-2 text-error-900 dark:text-error-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> {t('ai.report.professional.potentialInteractions')}
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
          <p className="text-neutral-600 dark:text-neutral-400">{t('ai.report.professional.noSynergyData')}</p>
        </div>
      )}
    </div>
  )

  const renderRecommendations = (section: ReportSection) => (
    <div className="space-y-6">
      {section.content?.targetAudience && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-500" /> {t('ai.report.professional.targetAudience')}
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
            <ClipboardList className="w-5 h-5 text-secondary-500" /> {t('ai.report.professional.usageMethod')}
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
          <h4 className="font-semibold mb-2 text-secondary-900 dark:text-secondary-200">{t('ai.report.professional.storageConditions')}</h4>
          <p className="text-neutral-700 dark:text-neutral-300">{section.content.storageConditions}</p>
        </div>
      )}

      {section.content?.precautions && (
        <div className="bg-warning-50 dark:bg-neutral-800 p-4 rounded-lg border-l-4 border-warning-500">
          <h4 className="font-semibold mb-2 text-warning-900 dark:text-warning-200">{t('ai.report.professional.precautions')}</h4>
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
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white">{t('ai.report.professional.references')}</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            {section.content.references.map((ref: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{ref}</li>
            ))}
          </ol>
        </div>
      )}

      {section.content?.glossary && section.content.glossary.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-neutral-900 dark:text-white">{t('ai.report.professional.glossary')}</h4>
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
          <strong>{t('ai.report.professional.dataSource')}：</strong>{section.content.dataSource}
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
            <p className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">{t('ai.report.professional.generating')}</p>
            <p className="text-neutral-500 dark:text-neutral-400">{t('ai.report.professional.generatingHint')}</p>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              <p className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0 text-success-500" aria-hidden="true" />{t('ai.report.professional.step.extract')}</p>
              <p className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0 text-success-500" aria-hidden="true" />{t('ai.report.professional.step.analyze')}</p>
              <p className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0 text-success-500" aria-hidden="true" />{t('ai.report.professional.step.assess')}</p>
              <p className="flex items-center gap-2"><Check className="w-4 h-4 shrink-0 text-success-500" aria-hidden="true" />{t('ai.report.professional.step.generate')}</p>
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
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{t('ai.report.professional.loadFailed')}</h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{error || t('ai.report.professional.noReportData')}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleClose} className="px-6 py-2 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors">
              {t('ai.report.professional.close')}
            </button>
            {onClose && (
              <button onClick={() => { onClose?.(); setTimeout(() => window.location.reload(), 100) }} className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                {t('ai.report.professional.refresh')}
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
          <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{t('ai.report.professional.incompleteData')}</h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('ai.report.professional.incompleteDataDesc')}</p>
          <div className="bg-warning-50 dark:bg-warning-300/20 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-warning-800 dark:text-warning-200"><strong>{t('ai.report.professional.possibleCauses')}：</strong></p>
            <ul className="list-disc list-inside mt-2 text-sm text-warning-700 dark:text-warning-700 space-y-1">
              <li>{t('ai.report.professional.cause.noFormula')}</li>
              <li>{t('ai.report.professional.cause.unrecognized')}</li>
              <li>{t('ai.report.professional.cause.network')}</li>
            </ul>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleClose} className="px-6 py-2 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container transition-colors">
              {t('ai.report.professional.close')}
            </button>
            <button onClick={() => window.location.reload()} className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
              {t('ai.report.professional.retryGenerate')}
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
                  placeholder={t('ai.report.professional.titlePlaceholder')}
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
                title={t('ai.report.professional.exportAs', { format: config.label })}
              >
                {config.icon}
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            ))}

            {/* Print Button */}
            <button onClick={handlePrint} className="p-2 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg" title={t('ai.report.professional.print')}>
              <Printer className="w-5 h-5" />
            </button>

            {/* Edit Toggle */}
            {editable && (
              <button onClick={handleToggleEdit} className={`p-2 rounded-lg ${isEditing ? 'text-success-600 bg-success-50' : 'text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`} title={isEditing ? t('ai.report.professional.save') : t('ai.report.professional.edit')}>
                <Edit3 className="w-5 h-5" />
              </button>
            )}

            {/* Close Button */}
            <button onClick={handleClose} className="p-2 text-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg" title={t('ai.report.professional.close')}>
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
                {t('ai.report.professional.exportingAs', { format: EXPORT_FORMAT_CONFIG[exportState.format!]?.label || exportState.format })}
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
              {exportState.progress < 30 && t('ai.report.professional.progress.prepare')}
              {exportState.progress >= 30 && exportState.progress < 60 && t('ai.report.professional.progress.generate')}
              {exportState.progress >= 60 && exportState.progress < 90 && t('ai.report.professional.progress.package')}
              {exportState.progress >= 90 && t('ai.report.professional.progress.download')}
            </p>
          </div>
        )}

        {/* Success Message */}
        {exportState.progress === 100 && !exportState.isExporting && !exportState.error && (
          <div className="px-6 py-3 bg-success-50 dark:bg-success-300/20 border-b border-success-200 dark:border-success-800 print:hidden animate-fadeIn">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-success-600" />
              <span className="text-sm font-medium text-success-800 dark:text-success-200 flex-1">
                {t('ai.report.professional.exportSuccess')}
              </span>
              <button
                onClick={() => setExportState({ isExporting: false, format: null, progress: 0, error: null })}
                className="text-xs text-success-700 hover:text-success-900 underline"
              >
                {t('ai.report.professional.dismissNotice')}
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
              <button onClick={() => handleExport(exportState.format!)} className="underline ml-2">{t('ai.report.professional.retry')}</button>
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden print:block">
          {/* Left Sidebar Navigation */}
          <nav className="w-56 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto print:hidden">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-3">{t('ai.report.professional.toc')}</h3>
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
                      <span>{t(SECTION_TITLES[section.type])}</span>
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
                    {section.title || t(SECTION_TITLES[section.type])}
                  </h2>
                  {renderSectionContent(section)}
                </section>
              ))}
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-700 text-center text-sm text-neutral-500 dark:text-neutral-400 print:hidden">
              <p>{t('ai.report.professional.footerCopyright', { year: new Date().getFullYear() })}</p>
              <p className="mt-1">{t('ai.report.professional.footerGeneratedAt')}：{new Date().toLocaleString('zh-CN')}</p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ProfessionalReport
