/**
 * 自定义主题管理 Hook (useCustomTheme)
 * 提供自定义主题配置的读取、修改、持久化功能
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/safeLogger'
import type { CustomThemeConfig } from '../types/custom-theme.types';
import {
  DEFAULT_CUSTOM_THEME,
  PRESET_COLOR_SCHEMES,
  validateCustomThemeConfig,
} from '../types/custom-theme.types';

const STORAGE_KEY = 'rmfood-custom-theme-config';

/**
 * 从LocalStorage加载自定义主题配置
 */
function loadCustomTheme(): CustomThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as CustomThemeConfig;
      // 验证配置有效性
      const { valid } = validateCustomThemeConfig(config);
      if (valid) {
        return config;
      }
    }
  } catch (error) {
    logger.warn('加载自定义主题配置失败:', error);
  }
  return DEFAULT_CUSTOM_THEME;
}

/**
 * 将自定义主题配置保存到LocalStorage
 */
function saveCustomTheme(config: CustomThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    logger.error('保存自定义主题配置失败:', error);
  }
}

/**
 * 自定义主题管理 Hook
 * @returns 自定义主题配置及操作方法
 */
export function useCustomTheme() {
  const [config, setConfig] = useState<CustomThemeConfig>(loadCustomTheme);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化：从LocalStorage加载
  useEffect(() => {
    const loaded = loadCustomTheme();
    setConfig(loaded);
    setIsInitialized(true);

    // 应用主题到DOM
    applyCustomThemeToDOM(loaded);
  }, []);

  /**
   * 更新主题配置
   */
  const updateConfig = useCallback((updates: Partial<CustomThemeConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };

      // 更新时间戳
      if (!newConfig.meta) {
        newConfig.meta = {};
      }
      newConfig.meta.updatedAt = Date.now();

      // 验证并保存
      const { valid, errors } = validateCustomThemeConfig(newConfig);
      if (valid) {
        saveCustomTheme(newConfig);
        applyCustomThemeToDOM(newConfig);
      } else {
        logger.warn('无效的主题配置:', errors);
      }

      return newConfig;
    });
  }, []);

  /**
   * 切换预设模式
   */
  const setPresetMode = useCallback((presetId: 'light' | 'dark' | 'system') => {
    updateConfig({
      mode: 'preset',
      presetId,
    });
  }, [updateConfig]);

  /**
   * 切换到自定义模式
   */
  const setCustomMode = useCallback(() => {
    updateConfig({ mode: 'custom' });
  }, [updateConfig]);

  /**
   * 应用预设颜色方案
   */
  const applyPresetColors = useCallback((schemeName: keyof typeof PRESET_COLOR_SCHEMES) => {
    const colors = PRESET_COLOR_SCHEMES[schemeName];
    updateConfig({
      mode: 'custom',
      colors: { ...colors },
    });
  }, [updateConfig]);

  /**
   * 重置为默认配置
   */
  const resetToDefault = useCallback(() => {
    setConfig(DEFAULT_CUSTOM_THEME);
    saveCustomTheme(DEFAULT_CUSTOM_THEME);
    applyCustomThemeToDOM(DEFAULT_CUSTOM_THEME);
  }, []);

  /**
   * 导出主题配置为JSON（用于分享/备份）
   */
  const exportConfig = useCallback((): string => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  /**
   * 导入主题配置从JSON
   */
  const importConfig = useCallback((jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString) as CustomThemeConfig;
      const { valid, errors } = validateCustomThemeConfig(imported);

      if (valid) {
        setConfig(imported);
        saveCustomTheme(imported);
        applyCustomThemeToDOM(imported);
        return true;
      } else {
        logger.error('导入的主题配置无效:', errors);
        return false;
      }
    } catch (error) {
      logger.error('解析JSON失败:', error);
      return false;
    }
  }, []);

  return {
    /** 当前配置 */
    config,
    /** 是否已初始化完成 */
    isInitialized,
    /** 操作方法 */
    updateConfig,
    setPresetMode,
    setCustomMode,
    applyPresetColors,
    resetToDefault,
    exportConfig,
    importConfig,
  };
}

/**
 * 将自定义主题配置应用到DOM（设置CSS变量）
 */
function applyCustomThemeToDOM(config: CustomThemeConfig): void {
  const root = document.documentElement;

  // 如果是自定义颜色模式，覆盖CSS变量
  if (config.mode === 'custom' && config.colors) {
    root.style.setProperty('--color-primary-main', config.colors.primary);
    root.style.setProperty('--color-primary-light', adjustColor(config.colors.primary, 40));
    root.style.setProperty('--color-secondary-main', config.colors.secondary);
    root.style.setProperty('--color-accent-main', config.colors.accent);
    root.style.setProperty('--color-success-main', config.colors.success);
    root.style.setProperty('--color-warning-main', config.colors.warning);
    root.style.setProperty('--color-error-main', config.colors.error);
    root.style.setProperty('--color-info-main', config.colors.info);
  }

  // 应用字体配置
  if (config.font) {
    root.style.setProperty('--font-family-base', config.font.family);
    root.style.setProperty('--font-size-base', `${config.font.baseFontSize}px`);
    root.style.setProperty('--line-height-base', String(config.font.lineHeight));
  }

  // 应用高对比度模式
  if (config.highContrast) {
    root.setAttribute('data-high-contrast', 'true');
  } else {
    root.removeAttribute('data-high-contrast');
  }

  // 应用减少动画偏好
  if (config.reducedMotion) {
    root.setAttribute('data-reduced-motion', 'true');
  } else {
    root.removeAttribute('data-reduced-motion');
  }
}

/**
 * 调整颜色亮度（用于生成light/dark变体）
 * @param hex 原始颜色（#RRGGBB格式）
 * @param amount 调整量（-100 到 100）
 * @returns 调整后的颜色
 */
function adjustColor(hex: string, amount: number): string {
  let color = hex.replace('#', '');

  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }

  const num = parseInt(color, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
