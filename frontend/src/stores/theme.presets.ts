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
    // T-B1：原为 Apple 绿 #34C759，与 base.css 的 --color-primary(#10b981) 分叉（D-2/D-3）
    main: '#10b981', // = base.css 的 --color-primary（规范 §13 权威）
    light: '#6ee7b7', // = --color-primary-300
    dark: '#047857', // = --color-primary-700
    contrastText: '#052e16', // 亮绿底（#10b981）配白字仅 2.23:1 → 必须用深字
  },
  secondary: {
    main: '#3b82f6', // T-B1：= --color-secondary（原 Apple 蓝 #007AFF）
    light: '#93c5fd', // Blue-300
    dark: '#1d4ed8', // Blue-700
    contrastText: '#ffffff', // (对比度达标 ✅)
  },
  tertiary: {
    main: '#8b5cf6', // T-B1：= --color-accent（原 Apple 紫 #AF52DE）
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
    link: '#047857', // T-B1：链接需 ≥4.5:1，改用 --color-primary-700（原 #34C759 在白色上仅 2.6:1）
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#9A9A9F',
  },
  border: {
    default: '#E5E7EB', // Slate-200
    focus: '#3b82f6', // T-B1：焦点环 = --color-secondary（原 Apple 蓝 #007AFF）
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
    elevated: '#1C1C1E', // Apple 标准暗色表面
    hover: '#2C2C2E', // Apple 浮起表面
    active: '#3A3A3C', // Apple 高亮表面
    disabled: '#1C1C1E', // (opacity 0.38)
  },
  surface: {
    default: '#1C1C1E', // Apple 标准暗色表面
    variant: '#2C2C2E', // Apple 浮起表面
    overlay: 'rgba(0, 0, 0, 0.7)', // 暗色模式稍强遮罩
  },
  text: {
    primary: '#F3F4F6', // Slate-100 (13.5:1 on slate-900 ✅✅ AAA) - 从#f8fafc调整以提升对比度
    secondary: '#D1D5DB', // Slate-300 (9.2:1 ✅✅ AAA)
    disabled: '#9CA3AF', // Slate-400 (5.4:1 ✅ AA) - 从#64748b提升，原值仅3.2:1不达标
    link: '#4ADE80', // Emerald-400 Forest Green 暗色模式亮色版
    textPrimary: '#F5F5F7',
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
      // 原实现给 success/error 选的是 Apple 绿 #34C759 与 Apple 红 #FF3B30 ——
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

export function mergeThemeOverrides(base: ThemeConfig, overrides: CustomThemeOverrides): ThemeConfig {
  return {
    ...base,
    ...(overrides.colors && { colors: { ...base.colors, ...overrides.colors } }),
    ...(overrides.typography && { typography: { ...base.typography, ...overrides.typography } }),
    ...(overrides.spacing && { spacing: { ...base.spacing, ...overrides.spacing } }),
    ...(overrides.borderRadius && { borderRadius: { ...base.borderRadius, ...overrides.borderRadius } }),
    ...(overrides.transitions && { transitions: { ...base.transitions, ...overrides.transitions } }),
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

  // 颜色变量
  Object.entries(theme.colors).forEach(([category, values]) => {
    if (typeof values === 'object' && !Array.isArray(values)) {
      Object.entries(values as Record<string, string>).forEach(([key, value]) => {
        const l0 = COLOR_MAIN_TO_L0[`${category}-${key}`];
        // T-B2a：命中映射时写 L0 名，否则维持原命名（待 T-B2b 收敛）
        vars[l0 ?? `--color-${category}-${key}`] = value;
      });
    }
  });

  // 排版变量
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    vars[`--font-${key}`] = value;
  });
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    vars[`--text-${key}`] = value;
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
    vars[`--duration-${key}`] = value;
  });
  Object.entries(theme.transitions.easing).forEach(([key, value]) => {
    // T-D5：原写 `--easing-${key}`，但全项目 0 处读 var(--easing-*)，
    // 而 51 处读 var(--ease-*)（L0 已定义 standard/spring/elegant）→ 改为对齐命名
    vars[`--ease-${key}`] = value;
  });

  // Z-index 变量
  Object.entries(theme.zIndex).forEach(([key, value]) => {
    vars[`--z-${key}`] = String(value);
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


