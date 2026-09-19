/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 肽链结构分析器 - 增强版
 * 功能：完整分析、结构转换、数据库查询、对比分析、历史记录、可视化图表
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { peptideStructureService } from '@/services/professional/peptideStructureService';
import { Button, Input, Card, Badge, Tabs, Table } from '@/components/ui';
import {
  Beaker, ArrowRightLeft, Dna, ShieldCheck, Activity, FlaskConical,
  AlertCircle, CheckCircle, Database, GitCompare as Compare, History, BarChart3,
  Search, TrendingUp, Filter, Download, Trash2, Plus, X, Copy
} from 'lucide-react';

// 使用全局echarts对象（从CDN加载）
declare global {
  interface Window {
    echarts?: any;
  }
}

const ReactECharts = ({ option, style }: { option: any; style?: any }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    // 添加调试日志
    console.log('[ReactECharts] 初始化图表, option:', !!option, 'window.echarts:', !!window.echarts);

    const initChart = () => {
      const echarts = window.echarts;
      console.log('[ReactECharts] echarts对象:', typeof echarts, echarts ? 'init' : 'null');

      if (!echarts || !chartRef.current) {
        console.warn('[ReactECharts] 缺少echarts或chartRef');
        return;
      }

      if (!chartInstance.current) {
        try {
          chartInstance.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
          console.log('[ReactECharts] 图表初始化成功');
        } catch (err) {
          console.error('[ReactECharts] 初始化失败:', err);
        }
      }

      if (chartInstance.current && option) {
        try {
          chartInstance.current.setOption(option, true);
          console.log('[ReactECharts] setOption成功');
        } catch (err) {
          console.error('[ReactECharts] setOption失败:', err);
        }
      }
    };

    // 等待echarts加载
    if (window.echarts) {
      initChart();
    } else {
      console.log('[ReactECharts] 等待echarts加载...');
      let attempts = 0;
      const checkEcharts = setInterval(() => {
        attempts++;
        console.log(`[ReactECharts] 尝试加载echarts (第${attempts}次)`, !!window.echarts);
        if (window.echarts) {
          clearInterval(checkEcharts);
          initChart();
        }
        if (attempts >= 50) {
          clearInterval(checkEcharts);
          console.error('[ReactECharts] 加载echarts超时');
        }
      }, 100);
      setTimeout(() => clearInterval(checkEcharts), 5000);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
        console.log('[ReactECharts] 图表已销毁');
      }
    };
  }, [option]);

  return <div ref={chartRef} style={{ ...style, width: '100%' }} className="w-full h-full" />;
};

// ─── 类型定义 ───
interface SequenceToSmilesRequest {
  sequence: string;
  n_terminal?: string;
  c_terminal?: string;
}

interface PeptideAnalysisResult {
  sequence: string;
  smiles?: string;
  selfies?: string;
  molecular_weight: number;
  isoelectric_point: number;
  hydrophobicity: number;
  ace_inhibition: ActivityScore;
  antioxidant: ActivityScore;
  antimicrobial: ActivityScore;
  safety: SafetyInfo;
  taste: TasteInfo;
  source: SourceInfo;
  analysis_time: string;
}

interface ActivityScore {
  score: number;
  level: 'high' | 'medium' | 'low' | 'none';
}

interface SafetyInfo {
  food_score: number;
  is_allergen: boolean;
  is_toxic: boolean;
  digestibility: string;
}

interface TasteInfo {
  bitterness: number;
  umami: number;
}

interface SourceInfo {
  food?: string;
  database?: string;
  references: string[];
}

interface HistoryRecord {
  id: number;
  sequence: string;
  molecular_weight: number;
  food_safety_score: number;
  ace_inhibition_score: number;
  antioxidant_score: number;
  antimicrobial_score: number;
  is_allergen: boolean;
  is_toxic: boolean;
  digestibility: string;
  created_at: string;
}

interface DatabasePeptide {
  sequence: string;
  source_protein?: string;
  activity_type?: string;
  activity_value?: number;
  activity_unit?: string;
  molecular_weight?: number;
  food_source?: string;
  source_database: string;
}

type TabType = 'analyze' | 'convert' | 'database' | 'compare' | 'history';

// ─── 工具函数 ───
function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getActivityBadge(level: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (level) {
    case 'high': return 'success';
    case 'medium': return 'warning';
    case 'low': return 'danger';
    default: return 'neutral';
  }
}

// ─── 评分进度条组件 ───
function ScoreProgress({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">{label}</span>
        <span className={`font-medium ${getScoreColor(score)}`}>{(score * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${score * 100}%`,
            backgroundColor: score >= 0.8 ? '#22c55e' : score >= 0.5 ? '#eab308' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

// ─── 雷达图配置 ───
function RadarChart({ data }: { data: PeptideAnalysisResult }) {
  const option = {
    title: {
      text: '活性谱雷达图',
      left: 'center',
      top: 5,
      textStyle: { fontSize: 12, fontWeight: 'normal', color: 'var(--text-secondary,#6B7280)' }
    },
    radar: {
      indicator: [
        { name: 'ACE抑制', max: 1 },
        { name: '抗氧化', max: 1 },
        { name: '抗菌', max: 1 },
        { name: '食品安全', max: 1 },
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: 'var(--text-secondary,#6B7280)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(128,128,128,0.2)' } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: 'rgba(128,128,128,0.3)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [
          data.ace_inhibition.score,
          data.antioxidant.score,
          data.antimicrobial.score,
          data.safety.food_score / 100,
        ],
        name: '活性谱',
        areaStyle: { color: 'rgba(59,130,246,0.2)' },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
      }],
    }],
    tooltip: { trigger: 'item' },
    legend: { show: false },
  };
  return <ReactECharts option={option} style={{ height: 240 }} />;
}

// ─── 柱状图配置 ───
function BarChart({ data }: { data: PeptideAnalysisResult }) {
  const option = {
    title: {
      text: '活性得分柱状图',
      left: 'center',
      top: 5,
      textStyle: { fontSize: 12, fontWeight: 'normal', color: 'var(--text-secondary,#6B7280)' }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '25%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['ACE抑制', '抗氧化', '抗菌', '食品安全'],
      axisLabel: { color: 'var(--text-secondary,#6B7280)', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(128,128,128,0.3)' } },
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        formatter: (value: number) => `${(value * 100).toFixed(0)}%`,
        color: 'var(--text-secondary,#6B7280)'
      },
      splitLine: { lineStyle: { color: 'rgba(128,128,128,0.1)', type: 'dashed' } },
      axisLine: { lineStyle: { color: 'rgba(128,128,128,0.3)' } },
    },
    series: [{
      data: [
        {
          value: data.ace_inhibition.score,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
        },
        {
          value: data.antioxidant.score,
          itemStyle: { color: '#22c55e', borderRadius: [4, 4, 0, 0] }
        },
        {
          value: data.antimicrobial.score,
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] }
        },
        {
          value: data.safety.food_score / 100,
          itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] }
        },
      ],
      type: 'bar',
      barWidth: '50%',
      label: {
        show: true,
        position: 'top',
        formatter: (params: any) => `${(params.value * 100).toFixed(0)}%`,
        fontSize: 10,
        color: 'var(--text-secondary,#6B7280)'
      },
    }],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name}<br/>得分: <b>${(p.value * 100).toFixed(1)}%</b>`;
      },
    },
  };
  return <ReactECharts option={option} style={{ height: 240 }} />;
}

// ─── 对比分析组件 ───
function ComparisonView({ sequences }: { sequences: string[] }) {
  const [results, setResults] = useState<PeptideAnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompare = useCallback(async () => {
    if (sequences.length < 2) return;
    setLoading(true);
    try {
      const comparisons = await Promise.all(
        sequences.map(seq => peptideStructureService.analyzePeptide(seq))
      );
      setResults(comparisons);
    } catch (e) {
      console.error('对比分析失败:', e);
    } finally {
      setLoading(false);
    }
  }, [sequences]);

  if (sequences.length < 2) {
    return (
      <div className="text-center py-8 text-[var(--text-muted,#9A9A9F)]">
        <Compare className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">请至少输入2条序列进行对比分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={handleCompare} disabled={loading} className="flex-1">
          {loading ? '分析中...' : '开始对比'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {/* 对比表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">序列</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">分子量</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">食品评分</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">ACE抑制</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗氧化</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗菌</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">过敏</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">毒性</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono font-medium">{r.sequence}</td>
                    <td className="px-3 py-2 text-right">{r.molecular_weight.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-bold ${getScoreColor(r.safety.food_score / 100)}`}>
                        {r.safety.food_score.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{(r.ace_inhibition.score * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{(r.antioxidant.score * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{(r.antimicrobial.score * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      {r.safety.is_allergen ? (
                        <span className="text-red-500">是</span>
                      ) : (
                        <span className="text-green-500">否</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.safety.is_toxic ? (
                        <span className="text-red-500">是</span>
                      ) : (
                        <span className="text-green-500">否</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 综合评分对比图 */}
          <div className="pt-4">
            <h4 className="text-sm font-medium mb-3">活性对比</h4>
            <ReactECharts
              option={{
                radar: {
                  indicator: [
                    { name: 'ACE抑制', max: 1 },
                    { name: '抗氧化', max: 1 },
                    { name: '抗菌', max: 1 },
                    { name: '食品安全', max: 1 },
                  ],
                  shape: 'polygon',
                  splitNumber: 4,
                },
                series: [{
                  type: 'radar',
                  data: results.map((r, i) => ({
                    value: [
                      r.ace_inhibition.score,
                      r.antioxidant.score,
                      r.antimicrobial.score,
                      r.safety.food_score / 100,
                    ],
                    name: r.sequence,
                    lineStyle: { color: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i % 4] },
                    areaStyle: { color: (['rgba(59,130,246,0.1)', 'rgba(34,197,94,0.1)', 'rgba(245,158,11,0.1)', 'rgba(239,68,68,0.1)'][i % 4]) },
                  })),
                }],
                legend: { bottom: 0, textStyle: { fontSize: 10 } },
              }}
              style={{ height: 280 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 数据库查询组件 ───
function DatabaseView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DatabasePeptide[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await peptideStructureService.searchDatabase({ sequence: query });
      setResults(res.peptides);
    } catch (e) {
      console.error('数据库搜索失败:', e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleLoadStats = useCallback(async () => {
    try {
      const res = await peptideStructureService.getDatabaseStatistics();
      setStats(res);
    } catch (e) {
      console.error('获取统计失败:', e);
    }
  }, []);

  useEffect(() => {
    handleLoadStats();
  }, []);

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="输入序列搜索数据库..."
          className="flex-1 font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading || !query}>
          <Search className="w-4 h-4 mr-1" />
          搜索
        </Button>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{stats.total_peptides}</div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">总肽数</div>
          </div>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{Object.keys(stats.activities).length}</div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">活性类型</div>
          </div>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{Object.keys(stats.food_sources).length}</div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">食物来源</div>
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">序列</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">来源蛋白</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">活性类型</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">活性值</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">食物来源</th>
              </tr>
            </thead>
            <tbody>
              {results.map((p, i) => (
                <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-mono font-medium">{p.sequence}</td>
                  <td className="px-3 py-2 text-xs">{p.source_protein || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.activity_type || '-'}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {p.activity_value ? `${p.activity_value} ${p.activity_unit}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs">{p.food_source || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="text-center py-8 text-[var(--text-muted,#9A9A9F)]">
          <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">未找到匹配记录</p>
        </div>
      )}
    </div>
  );
}

// ─── 历史记录组件 ───
function HistoryView() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, statsRes] = await Promise.all([
        peptideStructureService.getHistory({ page, page_size: 20 }),
        peptideStructureService.getHistoryStatistics(),
      ]);
      setRecords(histRes.items);
      setStats(statsRes);
    } catch (e) {
      console.error('加载历史失败:', e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await peptideStructureService.deleteHistory(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('删除失败:', e);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* 统计概览 */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className="text-xl font-bold text-primary">{stats.total_analyses}</div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">总分析数</div>
          </div>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className="text-xl font-bold text-primary">{stats.avg_food_score.toFixed(1)}</div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">平均评分</div>
          </div>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className={`text-xl font-bold ${stats.allergen_count > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {stats.allergen_count}
            </div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">过敏原</div>
          </div>
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-center">
            <div className={`text-xl font-bold ${stats.toxic_count > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {stats.toxic_count}
            </div>
            <div className="text-xs text-[var(--text-muted,#9A9A9F)]">毒性</div>
          </div>
        </div>
      )}

      {/* 评分分布图 */}
      {stats?.score_distribution && stats.score_distribution.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">评分分布</h4>
          <ReactECharts
            option={{
              xAxis: {
                type: 'category',
                data: stats.score_distribution.map(d => `${(d.bin * 10)}-${((d.bin + 1) * 10)}%`),
                axisLabel: { color: 'var(--text-secondary,#6B7280)', fontSize: 10 },
              },
              yAxis: {
                type: 'value',
                axisLabel: { color: 'var(--text-secondary,#6B7280)' },
                splitLine: { lineStyle: { color: 'rgba(128,128,128,0.1)' } },
              },
              series: [{
                data: stats.score_distribution.map(d => d.count),
                type: 'bar',
                barWidth: '60%',
                itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
              }],
              tooltip: { trigger: 'axis' },
            }}
            style={{ height: 180 }}
          />
        </div>
      )}

      {/* 历史记录列表 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted,#9A9A9F)]">序列</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">分子量</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">评分</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">ACE</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted,#9A9A9F)]">抗氧化</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">过敏</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">时间</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-muted,#9A9A9F)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="px-3 py-2 font-mono font-medium">{r.sequence}</td>
                <td className="px-3 py-2 text-right">{r.molecular_weight.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`font-bold ${getScoreColor(r.food_safety_score / 100)}`}>
                    {r.food_safety_score.toFixed(0)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{(r.ace_inhibition_score * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{(r.antioxidant_score * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-center">
                  {r.is_allergen ? (
                    <span className="text-red-500">是</span>
                  ) : (
                    <span className="text-green-500">否</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="text-center py-4 text-[var(--text-muted,#9A9A9F)]">加载中...</div>
      )}
    </div>
  );
}

// ─── 主组件 ───
export default function PeptideStructureAnalyzer() {
  const [sequence, setSequence] = useState('');
  const [compareSequences, setCompareSequences] = useState<string[]>([]);
  const [compareInput, setCompareInput] = useState('');
  const [nTerminal, setNTerminal] = useState('');
  const [cTerminal, setCTerminal] = useState('');
  const [result, setResult] = useState<PeptideAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('analyze');
  const [initialized, setInitialized] = useState(false);

  // 初始化
  useEffect(() => {
    peptideStructureService.init().then(() => setInitialized(true));
  }, []);

  // 完整分析
  const handleAnalyze = useCallback(async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入至少2个氨基酸的序列');
      return;
    }
    if (sequence.length > 100) {
      setError('序列长度不能超过100个氨基酸');
      return;
    }
    const validPattern = /^[ACDEFGHIKLMNPQRSTVYW]+$/;
    if (!validPattern.test(sequence.toUpperCase())) {
      setError('序列包含无效字符，请使用标准单字母氨基酸代码');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await peptideStructureService.analyzePeptide(sequence.toUpperCase(), {
        n_terminal: nTerminal || undefined,
        c_terminal: cTerminal || undefined,
      });
      setResult(res as PeptideAnalysisResult);
    } catch (e: any) {
      setError(e.message || '分析失败');
    } finally {
      setLoading(false);
    }
  }, [sequence, nTerminal, cTerminal]);

  // 序列转换
  const handleConvert = useCallback(async () => {
    if (!sequence || sequence.length < 2) {
      setError('请输入至少2个氨基酸的序列');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await peptideStructureService.sequenceToSmiles({
        sequence: sequence.toUpperCase(),
        n_terminal: nTerminal || undefined,
        c_terminal: cTerminal || undefined,
      });
      if (res.smiles) {
        setResult({
          sequence: res.sequence || sequence.toUpperCase(),
          smiles: res.smiles,
          selfies: res.selfies,
          molecular_weight: res.molecular_weight || 0,
          isoelectric_point: 0,
          hydrophobicity: 0,
          ace_inhibition: { score: 0, level: 'none' },
          antioxidant: { score: 0, level: 'none' },
          antimicrobial: { score: 0, level: 'none' },
          safety: { food_score: 0, is_allergen: false, is_toxic: false, digestibility: 'N/A' },
          taste: { bitterness: 0, umami: 0 },
          source: { food: undefined, database: undefined, references: [] },
          analysis_time: new Date().toISOString(),
        } as PeptideAnalysisResult);
      }
    } catch (e: any) {
      setError(e.message || '转换失败');
    } finally {
      setLoading(false);
    }
  }, [sequence, nTerminal, cTerminal]);

  // 添加对比序列
  const addCompareSequence = useCallback(() => {
    const seq = compareInput.trim().toUpperCase();
    if (seq && seq.length >= 2 && !compareSequences.includes(seq)) {
      setCompareSequences(prev => [...prev, seq]);
      setCompareInput('');
    }
  }, [compareInput, compareSequences]);

  // 清空结果
  const handleClear = useCallback(() => {
    setSequence('');
    setNTerminal('');
    setCTerminal('');
    setResult(null);
    setError(null);
  }, []);

  const quickSequences = ['AC', 'VLGYT', 'LLPGTFVDNQKF', 'RPYPIP'];

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'analyze', label: '完整分析', icon: Beaker },
    { key: 'convert', label: '结构转换', icon: ArrowRightLeft },
    { key: 'database', label: '数据库', icon: Database },
    { key: 'compare', label: '对比分析', icon: Compare },
    { key: 'history', label: '历史记录', icon: History },
  ];

  return (
    <div className="space-y-4">
      {/* Tab 导航 */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              size="sm"
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 justify-center ${activeTab === tab.key ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''}`}
            >
              <Icon className="w-3.5 h-3.5 mr-1" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* 完整分析 */}
      {activeTab === 'analyze' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                氨基酸序列
              </label>
              <Input
                value={sequence}
                onChange={(e) => setSequence(e.target.value.toUpperCase())}
                placeholder="例如: ACDEFG 或 VLGYT"
                className="font-mono text-sm"
                maxLength={100}
              />
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-[var(--text-muted,#9A9A9F)]">快速测试:</span>
                {quickSequences.map((seq) => (
                  <button
                    key={seq}
                    onClick={() => setSequence(seq)}
                    className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {seq}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                  N端修饰
                </label>
                <Input
                  value={nTerminal}
                  onChange={(e) => setNTerminal(e.target.value.toUpperCase())}
                  placeholder="例如: ACT (乙酰化)"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                  C端修饰
                </label>
                <Input
                  value={cTerminal}
                  onChange={(e) => setCTerminal(e.target.value.toUpperCase())}
                  placeholder="例如: AMD (酰胺化)"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={loading || !sequence}
                className="flex-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                    分析中...
                  </span>
                ) : (
                  <>
                    <FlaskConical className="w-4 h-4 mr-1" />
                    完整分析
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={loading}>
                清空
              </Button>
            </div>
          </Card>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-primary" />
                  基本信息
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">序列</div>
                    <div className="font-mono text-sm font-medium">{result.sequence}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">分子量</div>
                    <div className="text-sm font-medium">{result.molecular_weight.toFixed(2)} Da</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">等电点</div>
                    <div className="text-sm font-medium">{result.isoelectric_point.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">疏水性</div>
                    <div className="text-sm font-medium">{result.hydrophobicity.toFixed(4)}</div>
                  </div>
                </div>
                {result.smiles && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-[var(--text-muted,#9A9A9F)] flex items-center gap-1">
                        <Dna className="w-3 h-3" />
                        分子结构式
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(result.smiles!)}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                          title="复制SMILES"
                        >
                          <Copy className="w-3 h-3" />
                          复制SMILES
                        </button>
                      </div>
                    </div>

                    {/* 分子结构图 */}
                    <div className="mb-3 p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center min-h-[200px]">
                      <img
                        src={`/api/v1/peptide-structure/smiles-to-image?smiles=${encodeURIComponent(result.smiles)}`}
                        alt="分子结构"
                        className="max-w-full max-h-[250px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden text-center text-[var(--text-muted,#9A9A9F)]">
                        <Dna className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">结构图生成中...</p>
                      </div>
                    </div>

                    {/* SMILES文本 */}
                    <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SMILES字符串</div>
                      <div className="font-mono text-xs break-all text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)] leading-relaxed">
                        {result.smiles}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>基于RDKit生成的二维分子结构图 | 可导入ChemDraw、PyMOL进行三维可视化</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* 可视化图表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    活性雷达图
                  </h3>
                  <RadarChart data={result} />
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    活性柱状图
                  </h3>
                  <BarChart data={result} />
                </Card>
              </div>

              {/* 活性预测 */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  活性预测
                </h3>
                <div className="space-y-3">
                  <ScoreProgress label="ACE抑制活性" score={result.ace_inhibition.score} />
                  <ScoreProgress label="抗氧化活性" score={result.antioxidant.score} />
                  <ScoreProgress label="抗菌活性" score={result.antimicrobial.score} />
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Badge variant={getActivityBadge(result.ace_inhibition.level)}>ACE抑制: {result.ace_inhibition.level}</Badge>
                  <Badge variant={getActivityBadge(result.antioxidant.level)}>抗氧化: {result.antioxidant.level}</Badge>
                  <Badge variant={getActivityBadge(result.antimicrobial.level)}>抗菌: {result.antimicrobial.level}</Badge>
                </div>
              </Card>

              {/* 安全性评估 */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  安全性评估
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{result.safety.food_score.toFixed(0)}</div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">食品安全评分</div>
                  </div>
                  <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <div className={`text-2xl font-bold ${result.safety.is_allergen ? 'text-red-500' : 'text-green-500'}`}>
                      {result.safety.is_allergen ? '是' : '否'}
                    </div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">过敏原</div>
                  </div>
                  <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <div className={`text-2xl font-bold ${result.safety.is_toxic ? 'text-red-500' : 'text-green-500'}`}>
                      {result.safety.is_toxic ? '是' : '否'}
                    </div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">毒性</div>
                  </div>
                  <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary capitalize">{result.safety.digestibility}</div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)]">消化性</div>
                  </div>
                </div>
              </Card>

              {/* 风味预测 */}
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">风味预测</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">苦味</span>
                      <span className="font-medium">{(result.taste.bitterness * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${result.taste.bitterness * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">鲜味</span>
                      <span className="font-medium">{(result.taste.umami * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${result.taste.umami * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <div className="text-xs text-[var(--text-muted,#9A9A9F)] text-right">
                分析时间: {new Date(result.analysis_time).toLocaleString()}
              </div>
            </div>
          )}

          {!result && !error && (
            <div className="text-center py-12 text-[var(--text-muted,#9A9A9F)]">
              <Dna className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">输入肽序列进行结构分析与活性预测</p>
              <p className="text-xs mt-1">支持 420 种非天然氨基酸和 296 种末端修饰</p>
            </div>
          )}
        </div>
      )}

      {/* 结构转换 */}
      {activeTab === 'convert' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                氨基酸序列
              </label>
              <Input
                value={sequence}
                onChange={(e) => setSequence(e.target.value.toUpperCase())}
                placeholder="例如: ACDEFG"
                className="font-mono text-sm"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                  N端修饰
                </label>
                <Input
                  value={nTerminal}
                  onChange={(e) => setNTerminal(e.target.value.toUpperCase())}
                  placeholder="例如: ACT"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)]">
                  C端修饰
                </label>
                <Input
                  value={cTerminal}
                  onChange={(e) => setCTerminal(e.target.value.toUpperCase())}
                  placeholder="例如: AMD"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConvert} disabled={loading || !sequence} className="flex-1">
                {loading ? '处理中...' : '序列转 SMILES'}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={loading}>清空</Button>
            </div>
          </Card>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
          )}
          {result?.smiles && (
            <Card className="p-4">
              <h3 className="text-sm font-medium mb-3">转换结果</h3>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SMILES</div>
                  <div className="font-mono text-xs break-all bg-neutral-50 dark:bg-neutral-800 p-2 rounded">{result.smiles}</div>
                </div>
                {result.selfies && (
                  <div>
                    <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SELFIES</div>
                    <div className="font-mono text-xs break-all bg-neutral-50 dark:bg-neutral-800 p-2 rounded">{result.selfies}</div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 数据库 */}
      {activeTab === 'database' && <DatabaseView />}

      {/* 对比分析 */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">添加对比序列</h3>
            <div className="flex gap-2 mb-3">
              <Input
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                placeholder="输入序列..."
                className="flex-1 font-mono"
                onKeyDown={(e) => e.key === 'Enter' && addCompareSequence()}
              />
              <Button onClick={addCompareSequence} disabled={!compareInput.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {compareSequences.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {compareSequences.map((seq, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-sm font-mono">
                    {seq}
                    <button onClick={() => setCompareSequences(prev => prev.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>
          <ComparisonView sequences={compareSequences} />
        </div>
      )}

      {/* 历史记录 */}
      {activeTab === 'history' && <HistoryView />}
    </div>
  );
}
