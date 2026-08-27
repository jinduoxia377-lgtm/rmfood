import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { aiApi } from '@/api/ai';
import type { MultiObjectiveResponse, MOObjective, MOPresetInfo, GAHistoryRecord, GADetailResponse } from '@/api/ai';
import { EFFECT_OPTIONS } from '@/config/ai/effects';
import { cn } from '@/lib/utils';
import { getAuthToken } from '@/hooks/useSSEAuth';

// 获取 CSRF Token
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
  Select,
  Skeleton,
} from '@/components/ui';
import {
  Target,
  GitBranch,
  BarChart3,
  Download,
  Settings2,
  Plus,
  Trash2,
  ArrowUpDown,
  Play,
  Square,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  FlaskConical,
  Shield,
  DollarSign,
  Dna,
  TrendingUp,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Table as TableIcon,
  LayoutGrid,
  SlidersHorizontal,
  History,
  Crosshair,
  Grid3X3,
} from 'lucide-react';

// ─── 类型定义 ───

interface GenerationRecord {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  min_fitness: number;
  diversity: number;
}

interface MOAlgorithmParams {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  count: number;
}

interface MultiObjectivePanelProps {
  className?: string;
}

// ─── 预设目标选项 ───

const OBJECTIVE_OPTIONS: Array<{
  key: string;
  name: string;
  description: string;
  defaultDirection: 'maximize' | 'minimize';
}> = [
  { key: 'efficacy', name: '功效', description: '药效评分', defaultDirection: 'maximize' },
  { key: 'safety', name: '安全', description: '安全性评分', defaultDirection: 'maximize' },
  { key: 'taste', name: '口感', description: '感官品质', defaultDirection: 'maximize' },
  { key: 'cost', name: '成本', description: '原料成本（元）', defaultDirection: 'minimize' },
  { key: 'synergy', name: '协同', description: '协同作用指数', defaultDirection: 'maximize' },
  { key: 'stability', name: '稳定', description: '配方稳定性', defaultDirection: 'maximize' },
  { key: 'nutrition_balance', name: '营养偏差', description: '营养均衡度（越小越好）', defaultDirection: 'minimize' },
  { key: 'nutrition_protein', name: '蛋白质', description: '蛋白质含量偏差', defaultDirection: 'minimize' },
  { key: 'nutrition_sodium', name: '钠含量', description: '钠含量偏差', defaultDirection: 'minimize' },
];

const PRESET_KEYS = [
  'balanced',
  'cost_first',
  'efficacy_first',
  'safety_first',
  'synergy_focused',
  'comprehensive',
] as const;
type PresetKey = (typeof PRESET_KEYS)[number];

const PRESET_LABELS: Record<PresetKey, string> = {
  balanced: '均衡模式',
  cost_first: '成本优先',
  efficacy_first: '功效优先',
  safety_first: '安全优先',
  synergy_focused: '协同导向',
  comprehensive: '综合全面',
};

const MODE_OPTIONS = [
  { value: 'pareto', label: 'Pareto 最优 (NSGA-II)' },
  { value: 'weighted', label: '加权求和' },
  { value: 'epsilon', label: 'ε-支配' },
] as const;

// ─── 参数默认值 ───

const DEFAULT_MO_PARAMS: MOAlgorithmParams = {
  populationSize: 60,
  generations: 50,
  mutationRate: 0.15,
  crossoverRate: 0.85,
  eliteRatio: 0.1,
  count: 10,
};

// ─── Pareto 颜色函数 ───

function getParetoColor(rank: number): string {
  const colors = ['var(--color-yellow-400, #F59E0B)', 'var(--color-slate-400, #9CA3AF)', 'var(--color-blue-400, #6ECAFF)', 'var(--color-violet-400, #C090FF)', 'var(--color-emerald-400, #4ADE80)', 'var(--color-red-400, #EF4444)'];
  return colors[Math.min(rank, colors.length) - 1] || 'var(--color-slate-400, #9CA3AF)';
}

// ─── 主组件 ───

export function MultiObjectivePanel({ className }: MultiObjectivePanelProps) {
  // ── 模式与预设 ──
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | 'custom'>('balanced');
  const [mode, setMode] = useState<'pareto' | 'weighted' | 'epsilon'>('pareto');

  // ── 功效选择 ──
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);

  // ── 自定义目标列表 ──
  const [customObjectives, setCustomObjectives] = useState<Array<MOObjective & { id: string }>>([
    { id: '1', name: '功效', key: 'efficacy', direction: 'maximize', weight: 1.0 },
    { id: '2', name: '安全', key: 'safety', direction: 'maximize', weight: 1.0 },
    { id: '3', name: '成本', key: 'cost', direction: 'minimize', weight: 0.5 },
  ]);

  // ── 算法参数 ──
  const [params, setParams] = useState<MOAlgorithmParams>({ ...DEFAULT_MO_PARAMS });

  // ── 约束条件 ──
  const [excludeHerbs, setExcludeHerbs] = useState<string[]>([]);
  const [excludedInput, setExcludedInput] = useState('');
  const [maxCost, setMaxCost] = useState<number | null>(null);
  const [includeHerbs, setIncludeHerbs] = useState<string[]>([]);
  const [includedInput, setIncludedInput] = useState('');

  // ── 流式模式 ──
  const [isStreamingMode, setIsStreamingMode] = useState(true);
  const [liveHistory, setLiveHistory] = useState<GenerationRecord[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // ── 运行状态 ──
  const [logs, setLogs] = useState<Array<{ time: string; message: string; level: 'info' | 'warn' | 'error' }>>([]);
  const [result, setResult] = useState<MultiObjectiveResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // ── 结果视图切换 ──
  const [candidateView, setCandidateView] = useState<'cards' | 'table'>('cards');
  const [sortKey, setSortKey] = useState<string>('overall_fitness');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Pareto 图轴选择 ──
  const [axisX, setAxisX] = useState<string>('');
  const [axisY, setAxisY] = useState<string>('');

  // ── 高级可视化状态 ──
  const [selectedCandidateIdx, setSelectedCandidateIdx] = useState<number | null>(null);
  const [parallelHoveredIdx, setParallelHoveredIdx] = useState<number | null>(null);
  const [adjustedWeights, setAdjustedWeights] = useState<Record<string, number>>({});

  // ── 历史记录状态 ──
  const [historyRecords, setHistoryRecords] = useState<GAHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── 预设数据加载 ──
  const { data: presetsData } = useQuery({
    queryKey: ['mo-presets'],
    queryFn: () => aiApi.getMOPresets(),
    staleTime: 10 * 60 * 1000,
  });

  const presets = presetsData?.presets ?? {};

  // ── 可用轴维度 ──
  const availableAxes = useMemo(() => {
    if (!result?.candidates?.length) return [];
    const firstCandidate = result.candidates[0];
    return Object.keys(firstCandidate.objective_scores || {});
  }, [result]);

  useEffect(() => {
    if (availableAxes.length >= 2 && !axisX) {
      setAxisX(availableAxes[0]);
      setAxisY(availableAxes[1]);
    }
  }, [availableAxes]);

  // ── 散点图数据：仅绘制 Pareto 前沿点（rank=1）──
  const scatterData = useMemo(() => {
    if (!result?.candidates?.length || !axisX || !axisY) return [];
    return result.candidates
      .filter((cand) => cand.pareto_rank === 1)
      .map((cand) => ({
        ...cand.objective_scores,
        pareto_rank: cand.pareto_rank,
        crowding_distance: cand.crowding_distance,
        overall_fitness: cand.overall_fitness,
        objective_values: cand.objective_scores,
      }));
  }, [result, axisX, axisY]);

  // ── 全部候选点（用于热力图等需要全量数据的场景）──
  const allCandidatesData = useMemo(() => {
    if (!result?.candidates?.length || !axisX || !axisY) return [];
    return result.candidates.map((cand) => ({
      ...cand.objective_scores,
      pareto_rank: cand.pareto_rank,
      crowding_distance: cand.crowding_distance,
      overall_fitness: cand.overall_fitness,
      objective_values: cand.objective_scores,
    }));
  }, [result, axisX, axisY]);

  // ── 排序后的候选方案 ──
  const sortedCandidates = useMemo(() => {
    if (!result?.candidates) return [];
    const sorted = [...result.candidates].sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === 'overall_fitness') {
        aVal = a.overall_fitness;
        bVal = b.overall_fitness;
      } else if (sortKey === 'pareto_rank') {
        aVal = a.pareto_rank;
        bVal = b.pareto_rank;
      } else {
        aVal = a.objective_scores[sortKey] ?? 0;
        bVal = b.objective_scores[sortKey] ?? 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [result, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  // ── 选中的候选方案（用于雷达图） ──
  const selectedCandidate = useMemo(() => {
    if (selectedCandidateIdx === null || !result?.candidates) return null;
    return result.candidates[selectedCandidateIdx] ?? null;
  }, [selectedCandidateIdx, result]);

  // ── 雷达图数据 ──
  const radarData = useMemo(() => {
    if (!selectedCandidate || !result?.objectives_config) return [];
    return Object.entries(selectedCandidate.objective_scores).map(([key, value]) => ({
      subject: result.objectives_config.find((o) => o.key === key)?.name || key,
      score: value,
      maxScore: 1.0,
    }));
  }, [selectedCandidate, result]);

  // ── 当前预设的目标展示 ──
  const currentPresetObjectives = useMemo(() => {
    if (selectedPreset === 'custom') return customObjectives;
    const preset = presets[selectedPreset];
    return preset?.objectives ?? [];
  }, [selectedPreset, customObjectives, presets]);

  // ── 当前目标配置（用于权重调节器） ──
  const currentObjectives = useMemo(() => {
    return result?.objectives_config ?? currentPresetObjectives;
  }, [result, currentPresetObjectives]);

  // ── 平行坐标图数据准备 ──
  const parallelConfig = useMemo(() => {
    if (!result?.candidates?.length || !result.objectives_config)
      return { objectives: [], axisX: [], displayCandidates: [], minMax: {} };
    const objectives = result.objectives_config;
    const axisX = objectives.map((_, i) => `${(i / Math.max(objectives.length - 1, 1)) * 100}%`);
    const minMax: Record<string, { min: number; max: number }> = {};
    objectives.forEach((obj) => {
      const vals = result.candidates.map((c) => c.objective_scores[obj.key] ?? 0);
      minMax[obj.key] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    return { objectives, axisX, displayCandidates: result.candidates, minMax };
  }, [result]);

  // ── 热力图数据（10×10 网格） ──
  const heatmapGrid = useMemo(() => {
    if (!result?.candidates?.length || !axisX || !axisY) return [];
    const gridSize = 10;
    const xVals = result.candidates.map((c) => c.objective_scores[axisX] ?? 0);
    const yVals = result.candidates.map((c) => c.objective_scores[axisY] ?? 0);
    const xMin = Math.min(...xVals),
      xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals),
      yMax = Math.max(...yVals);
    const grid: number[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    result.candidates.forEach((cand) => {
      const xv = cand.objective_scores[axisX] ?? 0;
      const yv = cand.objective_scores[axisY] ?? 0;
      const gx = Math.min(Math.floor(((xv - xMin) / (xMax - xMin || 1)) * gridSize), gridSize - 1);
      const gy = Math.min(Math.floor(((yv - yMin) / (yMax - yMin || 1)) * gridSize), gridSize - 1);
      grid[gy][gx]++;
    });
    const maxCount = Math.max(...grid.flat(), 1);
    return grid.map((row, ri) => row.map((val) => ({ x: ri, y: val, count: val, intensity: val / maxCount })));
  }, [result, axisX, axisY]);

  // ── 权重微调处理 ──
  const handleWeightChange = useCallback((key: string, value: number) => {
    setAdjustedWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const normalizeWeights = useCallback(() => {
    const total = Object.values(adjustedWeights).reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const normalized: Record<string, number> = {};
    Object.entries(adjustedWeights).forEach(([k, v]) => {
      normalized[k] = v / total;
    });
    setAdjustedWeights(normalized);
  }, [adjustedWeights]);

  // ── 历史记录加载 ──
  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const data = await aiApi.getGAHistory({ limit: 10 });
        if (!cancelled) setHistoryRecords(data.records);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 日志辅助 ──
  const addLog = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    setLogs((prev) => [...prev.slice(-99), { time, message, level }]);
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 0);
  }, []);

  // ── 加载历史运行详情 ──
  const loadRunDetail = useCallback(
    async (runId: string) => {
      try {
        const detail = await aiApi.getGADetail(runId);
        // 将详情转换为 MultiObjectiveResponse 格式复用展示
        const converted: MultiObjectiveResponse = {
          candidates: detail.candidates.map((c) => ({
            ingredients: c.ingredients,
            objective_scores: c.objective_scores ?? {},
            overall_fitness: c.overall_fitness,
            pareto_rank: c.pareto_rank,
            crowding_distance: c.crowding_distance,
            explanation: c.explanation,
          })),
          pareto_front: detail.run.pareto_front,
          best_by_objective: detail.run.best_by_objective,
          history: detail.run.history,
          algorithm: detail.run.algorithm_type,
          mode: detail.run.mode,
          objectives_config: detail.run.objectives_config,
          total_generations: detail.run.total_generations,
          total_evaluations:
            detail.run.total_generations * ((detail.run.algorithm_params.population_size as number) ?? 60),
          execution_time_ms: detail.run.execution_time_ms,
          convergence_generation:
            detail.run.history.length > 0
              ? Math.min(...detail.run.history.filter((h) => h.diversity < 0.3).map((h) => h.generation))
              : detail.run.total_generations,
          stop_reason: detail.run.stop_reason,
        };
        setResult(converted);
        setSelectedCandidateIdx(null);
        addLog(`📂 已加载历史记录: ${detail.run.preset_name || '自定义'} (${detail.run.algorithm_type})`, 'info');
      } catch (err) {
        addLog(`❌ 加载历史详情失败: ${(err as Error).message}`, 'error');
      }
    },
    [addLog],
  );

  // ── Mutation（非流式模式） ──
  const mutation = useMutation({
    mutationKey: ['multi-objective-optimization', selectedPreset, mode, selectedEffects],
    mutationFn: async () => {
      // 🔒 确保之前的请求被取消
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }

      const controller = new AbortController();
      abortRef.current = controller;

      addLog('🧬 初始化 NSGA-II 多目标优化引擎...', 'info');

      const constraints: Record<string, unknown> = {};
      if (excludeHerbs.length > 0) constraints.exclude_herbs = excludeHerbs;
      if (includeHerbs.length > 0) constraints.include_herbs = includeHerbs;
      if (maxCost !== null && maxCost > 0) constraints.max_cost = maxCost;

      addLog(`📊 种群大小=${params.populationSize}, 代数=${params.generations}, 模式=${mode}`, 'info');

      try {
        const result = await aiApi.multiObjectiveOptimize(
          {
            targetEffects: selectedEffects.length > 0 ? selectedEffects : undefined,
            objectives:
              selectedPreset === 'custom'
                ? customObjectives.map((o) => ({ key: o.key, name: o.name, direction: o.direction, weight: o.weight }))
                : undefined,
            preset: selectedPreset === 'custom' ? undefined : selectedPreset,
            mode,
            ...params,
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
          },
          controller.signal,
        );
        return result;
      } finally {
        abortRef.current = null;
      }
    },
    onSuccess: (data) => {
      addLog(
        `✅ 多目标优化完成！共 ${data.total_generations} 代，${data.candidates.length} 个候选方案，Pareto 前沿 ${data.pareto_front.length} 个解`,
        'info',
      );
      setResult(data);
    },
    onError: (error) => {
      if ((error as Error).name === 'AbortError') {
        addLog('⏹️ 用户终止了优化过程', 'warn');
      } else {
        const msg = (error as Error)?.message || '未知错误';
        addLog(`❌ 优化失败：${msg}`, 'error');
      }
    },
    retry: 0,
  });

  // ── 构建请求体 ──
  const buildRequestBody = useCallback(() => {
    const constraints: Record<string, unknown> = {};
    if (excludeHerbs.length > 0) constraints.exclude_herbs = excludeHerbs;
    if (includeHerbs.length > 0) constraints.include_herbs = includeHerbs;
    if (maxCost !== null && maxCost > 0) constraints.max_cost = maxCost;
    return {
      target_effects: selectedEffects.length > 0 ? selectedEffects : ['免疫调节'],
      objectives:
        selectedPreset === 'custom'
          ? customObjectives.map((o) => ({ key: o.key, name: o.name, direction: o.direction, weight: o.weight }))
          : null,
      preset: selectedPreset === 'custom' ? null : selectedPreset,
      mode,
      population_size: params.populationSize,
      generations: params.generations,
      mutation_rate: params.mutationRate,
      crossover_rate: params.crossoverRate,
      elite_ratio: params.eliteRatio,
      constraints: Object.keys(constraints).length > 0 ? constraints : null,
      count: params.count,
    };
  }, [selectedEffects, customObjectives, selectedPreset, mode, params, excludeHerbs, includeHerbs, maxCost]);

  // ── SSE 流式执行 ──
  const executeStreaming = useCallback(async () => {
    // 🔒 确保之前的请求被正确清理
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
      abortRef.current = null;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setLiveHistory([]);
    setResult(null);
    setLogs([]);

    addLog('🧬 初始化 NSGA-II 多目标优化引擎（流式模式）...', 'info');
    addLog(`📊 种群大小=${params.populationSize}, 代数=${params.generations}, 模式=${mode}`, 'info');

    try {
      // 🔒 检查控制器是否已被中止（防止竞态条件）
      if (controller.signal.aborted) {
        addLog('⏹️ 请求已被取消', 'warn');
        return;
      }

      const token = getAuthToken();
      const requestBody = buildRequestBody();

      addLog(`📤 发送请求: ${JSON.stringify(requestBody).length} 字节`, 'info');

      const response = await fetch('/api/v1/ai/generate/multi-objective/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEventType = trimmed.replace('event:', '').trim();
          } else if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.replace('data:', '').trim());
              handleSSEEvent(currentEventType, data);
            } catch {
              // ignore parse errors
            }
            currentEventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        addLog('⏹️ 用户终止了优化过程', 'warn');
      } else {
        const msg = (err as Error)?.message || '未知错误';
        addLog(`❌ 流式优化失败：${msg}`, 'error');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [buildRequestBody, params, mode, addLog]);

  // ── SSE 事件处理 ──
  const handleSSEEvent = useCallback(
    (eventType: string, data: unknown) => {
      switch (eventType) {
        case 'start':
          addLog(`🚀 多目标优化开始：${JSON.stringify((data as Record<string, unknown>).config ?? data)}`, 'info');
          break;
        case 'progress': {
          const record = data as GenerationRecord;
          setLiveHistory((prev) => [...prev, record]);
          if (record.generation % Math.max(1, Math.floor(params.generations / 10)) === 0 || record.generation <= 3) {
            addLog(`📈 第 ${record.generation} 代：最佳适应度 ${record.best_fitness.toFixed(4)}`, 'info');
          }
          break;
        }
        case 'complete': {
          const finalData = data as MultiObjectiveResponse;
          addLog(
            `✅ 多目标优化完成！共 ${finalData.total_generations} 代，${finalData.candidates.length} 个候选方案`,
            'info',
          );
          setResult(finalData);
          break;
        }
        case 'error': {
          const errMsg = (data as Record<string, unknown>)?.message || String(data);
          addLog(`❌ 服务端错误：${errMsg}`, 'error');
          break;
        }
        case 'done':
          addLog('🔌 服务端连接已关闭', 'info');
          break;
        default:
          break;
      }
    },
    [addLog, params.generations],
  );

  // ── 效果切换 ──
  const toggleEffect = useCallback((effectId: string) => {
    setSelectedEffects((prev) => (prev.includes(effectId) ? prev.filter((e) => e !== effectId) : [...prev, effectId]));
  }, []);

  // ── 参数更新 ──
  const updateParam = <K extends keyof MOAlgorithmParams>(key: K, value: MOAlgorithmParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  // ── 自定义目标管理 ──
  const addObjective = useCallback(() => {
    const newId = String(Date.now());
    setCustomObjectives((prev) => [...prev, { id: newId, name: '', key: '', direction: 'maximize', weight: 1.0 }]);
  }, []);

  const updateObjective = useCallback(
    (id: string, field: keyof (MOObjective & { id: string }), value: string | number) => {
      setCustomObjectives((prev) => prev.map((obj) => (obj.id === id ? { ...obj, [field]: value } : obj)));
    },
    [],
  );

  const removeObjective = useCallback((id: string) => {
    setCustomObjectives((prev) => prev.filter((obj) => obj.id !== id));
  }, []);

  const applyPresetTemplate = useCallback((key: string) => {
    const option = OBJECTIVE_OPTIONS.find((o) => o.key === key);
    if (!option) return;
    const newId = String(Date.now());
    setCustomObjectives((prev) => [
      ...prev,
      { id: newId, name: option.name, key: option.key, direction: option.defaultDirection, weight: 1.0 },
    ]);
  }, []);

  // ── 排除药材管理 ──
  const addExcludedIngredient = useCallback(() => {
    const items = excludedInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      setExcludeHerbs((prev) => [...new Set([...prev, ...items])]);
      setExcludedInput('');
    }
  }, [excludedInput]);

  const removeExcludedIngredient = useCallback((item: string) => {
    setExcludeHerbs((prev) => prev.filter((i) => i !== item));
  }, []);

  // ── 基础配方管理（用户指定强制包含的药材） ──
  const addIncludedIngredient = useCallback(() => {
    const items = includedInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      setIncludeHerbs((prev) => [...new Set([...prev, ...items])]);
      setIncludedInput('');
    }
  }, [includedInput]);

  const removeIncludedIngredient = useCallback((item: string) => {
    setIncludeHerbs((prev) => prev.filter((i) => i !== item));
  }, []);

  // ── 参数合理性校验 ──
  const validateParams = useCallback(() => {
    const totalEvaluations = params.populationSize * params.generations;
    if (totalEvaluations > 50000) {
      addLog(`❌ 计算量过大（${totalEvaluations.toLocaleString()} 次），请降低参数`, 'error');
      return false;
    }
    if (totalEvaluations > 20000) {
      addLog(`⚠️ 计算量较大（${totalEvaluations.toLocaleString()} 次），预计需要较长时间`, 'warn');
    }
    if (selectedPreset === 'custom' && customObjectives.length < 2) {
      addLog('❌ 自定义模式下至少需要 2 个优化目标', 'error');
      return false;
    }
    return true;
  }, [params.populationSize, params.generations, selectedPreset, customObjectives.length, addLog]);

  // ── 导出 JSON ──
  const exportJSON = useCallback(() => {
    if (!result) return;
    const data = {
      exported_at: new Date().toISOString(),
      parameters: {
        selectedEffects,
        selectedPreset,
        mode,
        customObjectives: selectedPreset === 'custom' ? customObjectives : undefined,
        ...params,
        excludeHerbs,
        maxCost,
      },
      result,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mo-optimization-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, selectedEffects, selectedPreset, mode, customObjectives, params, excludeHerbs, maxCost]);

  // ── 导出 CSV ──
  const exportCSV = useCallback(() => {
    if (!result) return;
    const objKeys = result.objectives_config?.map((o) => o.key) ?? [];
    const headers = [
      '#',
      'Rank',
      'Fitness',
      ...objKeys.map((k) => {
        const obj = result.objectives_config?.find((o) => o.key === k);
        return obj?.name ?? k;
      }),
      '药材组成',
    ];
    const rows = result.candidates.map((c, i) => [
      i + 1,
      c.pareto_rank,
      c.overall_fitness.toFixed(6),
      ...objKeys.map((k) => c.objective_scores[k]?.toFixed(4) ?? ''),
      c.ingredients.map((ing) => `${ing.name_cn}(${ing.dosage}g)`).join('; '),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mo-candidates-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // ── 开始 / 停止 / 重置 ──
  const handleStart = () => {
    if (!validateParams()) return;
    setResult(null);
    setLiveHistory([]);
    setLogs([]);
    if (isStreamingMode) {
      executeStreaming();
    } else {
      mutation.mutate();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    mutation.reset();
    setIsStreaming(false);
  };

  const handleReset = () => {
    handleStop();
    setResult(null);
    setSelectedEffects([]);
    setSelectedPreset('balanced');
    setMode('pareto');
    setCustomObjectives([
      { id: '1', name: '功效', key: 'efficacy', direction: 'maximize', weight: 1.0 },
      { id: '2', name: '安全', key: 'safety', direction: 'maximize', weight: 1.0 },
      { id: '3', name: '成本', key: 'cost', direction: 'minimize', weight: 0.5 },
    ]);
    setParams({ ...DEFAULT_MO_PARAMS });
    setExcludeHerbs([]);
    setExcludedInput('');
    setMaxCost(null);
    setLogs([]);
    setIsStreaming(false);
    setAxisX('');
    setAxisY('');
    setCandidateView('cards');
    setSortKey('overall_fitness');
    setSortDir('desc');
  };

  // ── 计算属性 ──
  const canRun = !mutation.isPending && !isStreaming;
  const isRunning = mutation.isPending || isStreaming;
  const chartData = isStreamingMode && liveHistory.length > 0 ? liveHistory : (result?.history ?? []);

  return (
    <div className={cn('space-y-6', className)} role="region" aria-label="多目标优化面板 (NSGA-II)">
      {/* 无障碍公告 */}
      <div aria-live="polite" className="sr-only">
        {isRunning
          ? '多目标优化正在运行'
          : result
            ? `优化完成，生成 ${result.candidates.length} 个候选方案`
            : '等待开始'}
      </div>

      {/* ══════════════════════════════
          1. 顶部工具栏
         ══════════════════════════════ */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">多目标优化 (NSGA-II)</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">基于 Pareto 最优前沿搜索多维度最优配方组合</p>
          </div>
        </div>

        {/* --- 模式选择 + 预设选择 --- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          {/* 预设选择器 */}
          <div className="flex-shrink-0">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 block">
              预设场景
            </label>
            <Select
              value={selectedPreset}
              onChange={(v) => setSelectedPreset(v as PresetKey | 'custom')}
              className="w-44"
            >
              {PRESET_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PRESET_LABELS[k]}
                </option>
              ))}
              <option value="custom">自定义目标...</option>
            </Select>
          </div>

          {/* 优化模式 */}
          <div className="flex-shrink-0">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 block">
              优化模式
            </label>
            <Select
              value={mode}
              onChange={(v) => setMode(v as 'pareto' | 'weighted' | 'epsilon')}
              className="w-48"
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* ═══ 目标配置区 ═══ */}
        <section aria-labelledby="mo-objectives-heading" className="mb-6">
          <h3
            id="mo-objectives-heading"
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4"
          >
            <Target className="w-4 h-4 text-indigo-500" />
            优化目标配置
            <Badge variant="neutral" size="sm">
              {currentPresetObjectives.length} 个目标
            </Badge>
          </h3>

          {selectedPreset === 'custom' ? (
            /* 自定义模式：可编辑 */
            <div className="space-y-3">
              {customObjectives.map((obj, idx) => (
                <div
                  key={obj.id}
                  className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">目标名称</label>
                    <Select
                      value={obj.key}
                      onChange={(v) => {
                        const opt = OBJECTIVE_OPTIONS.find((o) => o.key === v);
                        updateObjective(obj.id, 'key', v);
                        updateObjective(obj.id, 'name', opt?.name ?? v);
                        if (opt) updateObjective(obj.id, 'direction', opt.defaultDirection);
                      }}
                      className="w-full"
                    >
                      <option value="">选择目标...</option>
                      {OBJECTIVE_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.name} ({o.description})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">方向</label>
                    <Select
                      value={obj.direction}
                      onChange={(v) => updateObjective(obj.id, 'direction', v)}
                      className="w-full"
                    >
                      <option value="maximize">最大化 ↑</option>
                      <option value="minimize">最小化 ↓</option>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1">
                      权重: {obj.weight.toFixed(2)}
                    </label>
                    <Slider
                      value={obj.weight}
                      min={0.01}
                      max={1.0}
                      step={0.01}
                      onChange={(v) => updateObjective(obj.id, 'weight', v)}
                      aria-label={`目标 ${idx + 1} 权重`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => removeObjective(obj.id)}
                    disabled={customObjectives.length <= 2}
                    aria-label={`删除目标 ${obj.name || idx + 1}`}
                    className="text-error-500 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20"
                  >
                    删除
                  </Button>
                </div>
              ))}

              {/* 快速添加按钮组 */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={addObjective}>
                  添加目标
                </Button>
                <span className="text-xs text-neutral-400">快速添加:</span>
                {OBJECTIVE_OPTIONS.filter((opt) => !customObjectives.some((o) => o.key === opt.key)).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => applyPresetTemplate(opt.key)}
                    className="px-2 py-1 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {opt.name}
                  </button>
                ))}
              </div>

              {customObjectives.length >= 2 && (
                <p className="text-xs text-warning-600 dark:text-warning-400 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  权重将自动归一化，实际使用比例 = 权重值 / 总权重
                </p>
              )}
            </div>
          ) : (
            /* 预设模式：只读展示 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentPresetObjectives.map((obj, idx) => (
                <div
                  key={`${selectedPreset}-${idx}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-900/20"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                      obj.direction === 'maximize' ? 'bg-primary-500' : 'bg-orange-500',
                    )}
                  >
                    {obj.direction === 'maximize' ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{obj.name}</p>
                    <p className="text-xs text-neutral-400">{obj.key}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {obj.weight.toFixed(2)}
                    </span>
                    <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(obj.weight * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* --- 目标功效选择 --- */}
        <section aria-labelledby="mo-effects-heading" className="mb-6">
          <h3
            id="mo-effects-heading"
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-3"
          >
            <Target className="w-4 h-4 text-indigo-500" />
            目标功效
            <Badge variant="neutral" size="sm">
              {selectedEffects.length} 已选
            </Badge>
            <span className="text-xs font-normal text-neutral-400">(可选)</span>
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="目标功效多选">
            {EFFECT_OPTIONS.map((effect) => (
              <button
                key={effect.id}
                onClick={() => toggleEffect(effect.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleEffect(effect.id);
                  }
                }}
                role="checkbox"
                aria-checked={selectedEffects.includes(effect.id)}
                aria-label={`功效: ${effect.label}`}
                tabIndex={0}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800',
                  selectedEffects.includes(effect.id)
                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                )}
              >
                {effect.label}
              </button>
            ))}
          </div>
        </section>

        {/* ═══ 算法参数区 ═══ */}
        <section aria-labelledby="mo-params-heading" className="mb-6">
          <h3
            id="mo-params-heading"
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4"
          >
            <Settings2 className="w-4 h-4 text-indigo-500" />
            算法参数
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            <MOParamSlider
              label="种群大小"
              value={params.populationSize}
              min={10}
              max={300}
              step={1}
              onChange={(v) => updateParam('populationSize', v)}
              description="每代个体数量"
            />
            <MOParamSlider
              label="进化代数"
              value={params.generations}
              min={5}
              max={200}
              step={1}
              onChange={(v) => updateParam('generations', v)}
              description="最大迭代次数"
            />
            <MOParamSlider
              label="变异率"
              value={params.mutationRate}
              min={0.01}
              max={0.5}
              step={0.01}
              onChange={(v) => updateParam('mutationRate', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="基因变异概率"
            />
            <MOParamSlider
              label="交叉率"
              value={params.crossoverRate}
              min={0.1}
              max={1.0}
              step={0.01}
              onChange={(v) => updateParam('crossoverRate', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="个体交叉概率"
            />
            <MOParamSlider
              label="精英保留比例"
              value={params.eliteRatio}
              min={0.05}
              max={0.4}
              step={0.01}
              onChange={(v) => updateParam('eliteRatio', v)}
              displayFormat={(v) => `${(v * 100).toFixed(0)}%`}
              description="最优个体保留比例"
            />
            <MOParamSlider
              label="候选方案数量"
              value={params.count}
              min={1}
              max={30}
              step={1}
              onChange={(v) => updateParam('count', v)}
              description="输出的 Top-N 方案数"
            />
          </div>
        </section>

        {/* ═══ 约束条件区 ═══ */}
        <section aria-labelledby="mo-constraints-heading">
          <h3
            id="mo-constraints-heading"
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4"
          >
            <Shield className="w-4 h-4 text-indigo-500" />
            约束条件
            <span className="text-xs font-normal text-neutral-400">(可选)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">排除药材</label>
              <div className="flex gap-2">
                <Input
                  value={excludedInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExcludedInput(e.target.value)}
                  placeholder="输入药材名称，逗号分隔"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExcludedIngredient();
                    }
                  }}
                  aria-label="排除药材输入"
                />
                <Button variant="outline" size="sm" onClick={addExcludedIngredient}>
                  添加
                </Button>
              </div>
              {excludeHerbs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="list" aria-label="已排除的药材列表">
                  {excludeHerbs.map((item) => (
                    <Badge
                      key={item}
                      variant="danger"
                      size="sm"
                      className="flex items-center gap-1 cursor-pointer"
                      role="listitem"
                    >
                      {item}
                      <button
                        onClick={() => removeExcludedIngredient(item)}
                        aria-label={`移除排除项: ${item}`}
                        className="hover:text-error-700 focus:outline-none focus:ring-1 focus:ring-red-400 rounded"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="mo-max-cost" className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">
                最大成本（元）
              </label>
              <Input
                id="mo-max-cost"
                type="number"
                value={maxCost ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setMaxCost(e.target.value === '' ? null : Number(e.target.value));
                }}
                placeholder="不限制则留空"
                min={0}
                aria-label="最大成本限制"
              />
            </div>
          </div>
        </section>

        {/* ═══ 基础配方（可选：用户指定的药材）═══ */}
        <section aria-labelledby="mo-included-heading">
          <h3
            id="mo-included-heading"
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4"
          >
            <FlaskConical className="w-4 h-4 text-emerald-500" />
            基础配方
            <span className="text-xs font-normal text-neutral-400">(可选，强制包含)</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            指定药材将作为固定基础，优化器将在其基础上添加更多药材。若留空则由算法自动选择。
          </p>
          <div className="flex gap-2 mb-3">
            <Input
              value={includedInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludedInput(e.target.value)}
              placeholder="输入药材名称，逗号分隔（如：黄芪,党参,甘草）"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIncludedIngredient();
                }
              }}
              aria-label="基础配方输入"
            />
            <Button variant="outline" size="sm" onClick={addIncludedIngredient}>
              添加
            </Button>
          </div>
          {includeHerbs.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="基础配方药材列表">
              {includeHerbs.map((item) => (
                <Badge
                  key={item}
                  variant="success"
                  size="sm"
                  className="flex items-center gap-1 cursor-pointer"
                  role="listitem"
                >
                  <FlaskConical className="w-3 h-3" />
                  {item}
                  <button
                    onClick={() => removeIncludedIngredient(item)}
                    aria-label={`移除配方项: ${item}`}
                    className="hover:text-error-700 focus:outline-none focus:ring-1 focus:ring-red-400 rounded"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </section>
      </Card>

      {/* ══════════════════════════════
          2. 运行控制区
         ══════════════════════════════ */}
      <Card className="p-6">
        {/* 流式模式开关 */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            {isStreamingMode ? (
              <Wifi className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            ) : (
              <WifiOff className="w-4 h-4 text-neutral-400" aria-hidden="true" />
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {!isRunning ? (
              <Button
                icon={<Play className="w-4 h-4" />}
                disabled={!canRun}
                onClick={handleStart}
                aria-label={canRun ? '开始多目标优化' : '请确认参数后开始'}
              >
                开始优化
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={<Square className="w-4 h-4" />}
                onClick={handleStop}
                aria-label="停止多目标优化"
              >
                停止
              </Button>
            )}
            <Button
              variant="outline"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleReset}
              aria-label="重置所有参数和结果"
            >
              重置
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <>
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400" role="status">
                  优化中...
                </span>
              </>
            )}
            {mutation.isSuccess && result && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                优化完成 · {result.candidates.length} 方案
              </Badge>
            )}
            {mutation.isError && (
              <Badge variant="danger" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                运行失败
              </Badge>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {mutation.isError && !isRunning && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <AlertTitle>运行失败</AlertTitle>
            <AlertDescription>
              {(mutation.error as Error)?.message || '多目标优化执行过程中发生错误，请检查参数后重试。'}
            </AlertDescription>
          </Alert>
        )}

        {/* 实时日志区域 */}
        <div
          ref={logContainerRef}
          className="bg-slate-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 h-40 overflow-y-auto font-mono text-xs space-y-1"
          role="log"
          aria-label="多目标优化运行日志"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <div className="text-neutral-400 dark:text-neutral-500 flex items-center gap-2 h-full justify-center">
              <Info className="w-4 h-4" aria-hidden="true" />
              <span>日志将在运行时显示...</span>
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  log.level === 'error'
                    ? 'text-error-500 dark:text-error-400'
                    : log.level === 'warn'
                      ? 'text-warning-500 dark:text-warning-400'
                      : 'text-neutral-600 dark:text-neutral-400',
                )}
              >
                <span className="text-neutral-400 dark:text-neutral-600 mr-2" aria-hidden="true">
                  {log.time}
                </span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ══════════════════════════════
          3. 结果展示区
         ══════════════════════════════ */}
      {(result || (isStreamingMode && liveHistory.length > 0)) && (
        <section aria-labelledby="mo-results-heading" className="space-y-6">
          {/* 统计摘要栏 + 导出 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
              <StatCard
                icon={<Dna className="w-5 h-5" />}
                label="总代数"
                value={`${result?.total_generations ?? liveHistory.length}`}
                color="indigo"
              />
              <StatCard
                icon={<FlaskConical className="w-5 h-5" />}
                label="评估次数"
                value={`${result?.total_evaluations?.toLocaleString() ?? '--'}`}
                color="blue"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="耗时(ms)"
                value={`${result?.execution_time_ms ?? '--'}`}
                color="green"
              />
              <StatCard
                icon={<GitBranch className="w-5 h-5" />}
                label="Pareto 解数"
                value={`${result?.pareto_front?.length ?? '--'}`}
                color="purple"
              />
              <StatCard
                icon={<Zap className="w-5 h-5" />}
                label="收敛代"
                value={`${result?.convergence_generation ?? '--'}`}
                color="amber"
              />
              <StatCard
                icon={<BarChart3 className="w-5 h-5" />}
                label="最终多样性"
                value={
                  result
                    ? (isStreamingMode && liveHistory.length > 0
                        ? liveHistory[liveHistory.length - 1].diversity.toFixed(4)
                        : result.history.length > 0
                          ? result.history[result.history.length - 1].diversity.toFixed(4)
                          : '--')
                    : '--'
                }
                color="teal"
              />
            </div>

            {result && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportJSON}>
                  导出 JSON
                </Button>
                <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportCSV}>
                  导出 CSV
                </Button>
              </div>
            )}
          </div>

          {/* --- 进化曲线图 --- */}
          <Card className="p-6">
            <h3
              id="mo-results-heading"
              className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4"
            >
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              进化曲线
            </h3>
            {chartData.length > 0 ? (
              <div className="w-full" style={{ aspectRatio: '16/9' }} role="img" aria-label="多目标优化进化曲线图">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200, #E5E7EB)" />
                    <XAxis
                      dataKey="generation"
                      label={{ value: '代数', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
                      tick={{ fontSize: 12 }}
                      stroke="var(--color-slate-400, #9CA3AF)"
                    />
                    <YAxis
                      label={{ value: '适应度', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      tick={{ fontSize: 12 }}
                      stroke="var(--color-slate-400, #9CA3AF)"
                      domain={['dataMin - 0.02', 'dataMax + 0.02']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg, #fff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number) => [value.toFixed(4), undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line
                      type="monotone"
                      dataKey="best_fitness"
                      name="最佳适应度"
                      stroke="var(--color-green-500, #34C759)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--color-green-500, #34C759)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_fitness"
                      name="平均适应度"
                      stroke="var(--color-secondary, #0A84FF)"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                    <Line
                      type="monotone"
                      dataKey="min_fitness"
                      name="最低适应度"
                      stroke="var(--color-error, #FF3B30)"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="3 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-neutral-400" role="status">
                暂无进化曲线数据
              </div>
            )}

            {/* 多样性曲线 */}
            {chartData.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  种群多样性变化
                </h4>
                <div style={{ aspectRatio: '16/5' }} role="img" aria-label="种群多样性变化曲线">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100, #F3F4F6)" />
                      <XAxis dataKey="generation" tick={{ fontSize: 11 }} stroke="var(--color-slate-300, #D1D5DB)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--color-slate-300, #D1D5DB)" domain={[0, 1]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card-bg, #fff)',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                        formatter={(value: number) => [value.toFixed(4), '多样性']}
                      />
                      <Line
                        type="monotone"
                        dataKey="diversity"
                        name="多样性"
                        stroke="var(--color-violet-500, #AF52DE)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Card>

          {/* ★ Pareto 前沿散点图 ★ */}
          {scatterData.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-indigo-500" />
                  Pareto 前沿散点图
                  <Badge variant="primary" size="sm">
                    {scatterData.length} 点
                  </Badge>
                </h3>
                {/* 轴切换按钮 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">X:</label>
                  <Select value={axisX} onChange={(v) => setAxisX(v)} className="w-32" size="sm">
                    {availableAxes.map((a) => (
                      <option key={`x-${a}`} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                  <label className="text-xs text-neutral-500 ml-2">Y:</label>
                  <Select value={axisY} onChange={(v) => setAxisY(v)} className="w-32" size="sm">
                    {availableAxes.map((a) => (
                      <option key={`y-${a}`} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const tmp = axisX;
                      setAxisX(axisY);
                      setAxisY(tmp);
                    }}
                    aria-label="交换 X/Y 轴"
                  >
                    交换
                  </Button>
                </div>
              </div>

              <div className="w-full" style={{ aspectRatio: '16/9' }} role="img" aria-label="Pareto前沿散点图">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      type="number"
                      dataKey={axisX}
                      name={axisX}
                      domain={['auto', 'auto']}
                      label={{ value: axisX, position: 'insideBottomRight', offset: -5 }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey={axisY}
                      name={axisY}
                      domain={['auto', 'auto']}
                      label={{ value: axisY, angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number, _name: string) => [
                        typeof value === 'number' ? value.toFixed(4) : value,
                        _name,
                      ]}
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold mb-1">Pareto Rank-{d.pareto_rank}</p>
                            {Object.entries(d.objective_values || {}).map(([k, v]) => (
                              <p key={k}>
                                <span className="text-muted-foreground">{k}:</span> {Number(v).toFixed(4)}
                              </p>
                            ))}
                            <p className="mt-1 pt-1 border-t text-xs text-muted-foreground">
                              拥挤度: {d.crowding_distance?.toFixed(4)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Scatter
                      name="Pareto 前沿"
                      data={scatterData}
                      fill="var(--color-indigo-500, #6366F1)"
                      fillOpacity={0.7}
                      stroke="var(--color-indigo-500, #6366F1)"
                      strokeWidth={2}
                    >
                      {scatterData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getParetoColor(entry.pareto_rank)}
                          r={3 + entry.crowding_distance * 5}
                          opacity={0.8}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Pareto 排名图例 */}
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                {[1, 2, 3, 4, 5].map((rank) => (
                  <div key={rank} className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getParetoColor(rank) }} />
                    Rank {rank}
                  </div>
                ))}
                <span className="text-xs text-neutral-400 ml-2">· 大小 = 拥挤距离</span>
              </div>

              {/* ═══ 目标空间热力图 ═══ */}
              {heatmapGrid.length > 0 && (
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
                    <Grid3X3 className="w-3.5 h-3.5" />
                    目标空间密度分布 ({axisX} vs {axisY})
                  </h4>
                  <svg
                    viewBox={`0 0 200 120`}
                    className="w-full max-w-xs"
                    role="img"
                    aria-label={`${axisX}-${axisY} 密度热力图`}
                  >
                    {heatmapGrid.flatMap((row) =>
                      row.map((cell, ci) => {
                        const intensity = cell.intensity;
                        let fill = 'var(--color-white, #FFFFFF)';
                        if (intensity > 0) {
                          const r = Math.round(intensity * 239);
                          const g = Math.round(intensity * (1 - intensity) * 68);
                          const b = Math.round((1 - intensity) * 178);
                          fill = `rgb(${r},${g},${b})`;
                        }
                        return (
                          <rect
                            key={`${cell.x}-${ci}`}
                            x={ci * 20}
                            y={cell.x * 12}
                            width={19}
                            height={11}
                            fill={fill}
                            stroke="var(--color-slate-200, #E5E7EB)"
                            strokeWidth={0.5}
                            rx={1}
                          >
                            {cell.count > 0 && <title>{`网格 [${cell.x},${ci}]: ${cell.count} 个方案`}</title>}
                          </rect>
                        );
                      }),
                    )}
                  </svg>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>低密度</span>
                    <div className="flex items-center gap-0.5">
                      <span className="w-3 h-2 rounded-sm bg-secondary-100" />
                      <span className="w-3 h-2 rounded-sm bg-accent-200" />
                      <span className="w-3 h-2 rounded-sm bg-error-300" />
                    </div>
                    <span>高密度</span>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ═══ 高级可视化区：平行坐标图 + 雷达图 ═══ */}
          {result?.candidates &&
            result.candidates.length > 0 &&
            result.objectives_config &&
            result.objectives_config.length >= 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1.1 平行坐标图 */}
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
                    <Crosshair className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                    平行坐标图
                    <Badge variant="primary" size="sm">
                      {parallelConfig.displayCandidates.length} 条线
                    </Badge>
                  </h3>
                  {parallelConfig.objectives.length >= 2 ? (
                    <ParallelCoordinatesChart
                      objectives={parallelConfig.objectives}
                      candidates={parallelConfig.displayCandidates}
                      minMax={parallelConfig.minMax}
                      hoveredIdx={parallelHoveredIdx}
                      onHover={setParallelHoveredIdx}
                      onSelectIdx={setSelectedCandidateIdx}
                      selectedIdx={selectedCandidateIdx}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-12 text-neutral-400">目标维度不足</div>
                  )}
                </Card>

                {/* 1.2 雷达图 */}
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-4">
                    <Target className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                    候选方案雷达图
                    {selectedCandidate !== null ? (
                      <Badge variant="success" size="sm">
                        方案 #{(selectedCandidateIdx ?? 0) + 1}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground font-normal">(点击候选卡片或折线查看)</span>
                    )}
                  </h3>
                  {radarData.length > 0 ? (
                    <div style={{ aspectRatio: '1/1', maxHeight: '340px' }} role="img" aria-label="候选方案雷达图">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="var(--color-slate-200, #E5E7EB)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis axisLine={false} tickCount={4} tick={{ fontSize: 10 }} />
                          <Radar
                            name="当前方案"
                            dataKey="score"
                            stroke="var(--color-indigo-500, #6366F1)"
                            fill="var(--color-indigo-500, #6366F1)"
                            fillOpacity={0.25}
                            strokeWidth={2}
                          />
                          <Radar
                            name="最优参考"
                            dataKey="maxScore"
                            stroke="var(--color-slate-400, #9CA3AF)"
                            fill="var(--color-slate-400, #9CA3AF)"
                            fillOpacity={0.05}
                            strokeDasharray="4 4"
                            strokeWidth={1}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg, #fff)',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                            formatter={(value: number) => [value.toFixed(4), undefined]}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-neutral-400 text-sm">
                      请点击左侧候选方案或平行坐标图中的折线
                    </div>
                  )}
                </Card>
              </div>
            )}

          {/* 1.3 权重微调器 */}
          {result?.objectives_config && result.objectives_config.length > 0 && mode !== 'pareto' && (
            <details className="group rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
              <summary className="flex items-center gap-2 cursor-pointer px-5 py-4 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="w-4 h-4 text-indigo-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">权重微调</span>
                <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-5 space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                {currentObjectives.map((obj) => {
                  const currentWeight = adjustedWeights[obj.key] ?? obj.weight;
                  return (
                    <div key={obj.key} className="flex items-center gap-3">
                      <span className="w-24 text-sm truncate text-neutral-600 dark:text-neutral-400">{obj.name}</span>
                      <Slider
                        value={currentWeight}
                        min={0.01}
                        max={1.0}
                        step={0.01}
                        onChange={(v) => handleWeightChange(obj.key, v)}
                        className="flex-1"
                      />
                      <span className="w-14 text-right text-sm font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                        {currentWeight.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="text-xs text-muted-foreground">
                    权重总和:{' '}
                    {Object.values(adjustedWeights).length > 0
                      ? Object.values(adjustedWeights)
                          .reduce((a, b) => a + b, 0)
                          .toFixed(2)
                      : currentObjectives.reduce((a, o) => a + o.weight, 0).toFixed(2)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={normalizeWeights}>
                    自动归一化
                  </Button>
                </div>
              </div>
            </details>
          )}

          {/* --- 各目标最优解 --- */}
          {result?.best_by_objective && result.best_by_objective.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                各目标最优解
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.best_by_objective.map((best, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-neutral-800 dark:text-neutral-200">{best.objective_name}</h4>
                      <Badge variant="success" className="font-mono">
                        {best.score.toFixed(4)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {best.ingredients.map((ing) => (
                        <Badge key={ing.id} variant="neutral" className="text-xs">
                          {ing.name_cn}({ing.dosage}g)
                        </Badge>
                      ))}
                    </div>
                    {best.explanation && <p className="text-xs text-neutral-500 mt-2 line-clamp-2">{best.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Pareto 候选方案详情 --- */}
          {result && result.candidates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                  Pareto 候选方案
                  <Badge variant="primary" size="sm">
                    {result.candidates.length} 个
                  </Badge>
                </h3>
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setCandidateView('cards')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                      candidateView === 'cards'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700',
                    )}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> 卡片
                  </button>
                  <button
                    onClick={() => setCandidateView('table')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                      candidateView === 'table'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700',
                    )}
                  >
                    <TableIcon className="w-3.5 h-3.5" /> 表格
                  </button>
                </div>
              </div>

              {candidateView === 'cards' ? (
                /* 视图1：卡片列表 */
                <ul className="space-y-4" role="list" aria-label="Pareto候选方案卡片列表">
                  {sortedCandidates.map((cand, idx) => (
                    <li key={idx}>
                      <MOCandidateCard
                        candidate={cand}
                        rank={idx + 1}
                        objectivesConfig={result.objectives_config ?? []}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                /* 视图2：对比表格 */
                <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-neutral-800/80">
                        <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 w-12">
                          #
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 w-16">
                          Rank
                        </th>
                        {(result.objectives_config ?? []).map((obj) => (
                          <th
                            key={obj.key}
                            className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-indigo-600 select-none"
                            onClick={() => handleSort(obj.key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {obj.name}
                              {sortKey === obj.key && (sortDir === 'asc' ? '↑' : '↓')}
                            </span>
                          </th>
                        ))}
                        <th
                          className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 cursor-pointer hover:text-indigo-600 select-none"
                          onClick={() => handleSort('overall_fitness')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Fitness
                            {sortKey === 'overall_fitness' && (sortDir === 'asc' ? '↑' : '↓')}
                          </span>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                          药材组成
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedCandidates.map((cand, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="px-3 py-3 text-neutral-500">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                cand.pareto_rank === 1 ? 'success' : cand.pareto_rank === 2 ? 'warning' : 'neutral'
                              }
                              size="sm"
                            >
                              R{cand.pareto_rank}
                            </Badge>
                          </td>
                          {(result.objectives_config ?? []).map((obj) => {
                            const val = cand.objective_scores[obj.key];
                            const isBest =
                              Math.max(...result.candidates.map((c) => c.objective_scores[obj.key] || 0)) === val;
                            return (
                              <td
                                key={obj.key}
                                className={cn('px-3 py-3 font-mono text-xs', isBest && 'font-bold text-primary')}
                              >
                                {val?.toFixed(4)}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 font-mono text-xs">{cand.overall_fitness.toFixed(6)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {cand.ingredients.map((ing) => (
                                <Badge key={ing.id} variant="neutral" className="text-xs">
                                  {ing.name_cn}({ing.dosage}g)
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ 任务3: 历史记录折叠面板 ═══ */}
          <details className="group mt-6 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
            <summary className="flex items-center justify-between cursor-pointer px-5 py-4 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" aria-hidden="true" />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">运行历史记录</span>
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm">
                  {historyRecords.length}
                </Badge>
                <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                  ▼
                </span>
              </div>
            </summary>
            <div className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-800 pt-3">
              {historyLoading ? (
                <Skeleton className="h-40 w-full mt-1" />
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">暂无运行记录</div>
              ) : (
                <div className="space-y-2">
                  {historyRecords.map((record) => (
                    <Card
                      key={record.run_id}
                      className="p-3 cursor-pointer hover:border-primary transition-colors"
                      onClick={() => loadRunDetail(record.run_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          loadRunDetail(record.run_id);
                        }
                      }}
                      aria-label={`加载历史运行 ${record.preset_name || '自定义'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Badge variant={record.algorithm_type === 'nsga2' ? 'primary' : 'neutral'} size="sm">
                            {record.algorithm_type === 'nsga2' ? 'NSGA-II' : 'GA'}
                          </Badge>
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            {record.preset_name || '自定义'}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {record.target_effects?.join(', ') || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                          <span>Fitness: {record.best_fitness.toFixed(4)}</span>
                          <span>{record.execution_time_ms?.toFixed(0)}ms</span>
                          <span>{new Date(record.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

export default MultiObjectivePanel;

// ─── 子组件：平行坐标图 (Parallel Coordinates Chart) ───

interface ParallelCoordinatesChartProps {
  objectives: Array<{ name: string; key: string; direction: string; weight: number }>;
  candidates: Array<{
    objective_scores: Record<string, number>;
    pareto_rank: number;
    crowding_distance: number;
  }>;
  minMax: Record<string, { min: number; max: number }>;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  onSelectIdx: (idx: number) => void;
  selectedIdx: number | null;
}

function ParallelCoordinatesChart({
  objectives,
  candidates,
  minMax,
  hoveredIdx,
  onHover,
  onSelectIdx,
  selectedIdx,
}: ParallelCoordinatesChartProps) {
  const svgWidth = 500;
  const svgHeight = 280;
  const labelY = 18;
  const axisTop = 36;
  const axisBottom = svgHeight - 16;
  const axisRange = axisBottom - axisTop;

  // 计算每个轴的 X 坐标（等距排列）
  const padding = 40;
  const stepX = (svgWidth - padding * 2) / Math.max(objectives.length - 1, 1);
  const axisXPositions = objectives.map((_, i) => padding + i * stepX);

  // 归一化值到 Y 轴坐标
  const getY = useCallback(
    (value: number, objKey: string): number => {
      const range = minMax[objKey];
      if (!range || range.max === range.min) return axisTop + axisRange / 2;
      const normalized = (value - range.min) / (range.max - range.min);
      return axisBottom - normalized * axisRange;
    },
    [minMax, axisTop, axisBottom, axisRange],
  );

  return (
    <div className="w-full" style={{ maxWidth: '100%' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`平行坐标图，展示 ${candidates.length} 个候选方案在 ${objectives.length} 个目标维度上的权衡关系`}
      >
        {/* Y轴标签和轴线 */}
        {objectives.map((obj, i) => (
          <g key={obj.key}>
            {/* 轴标签 */}
            <text
              x={axisXPositions[i]}
              y={labelY}
              textAnchor="middle"
              className="text-[10px] fill-slate-500 dark:fill-slate-400"
              fill="currentColor"
            >
              {obj.name}
            </text>
            {/* 方向指示器 */}
            <circle
              cx={axisXPositions[i] - 8}
              cy={labelY - 3}
              r={3}
              fill={obj.direction === 'maximize' ? 'var(--color-primary, #34C759)' : 'var(--color-orange-500, #EA580C)'}
            />
            {/* 轴线 */}
            <line
              x1={axisXPositions[i]}
              y1={axisTop}
              x2={axisXPositions[i]}
              y2={axisBottom}
              stroke="currentColor"
              opacity={0.15}
            />
          </g>
        ))}

        {/* 每个候选方案的一条折线 */}
        {candidates.map((cand, idx) => {
          const isHovered = hoveredIdx === idx;
          const isSelected = selectedIdx === idx;
          const points = objectives
            .map((obj, i) => `${axisXPositions[i]},${getY(cand.objective_scores[obj.key] ?? 0, obj.key)}`)
            .join(' ');

          return (
            <g key={idx}>
              <polyline
                points={points}
                fill="none"
                stroke={getParetoColor(cand.pareto_rank)}
                strokeWidth={cand.pareto_rank === 1 ? 2.5 : isSelected ? 2.2 : 1.2}
                opacity={isHovered || isSelected ? 1 : 0.55}
                strokeLinejoin="round"
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => onHover(idx)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelectIdx(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectIdx(idx);
                  }
                }}
                aria-label={`候选方案 ${idx + 1}, Pareto Rank-${cand.pareto_rank}${isSelected ? ' (已选中)' : ''}`}
              />
              {/* hover 时显示数据点圆圈 */}
              {(isHovered || isSelected) &&
                objectives.map((obj, i) => {
                  const cy = getY(cand.objective_scores[obj.key] ?? 0, obj.key);
                  return (
                    <circle
                      key={`${idx}-${obj.key}`}
                      cx={axisXPositions[i]}
                      cy={cy}
                      r={3.5}
                      fill={getParetoColor(cand.pareto_rank)}
                      stroke="#fff"
                      strokeWidth={1.2}
                    >
                      <title>
                        {`${obj.name}: ${(cand.objective_scores[obj.key] ?? 0).toFixed(4)} · Rank-${cand.pareto_rank}`}
                      </title>
                    </circle>
                  );
                })}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredIdx !== null && candidates[hoveredIdx] && (
          <foreignObject x={8} y={4} width={180} height={80}>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-2 text-[11px]">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                方案 #{hoveredIdx + 1} · R{candidates[hoveredIdx].pareto_rank}
              </p>
              {objectives.slice(0, 4).map((obj) => (
                <p key={obj.key} className="text-neutral-600 dark:text-neutral-400 flex justify-between gap-2">
                  <span>{obj.name}</span>
                  <span className="font-mono">
                    {(candidates[hoveredIdx].objective_scores[obj.key] ?? 0).toFixed(3)}
                  </span>
                </p>
              ))}
            </div>
          </foreignObject>
        )}
      </svg>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div key={rank} className="flex items-center gap-1 text-xs text-neutral-500">
            <span
              className="w-2.5 h-0.5 rounded-sm"
              style={{ backgroundColor: getParetoColor(rank), height: rank === 1 ? '3px' : '2px' }}
            />
            R{rank}
          </div>
        ))}
        <span className="text-xs text-neutral-400 ml-1">· 点击折线选中查看雷达图</span>
      </div>
    </div>
  );
}

// ─── 子组件：参数滑块 ───

interface MOParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayFormat?: (v: number) => string;
  description?: string;
}

function MOParamSlider({ label, value, min, max, step, onChange, displayFormat, description }: MOParamSliderProps) {
  const displayValue = displayFormat ? displayFormat(value) : String(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
          {displayValue}
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        aria-label={`${label}，当前值 ${displayValue}，范围 ${min}-${max}`}
      />
      {description && <p className="text-xs text-neutral-400 dark:text-neutral-500">{description}</p>}
    </div>
  );
}

// ─── 子组件：统计卡片 ───

interface MOStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'indigo' | 'blue' | 'green' | 'amber' | 'purple' | 'teal';
}

const MO_COLOR_MAP: Record<MOStatCardProps['color'], { bg: string; text: string; iconBg: string }> = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/15',
    text: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  blue: {
    bg: 'bg-secondary-50 dark:bg-secondary-900/15',
    text: 'text-secondary-600 dark:text-secondary-400',
    iconBg: 'bg-secondary-100 dark:bg-secondary-900/30',
  },
  green: {
    bg: 'bg-success-50 dark:bg-success-900/15',
    text: 'text-success-600 dark:text-success-400',
    iconBg: 'bg-success-100 dark:bg-success-900/30',
  },
  amber: {
    bg: 'bg-warning-50 dark:bg-warning-900/15',
    text: 'text-warning-600 dark:text-warning-400',
    iconBg: 'bg-warning-100 dark:bg-warning-900/30',
  },
  purple: {
    bg: 'bg-accent-50 dark:bg-accent-900/15',
    text: 'text-accent-600 dark:text-accent-400',
    iconBg: 'bg-accent-100 dark:bg-accent-900/30',
  },
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-900/15',
    text: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
  },
};

function StatCard({ icon, label, value, color }: MOStatCardProps) {
  const c = MO_COLOR_MAP[color];
  return (
    <div className={cn(c.bg, 'rounded-xl border border-neutral-100 dark:border-neutral-800 p-4')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', c.iconBg, c.text)}>{icon}</div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className={cn('text-lg font-bold tabular-nums', c.text)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── 子组件：候选方案卡片 ───

interface MOCandidateCardProps {
  candidate: MultiObjectiveResponse['candidates'][0];
  rank: number;
  objectivesConfig: Array<{ name: string; key: string; direction: string; weight: number }>;
}

function MOCandidateCard({ candidate, rank, objectivesConfig }: MOCandidateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const rankColor =
    candidate.pareto_rank === 1
      ? 'from-yellow-400 to-amber-500'
      : candidate.pareto_rank === 2
        ? 'from-slate-300 to-slate-400'
        : candidate.pareto_rank === 3
          ? 'from-amber-600 to-amber-700'
          : 'from-slate-400 to-slate-500';

  return (
    <article
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 overflow-hidden"
      aria-label={`Pareto 方案第 ${rank} 名，Rank-${candidate.pareto_rank}，适应度 ${candidate.overall_fitness.toFixed(4)}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white',
                  `bg-gradient-to-br ${rankColor}`,
                )}
                aria-label={`排名第 ${rank}`}
              >
                {rank}
              </span>
              <Badge
                variant={candidate.pareto_rank === 1 ? 'success' : candidate.pareto_rank === 2 ? 'warning' : 'neutral'}
              >
                Pareto R{candidate.pareto_rank}
              </Badge>
              {candidate.compliance_status && (
                <Badge
                  variant={
                    candidate.compliance_status === 'compliant' ? 'success' :
                    candidate.compliance_status === 'warning' ? 'warning' : 'danger'
                  }
                  size="sm"
                >
                  {candidate.compliance_status === 'compliant' ? '✓ 营养合规' :
                   candidate.compliance_status === 'warning' ? '⚠ 营养警告' : '✗ 营养违规'}
                </Badge>
              )}
              <span className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                {candidate.overall_fitness.toFixed(4)}
              </span>
              <span className="text-xs text-neutral-400">拥挤度: {candidate.crowding_distance.toFixed(4)}</span>
            </div>

            {/* 药材组成 */}
            <div className="flex flex-wrap gap-1.5">
              {candidate.ingredients.map((ing) => (
                <span
                  key={ing.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md text-xs text-neutral-700 dark:text-neutral-300"
                >
                  {ing.name_cn}
                  <span className="text-neutral-400 dark:text-neutral-500">{ing.dosage}g</span>
                </span>
              ))}
            </div>
          </div>

          {/* 目标分数条形图 */}
          <div className="hidden sm:flex items-end gap-1 h-16 flex-shrink-0" aria-label="各目标分数可视化">
            {objectivesConfig.slice(0, 6).map((obj) => {
              const val = (candidate.objective_scores ?? {})[obj.key] ?? 0;
              const barColor = obj.direction === 'maximize' ? 'bg-primary-500' : 'bg-orange-500';
              return (
                <div
                  key={obj.key}
                  className="flex flex-col items-center gap-1"
                  title={`${obj.name}: ${val.toFixed(4)}`}
                >
                  <div
                    className={cn('w-3 rounded-t-sm opacity-80 barColor')}
                    style={{
                      height: `${Math.max(Math.abs(val) * 48, 4)}px`,
                      backgroundColor: obj.direction === 'maximize' ? undefined : 'var(--color-orange-500, #EA580C)',
                    }}
                  />
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap truncate w-8 text-center">
                    {obj.name.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex-shrink-0 self-center text-neutral-400" aria-hidden="true">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-neutral-100 dark:border-neutral-800 pt-4 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {objectivesConfig.map((obj) => {
              const val = candidate.objective_scores[obj.key] ?? 0;
              return (
                <div
                  key={obj.key}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2"
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      obj.direction === 'maximize' ? 'bg-primary-500' : 'bg-orange-500',
                    )}
                  />
                  <div>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{obj.name}</p>
                    <p className="text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                      {val.toFixed(4)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
              <Zap className="w-2 h-2 text-violet-500" />
              <div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">拥挤距离</p>
                <p className="text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                  {candidate.crowding_distance.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {candidate.explanation && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-4 border border-indigo-100 dark:border-indigo-900/20">
              <h5 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                方案解析
              </h5>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {candidate.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
