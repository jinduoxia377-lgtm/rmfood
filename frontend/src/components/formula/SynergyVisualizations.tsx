/**
 * 协同效应可视化模块 - 热力图 + 雷达图 + Pareto散点图
 *
 * 功能:
 * - 成分相互作用热力图 (SynergyHeatmap)
 * - 5种协同机制贡献饼图 (MechanismPieChart)
 * - Pareto最优前沿散点图 (ParetoScatterChart)
 * - 实时交互与数据筛选
 */

import React, { useState, useMemo } from 'react';
import {
  Thermometer,
  PieChart as PieIcon,
  ScatterChart,
  Download,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';

// ==================== 类型定义 ====================

interface SynergyPair {
  ingredient_a: string;
  ingredient_b: string;
  overall_si: number;
  mechanisms: {
    bliss_independence: number;
    pk_interaction: number;
    gibbs_stability: number;
    network_pharmacology: number;
    taste_matrix: number;
  };
  dominant_mechanism: string;
}

interface HeatmapCell {
  value: number;
  intensity: 'high' | 'medium' | 'low' | 'negative';
  pair: [string, string];
}

interface ParetoPoint {
  id: string;
  efficacy: number;
  safety: number;
  stability: number;
  cost: number;
  ratios: Record<string, number>;
  rank: number;
}

// ==================== 组件1: 协同热力图 ====================

interface SynergyHeatmapProps {
  data: SynergyPair[];
  onCellClick?: (pair: SynergyPair) => void;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SynergyHeatmap({ data, onCellClick, showLabels = true, size = 'md' }: SynergyHeatmapProps) {
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  // 提取唯一成分列表
  const ingredients = useMemo(() => {
    const names = new Set<string>();
    data.forEach((pair) => {
      names.add(pair.ingredient_a);
      names.add(pair.ingredient_b);
    });
    return Array.from(names).sort();
  }, [data]);

  // 构建热力图矩阵
  const heatmapMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, HeatmapCell>> = {};

    ingredients.forEach((ing) => {
      matrix[ing] = {};
    });

    // 填充矩阵数据
    data.forEach((pair) => {
      const si = pair.overall_si;
      let intensity: HeatmapCell['intensity'];

      if (si >= 0.7) intensity = 'high';
      else if (si >= 0.4) intensity = 'medium';
      else if (si >= 0.1) intensity = 'low';
      else intensity = 'negative';

      matrix[pair.ingredient_a][pair.ingredient_b] = {
        value: si,
        intensity,
        pair: [pair.ingredient_a, pair.ingredient_b],
      };

      // 对称填充
      matrix[pair.ingredient_b][pair.ingredient_a] = {
        value: si,
        intensity,
        pair: [pair.ingredient_b, pair.ingredient_a],
      };
    });

    return matrix;
  }, [data, ingredients]);

  // 颜色映射函数
  const getCellColor = (cell: HeatmapCell | undefined) => {
    if (!cell) return 'bg-neutral-100 dark:bg-neutral-800';

    switch (cell.intensity) {
      case 'high':
        return 'bg-gradient-to-br from-success-400 to-success-500 text-white';
      case 'medium':
        return 'bg-gradient-to-br from-secondary-300 to-secondary-400 text-white';
      case 'low':
        return 'bg-gradient-to-br from-warning-200 to-warning-300 text-neutral-800';
      case 'negative':
        return 'bg-gradient-to-br from-error-200 to-error-300 text-neutral-800';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800';
    }
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  };

  return (
    <Card className="p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-warning-500" />
          成分协同效应热力图
        </h3>

        <div className="flex items-center gap-2">
          {/* 图例 */}
          <div className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded bg-success-500" />
            <span>强协同</span>
            <span className="w-3 h-3 rounded bg-secondary-400 ml-2" />
            <span>中等</span>
            <span className="w-3 h-3 rounded bg-warning-300 ml-2" />
            <span>弱协同</span>
            <span className="w-3 h-3 rounded bg-error-300 ml-2" />
            <span>拮抗</span>
          </div>

          <Button variant="ghost" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 热力图网格 */}
      <div className="overflow-auto">
        <div className="inline-block min-w-full">
          {/* 表头 */}
          <div className="flex">
            <div className={`sizeClasses[size]} flex-shrink-0`} /> {/* 左上角空单元格 */}
            {ingredients.map((name) => (
              <div
                key={name}
                className={`${sizeClasses[size]} flex-shrink-0 flex items-center justify-center 
                          font-medium text-xs text-neutral-700 dark:text-neutral-300 rotate-45 origin-center`}
                style={{ transformOrigin: 'center' }}
              >
                {showLabels ? name.slice(0, 4) : ''}
              </div>
            ))}
          </div>

          {/* 数据行 */}
          {ingredients.map((rowName, rowIdx) => (
            <div key={rowName} className="flex">
              {/* 行标签 */}
              <div
                className={`${sizeClasses[size]} flex-shrink-0 flex items-center justify-end pr-2 
                            font-medium text-xs text-neutral-700 dark:text-neutral-300`}
              >
                {showLabels ? rowName.slice(0, 6) : ''}
              </div>

              {/* 数据单元格 */}
              {ingredients.map((colName, colIdx) => {
                if (rowIdx === colIdx) {
                  // 对角线：自身
                  return (
                    <div
                      key={colName}
                      className={`${sizeClasses[size]} flex-shrink-0 flex items-center justify-center 
                                bg-neutral-200 dark:bg-neutral-700 rounded font-bold text-neutral-400`}
                    >
                      -
                    </div>
                  );
                }

                const cell = heatmapMatrix[rowName]?.[colName];
                const isSelected = selectedCell?.pair[0] === rowName && selectedCell?.pair[1] === colName;

                return (
                  <button
                    key={colName}
                    onClick={() => {
                      setSelectedCell(cell);
                      if (cell && onCellClick) {
                        const pairData = data.find(
                          (p) =>
                            (p.ingredient_a === cell.pair[0] && p.ingredient_b === cell.pair[1]) ||
                            (p.ingredient_a === cell.pair[1] && p.ingredient_b === cell.pair[0]),
                        );
                        if (pairData) onCellClick(pairData);
                      }
                    }}
                    className={`${sizeClasses[size]} flex-shrink-0 rounded transition-all 
                              ${getCellColor(cell)} 
                              ${isSelected ? 'ring-2 ring-primary-500 ring-offset-2 scale-110 shadow-lg' : ''}
                              hover:scale-105 hover:shadow-md cursor-pointer`}
                  >
                    <span className="font-mono font-bold">{cell ? (cell.value * 100).toFixed(0) : '-'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 选中详情 */}
      {selectedCell && (
        <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-950 rounded-lg border border-primary-200">
          <h4 className="font-semibold text-sm text-primary-900 dark:text-primary-100 mb-2">
            📊 {selectedCell.pair[0]} ↔ {selectedCell.pair[1]}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-neutral-600">综合协同指数:</span>
              <span className="ml-2 font-mono font-bold text-primary-700">
                {(selectedCell.value * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-neutral-600">强度等级:</span>
              <Badge
                className="ml-2"
                variant={
                  selectedCell.intensity === 'high'
                    ? 'success'
                    : selectedCell.intensity === 'medium'
                      ? 'info'
                      : selectedCell.intensity === 'low'
                        ? 'warning'
                        : 'danger'
                }
              >
                {selectedCell.intensity === 'high'
                  ? '强协同'
                  : selectedCell.intensity === 'medium'
                    ? '中等'
                    : selectedCell.intensity === 'low'
                      ? '弱协同'
                      : '拮抗'}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ==================== 组件2: 协同机制饼图 ====================

interface MechanismPieChartProps {
  mechanisms: {
    bliss_independence: number;
    pk_interaction: number;
    gibbs_stability: number;
    network_pharmacology: number;
    taste_matrix: number;
  };
  dominant?: string;
}

export function MechanismPieChart({ mechanisms, dominant }: MechanismPieChartProps) {
  const mechanismLabels = {
    bliss_independence: '药效增强协同',
    pk_interaction: '药代动力学协同',
    gibbs_stability: '结构稳定性协同',
    network_pharmacology: '靶点通路协同',
    taste_matrix: '感官品质协同',
  };

  const mechanismColors = {
    bliss_independence: 'var(--color-primary, var(--color-primary-400))', // green
    pk_interaction: 'var(--color-secondary, #0A84FF)', // blue
    gibbs_stability: 'var(--color-tertiary, var(--color-accent-500))', // purple
    network_pharmacology: 'var(--color-warning, #FF9F0A)', // orange
    taste_matrix: 'var(--color-danger-500, #D946EF)', // pink
  };

  const total = Object.values(mechanisms).reduce((sum, val) => sum + val, 0);

  // 计算百分比和角度
  const segments = useMemo(() => {
    let currentAngle = 0;
    return Object.entries(mechanisms)
      .map(([key, value]) => {
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const angle = (value / total) * 360;

        const segment = {
          key,
          label: mechanismLabels[key as keyof typeof mechanismLabels],
          value,
          percentage,
          angle,
          startAngle: currentAngle,
          endAngle: currentAngle + angle,
          color: mechanismColors[key as keyof typeof mechanismColors],
          isDominant: key === dominant,
        };

        currentAngle += angle;
        return segment;
      })
      .sort((a, b) => b.value - a.value);
  }, [mechanisms, total, dominant]);

  // SVG 路径生成
  const createArcPath = (startAngle: number, endAngle: number, radius = 80) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
        <PieIcon className="w-5 h-5 text-danger-500" />
        协同机制贡献分布
      </h3>

      <div className="flex items-center justify-center">
        {/* SVG 饼图 */}
        <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
          {segments.map((seg, idx) => (
            <g key={seg.key}>
              <path
                d={createArcPath(seg.startAngle, seg.endAngle)}
                fill={seg.color}
                opacity={seg.isDominant ? 1 : 0.85}
                stroke="#fff"
                strokeWidth="2"
                className="cursor-pointer hover:opacity-100 transition-opacity"
                style={{
                  transform: seg.isDominant ? 'scale(1.05)' : 'scale(1)',
                  transformOrigin: 'center',
                  transition: 'all 0.3s ease',
                }}
              />

              {/* 百分比标签（仅显示 >5% 的） */}
              {seg.percentage > 5 &&
                (() => {
                  const midAngle = (seg.startAngle + seg.endAngle) / 2;
                  const midRad = ((midAngle - 90) * Math.PI) / 180;
                  const labelRadius = 60;
                  const x = 100 + labelRadius * Math.cos(midRad);
                  const y = 100 + labelRadius * Math.sin(midRad);

                  return (
                    <text
                      key={`label-${idx}`}
                      x={x}
                      y={y}
                      fill="#fff"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(90, ${x}, ${y})`}
                    >
                      {seg.percentage.toFixed(0)}%
                    </text>
                  );
                })()}
            </g>
          ))}

          {/* 中心圆（甜甜圈效果） */}
          <circle cx="100" cy="100" r="40" fill="white" className="dark:fill-neutral-900" />

          {/* 中心文字 */}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#374151"
            className="dark:fill-neutral-100"
          >
            SI
          </text>
          <text x="100" y="112" textAnchor="middle" fontSize="12" fill="#6B7280">
            {(total * 100).toFixed(2)}
          </text>
        </svg>
      </div>

      {/* 图例 */}
      <div className="mt-4 space-y-2">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`flex items-center justify-between p-2 rounded ${
              seg.isDominant ? 'bg-primary-50 dark:bg-primary-950 ring-1 ring-primary-200' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{seg.label}</span>
              {seg.isDominant && (
                <Badge variant="info" className="text-xs">
                  主导
                </Badge>
              )}
            </div>
            <span className="font-mono font-semibold text-sm text-neutral-900 dark:text-white">
              {(seg.value * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ==================== 组件3: Pareto 最优前沿散点图 ====================

interface ParetoScatterChartProps {
  points: ParetoPoint[];
  selectedPoint?: string | null;
  onPointClick?: (point: ParetoPoint) => void;
  xAxis?: 'efficacy' | 'safety' | 'stability' | 'cost';
  yAxis?: 'efficacy' | 'safety' | 'stability' | 'cost';
}

export function ParetoScatterChart({
  points,
  selectedPoint,
  onPointClick,
  xAxis: defaultXAxis = 'efficacy',
  yAxis: defaultYAxis = 'safety',
}: ParetoScatterChartProps) {
  const [xAxis, setXAxis] = useState<'efficacy' | 'safety' | 'stability' | 'cost'>(defaultXAxis);
  const [yAxis, setYAxis] = useState<'efficacy' | 'safety' | 'stability' | 'cost'>(defaultYAxis);
  const [hoveredPoint, setHoveredPoint] = useState<ParetoPoint | null>(null);

  const axisLabels = {
    efficacy: '功效得分',
    safety: '安全性',
    stability: '稳定性',
    cost: '成本效益',
  };

  // 计算坐标范围
  const xValues = points.map((p) => p[xAxis]);
  const yValues = points.map((p) => p[yAxis]);
  const xMin = Math.min(...xValues) * 0.9;
  const xMax = Math.max(...xValues) * 1.1;
  const yMin = Math.min(...yValues) * 0.9;
  const yMax = Math.max(...yValues) * 1.1;

  // 坐标转换函数
  const toSvgX = (val: number) => ((val - xMin) / (xMax - xMin)) * 380 + 40;
  const toSvgY = (val: number) => 280 - ((val - yMin) / (yMax - yMin)) * 240 + 20;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <ScatterChart className="w-5 h-5 text-accent-500" />
          Pareto 最优前沿
        </h3>

        <div className="flex items-center gap-2">
          {/* X轴选择 */}
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value as typeof xAxis)}
            className="text-xs px-2 py-1 border rounded bg-white dark:bg-neutral-800"
          >
            {Object.entries(axisLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">vs</span>
          {/* Y轴选择 */}
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value as typeof yAxis)}
            className="text-xs px-2 py-1 border rounded bg-white dark:bg-neutral-800"
          >
            {Object.entries(axisLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SVG 散点图 */}
      <svg width="460" height="320" className="overflow-visible">
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={toSvgX(xMin + (xMax - xMin) * tick)}
              y1={20}
              x2={toSvgX(xMin + (xMax - xMin) * tick)}
              y2={280}
              stroke="#E5E7EB"
              strokeDasharray="4,4"
              className="dark:stroke-neutral-700"
            />
            <line
              x1={40}
              y1={toSvgY(yMin + (yMax - yMin) * tick)}
              x2={420}
              y2={toSvgY(yMin + (yMax - yMin) * tick)}
              stroke="#E5E7EB"
              strokeDasharray="4,4"
              className="dark:stroke-neutral-700"
            />
          </g>
        ))}

        {/* 坐标轴标签 */}
        <text x={230} y="310" textAnchor="middle" fontSize="12" fill="#6B7280">
          {axisLabels[xAxis]}
        </text>
        <text x="15" y="150" textAnchor="middle" fontSize="12" fill="#6B7280" transform="rotate(-90, 15, 150)">
          {axisLabels[yAxis]}
        </text>

        {/* 数据点 */}
        {points.map((point) => {
          const cx = toSvgX(point[xAxis]);
          const cy = toSvgY(point[yAxis]);
          const isSelected = point.id === selectedPoint;
          const isHovered = hoveredPoint?.id === point.id;
          const radius = isSelected || isHovered ? 8 : 6;

          return (
            <g key={point.id}>
              {/* 光晕效果 */}
              {(isSelected || isHovered) && (
                <circle cx={cx} cy={cy} r={radius + 6} fill="#6366F1" opacity="0.2" className="animate-pulse" />
              )}

              {/* 数据点 */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={isSelected ? 'var(--color-tertiary, var(--color-accent-500))' : isHovered ? 'var(--color-tertiary-hover, #818CF8)' : 'var(--color-tertiary-400, #A5B4FC)'}
                stroke="#fff"
                strokeWidth="2"
                className="cursor-pointer hover:r-8 transition-all"
                onClick={() => onPointClick?.(point)}
                onMouseEnter={() => setHoveredPoint(point)}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* 排名标签 */}
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#fff"
                pointerEvents="none"
              >
                #{point.rank}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 悬停详情卡片 */}
      {hoveredPoint && (
        <div className="absolute mt-2 p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 z-10 text-sm">
          <div className="font-semibold text-neutral-900 dark:text-white mb-2">方案 #{hoveredPoint.rank}</div>
          <div className="space-y-1 text-neutral-600 dark:text-neutral-400">
            <div className="flex justify-between">
              <span>功效:</span>
              <span className="font-mono">{(hoveredPoint.efficacy * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>安全:</span>
              <span className="font-mono">{(hoveredPoint.safety * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>稳定:</span>
              <span className="font-mono">{(hoveredPoint.stability * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>成本:</span>
              <span className="font-mono">{(hoveredPoint.cost * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 图例说明 */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent-500" />
          <span>Pareto 最优解 ({points.length}个)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-accent-300 ring-2 ring-accent-500" />
          <span>当前选择</span>
        </div>
      </div>
    </Card>
  );
}

// 导出所有组件
export default SynergyHeatmap;
