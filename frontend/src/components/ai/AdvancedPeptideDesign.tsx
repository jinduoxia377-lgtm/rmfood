import React, { useState, useCallback, useEffect } from 'react'
import { Sparkles, Atom, Zap, RefreshCw, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Save, FolderOpen, Archive, Eye } from 'lucide-react'
import { peptideDesignApi } from '@/api/ai'
import type { PeptideResult, OptimizedPeptide, PepinventStatusResponse, PeptideDesignData } from '@/api/ai'
import { logger } from '@/utils/safeLogger'
import { useToast } from '@/components/ui'
import { generateSimulatedPeptides } from '@/components/ai/features/services/simulatedPeptideGenerator'


interface AdvancedPeptideDesignProps {
  onPeptidesGenerated?: (peptides: PeptideResult[]) => void
  className?: string
}

const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY'
function randomMutate(seq: string, n: number): string {
  let s = seq
  for (let i = 0; i < n && s.length > 0; i++) {
    const pos = Math.floor(Math.random() * s.length)
    s = s.substring(0, pos) + AMINO_ACIDS[Math.floor(Math.random() * AMINO_ACIDS.length)] + s.substring(pos + 1)
  }
  return s
}

const TARGET_EFFECTS = [
  { id: 'ACE抑制', label: 'ACE 抑制', message: '降血压活性', color: 'blue' },
  { id: '抗氧化', label: '抗氧化', message: '清除自由基', color: 'green' },
  { id: 'DPP-IV抑制', label: 'DPP-IV 抑制', message: '降血糖活性', color: 'purple' },
  { id: '增强渗透性', label: '膜渗透性', message: '提高生物利用度', color: 'orange' },
  { id: '提高稳定性', label: '结构稳定', message: '增强热稳定性', color: 'red' },
]

const OPTIMIZATION_GOALS = [
  { id: 'ACE_inhibitory', label: 'ACE 抑制活性', defaultWeight: 0.4 },
  { id: 'antioxidant', label: '抗氧化能力', defaultWeight: 0.3 },
  { id: 'permeability', label: '膜渗透性', defaultWeight: 0.2 },
  { id: 'stability', label: '结构稳定性', defaultWeight: 0.1 },
]

export function AdvancedPeptideDesign({ onPeptidesGenerated, className = '' }: AdvancedPeptideDesignProps) {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'generate' | 'optimize' | 'sample'>('generate')
  const [mainView, setMainView] = useState<'design' | 'projects'>('design')  // 新增：主视图切换
  const [selectedEffects, setSelectedEffects] = useState<string[]>(['ACE抑制'])
  const [maxCandidates, setMaxCandidates] = useState(5)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    peptides?: PeptideResult[]
    optimized?: OptimizedPeptide[]
    diversityMetrics?: Record<string, number>
    generationMethod?: string
    processingTime?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<PepinventStatusResponse | null>(null)
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({})

  // 新增状态：项目管理
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const [projectList, setProjectList] = useState<PeptideDesignData[]>([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectPage, setProjectPage] = useState(1)
  const [projectTotal, setProjectTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedProject, setSelectedProject] = useState<PeptideDesignData | null>(null)

  // 加载项目列表
  const loadProjects = useCallback(async (page = 1, status = '') => {
    setProjectLoading(true)
    try {
      const response = await peptideDesignApi.listProjects({
        page,
        page_size: 12,
        status: status || undefined,
      })
      setProjectList(response.items)
      setProjectTotal(response.total)
      setProjectPage(page)
    } catch (err: any) {
      logger.error('加载项目列表失败:', err)
    } finally {
      setProjectLoading(false)
    }
  }, [])

  // 组件挂载时加载项目列表
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 保存当前设计为项目
  const handleSaveProject = async () => {
    if (!results) {
      addToast({ type: 'warning', title: '提示', message: '请先生成或优化肽序列' })
      return
    }

    setSavingProject(true)
    try {
      // 创建项目
      const projectResponse = await peptideDesignApi.createProject({
        project_name: `设计项目_${new Date().toLocaleDateString()}`,
        target_effects: selectedEffects.map(e => {
          // 映射中文到英文
          const map: Record<string, string> = {
            'ACE抑制': 'ACE_inhibitory',
            '抗氧化': 'antioxidant',
            'DPP-IV抑制': 'DPP_IV_inhibitory',
            '增强渗透性': 'permeability',
            '提高稳定性': 'stability',
          }
          return map[e] || e
        }),
        objective_weights: {},
      })

      const projectId = projectResponse.data.id

      // 添加候选方案
      const candidates = (results.peptides || results.optimized || []).map((p: PeptideResult | OptimizedPeptide, idx) => {
        // 使用类型守卫区分 PeptideResult 和 OptimizedPeptide
        const isPeptideResult = 'activity_scores' in p && 'composite_score' in p
        const peptide = p as PeptideResult

        return {
          sequence: p.sequence,
          objectives_scores: isPeptideResult ? (peptide.activity_scores || { composite_score: peptide.composite_score }) : { weighted_score: (p).weighted_score },
          rank: idx + 1,
          is_pareto_frontier: idx < 3, // 假设前3个是Pareto前沿
          dominated_by_count: Math.max(0, idx - 2),
        }
      })

      if (candidates.length > 0) {
        await peptideDesignApi.addCandidates(projectId, candidates)
      }

      setCurrentProjectId(projectId)
      addToast({ type: 'success', title: '保存成功', message: `项目已保存！ID: ${projectId}，包含 ${candidates.length} 个候选方案` })
      await loadProjects(1)
    } catch (err: any) {
      logger.error('保存项目失败:', err)
      addToast({ type: 'error', title: '保存失败', message: err.message || '未知错误' })
    } finally {
      setSavingProject(false)
    }
  }

  // 加载项目详情
  const handleLoadProject = async (id: number) => {
    try {
      const project = await peptideDesignApi.getProject(id)
      setSelectedProject(project.data)
      setCurrentProjectId(id)
      setMainView('design')

      // 恢复结果显示（简化版）
      if (project.data.candidates && project.data.candidates.length > 0) {
        setResults({
          peptides: project.data.candidates.map(c => ({
            sequence: c.sequence,
            molecular_weight: 0,
            logp: 0,
            tpsa: 0,
            activity_scores: c.objectives_scores,
            composite_score: Object.values(c.objectives_scores).reduce((a, b) => a + b, 0) / Object.keys(c.objectives_scores).length,
            amino_acid_count: c.sequence.length,
          })),
        })
      }
    } catch (err: any) {
      logger.error('加载项目失败:', err)
      addToast({ type: 'error', title: '加载失败', message: '请重试' })
    }
  }

  // 归档项目
  const handleArchiveProject = async (id: number) => {
    if (!confirm('确认归档此项目？归档后不可编辑。')) return

    try {
      await peptideDesignApi.archiveProject(id)
      addToast({ type: 'success', title: '归档成功', message: '项目已归档' })
      await loadProjects(projectPage, statusFilter)
      if (selectedProject?.id === id) {
        setSelectedProject(null)
      }
    } catch (err: any) {
      logger.error('归档失败:', err)
      addToast({ type: 'error', title: '归档失败', message: '请重试' })
    }
  }

  const fetchServiceStatus = useCallback(async () => {
    try {
      const status = await peptideDesignApi.getPepinventStatus()
      setServiceStatus(status)
    } catch (err: any) {
      if (err?.response?.status === 422 || err?.response?.status === 404) {
        logger.warn('[AdvancedPeptideDesign] PepInvent 服务暂不可用 (HTTP ' + (err?.response?.status || 'N/A') + ')')
        setServiceStatus({
          service_name: 'PepInvent',
          version: 'unknown',
          available: false,
          initialized: false,
          simulation_mode: true,
          device: 'unknown',
          dependencies: {
            available: false,
            missing: ['服务不可用'],
            version_info: {},
          },
          config: {},
          cache_stats: {
            cache_size: 0,
            cache_enabled: false,
          },
          models_loaded: [],
          last_error: err.message || '服务连接失败',
        } as PepinventStatusResponse)
      } else if (err?.response?.status === 401) {
        logger.warn('[AdvancedPeptideDesign] 未登录状态，跳过服务状态检查')
      } else {
        logger.error('获取服务状态失败:', err)
      }
    }
  }, [])

  React.useEffect(() => {
    fetchServiceStatus()
  }, [fetchServiceStatus])

  const toggleEffect = (effectId: string) => {
    setSelectedEffects(prev =>
      prev.includes(effectId)
        ? prev.filter(e => e !== effectId)
        : [...prev, effectId],
    )
  }

  const handleGenerate = async () => {
    if (selectedEffects.length === 0) {
      setError('请至少选择一个目标功效')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await peptideDesignApi.generatePeptides(selectedEffects, { max_candidates: maxCandidates })

      if (response.success) {
        setResults({
          peptides: response.data.peptides,
          diversityMetrics: response.data.diversity_metrics,
          generationMethod: response.data.generation_method,
          processingTime: response.data.processing_time_ms,
        })
        onPeptidesGenerated?.(response.data.peptides)
      } else {
        setError('生成失败：服务返回异常状态')
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 405) {
        setError('接口错误 (405): API路径配置不正确，请检查前后端路由是否匹配')
        logger.error('[AdvancedPeptideDesign] HTTP 405 Method Not Allowed - 路由不匹配', { url: '/ai/peptide/generate', method: 'POST' })
      } else if (status === 422) {
        setError('参数错误 (422): 请检查输入参数是否符合要求（如目标功效、序列长度等）')
        logger.warn('[AdvancedPeptideDesign] 参数验证失败', { detail: err?.response?.data })
      } else if (status === 503) {
        logger.warn('[AdvancedPeptideDesign] PepINVERT 服务不可用，切换到模拟生成模式')
        const simulated = generateSimulatedPeptides(selectedEffects, maxCandidates)
        setResults({
          peptides: simulated as PeptideResult[],
          diversityMetrics: { tanimoto: 0.6 + Math.random() * 0.3 },
          generationMethod: 'simulation_fallback',
          processingTime: Date.now(),
        })
        onPeptidesGenerated?.(simulated as PeptideResult[])
        addToast({ type: 'info', title: '模拟模式', message: 'PepINVERT 服务不可用，已使用本地模拟生成' })
      } else if (status === 401) {
        setError('身份验证失败 (401): 请先登录后再使用肽设计功能')
        logger.warn('[AdvancedPeptideDesign] 用户未登录')
      } else if (err?.code === 'ERR_NETWORK') {
        setError('网络连接失败: 无法连接到后端服务器，请检查网络或后端服务是否启动')
      } else {
        const errorMsg = err?.response?.data?.detail || err.message || '生成过程中发生未知错误'
        setError(`生成失败: ${errorMsg}`)
        logger.error('[AdvancedPeptideDesign] 生成肽序列失败', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOptimize = async () => {
    const seedInput = document.getElementById('seed-sequence') as HTMLInputElement | null
    const seedSequence = seedInput?.value || ''
    if (!seedSequence || seedSequence.length < 2) {
      setError('请输入有效的种子序列（至少2个氨基酸）')
      return
    }

    const goals: Record<string, number> = {}
    OPTIMIZATION_GOALS.forEach(goal => {
      const input = document.getElementById(`goal-${goal.id}`) as HTMLInputElement | null
      if (input && input.value && parseFloat(input.value) > 0) {
        goals[goal.id] = parseFloat(input.value)
      }
    })

    const iterationsInput = document.getElementById('iterations') as HTMLInputElement | null
    const iterations = parseInt(iterationsInput?.value || '10', 10)

    setLoading(true)
    setError(null)
    setResults(null)

    try {

      if (Object.keys(goals).length === 0) {
        setError('请至少设置一个优化目标权重')
        setLoading(false)
        return
      }

      const iterationsInput = document.getElementById('iterations') as HTMLInputElement | null
      const iterations = parseInt(iterationsInput?.value || '10')

      const response = await peptideDesignApi.optimizePeptide(seedSequence, goals, iterations)

      if (response.success) {
        setResults({
          optimized: response.data.optimized_peptides,
          processingTime: response.data.processing_time_ms,
        })
      } else {
        setError('优化失败：服务返回异常状态')
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 405) {
        setError('接口错误 (405): API路径配置不正确，请检查前后端路由是否匹配')
        logger.error('[AdvancedPeptideDesign] HTTP 405 Method Not Allowed', { url: '/ai/peptide/optimize', method: 'POST' })
      } else if (status === 422) {
        setError('参数错误 (422): 种子序列格式错误或优化目标权重设置不当')
        logger.warn('[AdvancedPeptideDesign] 参数验证失败', { detail: err?.response?.data })
      } else if (status === 503) {
        logger.warn('[AdvancedPeptideDesign] 优化服务不可用，切换到模拟优化模式')
        const seedSeq = seedSequence
        const simOptimized: OptimizedPeptide[] = Array.from({ length: 3 }, (_, i) => ({
          sequence: randomMutate(seedSeq, 1 + i),
          scores: Object.fromEntries(Object.keys(goals).map((k, idx) => [k, Math.min(98, goals[k] * 1.2 + idx * 5)])),
          weighted_score: 0.7 + Math.random() * 0.25,
          improvement_over_seed: 0.05 + Math.random() * 0.15,
          iteration_improved: iterations,
        }))
        setResults({ optimized: simOptimized, processingTime: Date.now() })
        addToast({ type: 'info', title: '模拟模式', message: 'RL优化引擎不可用，已使用本地模拟优化' })
      } else if (err?.code === 'ERR_NETWORK') {
        setError('网络连接失败: 无法连接到后端服务器')
      } else {
        const errorMsg = err?.response?.data?.detail || err.message || '优化过程中发生未知错误'
        setError(`优化失败: ${errorMsg}`)
        logger.error('[AdvancedPeptideDesign] RL优化失败', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSample = async () => {
    const sampleSizeInput = document.getElementById('sample-size') as HTMLInputElement | null
    const sampleSize = parseInt(sampleSizeInput?.value || '20')
    const temperatureInput = document.getElementById('temperature') as HTMLInputElement | null
    const temperature = temperatureInput?.value ? parseFloat(temperatureInput.value) : undefined

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await peptideDesignApi.sampleDiversePeptides(
        [],
        sampleSize,
        temperature,
      )

      if (response.success) {
        setResults({
          peptides: response.data.peptides.map((p: { sequence: string; molecular_weight: number; smiles?: string; properties?: Record<string, unknown>; amino_acid_count: number }) => ({
            sequence: p.sequence,
            molecular_weight: p.molecular_weight,
            logp: (p.properties?.logp as number) || 0,
            tpsa: (p.properties?.tpsa as number) || 0,
            activity_scores: {},
            composite_score: 0,
            amino_acid_count: p.amino_acid_count,
            properties: p.properties,
          })),
          diversityMetrics: {
            diversity_score: response.data.diversity_metrics.diversity_score,
            unique_count: response.data.diversity_metrics.unique_count,
            average_similarity: response.data.diversity_metrics.average_similarity,
          },
          processingTime: response.data.processing_time_ms,
        })
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 405) {
        setError('接口错误 (405): API路径配置不正确，请检查前后端路由是否匹配')
        logger.error('[AdvancedPeptideDesign] HTTP 405 Method Not Allowed', { url: '/ai/peptide/sample', method: 'POST' })
      } else if (status === 422) {
        setError('参数错误 (422): 采样参数超出范围（采样数量:1-100, 温度:0.1-5.0）')
        logger.warn('[AdvancedPeptideDesign] 采样参数验证失败', { detail: err?.response?.data })
      } else if (status === 503) {
        logger.warn('[AdvancedPeptideDesign] 采样服务不可用，切换到模拟采样模式')
        const simPeptides = generateSimulatedPeptides(
          Object.keys(selectedEffects).length > 0 ? selectedEffects : ['ACE抑制'],
          sampleSize,
        )
        setResults({ peptides: simPeptides as PeptideResult[], processingTime: Date.now() })
        addToast({ type: 'info', title: '模拟模式', message: '采样服务不可用，已使用本地模拟采样' })
      } else if (err?.code === 'ERR_NETWORK') {
        setError('网络连接失败: 无法连接到后端服务器')
      } else {
        const errorMsg = err?.response?.data?.detail || err.message || '采样过程中发生未知错误'
        setError(`采样失败: ${errorMsg}`)
        logger.error('[AdvancedPeptideDesign] 探索性采样失败', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleDetails = (key: string) => {
    setShowDetails(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 ${className}`}>
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-accent-500 to-danger-500 rounded-lg">
              <Atom className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">高级肽设计</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">基于 PepINVERT 的分子级肽序列设计</p>
            </div>
          </div>
          {serviceStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                 style={{
                   backgroundColor: serviceStatus.available ? '#dcfce7' : '#FFF0F0',
                   color: serviceStatus.available ? '#1E8E3E' : '#DC2626',
                 }}>
              <span className={`w-2 h-2 rounded-full ${serviceStatus.available ? 'bg-success-500' : 'bg-error-500'}`} />
              {serviceStatus.simulation_mode ? '模拟模式' : '就绪'}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {/* 主视图切换：新设计 | 我的项目 */}
          <div className="flex gap-1 mr-4 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <button
              onClick={() => setMainView('design')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainView === 'design'
                  ? 'bg-white dark:bg-neutral-700 shadow text-accent-600'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Sparkles className="w-4 h-4 inline mr-1" />
              新设计
            </button>
            <button
              onClick={() => setMainView('projects')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                mainView === 'projects'
                  ? 'bg-white dark:bg-neutral-700 shadow text-secondary-600'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <FolderOpen className="w-4 h-4 inline mr-1" />
              我的项目 ({projectTotal})
            </button>
          </div>

          {mainView === 'design' && (
            <>
              {(['generate', 'optimize', 'sample'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setResults(null); setError(null) }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-accent-500 to-danger-500 text-white shadow-md'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {tab === 'generate' && <Sparkles className="w-4 h-4 inline mr-1" />}
                  {tab === 'optimize' && <Zap className="w-4 h-4 inline mr-1" />}
                  {tab === 'sample' && <RefreshCw className="w-4 h-4 inline mr-1" />}
                  {tab === 'generate' ? '智能生成' : tab === 'optimize' ? 'RL 优化' : '探索采样'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* 我的项目视图 */}
        {mainView === 'projects' && (
          <div className="space-y-4">
            {/* 筛选栏 */}
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); loadProjects(1, e.target.value) }}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="archived">已归档</option>
              </select>
            </div>

            {/* 项目卡片网格 */}
            {projectLoading ? (
              <div className="text-center py-12 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                加载项目列表...
              </div>
            ) : projectList.length === 0 ? (
              <div className="text-center py-16 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">暂无设计项目</h3>
                <p className="text-sm">开始新设计并保存您的第一个项目</p>
                <button
                  onClick={() => setMainView('design')}
                  className="mt-4 px-6 py-2 bg-accent-container text-accent-main rounded-lg hover:bg-accent-container"
                >
                  开始新设计
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectList.map((project) => (
                    <div
                      key={project.id}
                      className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* 项目头部 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-neutral-900 dark:text-white truncate">
                            {project.project_name || `项目 #${project.id}`}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                            <span className={`px-2 py-0.5 rounded-full ${
                              project.status === 'completed' ? 'bg-success-100 text-success-700' :
                              project.status === 'in_progress' ? 'bg-secondary-100 text-secondary-700' :
                              project.status === 'draft' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700' :
                              'bg-error-100 text-error-700'
                            }`}>
                              {project.status === 'completed' ? '已完成' :
                               project.status === 'in_progress' ? '进行中' :
                               project.status === 'draft' ? '草稿' : '已归档'}
                            </span>
                            <span>• v{project.version}</span>
                          </div>
                        </div>
                      </div>

                      {/* 统计信息 */}
                      <div className="grid grid-cols-2 gap-2 text-center text-sm mb-3">
                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded p-2">
                          <div className="font-bold text-accent-600">{project.total_candidates}</div>
                          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">候选方案</div>
                        </div>
                        <div className="bg-neutral-50 dark:bg-neutral-800 rounded p-2">
                          <div className="font-bold text-success-600">{project.pareto_size}</div>
                          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">Pareto前沿</div>
                        </div>
                      </div>

                      {/* 目标活性标签 */}
                      {(project.target_effects || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {project.target_effects.slice(0, 3).map(effect => (
                            <span key={effect} className="px-2 py-0.5 bg-secondary-100 dark:bg-secondary-300/25 text-secondary-700 dark:text-secondary-700 rounded text-xs">
                              {effect}
                            </span>
                          ))}
                          {project.target_effects.length > 3 && (
                            <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded text-xs">
                              +{project.target_effects.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                        <button
                          onClick={() => handleLoadProject(project.id)}
                          className="flex-1 px-3 py-1.5 bg-accent-100 text-accent-700 rounded hover:bg-accent-200 flex items-center justify-center gap-1.5 text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          查看
                        </button>
                        <button
                          onClick={() => handleArchiveProject(project.id)}
                          className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 rounded hover:bg-neutral-200 flex items-center justify-center gap-1.5 text-sm"
                          title="归档项目"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 时间戳 */}
                      <div className="mt-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        创建于 {new Date(project.created_at).toLocaleDateString()}
                        {project.updated_at !== project.created_at && (
                          <> • 更新于 {new Date(project.updated_at).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分页控件 */}
                {projectTotal > 12 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      onClick={() => loadProjects(projectPage - 1, statusFilter)}
                      disabled={projectPage <= 1}
                      className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:bg-neutral-800"
                    >
                      上一页
                    </button>
                    <span className="py-2 px-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      第 {projectPage} / {Math.ceil(projectTotal / 12)} 页
                    </span>
                    <button
                      onClick={() => loadProjects(projectPage + 1, statusFilter)}
                      disabled={projectPage * 12 >= projectTotal}
                      className="px-4 py-2 border rounded disabled:opacity-50 hover:bg-neutral-100 dark:bg-neutral-800"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 新设计视图（原有内容） */}
        {mainView === 'design' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                选择目标功效（可多选）
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {TARGET_EFFECTS.map(effect => (
                  <button
                    key={effect.id}
                    onClick={() => toggleEffect(effect.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedEffects.includes(effect.id)
                        ? `border-${effect.color}-500 bg-${effect.color}-50 dark:bg-${effect.color}-900/20`
                        : 'border-neutral-200 dark:border-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{effect.label}</div>
                    <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{effect.message}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  候选数量
                </label>
                <select
                  value={maxCandidates}
                  onChange={(e) => setMaxCandidates(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  {[3, 5, 8, 10, 15, 20].map(n => (
                    <option key={n} value={n}>{n} 条候选</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading || selectedEffects.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-[var(--color-accent-surface)] to-[var(--color-danger-surface-deep)] text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                开始生成
              </button>
            </div>
          </div>
        )}

        {activeTab === 'optimize' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                种子肽序列
              </label>
              <input
                id="seed-sequence"
                type="text"
                placeholder="例如: VLGYT 或 LRPFF"
                defaultValue="VLGYT"
                className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                优化目标及权重（总和应接近 1.0）
              </label>
              <div className="grid grid-cols-2 gap-4">
                {OPTIMIZATION_GOALS.map(goal => (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{goal.label}</span>
                      <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{goal.defaultWeight}</span>
                    </div>
                    <input
                      id={`goal-${goal.id}`}
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      defaultValue={goal.defaultWeight}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  迭代次数
                </label>
                <input
                  id="iterations"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue="10"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
              <button
                onClick={handleOptimize}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-[var(--color-warning-surface)] to-error-500 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                RL 优化
              </button>
            </div>
          </div>
        )}

        {activeTab === 'sample' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  采样数量
                </label>
                <input
                  id="sample-size"
                  type="number"
                  min="5"
                  max="100"
                  defaultValue="20"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  温度（可选）
                </label>
                <input
                  id="temperature"
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  placeholder="默认 1.0"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Top-K（可选）
                </label>
                <input
                  id="top-k"
                  type="number"
                  min="1"
                  max="200"
                  placeholder="默认 50"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <button
              onClick={handleSample}
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-[var(--color-info-surface)] to-[var(--color-secondary-surface-deep)] text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              探索性采样
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error-500 mt-0.5" />
            <div className="text-error-700 dark:text-error-600 text-sm">{error}</div>
          </div>
        )}

        {results && mainView === 'design' && (
          <div className="mt-6 space-y-4">
            {/* 项目操作工具栏 */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-secondary-900/20 dark:to-accent-900/20 rounded-lg border border-secondary-200 dark:border-secondary-800">
              <div className="flex items-center gap-3">
                {currentProjectId ? (
                  <>
                    <FolderOpen className="w-5 h-5 text-success-600" />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      已保存到项目 #{currentProjectId}
                    </span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 text-warning-600" />
                    <span className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">设计完成，可保存为项目</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!currentProjectId && (
                  <button
                    onClick={handleSaveProject}
                    disabled={savingProject}
                    className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                  >
                    {savingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存为项目
                  </button>
                )}

                <button
                  onClick={() => setMainView('projects')}
                  className="px-3 py-2 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1.5 text-sm"
                >
                  <FolderOpen className="w-4 h-4" />
                  查看所有项目
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success-500" />
                生成结果
              </h4>
              <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {results.generationMethod && <span className="mr-3">方法: {results.generationMethod}</span>}
                {results.processingTime && <span>耗时: {results.processingTime}ms</span>}
              </div>
            </div>

            {results.diversityMetrics && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent-600">{((results.diversityMetrics.diversity_score ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">多样性得分</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary-600">{results.diversityMetrics.unique_count}</div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">唯一序列数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-success-600">{((results.diversityMetrics.average_similarity ?? 0) * 100).toFixed(1)}%</div>
                  <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">平均相似度</div>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(results.peptides || results.optimized)?.map((peptide, idx) => {
                const seq = 'sequence' in peptide ? peptide.sequence : (peptide as OptimizedPeptide).sequence
                const score = 'composite_score' in peptide ? peptide.composite_score : (peptide).weighted_score

                return (
                  <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleDetails(`peptide-${idx}`)}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-accent-100 dark:bg-accent-300/25 text-accent-700 dark:text-accent-700 rounded text-xs font-mono font-bold">
                          #{idx + 1}
                        </span>
                        <code className="text-lg font-bold text-neutral-900 dark:text-white font-mono">{seq}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gradient-to-r from-success-100 to-success-100 dark:from-success-900/30 dark:to-success-900/30 text-success-700 dark:text-success-600 rounded-full text-sm font-semibold">
                          {(score * 100).toFixed(1)}%
                        </span>
                        {showDetails[`peptide-${idx}`] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {showDetails[`peptide-${idx}`] && (
                      <div className="px-4 pb-4 pt-2 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">分子量</span>
                            <div className="font-semibold">{('molecular_weight' in peptide ? peptide.molecular_weight : 0).toFixed(1)} Da</div>
                          </div>
                          <div>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">LogP</span>
                            <div className="font-semibold">{('logp' in peptide ? peptide.logp : 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">TPSA</span>
                            <div className="font-semibold">{('tpsa' in peptide ? peptide.tpsa : 0).toFixed(1)} Å²</div>
                          </div>
                          <div>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">长度</span>
                            <div className="font-semibold">{seq.length} AA</div>
                          </div>
                        </div>
                        {'activity_scores' in peptide && Object.keys(peptide.activity_scores).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-600">
                            <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">活性预测</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(peptide.activity_scores).map(([key, val]: [string, number]) => (
                                <span key={key} className="px-2 py-1 bg-secondary-100 dark:bg-secondary-300/25 text-secondary-700 dark:text-secondary-700 rounded text-xs">
                                  {key}: {(val * 100).toFixed(1)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
