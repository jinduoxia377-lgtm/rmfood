// ⑦ 字体方案 · ⑧ 配色方案 —— 主题运行时覆盖的【数据模型层】
//
// 本文件只产出数据，不触碰 DOM。所有运行时覆盖必须经
//   applyCustomTheme → mergeThemeOverrides → generateCSSVariables → applyThemeToDOM
// 单通道落地（禁止 UI 层直写 root.style.setProperty，见方案基线 1 / GATE-17）。
//
// 三条硬约束（见《RMFOOD-主题设置模块系统性控制执行方案》基线 2/3）：
//   1. 数据模型先行 —— 覆盖率是数据模型的函数，不是 UI 层的补丁。
//   2. 档位内单调性 —— 主色阶在双模式下是【有意反转】的：
//        base.css 亮色：100 最浅 → 950 最深
//        dark.css 暗色：100 最深 → 950 最浅
//      运行时注入必须【整档同向替换】。只改中间档会产生「断裂梯度」：
//      500/600/700 换色而 100-400、800-950 仍是品牌绿的反转值，且暗色下
//      800-950 是浅色，叠白字即 D-50 类对比度崩塌（探针已实测复现该形态）。
//   3. 默认绿逐档等于 L0 —— 否则选择「默认绿」会悄悄改变全站 1 277 处品牌绿消费。

// ============================================================================
// 主色阶：11 档（50..950），与 base.css / dark.css 的 --color-primary-<档> 对齐
// ============================================================================

export const PRIMARY_TIERS = [
  '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950',
] as const;
export type PrimaryTier = (typeof PRIMARY_TIERS)[number];
export type PrimaryScale = Record<PrimaryTier, string>;

// 默认绿：逐档照抄 L0 权威值（base.css:9-19 亮 / dark.css:9-19 暗）。
// 不得程序化生成 —— 生成值与 L0 有细微偏差，选「默认绿」时会造成全站品牌绿漂移。
export const DEFAULT_GREEN_LIGHT_SCALE: PrimaryScale = {
  '50': '#ecfdf5',
  '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
  '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
};
export const DEFAULT_GREEN_DARK_SCALE: PrimaryScale = {
  '50': '#022c22',
  '100': '#064e3b', '200': '#065f46', '300': '#047857', '400': '#059669', '500': '#34d399',
  '600': '#6ee7b7', '700': '#a7f3d0', '800': '#d1fae5', '900': '#ecfdf5', '950': '#f0fdf4',
};

// ============================================================================
// 色相混合工具（用于为非默认方案程序化生成满足单调性的整档色阶）
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = String(hex).replace(/^#/, '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
const toHex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** 线性插值：t=0 返回 a，t=1 返回 b */
export function mixColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const c = Math.min(1, Math.max(0, t));
  return `#${toHex2(pa.r + (pb.r - pa.r) * c)}${toHex2(pa.g + (pb.g - pa.g) * c)}${toHex2(pa.b + (pb.b - pa.b) * c)}`;
}

/** WCAG 相对亮度（供单调性断言与门禁 GATE-16 复用） */
export function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// 亮色形态权重：负 = 向白色混合（提亮），正 = 向黑色混合（压暗）。
// 500 = 锚点本身。权重幅值严格递增 → 生成的亮度序列严格单调（可被 GATE-16 断言）。
const RAMP_WEIGHTS_LIGHT: Record<PrimaryTier, number> = {
  '50': -0.94, '100': -0.88, '200': -0.68, '300': -0.48, '400': -0.25, '500': 0,
  '600': 0.17, '700': 0.35, '800': 0.53, '900': 0.69, '950': 0.84,
};

// 暗色形态权重 = 亮色权重取负：50 最深 → 950 最浅，且 500 仍 = 锚点。
//
// 为什么取负而不是对亮色 ramp 做整体反转：取负把锚点钉死在 500（weight 0），
// 与 L0「500 即当模式锚点」的约定一致 —— dark.css:14 的 --color-primary-500
// 就是暗色锚点。反转在档位数为偶数时会让锚点从 500 滑到 600，故不用。
const RAMP_WEIGHTS_DARK: Record<PrimaryTier, number> = Object.fromEntries(
  PRIMARY_TIERS.map((t) => [t, -RAMP_WEIGHTS_LIGHT[t]]),
) as Record<PrimaryTier, number>;

function buildRamp(anchor: string, weights: Record<PrimaryTier, number>): PrimaryScale {
  const out = {} as PrimaryScale;
  for (const tier of PRIMARY_TIERS) {
    const w = weights[tier];
    out[tier] = w === 0 ? anchor : mixColor(anchor, w < 0 ? '#ffffff' : '#000000', Math.abs(w));
  }
  return out;
}

/** 亮色形态色阶：100 最浅 → 950 最深，500 = 锚点（与 base.css 一致） */
export function buildLightRamp(anchor: string): PrimaryScale {
  return buildRamp(anchor, RAMP_WEIGHTS_LIGHT);
}

/** 暗色形态色阶：100 最深 → 950 最浅，500 = 锚点（与 dark.css 一致） */
export function buildDarkRamp(anchor: string): PrimaryScale {
  return buildRamp(anchor, RAMP_WEIGHTS_DARK);
}

/**
 * 单调性度量（GATE-16 复用）：统计相邻档之间「逆方向」亮度跳变幅度的总和。
 *
 * 为什么不用严格单调断言：L0 的 green/dark 色阶在 900→950 之间存在 −0.019 的
 * 轻微亮度回落（#ecfdf5 → #f0fdf4，蓝分量回落所致）。若要求严格单调，门禁会
 * 在【L0 基线自身】上就失败 —— 那是错误的门禁设计。
 * 本度量对真实缺陷（中间档换色造成的「断裂梯度」，逆方向跳变通常 > 0.2）依然
 * 极其敏感，同时容忍 < 0.05 的亚百分比级偏差。
 *
 * @param direction 'desc' = 100 最浅→950 最深（亮色形态）；'asc' = 反向（暗色形态）
 */
export function wrongDirectionLumaSum(
  scale: PrimaryScale,
  direction: 'desc' | 'asc',
): number {
  let sum = 0;
  for (let i = 1; i < PRIMARY_TIERS.length; i++) {
    const d = relLuminance(scale[PRIMARY_TIERS[i]]) - relLuminance(scale[PRIMARY_TIERS[i - 1]]);
    const against = direction === 'desc' ? d > 0 : d < 0;
    if (against) sum += Math.abs(d);
  }
  return sum;
}

// ============================================================================
// ⑧ 配色方案：Apple HIG 系统色板（明暗双值）+ 整档色阶
// ============================================================================

export interface HIGPalette {
  key: string; name: string;
  /** 500 档锚点：亮色模式主色 */
  light: string;
  /** 500 档锚点：暗色模式主色（Apple HIG 暗色更亮） */
  dark: string;
  hover: string; pressed: string; sub: string; subDark: string;
  contrastText: string; note: string;
}
export const APPLE_HIG_PALETTES: HIGPalette[] = [
  { key: 'green', name: '默认绿', light: '#10B981', dark: '#34D399', hover: '#059669', pressed: '#047857', sub: '#6EE7B7', subDark: '#A7F3D0', contrastText: '#052E16', note: '品牌默认（明暗双值）' },
  { key: 'blue', name: '苹果蓝', light: '#007AFF', dark: '#0A84FF', hover: '#0066CC', pressed: '#00518F', sub: '#64B5F6', subDark: '#5AC8FA', contrastText: '#FFFFFF', note: 'Apple HIG systemBlue（#007AFF 亮 / #0A84FF 暗）' },
  { key: 'purple', name: '紫色', light: '#AF52DE', dark: '#BF5AF2', hover: '#8E3DA8', pressed: '#6D2E84', sub: '#D29BF5', subDark: '#DA7FFF', contrastText: '#FFFFFF', note: 'Apple HIG systemPurple' },
  { key: 'orange', name: '橙色', light: '#FF9500', dark: '#FF9F0A', hover: '#C86F00', pressed: '#9C5700', sub: '#FFB84D', subDark: '#FFB340', contrastText: '#FFFFFF', note: 'Apple HIG systemOrange' },
  { key: 'red', name: '红色', light: '#FF3B30', dark: '#FF453A', hover: '#D70015', pressed: '#A50011', sub: '#FF7A6E', subDark: '#FF6458', contrastText: '#FFFFFF', note: 'Apple HIG systemRed' },
];

/**
 * 取某方案的双模式整档色阶。
 * light = 100 最浅 → 950 最深；dark = 100 最深 → 950 最浅（与 L0 反转规则一致）。
 * 默认绿返回 L0 权威值，其余方案由 500 锚点程序化生成。
 */
export function getPaletteScales(p: HIGPalette): { light: PrimaryScale; dark: PrimaryScale } {
  if (p.key === 'green') {
    return { light: DEFAULT_GREEN_LIGHT_SCALE, dark: DEFAULT_GREEN_DARK_SCALE };
  }
  return {
    light: buildLightRamp(p.light),
    dark: buildDarkRamp(p.dark),
  };
}

// ============================================================================
// ⑧b / ⑧c 次色 / 强调色：单锚点色板（执行方案阶段 E3）
// ============================================================================
//
// 与主色不同，次色与强调色在 L0 里的 500 锚点【两种模式相同】：
//   --color-secondary-500  亮 / 暗 均为 #3b82f6（base.css:46 / dark.css:42）
//   --color-accent-500     亮 / 暗 均为 #8b5cf6（base.css:65 / dark.css:60）
// 明暗差异完全由档位反转承载（亮色 100 浅→950 深、暗色反之），
// 故一份锚点即可派生两组作用域，不必像主色那样维护 light / dark 两个锚点。
//
// 「选默认 = 无变化」沿用主色的约定：默认方案逐档照抄 L0 权威值，不程序化生成。
// buildLightRamp 从 500 锚点插值，与 Tailwind 手工调校过的 L0 档位有细微偏差
//（accent 亮色 300 与 400 在 L0 里同为 #c084fc，生成器无法复现这个「压平」），
// 若默认方案也走生成器，「选默认」就会悄悄改变全站次色/强调色的渲染。
// 其余方案程序化生成 —— RAMP_WEIGHTS 的幅值严格递增保证亮度单调，
// 可被 GATE-16 断言（生成 ramp 不可能出现中间档换色的断裂梯度）。
//
// 影响面（2026-10 实测）：--color-secondary-* 共 1 922 处引用（700 档 457、
// 500 档 379、600 档 314 最多）；--color-accent-* 共 1 540 处（500 档 317、
// 700 档 300、600 档 231 最多）。两族都不是小面，故走全量 11 档整档替换。

/** 次色 / 强调色方案：单锚点（500 档，两态通用） */
export interface BrandColorPalette {
  key: string;
  name: string;
  /** 500 档锚点 hex，两种模式共用 */
  anchor: string;
  note: string;
}

/** 次色方案（L0 默认 Ocean Blue #3B82F6） */
export const SECONDARY_PALETTES: BrandColorPalette[] = [
  { key: 'blue',   name: '海洋蓝', anchor: '#3B82F6', note: 'L0 默认' },
  { key: 'sky',    name: '天青',   anchor: '#0EA5E9', note: '明亮通透' },
  { key: 'cyan',   name: '青',     anchor: '#06B6D4', note: '科技感' },
  { key: 'teal',   name: '蓝绿',   anchor: '#14B8A6', note: '沉稳偏冷' },
  { key: 'indigo', name: '靛蓝',   anchor: '#4F46E5', note: '深邃' },
];

/** 强调色方案（L0 默认 Bio Purple #8B5CF6） */
export const ACCENT_PALETTES: BrandColorPalette[] = [
  { key: 'purple', name: '生物紫', anchor: '#8B5CF6', note: 'L0 默认' },
  { key: 'violet', name: '紫罗兰', anchor: '#7C3AED', note: '偏蓝紫' },
  { key: 'indigo', name: '靛蓝',   anchor: '#6366F1', note: '中性冷色' },
  { key: 'pink',   name: '品红',   anchor: '#EC4899', note: '活泼' },
  { key: 'orange', name: '橙',     anchor: '#EA580C', note: '暖色强调' },
];

// L0 权威值逐档照抄（base.css:41-70 亮 / dark.css:37-65 暗）。
// 不得程序化生成 —— 见上方「选默认 = 无变化」说明。
export const DEFAULT_SECONDARY_LIGHT_SCALE: PrimaryScale = {
  '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa',
  '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554',
};
export const DEFAULT_SECONDARY_DARK_SCALE: PrimaryScale = {
  '50': '#172554', '100': '#1e3a8a', '200': '#1e40af', '300': '#1d4ed8', '400': '#2563eb',
  '500': '#3b82f6', '600': '#60a5fa', '700': '#93c5fd', '800': '#bfdbfe', '900': '#dbeafe', '950': '#eff6ff',
};
export const DEFAULT_ACCENT_LIGHT_SCALE: PrimaryScale = {
  '50': '#faf5ff', '100': '#f3e8ff', '200': '#e8d5ff', '300': '#c084fc', '400': '#c084fc',
  '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#3b0764', '950': '#1a0542',
};
export const DEFAULT_ACCENT_DARK_SCALE: PrimaryScale = {
  '50': '#1a0542', '100': '#3b0764', '200': '#5b21b6', '300': '#6d28d9', '400': '#7c3aed',
  '500': '#8b5cf6', '600': '#a78bfa', '700': '#c4b5fd', '800': '#ddd6fe', '900': '#ede9fe', '950': '#faf5ff',
};

/**
 * 取某品牌的次色 / 强调色双模式整档色阶。
 *
 * 默认方案返回 L0 权威值；其余方案由锚点经 buildLightRamp / buildDarkRamp
 * 派生（权重取负即得暗色反转，500 锚点钉死在两态中间）。
 */
export function getBrandFamilyScales(
  family: 'secondary' | 'accent',
  p: BrandColorPalette,
): { light: PrimaryScale; dark: PrimaryScale } {
  const isDefault =
    (family === 'secondary' && p.key === 'blue') ||
    (family === 'accent' && p.key === 'purple');
  if (isDefault) {
    return family === 'secondary'
      ? { light: DEFAULT_SECONDARY_LIGHT_SCALE, dark: DEFAULT_SECONDARY_DARK_SCALE }
      : { light: DEFAULT_ACCENT_LIGHT_SCALE, dark: DEFAULT_ACCENT_DARK_SCALE };
  }
  return { light: buildLightRamp(p.anchor), dark: buildDarkRamp(p.anchor) };
}

// ============================================================================
// ⑦ 字体方案：完整 L0 排版档
// ============================================================================

// 键名必须与 generateCSSVariables 产出的 `--text-<toKebab(key)>` 一致，
// 且必须落在 L0 已定义的令牌上（base.css `--text-*`），否则注入的是无消费者的孤儿令牌。
export const FONT_SCALE_KEYS = [
  'body', 'bodySm', 'caption', 'bodyLg', 'overline', 'tiny',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
] as const;
export type FontScaleKey = (typeof FONT_SCALE_KEYS)[number];
export type FontScale = Record<FontScaleKey, string>;

/** L0 基准像素值（base.css 权威：--text-body 0.9375rem=15px 等） */
const FONT_BASELINE_PX: Record<FontScaleKey, number> = {
  body: 15, bodySm: 14, caption: 12, bodyLg: 16, overline: 12, tiny: 12,
  h1: 36, h2: 28, h3: 24, h4: 22, h5: 18, h6: 16,
};
const HEADING_KEYS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
/** 标题档阻尼系数：0 = 完全跟随正文，1 = 完全不阻尼。取 0.7 避免宽松档标题溢出容器 */
const HEADING_DAMPING = 0.7;

const toRem = (px: number) => `${+(px / 16).toFixed(4)}rem`;

/**
 * 按正文基准字号生成完整排版档。
 * 正文族按 basePx/15 等比缩放；标题族施加 HEADING_DAMPING 阻尼（18px 基准下 h1 = 36×1.14 ≈ 41px，
 * 而非 43.2px），保持层级比例而不撑破容器。
 */
export function buildFontScale(basePx: number): FontScale {
  const bodyFactor = basePx / 15;
  const headingFactor = 1 + (bodyFactor - 1) * HEADING_DAMPING;
  const out = {} as FontScale;
  for (const k of FONT_SCALE_KEYS) {
    out[k] = toRem(HEADING_KEYS.has(k) ? FONT_BASELINE_PX[k] * headingFactor : FONT_BASELINE_PX[k] * bodyFactor);
  }
  return out;
}

export const FONT_SCHEME_META: { key: string; label: string; desc: string; basePx: number }[] = [
  { key: 'compact', label: '紧凑', desc: '14px 基准，信息密度高', basePx: 14 },
  { key: 'standard', label: '标准', desc: '15px 基准，默认', basePx: 15 },
  { key: 'relaxed', label: '宽松', desc: '18px 基准，易读', basePx: 18 },
];

/** 三个方案的完整排版档（standard 与 L0 基准逐值一致） */
export const FONT_SCALES: Record<string, FontScale> = {
  compact: buildFontScale(14),
  standard: buildFontScale(15),
  relaxed: buildFontScale(18),
};

// ============================================================================
// ⑩ 圆角方案
// ============================================================================
//
// 键集与 theme.types 的 BorderRadius 一致；standard 逐值照抄 L0 权威值
//（base.css:255-261 的 --radius-sm..full），保证「选标准 = 无变化」，
// 否则会像早期「默认绿」一样悄悄改变全站 rounded-* 消费。
//
// 影响面（2026-10 实测）：--radius-* 登记在 index.css:185-191 的 @theme 里，
// Tailwind 的 rounded-* 工具类即解析到这些令牌 —— rounded-lg 1 959 处、
// rounded-full 968、rounded-xl 817、rounded-md 307、rounded-2xl 115、
// rounded-sm 30，合计约 4 200 处；rounded-xs 0 处（故本方案不含 xs）。
// 这是设计意图而非副作用：用户选「圆润」就该全站圆角变圆。
//
// 与色阶不同，--radius-* 不是模式相关的（base.css 一份，dark.css 无覆盖），
// 所以走 inline 单作用域即正确，无需运行时 <style> 双作用域块。
// 重置由 resetToDefault → applyThemeToDOM(clearInlineCustomProps + 重新注入 L0) 承担。

export const RADIUS_SCALE_KEYS = ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'] as const;
export type RadiusScaleKey = (typeof RADIUS_SCALE_KEYS)[number];
export type RadiusScale = Record<RadiusScaleKey, string>;

export const RADIUS_SCALE_META: { key: string; label: string; desc: string; lg: string }[] = [
  { key: 'sharp', label: '锐利', desc: '2–10px，接近直角', lg: '6px' },
  { key: 'standard', label: '标准', desc: '6–20px，默认', lg: '12px' },
  { key: 'rounded', label: '圆润', desc: '10–32px，柔和', lg: '20px' },
];

/** 三个方案的完整圆角档（standard 与 base.css L0 逐值一致） */
export const RADIUS_SCALES: Record<string, RadiusScale> = {
  sharp: { none: '0', sm: '2px', md: '4px', lg: '6px', xl: '8px', '2xl': '10px', full: '9999px' },
  standard: { none: '0', sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px', full: '9999px' },
  rounded: { none: '0', sm: '10px', md: '14px', lg: '20px', xl: '26px', '2xl': '32px', full: '9999px' },
};
