/**
 * 协同效应热力图 - 展示成分对之间的协同指数
 */
import { useMemo } from 'react';

interface SynergyHeatmapProps {
  pairs: Array<{
    pair: string;
    overall_si?: number | null;
    dominant_mechanism?: string | null;
  }>;
  size?: 'sm' | 'md' | 'lg';
}

export function SynergyHeatmap({ pairs, size = 'md' }: SynergyHeatmapProps) {
  const sizeClasses = {
    sm: 'text-xs p-1',
    md: 'text-xs p-2',
    lg: 'text-sm p-3',
  };

  const getColor = (si: number | null) => {
    if (si === null || si === undefined) return 'bg-neutral-100 dark:bg-neutral-800';
    if (si > 0.7) return 'bg-success-500';
    if (si > 0.4) return 'bg-warning-500';
    return 'bg-danger-500';
  };

  const ingredientNames = useMemo(() => {
    const names = new Set<string>();
    pairs.forEach(p => {
      const [a, b] = p.pair.split(' + ');
      if (a) names.add(a);
      if (b) names.add(b);
    });
    return Array.from(names);
  }, [pairs]);

  if (!pairs?.length) {
    return (
      <div className="text-center py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        暂无协同分析数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2"></th>
            {ingredientNames.map(name => (
              <th key={name} className="p-2 text-left font-medium text-neutral-600 dark:text-neutral-400 rotate-45 origin-top-left">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ingredientNames.map((rowName, rowIdx) => (
            <tr key={rowName}>
              <th className="p-2 font-medium text-neutral-600 dark:text-neutral-400">{rowName}</th>
              {ingredientNames.map((colName, colIdx) => {
                if (rowIdx >= colIdx) return <td key={`${rowName}-${colName}`} className="p-1"></td>;
                const pair = pairs.find(p =>
                  p.pair === `${rowName} + ${colName}` || p.pair === `${colName} + ${rowName}`
                );
                const si = pair?.overall_si ?? null;
                return (
                  <td
                    key={`${rowName}-${colName}`}
                    className={cn(
                      'rounded transition-colors cursor-pointer',
                      sizeClasses[size],
                      getColor(si)
                    )}
                    title={`${pair?.pair}: SI=${si?.toFixed(2) ?? 'N/A'}`}
                  >
                    {si !== null ? si.toFixed(2) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-danger-500 rounded"></div> 拮抗 (&lt;0.4)</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-warning-500 rounded"></div> 弱协同 (0.4-0.7)</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-success-500 rounded"></div> 强协同 (&gt;0.7)</span>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
