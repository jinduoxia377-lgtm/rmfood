import React, { useState, useCallback, useEffect } from 'react'
import {
  Microscope, BarChart3, Dna, Zap, FlaskConical, Shield,
  ChevronDown, ChevronUp, Download, Loader2, CheckCircle2,
  AlertTriangle, Layers, Target, Atom, Save, History,
  Trash2, Edit3, X, Clock, Tag, Database,
} from 'lucide-react'
import { peptideAnalysisApi, type PeptideAnalysisData } from '@/api/ai'
import { logger } from '@/utils/safeLogger'
import { useToast } from '@/components/ui'


interface PeptideAnalysisResult {
  sequence?: string;
  details?: {
    id: number;
    dimension_type: 'basic' | 'structure' | 'physicochemical' | 'bioactivity' | 'safety' | 'overall';
    data: Record<string, unknown>;
    created_at: string;
  }[];
  overall_scores?: Record<string, unknown>;
  basic_properties?: Record<string, unknown>;
  secondary_structure?: Record<string, unknown> & {
    percentages?: {
      alpha_helix?: number;
      beta_sheet?: number;
      random_coil?: number;
    };
    predicted_sequence?: string;
  };
  bioactivity_predictions?: Record<string, unknown>;
  safety_assessment?: Record<string, unknown> & {
    risk_level?: 'low' | 'medium' | 'high';
    safety_score?: number;
    penalties?: string[];
    immunogenicity_risk?: number;
    allergenicity_risk?: number;
    protease_cleavage_sites?: string[];
    recommended_storage_conditions?: string;
  };
}


interface DeepAnalysisProps {
  initialSequence?: string
  onAnalysisComplete?: (result: PeptideAnalysisResult) => void
}

export function AdvancedPeptideAnalyzer({ initialSequence = '', onAnalysisComplete }: DeepAnalysisProps) {
  const { addToast } = useToast()
  const [activeMode, setActiveMode] = useState<'single' | 'batch' | 'pareto' | 'synergy' | 'solubility'>('single')
  const [sequence, setSequence] = useState(initialSequence)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PeptideAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true, structure: true, bioactivity: true, safety: true,
  })

  // 新增状态：数据库集成
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [historyList, setHistoryList] = useState<PeptideAnalysisData[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [editingNotes, setEditingNotes] = useState<string>('')
  const [editingTags, setEditingTags] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 加载历史分析列表
  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const response = await peptideAnalysisApi.listAnalyses({ page, page_size: 20 })
      setHistoryList(response.items)
      setHistoryTotal(response.total)
      setHistoryPage(page)
    } catch (err: any) {
      logger.error('加载历史失败:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // 组件挂载时自动加载历史
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 保存当前分析到数据库
  const handleSaveAnalysis = async () => {
    if (!result || !sequence) return

    setSaving(true)
    try {
      const response = await peptideAnalysisApi.createAnalysis({
        sequence,
        analysis_mode: 'deep',
        tags: [],
        notes: '',
      })

      setCurrentAnalysisId(response.data.id)

      // 显示成功提示（可替换为Toast）
      addToast({ type: 'success', title: '保存成功', message: `分析已保存！ID: ${response.data.id}` })

      // 刷新历史列表
      await loadHistory(1)
    } catch (err: any) {
      logger.error('保存失败:', err)
      addToast({ type: 'error', title: '保存失败', message: err.message || '未知错误' })
    } finally {
      setSaving(false)
    }
  }

  // 从历史加载分析详情
  const handleLoadFromHistory = async (id: number) => {
    try {
      const analysis = await peptideAnalysisApi.getAnalysis(id)

      // 更新界面状态
      setSequence(analysis.sequence)
      setCurrentAnalysisId(analysis.id)
      setEditingNotes(analysis.notes || '')
      setEditingTags((analysis.tags || []).join(', '))

      // 如果有详细数据，恢复显示
      if (analysis.details && analysis.details.length > 0) {
        // 将details转换为result格式（简化版）
        const reconstructedResult = {
          sequence: analysis.sequence,
          details: analysis.details,
          basic_properties: analysis.details.find(d => d.dimension_type === 'basic')?.data || {},
          secondary_structure: analysis.details.find(d => d.dimension_type === 'structure')?.data || {},
          bioactivity_predictions: analysis.details.find(d => d.dimension_type === 'bioactivity')?.data || {},
          safety_assessment: analysis.details.find(d => d.dimension_type === 'safety')?.data || {},
          overall_scores: analysis.details.find(d => d.dimension_type === 'overall')?.data || {},
        }
        setResult(reconstructedResult)
      }

      setShowHistoryPanel(false)
    } catch (err: any) {
      logger.error('加载失败:', err)
      addToast({ type: 'error', title: '加载失败', message: err.message || '未知错误' })
    }
  }

  // 更新备注和标签
  const handleUpdateMetadata = async () => {
    if (!currentAnalysisId) return

    try {
      await peptideAnalysisApi.updateAnalysis(currentAnalysisId, {
        tags: editingTags.split(',').map(t => t.trim()).filter(Boolean),
        notes: editingNotes,
      })

      setIsEditing(false)
      addToast({ type: 'success', title: '更新成功', message: '分析数据已更新' })
      await loadHistory(historyPage)
    } catch (err: any) {
      logger.error('更新失败:', err)
      addToast({ type: 'error', title: '更新失败', message: '请重试' })
    }
  }

  // 删除分析记录
  const handleDeleteAnalysis = async () => {
    if (!currentAnalysisId) return

    setDeleteLoading(true)
    try {
      await peptideAnalysisApi.deleteAnalysis(currentAnalysisId)

      // 重置状态
      setCurrentAnalysisId(null)
      setResult(null)
      setSequence('')
      setShowDeleteConfirm(false)

      addToast({ type: 'success', title: '删除成功', message: '分析记录已删除' })
      await loadHistory(historyPage)
    } catch (err: any) {
      logger.error('删除失败:', err)
      addToast({ type: 'error', title: '删除失败', message: '请重试' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeepAnalysis = async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入有效的肽序列（至少2个氨基酸）')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/v1/ai/peptide/advanced/analyze/deep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ sequence }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `分析失败 (${response.status})`

        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.detail || errorMessage
        } catch {
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.slice(0, 200)}`
          }
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        onAnalysisComplete?.(data.data)
      } else {
        setError(data.detail || '分析失败：服务器返回异常')
      }
    } catch (err: any) {
      logger.error('深度分析失败:', err)
      setError(err.message || '网络错误，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const renderScoreBar = (label: string, score: number, color: string) => (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-sm text-neutral-600 w-32">{label}</span>
      <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 bg-${color}-500`}
          style={{ width: `${Math.min(score * 100, 100)}%` }}
        />
      </div>
      <span className="text-sm font-mono font-semibold w-12 text-right">
        {(score * 100).toFixed(1)}%
      </span>
    </div>
  )

  const renderPropertyGrid = (props: Record<string, any>) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.entries(props).map(([key, value]) => (
        <div key={key} className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
          <div className="text-xs text-neutral-500 capitalize">{key.replace(/_/g, ' ')}</div>
          <div className="text-lg font-semibold mt-1">
            {typeof value === 'number' ? value.toFixed(2) : String(value)}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white dark:bg-neutral-900/20 rounded-xl backdrop-blur">
            <Microscope className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">高级肽分析引擎</h2>
            <p className="text-white/80 text-sm">二级结构预测 · Pareto 优化 · 协同效应 · 溶解度建模</p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mt-5 flex-wrap">
          {[
            { id: 'single', icon: Microscope, label: '深度分析' },
            { id: 'batch', icon: Layers, label: '批量分析' },
            { id: 'pareto', icon: Target, label: 'Pareto 优化' },
            { id: 'synergy', icon: Dna, label: '协同分析' },
            { id: 'solubility', icon: FlaskConical, label: '溶解度曲线' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveMode(id as 'single' | 'batch' | 'pareto' | 'synergy' | 'solubility')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeMode === id
                  ? 'bg-white dark:bg-neutral-900 text-accent-600 shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Single Analysis Mode */}
        {activeMode === 'single' && (
          <div className="space-y-6">
            {/* Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={sequence}
                onChange={(e) => setSequence(e.target.value.toUpperCase())}
                placeholder="输入肽序列，如 VLGYT 或 LRPFFY..."
                className="flex-1 px-4 py-3 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg
                         bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-lg
                         focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
              />
              <button
                onClick={handleDeepAnalysis}
                disabled={loading || !sequence}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg
                         font-semibold hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Microscope className="w-5 h-5" />}
                深度分析
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-error-500 mt-0.5" />
                <div className="text-error-700 dark:text-error-300">{error}</div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* 数据库操作工具栏 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    {currentAnalysisId ? (
                      <>
                        <Database className="w-5 h-5 text-success-600" />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          已保存 (ID: {currentAnalysisId})
                        </span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 text-orange-600" />
                        <span className="text-sm text-neutral-500">分析完成，可保存到数据库</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 保存按钮（未保存时显示） */}
                    {!currentAnalysisId && (
                      <button
                        onClick={handleSaveAnalysis}
                        disabled={saving}
                        className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        保存到数据库
                      </button>
                    )}

                    {/* 已保存后的操作按钮 */}
                    {currentAnalysisId && (
                      <>
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="px-3 py-2 bg-secondary-100 text-secondary-700 rounded-lg hover:bg-secondary-200 flex items-center gap-1.5 text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          编辑备注
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-3 py-2 bg-error-100 text-error-700 rounded-lg hover:bg-error-200 flex items-center gap-1.5 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </>
                    )}

                    {/* 历史记录按钮 */}
                    <button
                      onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                      className="px-3 py-2 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1.5 text-sm"
                    >
                      <History className="w-4 h-4" />
                      历史记录 ({historyTotal})
                    </button>
                  </div>
                </div>

                {/* 编辑备注和标签的表单 */}
                {isEditing && currentAnalysisId && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">编辑元数据</div>
                    <input
                      type="text"
                      value={editingTags}
                      onChange={(e) => setEditingTags(e.target.value)}
                      placeholder="标签（逗号分隔）"
                      className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-neutral-800 text-sm"
                    />
                    <textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      placeholder="备注信息..."
                      rows={2}
                      className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded bg-white dark:bg-neutral-800 text-sm resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleUpdateMetadata}
                        className="px-4 py-1.5 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                      >
                        保存修改
                      </button>
                    </div>
                  </div>
                )}

                {/* 删除确认对话框 */}
                {showDeleteConfirm && (
                  <div className="p-4 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
                    <div className="font-medium text-error-800 dark:text-error-200 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      确认删除此分析记录？
                    </div>
                    <p className="text-sm text-error-600 dark:text-error-300">
                      删除后数据将移至回收站，可在管理后台恢复。此操作不可撤销。
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleteLoading}
                        className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleDeleteAnalysis}
                        disabled={deleteLoading}
                        className="px-4 py-1.5 bg-error-600 text-white rounded text-sm hover:bg-error-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        确认删除
                      </button>
                    </div>
                  </div>
                )}

                {/* 历史记录侧边栏 */}
                {showHistoryPanel && (
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-neutral-800 flex items-center justify-between">
                      <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        我的历史分析 ({historyTotal}条)
                      </div>
                      <button
                        onClick={() => setShowHistoryPanel(false)}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {historyLoading ? (
                        <div className="p-8 text-center text-neutral-500">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                          加载中...
                        </div>
                      ) : historyList.length === 0 ? (
                        <div className="p-8 text-center text-neutral-400">
                          <Database className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          暂无历史记录
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {historyList.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleLoadFromHistory(item.id)}
                              className="w-full px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800 text-left transition-colors"
                            >
                              <div className="font-mono font-semibold text-neutral-900 dark:text-white">
                                {item.sequence}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                <span>{item.analysis_mode}</span>
                                <span>•</span>
                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                {(item.tags || []).length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      {item.tags.slice(0, 2).join(', ')}
                                      {item.tags.length > 2 && `+${item.tags.length - 2}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 分页控件 */}
                    {historyTotal > 20 && (
                      <div className="px-4 py-3 bg-slate-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-sm">
                        <span className="text-neutral-500">
                          第 {(historyPage - 1) * 20 + 1}-{Math.min(historyPage * 20, historyTotal)} 条，共 {historyTotal} 条
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadHistory(historyPage - 1)}
                            disabled={historyPage <= 1}
                            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            上一页
                          </button>
                          <button
                            onClick={() => loadHistory(historyPage + 1)}
                            disabled={historyPage * 20 >= historyTotal}
                            className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Overall Score Card */}
                <div className="grid grid-cols-5 gap-4 p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  {[
                    { label: '综合得分', value: Number(result.overall_scores?.composite ?? 0), color: 'purple' },
                    { label: '稳定性', value: Number(result.overall_scores?.stability ?? 0), color: 'blue' },
                    { label: '类药性', value: Number(result.overall_scores?.druglikeness ?? 0), color: 'green' },
                    { label: '生物活性', value: Number(result.overall_scores?.bioactivity ?? 0), color: 'orange' },
                    { label: '安全性', value: Number(result.overall_scores?.safety ?? 0), color: 'emerald' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <div className="text-xs text-neutral-500 mb-1">{label}</div>
                      <div className={`text-3xl font-bold text-${color}-600`}>
                        {(value * 100).toFixed(1)}<span className="text-lg">%</span>
                      </div>
                      <div className={`mt-1 h-1.5 bg-${color}-200 dark:bg-${color}-900 rounded-full overflow-hidden`}>
                        <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${value * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Basic Properties */}
                <SectionCard
                  title="基本理化性质"
                  icon={<BarChart3 className="w-5 h-5" />}
                  expanded={expandedSections.basic ?? false}
                  onToggle={() => toggleSection('basic')}
                >
                  {renderPropertyGrid(result.basic_properties || {})}
                </SectionCard>

                {/* Secondary Structure */}
                <SectionCard
                  title="二级结构预测 (Chou-Fasman)"
                  icon={<Dna className="w-5 h-5" />}
                  expanded={expandedSections.structure ?? false}
                  onToggle={() => toggleSection('structure')}
                >
                  {result.secondary_structure && (
                    <div className="space-y-4">
                      {/* Structure Percentages */}
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { type: 'α-Helix', percent: result.secondary_structure.percentages?.alpha_helix ?? 0, color: 'red' },
                          { type: 'β-Sheet', percent: result.secondary_structure.percentages?.beta_sheet ?? 0, color: 'blue' },
                          { type: 'Random Coil', percent: result.secondary_structure.percentages?.random_coil ?? 0, color: 'green' },
                        ].map(({ type, percent, color }) => (
                          <div key={type} className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg text-center">
                            <div className={`text-2xl font-bold text-${color}-600`}>{percent.toFixed(1)}%</div>
                            <div className="text-sm text-neutral-500 mt-1">{type}</div>
                            <div className={`mt-2 h-2 bg-${color}-200 rounded-full overflow-hidden`}>
                              <div className={`h-full bg-${color}-500 rounded-full transition-all`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Predicted Sequence Visualization */}
                      {result.secondary_structure.predicted_sequence && (
                        <div className="mt-4">
                          <div className="text-sm text-neutral-500 mb-2">结构序列可视化</div>
                          <div className="font-mono text-lg flex flex-wrap gap-1">
                            {result.secondary_structure.predicted_sequence.split('').map((char: string, i: number) => (
                              <span
                                key={i}
                                className={`px-2 py-1 rounded ${
                                  char === 'H' ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300' :
                                  char === 'E' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300' :
                                  'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                                }`}
                                title={`${(result.sequence?.[i] ?? '')}${i + 1}: ${char === 'H' ? 'Helix' : char === 'E' ? 'Sheet' : 'Coil'}`}
                              >
                                {result.sequence?.[i] ?? ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>

                {/* Bioactivity Predictions */}
                <SectionCard
                  title="生物活性预测"
                  icon={<Zap className="w-5 h-5" />}
                  expanded={expandedSections.bioactivity ?? false}
                  onToggle={() => toggleSection('bioactivity')}
                >
                  {result.bioactivity_predictions && (
                    <div className="space-y-3">
                      {Object.entries(result.bioactivity_predictions).map(([activity, data]: [string, any]) => {
                        const score = data.score ?? 0.5
                        const tier = data.tier ?? 'moderate'
                        return (
                          <div key={activity} className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{activity}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                tier === 'excellent' ? 'bg-success-100 text-success-700' :
                                tier === 'good' ? 'bg-secondary-100 text-secondary-700' :
                                tier === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-error-100 text-error-700'
                              }`}>
                                {tier.toUpperCase()}
                              </span>
                            </div>
                            {renderScoreBar(activity, score, tier === 'excellent' ? 'green' : tier === 'good' ? 'blue' : 'yellow')}
                            {data.potential_applications && (
                              <div className="mt-2 text-xs text-neutral-500">
                                应用场景: {data.potential_applications.join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>

                {/* Safety Assessment */}
                <SectionCard
                  title="安全性评估"
                  icon={<Shield className="w-5 h-5" />}
                  expanded={expandedSections.safety ?? false}
                  onToggle={() => toggleSection('safety')}
                >
                  {result.safety_assessment && (() => {
                    const sa = result.safety_assessment;
                    return (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg ${
                        sa.risk_level === 'low' ? 'bg-success-50 dark:bg-success-900/20 border border-green-200' :
                        sa.risk_level === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200' :
                        'bg-error-50 dark:bg-error-900/20 border border-red-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          {sa.risk_level === 'low' && <CheckCircle2 className="w-6 h-6 text-success-500" />}
                          {sa.risk_level === 'medium' && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
                          {sa.risk_level === 'high' && <AlertTriangle className="w-6 h-6 text-error-500" />}
                          <div>
                            <div className="font-semibold">安全等级: {sa.risk_level?.toUpperCase() ?? '-'}</div>
                            <div className="text-sm text-neutral-500">评分: {(sa.safety_score ?? 0 * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>

                      {sa.penalties && sa.penalties.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-neutral-700">风险因素:</div>
                          {sa.penalties.map((penalty: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-orange-600">
                              <AlertTriangle className="w-4 h-4" />
                              {penalty}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: '免疫原性风险', value: sa.immunogenicity_risk },
                          { label: '过敏风险', value: sa.allergenicity_risk },
                          { label: '蛋白酶位点数', value: sa.protease_cleavage_sites?.length ?? 0 },
                          { label: '推荐储存', value: sa.recommended_storage_conditions ?? '-' },
                        ].map(({ label, value }) => (
                          <div key={label} className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                            <div className="text-xs text-neutral-500">{label}</div>
                            <div className="text-sm font-medium mt-0.5">
                              {typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}
                </SectionCard>

                {/* Export Button */}
                <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `peptide_analysis_${sequence}_${Date.now()}.json`
                      a.click()
                    }}
                    className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出报告
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other modes placeholder */}
        {activeMode !== 'single' && (
          <div className="text-center py-16 text-neutral-500">
            <Atom className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">功能开发中</h3>
            <p className="text-sm">"{activeMode}" 模式即将上线</p>
            <button
              onClick={() => setActiveMode('single')}
              className="mt-4 px-4 py-2 text-accent-600 hover:bg-accent-50 rounded-lg"
            >
              返回深度分析模式
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="font-semibold text-neutral-900 dark:text-white">{title}</h3>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-neutral-400" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
      </button>
      {expanded && (
        <div className="px-5 py-4 bg-white dark:bg-neutral-900">
          {children}
        </div>
      )}
    </div>
  )
}
