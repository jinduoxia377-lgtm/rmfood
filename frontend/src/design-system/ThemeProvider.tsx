/**
 * Material Design 3 Theme Provider
 *
 * 基于 React Context 实现的主题提供者，支持动态主题切换
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import type { ThemeTokens, ThemeMode, ThemePreset } from './tokens';
import { themeManager, ThemeManager } from './theme-manager';

// 主题上下文接口
export interface ThemeContextType {
  tokens: ThemeTokens;
  mode: ThemeMode;
  preset: ThemePreset;
  presets: ThemePreset[];
  setMode: (mode: ThemeMode) => void;
  setPreset: (presetId: string) => void;
  setCustomTokens: (tokens: Partial<ThemeTokens>) => void;
  validateContrast: (foreground: string, background: string) => {
    ratio: number;
    meetsAA: boolean;
    label: string;
  };
}

// 创建主题上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ThemeProvider 组件
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokens, setTokens] = React.useState<ThemeTokens>(() => themeManager.getCurrentTokens());
  const [mode, setMode] = React.useState<ThemeMode>(() => themeManager.getMode());
  const [preset, setPreset] = React.useState<ThemePreset>(() => themeManager.getPreset());

  // 订阅主题变化
  useEffect(() => {
    const handleChange = () => {
      setTokens(themeManager.getCurrentTokens());
      setMode(themeManager.getMode());
      setPreset(themeManager.getPreset());
    };

    themeManager.subscribe(handleChange);

    // 初始化应用主题
    themeManager.applyTheme();

    return () => {
      themeManager.unsubscribe();
    };
  }, []);

  // 应用主题到DOM
  useEffect(() => {
    themeManager.applyTheme();
  }, [tokens]);

  const handleSetMode = useCallback((newMode: ThemeMode) => {
    themeManager.setMode(newMode);
  }, []);

  const handleSetPreset = useCallback((presetId: string) => {
    themeManager.setPreset(presetId);
  }, []);

  const handleSetCustomTokens = useCallback((customTokens: Partial<ThemeTokens>) => {
    themeManager.setCustomTokens(customTokens);
  }, []);

  const handleValidateContrast = useCallback((foreground: string, background: string) => {
    return themeManager.validateContrast(foreground, background);
  }, []);

  const contextValue: ThemeContextType = useMemo(() => ({
    tokens,
    mode,
    preset,
    presets: themeManager.getPresets(),
    setMode: handleSetMode,
    setPreset: handleSetPreset,
    setCustomTokens: handleSetCustomTokens,
    validateContrast: handleValidateContrast,
  }), [tokens, mode, preset, handleSetMode, handleSetPreset, handleSetCustomTokens, handleValidateContrast]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 自定义hook：获取主题令牌
export const useThemeTokens = (): ThemeTokens => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeTokens must be used within a ThemeProvider');
  }
  return context.tokens;
};

// 自定义hook：获取主题模式
export const useThemeMode = (): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return {
    mode: context.mode,
    setMode: context.setMode,
  };
};

// 自定义hook：获取主题预设
export const useThemePreset = (): {
  preset: ThemePreset;
  presets: ThemePreset[];
  setPreset: (presetId: string) => void;
} => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemePreset must be used within a ThemeProvider');
  }
  return {
    preset: context.preset,
    presets: context.presets,
    setPreset: context.setPreset,
  };
};

// 自定义hook：获取颜色令牌
export const useColorTokens = (): ThemeTokens['color'] => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useColorTokens must be used within a ThemeProvider');
  }
  return context.tokens.color;
};

// 自定义hook：获取排版令牌
export const useTypographyTokens = (): ThemeTokens['typography'] => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTypographyTokens must be used within a ThemeProvider');
  }
  return context.tokens.typography;
};

// 自定义hook：获取间距令牌
export const useSpacingTokens = (): ThemeTokens['spacing'] => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useSpacingTokens must be used within a ThemeProvider');
  }
  return context.tokens.spacing;
};

// 自定义hook：获取主题管理器实例
export const useThemeManager = (): ThemeManager => {
  return themeManager;
};

// 导出主题管理器供直接使用
export { themeManager };
