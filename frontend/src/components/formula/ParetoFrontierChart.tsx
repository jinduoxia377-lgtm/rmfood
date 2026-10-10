/**
 * 帕累托前沿图 - 多目标优化结果可视化
 */
import { useMemo } from 'react';

interface ParetoSolution {
  objectives: {
    efficacy: number;
    safety: number;
    stability: number;
    cost: number;
  };
  ratios?: Record<string, number>;
  rank?: number;
}

interface ParetoFrontierChartProps {
  solutions?: ParetoSolution[];
  size?: number;
}

export function ParetoFrontierChart({ solutions = [], size = 300 }: ParetoFrontierChartProps) {
  const width = size;
  const height = size;
  const padding = 50;
  const plotSize = size - 2 * padding;

  // 简化为功效-安全二维展示
  const validValues = solutions.map(s => ({
    x: s.objectives.efficacy ?? 0,
    y: s.objectives.safety ?? 0,
    cost: s.objectives.cost ?? 0,
    rank: s.rank ?? 0,
  }));

  const minX = 0, maxX = 1, minY = 0, maxY = 1;

  const toSVG = (x: number, y: number) => ({
    sx: padding + ((x - minX) / (maxX - minX)) * plotSize,
    sy: height - padding - ((y - minY) / (maxY - minY)) * plotSize,
  });

  return (
    <div className="space-y-2">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-full h-auto">
        {/* 背景网格 */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <g key={frac}>
            <line x1={padding} y1={height - padding - frac * plotSize} x2={width - padding} y2={height - padding - frac * plotSize} stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="0.5" />
            <line x1={padding + frac * plotSize} y1={padding} x2={padding + frac * plotSize} y2={height - padding} stroke="currentColor" className="text-neutral-200 dark:text-neutral-700" strokeWidth="0.5" />
          </g>
        ))}
        {/* 帕累托前沿 */}
        {validValues.length > 0 && (
          <>
            {validValues.map((p: any, i: number) => {
              const { sx, sy } = toSVG(p.x, p.y);
              return (
                <g key={i}>
                  <circle cx={sx} cy={sy} r="6" fill={p.rank === 1 ? '#8b5cf6' : '#6b7280'} stroke="white" strokeWidth="2" />
                  {p.rank === 1 && (
                    <circle cx={sx} cy={sy} r="10" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
                  )}
                </g>
              );
            })}
          </>
        )}
        {/* 坐标轴 */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" strokeWidth="1.5" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" strokeWidth="1.5" />
        {/* 标签 */}
        <text x={width / 2} y={height - 10} textAnchor="middle" className="text-xs fill-neutral-500">功效得分</text>
        <text x={12} y={height / 2} textAnchor="middle" transform={`rotate(-90, 12, ${height / 2})`} className="text-xs fill-neutral-500">安全得分</text>
      </svg>
      {validValues.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <span>解数: {validValues.length}</span>
          <span>非支配解: {validValues.filter((p: any) => p.rank === 1).length}</span>
        </div>
      )}
    </div>
  );
}
