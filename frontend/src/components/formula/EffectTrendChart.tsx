/**
 * 效果趋势图 — PK 曲线示意
 * 展示浓度-时间关系、峰值点和最佳窗口区间
 */
'use client';

import React from 'react';

interface EffectTrendChartProps {
  peakTime?: number;
  peakConcentration?: number;
  optimalWindow?: [number, number];
  effectDuration?: number;
  auc?: number;
}

export function EffectTrendChart({
  peakTime,
  peakConcentration,
  optimalWindow,
  effectDuration,
  auc,
}: EffectTrendChartProps) {
  const W = 320;
  const H = 160;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // 时间轴 0~24h
  const maxX = 24;
  const maxY = peakConcentration ? Math.ceil(peakConcentration * 1.3) : 10;

  const toX = (t: number) => padL + (t / maxX) * plotW;
  const toY = (c: number) => padT + plotH - (c / maxY) * plotH;

  // 生成 PK 曲线点（模拟一个典型的一级吸收 PK 曲线）
  const generateCurve = (): Array<[number, number]> => {
    if (!peakTime || !peakConcentration) return [];
    const points: Array<[number, number]> = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxX;
      // 简化 PK 模型: C(t) = Cmax * (t/Tmax) * exp(1 - t/Tmax)
      const C = peakConcentration * (t / peakTime) * Math.exp(1 - t / peakTime);
      points.push([t, Math.max(0, C)]);
    }
    return points;
  };

  const curve = generateCurve();
  const pathD = curve.length > 1
    ? `M ${curve.map(([t, c]) => `${toX(t)},${toY(c)}`).join(' L ')}`
    : '';

  // 面积路径（到 Y=0）
  const areaD = curve.length > 1
    ? `${pathD} L ${toX(maxX)},${toY(0)} L ${toX(0)},${toY(0)} Z`
    : '';

  // 最佳窗口区域
  const winX1 = optimalWindow ? toX(Math.max(0, optimalWindow[0])) : 0;
  const winX2 = optimalWindow ? toX(Math.min(maxX, optimalWindow[1])) : 0;
  const hasWindow = optimalWindow && optimalWindow[1] > optimalWindow[0];

  // 峰值标记
  const peakPt = peakTime && peakConcentration ? [toX(peakTime), toY(peakConcentration)] : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[280px]">
        {/* Y 轴 */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} />
        {/* X 轴 */}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" strokeWidth={1} />

        {/* Y 轴刻度 */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={padL - 4} y1={toY(maxY * f)} x2={padL} y2={toY(maxY * f)} stroke="currentColor" className="text-neutral-300 dark:text-neutral-600" />
            <text x={padL - 6} y={toY(maxY * f)} textAnchor="end" dominantBaseline="middle" className="text-[9px] fill-neutral-400 dark:fill-neutral-500">
              {(maxY * f).toFixed(0)}
            </text>
          </g>
        ))}

        {/* X 轴刻度 */}
        {[0, 6, 12, 18, 24].map((t) => (
          <text key={t} x={toX(t)} y={padT + plotH + 14} textAnchor="middle" className="text-[9px] fill-neutral-400 dark:fill-neutral-500">
            {t}h
          </text>
        ))}

        {/* Y 轴标签 */}
        <text x={8} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90, 8, ${padT + plotH / 2})`} className="text-[9px] fill-neutral-400 dark:fill-neutral-500">
          浓度 (μg/mL)
        </text>
        {/* X 轴标签 */}
        <text x={padL + plotW / 2} y={H - 2} textAnchor="middle" className="text-[9px] fill-neutral-400 dark:fill-neutral-500">
          时间 (h)
        </text>

        {/* 最佳窗口阴影 */}
        {hasWindow && (
          <rect
            x={Math.min(winX1, winX2)} y={padT}
            width={Math.abs(winX2 - winX1)} height={plotH}
            fill="rgba(16, 185, 129, 0.1)"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth={0.5}
          />
        )}

        {/* AUC 面积 */}
        {pathD && (
          <path d={areaD} fill="rgba(139, 92, 246, 0.12)" />
        )}

        {/* PK 曲线 */}
        {pathD && (
          <path d={pathD} fill="none" stroke="rgba(139, 92, 246, 0.9)" strokeWidth={2} />
        )}

        {/* 峰值点 */}
        {peakPt && (
          <>
            <line x1={peakPt[0]} y1={peakPt[1]} x2={peakPt[0]} y2={padT + plotH} stroke="rgba(139, 92, 246, 0.4)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={peakPt[0]} cy={peakPt[1]} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1.5} />
            <text x={peakPt[0]} y={peakPt[1] - 8} textAnchor="middle" className="text-[8px] fill-violet-600 dark:fill-violet-400 font-medium">
              Cmax {peakConcentration?.toFixed(2)}
            </text>
          </>
        )}

        {/* 最佳窗口标签 */}
        {hasWindow && (
          <text
            x={(winX1 + winX2) / 2} y={padT + 10}
            textAnchor="middle"
            className="text-[8px] fill-primary-600 dark:fill-primary-400 font-medium"
          >
            最佳窗口 {optimalWindow?.[0]?.toFixed(1)}~{optimalWindow?.[1]?.toFixed(1)}h
          </text>
        )}
      </svg>

      {/* AUC 信息 */}
      {auc !== undefined && auc !== null && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 text-center">
          AUC = {auc.toFixed(2)} μg·h/mL
        </p>
      )}
    </div>
  );
}
