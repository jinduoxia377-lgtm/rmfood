/**
 * 效果预测曲线图 - PK/PD 时效曲线可视化
 */

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
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeWidth="1" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
        {/* Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-xs fill-neutral-500">时间 (h)</text>
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`} className="text-xs fill-neutral-500">浓度/效应</text>
      </svg>
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-accent-500" />
          <span className="text-neutral-600 dark:text-neutral-400">血浆浓度 (CT)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-success-500" />
          <span className="text-neutral-600 dark:text-neutral-400">效应水平 (ET)</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-2 h-2 rounded-full bg-error-500" />
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">Tmax: {peakTime.toFixed(1)}h</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded bg-accent-50 dark:bg-accent-300/20 text-center">
          <div className="text-accent-600 dark:text-accent-700">Cmax</div>
          <div className="font-bold text-accent-700 dark:text-accent-700">{peakConcentration.toFixed(1)}</div>
        </div>
        <div className="p-2 rounded bg-success-50 dark:bg-success-300/20 text-center">
          <div className="text-success-700 dark:text-success-600">Emax</div>
          <div className="font-bold text-success-700 dark:text-success-700">{maxEffect.toFixed(3)}</div>
        </div>
        <div className="p-2 rounded bg-secondary-50 dark:bg-secondary-300/20 text-center">
          <div className="text-secondary-700 dark:text-secondary-700">AUC</div>
          <div className="font-bold text-secondary-700 dark:text-secondary-700">{auc.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
