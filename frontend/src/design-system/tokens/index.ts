/**
 * RMFOOD Material Design 3 设计令牌系统
 *
 * 基于 Material Design 3 规范实现，包含：
 * - 颜色系统（Color System）
 * - 排版系统（Typography System）
 * - 间距系统（Spacing System）
 * - 圆角系统（Shape System）
 * - 高度系统（Elevation System）
 * - 动画系统（Motion System）
 * - 状态层系统（State Layer System）
 *
 * 所有令牌均符合 WCAG 2.1 AA 对比度要求
 */

export * from './color';
export * from './typography';
export * from './spacing';
export * from './shape';
export * from './elevation';
export * from './motion';
export * from './state';

// 完整主题配置类型
export interface ThemeTokens {
  color: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  shape: ShapeTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
  state: StateLayerTokens;
}

// 主题模式
export type ThemeMode = 'light' | 'dark';

// 主题预设
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  tokens: Partial<ThemeTokens>;
  isDefault?: boolean;
}

// 生成完整主题令牌
export function generateThemeTokens(
  baseTokens: ThemeTokens,
  overrides?: Partial<ThemeTokens>,
): ThemeTokens {
  return {
    color: { ...baseTokens.color, ...overrides?.color },
    typography: { ...baseTokens.typography, ...overrides?.typography },
    spacing: { ...baseTokens.spacing, ...overrides?.spacing },
    shape: { ...baseTokens.shape, ...overrides?.shape },
    elevation: { ...baseTokens.elevation, ...overrides?.elevation },
    motion: { ...baseTokens.motion, ...overrides?.motion },
    state: { ...baseTokens.state, ...overrides?.state },
  };
}
