/**
 * SensitivityTornado - 敏感性分析 Tornado 图组件 (v1.0)
 *
 * 展示单因素敏感性排序、两因素交互效应、最优条件推荐区域等。
 * 用于稳定性预测的参数敏感性分析可视化。
 *
 * 功能特性：
 * - Tornado 图排序正确（按敏感性从高到低）
 * - 散点矩阵两因素交互效应可视化
 * - 最优条件推荐区域高亮（绿色半透明矩形）
 * - 悬停显示详细数据 tooltip
 * - 支持动态数据更新和动画过渡
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceArea,
  Cell,
} from 'recharts';
import { Info, ArrowUpDown } from 'lucide-react';
import { Badge, Tooltip as UITooltip } from '@/components/ui';

// ===== 类型定义 =====

export interface SensitivityFactor {
  id: string;
  name: string;
  lowValue: number;
  baseValue: number;
  highValue: number;
  sensitivity: number; // 影响程度 (-1 到 1)
  unit?: string;
  description?: string;
}

export interface InteractionEffect {
  factorX: string;
  factorY: string;
  effectSize: number;
  significance: 'high' | 'medium' | 'low';
  optimalRange?: {
    x: [number, number];
    y: [number, number];
  };
}

interface SensitivityTornadoProps {
  factors: SensitivityFactor[];
  interactions?: InteractionEffect[];
  optimalRegion?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  showInteractions?: boolean;
  onFactorClick?: (factor: SensitivityFactor) => void;
  className?: string;
}

// ===== 颜色配置 =====

const SENSITIVITY_COLORS = {
  positive: 'var(--color-primary, var(--color-primary-400))',
  negative: 'var(--color-error, #FF3B30)',
  neutral: 'var(--color-slate-500, #6B7280)',
  highlight: 'var(--color-secondary, #0A84FF)',
};

// ===== 主组件实现 =====

function SensitivityTornado({
  factors,
  interactions = [],
  optimalRegion,
  showInteractions = true,
  onFactorClick,
  className = '',
}: SensitivityTornadoProps) {
  /**
   * 排序后的因子数据（按敏感性绝对值降序）
   */
  const sortedFactors = useMemo(
    () => [...factors].sort((a, b) => Math.abs(b.sensitivity) - Math.abs(a.sensitivity)),
    [factors],
  );

  /**
   * Tornado 图数据转换
   */
  const tornadoData = useMemo(
    () =>
      sortedFactors.map((factor) => ({
        name: factor.name,
        positive: Math.max(0, factor.sensitivity),
        negative: Math.min(0, factor.sensitivity),
        base: factor.baseValue,
        range: factor.highValue - factor.lowValue,
        fullId: factor.id,
      })),
    [sortedFactors],
  );

  /**
   * 散点矩阵数据
   */
  const scatterData = useMemo(
    () =>
      interactions.map((interaction) => ({
        x: interaction.factorX,
        y: interaction.factorY,
        z: interaction.effectSize,
        size: Math.abs(interaction.effectSize) * 100,
        significance: interaction.significance,
      })),
    [interactions],
  );

  /**
   * 自定义 Tornado 图 Tooltip
   */
  const TornadoTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;

      const data = payload[0].payload;
      const factor = factors.find((f) => f.id === data.fullId);

      return (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-3 min-w-[220px]">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{factor?.name || data.name}</p>
          {factor && (
            <>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">敏感性:</span>
                  <span
                    className={`font-medium ${
                      factor.sensitivity > 0
                        ? 'text-success-600'
                        : factor.sensitivity < 0
                          ? 'text-error-600'
                          : 'text-neutral-600'
                    }`}
                  >
                    {(factor.sensitivity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">基准值:</span>
                  <span className="font-medium">
                    {factor.baseValue}
                    {factor.unit || ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">变化范围:</span>
                  <span className="font-medium">
                    [{factor.lowValue}, {factor.highValue}]{factor.unit || ''}
                  </span>
                </div>
              </div>
              {factor.description && (
                <p className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-[11px] text-neutral-500">
                  {factor.description}
                </p>
              )}
            </>
          )}
        </div>
      );
    },
    [factors],
  );

  /**
   * 自定义散点图 Tooltip
   */
  const ScatterTooltipContent = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;

      const data = payload[0].payload;
      const interaction = interactions.find((i) => i.factorX === data.x && i.factorY === data.y);

      return (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 p-3">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            交互效应: {data.x} × {data.y}
          </p>
          {interaction && (
            <>
              <div className="text-xs space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">效应大小:</span>
                  <span className="font-medium">{(interaction.effectSize * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">显著性:</span>
                  <Badge
                    variant={
                      interaction.significance === 'high'
                        ? 'danger'
                        : interaction.significance === 'medium'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {interaction.significance === 'high' ? '高' : interaction.significance === 'medium' ? '中' : '低'}
                  </Badge>
                </div>
              </div>
            </>
          )}
        </div>
      );
    },
    [interactions],
  );

  return (
    <div
      className={`bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm p-6 space-y-6 ${className}`}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-primary-500" />
            因素敏感性分析
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            按敏感性从高到低排列，展示各因素对稳定性的影响程度
          </p>
        </div>

        <UITooltip content="Tornado 图用于比较多个因素的相对影响，柱子越长表示该因素对结果的影响越大">
          <Info className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] cursor-help" />
        </UITooltip>
      </div>

      {/* Tornado 图 */}
      <div style={{ height: Math.max(300, sortedFactors.length * 40 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tornadoData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200, #E5E7EB)" opacity={0.5} horizontal={false} />
            <XAxis
              type="number"
              domain={['dataMin - 0.05', 'dataMax + 0.05']}
              tick={{ fontSize: 11, fill: 'var(--color-slate-500, #6B7280)' }}
              tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-gray-700, #374151)' }} width={80} />
            <Tooltip content={<TornadoTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />

            {/* 正向影响 */}
            <Bar
              dataKey="positive"
              stackId="stack"
              fill={SENSITIVITY_COLORS.positive}
              radius={[0, 4, 4, 0]}
              onClick={(data: any) => {
                const factor = factors.find((f) => f.id === data.fullId);
                onFactorClick?.(factor!);
              }}
              style={{ cursor: 'pointer' }}
            >
              {tornadoData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.positive > 0.3 ? SENSITIVITY_COLORS.highlight : SENSITIVITY_COLORS.positive}
                  opacity={0.8}
                />
              ))}
            </Bar>

            {/* 负向影响 */}
            <Bar
              dataKey="negative"
              stackId="stack"
              fill={SENSITIVITY_COLORS.negative}
              radius={[4, 0, 0, 4]}
              onClick={(data: any) => {
                const factor = factors.find((f) => f.id === data.fullId);
                onFactorClick?.(factor!);
              }}
              style={{ cursor: 'pointer' }}
            >
              {tornadoData.map((entry, index) => (
                <Cell
                  key={`cell-negative-${index}`}
                  fill={entry.negative < -0.3 ? SENSITIVITY_COLORS.highlight : SENSITIVITY_COLORS.negative}
                  opacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 两因素交互效应散点图 */}
      {showInteractions && scatterData.length > 0 && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">两因素交互效应矩阵</h4>

          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="category"
                  dataKey="x"
                  name="因素 X"
                  tick={{ fontSize: 11, fill: 'var(--color-slate-500, #6B7280)' }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis type="category" dataKey="y" name="因素 Y" tick={{ fontSize: 11, fill: 'var(--color-slate-500, #6B7280)' }} width={60} />
                <ZAxis type="number" dataKey="z" range={[50, 400]} name="效应大小" />
                <Tooltip content={<ScatterTooltipContent />} cursor={{ strokeDasharray: '3 3' }} />

                {/* 最优条件区域高亮 */}
                {optimalRegion && (
                  <ReferenceArea
                    x1={optimalRegion.xMin}
                    x2={optimalRegion.xMax}
                    y1={optimalRegion.yMin}
                    y2={optimalRegion.yMax}
                    fill="var(--color-primary, var(--color-primary-400))"
                    fillOpacity={0.15}
                    stroke="var(--color-primary, var(--color-primary-400))"
                    strokeDasharray="5 5"
                  />
                )}

                <Scatter
                  data={scatterData}
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const colors =
                      payload.significance === 'high'
                        ? 'var(--color-error, #FF3B30)'
                        : payload.significance === 'medium'
                          ? 'var(--color-warning, #FF9F0A)'
                          : 'var(--color-slate-500, #6B7280)';

                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={Math.sqrt(payload.size) / 3}
                        fill={colors}
                        fillOpacity={0.7}
                        stroke={colors}
                        strokeWidth={2}
                        style={{ transition: 'all 0.2s' }}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* 图例说明 */}
          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-error-500" /> 高显著性
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500" /> 中等显著性
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-neutral-50 dark:bg-neutral-8000" /> 低显著性
            </span>
            {optimalRegion && (
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="w-8 h-4 bg-success-500/15 border border-dashed border-green-500 rounded" />
                最优区域
              </span>
            )}
          </div>
        </div>
      )}

      {/* 敏感性排名摘要 */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">敏感性排名摘要</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {sortedFactors.slice(0, 10).map((factor, idx) => (
            <div
              key={factor.id}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-neutral-700/50 rounded-lg"
               role="button" tabIndex={0} onClick={() => onFactorClick?.(factor)}
              style={{ cursor: 'pointer' }}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  idx < 3 ? 'bg-primary-500' : 'bg-neutral-400'
                }`}
              >
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">{factor.name}</div>
                <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{(factor.sensitivity * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { SensitivityTornado };
export default SensitivityTornado;
