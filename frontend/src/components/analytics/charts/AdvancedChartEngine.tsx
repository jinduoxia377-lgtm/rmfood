/**
 * AdvancedChartEngine - 企业级数据可视化引擎
 * 基于 Recharts 构建，提供统一的图表接口和丰富的交互功能
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
// D-40：原 import { useTheme } from '@/hooks/useTheme'（遗留兼容层）。
// 该文件仅需 isDark，改用 @/theme 的现代 hook，消除同名 useTheme 歧义。
import { useIsDarkMode } from '@/theme';

// ─── 类型定义 ───
export type ChartType =
  | 'line'
  | 'multi-line'
  | 'bar'
  | 'stacked-bar'
  | 'horizontal-bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'stacked-area'
  | 'radar'
  | 'scatter';

export type ChartDataPoint = Record<string, string | number>;

export interface ChartSeries {
  dataKey: string;
  name: string;
  color?: string;
  type?: 'monotone' | 'linear' | 'step' | 'basis' | 'natural';
  strokeWidth?: number;
  dot?: boolean | { r?: number; fill?: string; stroke?: string };
  stackId?: string;
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title?: string;
  subtitle?: string;
  data: ChartDataPoint[];
  series: ChartSeries[];
  xAxis?: {
    dataKey?: string;
    label?: string;
    tickFormatter?: (value: any) => string;
    angle?: number;
  };
  yAxis?: {
    label?: string;
    tickFormatter?: (value: any) => string;
    unit?: string;
  };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right';
  };
  tooltip?: {
    enabled?: boolean;
    formatter?: (value: any, name: string) => [string, string];
  };
  grid?: boolean;
  animation?: boolean;
  height?: number;
  responsive?: boolean;
  onChartClick?: (data: any) => void;
  onDataPointClick?: (data: any, index: number) => void;
  customTooltip?: React.ReactNode;
  loading?: boolean;
  emptyState?: string;
  error?: string;
}

// ─── 常量定义 ───
const CHART_COLORS = [
  'var(--color-primary, var(--color-primary-400))', // primary green
  'var(--color-secondary, #0A84FF)', // blue
  'var(--color-tertiary, var(--color-accent-500))', // violet
  'var(--color-warning, #FF9F0A)', // amber
  'var(--color-error, #FF3B30)', // red
  'var(--color-info, var(--color-secondary-500))', // cyan
  'var(--color-pink-500, #D946EF)', // pink
  'var(--color-success, var(--color-primary-400))', // lime
];

const DARK_CHART_COLORS = [
  'var(--color-success-400, #4ADE80)', // lighter green
  'var(--color-blue-400, #6ECAFF)', // lighter blue
  'var(--color-accent-400, #C090FF)', // lighter violet
  'var(--color-warning-400, #F59E0B)', // lighter amber
  'var(--color-danger-400, #EF4444)', // lighter red
  'var(--color-cyan-400, #67E8F9)', // lighter cyan
  'var(--color-pink-400, #EC4899)', // lighter pink
  'var(--color-lime-400, #A3E635)', // lighter lime
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  dark?: boolean;
}

function CustomTooltip({ active, payload, label, dark }: CustomTooltipProps) {
  if (!active || !payload) return null;

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg border ${
        dark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-neutral-200'
      }`}
    >
      {label && <p className={`text-sm font-semibold mb-2 ${dark ? 'text-neutral-200' : 'text-neutral-900'}`}>{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className={dark ? 'text-neutral-300' : 'text-neutral-700'}>{entry.name}:</span>
          <span className={`font-semibold ${dark ? 'text-white' : 'text-neutral-900'}`}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 主组件 ───
export const AdvancedChartEngine: React.FC<ChartConfig> = ({
  type,
  title,
  subtitle,
  data,
  series,
  xAxis,
  yAxis,
  legend = { show: true, position: 'top' },
  tooltip = { enabled: true },
  grid = true,
  animation = true,
  height = 400,
  responsive = true,
  onChartClick,
  onDataPointClick,
  loading = false,
  emptyState,
  error,
}) => {
  const isDark = useIsDarkMode();
  const [activeIndex, setActiveIndex] = useState(-1);

  const colors = useMemo(() => (isDark ? DARK_CHART_COLORS : CHART_COLORS), [isDark]);

  const seriesWithColors = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        color: s.color || colors[i % colors.length],
      })),
    [series, colors],
  );

  const handleDataPointClick = useCallback(
    (data: any, index: number) => {
      setActiveIndex(index);
      onDataPointClick?.(data, index);
    },
    [onDataPointClick],
  );

  // Loading 状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-slate-50 dark:bg-neutral-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-muted">加载中...</p>
        </div>
      </div>
    );
  }

  // Error 状态
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-error-50 dark:bg-error-900/20 rounded-lg">
        <p className="text-error-600 dark:text-error-400">{error}</p>
      </div>
    );
  }

  // Empty 状态
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-slate-50 dark:bg-neutral-800 rounded-lg">
        <p className="text-text-muted">{emptyState || '暂无数据'}</p>
      </div>
    );
  }

  // 渲染图表内容
  const renderChartContent = () => {
    switch (type) {
      case 'line':
      case 'multi-line':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <LineChart data={data} onClick={onChartClick}>
              {grid && <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'} />}
              <XAxis
                dataKey={xAxis?.dataKey}
                tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }}
                angle={xAxis?.angle}
              />
              <YAxis
                tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }}
                tickFormatter={yAxis?.tickFormatter}
                unit={yAxis?.unit}
              />
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              {legend.show && <Legend {...legend} />}
              {seriesWithColors.map((s) => (
                <Line
                  key={s.dataKey}
                  type={s.type || 'monotone'}
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth || 2}
                  dot={s.dot === true ? { r: 4, fill: s.color, stroke: s.color } : s.dot}
                  activeDot={{ r: 6 }}
                  animationDuration={animation ? 500 : 0}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
      case 'stacked-bar':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <BarChart data={data} onClick={onChartClick}>
              {grid && <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'} />}
              <XAxis dataKey={xAxis?.dataKey} tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }} />
              <YAxis
                tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }}
                tickFormatter={yAxis?.tickFormatter}
                unit={yAxis?.unit}
              />
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              {legend.show && <Legend {...legend} />}
              {seriesWithColors.map((s) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  stackId={type === 'stacked-bar' ? 'stack' : s.stackId}
                  radius={[4, 4, 0, 0]}
                  animationDuration={animation ? 500 : 0}
                  onClick={(data: any, idx: number) => handleDataPointClick(data, idx)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <PieChart>
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              <Pie
                data={series.map((s) => ({
                  name: s.name,
                  value: data.reduce((sum, row) => sum + (Number(row[s.dataKey]) || 0), 0),
                  color: s.color,
                }))}
                cx="50%"
                cy="50%"
                outerRadius={type === 'donut' ? 80 : 100}
                innerRadius={type === 'donut' ? 60 : 0}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                animationDuration={animation ? 500 : 0}
                onClick={(data, idx) => handleDataPointClick(data, idx)}
              >
                {seriesWithColors.map((s, index) => (
                  <Cell key={`cell-${index}`} fill={s.color} />
                ))}
              </Pie>
              {legend.show && <Legend {...legend} />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
      case 'stacked-area':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <AreaChart data={data} onClick={onChartClick}>
              {grid && <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'} />}
              <XAxis dataKey={xAxis?.dataKey} tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }} />
              <YAxis tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }} unit={yAxis?.unit} />
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              {legend.show && <Legend {...legend} />}
              {seriesWithColors.map((s) => (
                <Area
                  key={s.dataKey}
                  type={s.type || 'monotone'}
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={type === 'stacked-area' ? 0.6 : 0.3}
                  stackId={type === 'stacked-area' ? 'stack' : s.stackId}
                  animationDuration={animation ? 500 : 0}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <RadarChart data={data}>
              <PolarGrid stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'} />
              <PolarAngleAxis
                dataKey={xAxis?.dataKey || 'name'}
                tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }}
              />
              <PolarRadiusAxis tick={{ fontSize: 12, fill: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)' }} />
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              {legend.show && <Legend {...legend} />}
              {seriesWithColors.map((s) => (
                <Radar
                  key={s.dataKey}
                  name={s.name}
                  dataKey={s.dataKey}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.3}
                  animationDuration={animation ? 500 : 0}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width={responsive ? '100%' : undefined} height={height}>
            <ScatterChart>
              {grid && <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'var(--text-secondary, #6E6E73)' : 'var(--border-subtle, rgba(0,0,0,0.06))'} />}
              <XAxis dataKey={xAxis?.dataKey || 'x'} name={xAxis?.label || 'X'} tick={{ fontSize: 12 }} />
              <YAxis dataKey={series[0]?.dataKey || 'y'} name={yAxis?.label || 'Y'} tick={{ fontSize: 12 }} />
              {tooltip.enabled && <Tooltip content={<CustomTooltip dark={isDark} />} />}
              {legend.show && <Legend {...legend} />}
              {seriesWithColors.map((s) => (
                <Scatter
                  key={s.dataKey}
                  name={s.name}
                  dataKey={s.dataKey}
                  fill={s.color}
                  animationDuration={animation ? 500 : 0}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full min-h-[200px] bg-slate-50 dark:bg-neutral-800 rounded-lg">
            <p className="text-text-muted">不支持的图表类型: {type}</p>
          </div>
        );
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 图表标题区 */}
      {(title || subtitle) && (
        <div style={{ marginBottom: '16px' }}>
          {title && (
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: isDark ? 'var(--card-bg-solid, #FFFFFF)' : 'var(--bg-canvas, #000000)',
                marginBottom: '4px',
              }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              style={{
                fontSize: '14px',
                color: isDark ? 'var(--text-muted, #9A9A9F)' : 'var(--text-secondary, #6E6E73)',
                marginTop: '4px',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* 图表主体 */}
      <div
        style={{
          backgroundColor: isDark ? 'var(--bg-canvas, #000000)' : 'var(--card-bg-solid, #FFFFFF)',
          borderRadius: '12px',
          padding: '16px',
          border: `1px solid ${isDark ? 'var(--bg-secondary, var(--bg-surface-container))' : 'var(--border-subtle, rgba(0,0,0,0.06))'}`,
          transition: 'box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = isDark
            ? '0 10px 25px rgba(0, 0, 0, 0.3)'
            : '0 10px 25px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        {renderChartContent()}
      </div>
    </div>
  );
};

export default AdvancedChartEngine;
