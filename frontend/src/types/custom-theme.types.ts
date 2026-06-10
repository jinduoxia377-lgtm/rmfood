/**
 * 自定义主题配置类型定义 (Custom Theme Configuration Types)
 * 设计系统文档 v1.0 暗示支持用户个性化配置
 */

/**
 * 预设主题ID
 */
export type PresetThemeId = 'light' | 'dark' | 'system';

/**
 * 自定义颜色配置
 */
export interface CustomColorConfig {
  /** 品牌主色 */
  primary: string;
  /** 品牌辅色 */
  secondary: string;
  /** AI强调色 */
  accent: string;
  /** 成功色 */
  success: string;
  /** 警告色 */
  warning: string;
  /** 错误色 */
  error: string;
  /** 信息色 */
  info: string;
}

/**
 * 自定义字体配置
 */
export interface CustomFontConfig {
  /** 字体家族 */
  family: string;
  /** 基础字号 (px) */
  baseFontSize: number;
  /** 行高倍数 */
  lineHeight: number;
  /** 是否使用衬线字体作为标题 */
  serifHeadings: boolean;
}

/**
 * 自定义间距/圆角配置
 */
export interface CustomSpacingConfig {
  /** 圆角大小: none | small | medium | large */
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  /** 间距密度: compact | normal | comfortable | spacious */
  density: 'compact' | 'normal' | 'comfortable' | 'spacious';
}

/**
 * 完整的自定义主题配置
 */
export interface CustomThemeConfig {
  /** 使用预设还是自定义模式 */
  mode: 'preset' | 'custom';

  /** 如果是预设模式，使用的预设ID */
  presetId?: PresetThemeId;

  /** 自定义颜色（仅 custom 模式下生效） */
  colors?: CustomColorConfig;

  /** 自定义字体 */
  font?: CustomFontConfig;

  /** 自定义间距/圆角 */
  spacing?: CustomSpacingConfig;

  /** 是否启用高对比度模式 */
  highContrast?: boolean;

  /** 是否减少动画 */
  reducedMotion?: boolean;

  /** 元数据 */
  meta?: {
    name?: string;           // 主题名称
    description?: string;    // 主题描述
    createdAt?: number;      // 创建时间
    updatedAt?: number;      // 更新时间
  };
}

/**
 * 默认自定义主题配置
 */
export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  mode: 'preset',
  presetId: 'system',
  font: {
    family: "'Noto Sans SC', sans-serif",
    baseFontSize: 16,
    lineHeight: 1.5,
    serifHeadings: true,
  },
  spacing: {
    borderRadius: 'md',
    density: 'normal',
  },
  highContrast: false,
  reducedMotion: false,
};

/**
 * 预设颜色方案（供用户选择）
 */
export const PRESET_COLOR_SCHEMES = {
  /** 默认森林绿主题 */
  forestGreen: {
    primary: '#059669',
    secondary: '#2563eb',
    accent: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  /** 海洋蓝主题 */
  oceanBlue: {
    primary: '#2563eb',
    secondary: '#059669',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  /** 紫罗兰主题 */
  violetDream: {
    primary: '#7c3aed',
    secondary: '#2563eb',
    accent: '#ec4899',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  /** 琥珀暖阳主题 */
  amberWarmth: {
    primary: '#f59e0b',
    secondary: '#dc2626',
    accent: '#8b5cf6',
    success: '#10b981',
    warning: '#ea580c',
    error: '#dc2626',
    info: '#0891b2',
  },
} as const;

/**
 * 验证自定义主题配置是否有效
 * @param config 待验证的配置
 * @returns 验证结果（是否有效 + 错误信息）
 */
export function validateCustomThemeConfig(config: CustomThemeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config) {
    return { valid: false, errors: ['配置对象不能为空'] };
  }

  // 验证模式
  if (!['preset', 'custom'].includes(config.mode)) {
    errors.push('mode 必须是 "preset" 或 "custom"');
  }

  // 验证预设ID（如果是preset模式）
  if (config.mode === 'preset' && config.presetId) {
    const validPresets: PresetThemeId[] = ['light', 'dark', 'system'];
    if (!validPresets.includes(config.presetId)) {
      errors.push(`无效的预设ID: ${config.presetId}`);
    }
  }

  // 验证颜色格式（如果是custom模式）
  if (config.mode === 'custom' && config.colors) {
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    for (const [key, value] of Object.entries(config.colors)) {
      if (!colorRegex.test(value)) {
        errors.push(`无效的颜色值 ${key}: ${value}`);
      }
    }
  }

  // 验证字号范围
  if (config.font?.baseFontSize) {
    if (config.font.baseFontSize < 12 || config.font.baseFontSize > 24) {
      errors.push(`字号必须在12-24px之间: ${config.font.baseFontSize}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
