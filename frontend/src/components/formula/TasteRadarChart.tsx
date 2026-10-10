/**
 * 风味雷达图 - 可视化五味谱
 */
import { useMemo } from 'react';

interface TasteRadarChartProps {
  profile: {
    bitter: number;
    sweet: number;
    umami: number;
    astringent: number;
    sour: number;
  };
  size?: number;
}

const FLAVORS = ['bitter', 'sweet', 'umami', 'astringent', 'sour'] as const;
const FLAVOR_LABELS = { bitter: '苦', sweet: '甜', umami: '鲜', astringent: '涩', sour: '酸' };
const FLAVOR_COLORS = { bitter: '#f43f5e', sweet: '#ec4899', umami: '#f59e0b', astringent: '#a855f7', sour: '#84cc16' };

export function TasteRadarChart({ profile, size = 200 }: TasteRadarChartProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  const points = useMemo(() => {
    return FLAVORS.map((flavor, idx) => {
      const angle = (idx * 2 * Math.PI / FLAVORS.length) - Math.PI / 2;
      const value = profile[flavor] ?? 0;
      const r = radius * value;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        flavor,
        value,
      };
    });
  }, [profile, centerX, centerY, radius]);

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 背景网格 */}
        {gridLevels.map(level => {
          const r = radius * level;
          const pts = FLAVORS.map((_, idx) => {
            const angle = (idx * 2 * Math.PI / FLAVORS.length) - Math.PI / 2;
            return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-neutral-200 dark:text-neutral-700"
            />
          );
        })}
        {/* 轴线 */}
        {FLAVORS.map((_, idx) => {
          const angle = (idx * 2 * Math.PI / FLAVORS.length) - Math.PI / 2;
          return (
            <line
              key={idx}
              x1={centerX}
              y1={centerY}
              x2={centerX + radius * Math.cos(angle)}
              y2={centerY + radius * Math.sin(angle)}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-neutral-200 dark:text-neutral-700"
            />
          );
        })}
        {/* 数据区域 */}
        <polygon
          points={polygonPoints}
          fill="rgba(139, 92, 246, 0.2)"
          stroke="rgba(139, 92, 246, 0.8)"
          strokeWidth="2"
        />
        {/* 数据点 */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={FLAVOR_COLORS[p.flavor]}
          />
        ))}
        {/* 标签 */}
        {points.map((p, idx) => {
          const angle = (idx * 2 * Math.PI / FLAVORS.length) - Math.PI / 2;
          const labelR = radius + 15;
          return (
            <text
              key={idx}
              x={centerX + labelR * Math.cos(angle)}
              y={centerY + labelR * Math.sin(angle)}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-neutral-600 dark:fill-neutral-400"
            >
              {FLAVOR_LABELS[p.flavor]}
            </text>
          );
        })}
      </svg>
      <div className="grid grid-cols-5 gap-1 text-xs">
        {FLAVORS.map(flavor => (
          <div key={flavor} className="text-center">
            <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ backgroundColor: FLAVOR_COLORS[flavor] }} />
            <span className="text-neutral-600 dark:text-neutral-400">{FLAVOR_LABELS[flavor]}</span>
            <span className="block font-medium text-neutral-900 dark:text-white">
              {(profile[flavor] ?? 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
