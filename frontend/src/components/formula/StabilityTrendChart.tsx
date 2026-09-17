/**
 * 稳定性趋势图 - 展示货架期预测和降解曲线
 */
import { useMemo } from 'react';

interface StabilityTrendChartProps {
  data?: {
    shelf_life_months?: number;
    stability_score?: number;
    risk_factors?: Array<{ factor: string; severity: number }>;
  };
  size?: number;
}

export function StabilityTrendChart({ data, size = 200 }: StabilityTrendChartProps) {
  const score = data?.stability_score ?? 0;
  const shelfLife = data?.shelf_life_months ?? 0;
  
  // 计算健康度颜色
  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const healthColor = getHealthColor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* 背景圆 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.4}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-neutral-100 dark:text-neutral-800"
          />
          {/* 进度圆 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.4}
            fill="none"
            stroke={healthColor}
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * size * 0.4}`}
            strokeDashoffset={`${2 * Math.PI * size * 0.4 * (1 - score / 100)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-500"
          />
          {/* 中心文字 */}
          <text
            x={size / 2}
            y={size / 2 - 8}
            textAnchor="middle"
            className="text-2xl font-bold fill-neutral-900 dark:fill-white"
          >
            {score.toFixed(0)}
          </text>
          <text
            x={size / 2}
            y={size / 2 + 12}
            textAnchor="middle"
            className="text-xs fill-neutral-500"
          >
            稳定性评分
          </text>
        </svg>
      </div>
      
      <div className="text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          预测货架期
        </p>
        <p className="text-2xl font-bold text-neutral-900 dark:text-white">
          {shelfLife > 0 ? `${shelfLife.toFixed(0)}` : '—'}
          <span className="text-sm font-normal text-neutral-500 ml-1">月</span>
        </p>
      </div>

      {(((data as Record<string, unknown>)?.risk_factors as unknown[])?.length ?? 0) > 0 && (
        <div className="w-full space-y-1">
          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">风险因素</p>
          {(((data as Record<string, unknown>)?.risk_factors as unknown[])?.slice(0, 3) ?? []).map((risk: { severity?: number; factor?: string }, idx: number) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: risk.severity > 0.7 ? '#ef4444' : risk.severity > 0.4 ? '#f59e0b' : '#10b981' }}
              />
              <span className="text-neutral-600 dark:text-neutral-400 truncate">{risk.factor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
