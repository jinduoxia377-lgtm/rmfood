/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 肽链结构分析器 - 增强版
 * 功能：完整分析、结构转换、数据库查询、对比分析、历史记录、可视化图表
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { peptideStructureService } from '@/services/professional/peptideStructureService';
import { Button, Input, Card, Badge, Tabs, Pagination } from '@/components/ui';
import { databaseApi } from '@/api/database';
import { MoleculeViewer3D } from '@/components/molecule';
import {
  Beaker, ArrowRightLeft, Dna, ShieldCheck, Activity, FlaskConical,
  AlertCircle, CheckCircle, Database, GitCompare as Compare, History, BarChart3,
  Search, TrendingUp, Filter, Download, Trash2, Plus, X, Copy,
  Layers, Zap, Target, TestTube, Bot, ZoomIn, Expand,
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
  const optionRef = useRef<any>(option);
  optionRef.current = option;
  const [echartsReady, setEchartsReady] = useState(true);

  useEffect(() => {
    const echarts = window.echarts;
    if (!echarts) {
      setEchartsReady(false);
      return;
    }
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
    }

    chartInstance.current.setOption(optionRef.current, true);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!echartsReady) {
    return (
      <div style={style} className="w-full h-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <span className="text-xs text-[var(--text-muted,#9A9A9F)]">图表加载失败，请检查网络连接</span>
      </div>
    );
  }

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

// 3D分子坐标类型
interface Atom3D {
  element: string;
  x: number;
  y: number;
  z: number;
  atomic_num: number;
}

interface Bond3D {
  start: number;
  end: number;
  type: string;
}

interface Molecule3DData {
  success: boolean;
  smiles: string;
  atom_count: number;
  bond_count: number;
  molecular_weight: number;
  atoms: Atom3D[];
  bonds: Bond3D[];
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

type TabType = 'analyze' | 'convert' | 'database' | 'compare' | 'history' | 'batch' | 'deep' | 'optimize' | 'synergy';

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
            backgroundColor: score >= 0.8 ? 'var(--color-primary-500)' : score >= 0.5 ? '#eab308' : '#ef4444',
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
          itemStyle: { color: 'var(--color-primary-500)', borderRadius: [4, 4, 0, 0] }
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
                    lineStyle: { color: ['#3b82f6', 'var(--color-primary-500)', '#f59e0b', '#ef4444'][i % 4] },
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
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number>(0); // 保存搜索结果总数
  const PAGE_SIZE = 20;

  const doSearch = useCallback(async (q: string, p: number = 1) => {
setLoading(true);
    try {
      const res = await peptideStructureService.searchDatabase({ sequence: q || undefined, page: p, page_size: PAGE_SIZE });

      setResults(res.peptides);
      setTotal(res.total || 0);
      setShowAll(q === '');
    } catch (e) {
      console.error('数据库搜索失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadStats = useCallback(async () => {
    try {
      const res = await peptideStructureService.getDatabaseStatistics();
      // service 已返回 statistics 对象，直接使用
      setStats(res);
    } catch (e) {
      console.error('获取统计失败:', e);
    }
  }, []);

  useEffect(() => {
    handleLoadStats();
    // 默认显示前20条
    doSearch('', 1);
  }, []);

  const handleSearch = useCallback(() => {

    setPage(1);
    doSearch(query, 1);
  }, [query, doSearch]);

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
        <Button onClick={() => {  handleSearch(); }} disabled={loading || !query}>
          <Search className="w-4 h-4 mr-1" />
          搜索
        </Button>

        <Button variant="outline" onClick={() => doSearch('', 1)} disabled={loading}>
          显示全部
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
      {loading && <div className="text-center py-8 text-[var(--text-muted)]">加载中...</div>}
      {!loading && results.length > 0 && (
        <>
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
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            onPageChange={(p) => { setPage(p); doSearch(query, p); }}
            total={total || stats?.total_peptides || 0}
          />
        </>
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
                data: stats.score_distribution.map((d: any) => `${(d.bin * 10)}-${((d.bin + 1) * 10)}%`),
                axisLabel: { color: 'var(--text-secondary,#6B7280)', fontSize: 10 },
              },
              yAxis: {
                type: 'value',
                axisLabel: { color: 'var(--text-secondary,#6B7280)' },
                splitLine: { lineStyle: { color: 'rgba(128,128,128,0.1)' } },
              },
              series: [{
                data: stats.score_distribution.map((d: any) => d.count),
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

// ─── 批量分析组件 ──────────────────────────────────────────
function BatchAnalysisView() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBatch = useCallback(async () => {
    const seqs = input.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (seqs.length === 0) { setError('请输入至少一条序列'); return; }
    if (seqs.length > 50) { setError('最多支持50条序列'); return; }
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await peptideStructureService.batchAnalyze(seqs);
      // 后端返回扁平结构：{ success, count, results: [{sequence, molecular_weight, ...}] }
      // 判定成功依据：存在 sequence 且解析出了分子量，而非无条件置 true
      setResults((res.results || []).map(r => {
        const ok = !!r && !!r.sequence && (r.molecular_weight ?? 0) > 0;
        return {
          ...r,
          success: ok,
          result: ok ? r : null,
          error: ok ? undefined : '分析失败或序列无法解析',
        };
      }));
    } catch (e: any) {
      setError(e.message || '批量分析失败');
    } finally {
      setLoading(false);
    }
  }, [input]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <label className="text-xs text-[var(--text-secondary)] block">输入序列（每行一条，最多50条）</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={"ACDEFG\nVLGYT\nLLPGTFVDNQKF"}
          className="w-full h-32 font-mono text-xs p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 resize-none"
        />
        <div className="flex gap-2">
          <Button onClick={handleBatch} disabled={loading || !input.trim()} className="flex-1">
            {loading ? <><span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block mr-1"/>分析中...</> : <><FlaskConical className="w-4 h-4 mr-1"/>批量分析</>}
          </Button>
        </div>
      </Card>
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}</div>}
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
              {['序列', '成功', '分子量', '食品评分', 'ACE抑制', '抗氧化', '抗菌', '过敏', '毒性'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-mono text-xs">{r.sequence}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${r.success ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{r.success ? '成功' : '失败'}</span></td>
                  {r.success && r.result ? (
                    <>
                      <td className="px-3 py-2 font-mono text-xs">{r.result.molecular_weight?.toFixed(1) ?? '-'}</td>
                      <td className="px-3 py-2"><span className={`font-bold ${getScoreColor((r.result.safety?.food_score ?? 0) / 100)}`}>{(r.result.safety?.food_score ?? 0).toFixed(0)}</span></td>
                      <td className="px-3 py-2 text-xs">{((r.result.ace_inhibition?.score ?? 0) * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-xs">{((r.result.antioxidant?.score ?? 0) * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-xs">{((r.result.antimicrobial?.score ?? 0) * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center text-xs">{r.result.safety?.is_allergen ? '是' : '否'}</td>
                      <td className="px-3 py-2 text-center text-xs">{r.result.safety?.is_toxic ? '是' : '否'}</td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-3 py-2 text-xs text-red-500">{r.error ?? '-'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 高级深度分析组件 ───────────────────────────────────────
function DeepAnalysisView() {
  const [sequence, setSequence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleDeepAnalyze = useCallback(async () => {
    if (!sequence || sequence.length < 2) { setError('请输入至少2个氨基酸的序列'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await peptideStructureService.deepAnalyze(sequence.toUpperCase());
      setResult(res.data);
    } catch (e: any) {
      setError(e.message || '深度分析失败');
    } finally {
      setLoading(false);
    }
  }, [sequence]);

  if (!result) return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <label className="text-xs text-[var(--text-secondary)] block">氨基酸序列</label>
        <Input value={sequence} onChange={e => setSequence(e.target.value.toUpperCase())} placeholder="例如: VLGYT" className="font-mono" maxLength={50} />
        <Button onClick={handleDeepAnalyze} disabled={loading || !sequence} className="w-full">
          {loading ? <><span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block mr-1"/>分析中...</> : <><Bot className="w-4 h-4 mr-1"/>深度分析</>}
        </Button>
      </Card>
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}</div>}
    </div>
  );

  const ss = result.secondary_structure?.percentages || {};
  // 后端 deep 接口把理化性质拆在 basic_properties / physicochemical_profile 两处
  const bpProps = result.basic_properties || {};
  const pp = result.physicochemical_profile || {};
  const sa = result.safety_assessment || {};
  const bp = result.bioactivity_predictions || {};
  const os = result.overall_scores || {};

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Dna className="w-4 h-4 text-primary"/>基本性质</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            ['分子量 (Da)', bpProps.molecular_weight?.toFixed(2)],
            ['LogP', bpProps.logp?.toFixed(3)],
            ['GRAVY', bpProps.gravy?.toFixed(3)],
            ['不稳定指数', bpProps.instability_index?.toFixed(1)],
            ['代数指数', bpProps.aliphatic_index?.toFixed(1)],
            ['消光系数', pp.extinction_coefficient?.toFixed(0)],
            ['等电点', pp.isoelectric_point?.toFixed(2)],
            ['净电荷(pH7)', pp.net_charge_at_ph7?.toFixed(1)],
          ].map(([label, val]) => (
            <div key={label} className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
              <div className="text-[var(--text-muted)]">{label}</div>
              <div className="font-mono font-medium mt-0.5">{val ?? '-'}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-primary"/>二级结构预测 (Chou-Fasman)</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['α-螺旋 (%)', ss?.alpha_helix ?? 0, '#3b82f6'],
            ['β-折叠 (%)', ss?.beta_sheet ?? 0, 'var(--color-primary-500)'],
            ['无规卷曲 (%)', ss?.random_coil ?? 0, '#f59e0b'],
          ].map(([label, val, color]: any) => (
            <div key={label} className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
              <div className="text-2xl font-bold" style={{ color }}>{(val).toFixed(1)}%</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-2">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }}/>
              </div>
            </div>
          ))}
        </div>
        {ss?.predicted_sequence && (
          <div className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
            <div className="text-xs text-[var(--text-muted)] mb-1">结构序列 (H=螺旋 E=折叠 C=卷曲)</div>
            <div className="font-mono text-xs break-all">{ss.predicted_sequence}</div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary"/>生物活性预测</h3>
          <div className="space-y-2">
            {Object.entries(bp).map(([key, val]: any) => (
              <div key={key} className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)] capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-mono font-medium">{typeof val === 'object' ? `${(val.score * 100).toFixed(1)}%` : `${val}`}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary"/>安全性评估</h3>
          <div className="space-y-2 text-xs">
            {[
              ['综合得分', (os.composite ?? 0).toFixed(2)],
              ['稳定性得分', (os.stability ?? 0).toFixed(2)],
              ['安全得分', (os.safety ?? 0).toFixed(2)],
              ['类药性得分', (os.druglikeness ?? 0).toFixed(2)],
              ['风险等级', sa?.risk_level ?? 'N/A'],
              ['过敏风险', `${((sa?.allergenicity_risk ?? 0) * 100).toFixed(0)}%`],
              ['免疫原性风险', `${((sa?.immunogenicity_risk ?? 0) * 100).toFixed(0)}%`],
            ].map(([label, val]: any) => (
              <div key={label} className="flex justify-between">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className="font-mono font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Pareto 优化组件 ────────────────────────────────────────
function OptimizeView() {
  const [sequences, setSequences] = useState('');
  const [objectives, setObjectives] = useState('ACE_inhibitory,antioxidant');
  const [weightsStr, setWeightsStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleOptimize = useCallback(async () => {
    const seqs = sequences.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (seqs.length < 2) { setError('请输入至少2条候选序列'); return; }
    const objs = objectives.split(',').map(s => s.trim()).filter(Boolean);
    setLoading(true); setError(null); setResult(null);
    try {
      const weights: Record<string, number> = {};
      if (weightsStr.trim()) {
        weightsStr.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          if (k && v) weights[k.trim()] = parseFloat(v.trim());
        });
      }
      const res = await peptideStructureService.paretoOptimize(seqs, objs, weights);
      setResult(res.data);
    } catch (e: any) {
      setError(e.message || '优化失败');
    } finally {
      setLoading(false);
    }
  }, [sequences, objectives, weightsStr]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">候选序列（每行一条）</label>
          <textarea value={sequences} onChange={e => setSequences(e.target.value)} placeholder={"VLGYT\nRPYPIP\nLLPGTFVDNQKF"} className="w-full h-20 font-mono text-xs p-2 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">优化目标（逗号分隔）</label>
            <Input value={objectives} onChange={e => setObjectives(e.target.value)} placeholder="ACE_inhibitory,antioxidant" className="text-xs" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">权重（可选，格式 key:value）</label>
            <Input value={weightsStr} onChange={e => setWeightsStr(e.target.value)} placeholder="ACE_inhibitory:0.7,antioxidant:0.3" className="text-xs" />
          </div>
        </div>
        <Button onClick={handleOptimize} disabled={loading} className="w-full">
          {loading ? <><span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block mr-1"/>计算中...</> : <><Target className="w-4 h-4 mr-1"/>计算 Pareto 前沿</>}
        </Button>
      </Card>
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}</div>}
      {result && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/>Pareto 最优前沿</h3>
            <span className="text-xs text-[var(--text-muted)]">前沿点数: {result.pareto_frontier_size} / 处理: {result.total_processed}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-2 py-1.5 text-left">序列</th>
                <th className="px-2 py-1.5 text-right">等级</th>
                {objectives.split(',').map(o => <th key={o} className="px-2 py-1.5 text-right capitalize">{o.replace(/_/g, ' ')}</th>)}
              </tr></thead>
              <tbody>
                {(result.pareto_points || []).slice(0, 10).map((p: any, i: number) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 font-mono font-medium">{p.sequence}</td>
                    <td className="px-2 py-1.5 text-center"><Badge variant={i < 3 ? 'success' : 'neutral'} size="sm">{p.rank}</Badge></td>
                    {objectives.split(',').map((o: string) => (
                      <td key={o} className="px-2 py-1.5 text-right font-mono">{(p.objectives?.[o] ?? 0).toFixed(3)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.diversity_metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(result.diversity_metrics).map(([k, v]: any) => (
                <div key={k} className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                  <div className="text-[var(--text-muted)]">{k}</div>
                  <div className="font-mono font-medium">{typeof v === 'number' ? v.toFixed(4) : v}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 协同分析组件 ───────────────────────────────────────────
function SynergyView() {
  const [peptideSeq, setPeptideSeq] = useState('');
  const [herbInput, setHerbInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // 从后端动态获取药食同源药材列表
  const [herbs, setHerbs] = useState<string[]>([]);
  const [herbsLoading, setHerbsLoading] = useState(true);

  useEffect(() => {
    databaseApi.getFoodHomologyHerbs({ page: 1, page_size: 50 })
      .then(res => {
        const names = (res?.items ?? [])
          .map((h: any) => h.name_cn || h.name || '')
          .filter(Boolean)
          .slice(0, 20);
        setHerbs(names);
      })
      .catch(() => {
        // fallback to defaults if API fails
        setHerbs(['黄芪', '人参', '枸杞子', '山楂', '菊花', '葛根', '酸枣仁', '灵芝']);
      })
      .finally(() => setHerbsLoading(false));
  }, []);

  const handleSynergy = useCallback(async () => {
    if (!peptideSeq.trim()) { setError('请输入肽序列'); return; }
    const herbNames = herbInput ? herbInput.split(',').map(s => s.trim()).filter(Boolean) : herbs.slice(0, 4);
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await peptideStructureService.synergyAnalysis([peptideSeq.trim().toUpperCase()], herbNames);
      setResult(res.data);
    } catch (e: any) {
      setError(e.message || '协同分析失败');
    } finally {
      setLoading(false);
    }
  }, [peptideSeq, herbInput]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">肽序列</label>
          <Input value={peptideSeq} onChange={e => setPeptideSeq(e.target.value.toUpperCase())} placeholder="例如: VLGYT" className="font-mono" />
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)] block mb-1">药材（逗号分隔，留空使用默认）</label>
          <Input value={herbInput} onChange={e => setHerbInput(e.target.value)} placeholder="黄芪,人参,枸杞子" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {herbs.map(h => (
            <button key={h} onClick={() => setHerbInput(prev => prev.includes(h) ? prev.replace(h, '').replace(/,,?/, '') : (prev ? prev + ',' + h : h))}
              className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
              {h}
            </button>
          ))}
        </div>
        <Button onClick={handleSynergy} disabled={loading || !peptideSeq.trim()} className="w-full">
          {loading ? <><span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block mr-1"/>分析中...</> : <><Zap className="w-4 h-4 mr-1"/>协同效应分析</>}
        </Button>
      </Card>
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{error}</div>}
      {result && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-primary"/>协同效应结果</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-2 py-1.5 text-left">肽序列</th>
                <th className="px-2 py-1.5 text-left">药材</th>
                <th className="px-2 py-1.5 text-right">协同评分</th>
                <th className="px-2 py-1.5 text-left">机制</th>
              </tr></thead>
              <tbody>
                {(result.synergies || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 font-mono">{s.peptide}</td>
                    <td className="px-2 py-1.5">{s.herb}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{s.synergy_score?.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-[var(--text-muted)]">{s.mechanism || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.ranked_herbs && result.ranked_herbs.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">药材推荐排序</h4>
              <div className="space-y-1.5">
                {result.ranked_herbs.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                    <span className="font-medium">{i + 1}. {h.name}</span>
                    <span className="font-mono text-primary">{h.score?.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 主组件 ───
interface PeptideStructureAnalyzerProps {
  initialTab?: TabType;
}

export default function PeptideStructureAnalyzer({ initialTab = 'analyze' }: PeptideStructureAnalyzerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sequence, setSequence] = useState('');
  const [compareSequences, setCompareSequences] = useState<string[]>([]);
  const [compareInput, setCompareInput] = useState('');
  const [nTerminal, setNTerminal] = useState('');
  const [cTerminal, setCTerminal] = useState('');
  const [result, setResult] = useState<PeptideAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const urlTab = searchParams.get('tab') as TabType | null;
    if (urlTab && ['analyze', 'convert', 'database', 'compare', 'history', 'batch', 'deep', 'optimize', 'synergy'].includes(urlTab)) {
      return urlTab;
    }
    return initialTab;
  });
  const [initialized, setInitialized] = useState(false);

  // 3D分子数据状态
  const [molecule3D, setMolecule3D] = useState<Molecule3DData | null>(null);
  const [renderingMode, setRenderingMode] = useState<'ball-stick' | 'space-filling' | 'tube'>('ball-stick');
  const [loading3D, setLoading3D] = useState(false);
  const [molecule3DError, setMolecule3DError] = useState<string | null>(null);

  // 初始化
  useEffect(() => {
    peptideStructureService.init().then(() => setInitialized(true));
  }, []);

  // 同步 activeTab 到 URL search params
  useEffect(() => {
    if (searchParams.get('tab') !== activeTab) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', activeTab);
      setSearchParams(params, { replace: true });
    }
  }, [activeTab]);

  // 监听 URL 变化，更新 activeTab（处理外部导航场景）
  useEffect(() => {
    const urlTab = searchParams.get('tab') as TabType | null;
    if (urlTab && ['analyze', 'convert', 'database', 'compare', 'history', 'batch', 'deep', 'optimize', 'synergy'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // 获取分子3D坐标（供 handleAnalyze 使用）— 保留用户 pI 修复：仅回填分子量
  const fetchMolecule3D = useCallback(async (
    smiles: string,
    onMwUpdated?: (mw: number) => void,
  ) => {
    if (!smiles) return;
    setLoading3D(true);
    setMolecule3DError(null);
    try {
      const response = await fetch(`/api/v1/peptide-structure/smiles-to-3d?smiles=${encodeURIComponent(smiles)}`);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setMolecule3D(data);
        if (onMwUpdated && data.molecular_weight > 0) {
          onMwUpdated(data.molecular_weight);
        }
      } else {
        setMolecule3DError(data.detail || '3D结构生成失败');
      }
    } catch (e: any) {
      const msg = e?.message || '3D坐标获取失败';
      setMolecule3DError(msg);
      console.error('3D坐标获取失败:', e);
    } finally {
      setLoading3D(false);
    }
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
      if (res.smiles) fetchMolecule3D(res.smiles);
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
        // 优先使用后端返回的分子量（如有），否则后续从3D接口获取
        const mw = res.molecular_weight || 0;
        const tempResult: PeptideAnalysisResult = {
          sequence: res.sequence || sequence.toUpperCase(),
          smiles: res.smiles,
          selfies: res.selfies,
          molecular_weight: mw,
          isoelectric_point: 0,
          hydrophobicity: 0,
          ace_inhibition: { score: 0, level: 'none' },
          antioxidant: { score: 0, level: 'none' },
          antimicrobial: { score: 0, level: 'none' },
          safety: { food_score: 0, is_allergen: false, is_toxic: false, digestibility: 'N/A' },
          taste: { bitterness: 0, umami: 0 },
          source: { food: undefined, database: undefined, references: [] },
          analysis_time: new Date().toISOString(),
        };
        setResult(tempResult);
        // 获取3D坐标并计算等电点
        fetchMolecule3D(res.smiles, (mw3D: number) => {
          if (mw3D > 0) {
            setResult(prev => prev ? { ...prev, molecular_weight: mw3D } : prev);
          }
          // pI 通过完整分析接口计算
          peptideStructureService.analyzePeptide(sequence.toUpperCase(), {
            n_terminal: nTerminal || undefined,
            c_terminal: cTerminal || undefined,
          }).then(analyzeRes => {
            setResult(prev => prev ? {
              ...prev,
              isoelectric_point: analyzeRes.isoelectric_point || prev.isoelectric_point,
              molecular_weight: analyzeRes.molecular_weight || prev.molecular_weight,
              hydrophobicity: analyzeRes.hydrophobicity || prev.hydrophobicity,
            } : prev);
          }).catch(() => {});
        });
      }
    } catch (e: any) {
      setError(e.message || '转换失败');
    } finally {
      setLoading(false);
    }
  }, [sequence, nTerminal, cTerminal, fetchMolecule3D]);

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
    setMolecule3D(null);
    setMolecule3DError(null);
    setLoading3D(false);
  }, []);

  const quickSequences = ['AC', 'VLGYT', 'LLPGTFVDNQKF', 'RPYPIP'];

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'analyze', label: '完整分析', icon: Beaker },
    { key: 'deep', label: '高级分析', icon: Bot },
    { key: 'batch', label: '批量分析', icon: Layers },
    { key: 'optimize', label: 'Pareto优化', icon: Target },
    { key: 'synergy', label: '协同分析', icon: Zap },
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
                        分子结构可视化
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
                        {/* 渲染模式切换 */}
                        {molecule3D && (
                          <select
                            value={renderingMode}
                            onChange={(e) => setRenderingMode(e.target.value as any)}
                            className="text-xs bg-neutral-100 dark:bg-neutral-800 border-none rounded px-2 py-0.5 text-[var(--text-secondary)]"
                          >
                            <option value="ball-stick">球棍模型</option>
                            <option value="space-filling">空间填充</option>
                            <option value="tube">管线模型</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* 分子结构可视化区域 */}
                    {result && (
                      <>
                        {/* 2D化学结构图 */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--text-secondary,#374151)] dark:text-[var(--text-secondary-dark,#E5E7EB)] flex items-center gap-1.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M12 2 L12 22 M2 12 L22 12"/></svg>
                              2D 化学结构
                            </span>
                            <span className="text-xs text-[var(--text-muted,#9A9A9F)] font-mono">{result.smiles?.length || 0} chars</span>
                          </div>
                          <div className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center min-h-[200px]">
                            <img
                              src={`/api/v1/peptide-structure/smiles-to-image?smiles=${encodeURIComponent(result.smiles)}`}
                              alt="分子2D结构"
                              className="max-w-full max-h-[220px] object-contain rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden text-center text-[var(--text-muted,#9A9A9F)]">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-30"><circle cx="12" cy="12" r="10"/><path d="M12 2 L12 22 M2 12 L22 12"/></svg>
                              <p className="text-xs">结构图生成失败</p>
                            </div>
                          </div>
                        </div>

                        {/* 3D分子查看器 */}
                        {molecule3D ? (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-[var(--text-secondary,#374151)] dark:text-[var(--text-secondary-dark,#E5E7EB)] flex items-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                                3D 分子结构
                              </span>
                              <select
                                value={renderingMode}
                                onChange={(e) => setRenderingMode(e.target.value as any)}
                                className="text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 text-[var(--text-secondary)]"
                              >
                                <option value="ball-stick">球棍模型</option>
                                <option value="space-filling">空间填充</option>
                                <option value="tube">管线模型</option>
                              </select>
                            </div>
                            <MoleculeViewer3D
                              atoms={molecule3D.atoms}
                              bonds={molecule3D.bonds}
                              renderingMode={renderingMode}
                            />
                            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted,#9A9A9F)]">
                              <span className="flex items-center gap-1"><Dna className="w-3 h-3" />拖拽旋转</span>
                              <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" />滚轮缩放</span>
                              <span className="flex items-center gap-1"><Expand className="w-3 h-3" />右键平移</span>
                              <span className="ml-auto font-mono text-emerald-600 dark:text-emerald-400">{molecule3D.atom_count} atoms · {molecule3D.bond_count} bonds · MW {molecule3D.molecular_weight}</span>
                            </div>
                          </div>
                        ) : loading3D ? (
                          <div className="mb-3 p-8 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                            <div className="text-center text-[var(--text-muted,#9A9A9F)]">
                              <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                              <p className="text-xs">生成3D结构...</p>
                            </div>
                          </div>
                        ) : molecule3DError ? (
                          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                            ⚠ 3D结构生成失败：{molecule3DError}
                          </div>
                        ) : null}
                      </>
                    )}

                    {/* SMILES文本 */}
                    <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-xs text-[var(--text-muted,#9A9A9F)] mb-1">SMILES字符串</div>
                      <div className="font-mono text-xs break-all text-[var(--text-secondary,#6B7280)] dark:text-[var(--text-secondary-dark,#9CA3AF)] leading-relaxed">
                        {result.smiles}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted,#9A9A9F)]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>基于RDKit生成的三维分子结构 | 支持交互旋转和缩放</span>
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

      {/* 高级深度分析 */}
      {activeTab === 'deep' && <DeepAnalysisView />}

      {/* 批量分析 */}
      {activeTab === 'batch' && <BatchAnalysisView />}

      {/* Pareto 优化 */}
      {activeTab === 'optimize' && <OptimizeView />}

      {/* 协同分析 */}
      {activeTab === 'synergy' && <SynergyView />}

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








