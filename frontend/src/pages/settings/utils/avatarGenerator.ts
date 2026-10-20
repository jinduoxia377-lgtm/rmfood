/**
 * 头像自动生成器 v3（零依赖，纯 Canvas）
 *
 * 设计：
 * - 品牌主渐变（emerald #10b981 / primary-600 #059669 → accent-700 #6d28d9 等 9 组）
 *   叠加高对比前景色（琥珀/粉/天蓝/紫罗兰/橙色），让头像更醒目；
 * - 以「用户名 + 随机种子」驱动确定性 PRNG（mulberry32），每次「换一个」都不同；
 * - 7 种风格：字母 / 几何 / 像素 / 波浪 / 自然 / 条纹 / 气泡；
 * - 输出 400×400 WebP Blob，复用现有头像上传链路。
 */

export type AvatarStyle = 'gradient' | 'geometric' | 'identicon' | 'waves' | 'botanical' | 'stripes' | 'bubbles'

export interface AvatarStyleOption {
  id: AvatarStyle
  label: string
}

export const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  { id: 'gradient', label: '字母' },
  { id: 'geometric', label: '几何' },
  { id: 'identicon', label: '像素' },
  { id: 'waves', label: '波浪' },
  { id: 'botanical', label: '自然' },
  { id: 'stripes', label: '条纹' },
  { id: 'bubbles', label: '气泡' },
]

// 品牌渐变组合（保证辨识度与对比度）
const BRAND_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#059669', '#6d28d9'], // primary-600 → accent-700
  ['#10b981', '#7c3aed'], // emerald → violet
  ['#047857', '#8b5cf6'], // deep emerald → violet-500
  ['#0d9488', '#0ea5e9'], // teal → sky
  ['#059669', '#d97706'], // emerald → amber
  ['#6d28d9', '#db2777'], // violet → pink
  ['#0f766e', '#4f46e5'], // teal-700 → indigo-600
  ['#047857', '#2563eb'], // deep emerald → blue-600
  ['#b45309', '#065f46'], // amber-700 → deep emerald
]

// 高对比前景色（叠加在渐变上，增强视觉冲击）
const FOREGROUND_COLORS = [
  '#fbbf24', // amber-400
  '#f472b6', // pink-400
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#f87171', // red-400
]

const AVATAR_SIZE = 400

/** 追加随机片段，保证每次生成结果不同 */
export const randomizeSeed = (base: string): string =>
  `${base}#${Math.random().toString(36).slice(2, 10)}`

/** 字符串 → 32 位整数哈希（FNV-1a） */
export function hashSeed(...parts: (string | number)[]): number {
  const text = parts.join(':')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 确定性 PRNG（返回 [0,1)） */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  size: number,
  c1: string,
  c2: string,
  angle = 135,
) {
  const rad = (angle * Math.PI) / 180
  const x0 = size / 2 - Math.cos(rad) * size * 0.75
  const y0 = size / 2 - Math.sin(rad) * size * 0.75
  const x1 = size / 2 + Math.cos(rad) * size * 0.75
  const y1 = size / 2 + Math.sin(rad) * size * 0.75
  const grad = ctx.createLinearGradient(x0, y0, x1, y1)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // 叠加光晕，增强质感
  const glow = ctx.createRadialGradient(size * 0.85, size * 0.1, 0, size * 0.85, size * 0.1, size * 1.0)
  glow.addColorStop(0, 'rgba(255,255,255,0.20)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
}

function drawInitials(ctx: CanvasRenderingContext2D, size: number, seed: string, fg: string) {
  const trimmed = seed.replace(/#[a-z0-9]+$/i, '').trim()
  const char = (trimmed[0] || 'U').toUpperCase()

  // 字母背后加半透明圆形徽章
  const badgeR = size * 0.30
  const badgeGrad = ctx.createRadialGradient(size / 2, size / 2, badgeR * 0.3, size / 2, size / 2, badgeR)
  badgeGrad.addColorStop(0, 'rgba(255,255,255,0.40)')
  badgeGrad.addColorStop(1, 'rgba(255,255,255,0.10)')
  ctx.fillStyle = badgeGrad
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, badgeR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.98)'
  ctx.font = `bold ${Math.round(size * 0.40)}px "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.30)'
  ctx.shadowBlur = size * 0.05
  ctx.shadowOffsetY = size * 0.025
  ctx.fillText(char, size / 2, size / 2 + size * 0.03)
  ctx.shadowColor = 'transparent'

  // 装饰环（使用前景色）
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, badgeR + size * 0.06, 0, Math.PI * 2)
  ctx.strokeStyle = fg
  ctx.lineWidth = size * 0.02
  ctx.stroke()

  // 角落漂浮小点
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5
    const r = size * (0.42 + ((i * 37) % 10) * 0.01)
    const d = size * (0.02 + ((i * 53) % 6) * 0.005)
    ctx.beginPath()
    ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, d, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()
  }
}

function drawGeometric(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.44

  // 半透明同心圆
  const rings = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < rings; i++) {
    const r = maxR * (0.2 + i * 0.24)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,255,255,${0.55 - i * 0.13})`
    ctx.lineWidth = size * (0.035 - i * 0.006)
    ctx.stroke()
  }

  // 中心多边形（前景色）
  const sides = 3 + Math.floor(rand() * 4)
  const angleOffset = rand() * Math.PI * 2
  const polyR = maxR * (0.55 + rand() * 0.25)
  ctx.beginPath()
  for (let i = 0; i <= sides; i++) {
    const angle = angleOffset + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(angle) * polyR
    const y = cy + Math.sin(angle) * polyR
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = fg
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.globalAlpha = 1

  // 点缀白色小圆点
  const dots = 3 + Math.floor(rand() * 4)
  for (let i = 0; i < dots; i++) {
    const a = rand() * Math.PI * 2
    const r = maxR * (0.15 + rand() * 0.65)
    const d = size * (0.03 + rand() * 0.03)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fill()
  }
}

function drawIdenticon(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string) {
  const grid = 5
  const cell = size / grid
  const margin = cell * 0.22
  const radius = cell * 0.28

  const drawCell = (x: number, y: number, w: number, color: string) => {
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, w, radius)
    } else {
      ctx.rect(x, y, w, w)
    }
    ctx.fillStyle = color
    ctx.fill()
  }

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < Math.ceil(grid / 2); col++) {
      const active = rand() > 0.36
      if (!active) continue
      // 约 1/3 的格子用前景色，其余用白色，形成双色像素画
      const color = rand() > 0.62 ? fg : 'rgba(255,255,255,0.92)'
      for (const mirrorCol of [col, grid - 1 - col]) {
        const x = mirrorCol * cell + margin
        const y = row * cell + margin
        const w = cell - margin * 2
        drawCell(x, y, w, color)
      }
    }
  }
}

function drawWaves(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string) {
  const layers = 3 + Math.floor(rand() * 2)
  const baseY = size * (0.55 + rand() * 0.15)
  for (let i = 0; i < layers; i++) {
    const amp = size * (0.06 + rand() * 0.06)
    const period = size * (0.55 + rand() * 0.35)
    const phase = rand() * Math.PI * 2
    const yOffset = i * size * 0.10
    // 最上层用前景色，下层用半透明白
    const color = i === layers - 1 ? fg : `rgba(255,255,255,${0.40 - i * 0.10})`
    ctx.beginPath()
    ctx.moveTo(-size * 0.1, baseY + yOffset)
    for (let x = -size * 0.1; x <= size * 1.1; x += size / 48) {
      const y = baseY + yOffset + Math.sin((x / period) * Math.PI * 2 + phase) * amp
      ctx.lineTo(x, y)
    }
    ctx.lineTo(size * 1.1, size * 1.2)
    ctx.lineTo(-size * 0.1, size * 1.2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  // 顶部圆点
  const dots = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < dots; i++) {
    const a = rand() * Math.PI * 2
    const r = size * (0.18 + rand() * 0.2)
    const d = size * (0.02 + rand() * 0.02)
    ctx.beginPath()
    ctx.arc(size / 2 + Math.cos(a) * r, size * 0.35 + Math.sin(a) * r, d, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fill()
  }
}

function drawBotanical(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string) {
  const cx = size / 2
  const cy = size / 2 + size * 0.04
  const stemH = size * 0.34

  // 茎
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = size * 0.02
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy + stemH * 0.5)
  ctx.quadraticCurveTo(cx + size * 0.02, cy, cx, cy - stemH * 0.5)
  ctx.stroke()

  const leafCount = 3
  const leaf = (side: 1 | -1, y: number, len: number, rot: number, color: string) => {
    const baseX = cx + side * size * 0.01
    const tipX = cx + side * len
    const tipY = y + rot
    ctx.beginPath()
    ctx.moveTo(baseX, y)
    ctx.quadraticCurveTo(cx + side * len * 0.5, y - len * 0.35, tipX, tipY)
    ctx.quadraticCurveTo(cx + side * len * 0.4, y + len * 0.45, baseX, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  for (let i = 0; i < leafCount; i++) {
    const y = cy - stemH * 0.5 + (i / (leafCount - 1)) * stemH * 0.8
    const len = size * (0.16 + rand() * 0.05)
    const rot = size * (0.01 + rand() * 0.02)
    // 中间叶子用前景色，两侧用白色
    const color = i === 1 ? fg : 'rgba(255,255,255,0.88)'
    leaf(1, y, len, rot, color)
    leaf(-1, y, len, -rot, color)
  }

  // 顶部小圆
  ctx.beginPath()
  ctx.arc(cx, cy - stemH * 0.5 - size * 0.02, size * 0.035, 0, Math.PI * 2)
  ctx.fillStyle = fg
  ctx.fill()
}

function drawStripes(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string, seed: string) {
  const stripeCount = 5 + Math.floor(rand() * 3)
  const angle = rand() * Math.PI * 2
  const stripeWidth = size / stripeCount
  const half = size * 1.2

  ctx.save()
  ctx.translate(size / 2, size / 2)
  ctx.rotate(angle)
  ctx.translate(-size / 2, -size / 2)

  for (let i = 0; i < stripeCount; i++) {
    const x0 = -half + i * stripeWidth
    // 交替：前景色 / 半透明白
    const color = i % 2 === 0 ? fg : 'rgba(255,255,255,0.82)'
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x0, -half)
    ctx.lineTo(x0 + stripeWidth * 0.6, -half)
    ctx.lineTo(x0 + stripeWidth * 0.6 + half * 0.5, size + half)
    ctx.lineTo(x0 + half * 0.5, size + half)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()

  // 中央白色圆形徽章 + 首字母，保证可读性
  const trimmed = seed.replace(/#[a-z0-9]+$/i, '').trim()
  const char = (trimmed[0] || 'U').toUpperCase()
  const badgeR = size * 0.22
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, badgeR, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.fill()
  ctx.fillStyle = '#1f2937'
  ctx.font = `bold ${Math.round(size * 0.24)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, size / 2, size / 2 + size * 0.01)
}

function drawBubbles(ctx: CanvasRenderingContext2D, size: number, rand: () => number, fg: string) {
  const count = 5 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    const r = size * (0.12 + rand() * 0.22)
    const x = size * (0.2 + rand() * 0.6)
    const y = size * (0.2 + rand() * 0.6)
    const color = i % 2 === 0 ? fg : 'rgba(255,255,255,0.85)'
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    // 高光
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.22, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

export interface GenerateAvatarOptions {
  style?: AvatarStyle
  size?: number
}

/**
 * 生成头像 Blob（WebP）。
 * @param seed 种子字符串（建议 username 或 username+randomizeSeed）
 */
export async function generateAvatar(
  seed: string,
  options: GenerateAvatarOptions = {},
): Promise<Blob> {
  const { style = 'gradient', size = AVATAR_SIZE } = options
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  const rand = mulberry32(hashSeed(seed, style))
  const palette = BRAND_GRADIENTS[Math.floor(rand() * BRAND_GRADIENTS.length)]
  const fg = FOREGROUND_COLORS[Math.floor(rand() * FOREGROUND_COLORS.length)]
  const angle = [45, 90, 135, 160][Math.floor(rand() * 4)]
  drawGradientBackground(ctx, size, palette[0], palette[1], angle)

  if (style === 'gradient') {
    drawInitials(ctx, size, seed, fg)
  } else if (style === 'geometric') {
    drawGeometric(ctx, size, rand, fg)
  } else if (style === 'identicon') {
    drawIdenticon(ctx, size, rand, fg)
  } else if (style === 'waves') {
    drawWaves(ctx, size, rand, fg)
  } else if (style === 'botanical') {
    drawBotanical(ctx, size, rand, fg)
  } else if (style === 'stripes') {
    drawStripes(ctx, size, rand, fg, seed)
  } else if (style === 'bubbles') {
    drawBubbles(ctx, size, rand, fg)
  } else {
    drawInitials(ctx, size, seed, fg)
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('头像生成失败')
  return blob
}