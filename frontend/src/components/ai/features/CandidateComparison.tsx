import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar as RechartsRadar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Eye,
  GitCompare,
  Download,
  CheckCircle2,
  Star,
  Table2,
  Filter,
  Radar as LucideRadar,
} from 'lucide-react';

export interface CandidateScore {
  efficacy: number;
  safety: number;
  stability: number;
  cost: number;
  sensory: number;
  compliance: number;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit?: string;
  function?: string;
}

export interface FormulaCandidate {
  id: string;
  index: number;
  name: string;
  overallScore: number;
  scores: CandidateScore;
  ingredients: Ingredient[];
  costIndex: number;
  safetyScore: number;
}

interface CandidateComparisonProps {
  candidates: FormulaCandidate[];
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onExport?: (format: 'csv' | 'excel') => void;
  onApply?: (candidate: FormulaCandidate) => void;
  className?: string;
}

const RADAR_DIMENSIONS = [
  { key: 'efficacy', label: '功效' },
  { key: 'safety', label: '安全性' },
  { key: 'stability', label: '稳定性' },
  { key: 'cost', label: '成本效益' },
  { key: 'sensory', label: '感官品质' },
  { key: 'compliance', label: '合规性' },
];

const COLORS = ['var(--color-primary-500, #10b981)', 'var(--color-blue-500, #3b82f6)', 'var(--color-amber-500, #f59e0b)', 'var(--color-red-500, #ef4444)', 'var(--color-emerald-500, #10b981)', 'var(--color-danger-500, #ec4899)'];

type DisplayMode = 'absolute' | 'percentage' | 'rank';

export function CandidateComparison({
  candidates,
  selectedIds = [],
  onSelect,
  onExport,
  onApply,
  className = '',
}: CandidateComparisonProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'radar' | 'table' | 'pareto'>('cards');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('absolute');
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'cost' | 'safety'>('score');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'cost':
          comparison = a.costIndex - b.costIndex;
          break;
        case 'safety':
          comparison = a.safetyScore - b.safetyScore;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [candidates, sortBy, sortOrder]);

  const radarData = useMemo(() => {
    if (selectedIds.length === 0 && candidates.length > 0) {
      return candidates.slice(0, 3).map((c, i) => ({
        candidate: c.name,
        color: COLORS[i % COLORS.length],
        ...c.scores,
      }));
    }

    return candidates
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => ({
        candidate: c.name,
        color: COLORS[candidates.indexOf(c) % COLORS.length],
        ...c.scores,
      }));
  }, [candidates, selectedIds]);

  const paretoData = useMemo(() => {
    return candidates.map((c) => ({
      name: `方案${c.index + 1}`,
      costIndex: c.costIndex,
      efficacy: c.scores.efficacy,
      safety: c.safetyScore,
      score: c.overallScore,
      isSelected: selectedIds.includes(c.id),
    }));
  }, [candidates, selectedIds]);

  const paretoFrontier = useMemo(() => {
    const sorted = [...paretoData].sort((a, b) => a.costIndex - b.costIndex);
    const frontier: typeof paretoData = [];
    let maxEfficacy = 0;

    for (const point of sorted) {
      if (point.efficacy >= maxEfficacy) {
        frontier.push(point);
        maxEfficacy = point.efficacy;
      }
    }

    return frontier;
  }, [paretoData]);

  const ingredientComparison = useMemo(() => {
    if (selectedIds.length < 2) return [];

    const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
    if (selectedCandidates.length < 2) return [];

    const allIngredients = new Map<
      string,
      { candidateId: string; amount: number; isNew: boolean; isRemoved: boolean }[]
    >();

    selectedCandidates.forEach((candidate) => {
      const otherCandidates = selectedCandidates.filter((other) => other.id !== candidate.id);
      const otherIngredientNames = new Set(otherCandidates.flatMap((o) => o.ingredients.map((i) => i.name)));

      candidate.ingredients.forEach((ing) => {
        if (!allIngredients.has(ing.name)) {
          allIngredients.set(ing.name, []);
        }

        const entry = allIngredients.get(ing.name)!;
        entry.push({
          candidateId: candidate.id,
          amount: ing.amount,
          isNew: !otherIngredientNames.has(ing.name),
          isRemoved: false,
        });
      });

      otherCandidates.forEach((other) => {
        other.ingredients.forEach((ing) => {
          if (!candidate.ingredients.find((i) => i.name === ing.name)) {
            if (!allIngredients.has(ing.name)) {
              allIngredients.set(ing.name, []);
            }
            const entry = allIngredients.get(ing.name)!;
            if (!entry.find((e) => e.candidateId === candidate.id)) {
              entry.push({ candidateId: candidate.id, amount: 0, isNew: false, isRemoved: true });
            }
          }
        });
      });
    });

    return Array.from(allIngredients.entries()).map(([name, entries]) => ({
      name,
      entries: entries.map((entry) => ({
        ...entry,
        candidateName: selectedCandidates.find((c) => c.id === entry.candidateId)?.name || '',
      })),
    }));
  }, [candidates, selectedIds]);

  const handleExportCSV = useCallback(() => {
    if (!onExport || candidates.length === 0) return;

    const headers = ['方案名称', '总评分', '功效', '安全性', '稳定性', '成本效益', '感官品质', '合规性'];
    const rows = candidates.map((c) => [
      c.name,
      c.overallScore,
      c.scores.efficacy,
      c.scores.safety,
      c.scores.stability,
      c.scores.cost,
      c.scores.sensory,
      c.scores.compliance,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `配方对比_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    onExport?.('csv');
  }, [candidates, onExport]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 视图切换和工具栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 gap-1">
          {[
            { mode: 'cards' as const, icon: <Star className="w-4 h-4" />, label: '卡片' },
            { mode: 'radar' as const, icon: <LucideRadar className="w-4 h-4" />, label: '雷达图' },
            { mode: 'table' as const, icon: <Table2 className="w-4 h-4" />, label: '成分对比' },
            { mode: 'pareto' as const, icon: <GitCompare className="w-4 h-4" />, label: 'Pareto' },
          ].map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* 排序控制 */}
          <div className="flex items-center gap-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setSortBy('score')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === 'score' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-700' : 'text-neutral-500'
              }`}
            >
              评分 {sortBy === 'score' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => setSortBy('cost')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === 'cost' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-700' : 'text-neutral-500'
              }`}
            >
              成本 {sortBy === 'cost' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          {/* 显示模式切换（雷达图时显示） */}
          {viewMode === 'radar' && (
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
              className="px-2 py-1.5 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
            >
              <option value="absolute">绝对值</option>
              <option value="percentage">百分比</option>
              <option value="rank">排名</option>
            </select>
          )}

          {/* 导出按钮 */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <AnimatePresence mode="wait">
        {viewMode === 'cards' && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {sortedCandidates.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02, boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}
                onMouseEnter={() => setHoveredCandidateId(candidate.id)}
                onMouseLeave={() => setHoveredCandidateId(null)}
                onClick={() => onSelect?.(candidate.id)}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedIds.includes(candidate.id)
                    ? 'border-success-500 bg-primary-50/50 dark:bg-primary-300/15 shadow-lg'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                {/* 方案编号与评分 */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      方案 #{candidate.index + 1}
                    </span>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-1 line-clamp-1">
                      {candidate.name}
                    </h3>
                  </div>
                  <motion.div
                    animate={{
                      scale: hoveredCandidateId === candidate.id ? 1.1 : 1,
                      rotate: hoveredCandidateId === candidate.id ? 5 : 0,
                    }}
                    className={`text-3xl font-bold ${
                      candidate.overallScore >= 85
                        ? 'text-primary-500'
                        : candidate.overallScore >= 70
                          ? 'text-secondary-500'
                          : candidate.overallScore >= 55
                            ? 'text-warning-500'
                            : 'text-error-500'
                    }`}
                  >
                    {Math.round(candidate.overallScore)}
                  </motion.div>
                </div>

                {/* 雷达图（迷你版） */}
                <div className="h-40 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsRadarChart data={[{ ...candidate.scores }]}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="efficacy" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <RechartsRadar
                        name={candidate.name}
                        dataKey="efficacy"
                        stroke="var(--color-primary-400)"
                        fill="var(--color-primary-400)"
                        fillOpacity={0.3}
                      />
                    </RechartsRadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Top 5 成分 */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">主要成分</h4>
                  {candidate.ingredients.slice(0, 5).map((ing, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-neutral-700 dark:text-neutral-300 truncate flex-1">{ing.name}</span>
                      <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-2">
                        {ing.amount}
                        {ing.unit || '%'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-secondary-600 bg-secondary-50 dark:bg-secondary-300/20 hover:bg-secondary-100 dark:hover:bg-secondary-900/30 rounded-lg transition-colors">
                    <Eye className="w-3 h-3" />
                    详情
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-accent-600 bg-accent-50 dark:bg-accent-300/20 hover:bg-accent-100 dark:hover:bg-accent-900/30 rounded-lg transition-colors">
                    <GitCompare className="w-3 h-3" />
                    对比
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onApply?.(candidate);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 dark:bg-primary-300/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    应用
                  </button>
                </div>

                {/* 选中指示器 */}
                {selectedIds.includes(candidate.id) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {viewMode === 'radar' && (
          <motion.div
            key="radar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800"
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">评分雷达图叠加对比</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsRadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="candidate" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  {RADAR_DIMENSIONS.map((dim) => (
                    <RechartsRadar
                      key={dim.key}
                      name={dim.label}
                      dataKey={dim.key}
                      stroke="var(--color-primary-400)"
                      fill="var(--color-primary-400)"
                      fillOpacity={0.15}
                    />
                  ))}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </RechartsRadarChart>
              </ResponsiveContainer>
            </div>

            {/* 图例 */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {radarData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.candidate}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {viewMode === 'table' && (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-x-auto"
          >
            <div className="min-w-full p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">成分差异高亮表格</h3>

              {selectedIds.length < 2 ? (
                <div className="text-center py-8 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>请选择至少 2 个方案进行成分对比</p>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="py-3 px-4 text-left font-semibold text-neutral-700 dark:text-neutral-300">成分名称</th>
                      {candidates
                        .filter((c) => selectedIds.includes(c.id))
                        .map((c) => (
                          <th
                            key={c.id}
                            className="py-3 px-4 text-right font-semibold text-neutral-700 dark:text-neutral-300"
                          >
                            {c.name}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientComparison.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="py-2 px-4 font-medium text-neutral-900 dark:text-white">{row.name}</td>
                        {row.entries.map((entry, entryIdx) => {
                          const baseAmount = row.entries.find((e) => e.amount > 0)?.amount || 1;
                          const diffPercent = ((entry.amount - baseAmount) / baseAmount) * 100;

                          let cellClass = '';
                          let content = '-';

                          if (entry.isNew) {
                            cellClass = 'bg-success-100 dark:bg-success-300/25 text-success-700 dark:text-success-600';
                            content = `${entry.amount}${'%'}`;
                          } else if (entry.isRemoved) {
                            cellClass = 'bg-error-100 dark:bg-error-300/25 text-error-700 dark:text-error-600 line-through';
                            content = `${entry.amount}${'%'}`;
                          } else if (diffPercent > 5) {
                            cellClass = 'bg-secondary-100 dark:bg-secondary-300/25 text-secondary-700 dark:text-secondary-700';
                            content = `${entry.amount}% ↑+${diffPercent.toFixed(1)}%`;
                          } else if (diffPercent < -5) {
                            cellClass = 'bg-error-100 dark:bg-error-300/25 text-error-700 dark:text-error-600';
                            content = `${entry.amount}% ↓${diffPercent.toFixed(1)}%`;
                          } else {
                            content = `${entry.amount}%`;
                          }

                          return (
                            <td key={entryIdx} className={`py-2 px-4 text-right ${cellClass}`}>
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}

        {viewMode === 'pareto' && (
          <motion.div
            key="pareto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800"
          >
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Pareto 最优前沿分析</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis
                    type="number"
                    dataKey="costIndex"
                    name="成本指数"
                    domain={['dataMin - 5', 'dataMax + 5']}
                    label={{ value: '成本指数', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="efficacy"
                    name="功效得分"
                    domain={['dataMin - 5', 'dataMax + 5']}
                    label={{ value: '功效综合得分', angle: -90, position: 'insideLeft' }}
                  />
                  <ZAxis type="number" dataKey="safety" range={[50, 400]} name="安全性" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 text-sm">
                            <p className="font-bold text-neutral-900 dark:text-white">{data.name}</p>
                            <p className="text-neutral-600 dark:text-neutral-400">成本指数: {data.costIndex}</p>
                            <p className="text-neutral-600 dark:text-neutral-400">功效得分: {data.efficacy}</p>
                            <p className="text-neutral-600 dark:text-neutral-400">安全性: {data.safety}</p>
                            <p className="text-neutral-600 dark:text-neutral-400">综合评分: {data.score}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {/* Pareto 前沿线 */}
                  <ReferenceLine
                    segment={[
                      { x: paretoFrontier[0]?.costIndex, y: paretoFrontier[0]?.efficacy },
                      {
                        x: paretoFrontier[paretoFrontier.length - 1]?.costIndex,
                        y: paretoFrontier[paretoFrontier.length - 1]?.efficacy,
                      },
                    ]}
                    stroke="#EA580C"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />

                  <Scatter name="方案" data={paretoData}>
                    {paretoData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isSelected ? 'var(--color-primary-400)' : 'var(--color-secondary-500)'}
                        fillOpacity={entry.isSelected ? 1 : 0.6}
                        stroke={entry.isSelected ? 'var(--color-primary-500)' : 'var(--color-secondary-500)'}
                        strokeWidth={entry.isSelected ? 2 : 1}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* 图例说明 */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-secondary-500/60" />
                <span>普通方案</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary-500" />
                <span>已选中方案</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-warning-500" style={{ borderTop: '2px dashed var(--color-warning, #FF9F0A)' }} />
                <span>Pareto 最优边界</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CandidateComparison;
