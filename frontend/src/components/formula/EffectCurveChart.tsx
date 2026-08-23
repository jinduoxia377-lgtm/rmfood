/**
 * 效果预测曲线图 - PK/PD 时效曲线可视化
 */
import { useMemo } from 'react';

interface EffectCurveChartProps {
  ctCurve?: Array<{ time_hour: number; concentration: number }>;
  etCurve?: Array<{ time_hour: number; effect_level: number }>;
  peakTime?: number;
  peakConcentration?: number;
  maxEffect?: number;
  auc?: number;
}

export function EffectCurveChart({
  ctCurve = [],
  etCurve = [],
  peakTime = 0,
  peakConcentration = 0,
  maxEffect = 0,
  auc = 0,
}: EffectCurveChartProps) {
  const width = 400;
  const height = 200;
  const padding = 40;

  const maxX = Math.max(...ctCurve.map(p => p.time_hour), ...etCurve.map(p => p.time_hour), 1);
  const maxYCT = Math.max(...ctCurve.map(p => p.concentration), 1);
  const maxYET = Math.max(...etCurve.map(p => p.effect_level), 1);

  const pointsToPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const ctPoints = ctCurve.map(p => ({
    x: padding + (p.time_hour / maxX) * (width - 2 * padding),
    y: height - padding - (p.concentration / maxYCT) * (height - 2 * padding),
  }));

  const etPoints = etCurve.map(p => ({
    x: padding + (p.time_hour / maxX) * (width - 2 * padding),
    y: height - padding - (p.effect_level / maxYET) * (height - 2 * padding),
  }));

  return (
    <div className="space-y-3">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-full h-auto">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <g key={frac}>
            <line
              x1={padding}
              y1={height - padding - frac * (height - 2 * padding)}
              x2={width - padding}
              y2={height - padding - frac * (height - 2 * padding)}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-neutral-200 dark:text-neutral-700"
            />
          </g>
        ))}
        {/* CT Curve */}
        <path d={pointsToPath(ctPoints)} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        {/* ET Curve */}
        <path d={pointsToPath(etPoints)} fill="none" stroke="#10b981" strokeWidth="2" />
        {/* Peak marker */}
        {peakTime > 0 && (
          <circle
            cx={padding + (peakTime / maxX) * (width - 2 * padding)}
            cy={height - padding - (peakConcentration / maxYCT) * (height - 2 * padding)}
            r="4"
            fill="#ef4444"
          />
        )}
        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-neutral-400" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-neutral-400" />
        {/* Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-neutral-500">时间 (h)</text>
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`} className="text-[10px] fill-neutral-500">浓度/效应</text>
      </svg>
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-violet-500" />
          <span className="text-neutral-600 dark:text-neutral-400">血浆浓度 (CT)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-emerald-500" />
          <span className="text-neutral-600 dark:text-neutral-400">效应水平 (ET)</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-neutral-500">Tmax: {peakTime.toFixed(1)}h</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded bg-violet-50 dark:bg-violet-900/20 text-center">
          <div className="text-violet-600 dark:text-violet-400">Cmax</div>
          <div className="font-bold text-violet-700 dark:text-violet-300">{peakConcentration.toFixed(1)}</div>
        </div>
        <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 text-center">
          <div className="text-emerald-600 dark:text-emerald-400">Emax</div>
          <div className="font-bold text-emerald-700 dark:text-emerald-300">{maxEffect.toFixed(3)}</div>
        </div>
        <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-center">
          <div className="text-blue-600 dark:text-blue-400">AUC</div>
          <div className="font-bold text-blue-700 dark:text-blue-300">{auc.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
