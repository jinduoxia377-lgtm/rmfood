/**
 * AIAvatarFallback — 本地 Canvas AI 头像生成器（离线降级方案）
 *
 * 设计目标：
 * - 不依赖任何外部服务，纯 Canvas 绘制
 * - 品牌色渐变背景 + 药草叶 SVG 路径（与项目品牌一致）
 * - 确定性种子：所有 AI 消息共用同一头像（会话级缓存）
 * - 输出 128×128 WebP Blob → ObjectURL，与 RealAIAvatar 接口一致
 *
 * 降级链路：后端 StyleGAN2 → 本地 Canvas → Leaf 图标（三级降级）
 */

import { useEffect, useState } from 'react';

/** 会话级缓存：同一页面会话内 AI 降级头像保持不变 */
let cachedFallbackUrl: string | null = null;

const AVATAR_SIZE = 128;

/** 品牌渐变配色（emerald → violet，与项目主色一致） */
const GRADIENT_COLORS = ['#059669', '#6d28d9'] as const;

/** 药草叶 SVG 路径（与项目品牌 Logo 一致） */
function drawLeafPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath();
  // 叶片主体 — 椭圆形叶形
  ctx.moveTo(cx, cy - scale * 0.35);
  ctx.bezierCurveTo(cx + scale * 0.28, cy - scale * 0.30, cx + scale * 0.35, cy - scale * 0.05, cx + scale * 0.20, cy + scale * 0.20);
  ctx.bezierCurveTo(cx + scale * 0.10, cy + scale * 0.35, cx + scale * 0.02, cy + scale * 0.40, cx, cy + scale * 0.40);
  ctx.bezierCurveTo(cx - scale * 0.02, cy + scale * 0.40, cx - scale * 0.10, cy + scale * 0.35, cx - scale * 0.20, cy + scale * 0.20);
  ctx.bezierCurveTo(cx - scale * 0.35, cy - scale * 0.05, cx - scale * 0.28, cy - scale * 0.30, cx, cy - scale * 0.35);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fill();
}

/** 叶脉（中央主脉 + 侧脉） */
function drawLeafVeins(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.strokeStyle = 'rgba(5, 150, 105, 0.6)';
  ctx.lineWidth = scale * 0.02;
  ctx.lineCap = 'round';

  // 主脉
  ctx.beginPath();
  ctx.moveTo(cx, cy - scale * 0.30);
  ctx.lineTo(cx, cy + scale * 0.38);
  ctx.stroke();

  // 左侧脉
  for (let i = 0; i < 3; i++) {
    const y = cy - scale * 0.10 + i * scale * 0.15;
    const xEnd = cx - scale * (0.12 - i * 0.02);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx - scale * 0.05, y - scale * 0.04, xEnd, y - scale * 0.03);
    ctx.stroke();
  }

  // 右侧脉
  for (let i = 0; i < 3; i++) {
    const y = cy - scale * 0.10 + i * scale * 0.15;
    const xEnd = cx + scale * (0.12 - i * 0.02);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx + scale * 0.05, y - scale * 0.04, xEnd, y - scale * 0.03);
    ctx.stroke();
  }
}

/** 顶部装饰小圆点 */
function drawDecorativeDots(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  const dots = [
    { x: 0.15, y: 0.12, r: 0.018 },
    { x: 0.85, y: 0.15, r: 0.022 },
    { x: 0.78, y: 0.88, r: 0.015 },
    { x: 0.20, y: 0.85, r: 0.020 },
  ];
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.x * size, d.y * size, d.r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 生成 AI 头像 Canvas Blob
 */
async function generateAIAvatarBlob(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // 1. 品牌渐变背景
  const gradient = ctx.createLinearGradient(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  gradient.addColorStop(0, GRADIENT_COLORS[0]);
  gradient.addColorStop(1, GRADIENT_COLORS[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // 2. 叠加光晕（右上角高光）
  const glow = ctx.createRadialGradient(
    AVATAR_SIZE * 0.85, AVATAR_SIZE * 0.10, 0,
    AVATAR_SIZE * 0.85, AVATAR_SIZE * 0.10, AVATAR_SIZE * 1.0,
  );
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // 3. 药草叶图标（居中）
  const cx = AVATAR_SIZE / 2;
  const cy = AVATAR_SIZE / 2 + AVATAR_SIZE * 0.03;
  const leafScale = AVATAR_SIZE * 0.80;

  drawLeafPath(ctx, cx, cy, leafScale);
  drawLeafVeins(ctx, cx, cy, leafScale);

  // 4. 装饰点
  drawDecorativeDots(ctx, AVATAR_SIZE);

  // 5. 输出 WebP
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  );
  if (!blob) throw new Error('Canvas toBlob failed');
  return blob;
}

export interface AIAvatarFallbackProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function AIAvatarFallback({ size = 'sm', className = '' }: AIAvatarFallbackProps) {
  const [url, setUrl] = useState<string | null>(cachedFallbackUrl);
  const [failed, setFailed] = useState(false);

  // 若已有缓存，通过 effect 同步（避免 render 期间 setState 导致无限重渲染）
  useEffect(() => {
    if (cachedFallbackUrl && !url) {
      setUrl(cachedFallbackUrl);
    }
  }, [cachedFallbackUrl, url]);

  useEffect(() => {
    if (cachedFallbackUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await generateAIAvatarBlob();
        const objectUrl = URL.createObjectURL(blob);
        cachedFallbackUrl = objectUrl;
        if (!cancelled) setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  if (url && !failed) {
    return (
      <img
        src={url}
        alt="AI 研发助手"
        data-testid="ai-avatar-fallback"
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
      />
    );
  }

  // Canvas 也失败 → 品牌渐变 + Leaf 图标（最终兜底）
  return (
    <span
      className={`${sizeClass} flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-[#10b981] text-white ${className}`}
      role="img"
      aria-label="AI 研发助手"
    >
      <LeafIcon />
    </span>
  );
}

/** 内联 Leaf 图标组件，避免额外导入（保持 AIAvatarFallback 零依赖） */
function LeafIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}
