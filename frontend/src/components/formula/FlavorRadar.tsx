/**
 * 风味雷达图 — 六角形展示五味强度
 */
'use client';

import React from 'react';

interface FlavorRadarProps {
  profile: { bitter: number; sweet: number; umami: number; astringent: number; sour: number };
  balanceScore?: number;
  size?: number;
}

const FLAVORS = [
  { key: 'bitter', label: '苦', color: '#e11d48' },
  { key: 'sweet', label: '甜', color: '#f59e0b' },
  { key: 'umami', label: '鲜', color: '#10b981' },
  { key: 'astringent', label: '涩', color: '#8b5cf6' },
  { key: 'sour', label: '酸', color: 'var(--color-primary-500)' },
] as const;

export function FlavorRadar({ profile, balanceScore, size = 200 }: FlavorRadarProps) {
  const maxVal = Math.max(profile.bitter, profile.sweet, profile.umami, profile.astringent, profile.sour, 0.01);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / FLAVORS.length - Math.PI / 2;
    const dist = (value / maxVal) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 网格层 */}
        {gridLevels.map((level, li) => (
          <polygon
            key={li}
            points={FLAVORS.map((_, i) => {
              const angle = (Math.PI * 2 * i) / FLAVORS.length - Math.PI / 2;
              const px = cx + r * level * Math.cos(angle);
              const py = cy + r * level * Math.sin(angle);
              return `${px},${py}`;
            }).join(' ')}
            fill="none"
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-700"
            strokeWidth={li === 4 ? 1.5 : 0.8}
          />
        ))}
        {/* 轴线 */}
        {FLAVORS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / FLAVORS.length - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
              stroke="currentColor"
              className="text-neutral-200 dark:text-neutral-700"
              strokeWidth={0.8}
            />
          );
        })}
        {/* 数据填充 */}
        <polygon
          points={FLAVORS.map((f, i) => {
            const p = getPoint(i, profile[f.key] ?? 0);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="rgba(139, 92, 246, 0.2)"
          stroke="rgba(139, 92, 246, 0.8)"
          strokeWidth={2}
        />
        {/* 数据点 */}
        {FLAVORS.map((f, i) => {
          const p = getPoint(i, profile[f.key] ?? 0);
          return (
            <circle
              key={i}
              cx={p.x} cy={p.y} r={3.5}
              fill={f.color}
              stroke="white"
              strokeWidth={1.5}
            />
          );
        })}
        {/* 标签 */}
        {FLAVORS.map((f, i) => {
          const angle = (Math.PI * 2 * i) / FLAVORS.length - Math.PI / 2;
          const labelR = r + 16;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          return (
            <text
              key={i}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-medium"
              fill={f.color}
              style={{ fontSize: 11 }}
            >
              {f.label}
            </text>
          );
        })}
      </svg>
      {balanceScore !== undefined && balanceScore !== null && (
        <div className="text-center">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">风味平衡度 </span>
          <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{balanceScore.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
