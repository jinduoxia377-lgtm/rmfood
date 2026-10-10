import { useState, useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { aiApi } from '@/api/ai'
import type { GeneticGenerateResponse } from '@/api/ai'
import { ParamSlider, StatCard, CandidateCard } from './GeneticAlgorithmPanelSubComponents'
import { GAFitnessChart, GADiversityChart } from './GAPanelCharts'
import { EFFECT_OPTIONS, DEFAULT_EFFECT } from '@/config/ai/effects'
import { getAuthToken } from '@/hooks/useSSEAuth'

// 获取 CSRF Token（与 api/client.ts 保持一致）
function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'))
  return match ? match[2] : null
}
import {
  Card,
  Button,
  Slider,
  Badge,
  Input,
  Alert,
  AlertTitle,
  AlertDescription,
  Switch,
} from '@/components/ui'
import {
  Dna,
  Play,
  Square,
  RotateCcw,
  Settings2,
  TrendingUp,
  FlaskConical,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  Target,
  Shield,
  DollarSign,
  Download,
  Wifi,
  WifiOff,
  SlidersHorizontal,
} from 'lucide-react'

// ─── 权重选项 ───

interface WeightOption {
  key: string
  label: string
  default: number
}

const WEIGHT_OPTIONS: WeightOption[] = [
  { key: 'efficacy', label: '功效', default: 0.30 },
  { key: 'safety', label: '安全', default: 0.25 },
  { key: 'taste', label: '口感', default: 0.10 },
  { key: 'cost', label: '成本', default: 0.15 },
  { key: 'synergy', label: '协同', default: 0.10 },
  { key: 'stability', label: '稳定', default: 0.10 },
]

// ─── 类型定义 ───

interface GenerationRecord {
  generation: number
  best_fitness: number
  avg_fitness: number
  min_fitness: number
  diversity: number
}

// ─── 预设配置 ───

interface AlgorithmPreset {
  name: string
  label: string
  params: {
    populationSize: number
    generations: number
    mutationRate: number
    crossoverRate: number
    eliteRatio: number
    tournamentSize: number
    count: number
  }
}

const PRESETS: AlgorithmPreset[] = [
  {
    name: 'default',
    label: '默认',
    params: { populationSize: 50, generations: 40, mutationRate: 0.15, crossoverRate: 0.85, eliteRatio: 0.15, tournamentSize: 5, count: 5 },
  },
  {
    name: 'quick',
    label: '快速探索',
    params: { populationSize: 30, generations: 15, mutationRate: 0.2, crossoverRate: 0.8, eliteRatio: 0.1, tournamentSize: 3, count: 3 },
  },
  {
    name: 'deep',
    label: '深度优化',
    params: { populationSize: 100, generations: 100, mutationRate: 0.1, crossoverRate: 0.9, eliteRatio: 0.2, tournamentSize: 7, count: 8 },
  },
  {
    name: 'global',
    label: '全局搜索',
    params: { populationSize: 200, generations: 150, mutationRate: 0.3, crossoverRate: 0.7, eliteRatio: 0.05, tournamentSize: 10, count: 10 },
  },
]

// ─── 参数默认值 ───

const DEFAULT_PARAMS = PRESETS[0].params

interface AlgorithmParams {
  populationSize: number
  generations: number
  mutationRate: number
  crossoverRate: number
  eliteRatio: number
  tournamentSize: number
  count: number
}

// ─── 主组件 ───

interface GeneticAlgorithmPanelProps {
  className?: string
}

export function GeneticAlgorithmPanel({ className }: GeneticAlgorithmPanelProps) {
  // ── 功效选择 ──
  const [selectedEffects, setSelectedEffects] = useState<string[]>([])

  // ── 算法参数 ──
  const [params, setParams] = useState<AlgorithmParams>({ ...DEFAULT_PARAMS })

  // ── 约束条件 ──
  const [excludeHerbs, setExcludeHerbs] = useState<string[]>([])
  const [excludedInput, setExcludedInput] = useState('')
  const [maxCost, setMaxCost] = useState<number | null>(null)
  const [includeHerbs, setIncludeHerbs] = useState<string[]>([])
  const [includedInput, setIncludedInput] = useState('')

  // ── 权重调节 ──
  const [adjustedWeights, setAdjustedWeights] = useState<Record<string, number>>({})

  // ── 混合模式 ──
  const [hybridMode, setHybridMode] = useState(true)
  const [warmStartEnabled, setWarmStartEnabled] = useState(true)
  const [totalDosage, setTotalDosage] = useState(100)
  const [nutritionConstraints, setNutritionConstraints] = useState<Array<{
    nutrient: string
    min_value: number | null
    max_value: number | null
  }>>([
    { nutrient: 'protein', min_value: 5, max_value: null },
    { nutrient: 'fat', min_value: null, max_value: 30 },
    { nutrient: 'sodium', min_value: null, max_value: 400 },
  ])

  // ── 流式模式 ──
  const [isStreamingMode, setIsStreamingMode] = useState(true)
  const [liveHistory, setLiveHistory] = useState<GenerationRecord[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // ── 参数警告 ──
  const [paramWarning, setParamWarning] = useState<string | null>(null)
  const [paramError, setParamError] = useState<string | null>(null)

  // ── 运行状态 ──
  const [logs, setLogs] = useState<Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }>>([])
  const [result, setResult] = useState<GeneticGenerateResponse | null>(null)
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // ── 日志辅助 ──
  const addLog = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const now = new Date()
    const time = now.toLocaleTimeString('zh-CN', { hour12: false })
    setLogs(prev => [...prev.slice(-99), { time, message, level }])
    // 自动滚动到底部
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      }
    }, 0)
  }, [])

  // ── Mutation（非流式模式） ──
  const mutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController()
      abortRef.current = controller

      addLog('🧬 初始化遗传算法引擎...', 'info')

      const constraints: Record<string, unknown> = {}
      if (excludeHerbs.length > 0) {
        constraints.exclude_herbs = excludeHerbs
      }
      if (includeHerbs.length > 0) {
        constraints.include_herbs = includeHerbs
      }
      if (maxCost !== null && maxCost > 0) {
        constraints.max_cost = maxCost
      }

      addLog(`📊 种群大小=${params.populationSize}, 代数=${params.generations}, 模式=${hybridMode ? 'BinaryGA+MILP' : '标准GA'}`, 'info')

      if (hybridMode) {
        return await aiApi.generateGeneticHybrid(
          {
            targetEffects: selectedEffects,
            ...params,
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
            totalDosage,
            warmStartEnabled,
          },
          controller.signal,
        )
      } else {
        return await aiApi.generateGenetic(
          {
            targetEffects: selectedEffects,
            ...params,
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
          },
          controller.signal,
        )
      }
    },
    onSuccess: (data) => {
      addLog(`进化完成！共 ${data.total_generations} 代，最佳得分 ${data.best_score.toFixed(4)}`, 'info')
      setResult(data as GeneticGenerateResponse)
      abortRef.current = null
    },
    onError: (error) => {
      if ((error as Error).name === 'AbortError') {
        addLog('⏹️ 用户终止了进化过程', 'warn')
      } else {
        const msg = (error as Error)?.message || '未知错误'
        addLog(`❌ 进化失败：${msg}`, 'error')
      }
      abortRef.current = null
    },
  })

  // ── 构建请求体 ──
  const buildRequestBody = useCallback(() => {
    const constraints: Record<string, unknown> = {}
    if (excludeHerbs.length > 0) {
      constraints.exclude_herbs = excludeHerbs
    }
    if (includeHerbs.length > 0) {
      constraints.include_herbs = includeHerbs
    }
    if (maxCost !== null && maxCost > 0) {
      constraints.max_cost = maxCost
    }
    return {
      target_effects: selectedEffects,
      ...params,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      include_herbs: includeHerbs.length > 0 ? includeHerbs : undefined,
      hybrid_mode: hybridMode,
      total_dosage: hybridMode ? totalDosage : undefined,
      nutrition_constraints: hybridMode ? nutritionConstraints : undefined,
      warm_start_enabled: warmStartEnabled,
    }
  }, [selectedEffects, params, excludeHerbs, includeHerbs, maxCost, hybridMode, totalDosage, nutritionConstraints, warmStartEnabled])

  // ── SSE 流式执行 ──
  const executeStreaming = useCallback(async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setLiveHistory([])
    setResult(null)
    setLogs([])
    setParamWarning(null)
    setParamError(null)

    addLog('🧬 初始化遗传算法引擎（流式模式）...', 'info')
    addLog(`📊 种群大小=${params.populationSize}, 代数=${params.generations}, 变异率=${params.mutationRate}`, 'info')

    try {
      const token = getAuthToken()
      const requestBody = buildRequestBody()

      const response = await fetch(hybridMode
        ? '/api/v1/ai/generate/genetic/hybrid/stream'
        : '/api/v1/ai/generate/genetic/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // 🔒 关键修复：启用 credentials 使浏览器自动携带 HttpOnly Cookie
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('event:')) {
            currentEventType = trimmed.replace('event:', '').trim()
          } else if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.replace('data:', '').trim())
              handleSSEEvent(currentEventType, data)
            } catch {
              // 忽略解析错误的数据行
            }
            currentEventType = ''
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        addLog('⏹️ 用户终止了进化过程', 'warn')
      } else {
        const msg = (err as Error)?.message || '未知错误'
        addLog(`❌ 流式进化失败：${msg}`, 'error')
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [buildRequestBody, params, addLog])

  // ── SSE 事件处理 ──
  const handleSSEEvent = useCallback((eventType: string, data: unknown) => {
    switch (eventType) {
      case 'start':
        addLog(`🚀 进化开始：${JSON.stringify((data as Record<string, unknown>).config ?? data)}`, 'info')
        break
      case 'progress': {
        const record = data as GenerationRecord
        setLiveHistory(prev => [...prev, record])
        if (record.generation % Math.max(1, Math.floor(params.generations / 10)) === 0 || record.generation <= 3) {
          addLog(`📈 第 ${record.generation} 代：最佳适应度 ${record.best_fitness.toFixed(4)}`, 'info')
        }
        break
      }
      case 'complete': {
        const finalData = data as GeneticGenerateResponse
        addLog(`✅ 进化完成！共 ${finalData.total_generations} 代，最佳得分 ${finalData.best_score.toFixed(4)}`, 'info')
        setResult(finalData)
        break
      }
      case 'error': {
        const errMsg = (data as Record<string, unknown>)?.message || String(data)
        addLog(`❌ 服务端错误：${errMsg}`, 'error')
        break
      }
      case 'done':
        addLog('🔌 服务端连接已关闭', 'info')
        break
      default:
        break
    }
  }, [addLog, params.generations])

  // ── 效果切换 ──
  const toggleEffect = useCallback((effectId: string) => {
    setSelectedEffects(prev =>
      prev.includes(effectId) ? prev.filter(e => e !== effectId) : [...prev, effectId],
    )
  }, [])

  // ── 参数更新 ──
  const updateParam = <K extends keyof AlgorithmParams>(key: K, value: AlgorithmParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  // ── 预设应用 ──
  const applyPreset = useCallback((preset: AlgorithmPreset) => {
    setParams({ ...preset.params })
    addLog(`⚙️ 已应用预设「${preset.label}」`, 'info')
  }, [addLog])

  // ── 排除药材管理 ──
  const addExcludedIngredient = useCallback(() => {
    const items = excludedInput.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    if (items.length > 0) {
      setExcludeHerbs(prev => [...new Set([...prev, ...items])])
      setExcludedInput('')
    }
  }, [excludedInput])

  const removeExcludedIngredient = useCallback((item: string) => {
    setExcludeHerbs(prev => prev.filter(i => i !== item))
  }, [])

  // ── 基础配方管理（用户指定强制包含的药材） ──
  const addIncludedIngredient = useCallback(() => {
    const items = includedInput.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    if (items.length > 0) {
      setIncludeHerbs(prev => [...new Set([...prev, ...items])])
      setIncludedInput('')
    }
  }, [includedInput])

  const removeIncludedIngredient = useCallback((item: string) => {
    setIncludeHerbs(prev => prev.filter(i => i !== item))
  }, [])

  // ── 权重调节 ──
  const handleWeightChange = useCallback((key: string, value: number) => {
    setAdjustedWeights(prev => ({ ...prev, [key]: value }))
  }, [])

  const normalizeWeights = useCallback(() => {
    const total = Object.values(adjustedWeights).reduce((a, b) => a + b, 0)
    if (total <= 0) return
    const normalized: Record<string, number> = {}
    Object.entries(adjustedWeights).forEach(([k, v]) => {
      normalized[k] = v / total
    })
    setAdjustedWeights(normalized)
  }, [adjustedWeights])

  // ── 参数合理性校验 ──
  const validateParams = useCallback(() => {
    setParamWarning(null)
    setParamError(null)
    const totalEvaluations = params.populationSize * params.generations
    if (totalEvaluations > 30000) {
      setParamError(`计算量过大（${totalEvaluations.toLocaleString()} 次），建议降低种群大小或代数`)
      return false
    }
    if (totalEvaluations > 15000) {
      setParamWarning(`计算量较大（${totalEvaluations.toLocaleString()} 次评估），预计需要较长时间`)
    }
    return true
  }, [params.populationSize, params.generations])

  // ── 导出 JSON ──
  const exportJSON = useCallback(() => {
    if (!result) return
    const data = {
      exported_at: new Date().toISOString(),
      parameters: { selectedEffects, ...params, excludeHerbs, maxCost },
      result,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ga-result-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, selectedEffects, params, excludeHerbs, maxCost])

  // ── 导出 CSV ──
  const exportCSV = useCallback(() => {
    if (!result) return
    const headers = ['排名', '综合评分', '功效评分', '安全评分', '口感评分', '成本评分', '置信度', '药材组成']
    const rows = result.candidates.map((c, i) => [
      i + 1,
      c.overall_score.toFixed(4),
      c.efficacy_score.toFixed(4),
      c.safety_score.toFixed(4),
      c.taste_score.toFixed(4),
      c.cost_score.toFixed(4),
      c.confidence.toFixed(4),
      c.ingredients.map(ing => `${ing.name_cn}(${ing.dosage}g)`).join('; '),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ga-candidates-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  // ── 开始 / 停止 ──
  const handleStart = () => {
    if (!validateParams()) return
    setResult(null)
    setLiveHistory([])
    setLogs([])
    if (isStreamingMode) {
      executeStreaming()
    } else {
      mutation.mutate()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    mutation.reset()
    setIsStreaming(false)
  }

  const handleReset = () => {
    handleStop()
    setResult(null)
    setSelectedEffects([])
    setParams({ ...DEFAULT_PARAMS })
    setExcludeHerbs([])
    setExcludedInput('')
    setMaxCost(null)
    setLogs([])
    setExpandedCard(null)
    setLiveHistory([])
    setIsStreaming(false)
    setParamWarning(null)
    setParamError(null)
    setWarmStartEnabled(true)
  }

  // ── 计算属性 ──
  // 允许不选功效：后端 GAConfig.__post_init__ 会兜底 ["免疫调节"]
  const canRun = !mutation.isPending && !isStreaming
  const isRunning = mutation.isPending || isStreaming
  const effectsHint = selectedEffects.length === 0
    ? '未选择功效，将使用默认值（免疫调节）'
    : `已选择 ${selectedEffects.length} 个功效`

  // ── 图表数据准备（流式模式使用 liveHistory，非流式使用 result.history）──
  const chartData = isStreamingMode && liveHistory.length > 0 ? liveHistory : result?.history ?? []

  return (
    <div className={`space-y-6 ${className ?? ''}`} role="region" aria-label="遗传算法配方生成面板">
      {/* 无障碍公告 */}
      <div aria-live="polite" className="sr-only">
        {isRunning ? '遗传算法正在运行' : result ? `进化完成，生成 ${result.candidates.length} 个方案` : '等待开始'}
      </div>

      {/* ══════════════════════════════
          1. 参数配置区
         ══════════════════════════════ */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/25">
            <Dna className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">遗传算法配方生成</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">基于进化计算智能搜索最优配方组合</p>
          </div>
        </div>

        {/* --- 目标功效选择 --- */}
        <section aria-labelledby="ga-effects-heading" className="mb-6">
          <h3 id="ga-effects-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-accent-500" />
            目标功效
            <Badge variant="neutral" size="sm">{selectedEffects.length} 已选</Badge>
          </h3>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="目标功效多选"
          >
            {EFFECT_OPTIONS.map(effect => (
              <button
                key={effect.id}
                onClick={() => toggleEffect(effect.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEffect(effect.id) } }}
                role="checkbox"
                aria-checked={selectedEffects.includes(effect.id)}
                aria-label={`功效: ${effect.label}`}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 ${
                  selectedEffects.includes(effect.id)
                    ? 'bg-accent-500 text-white shadow-sm shadow-accent-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {effect.label}
              </button>
            ))}
          </div>
          {selectedEffects.length === 0 && (
            <p className="text-xs text-warning-600 dark:text-warning-700 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              未选择功效时将使用默认值（免疫调节），建议至少选择一个目标
            </p>
          )}
        </section>

        {/* --- 预设按钮 --- */}
        <div className="mb-5">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">快速预设</span>
          <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="算法参数预设">
            {PRESETS.map(preset => (
              <Button
                key={preset.name}
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(preset)}
                aria-label={`应用${preset.label}预设`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* --- 算法参数网格 --- */}
        <section aria-labelledby="ga-params-heading" className="mb-6">
          <h3 id="ga-params-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-accent-500" />
            算法参数
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            {/* 种群大小 */}
            <ParamSlider
              label="种群大小"
              value={params.populationSize}
              min={10}
              max={200}
              step={1}
              onChange={(v) => updateParam('populationSize', v)}
              description="每代个体数量"
            />
            {/* 进化代数 */}
            <ParamSlider
              label="进化代数"
              value={params.generations}
              min={5}
              max={200}
              step={1}
              onChange={(v) => updateParam('generations', v)}
              description="最大迭代次数"
            />
            {/* 变异率 */}
            <ParamSlider
              label="变异率"
              value={params.mutationRate}
              min={0.01}
              max={0.5}
              step={0.01}
              onChange={(v) => updateParam('mutationRate', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="基因变异概率"
            />
            {/* 交叉率 */}
            <ParamSlider
              label="交叉率"
              value={params.crossoverRate}
              min={0.1}
              max={1.0}
              step={0.01}
              onChange={(v) => updateParam('crossoverRate', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="个体交叉概率"
            />
            {/* 精英保留比例 */}
            <ParamSlider
              label="精英保留比例"
              value={params.eliteRatio}
              min={0.05}
              max={0.4}
              step={0.01}
              onChange={(v) => updateParam('eliteRatio', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="最优个体直接保留比例"
            />
            {/* 锦标赛规模 */}
            <ParamSlider
              label="锦标赛规模"
              value={params.tournamentSize}
              min={2}
              max={20}
              step={1}
              onChange={(v) => updateParam('tournamentSize', v)}
              description="选择时的竞争数量"
            />
            {/* 候选方案数量 */}
            <ParamSlider
              label="候选方案数量"
              value={params.count}
              min={1}
              max={20}
              step={1}
              onChange={(v) => updateParam('count', v)}
              description="输出的 Top-N 方案数"
            />
          </div>
        </section>

        {/* --- 混合模式开关 --- */}
        <section aria-labelledby="ga-hybrid-heading" className="mb-6">
          <h3 id="ga-hybrid-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-3">
            <Dna className="w-4 h-4 text-accent-500" />
            混合优化模式
            <Badge variant={hybridMode ? "success" : "neutral"} size="sm">
              {hybridMode ? 'BinaryGA+MILP' : '标准GA'}
            </Badge>
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <Switch
              checked={hybridMode}
              onCheckedChange={setHybridMode}
              label={hybridMode ? '已开启' : '已关闭'}
              disabled={isRunning}
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {hybridMode
                ? '外层BinaryGA选择药材 + 内层MILP精确配比'
                : '标准实数编码遗传算法'}
            </span>
          </div>

          {hybridMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {/* 总剂量 */}
              <div>
                <label htmlFor="ga-total-dosage" className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">
                  总剂量 (g)
                </label>
                <Input
                  id="ga-total-dosage"
                  type="number"
                  value={totalDosage}
                  onChange={(e) => setTotalDosage(Number(e.target.value))}
                  placeholder="100"
                  min={10}
                  max={500}
                  aria-label="总剂量"
                />
              </div>

              {/* Warm Start */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={warmStartEnabled}
                    onChange={(e) => setWarmStartEnabled(e.target.checked)}
                    disabled={isRunning}
                    className="rounded border-neutral-300 dark:border-neutral-700"
                  />
                  启用Warm Start (上代最优配比初值)
                </label>
              </div>
            </div>
          )}
        </section>

        {/* --- 营养约束（可选）--- */}
        {hybridMode && (
          <section aria-labelledby="ga-nutrition-heading" className="mb-6">
            <h3 id="ga-nutrition-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-success-500" />
              营养约束
              <span className="text-xs font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">(每100g)</span>
            </h3>
            <div className="space-y-2">
              {nutritionConstraints.map((constraint, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 w-24">
                    {constraint.nutrient}
                  </span>
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">≥</span>
                  <Input
                    type="number"
                    value={constraint.min_value ?? ''}
                    onChange={(e) => {
                      const newConstraints = [...nutritionConstraints]
                      newConstraints[idx].min_value = e.target.value ? Number(e.target.value) : null
                      setNutritionConstraints(newConstraints)
                    }}
                    placeholder="下限"
                    className="w-24"
                    aria-label={`${constraint.nutrient} 下限`}
                  />
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">≤</span>
                  <Input
                    type="number"
                    value={constraint.max_value ?? ''}
                    onChange={(e) => {
                      const newConstraints = [...nutritionConstraints]
                      newConstraints[idx].max_value = e.target.value ? Number(e.target.value) : null
                      setNutritionConstraints(newConstraints)
                    }}
                    placeholder="上限"
                    className="w-24"
                    aria-label={`${constraint.nutrient} 上限`}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- 约束条件（可选）--- */}
        <section aria-labelledby="ga-constraints-heading">
          <h3 id="ga-constraints-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-accent-500" />
            约束条件
            <span className="text-xs font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">(可选)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 排除药材 */}
            <div>
              <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">排除药材</label>
              <div className="flex gap-2">
                <Input
                  value={excludedInput}
                  onChange={(e) => setExcludedInput(e.target.value)}
                  placeholder="输入药材名称，逗号分隔"
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcludedIngredient() } }}
                  aria-label="排除药材输入"
                />
                <Button variant="secondary" size="sm" onClick={addExcludedIngredient}>添加</Button>
              </div>
              {excludeHerbs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="list" aria-label="已排除的药材列表">
                  {excludeHerbs.map(item => (
                    <Badge key={item} variant="warning" size="sm" className="flex items-center gap-1 cursor-pointer" role="listitem">
                      {item}
                      <button
                        onClick={() => removeExcludedIngredient(item)}
                        aria-label={`移除排除项: ${item}`}
                        className="hover:text-error-700 focus:outline-none focus:ring-1 focus:ring-error-400 rounded"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            {/* 最大成本 */}
            <div>
              <label htmlFor="ga-max-cost" className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">最大成本（元）</label>
              <Input
                id="ga-max-cost"
                type="number"
                value={maxCost ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setMaxCost(v === '' ? null : Number(v))
                }}
                placeholder="不限制则留空"
                min={0}
                aria-label="最大成本限制"
              />
            </div>
          </div>
        </section>

        {/* --- 基础配方（可选：用户指定的药材）--- */}
        <section aria-labelledby="ga-included-heading">
          <h3 id="ga-included-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-success-500" />
            基础配方
            <span className="text-xs font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">(可选，强制包含)</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            指定药材将作为固定基础，优化器将在其基础上添加更多药材。若留空则由算法自动选择。
          </p>
          <div className="flex gap-2 mb-3">
            <Input
              value={includedInput}
              onChange={(e) => setIncludedInput(e.target.value)}
              placeholder="输入药材名称，逗号分隔（如：黄芪,党参,甘草）"
              className="flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIncludedIngredient() } }}
              aria-label="基础配方输入"
            />
            <Button variant="outline" size="sm" onClick={addIncludedIngredient}>添加</Button>
          </div>
          {includeHerbs.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="基础配方药材列表">
              {includeHerbs.map(item => (
                <Badge key={item} variant="success" size="sm" className="flex items-center gap-1 cursor-pointer" role="listitem">
                  <FlaskConical className="w-3 h-3" />
                  {item}
                  <button
                    onClick={() => removeIncludedIngredient(item)}
                    aria-label={`移除配方项: ${item}`}
                    className="hover:text-error-700 focus:outline-none focus:ring-1 focus:ring-error-400 rounded"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* ═══ 权重微调 ═══ */}
        <details className="group rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden mt-4">
          <summary className="flex items-center gap-2 cursor-pointer px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="w-4 h-4 text-accent-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">权重微调</span>
            <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform duration-200">▼</span>
          </summary>
          <div className="px-5 pb-5 space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
            {WEIGHT_OPTIONS.map((opt) => {
              const currentWeight = adjustedWeights[opt.key] ?? opt.default
              return (
                <div key={opt.key} className="flex items-center gap-3">
                  <span className="w-20 text-sm truncate text-neutral-600 dark:text-neutral-400">{opt.label}</span>
                  <Slider
                    value={currentWeight}
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    onChange={(v) => handleWeightChange(opt.key, v)}
                    className="flex-1"
                  />
                  <span className="w-14 text-right text-sm font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                    {currentWeight.toFixed(2)}
                  </span>
                </div>
              )
            })}
            <div className="flex justify-between items-center pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-xs text-muted-foreground">
                权重总和:{' '}
                {Object.values(adjustedWeights).length > 0
                  ? Object.values(adjustedWeights).reduce((a, b) => a + b, 0).toFixed(2)
                  : WEIGHT_OPTIONS.reduce((a, o) => a + o.default, 0).toFixed(2)}
              </span>
              <Button variant="ghost" size="sm" onClick={normalizeWeights}>
                自动归一化
              </Button>
            </div>
          </div>
        </details>
      </Card>

      {/* ══════════════════════════════
          2. 运行控制区
         ══════════════════════════════ */}
      <Card className="p-6">
        {/* 流式模式开关 */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            {isStreamingMode ? (
              <Wifi className="w-4 h-4 text-accent-500" aria-hidden="true" />
            ) : (
              <WifiOff className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">实时流式模式</span>
          </div>
          <Switch
            checked={isStreamingMode}
            onCheckedChange={setIsStreamingMode}
            label={isStreamingMode ? '已开启' : '已关闭'}
            disabled={isRunning}
          />
        </div>

        {/* 参数合理性警告/错误 */}
        {paramError && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>参数校验不通过</AlertTitle>
            <AlertDescription>{paramError}</AlertDescription>
          </Alert>
        )}
        {paramWarning && !paramError && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>提示</AlertTitle>
            <AlertDescription>{paramWarning}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <Button
                icon={<Play className="w-4 h-4" />}
                disabled={!canRun}
                onClick={handleStart}
                aria-label={canRun ? '开始遗传算法进化' : '未知'}
                title={effectsHint}
              >
                开始进化
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={<Square className="w-4 h-4" />}
                onClick={handleStop}
                aria-label="停止遗传算法进化"
              >
                停止
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleReset}
              aria-label="重置所有参数和结果"
            >
              重置
            </Button>
          </div>

          {/* 运行状态指示 */}
          <div className="flex items-center gap-3">
            {isRunning && (
              <>
                <Loader2 className="w-4 h-4 text-accent-500 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium text-accent-600 dark:text-accent-700" role="status">
                  进化中...
                </span>
              </>
            )}
            {mutation.isSuccess && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                进化完成
              </Badge>
            )}
            {mutation.isError && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                运行失败
              </Badge>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {mutation.isError && !isRunning && (
          <Alert variant="warning" className="mb-4">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>运行失败</AlertTitle>
            <AlertDescription>
              {(mutation.error as Error)?.message || '遗传算法执行过程中发生错误，请检查参数后重试。'}
            </AlertDescription>
          </Alert>
        )}

        {/* 实时日志区域 */}
        <div
          ref={logContainerRef}
          className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 h-40 overflow-y-auto font-mono text-xs space-y-1"
          role="log"
          aria-label="遗传算法运行日志"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <div className="text-neutral-400 dark:text-neutral-400 flex items-center gap-2 h-full justify-center">
              <Info className="w-4 h-4" aria-hidden="true" />
              <span>日志将在运行时显示...</span>
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`${
                  log.level === 'error' ? 'text-error-500 dark:text-error-600' :
                  log.level === 'warn' ? 'text-warning-500 dark:text-warning-700' :
                  'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <span className="text-neutral-400 dark:text-neutral-400 mr-2" aria-hidden="true">{log.time}</span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ══════════════════════════════
          3. 结果可视化区
         ══════════════════════════════ */}
      {(result || (isStreamingMode && liveHistory.length > 0)) && (
        <section aria-labelledby="ga-results-heading" className="space-y-6">
          {/* 导出报告 + 统计摘要 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 flex-1">
            <StatCard
              icon={<Dna className="w-5 h-5" />}
              label="总代数"
              value={`${result?.total_generations ?? liveHistory.length}`}
              color="violet"
            />
            <StatCard
              icon={<FlaskConical className="w-5 h-5" />}
              label="总评估次数"
              value={`${result?.total_evaluations?.toLocaleString() ?? '--'}`}
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="最佳适应度"
              value={result ? result.best_score.toFixed(4) : (liveHistory.length > 0 ? liveHistory[liveHistory.length - 1].best_fitness.toFixed(4) : '--')}
              color="green"
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              label="耗时(ms)"
              value={`${result?.execution_time_ms?.toFixed(0) ?? '--'}`}
              color="amber"
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              label="收敛代"
              value={`${result?.convergence_generation ?? '--'}`}
              color="teal"
            />
            <StatCard
              icon={<Sparkles className="w-5 h-5" />}
              label="候选方案"
              value={`${result?.candidates.length ?? liveHistory.length}`}
              color="amber"
            />
            </div>

            {/* 导出报告按钮组 */}
            {result && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={exportJSON}
                  aria-label="导出完整结果为 JSON 文件"
                >
                  导出 JSON
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={exportCSV}
                  aria-label="导出候选方案为 CSV 文件"
                >
                  导出 CSV
                </Button>
              </div>
            )}
          </div>

          {/* --- 进化曲线图 --- */}
          <Card className="p-6">
            <h3 id="ga-results-heading" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-accent-500" />
              进化曲线
            </h3>
            <GAFitnessChart chartData={chartData} />
            <GADiversityChart chartData={chartData} />
          </Card>

          {/* --- 推荐方案卡片列表（仅流式完成后显示）--- */}
          {result && (
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-accent-500" aria-hidden="true" />
              推荐方案
              <Badge variant="primary" size="sm">Top-{result.candidates.length}</Badge>
            </h3>
            <ul className="space-y-4" role="list" aria-label="候选配方方案列表">
              {result.candidates.map((candidate, index) => (
                <li key={index}>
                  <CandidateCard
                    candidate={candidate}
                    rank={index + 1}
                    isExpanded={expandedCard === index}
                    onToggleExpand={() => setExpandedCard(expandedCard === index ? null : index)}
                  />
                </li>
              ))}
            </ul>
          </div>
          )}
        </section>
      )}
    </div>
  )
}

export default GeneticAlgorithmPanel
