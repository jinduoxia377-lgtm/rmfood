/**
 * Material Design 3 主题管理器
 *
 * 负责管理主题状态、切换主题、应用主题到 DOM
 */

import type { ThemeTokens, ThemeMode, ThemePreset } from './tokens';
import { generateThemeTokens } from './tokens';
import {
  LIGHT_COLOR_TOKENS,
  DARK_COLOR_TOKENS,
  generateColorVariants,
  getContrastRatio,
  meetsWCAGAA,
} from './tokens/color';
import { DEFAULT_TYPOGRAPHY_TOKENS } from './tokens/typography';
import { DEFAULT_SPACING_TOKENS } from './tokens/spacing';
import { DEFAULT_SHAPE_TOKENS } from './tokens/shape';
import { LIGHT_ELEVATION_TOKENS, DARK_ELEVATION_TOKENS } from './tokens/elevation';
import { DEFAULT_MOTION_TOKENS } from './tokens/motion';
import { DEFAULT_STATE_LAYER_TOKENS } from './tokens/state';

// 主题存储键
const STORAGE_KEY = 'rmfood-theme-settings-v3';

// 接口定义
export interface ThemeSettings {
  mode: ThemeMode;
  presetId: string;
  customTokens?: Partial<ThemeTokens>;
  autoMode?: boolean;
}

// 默认主题设置
const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'light',
  presetId: 'default',
  autoMode: false,
};

// 预设主题列表
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: '标准主题',
    description: 'RMFOOD 默认主题，平衡的视觉设计',
    tokens: {},
    isDefault: true,
  },
  {
    id: 'professional-green',
    name: '专业绿',
    description: '自然、健康、专业的配色方案，符合医药健康行业标准',
    tokens: {
      color: {
        primary: {
          main: '#059669',
          on: '#ffffff',
          container: '#d1fae5',
          onContainer: '#065f46',
          light: '#6ee7b7',
          dark: '#047857',
          hover: '#047857',
        },
        secondary: {
          main: '#0891B2',
          on: '#ffffff',
          container: '#e0f2fe',
          onContainer: '#155e75',
        },
      },
    },
  },
  {
    id: 'medical-blue',
    name: '医疗蓝',
    description: '专业、信任、安全感的蓝色系配色',
    tokens: {
      color: {
        primary: {
          main: '#2563EB',
          on: '#ffffff',
          container: '#dbeafe',
          onContainer: '#1e40af',
        },
        secondary: {
          main: '#0891B2',
          on: '#ffffff',
          container: '#e0f2fe',
          onContainer: '#155e75',
        },
      },
    },
  },
  {
    id: 'warm-orange',
    name: '温暖橙',
    description: '温暖、活力、创新的配色方案',
    tokens: {
      color: {
        primary: {
          main: '#ea580c',
          on: '#ffffff',
          container: '#ffedd5',
          onContainer: '#7c2d12',
        },
        secondary: {
          main: '#dc2626',
          on: '#ffffff',
          container: '#fee2e2',
          onContainer: '#7f1d1d',
        },
      },
    },
  },
  {
    id: 'high-contrast',
    name: '高对比度',
    description: '专为视觉障碍设计，高对比度配色',
    tokens: {
      color: {
        primary: {
          main: '#000000',
          on: '#ffffff',
          container: '#e5e5e5',
          onContainer: '#000000',
        },
        text: {
          primary: '#000000',
          secondary: '#333333',
        },
      },
      typography: {
        fontSize: {
          bodyMd: '0.9375rem', // 15px
          bodyLg: '1.0625rem', // 17px
        },
      },
    },
  },
  {
    id: 'minimal',
    name: '极简主题',
    description: '简洁清爽，减少视觉干扰',
    tokens: {
      color: {
        primary: {
          main: '#374151',
          on: '#ffffff',
          container: '#e5e7eb',
          onContainer: '#374151',
        },
        secondary: {
          main: '#6B7280',
          container: '#f3f4f6',
        },
      },
      shape: {
        md: '0.375rem', // 6px
      },
    },
  },
  {
    id: 'google-light',
    name: 'Google 浅色',
    description: '符合Google Light Color Scheme的专业配色方案',
    tokens: {
      color: {
        primary: {
          main: '#4285F4',
          on: '#FFFFFF',
          container: '#E8F0FE',
          onContainer: '#1A3A78',
        },
        secondary: {
          main: '#34A853',
          on: '#FFFFFF',
          container: '#E6F4EA',
          onContainer: '#1B3421',
        },
        tertiary: {
          main: '#FBBC04',
          on: '#FFFFFF',
          container: '#FFF8E1',
          onContainer: '#3D2C00',
        },
        error: {
          main: '#EA4335',
          on: '#FFFFFF',
          container: '#FCE8E6',
          onContainer: '#991b1b',
        },
      },
    },
  },
];

// 主题管理器类
export class ThemeManager {
  private currentMode: ThemeMode;
  private currentPreset: ThemePreset;
  private customTokens: Partial<ThemeTokens> | undefined;
  private onThemeChange?: () => void;

  constructor() {
    const savedSettings = this.loadSettings();
    this.currentMode = savedSettings.mode;
    this.currentPreset = THEME_PRESETS.find((p) => p.id === savedSettings.presetId) || THEME_PRESETS[0];
    this.customTokens = savedSettings.customTokens;
  }

  /**
   * 加载保存的主题设置
   */
  private loadSettings(): ThemeSettings {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load theme settings:', e);
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * 保存主题设置
   */
  private saveSettings(): void {
    try {
      const settings: ThemeSettings = {
        mode: this.currentMode,
        presetId: this.currentPreset.id,
        customTokens: this.customTokens,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save theme settings:', e);
    }
  }

  /**
   * 获取当前主题令牌
   */
  getCurrentTokens(): ThemeTokens {
    const baseTokens: ThemeTokens = {
      color: this.currentMode === 'dark' ? DARK_COLOR_TOKENS : LIGHT_COLOR_TOKENS,
      typography: DEFAULT_TYPOGRAPHY_TOKENS,
      spacing: DEFAULT_SPACING_TOKENS,
      shape: DEFAULT_SHAPE_TOKENS,
      elevation: this.currentMode === 'dark' ? DARK_ELEVATION_TOKENS : LIGHT_ELEVATION_TOKENS,
      motion: DEFAULT_MOTION_TOKENS,
      state: DEFAULT_STATE_LAYER_TOKENS,
    };

    // 应用预设令牌
    const presetTokens = generateThemeTokens(baseTokens, this.currentPreset.tokens);

    // 应用自定义令牌
    return generateThemeTokens(presetTokens, this.customTokens);
  }

  /**
   * 设置主题模式
   */
  setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    this.saveSettings();
    this.applyTheme();
    this.notifyChange();
  }

  /**
   * 设置主题预设
   */
  setPreset(presetId: string): void {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      this.currentPreset = preset;
      this.saveSettings();
      this.applyTheme();
      this.notifyChange();
    }
  }

  /**
   * 设置自定义令牌
   */
  setCustomTokens(tokens: Partial<ThemeTokens>): void {
    this.customTokens = tokens;
    this.saveSettings();
    this.applyTheme();
    this.notifyChange();
  }

  /**
   * 应用主题到 DOM
   */
  applyTheme(): void {
    const root = document.documentElement;
    const tokens = this.getCurrentTokens();

    // 设置模式属性
    root.setAttribute('data-theme', this.currentMode);
    root.setAttribute('data-mode', this.currentMode);

    // 应用颜色变量
    this.applyColorVariables(root, tokens.color);

    // 应用排版变量
    this.applyTypographyVariables(root, tokens.typography);

    // 应用间距变量
    this.applySpacingVariables(root, tokens.spacing);

    // 应用圆角变量
    this.applyShapeVariables(root, tokens.shape);

    // 应用高度变量
    this.applyElevationVariables(root, tokens.elevation);

    // 应用动画变量
    this.applyMotionVariables(root, tokens.motion);

    // 应用状态层变量
    this.applyStateVariables(root, tokens.state);
  }

  /**
   * 应用颜色变量
   */
  private applyColorVariables(root: HTMLElement, colorTokens: ThemeTokens['color']): void {
    // 主色调
    root.style.setProperty('--color-primary', colorTokens.primary.main);
    root.style.setProperty('--color-primary-on', colorTokens.primary.on);
    root.style.setProperty('--color-primary-container', colorTokens.primary.container);
    root.style.setProperty('--color-on-primary-container', colorTokens.primary.onContainer);

    // 辅助色调
    root.style.setProperty('--color-secondary', colorTokens.secondary.main);
    root.style.setProperty('--color-secondary-on', colorTokens.secondary.on);
    root.style.setProperty('--color-secondary-container', colorTokens.secondary.container);
    root.style.setProperty('--color-on-secondary-container', colorTokens.secondary.onContainer);

    // 第三色调
    root.style.setProperty('--color-tertiary', colorTokens.tertiary.main);
    root.style.setProperty('--color-tertiary-on', colorTokens.tertiary.on);

    // 背景和表面
    root.style.setProperty('--color-background', colorTokens.background.default);
    root.style.setProperty('--color-surface', colorTokens.surface.default);
    root.style.setProperty('--color-surface-variant', colorTokens.surface.variant);

    // 文本颜色
    root.style.setProperty('--color-text-primary', colorTokens.text.primary);
    root.style.setProperty('--color-text-secondary', colorTokens.text.secondary);
    root.style.setProperty('--color-text-tertiary', colorTokens.text.tertiary);
    root.style.setProperty('--color-text-disabled', colorTokens.text.disabled);

    // 边框颜色
    root.style.setProperty('--color-border', colorTokens.border.default);
    root.style.setProperty('--color-border-variant', colorTokens.border.variant);

    // 功能色
    root.style.setProperty('--color-error', colorTokens.error.main);
    root.style.setProperty('--color-success', colorTokens.success.main);
    root.style.setProperty('--color-warning', colorTokens.warning.main);
    root.style.setProperty('--color-info', colorTokens.info.main);

    // 反色系统
    root.style.setProperty('--color-inverse-surface', colorTokens.inverse.surface);
    root.style.setProperty('--color-inverse-on-surface', colorTokens.inverse.onSurface);
    root.style.setProperty('--color-inverse-primary', colorTokens.inverse.primary);

    // 表面着色
    root.style.setProperty('--color-surface-tint', colorTokens.surfaceTint);
  }

  /**
   * 应用排版变量
   */
  private applyTypographyVariables(root: HTMLElement, typographyTokens: ThemeTokens['typography']): void {
    // 字体家族
    root.style.setProperty('--font-family-sans', typographyTokens.fontFamily.sans);
    root.style.setProperty('--font-family-serif', typographyTokens.fontFamily.serif);
    root.style.setProperty('--font-family-mono', typographyTokens.fontFamily.mono);

    // 字体大小
    root.style.setProperty('--font-size-display', typographyTokens.fontSize.display);
    root.style.setProperty('--font-size-headline-lg', typographyTokens.fontSize.headlineLg);
    root.style.setProperty('--font-size-headline-md', typographyTokens.fontSize.headlineMd);
    root.style.setProperty('--font-size-headline-sm', typographyTokens.fontSize.headlineSm);
    root.style.setProperty('--font-size-title-lg', typographyTokens.fontSize.titleLg);
    root.style.setProperty('--font-size-body-lg', typographyTokens.fontSize.bodyLg);
    root.style.setProperty('--font-size-body-md', typographyTokens.fontSize.bodyMd);
    root.style.setProperty('--font-size-body-sm', typographyTokens.fontSize.bodySm);

    // 字重
    root.style.setProperty('--font-weight-light', String(typographyTokens.fontWeight.light));
    root.style.setProperty('--font-weight-regular', String(typographyTokens.fontWeight.regular));
    root.style.setProperty('--font-weight-medium', String(typographyTokens.fontWeight.medium));
    root.style.setProperty('--font-weight-semibold', String(typographyTokens.fontWeight.semibold));
    root.style.setProperty('--font-weight-bold', String(typographyTokens.fontWeight.bold));

    // 行高
    root.style.setProperty('--line-height-tight', typographyTokens.lineHeight.tight);
    root.style.setProperty('--line-height-normal', typographyTokens.lineHeight.normal);
    root.style.setProperty('--line-height-relaxed', typographyTokens.lineHeight.relaxed);
  }

  /**
   * 应用间距变量
   */
  private applySpacingVariables(root: HTMLElement, spacingTokens: ThemeTokens['spacing']): void {
    root.style.setProperty('--spacing-xs', spacingTokens.xs);
    root.style.setProperty('--spacing-sm', spacingTokens.sm);
    root.style.setProperty('--spacing-md', spacingTokens.md);
    root.style.setProperty('--spacing-lg', spacingTokens.lg);
    root.style.setProperty('--spacing-xl', spacingTokens.xl);
    root.style.setProperty('--spacing-2xl', spacingTokens['2xl']);
  }

  /**
   * 应用圆角变量
   */
  private applyShapeVariables(root: HTMLElement, shapeTokens: ThemeTokens['shape']): void {
    root.style.setProperty('--radius-xs', shapeTokens.xs);
    root.style.setProperty('--radius-sm', shapeTokens.sm);
    root.style.setProperty('--radius-md', shapeTokens.md);
    root.style.setProperty('--radius-lg', shapeTokens.lg);
    root.style.setProperty('--radius-xl', shapeTokens.xl);
    root.style.setProperty('--radius-full', shapeTokens.full);
  }

  /**
   * 应用高度变量
   */
  private applyElevationVariables(root: HTMLElement, elevationTokens: ThemeTokens['elevation']): void {
    root.style.setProperty('--elevation-0', elevationTokens.level0.shadow);
    root.style.setProperty('--elevation-1', elevationTokens.level1.shadow);
    root.style.setProperty('--elevation-2', elevationTokens.level2.shadow);
    root.style.setProperty('--elevation-3', elevationTokens.level3.shadow);
    root.style.setProperty('--elevation-4', elevationTokens.level4.shadow);
    root.style.setProperty('--elevation-5', elevationTokens.level5.shadow);

    root.style.setProperty('--shadow-card', elevationTokens.component.card.shadow);
    root.style.setProperty('--shadow-dialog', elevationTokens.component.dialog.shadow);
    root.style.setProperty('--shadow-dropdown', elevationTokens.component.dropdown.shadow);
  }

  /**
   * 应用动画变量
   */
  private applyMotionVariables(root: HTMLElement, motionTokens: ThemeTokens['motion']): void {
    root.style.setProperty('--motion-duration-fast', motionTokens.duration.fast);
    root.style.setProperty('--motion-duration-normal', motionTokens.duration.normal);
    root.style.setProperty('--motion-duration-slow', motionTokens.duration.slow);
    root.style.setProperty('--motion-duration-enter', motionTokens.duration.enter);
    root.style.setProperty('--motion-duration-exit', motionTokens.duration.exit);

    root.style.setProperty('--motion-easing-standard', motionTokens.easing.standard);
    root.style.setProperty('--motion-easing-decelerated', motionTokens.easing.decelerated);
    root.style.setProperty('--motion-easing-accelerated', motionTokens.easing.accelerated);

    root.style.setProperty('--transition-all', motionTokens.transition.all);
    root.style.setProperty('--transition-colors', motionTokens.transition.colors);
    root.style.setProperty('--transition-transform', motionTokens.transition.transform);
  }

  /**
   * 应用状态层变量
   */
  private applyStateVariables(root: HTMLElement, stateTokens: ThemeTokens['state']): void {
    root.style.setProperty('--state-layer-hover', String(stateTokens.hover));
    root.style.setProperty('--state-layer-focus', String(stateTokens.focus));
    root.style.setProperty('--state-layer-pressed', String(stateTokens.pressed));
    root.style.setProperty('--state-layer-dragged', String(stateTokens.dragged));
    root.style.setProperty('--state-disabled-opacity', String(stateTokens.disabled.opacity));
  }

  /**
   * 注册主题变化回调
   */
  subscribe(callback: () => void): void {
    this.onThemeChange = callback;
  }

  /**
   * 取消订阅
   */
  unsubscribe(): void {
    this.onThemeChange = undefined;
  }

  /**
   * 通知主题变化
   */
  private notifyChange(): void {
    if (this.onThemeChange) {
      this.onThemeChange();
    }
  }

  /**
   * 获取当前模式
   */
  getMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * 获取当前预设
   */
  getPreset(): ThemePreset {
    return this.currentPreset;
  }

  /**
   * 获取所有预设
   */
  getPresets(): ThemePreset[] {
    return THEME_PRESETS;
  }

  /**
   * 验证颜色对比度
   */
  validateContrast(foreground: string, background: string): {
    ratio: number;
    meetsAA: boolean;
    label: string;
  } {
    const ratio = getContrastRatio(foreground, background);
    return {
      ratio,
      meetsAA: meetsWCAGAA(foreground, background),
      label: `${foreground} on ${background}`,
    };
  }

  /**
   * 生成颜色变体
   */
  generateVariants(baseColor: string): Record<string, string> {
    return generateColorVariants(baseColor);
  }
}

// 创建全局主题管理器实例
export const themeManager = new ThemeManager();

// 导出工具函数
export {
  getContrastRatio,
  meetsWCAGAA,
  generateColorVariants,
};
