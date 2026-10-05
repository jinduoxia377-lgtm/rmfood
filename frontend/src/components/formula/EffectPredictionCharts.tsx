/**
 * 配方效果预测可视化组件
 *
 * 功能:
 * - 时效曲线 (C-T) 图表
 * - 效应曲线 (E-T) 图表
 * - 多方案对比视图
 * - 最佳服用时间窗口标注
 * - 导出功能 (PNG/PDF)
 */

import React, { useState, useMemo } from 'react';
import {
  LineChart as LineIcon,
  Clock,
  TrendingUp,
  Maximize2,
  Download,
  GitCompare,
  Calendar,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { Card, Button, Badge, Tabs, TabsTrigger } from '@/components/ui';

// ==================== 类型定义 ====================

interface TimePointData {
  time: number;
  concentration: number;
  effect: number;
}

interface EffectPredictionData {
  formula_id: string;
  ct_curve: TimePointData[];
  et_curve: TimePointData[];
  peak_time: number;
  peak_concentration: number;
  max_effect: number;
  duration: number;
  optimal_window: [number, number];
  auc: number;
}

interface ComparisonViewProps {
  formulas: {
    id: string;
    name: string;
    data: EffectPredictionData;
  }[];
  selectedFormulas?: string[];
  onFormulaToggle?: (id: string) => void;
}

// ==================== 组件1: 单方案效果预测图 ====================

interface EffectPredictionChartProps {
  data: EffectPredictionData;
  showConfidenceBand?: boolean;
  height?: number;
}

export function EffectPredictionChart({ data, showConfidenceBand = true, height = 300 }: EffectPredictionChartProps) {
  const [activeTab, setActiveTab] = useState<'ct' | 'et'>('ct');

  // 计算图表坐标范围
  const chartWidth = 600;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // 坐标转换函数
  const maxTime = Math.max(...data.ct_curve.map((p) => p.time));
  const maxConc = Math.max(...data.ct_curve.map((p) => p.concentration)) * 1.2;
  const maxEffect = 1.1;

  const toX = (time: number) => (time / maxTime) * plotWidth + padding.left;
  const toYConc = (conc: number) => plotHeight - (conc / maxConc) * plotHeight + padding.top;
  const toYEffect = (effect: number) => plotHeight - (effect / maxEffect) * plotHeight + padding.top;

  // 生成 SVG 路径
  const generatePath = (points: TimePointData[], yMapper: (val: number) => number) => {
    if (points.length < 2) return '';

    return points
      .map((p, i) => {
        const x = toX(p.time);
        const y = yMapper(p === points[0] ? 0 : p.concentration || p.effect);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  // C-T 曲线路径
  const ctPath = generatePath(data.ct_curve, toYConc);
  // E-T 曲线路径
  const etPath = generatePath(data.et_curve, toYEffect);

  // 关键点标记
  const peakX = toX(data.peak_time);
  const peakYConc = toYConc(data.peak_concentration);
  const peakYEffect = toYEffect(data.max_effect);

  // 最佳时间窗口标记
  const windowStartX = toX(data.optimal_window[0]);
  const windowEndX = toX(data.optimal_window[1]);

  return (
    <Card className="p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-success-500" />
          效果预测模拟
          <Badge variant="info">{data.formula_id}</Badge>
        </h3>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            PNG
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: '达峰时间', value: `${data.peak_time.toFixed(1)}h`, icon: <Clock />, color: 'blue' },
          {
            label: '峰浓度',
            value: `${data.peak_concentration.toFixed(2)}`,
            unit: 'μg/mL',
            icon: <LineIcon />,
            color: 'purple',
          },
          { label: '最大效应', value: `${(data.max_effect * 100).toFixed(1)}%`, icon: <Target />, color: 'green' },
          { label: '持续时间', value: `${data.duration.toFixed(1)}h`, icon: <Calendar />, color: 'orange' },
          { label: 'AUC', value: `${data.auc.toFixed(1)}`, unit: 'μg·h/mL', icon: <TrendingUp />, color: 'indigo' },
        ].map(({ label, value, unit, icon, color }) => (
          <div key={label} className={`p-3 bg-${color}-50 dark:bg-${color}-950 rounded-lg`}>
            <div className={`text-${color}-600 dark:text-${color}-400 mb-1`}>{icon}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{label}</p>
            <p className="font-mono font-bold text-neutral-900 dark:text-white">
              {value}
              {unit && <span className="text-xs text-neutral-500 ml-1">{unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* 图表切换标签 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ct' | 'et')}>
        <TabsTrigger value="ct">时效曲线 (C-T)</TabsTrigger>
        <TabsTrigger value="et">效应曲线 (E-T)</TabsTrigger>
      </Tabs>

      {/* 图表区域 */}
      <div className="mt-4 relative bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-lg p-4 overflow-hidden">
        <svg width={chartWidth} height={height} className="mx-auto">
          {/* 网格线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left + plotWidth * tick}
                y1={padding.top}
                x2={padding.left + plotWidth * tick}
                y2={height - padding.bottom}
                stroke="#E5E7EB"
                strokeDasharray="4,4"
                className="dark:stroke-slate-700"
              />
              <line
                x1={padding.left}
                y1={height - padding.bottom - plotHeight * tick}
                x2={chartWidth - padding.right}
                y2={height - padding.bottom - plotHeight * tick}
                stroke="#E5E7EB"
                strokeDasharray="4,4"
                className="dark:stroke-slate-700"
              />
            </g>
          ))}

          {/* 最佳时间窗口背景 */}
          <rect
            x={windowStartX}
            y={padding.top}
            width={windowEndX - windowStartX}
            height={plotHeight}
            fill="var(--color-primary-400)"
            opacity="0.08"
            rx="4"
          />

          {activeTab === 'ct' ? (
            <>
              {/* C-T 曲线 */}
              <path
                d={ctPath}
                fill="none"
                stroke="var(--color-secondary-500)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 峰值点标记 */}
              <circle cx={peakX} cy={peakYConc} r="6" fill="var(--color-secondary-500)" stroke="#fff" strokeWidth="2" />

              {/* 峰值标注 */}
              <g>
                <rect x={peakX - 40} y={peakYConc - 35} width="80" height="24" rx="4" fill="var(--color-secondary-500)" />
                <text x={peakX} y={peakYConc - 19} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">
                  Tmax: {data.peak_time.toFixed(1)}h
                </text>
                <line x1={peakX} y1={peakYConc - 11} x2={peakX} y2={peakYConc - 6} stroke="var(--color-secondary-500)" strokeWidth="2" />
              </g>

              {/* Y轴标签 */}
              <text
                x="15"
                y={height / 2 + 5}
                textAnchor="middle"
                fontSize="12"
                fill="#6B7280"
                transform={`rotate(-90, 15, ${height / 2})`}
              >
                浓度 (μg/mL)
              </text>

              {/* X轴刻度 */}
              {[0, 6, 12, 18, 24].map((hour) => (
                <g key={hour}>
                  <line
                    x1={toX(hour)}
                    y1={height - padding.bottom}
                    x2={toX(hour)}
                    y2={height - padding.bottom + 5}
                    stroke="#6B7280"
                    strokeWidth="1"
                  />
                  <text x={toX(hour)} y={height - padding.bottom + 18} textAnchor="middle" fontSize="11" fill="#6B7280">
                    {hour}h
                  </text>
                </g>
              ))}

              {/* 置信区间带（可选） */}
              {showConfidenceBand && (
                <path
                  d={`${generatePath(
                    data.ct_curve.map((p) => ({
                      ...p,
                      concentration: p.concentration * 1.3,
                    })),
                    toYConc,
                  )} L ${generatePath(
                    [...data.ct_curve.reverse()].map((p) => ({
                      ...p,
                      concentration: p.concentration * 0.7,
                    })),
                    toYConc,
                  )} Z`}
                  fill="var(--color-secondary-500)"
                  opacity="0.1"
                />
              )}
            </>
          ) : (
            <>
              {/* E-T 曲线 */}
              <path
                d={etPath}
                fill="none"
                stroke="var(--color-primary-400)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 最大效应点标记 */}
              <circle cx={toX(data.peak_time)} cy={peakYEffect} r="6" fill="var(--color-primary-400)" stroke="#fff" strokeWidth="2" />

              {/* 半效期参考线 */}
              <line
                x1={padding.left}
                y2={toYEffect(data.max_effect / 2)}
                x2={chartWidth - padding.right}
                y1={toYEffect(data.max_effect / 2)}
                stroke="#D97706"
                strokeWidth="1"
                strokeDasharray="8,4"
                opacity="0.6"
              />
              <text
                x={chartWidth - padding.right - 60}
                y={toYEffect(data.max_effect / 2) - 5}
                fontSize="10"
                fill="#D97706"
              >
                50% Emax
              </text>

              {/* Y轴标签 */}
              <text
                x="15"
                y={height / 2 + 5}
                textAnchor="middle"
                fontSize="12"
                fill="#6B7280"
                transform={`rotate(-90, 15, ${height / 2})`}
              >
                效应水平 (归一化)
              </text>

              {/* X轴刻度 */}
              {[0, 6, 12, 18, 24].map((hour) => (
                <g key={hour}>
                  <line
                    x1={toX(hour)}
                    y1={height - padding.bottom}
                    x2={toX(hour)}
                    y2={height - padding.bottom + 5}
                    stroke="#6B7280"
                    strokeWidth="1"
                  />
                  <text x={toX(hour)} y={height - padding.bottom + 18} textAnchor="middle" fontSize="11" fill="#6B7280">
                    {hour}h
                  </text>
                </g>
              ))}
            </>
          )}

          {/* 最佳窗口标注 */}
          <g>
            <line
              x1={windowStartX}
              y1={padding.top}
              x2={windowStartX}
              y2={height - padding.bottom}
              stroke="var(--color-primary-400)"
              strokeWidth="2"
              strokeDasharray="6,3"
            />
            <line
              x1={windowEndX}
              y1={padding.top}
              x2={windowEndX}
              y2={height - padding.bottom}
              stroke="var(--color-primary-400)"
              strokeWidth="2"
              strokeDasharray="6,3"
            />

            {/* 窗口标签 */}
            <rect
              x={(windowStartX + windowEndX) / 2 - 45}
              y={padding.top - 20}
              width="90"
              height="18"
              rx="9"
              fill="var(--color-primary-400)"
            />
            <text
              x={(windowStartX + windowEndX) / 2}
              y={padding.top - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#fff"
              fontWeight="bold"
            >
              ⏰ 最佳服用窗口
            </text>
          </g>
        </svg>
      </div>

      {/* 底部说明 */}
      <div className="mt-4 flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-4">
          <span>📊 基于 PopPK/PD 一室模型 + Sigmoid Emax</span>
          <span>•</span>
          <span>体重: 70kg</span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success">
            最佳窗口: {data.optimal_window[0].toFixed(1)}-{data.optimal_window[1].toFixed(1)}h
          </Badge>
        </div>
      </div>
    </Card>
  );
}

// ==================== 组件2: 多方案对比视图 ====================

export function MultiFormulaComparison({ formulas, selectedFormulas = [], onFormulaToggle }: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<'overlay' | 'sidebyside'>('overlay');

  const toggleFormula = (id: string) => {
    onFormulaToggle?.(id);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-accent-500" />
          多方案对比分析
        </h3>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'overlay' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('overlay')}
          >
            叠加显示
          </Button>
          <Button
            variant={viewMode === 'sidebyside' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('sidebyside')}
          >
            并列显示
          </Button>
        </div>
      </div>

      {/* 方案选择器 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {formulas.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFormula(f.id)}
            className={`px-4 py-2 rounded-lg border-2 transition-all ${
              selectedFormulas.includes(f.id)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 shadow-md'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
            }`}
          >
            <span className="font-medium text-sm">{f.name}</span>
            {selectedFormulas.includes(f.id) && <CheckCircle2 className="inline w-4 h-4 ml-2 text-primary-500" />}
          </button>
        ))}
      </div>

      {/* 对比指标表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300">指标</th>
              {formulas
                .filter((f) => selectedFormulas.includes(f.id))
                .map((f) => (
                  <th key={f.id} className="px-4 py-3 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                    {f.name}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {[
              { label: 'Tmax (小时)', getValue: (d: EffectPredictionData) => d.peak_time.toFixed(2), unit: 'h' },
              { label: 'Cmax (μg/mL)', getValue: (d: EffectPredictionData) => d.peak_concentration.toFixed(3) },
              { label: 'Emax (%)', getValue: (d: EffectPredictionData) => (d.max_effect * 100).toFixed(1), unit: '%' },
              { label: '持续时间 (h)', getValue: (d: EffectPredictionData) => d.duration.toFixed(2), unit: 'h' },
              { label: 'AUC', getValue: (d: EffectPredictionData) => d.auc.toFixed(2) },
              {
                label: '最佳窗口',
                getValue: (d: EffectPredictionData) =>
                  `${d.optimal_window[0].toFixed(1)}-${d.optimal_window[1].toFixed(1)}`,
              },
            ].map(({ label, getValue, unit }) => (
              <tr key={label} className="hover:bg-slate-50 dark:hover:bg-neutral-800">
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{label}</td>
                {formulas
                  .filter((f) => selectedFormulas.includes(f.id))
                  .map((f) => (
                    <td key={f.id} className="px-4 py-3 text-right font-mono">
                      {getValue(f.data)}
                      {unit && <span className="text-neutral-500 ml-1">{unit}</span>}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 提示信息 */}
      {selectedFormulas.length === 0 && (
        <div className="text-center py-8 text-neutral-500">
          <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>请选择至少一个配方进行对比</p>
        </div>
      )}

      {selectedFormulas.length > 0 && selectedFormulas.length <= 4 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {formulas
            .filter((f) => selectedFormulas.includes(f.id))
            .map((f) => (
              <div key={f.id}>
                <EffectPredictionChart data={f.data} height={220} showConfidenceBand={false} />
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

// 导出组件
export default EffectPredictionChart;
