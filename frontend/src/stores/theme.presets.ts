/**
 * RMFOOD 主题系统 - 预设主题配置
 * 符合 WCAG 2.1 AA/AAA 标准
 * 基于 UI/UX Pro Max 设计规范
 */
import { logger } from '@/utils/safeLogger';
import type {
  ThemeConfig,
  PresetThemeId,
  AccessibilityMode,
  SemanticColors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Transitions,
  Breakpoints,
  ZIndex,
  CustomThemeOverrides,
} from '../types/theme.types';

// ============================================================================
// 色彩常量定义（符合对比度标准）
// ============================================================================

/** Light 主题色彩 */
const lightColors: SemanticColors = {
  primary: {
    // T-B1：原为 Apple 绿 var(--color-primary-400)，与 base.css 的 --color-primary(#10b981) 分叉（D-2/D-3）
    main: '#10b981', // = base.css 的 --color-primary（规范 §13 权威）
    light: '#6ee7b7', // = --color-primary-300
    dark: '#047857', // = --color-primary-700
    contrastText: '#052e16', // 亮绿底（#10b981）配白字仅 2.23:1 → 必须用深字
  },
  secondary: {
    main: '#3b82f6', // T-B1：= --color-secondary（原 Apple 蓝 var(--color-secondary-500)）
    light: '#93c5fd', // Blue-300
    dark: '#1d4ed8', // Blue-700
    contrastText: '#ffffff', // (对比度达标 ✅)
  },
  tertiary: {
    main: '#8b5cf6', // T-B1：= --color-accent（原 Apple 紫 var(--color-accent-500)）
    light: '#c4b5fd',
    dark: '#6d28d9',
    contrastText: '#ffffff',
  },
  success: {
    main: '#16a34a', // Green-600
    background: '#f0fdf4', // Green-50
    text: '#065f46', // T-B1：= base.css 的 --color-success-text
  },
  warning: {
    main: '#ca8a04', // Yellow-600
    background: '#fefce8', // Yellow-50
    text: '#92400e', // T-B1：= --color-warning-text
  },
  error: {
    main: '#B91C1C', // Red-600
    background: '#FFF0F0', // Red-50
    text: '#991b1b', // T-B1：= --color-error-text
  },
  info: {
    main: '#0E7490', // Cyan-600
    background: '#E8FAFF', // Cyan-50
    text: '#1e40af', // T-B1：= --color-info-text
  },
  background: {
    default: '#ffffff',
    elevated: '#F9FAFB', // Slate-50
    hover: '#F3F4F6', // Slate-100
    active: '#E5E7EB', // Slate-200
    disabled: '#F3F4F6', // (opacity 0.38)
  },
  surface: {
    default: '#ffffff',
    variant: '#F9FAFB',
    overlay: 'rgba(0, 0, 0, 0.5)', // Modal scrim (40-60% opacity)
  },
  text: {
    primary: '#111827', // Slate-900 (15.2:1 on white ✅)
    secondary: '#4B5563', // Slate-600 (4.7:1 ✅)
    disabled: '#9CA3AF', // Slate-400
    link: '#047857', // T-B1：链接需 ≥4.5:1，改用 --color-primary-700（原 var(--color-primary-400) 在白色上仅 2.6:1）
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#9A9A9F',
  },
  border: {
    default: '#E5E7EB', // Slate-200
    focus: '#3b82f6', // T-B1：焦点环 = --color-secondary（原 Apple 蓝 var(--color-secondary-500)）
    divider: '#F3F4F6', // Slate-100
  },
  surfaceVariant: '#F3F4F6',
  errorContainer: '#FFE0E0',
  outline: '#D1D5DB',
  outlineVariant: '#E5E7EB',
};

/** Dark 主题色彩（去饱和/更浅色调变体，非简单反转 - WCAG 2.1 AA优化版） */
const darkColors: SemanticColors = {
  primary: {
    main: '#34d399', // T-B1：= dark.css 的 --color-primary
    light: '#6ee7b7', // T-B1：= --color-primary-300
    dark: '#047857', // T-B1：= --color-primary-700
    contrastText: '#052e16', // 亮绿底必须配深字（白字仅 2.2:1，见 §4.3 C-24）
  },
  secondary: {
    main: '#60a5fa', // T-B1：= dark.css 的 --color-secondary
    light: '#93c5fd', // Blue-300
    dark: '#3b82f6', // Blue-500
    contrastText: '#111827', // (对比度达标 ✅)
  },
  tertiary: {
    main: '#a78bfa', // T-B1：= dark.css 的 --color-accent
    light: '#c4b5fd',
    dark: '#8b5cf6',
    contrastText: '#3730a3',
  },
  success: {
    main: '#4ade80', // Green-400
    background: '#052e16', // Green-950
    text: '#6ee7b7', // T-B1：= dark.css 的 --color-success-text
  },
  warning: {
    main: '#facc15', // Yellow-400
    background: '#422006', // Yellow-950
    text: '#fcd34d', // T-B1：= --color-warning-text
  },
  error: {
    main: '#EF4444', // Red-400
    background: '#450a0a', // Red-950
    text: '#fca5a5', // T-B1：= --color-error-text
  },
  info: {
    main: '#67E8F9', // Cyan-400
    background: '#083344', // Cyan-950
    text: '#c7d2fe', // T-B1：= --color-info-text
  },
  background: {
    default: '#000000', // Apple OLED 纯黑
    elevated: 'var(--bg-surface-container)', // Apple 标准暗色表面
    hover: 'var(--bg-surface-raised)', // Apple 浮起表面
    active: 'var(--bg-surface-container-high)', // Apple 高亮表面
    disabled: 'var(--bg-surface-container)', // (opacity 0.38)
  },
  surface: {
    default: 'var(--bg-surface-container)', // Apple 标准暗色表面
    variant: 'var(--bg-surface-raised)', // Apple 浮起表面
    overlay: 'rgba(0, 0, 0, 0.7)', // 暗色模式稍强遮罩
  },
  text: {
    primary: '#F3F4F6', // Slate-100 (13.5:1 on slate-900 ✅✅ AAA) - 从#f8fafc调整以提升对比度
    secondary: '#D1D5DB', // Slate-300 (9.2:1 ✅✅ AAA)
    disabled: '#9CA3AF', // Slate-400 (5.4:1 ✅ AA) - 从#64748b提升，原值仅3.2:1不达标
    link: '#4ADE80', // Emerald-400 Forest Green 暗色模式亮色版
    textPrimary: 'var(--bg-canvas)',
    textSecondary: '#A1A1A6',
    textMuted: '#636366',
  },
  border: {
    default: '#4B5563', // Slate-600 (3.2:1 ✅ 达标) - 从#334155提升，原值仅2.1:1
    focus: '#6ECAFF', // Focus ring (5.2:1 ✅ AA)
    divider: '#374151', // Slate-800 (弱分隔线，可接受)
  },
  surfaceVariant: '#374151',
  errorContainer: '#7f1d1d',
  outline: '#6B7280',
  outlineVariant: '#4B5563',
};

// ============================================================================
// 排版系统配置
// ============================================================================

const typography: Typography = {
  fontFamily: {
    heading: "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif",
    body: "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif",
    // T-B1：与 base.css 的 --font-mono 逐字对齐（原缺 ui-monospace 回退）
    mono: "'JetBrains Mono', 'Fira Code', Consolas, ui-monospace, monospace",
  },
  fontSize: {
    // A3：正文族键名与 L0 令牌同名（经 toKebab 产出 --text-body / --text-body-sm /
    // --text-caption / --text-body-lg）。这四个是全站正文实际消费的令牌
    // （typography.css 的 .text-body/.text-caption 等类 + 199 处 var(--text-body*)），
    // 此前 preset 只有 xs/sm/base/lg 这套 Tailwind 键名，注入的是无 L0 定义、无消费者的孤儿令牌。
    body: '0.9375rem', // 15px — 正文基准（= base.css --text-body ⭐️）
    bodySm: '0.875rem', // 14px — 次级正文（= --text-body-sm）
    caption: '0.75rem', // 12px — 注释/说明（= --text-caption）
    bodyLg: '1rem', // 16px — 导语段（= --text-body-lg）
    overline: '0.75rem', // 12px — 标签/徽标（= --text-overline）
    tiny: '0.75rem', // 12px — 极小字（= --text-tiny）
    // 标题族（经 toKebab 产出 --text-h1..h6，与 base.css 逐值一致）
    h1: '2.25rem', // 36px — 页面标题
    h2: '1.75rem', // 28px — 区块标题
    h3: '1.5rem', // 24px — 子标题
    h4: '1.375rem', // 22px — 卡片标题
    h5: '1.125rem', // 18px
    h6: '1rem', // 16px
    // Tailwind 默认档：保留以兼容 text-xs / text-sm / text-base 等工具类
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px (移动端最小可读字体)
    lg: '1.125rem', // 18px
    // T-B1：xl~4xl 原为 Tailwind 默认档（24/32/40/48px），与 base.css 的
    // --text-xl..4xl（20/24/30/36px）不符，运行时注入会**覆盖项目自有排版比例**。
    xl: '1.25rem', // 20px ← 原 1.5rem
    '2xl': '1.5rem', // 24px ← 原 2rem
    '3xl': '1.875rem', // 30px ← 原 2.5rem
    '4xl': '2.25rem', // 36px ← 原 3rem
  },
  lineHeight: {
    tight: '1.25', // 标题
    normal: '1.5', // 正文 (1.5-1.75 标准)
    relaxed: '1.75', // 长文本阅读
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0em',
    wide: '0.05em',
  },
};

// ============================================================================
// 间距系统（4pt 基准）
// ============================================================================

const spacing: Spacing = {
  unit: 4,
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px (触摸目标最小间距)
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
  24: '6rem', // 96px
};

// ============================================================================
// 圆角、阴影、动效、断点
// ============================================================================

const borderRadius: BorderRadius = {
  none: '0',
  // T-B1：与 base.css 的 --radius-* 对齐（原为 Tailwind 默认档，
  // 其中 sm 会被注入为 4px，覆盖项目定义的 6px）
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
};

const shadows: Shadows = {
  flat: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
};

const transitions: Transitions = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    enter: '250ms',
    exit: '150ms', // 退出更快 (进入的 60-70%)
  },
  // T-D5：键名与 L0 的 --ease-* 对齐，使主题面板的缓动调节能真正命中 CSS 消费者
  // （全项目 51 处读 var(--ease-*)，此前 0 处读 var(--easing-*)）
  easing: {
    standard: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)', // = --ease-standard
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)', // = --ease-spring
    elegant: 'cubic-bezier(0.16, 1, 0.3, 1)', // = --ease-elegant
  },
  all: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  colors: 'color 200ms ease-out',
  transform: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  opacity: 'opacity 200ms ease-out',
  modal: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  dropdown: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  tooltip: 'opacity 150ms ease-out, transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
  button: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 100ms cubic-bezier(0.16, 1, 0.3, 1)',
  card: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const breakpoints: Breakpoints = {
  xs: '320px',
  sm: '375px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1440px',
  '3xl': '1920px',
};

const zIndex: ZIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 40,
  modalBackdrop: 50,
  modal: 100,
  popover: 110,
  // T-B1：与 base.css 的 --z-tooltip(1300) / --z-toast(1200) 对齐
  tooltip: 1300,
  toast: 1200,
  max: 9999,
};

// ============================================================================
// 预设主题生成函数
// ============================================================================

function createPresetTheme(
  id: PresetThemeId,
  name: string,
  mode: 'light' | 'dark',
  colors: SemanticColors,
  description?: string,
): ThemeConfig {
  return {
    id,
    name,
    description,
    mode: mode === 'dark' ? 'dark' : 'light',
    isPreset: true,
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
    transitions,
    breakpoints,
    zIndex,
  };
}

// ============================================================================
// 预设主题集合
// ============================================================================

export const presetThemes: Record<PresetThemeId, ThemeConfig> = {
  // ==================== Light ====================
  'light-default': createPresetTheme(
    'light-default',
    'Default Light',
    'light',
    { ...lightColors },
    'Clean and professional light theme with excellent readability',
  ),

  // ==================== Dark ====================
  'dark-default': createPresetTheme(
    'dark-default',
    'Default Dark',
    'dark',
    { ...darkColors },
    'Modern dark theme optimized for OLED screens and reduced eye strain',
  ),
};

// ============================================================================
// 辅助功能：获取默认主题
// ============================================================================

export function getDefaultTheme(): ThemeConfig {
  return presetThemes['light-default'];
}

// ============================================================================
// 辅助功能：应用辅助功能模式到基础主题
// ============================================================================

export function getAccessibilityTheme(baseTheme: ThemeConfig, mode: AccessibilityMode): ThemeConfig {
  switch (mode) {
    case 'high-contrast': {
      // 运行时派生高对比度变体（无需静态主题定义）
      const isDark = baseTheme.mode === 'dark';
      return {
        ...baseTheme,
        id: `high-contrast-${isDark ? 'dark' : 'light'}`,
        name: isDark ? '高对比度深色' : '高对比度浅色',
        isPreset: false,
        colors: {
          ...baseTheme.colors,
          text: isDark
            ? { primary: '#ffffff', secondary: '#f3f4f6', disabled: '#9ca3af', link: '#60a5ff', textPrimary: '#ffffff', textSecondary: '#f3f4f6', textMuted: '#9ca3af' }
            : { primary: '#000000', secondary: '#1f2937', disabled: '#6b7280', link: '#0000ee', textPrimary: '#000000', textSecondary: '#1f2937', textMuted: '#6b7280' },
          background: isDark
            ? { ...baseTheme.colors.background, default: '#000000', elevated: '#000000' }
            : { ...baseTheme.colors.background, default: '#ffffff', elevated: '#ffffff' },
          border: {
            ...baseTheme.colors.border,
            default: isDark ? '#ffffff' : '#000000',
            focus: isDark ? '#ffffff' : '#000000',
          },
        },
      };
    }

    case 'reading': {
      // 运行时派生阅读模式（Sepia 暖色调 / Dark Stone 色调）
      if (baseTheme.mode === 'dark') {
        return {
          ...baseTheme,
          id: 'reading-dark',
          name: '阅读暗色',
          isPreset: false,
          colors: {
            ...baseTheme.colors,
            primary: { main: '#B45309', light: '#D97706', dark: '#D97706', contrastText: '#000000' },
            background: { default: '#1c1917', elevated: '#292524', hover: '#44403c', active: '#57534e', disabled: '#292524' },
            surface: { default: '#292524', variant: '#44403c', overlay: 'rgba(0, 0, 0, 0.75)' },
            text: { primary: '#e7e5e4', secondary: '#a8a29e', disabled: '#78716c', link: '#F59E0B', textPrimary: '#e7e5e4', textSecondary: '#a8a29e', textMuted: '#78716c' },
            border: { default: '#44403c', focus: '#B45309', divider: '#292524' },
          },
        };
      }
      return {
        ...baseTheme,
        id: 'reading-sepia',
        name: '阅读琥珀色',
        isPreset: false,
        colors: {
          ...baseTheme.colors,
          primary: { main: '#D97706', light: '#D97706', dark: '#78350f', contrastText: '#ffffff' },
          background: { default: '#fdf6e3', elevated: '#FFF3CD', hover: '#FEF3C7', active: '#FFB340', disabled: '#FFF3CD' },
          surface: { default: '#FFF3CD', variant: '#FEF3C7', overlay: 'rgba(0, 0, 0, 0.5)' },
          text: { primary: '#5b4636', secondary: '#78716c', disabled: '#a8a29e', link: '#D97706', textPrimary: '#5b4636', textSecondary: '#78716c', textMuted: '#a8a29e' },
          border: { default: '#d6d3d1', focus: '#D97706', divider: '#e7e5e4' },
        },
      };
    }

    case 'color-blind':
      // T-W2（D-32）：改用 **Okabe-Ito 色盲安全色板**。
      // 原实现给 success/error 选的是 Apple 绿 var(--color-primary-400) 与 Apple 红 #FF3B30 ——
      // 正是红绿色盲（deuteranopia/protanopia）下最难区分的一对，与「色盲友好」
      // 目标相反。Okabe-Ito 各色主要依靠**明度差**而非色相差区分。
      // 与此处对应，semantic-utils.css 中 [data-a11y-mode="color-blind"]
      // 也设置了同色板的 --color-success / --color-error / --color-warning / --color-info。
      return {
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          success: {
            main: baseTheme.mode === 'dark' ? '#56B4E9' : '#009E73', // sky blue / bluish green
            background: baseTheme.mode === 'dark' ? '#04384A' : '#E3F5F0',
            text: baseTheme.mode === 'dark' ? '#A5E3F5' : '#00543D',
          },
          error: {
            main: '#D55E00', // vermillion（与绿色在明度上差异显著）
            background: baseTheme.mode === 'dark' ? '#5C2A00' : '#FBEADF',
            text: baseTheme.mode === 'dark' ? '#FFB380' : '#7A3600',
          },
          warning: {
            main: baseTheme.mode === 'dark' ? '#F0E442' : '#E69F00', // yellow / orange
            background: baseTheme.mode === 'dark' ? '#4A4508' : '#FCF3DC',
            text: baseTheme.mode === 'dark' ? '#F7F0A0' : '#6B4A00',
          },
          info: {
            main: '#0072B2', // blue
            background: baseTheme.mode === 'dark' ? '#02304A' : '#E1F0F8',
            text: baseTheme.mode === 'dark' ? '#8FCFEE' : '#004E7A',
          },
        },
      };

    default:
      return baseTheme;
  }
}

// ============================================================================
// 辅助功能：合并自定义主题覆盖
// ============================================================================

// L1 修复（执行方案阶段 A1）：`colors` / `typography` 里存在「对象套对象」的角色
// （primary/secondary/background/...），原先的浅合并（{ ...base.colors, ...overrides.colors }）
// 会用 override 整体替换同名角色 —— 覆盖 colors.primary 时连带丢掉 primary.main，而
// --color-primary 正是 chartTheme.ts 与 11 处 L1 消费者依赖的唯一令牌。
//
// 注意 SemanticColors 同时含**标量别名**（surfaceVariant / errorContainer / outline /
// outlineVariant，声明为 string）。因此这里必须形状感知：对象对对象才做属性级合并，
// 任一为标量则直接取 override（或保留 base）—— 绝不可对字符串做 spread，
// 那会把 '#F3F4F6' 展开成 {0:'#', 1:'F', ...}。
function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// SemanticColors / Typography 是 interface（无字符串索引签名），故 T 只约束为 object，
// 内部用 Record<string, unknown> 视图做键遍历。
function mergeNested<T extends object>(base: T, overrides: Partial<T>): T {
  const b = base as Record<string, unknown>;
  const o = overrides as Record<string, unknown>;
  const result = {} as Record<string, unknown>;
  for (const k of new Set<string>([...Object.keys(b), ...Object.keys(o)])) {
    const baseV = b[k];
    const oV = o[k];
    result[k] = isPlainRecord(baseV) && isPlainRecord(oV)
      ? { ...baseV, ...oV }
      : oV !== undefined
        ? oV
        : baseV;
  }
  return result as T;
}

export function mergeThemeOverrides(base: ThemeConfig, overrides: CustomThemeOverrides): ThemeConfig {
  return {
    ...base,
    ...(overrides.colors && { colors: mergeNested<SemanticColors>(base.colors, overrides.colors) }),
    ...(overrides.typography && { typography: mergeNested<Typography>(base.typography, overrides.typography) }),
    ...(overrides.spacing && { spacing: { ...base.spacing, ...overrides.spacing } }),
    ...(overrides.borderRadius && { borderRadius: { ...base.borderRadius, ...overrides.borderRadius } }),
    ...(overrides.transitions && { transitions: { ...base.transitions, ...overrides.transitions } }),
    // C1：模式反转色阶按作用域分别合并 —— primary 与 primaryDark 是两组独立值，
    // 缺省的一组保留底层预设的值（内置预设无 modeRamps，故实际就是 override 值）。
    ...(overrides.modeRamps && {
      modeRamps: {
        ...base.modeRamps,
        ...overrides.modeRamps,
      },
    }),
  };
}

// ============================================================================
// 辅助功能：生成 CSS 变量
// ============================================================================

/**
 * T-B2a / T-B2b：颜色角色 → L0 令牌名的映射。
 *
 * 原实现一律生成 `--color-<组>-<键>`（如 `--color-success-main`），而**所有 CSS
 * 消费者读的是 L0 名**（`--color-primary`、`--color-secondary`、`--color-accent`、
 * `--color-success`、`--color-error`、`--color-warning`、`--color-info` 及其
 * `-container` / `-text` 容器/文字令牌）。
 * 后果：自定义主题 / 无障碍变体 / 文件导入**完全无法改变这些颜色** ——
 * 实测把 `colors.primary.main` 设为 `#ff0000` 后，
 * `--color-primary-main` 变为 `#ff0000`，而组件实际读取的 `--color-primary`
 * 仍是 `#10b981`（D-2/D-3 的最终形态，也是 D-36「导入无效果」的深层原因）。
 *
 * T-B2a 已映射 primary/secondary/tertiary 三个品牌角色。
 * **T-B2b 补全 success/error/warning/info 四个语义角色**（含 background→-container、
 * text→-text），使无障碍变体与自定义主题的语义色能真正驱动 L0 令牌。
 *
 * 映射前提（T-B1 对齐）：内置预设的这三个品牌角色取值已与 L0 **完全相等**，
 * 因此改名对内置预设是零视觉变化，仅让自定义主题真正生效。
 *
 * 对比度裁决说明：
 *   四个语义角色的预设 `main` 值有意不同于 §13 的权威色
 *   （如 error `#B91C1C` 配白字 6.4:1，而权威 `#ef4444` 仅 3.76:1）。
 *   映射到 L0 名后，**内置预设**因值与 L0 完全相等，映射无视觉影响；
 *   **无障碍变体**（T-W2 已改用 Okabe-Ito 色盲安全色板）会注入与 L0 不同的值，
 *   差异正是期望行为 —— GATE-05/GATE-11 负责拦截对比度倒退。
 */
const COLOR_MAIN_TO_L0: Record<string, string> = {
  // T-B2a：三个品牌角色
  'primary-main': '--color-primary',
  'secondary-main': '--color-secondary',
  'tertiary-main': '--color-accent',
  // T-B2b：四个语义角色（main → L0 主色，background → -container，text → -text）
  'success-main': '--color-success',
  'success-background': '--color-success-container',
  'success-text': '--color-success-text',
  'error-main': '--color-error',
  'error-background': '--color-error-container',
  'error-text': '--color-error-text',
  'warning-main': '--color-warning',
  'warning-background': '--color-warning-container',
  'warning-text': '--color-warning-text',
  'info-main': '--color-info',
  'info-background': '--color-info-container',
  'info-text': '--color-info-text',
};

export function generateCSSVariables(theme: ThemeConfig): Record<string, string> {
  // 防御性检查：如果theme或theme.colors不存在，返回空对象
  if (!theme?.colors) {
    logger.warn('[Theme System] ⚠️ generateCSSVariables 收到无效的主题配置');
    return {};
  }

  const vars: Record<string, string> = {};
  // D-53：驼峰键名 → kebab-case（T1 要求令牌名全小写 kebab；SAFE_TOKEN_NAME 白名单只放行
  // kebab，故生成器必须规范化键名，否则这些维度被静默拒绝、无法自定义）。
  const toKebab = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  // C1：模式反转色阶改由运行时 `<style>` 双作用域块提供（见 generateModeRampCSS）。
  // 若 inline 也写 `--color-primary-<档>`，会同时压过 `:root` 与 `.dark`，
  // 使暗色模式错用亮色 ramp —— 故把落在 modeRamps 覆盖范围内的档位令牌让位出去。
  const rampTokens = new Set<string>(
    Object.keys(theme.modeRamps?.primary ?? {}).map((k) => `--color-primary-${k}`),
  );

  // 颜色变量
  Object.entries(theme.colors).forEach(([category, values]) => {
    if (typeof values === 'object' && !Array.isArray(values)) {
      Object.entries(values as Record<string, string>).forEach(([key, value]) => {
        const l0 = COLOR_MAIN_TO_L0[`${category}-${key}`];
        // T-B2a/T-B2b：命中映射时写 L0 名；否则 kebab 化（D-53）后写。
        // D-54：category 名同样必须 kebab 化 —— presetThemes 里有 surfaceVariant /
        // errorContainer / outlineVariant 这类驼峰角色名，原实现产出
        // --color-surfaceVariant-0 这类含大写的名字，在 applyThemeToDOM 的 isSafeToken
        // 校验处被整批拒收（一次主题应用打 21 条 warn）。映射表查找仍用原始名，
        // 命中 COLOR_MAIN_TO_L0 的行为完全不变。
        const kebabKey = toKebab(key);
        const kebabCategory = toKebab(category);
        const name = l0 ?? `--color-${kebabCategory}-${kebabKey}`;
        if (rampTokens.has(name)) return;
        vars[name] = value;
      });
    }
  });

  // 排版变量
  // A3 修复（执行方案阶段 A3）：键名必须 kebab 化。L0 的正文令牌是 --text-body-sm /
  // --text-body-lg 这类带连字符的名字，而 ThemeConfig 的 fontSize 键是 bodySm / bodyLg。
  // 原实现直接拼 `--text-${key}` 会产出 --text-bodySm —— SAFE_TOKEN_NAME（只放行全小写
  // kebab）在 :723 拒收，字号运行时覆盖因此静默失效。复用下方 toKebab 保持与 T-D5 同源。
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    vars[`--font-${toKebab(key)}`] = value;
  });
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    vars[`--text-${toKebab(key)}`] = value;
  });
  // T-D5：不再导出 --weight-*。
  // 实测全项目 var(--weight-*) 消费者 = 0；L0 的字重令牌命名为
  // --text-<级别>-font-weight（base.css 已定义），此前导出的 --weight-regular
  // 等名字没有任何消费者，纯属无效注入。
  // 若将来需要面板调节字重，应导出 --text-<级别>-font-weight。

  // 间距变量
  Object.entries(theme.spacing).forEach(([key, value]) => {
    if (key !== 'unit') {
      vars[`--space-${key}`] = value;
    }
  });

  // 圆角变量
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    vars[`--radius-${key}`] = value;
  });

  // T-B1：不再注入 --shadow-*。
  // 原因：L0 的 --shadow-* 是**模式相关**的（亮色 alpha .06/.06/.12/.14 ，
  // 暗色 .3/.3/.4/.45），而 preset 的 shadows 是单一对象、无法表达两个模式，
  // 原先会把**亮色阴影注入到暗色模式**，使暗色阴影过弱（51 处消费者受影响）。
  // base.css / dark.css 已各自正确定义，注入纯属破坏。
  // 待 T-B2b 统一处理所有冗余注入时一并重构数据模型。

  // 动画变量
  Object.entries(theme.transitions.duration).forEach(([key, value]) => {
    vars[`--duration-${toKebab(key)}`] = value;
  });
  Object.entries(theme.transitions.easing).forEach(([key, value]) => {
    // T-D5：原写 `--easing-${key}`，但全项目 0 处读 var(--easing-*)，
    // 而 51 处读 var(--ease-*)（L0 已定义 standard/spring/elegant）→ 改为对齐命名
    // D-53：键名 kebab 化（如 easeIn → ease-in），通过 SAFE_TOKEN_NAME 白名单
    vars[`--ease-${toKebab(key)}`] = value;
  });

  // Z-index 变量
  // D-53：键名 kebab 化（modalBackdrop → modal-backdrop），与 L0 的 --z-modal-backdrop 匹配
  Object.entries(theme.zIndex).forEach(([key, value]) => {
    vars[`--z-${toKebab(key)}`] = String(value);
  });

  return vars;
}

// ============================================================================
// 安全校验：令牌名与令牌值的白名单
// ----------------------------------------------------------------------------
// 主题可经三条不可信路径进入：JSON 导入 / 文件上传 / URL 分享。
// 原实现把这些值拼成字符串写入 root.style.cssText，攻击者只需在 value 中放入
// ';' 即可越界注入任意 CSS 声明到 <html>（D-33）。
// 现改为逐属性 setProperty + 严格白名单，使 value 永远无法逃逸出声明值位置。
// ============================================================================

/** 合法令牌名：仅小写 kebab-case 的自定义属性（符合规范 T1）。
 *  注意：camelCase 名（如 `--z-modalBackdrop`）会被拒绝 —— 这既是安全边界，
 *  也暴露了 generateCSSVariables 输出违反 T1 的既有缺陷（见规范 D-53）。 */
const SAFE_TOKEN_NAME = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 危险构造：会逃逸出声明上下文、或引入外部资源 / 脚本。
 *  采用「结构性拒绝」而非「值形状白名单」—— 后者会误杀阴影、字体栈、
 *  cubic-bezier 等复合值，导致主题自定义静默失效（见规范 D-54）。 */
const UNSAFE_TOKEN_VALUE =
  /[;{}<>\\]|url\s*\(|expression\s*\(|@import|javascript:|[\r\n]/i;

/** 校验单个令牌，返回是否可安全写入 */
export function isSafeToken(name: string, value: string): boolean {
  if (typeof name !== 'string' || typeof value !== 'string') return false;
  if (!SAFE_TOKEN_NAME.test(name)) return false;
  const v = value.trim();
  if (v.length === 0 || v.length > 300) return false;
  return !UNSAFE_TOKEN_VALUE.test(v);
}

// ============================================================================
// 辅助功能：将主题应用到 DOM
// ============================================================================

/**
 * T-B2b Step 2：判定一个 ThemeConfig 是否为「内置预设且未被无障碍变体修改过」的纯净预设。
 *
 * 背景：`base.css` + `dark.css` + `.dark` 类已完整实现亮/暗切换，
 * 内置预设（light-default / dark-default）的颜色/排版/间距/缓动等取值
 * 与 L0 令牌完全相等（T-B1 对齐的结果），因此对这些预设做内联注入
 * 是**纯冗余**（原实测 `<html>` 有 86+ 个内联自定义属性，无视觉增量）。
 *
 * 判定规则（保守，误判方向安全）：
 *  1. `theme.id` 必须是内置预设 id（`presetThemes` 的键）；且
 *  2. `theme.colors` 必须与 `presetThemes[theme.id].colors` 完全相等
 *     （无障碍变体经 `getAccessibilityTheme` 修改了 success/error/warning/info，
 *      不相等 → 判定为「非纯净」→ 仍注入，语义色差异才生效）。
 *
 * 满足两者 → 内置纯净预设 → `applyThemeToDOM` 跳过 setProperty 注入。
 * 否则（自定义主题 / 导入主题 / 无障碍变体）→ 正常注入。
 */
export function isCleanBuiltinPreset(theme: ThemeConfig): boolean {
  if (!theme?.id || !(theme.id in presetThemes)) return false;
  const builtin = presetThemes[theme.id as PresetThemeId];
  if (!builtin?.colors || !theme.colors) return false;
  // 深度比较 colors（键集与值都须相等；无障碍变体会改 success/error/warning/info）
  const a = Object.keys(builtin.colors).sort();
  const b = Object.keys(theme.colors).sort();
  if (a.join(',') !== b.join(',')) return false;
  for (const k of a) {
    const bv = builtin.colors[k as keyof SemanticColors];
    const tv = theme.colors[k as keyof SemanticColors];
    if (typeof bv === 'string' || typeof tv === 'string') {
      if (String(bv) !== String(tv)) return false;
    } else if (bv && tv && typeof bv === 'object' && typeof tv === 'object') {
      if (JSON.stringify(bv) !== JSON.stringify(tv)) return false;
    } else if (bv !== tv) {
      return false;
    }
  }
  return true;
}

/** 清除 `<html>` 上所有 `--` 内联自定义属性（从自定义/无障碍态切回内置预设时避免残留） */
function clearInlineCustomProps(): void {
  const root = document.documentElement;
  const names = new Set<string>();
  for (const seg of root.style.cssText.split(';')) {
    const nm = seg.split(':')[0]?.trim();
    if (nm?.startsWith('--')) names.add(nm);
  }
  for (const nm of names) root.style.removeProperty(nm);
}

// ============================================================================
// C1：模式反转色阶的运行时双作用域样式表
// ----------------------------------------------------------------------------
// 为什么不能沿用 inline setProperty：base.css 的 `--color-primary-<档>` 定义在
// `:root`，dark.css 的同名令牌定义在 `.dark`（dark.css:7）。inline 自定义属性的
// 优先级高于任何非 !important 选择器，因此在 <html> 上 setProperty 会**同时压过**
// `:root` 与 `.dark` —— 选完配色后切到暗色模式，暗色画布上显示的仍是亮色 ramp。
// 这正是一次实测复现的「断裂梯度」：500/600/700 被换成品牌新色，而 100-400 与
// 800-950 依旧是 L0 品牌绿（暗色下是浅绿），中间换色 + 两头不变 = 梯度断裂，
// 且暗色下 800-950 的浅色档若配白字即对比度崩塌。
//
// 唯一正确写法：把两组值一并写进运行时 <style> 的 `:root` / `.dark` 块。
// 该 <style> 由 applyThemeToDOM 统一写入/清除，仍是「applyCustomTheme →
// mergeThemeOverrides → generateCSSVariables → applyThemeToDOM」单通道。
// ============================================================================

const RUNTIME_THEME_STYLE_ID = 'rmfood-runtime-theme';

/** 档位键：纯数字（50 / 100..950），用于识别 L0 静态色阶令牌 */
const TIER_KEY = /^\d{2,3}$/;

/**
 * 生成模式反转色阶的双作用域 CSS 文本。
 * 无覆盖时返回空串（applyRuntimeThemeStyle 会移除样式元素，回到 L0 基线）。
 */
export function generateModeRampCSS(theme: ThemeConfig): string {
  const ramps = theme?.modeRamps;
  if (!ramps || (!ramps.primary && !ramps.primaryDark)) return '';

  const renderBlock = (
    sel: string,
    values: Record<string, string> | undefined,
  ): string => {
    if (!values) return '';
    const decls: string[] = [];
    for (const [k, v] of Object.entries(values)) {
      if (!TIER_KEY.test(k)) continue; // 只处理档位键，其余由 generateCSSVariables 负责
      const name = `--color-primary-${k}`;
      // 复用同一套安全校验：值不允许逃逸声明位置（与 inline 通道一致的安全边界）
      if (!isSafeToken(name, v)) {
        logger.warn('[Theme System] 拒绝不安全的色阶令牌值', { name, value: String(v).slice(0, 60) });
        continue;
      }
      decls.push(`  ${name}: ${v};`);
    }
    if (!decls.length) return '';
    return `${sel} {\n${decls.join('\n')}\n}`;
  };

  const blocks = [renderBlock(':root', ramps.primary), renderBlock('.dark', ramps.primaryDark)]
    .filter(Boolean);
  if (!blocks.length) return '';
  return `/* RMFOOD runtime theme ramp (${theme.id}) */\n${blocks.join('\n')}\n`;
}

/**
 * 写入（或清空）运行时色阶样式表。
 *
 * 插入位置：置于 `document.head` 的 `@theme` 编译产物之后（作为最后一个 <style>
 * 追加），使其优先级不高于内联样式、且覆盖 L0 的 `:root` / `.dark` 定义。
 */
export function applyRuntimeThemeStyle(css: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(RUNTIME_THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    el?.remove();
    return;
  }
  if (!el) {
    const style = document.createElement('style');
    style.id = RUNTIME_THEME_STYLE_ID;
    document.head.appendChild(style);
    style.textContent = css;
    return;
  }
  el.textContent = css;
}

export function applyThemeToDOM(theme: ThemeConfig): void {
  // 防御性检查：如果theme无效，不执行任何操作
  if (!theme?.colors) {
    logger.warn('[Theme System] ⚠️ applyThemeToDOM 收到无效的主题配置，跳过应用');
    return;
  }

  const root = document.documentElement;

  // T-B2b Step 2：内置纯净预设不注入令牌 —— base.css/dark.css/.dark 已完整提供
  // 全部 L0 令牌，内联注入纯属冗余。仅「自定义主题 / 导入主题 / 无障碍变体」
  // 需要注入差异部分。两条路径都先清旧，保证「切到内置预设时 <html> 内联自定义属性 = 0」。
  const skipInjection = isCleanBuiltinPreset(theme);
  if (skipInjection) {
    clearInlineCustomProps();
    // C1：运行时色阶样式表与内联属性同生命周期 —— 切回内置预设时一并清除，
    // 保证「内置预设下 <html> 内联自定义属性 = 0 且无残留运行时 <style>」。
    applyRuntimeThemeStyle('');
  } else {
    const cssVars = generateCSSVariables(theme);
    clearInlineCustomProps();
    // D-33 / D-5 修复：
    //  · 原先用 `root.style.cssText += \`${name}: ${value};\`` 拼接写入 —— 既是 CSS 注入向量，
    //    也会整体重置 <html> 的 style 属性并强制全量重解析。
    //  · 现改为逐属性 setProperty：幂等覆盖、无字符串拼接、值无法逃逸声明位置。
    let rejected = 0;
    for (const [name, value] of Object.entries(cssVars)) {
      if (!isSafeToken(name, value)) {
        rejected++;
        logger.warn('[Theme System] 拒绝不安全的令牌值', { name, value: String(value).slice(0, 60) });
        continue;
      }
      root.style.setProperty(name, value);
    }
    if (rejected > 0) {
      logger.warn(`[Theme System] 共拒绝 ${rejected} 个不安全的令牌值（已跳过，未写入 DOM）`);
    }
    // C1：模式反转色阶走运行时双作用域样式表（inline 无法区分明暗，见上方说明）
    applyRuntimeThemeStyle(generateModeRampCSS(theme));
  }

  // 设置 data 属性用于 CSS 选择器
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);

  // 统一使用 .dark class 作为暗色模式选择器（Tailwind dark: 变体依赖它）
  root.classList.toggle('dark', theme.mode === 'dark');

  // 设置颜色方案（影响浏览器原生 UI）
  root.style.colorScheme = theme.mode === 'dark' ? 'dark' : 'light';

  // 注意：无障碍属性（data-a11y-mode / data-reading-mode）现由 themeStore 的
  // syncA11yAttributes() 在【初始化】与【交互切换】两条路径统一负责（D-39 修复）。
  // 此处不再重复维护，避免两处写入漂移。

  logger.info(
    `🎨 [Theme System] Applied theme: ${theme.name} (${theme.mode})` +
    (skipInjection ? '（内置纯净预设，跳过内联注入 T-B2b）' : ''),
  );
}


