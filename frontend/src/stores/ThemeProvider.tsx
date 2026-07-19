/**
 * RMFOOD 主题系统 - React Context Provider (修复版)
 * 提供主题消费的统一入口，包含完整的错误处理
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useThemeStore } from './themeStore';
import type {
  ThemeProviderProps,
  ThemeConfig,
  ThemeMode,
  AccessibilityMode,
  TransitionType,
  PresetThemeId,
} from '../types/theme.types';
import { presetThemes } from './theme.presets';
import { logger } from '@/utils/safeLogger';


// ============================================================================
// Context 定义
// ============================================================================

interface ThemeContextValue {
  /** 当前激活的主题配置 */
  theme: ThemeConfig;

  /** 当前模式 */
  mode: ThemeMode;

  /** 辅助功能模式 */
  accessibilityMode: AccessibilityMode;

  /** 是否正在过渡动画中 */
  isTransitioning: boolean;

  /** 是否已初始化完成 */
  isInitialized: boolean;

  // ==================== Actions ====================

  /** 切换主题模式 */
  setThemeMode: (mode: ThemeMode) => void;

  /** 应用预设主题 */
  setPresetTheme: (themeId: PresetThemeId) => void;

  /** 应用自定义主题覆盖 */
  applyCustomTheme: (overrides: Record<string, unknown>) => void;

  /** 设置辅助功能模式 */
  setAccessibilityMode: (mode: AccessibilityMode) => void;

  /** 设置过渡效果类型 */
  setTransitionType: (type: TransitionType) => void;

  /** 重置为默认主题 */
  resetToDefault: () => void;

  /** 导出当前主题配置 */
  exportTheme: () => string;

  /** 导入主题配置 */
  importTheme: (configJson: string) => boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// 默认值（防止 undefined 错误）
// ============================================================================

const DEFAULT_THEME = presetThemes['light-default'];

const DEFAULT_CONTEXT_VALUE: ThemeContextValue = {
  theme: DEFAULT_THEME,
  mode: 'system',
  accessibilityMode: 'normal',
  isTransitioning: false,
  isInitialized: false,

  // noop actions
  setThemeMode: () => {},
  setPresetTheme: () => {},
  applyCustomTheme: () => {},
  setAccessibilityMode: () => {},
  setTransitionType: () => {},
  resetToDefault: () => {},
  exportTheme: () => '{}',
  importTheme: () => false,
};

// ============================================================================
// Provider 组件
// ============================================================================

export function ThemeProvider({
  children,
  onThemeChange,
}: ThemeProviderProps): React.ReactElement {
  const [error, setError] = useState<Error | null>(null);
  const store = useThemeStore();

  // ==================== 初始化 ====================

  useEffect(() => {
    try {
      if (!store.isInitialized) {
        store.initialize();
      }
    } catch (err) {
      logger.error('[ThemeProvider] Initialization error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // ==================== 监听系统偏好变化 ====================

  useEffect(() => {
    // 只在 system 模式下监听
    if (store.mode !== 'system' || !store.activeThemeId) return;

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent) => {
        try {
          const newMode = e.matches ? 'dark' : 'light';
          const currentType = store.activeThemeId.split('-').slice(1).join('-') || 'default';
          const themeId = `${newMode}-${currentType}` as PresetThemeId;
          if (presetThemes[themeId]) {
            store.setPresetTheme(themeId);
          }
        } catch (err) {
          logger.warn('[ThemeProvider] System preference change error:', err);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (err) {
      logger.error('[ThemeProvider] System preference listener error:', err);
      return;
    }
  }, [store.mode, store.activeThemeId]);

  // ==================== 监听 Reduced Motion 偏好变化 ====================

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      try {
        if (store.setMotionPreferences) {
          store.setMotionPreferences({ reducedMotion: e.matches });
        }
      } catch (err) {
        logger.warn('[ThemeProvider] Reduced motion change error:', err);
      }
    };

    try {
      mediaQuery.addEventListener('change', handleChange);
    } catch (err) {
      logger.error('[ThemeProvider] Reduced motion listener error:', err);
    }

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ==================== 主题变化回调 ====================

  useEffect(() => {
    try {
      if (onThemeChange && store.isInitialized && store.activeTheme) {
        onThemeChange(store.activeTheme);
      }
    } catch (err) {
      logger.warn('[ThemeProvider] Theme change callback error:', err);
    }
  }, [store.activeTheme?.id, onThemeChange, store.isInitialized]);

  // ==================== Memoized Context Value ====================

  const contextValue = useMemo<ThemeContextValue>(() => {
    try {
      return {
        theme: store.activeTheme || DEFAULT_THEME,
        mode: store.mode || 'system',
        accessibilityMode: store.accessibilityMode || 'normal',
        isTransitioning: store.isTransitioning || false,
        isInitialized: store.isInitialized || false,

        // Actions - 使用安全的包装器
        setThemeMode: (mode: ThemeMode) => {
          try {
            store.setThemeMode(mode);
          } catch (err) {
            logger.error('[ThemeProvider] setThemeMode error:', err);
          }
        },
        setPresetTheme: (themeId: PresetThemeId) => {
          try {
            store.setPresetTheme(themeId);
          } catch (err) {
            logger.error('[ThemeProvider] setPresetTheme error:', err);
          }
        },
        applyCustomTheme: (overrides: Record<string, unknown>) => {
          try {
            store.applyCustomTheme(overrides);
          } catch (err) {
            logger.error('[ThemeProvider] applyCustomTheme error:', err);
          }
        },
        setAccessibilityMode: (mode: AccessibilityMode) => {
          try {
            store.setAccessibilityMode(mode);
          } catch (err) {
            logger.error('[ThemeProvider] setAccessibilityMode error:', err);
          }
        },
        setTransitionType: (type: TransitionType) => {
          try {
            store.setTransitionType(type);
          } catch (err) {
            logger.error('[ThemeProvider] setTransitionType error:', err);
          }
        },
        resetToDefault: () => {
          try {
            store.resetToDefault();
          } catch (err) {
            logger.error('[ThemeProvider] resetToDefault error:', err);
          }
        },
        exportTheme: () => {
          try {
            return store.exportTheme();
          } catch (err) {
            logger.error('[ThemeProvider] exportTheme error:', err);
            return '{}';
          }
        },
        importTheme: (configJson: string) => {
          try {
            return store.importTheme(configJson);
          } catch (err) {
            logger.error('[ThemeProvider] importTheme error:', err);
            return false;
          }
        },
      };
    } catch (err) {
      logger.error('[ThemeProvider] Context value creation error:', err);
      return DEFAULT_CONTEXT_VALUE;
    }
  }, [
    store.activeTheme,
    store.mode,
    store.accessibilityMode,
    store.isTransitioning,
    store.isInitialized,
  ]);

  // ==================== 错误处理 ====================

  if (error) {
    logger.error('[ThemeProvider] Rendering with error:', error.message);
    // 仍然渲染子组件，但使用默认的 context value
    return (
      <ThemeContext.Provider value={DEFAULT_CONTEXT_VALUE}>
        {children}
      </ThemeContext.Provider>
    );
  }

  // ==================== 正常渲染 ====================

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Hook: 使用主题上下文
// ============================================================================

/**
 * 获取主题上下文
 * 必须在 ThemeProvider 内使用
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  // 如果 context 为 null（不在 Provider 内），返回默认值而不是抛出错误
  if (!context) {
    logger.warn(
      '[useTheme] Used outside ThemeProvider. Returning default values. ' +
      'Please wrap your application with <ThemeProvider>.',
    );
    return DEFAULT_CONTEXT_VALUE;
  }

  return context;
}

/**
 * 获取主题颜色（便捷方法）
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * 获取主题排版配置
 */
export function useTypography() {
  const { theme } = useTheme();
  return theme.typography;
}

/**
 * 获取主题间距配置
 */
export function useSpacing() {
  const { theme } = useTheme();
  return theme.spacing;
}

/**
 * 检查是否为暗色模式
 */
export function useIsDarkMode(): boolean {
  const { mode, theme } = useTheme();
  return mode === 'dark' || theme.mode === 'dark';
}

/**
 * 获取 CSS 变量值
 */
export function useCSSVariable(varName: string): string {
  useTheme();

  try {
    // 从已应用的变量中获取，或从主题配置生成
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    return computedStyle.getPropertyValue(varName).trim() || '';
  } catch (err) {
    logger.warn('[useCSSVariable] Error getting variable:', varName, err instanceof Error ? err.message : String(err));
    return '';
  }
}

/**
 * 条件渲染：根据模式返回不同值
 */
export function useThemedValue<T>(values: { light: T; dark: T }): T {
  const isDark = useIsDarkMode();
  return isDark ? values.dark : values.light;
}

// ============================================================================
// 导出默认导出
// ============================================================================

export default ThemeProvider;
