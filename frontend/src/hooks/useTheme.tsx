import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react'
import { PROFESSIONAL_THEMES } from '@/config';
import { logger } from '@/utils/safeLogger';


// ========== 类型定义 ==========
export type ThemeMode = 'light' | 'dark' | 'auto';
export type InterfaceDensity = 'compact' | 'comfortable' | 'spacious';
export type ShadowIntensity = 0 | 1 | 2 | 3 | 4;

// 颜色配置接口 - Material Design 3 标准
export interface ColorScheme {
  // 主色调 (Primary)
  primary: string;
  primaryHover: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;

  // 辅助色调 (Secondary)
  secondary: string;
  secondaryHover: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;

  // 第三色调 (Tertiary)
  tertiary: string;
  tertiaryHover: string;
  tertiaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;

  // 基础色
  background: string;
  surface: string;
  surfaceVariant: string;
  onBackground: string;
  onSurface: string;
  onSurfaceVariant: string;

  // 边缘和轮廓
  outline: string;
  outlineVariant: string;

  // 功能性颜色
  error: string;
  errorContainer: string;
  onError: string;
  onErrorContainer: string;

  // 状态颜色
  success: string;
  warning: string;
  info: string;

  // 文本颜色
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // 边框
  border: string;

  // Surface Tint (Material Design 3)
  surfaceTint: string;

  // 背景变体
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;

  // Scrim (覆盖层)
  scrim: string;
}

// Material Design 3 Elevation Tokens
export interface ElevationConfig {
  level0: string; // transparent
  level1: string; // 1dp
  level2: string; // 3dp
  level3: string; // 6dp
  level4: string; // 8dp
  level5: string; // 12dp
}

// Material Design 3 State Layer Tokens
export interface StateLayerConfig {
  hover: number;      // 0.08 opacity
  focus: number;      // 0.12 opacity
  pressed: number;    // 0.12 opacity
  dragged: number;     // 0.16 opacity
}

// Material Design 3 Motion Tokens
export interface MotionConfig {
  duration1: string;   // 50ms
  duration2: string;   // 100ms
  duration3: string;   // 150ms
  duration4: string;   // 200ms
  duration5: string;   // 250ms
  easing1: string;     // standard
  easing2: string;     // emphasized
  easing3: string;     // decelerated
  easing4: string;     // accelerated
}

// 字体配置接口
export interface FontConfig {
  family: string;
  size: number;
}

// 圆角配置接口
export interface BorderRadiusConfig {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

// 主题预设完整配置
export interface CompleteThemePreset {
  id: string;
  name: string;
  description: string;
  lightColors: Partial<ColorScheme>;
  darkColors: Partial<ColorScheme>;
  borderRadius: number;
  shadowIntensity: ShadowIntensity;
  density: InterfaceDensity;
  fontSize: number;
  fontFamily: string;
}

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: 'sans-serif' | 'serif' | 'mono' | 'cjk';
  weights?: number[];
  preview?: string;
  description?: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'system',
    name: '系统默认',
    family: "'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif",
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    description: '操作系统默认中文字体',
    preview: '微软雅黑 Aa',
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    category: 'sans-serif',
    weights: [300, 400, 500, 600, 700, 800],
    description: '现代无衬线字体，适合界面显示',
    preview: 'Inter Aa',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    category: 'mono',
    weights: [400, 500, 600, 700],
    description: '等宽编程字体，适合代码展示',
    preview: 'JetBrains',
  },
  {
    id: 'source-han-serif',
    name: '思源宋体',
    family: "'Source Han Serif SC', 'SimSun', serif",
    category: 'serif',
    weights: [400, 500, 600, 700],
    description: '中文衬线字体，适合正式文档',
    preview: '思源宋体',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    category: 'sans-serif',
    weights: [300, 400, 500, 700, 900],
    description: 'Material Design 标准字体',
    preview: 'Roboto Aa',
  },
  {
    id: 'lXGWenKai',
    name: '霞鹜文楷',
    family: "'LXGWenKai', 'STKaiti', 'KaiTi', serif",
    category: 'cjk',
    weights: [400, 500, 600, 700],
    description: '中文楷体，优雅美观',
    preview: '霞鹜文楷',
  },
];

// 字体大小预设（5-7档，12-24px）
export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 22, 24];

// 字重选项
export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: '细体 (Light)', desc: '300' },
  { value: 400, label: '常规 (Regular)', desc: '400' },
  { value: 500, label: '中等 (Medium)', desc: '500' },
  { value: 600, label: '半粗 (Semi Bold)', desc: '600' },
  { value: 700, label: '粗体 (Bold)', desc: '700' },
];

// 行高选项
export const LINE_HEIGHT_OPTIONS = [
  { value: 1.0, label: '紧凑', desc: '1.0' },
  { value: 1.25, label: '适中', desc: '1.25' },
  { value: 1.5, label: '标准', desc: '1.5' },
  { value: 1.75, label: '宽松', desc: '1.75' },
  { value: 2.0, label: '舒展', desc: '2.0' },
];

// 字间距选项
export const LETTER_SPACING_OPTIONS = [
  { value: -0.5, label: '紧密', desc: '-0.5' },
  { value: 0, label: '标准', desc: '0' },
  { value: 0.5, label: '宽松', desc: '0.5' },
  { value: 1, label: '分散', desc: '1.0' },
];

// 主题设置完整接口
export interface ThemeSettings {
  mode: ThemeMode;
  animation: boolean;
  density: InterfaceDensity;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  // 新增字体配置
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  accentColor: string;
  sidebarCollapsed: boolean;
  // 新增配置
  borderRadius: number; // 4-24px
  shadowIntensity: ShadowIntensity; // 0-4
  customColors: {
    light: Partial<ColorScheme>;
    dark: Partial<ColorScheme>;
  };
  cloudSync: boolean; // 云端同步选项
  // 侧边栏透明度设置
  sidebarTransparent: boolean; // 是否启用侧边栏半透明
  sidebarOpacity: number; // 侧边栏透明度 0.3-0.6
}

// ========== 默认配置 - Material Design 3 标准 ==========
const DEFAULT_LIGHT_COLORS: ColorScheme = {
  // 主色调 - Material Design 3 标准
  primary: '#059669',
  primaryHover: '#047857',
  primaryContainer: '#d1fae5',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#065f46',

  // 辅助色调
  secondary: '#2563EB',
  secondaryHover: '#1d4ed8',
  secondaryContainer: '#dbeafe',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#1e40af',

  // 第三色调
  tertiary: '#7c3aed',
  tertiaryHover: '#6d28d9',
  tertiaryContainer: '#f3e8ff',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#4c1d95',

  // 基础色
  background: '#fcfcfc',
  surface: '#ffffff',
  surfaceVariant: '#f1f5f9',
  onBackground: '#1e293b',
  onSurface: '#1e293b',
  onSurfaceVariant: '#475569',

  // 边缘和轮廓
  outline: '#cbd5e1',
  outlineVariant: '#e2e8f0',

  // 功能性颜色
  error: '#ef4444',
  errorContainer: '#fee2e2',
  onError: '#ffffff',
  onErrorContainer: '#991b1b',

  // 状态颜色
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',

  // 文本颜色
  textPrimary: '#1e293b',
  textSecondary: '#334155',
  textMuted: '#64748b',

  // 边框
  border: 'rgba(148,163,184,0.2)',

  // Surface Tint (Material Design 3)
  surfaceTint: '#059669',

  // 背景变体
  inverseSurface: '#1e293b',
  inverseOnSurface: '#f8fafc',
  inversePrimary: '#d1fae5',

  // Scrim (覆盖层)
  scrim: '#000000',
};

const DEFAULT_DARK_COLORS: ColorScheme = {
  // 主色调 - Material Design 3 标准
  primary: '#10b981',
  primaryHover: '#34d399',
  primaryContainer: '#065f46',
  onPrimary: '#064e3b',
  onPrimaryContainer: '#d1fae5',

  // 辅助色调
  secondary: '#3b82f6',
  secondaryHover: '#60a5fa',
  secondaryContainer: '#1e40af',
  onSecondary: '#1e3a8a',
  onSecondaryContainer: '#dbeafe',

  // 第三色调
  tertiary: '#8b5cf6',
  tertiaryHover: '#a78bfa',
  tertiaryContainer: '#4c1d95',
  onTertiary: '#3730a3',
  onTertiaryContainer: '#f3e8ff',

  // 基础色
  background: '#0f172a',
  surface: '#1e293b',
  surfaceVariant: '#334155',
  onBackground: '#f8fafc',
  onSurface: '#f8fafc',
  onSurfaceVariant: '#cbd5e1',

  // 边缘和轮廓
  outline: '#64748b',
  outlineVariant: '#475569',

  // 功能性颜色
  error: '#f87171',
  errorContainer: '#991b1b',
  onError: '#7f1d1d',
  onErrorContainer: '#fee2e2',

  // 状态颜色
  success: '#34d399',
  warning: '#fbbf24',
  info: '#60a5fa',

  // 文本颜色
  textPrimary: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#94a3b8',

  // 边框
  border: 'rgba(148,163,184,0.2)',

  // Surface Tint (Material Design 3)
  surfaceTint: '#10b981',

  // 背景变体
  inverseSurface: '#f8fafc',
  inverseOnSurface: '#1e293b',
  inversePrimary: '#065f46',

  // Scrim (覆盖层)
  scrim: '#000000',
};

// ========== 主题预设 ==========
export const COMPLETE_THEME_PRESETS: CompleteThemePreset[] = [
  {
    id: 'default',
    name: '标准主题',
    description: 'RMFOOD 默认主题，平衡的视觉设计',
    lightColors: {},
    darkColors: {},
    borderRadius: 12,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[1].family,
  },
  {
    id: 'professional-green',
    name: '专业绿',
    description: '自然、健康、专业的配色方案，符合医药健康行业标准',
    lightColors: {
      primary: '#059669',
      primaryHover: '#047857',
      primaryContainer: '#d1fae5',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#065f46',
      secondary: '#0891B2',
      secondaryHover: '#0e7490',
      secondaryContainer: '#e0f2fe',
      onSecondary: '#ffffff',
      onSecondaryContainer: '#155e75',
      tertiary: '#7c3aed',
      tertiaryHover: '#6d28d9',
      tertiaryContainer: '#f3e8ff',
      onTertiary: '#ffffff',
      onTertiaryContainer: '#4c1d95',
      success: '#10b981',
      warning: '#f59e0b',
      info: '#3b82f6',
      error: '#ef4444',
    },
    darkColors: {
      primary: '#10b981',
      primaryHover: '#34d399',
      primaryContainer: '#065f46',
      onPrimary: '#064e3b',
      onPrimaryContainer: '#d1fae5',
      secondary: '#06b6d4',
      secondaryHover: '#22d3ee',
      secondaryContainer: '#0e7490',
      onSecondary: '#0c4a5e',
      onSecondaryContainer: '#e0f2fe',
      tertiary: '#8b5cf6',
      tertiaryHover: '#a78bfa',
      tertiaryContainer: '#4c1d95',
      onTertiary: '#3730a3',
      onTertiaryContainer: '#f3e8ff',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#60a5fa',
      error: '#f87171',
    },
    borderRadius: 12,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
  {
    id: 'medical-blue',
    name: '医疗蓝',
    description: '专业、信任、安全感的蓝色系配色，符合医疗健康行业标准',
    lightColors: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryContainer: '#dbeafe',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#1e40af',
      secondary: '#0891B2',
      secondaryHover: '#0e7490',
      secondaryContainer: '#e0f2fe',
      onSecondary: '#ffffff',
      onSecondaryContainer: '#155e75',
      tertiary: '#7c3aed',
      tertiaryHover: '#6d28d9',
      tertiaryContainer: '#f3e8ff',
      onTertiary: '#ffffff',
      onTertiaryContainer: '#4c1d95',
      success: '#10b981',
      warning: '#f59e0b',
      info: '#059669',
      error: '#ef4444',
    },
    darkColors: {
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      primaryContainer: '#1e40af',
      onPrimary: '#1e3a8a',
      onPrimaryContainer: '#dbeafe',
      secondary: '#06B6D4',
      secondaryHover: '#22d3ee',
      secondaryContainer: '#0e7490',
      onSecondary: '#0c4a5e',
      onSecondaryContainer: '#e0f2fe',
      tertiary: '#8B5CF6',
      tertiaryHover: '#a78bfa',
      tertiaryContainer: '#4c1d95',
      onTertiary: '#3730a3',
      onTertiaryContainer: '#f3e8ff',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#10b981',
      error: '#f87171',
    },
    borderRadius: 14,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
  {
    id: 'warm-orange',
    name: '温暖橙',
    description: '温暖、活力、创新的配色方案，带来积极向上的用户体验',
    lightColors: {
      primary: '#ea580c',
      primaryHover: '#c2410c',
      primaryContainer: '#ffedd5',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#7c2d12',
      secondary: '#dc2626',
      secondaryHover: '#b91c1c',
      secondaryContainer: '#fee2e2',
      onSecondary: '#ffffff',
      onSecondaryContainer: '#7f1d1d',
      tertiary: '#059669',
      tertiaryHover: '#047857',
      tertiaryContainer: '#d1fae5',
      onTertiary: '#ffffff',
      onTertiaryContainer: '#065f46',
      success: '#10b981',
      warning: '#f59e0b',
      info: '#3b82f6',
      error: '#ef4444',
    },
    darkColors: {
      primary: '#f97316',
      primaryHover: '#fb923c',
      primaryContainer: '#7c2d12',
      onPrimary: '#431407',
      onPrimaryContainer: '#ffedd5',
      secondary: '#ef4444',
      secondaryHover: '#f87171',
      secondaryContainer: '#7f1d1d',
      onSecondary: '#450a0a',
      onSecondaryContainer: '#fee2e2',
      tertiary: '#10b981',
      tertiaryHover: '#34d399',
      tertiaryContainer: '#065f46',
      onTertiary: '#064e3b',
      onTertiaryContainer: '#d1fae5',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#60a5fa',
      error: '#f87171',
    },
    borderRadius: 12,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
  {
    id: 'high-contrast',
    name: '高对比度',
    description: '专为视觉障碍设计，高对比度配色',
    lightColors: {
      primary: '#000000',
      primaryHover: '#333333',
      primaryContainer: '#e5e5e5',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#000000',
      textPrimary: '#000000',
      textSecondary: '#333333',
      border: '#000000',
    },
    darkColors: {
      primary: '#FFFFFF',
      primaryHover: '#CCCCCC',
      primaryContainer: '#333333',
      onPrimary: '#000000',
      onPrimaryContainer: '#FFFFFF',
      textPrimary: '#FFFFFF',
      textSecondary: '#CCCCCC',
      border: '#FFFFFF',
    },
    borderRadius: 8,
    shadowIntensity: 1,
    density: 'comfortable',
    fontSize: 18,
    fontFamily: FONT_OPTIONS[1].family,
  },
  {
    id: 'minimal',
    name: '极简主题',
    description: '简洁清爽，减少视觉干扰',
    lightColors: {
      primary: '#374151',
      primaryHover: '#1F2937',
      primaryContainer: '#e5e7eb',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#374151',
      secondary: '#6B7280',
      secondaryContainer: '#f3f4f6',
      tertiary: '#4B5563',
      border: 'rgba(107,114,128,0.15)',
    },
    darkColors: {
      primary: '#E5E7EB',
      primaryHover: '#F3F4F6',
      primaryContainer: '#374151',
      onPrimary: '#111827',
      onPrimaryContainer: '#E5E7EB',
      secondary: '#9CA3AF',
      secondaryContainer: '#374151',
      tertiary: '#D1D5DB',
      border: 'rgba(156,163,175,0.15)',
    },
    borderRadius: 6,
    shadowIntensity: 1,
    density: 'compact',
    fontSize: 15,
    fontFamily: FONT_OPTIONS[0].family,
  },
  {
    id: 'ocean',
    name: '海洋蓝',
    description: '清新科技感，蓝色系配色',
    lightColors: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryContainer: '#dbeafe',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#1e40af',
      secondary: '#0891B2',
      secondaryContainer: '#e0f2fe',
      tertiary: '#7C3AED',
      tertiaryContainer: '#f3e8ff',
    },
    darkColors: {
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      primaryContainer: '#1e40af',
      onPrimary: '#1e3a8a',
      onPrimaryContainer: '#dbeafe',
      secondary: '#06B6D4',
      secondaryContainer: '#0e7490',
      tertiary: '#8B5CF6',
      tertiaryContainer: '#4c1d95',
    },
    borderRadius: 14,
    shadowIntensity: 2,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
  {
    id: 'google-light',
    name: 'Google 浅色',
    description: '符合Google Light Color Scheme的专业配色方案，现代、简洁、专业',
    lightColors: {
      primary: '#4285F4',
      primaryHover: '#3367D6',
      primaryContainer: '#E8F0FE',
      onPrimary: '#FFFFFF',
      onPrimaryContainer: '#1A3A78',
      secondary: '#34A853',
      secondaryHover: '#2D9249',
      secondaryContainer: '#E6F4EA',
      onSecondary: '#FFFFFF',
      onSecondaryContainer: '#1B3421',
      tertiary: '#FBBC04',
      tertiaryHover: '#F29900',
      tertiaryContainer: '#FFF8E1',
      onTertiary: '#FFFFFF',
      onTertiaryContainer: '#3D2C00',
      success: '#34A853',
      warning: '#FBBC04',
      info: '#4285F4',
      error: '#EA4335',
    },
    darkColors: {
      primary: '#8AB4F8',
      primaryHover: '#A8C7FA',
      primaryContainer: '#1A3A78',
      onPrimary: '#1A3A78',
      onPrimaryContainer: '#E8F0FE',
      secondary: '#81C995',
      secondaryHover: '#A3D9B1',
      secondaryContainer: '#1B3421',
      onSecondary: '#1B3421',
      onSecondaryContainer: '#E6F4EA',
      tertiary: '#FCD277',
      tertiaryHover: '#FDE49C',
      tertiaryContainer: '#3D2C00',
      onTertiary: '#3D2C00',
      onTertiaryContainer: '#FFF8E1',
      success: '#81C995',
      warning: '#FCD277',
      info: '#8AB4F8',
      error: '#F8A89B',
    },
    borderRadius: 8,
    shadowIntensity: 1,
    density: 'comfortable',
    fontSize: 16,
    fontFamily: FONT_OPTIONS[0].family,
  },
];

// 从专业主题预设中获取默认配置
const DEFAULT_THEME = COMPLETE_THEME_PRESETS.find(p => p.id === 'professional-green');
const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'light',
  animation: true,
  density: DEFAULT_THEME?.density || 'comfortable',
  fontSize: DEFAULT_THEME?.fontSize || 16,
  fontFamily: DEFAULT_THEME?.fontFamily || FONT_OPTIONS[0].family,
  fontColor: '#0f172a',
  // 新增字体配置默认值
  fontWeight: 400,
  lineHeight: 1.5,
  letterSpacing: 0,
  accentColor: DEFAULT_THEME?.lightColors.primary || '#059669',
  sidebarCollapsed: false,
  borderRadius: DEFAULT_THEME?.borderRadius || 12,
  shadowIntensity: DEFAULT_THEME?.shadowIntensity || 2,
  customColors: {
    light: DEFAULT_THEME?.lightColors || {},
    dark: DEFAULT_THEME?.darkColors || {},
  },
  cloudSync: false,
  // 侧边栏透明度默认设置
  sidebarTransparent: true,
  sidebarOpacity: 0.9,
};

// ========== 存储与工具函数 ==========
const STORAGE_KEY = 'rmfood-theme-settings-v2';

interface ThemeContextType {
  settings: ThemeSettings;
  updateSettings: (newSettings: Partial<ThemeSettings>) => void;
  resetSettings: () => void;
  applyTheme: () => void;
  isDark: boolean;
  isAutoMode: boolean;
  applyPreset: (presetId: string) => void;
  getCurrentColors: () => ColorScheme;
  checkContrast: (color1: string, color2: string) => number;
  meetsWCAGAA: (color1: string, color2: string) => boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * 兼容层：useTheme Hook
 *
 * 智能检测环境并返回正确的主题上下文：
 * 1. 优先从新版 Zustand Store 获取数据（推荐）
 * 2. 回退到旧版 Context（向后兼容）
 * 3. 最终回退到默认值（防止崩溃）
 */
export const useTheme = (): ThemeContextType => {
  // 尝试从 Context 获取（旧版 Provider）
  const context = useContext(ThemeContext);

  if (context) {
    return context;
  }

  // 如果没有 Context，尝试从新版 Zustand Store 获取
  try {
    const { useThemeStore: newStore } = require('@/stores/themeStore');

    const store = newStore.getState();

    return {
      settings: {
        mode: store.mode === 'system' ? 'auto' : (store.mode || 'light'),
        animation: !store.motionPreferences?.reducedMotion,
        density: 'comfortable',
        fontSize: 16,
        fontFamily: "'Microsoft YaHei', system-ui, sans-serif",
        fontColor: '#1f2937',
        // 新增字体配置默认值
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        accentColor: store.activeTheme?.colors?.primary?.main || '#2563eb',
        sidebarCollapsed: false,
        borderRadius: 8,
        shadowIntensity: 2,
        customColors: { light: {}, dark: {} },
        cloudSync: false,
        sidebarTransparent: false,
        sidebarOpacity: 0.5,
      },
      updateSettings: (newSettings) => {
        try {
          if (newSettings.mode) {
            const newMode = newSettings.mode === 'auto' ? 'system' : newSettings.mode;
            store.setThemeMode(newMode as any);
          }
          if (newSettings.accentColor !== undefined) {
            logger.info('[Legacy useTheme] accentColor change not fully supported in new system');
          }
        } catch (err) {
          logger.warn('[Legacy useTheme] Failed to update settings:', err);
        }
      },
      resetSettings: () => {
        try {
          store.resetToDefault();
        } catch (err) {
          logger.warn('[Legacy useTheme] Failed to reset:', err);
        }
      },
      applyTheme: () => {
        logger.info('[Legacy useTheme] applyTheme() - auto-applied by new ThemeProvider');
      },
      isDark: store.mode === 'dark' || (store.mode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches),
      isAutoMode: store.mode === 'system',
      applyPreset: (presetId) => {
        try {
          store.setPresetTheme(presetId as any);
        } catch (err) {
          logger.warn('[Legacy useTheme] Failed to apply preset:', err);
        }
      },
      getCurrentColors: () => {
        const colors = store.activeTheme?.colors;
        return {
          primary: colors?.primary?.main || '#059669',
          primaryHover: colors?.primary?.light || '#047857',
          primaryContainer: colors?.primary?.main + '20' || '#d1fae5',
          onPrimary: colors?.primary?.contrastText || '#ffffff',
          onPrimaryContainer: '#064e3b',
          secondary: colors?.secondary?.main || '#6b7280',
          secondaryHover: colors?.secondary?.light || '#4b5563',
          secondaryContainer: '#e5e7eb',
          onSecondary: '#1f2937',
          onSecondaryContainer: '#1f2937',
          tertiary: colors?.accent?.main || '#0ea5e9',
          tertiaryHover: colors?.accent?.light || '#0284c7',
          tertiaryContainer: '#cffafe',
          onTertiary: '#ffffff',
          onTertiaryContainer: '#164e63',
          background: colors?.background?.default || '#ffffff',
          surface: colors?.background?.elevated || '#f9fafb',
          surfaceVariant: '#f3f4f6',
          onBackground: colors?.text?.primary || '#111827',
          onSurface: colors?.text?.primary || '#111827',
          onSurfaceVariant: colors?.text?.secondary || '#6b7280',
          outline: colors?.border?.default || '#d1d5db',
          outlineVariant: '#e5e7eb',
          error: colors?.error?.main || '#dc2626',
          errorContainer: '#fee2e2',
          onError: '#ffffff',
          onErrorContainer: '#991b1b',
          success: colors?.success?.main || '#16a34a',
          warning: colors?.warning?.main || '#f59e0b',
          info: colors?.info?.main || '#3b82f6',
          textPrimary: colors?.text?.primary || '#111827',
          textSecondary: colors?.text?.secondary || '#6b7280',
          textMuted: colors?.text?.disabled || '#9ca3af',
          border: colors?.border?.default || '#e5e7eb',
          surfaceTint: colors?.primary?.main || '#059669',
          inverseSurface: '#1f2937',
          inverseOnSurface: '#f9fafb',
          inversePrimary: '#34d399',
          scrim: 'rgba(0, 0, 0, 0.32)',
        };
      },
      checkContrast: getContrastRatio,
      meetsWCAGAA: (color1, color2) => checkWCAGAACompliance(getContrastRatio(color1, color2)),
    };
  } catch (storeError) {
    logger.warn(
      '[useTheme] ⚠️ Used outside both old and new ThemeProviders.\n' +
      'Returning default values to prevent crash.\n' +
      'Please wrap your application with <ThemeProvider> from "@/stores/ThemeProvider".',
    );

    return {
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
      resetSettings: () => {},
      applyTheme: () => {},
      isDark: false,
      isAutoMode: false,
      applyPreset: () => {},
      getCurrentColors: () => DEFAULT_LIGHT_COLORS,
      checkContrast: getContrastRatio,
      meetsWCAGAA: (c1, c2) => checkWCAGAACompliance(getContrastRatio(c1, c2)),
    };
  }
};

const getStoredSettings = (): ThemeSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return mergeWithDefaults(JSON.parse(stored));
    }
  } catch (e) {
    logger.warn('Failed to load theme settings:', e);
  }
  return DEFAULT_SETTINGS;
};

const mergeWithDefaults = (stored: Partial<ThemeSettings>): ThemeSettings => {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    customColors: {
      light: { ...DEFAULT_SETTINGS.customColors.light, ...stored.customColors?.light },
      dark: { ...DEFAULT_SETTINGS.customColors.dark, ...stored.customColors?.dark },
    },
  };
};

const storeSettings = (settings: ThemeSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    logger.warn('Failed to save theme settings:', e);
  }
};

// ========== 颜色工具函数 ==========
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // 处理 3 位的十六进制颜色代码
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return 1;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function checkWCAGAACompliance(contrast: number, largeText = false): boolean {
  return largeText ? contrast >= 3 : contrast >= 4.5;
}

// 生成不同深浅的颜色
function generateColorVariants(baseColor: string) {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return {};

  const variants: Record<string, string> = {};
  const intensities = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const names = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

  intensities.forEach((intensity, i) => {
    const isDarken = i > 4;
    const factor = isDarken ? 1 - (intensity - 0.5) * 2 : 1 - intensity;
    variants[names[i]] = `rgba(${Math.round(rgb.r * factor)}, ${Math.round(rgb.g * factor)}, ${Math.round(rgb.b * factor)}, ${isDarken ? 1 : 1 - intensity})`;
  });

  return variants;
}

// ========== Theme Provider ==========
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(getStoredSettings);
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>(settings.mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.mode);
  const isDark = resolvedMode === 'dark';
  const isAutoMode = settings.mode === 'auto';

  // 合并获取当前有效的颜色方案
  const getCurrentColors = useCallback((): ColorScheme => {
    const baseColors = isDark ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
    const customColors = isDark ? settings.customColors.dark : settings.customColors.light;
    return { ...baseColors, ...customColors, primary: settings.accentColor || baseColors.primary };
  }, [settings, isDark]);

  // 检查对比度
  const checkContrast = useCallback((color1: string, color2: string): number => {
    return getContrastRatio(color1, color2);
  }, []);

  // 检查是否符合 WCAG 2.1 AA
  const meetsWCAGAA = useCallback((color1: string, color2: string, largeText = false): boolean => {
    const ratio = getContrastRatio(color1, color2);
    return checkWCAGAACompliance(ratio, largeText);
  }, []);

  // 应用主题预设
  const applyPreset = useCallback((presetId: string) => {
    const preset = COMPLETE_THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSettings(prev => ({
        ...prev,
        customColors: {
          light: { ...prev.customColors.light, ...preset.lightColors },
          dark: { ...prev.customColors.dark, ...preset.darkColors },
        },
        borderRadius: preset.borderRadius,
        shadowIntensity: preset.shadowIntensity,
        density: preset.density,
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        accentColor: (isDark ? preset.darkColors.primary : preset.lightColors.primary) || preset.lightColors.primary || '#059669',
      }));
    }
  }, [isDark]);

  // 应用主题到 DOM
  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    const colors = getCurrentColors();
    const primaryRgb = hexToRgb(colors.primary);
    const primaryRgba = primaryRgb ? `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}` : '5, 150, 105';

    // 根据动画设置控制过渡效果
    if (settings.animation) {
      root.classList.add('theme-transition', 'theme-animations-enabled');
      root.classList.remove('reduce-motion');
    } else {
      root.classList.remove('theme-transition', 'theme-animations-enabled');
      root.classList.add('reduce-motion');
    }

    // 明暗模式
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // 应用颜色变量 - Material Design 3 标准

    // 主色调
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-rgb', primaryRgba);
    root.style.setProperty('--color-primary-hover', colors.primaryHover);
    root.style.setProperty('--color-primary-container', colors.primaryContainer);
    root.style.setProperty('--color-on-primary', colors.onPrimary);
    root.style.setProperty('--color-on-primary-container', colors.onPrimaryContainer);

    // 表面色 RGB 值（用于半透明效果）
    const surfaceRgb = hexToRgb(colors.surface);
    const surfaceRgba = surfaceRgb ? `${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}` : '255, 255, 255';
    root.style.setProperty('--color-surface-rgb', surfaceRgba);

    // 辅助色调
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-secondary-hover', colors.secondaryHover);
    root.style.setProperty('--color-secondary-container', colors.secondaryContainer);
    root.style.setProperty('--color-on-secondary', colors.onSecondary);
    root.style.setProperty('--color-on-secondary-container', colors.onSecondaryContainer);

    // 第三色调
    root.style.setProperty('--color-tertiary', colors.tertiary);
    root.style.setProperty('--color-tertiary-hover', colors.tertiaryHover);
    root.style.setProperty('--color-tertiary-container', colors.tertiaryContainer);
    root.style.setProperty('--color-on-tertiary', colors.onTertiary);
    root.style.setProperty('--color-on-tertiary-container', colors.onTertiaryContainer);

    // 基础色
    root.style.setProperty('--bg-primary', colors.background);
    root.style.setProperty('--bg-secondary', colors.surface);
    root.style.setProperty('--bg-surface', colors.surface);
    root.style.setProperty('--bg-surface-variant', colors.surfaceVariant);
    root.style.setProperty('--color-on-background', colors.onBackground);
    root.style.setProperty('--color-on-surface', colors.onSurface);
    root.style.setProperty('--color-on-surface-variant', colors.onSurfaceVariant);

    // 边缘和轮廓
    root.style.setProperty('--color-outline', colors.outline);
    root.style.setProperty('--color-outline-variant', colors.outlineVariant);

    // 功能性颜色
    root.style.setProperty('--color-error', colors.error);
    root.style.setProperty('--color-error-container', colors.errorContainer);
    root.style.setProperty('--color-on-error', colors.onError);
    root.style.setProperty('--color-on-error-container', colors.onErrorContainer);

    // 状态颜色
    root.style.setProperty('--color-success', colors.success);
    root.style.setProperty('--color-warning', colors.warning);
    root.style.setProperty('--color-info', colors.info);

    // 文本颜色
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);

    // 边框
    root.style.setProperty('--border-color', colors.border);

    // Surface Tint (Material Design 3)
    root.style.setProperty('--color-surface-tint', colors.surfaceTint);

    // Scrim (覆盖层)
    root.style.setProperty('--color-scrim', colors.scrim);

    // 背景变体
    root.style.setProperty('--color-inverse-surface', colors.inverseSurface);
    root.style.setProperty('--color-inverse-on-surface', colors.inverseOnSurface);
    root.style.setProperty('--color-inverse-primary', colors.inversePrimary);

    // 顶栏和悬停背景
    root.style.setProperty('--header-bg', colors.surface);
    root.style.setProperty('--hover-bg', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)');

    // 生成主色调变体
    if (primaryRgb) {
      root.style.setProperty('--color-primary-50', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05)`);
      root.style.setProperty('--color-primary-100', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);
      root.style.setProperty('--color-primary-200', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`);
      root.style.setProperty('--color-primary-300', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.3)`);
      root.style.setProperty('--color-primary-400', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.4)`);
      root.style.setProperty('--color-primary-500', colors.primary);
      root.style.setProperty('--color-primary-600', `rgba(${Math.round(primaryRgb.r * 0.75)}, ${Math.round(primaryRgb.g * 0.75)}, ${Math.round(primaryRgb.b * 0.75)}, 1)`);
      root.style.setProperty('--color-primary-700', `rgba(${Math.round(primaryRgb.r * 0.6)}, ${Math.round(primaryRgb.g * 0.6)}, ${Math.round(primaryRgb.b * 0.6)}, 1)`);
      root.style.setProperty('--color-primary-800', `rgba(${Math.round(primaryRgb.r * 0.4)}, ${Math.round(primaryRgb.g * 0.4)}, ${Math.round(primaryRgb.b * 0.4)}, 1)`);
      root.style.setProperty('--color-primary-900', `rgba(${Math.round(primaryRgb.r * 0.25)}, ${Math.round(primaryRgb.g * 0.25)}, ${Math.round(primaryRgb.b * 0.25)}, 1)`);
    }

    // 字体设置 - Material Design 3 标准
    root.style.setProperty('--font-family-sans', settings.fontFamily);
    root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
    root.style.setProperty('--font-size-sm', `${settings.fontSize - 2}px`);
    root.style.setProperty('--font-size-lg', `${settings.fontSize + 2}px`);
    root.style.setProperty('--font-size-xl', `${settings.fontSize + 4}px`);
    root.style.setProperty('--font-size-2xl', `${settings.fontSize + 8}px`);
    root.style.setProperty('--font-size-3xl', `${settings.fontSize + 12}px`);

    // 字重系统
    root.style.setProperty('--font-weight-light', '300');
    root.style.setProperty('--font-weight-normal', '400');
    root.style.setProperty('--font-weight-medium', '500');
    root.style.setProperty('--font-weight-semibold', '600');
    root.style.setProperty('--font-weight-bold', '700');

    // 行高规则
    root.style.setProperty('--line-height-tight', '1.2');
    root.style.setProperty('--line-height-normal', '1.5');
    root.style.setProperty('--line-height-relaxed', '1.6');

    // 圆角设置 - Material Design 3 标准
    const br = settings.borderRadius;
    root.style.setProperty('--radius-none', '0px');
    root.style.setProperty('--radius-sm', `${Math.max(4, br - 8)}px`);
    root.style.setProperty('--radius-md', `${Math.max(6, br - 4)}px`);
    root.style.setProperty('--radius-lg', `${br}px`);
    root.style.setProperty('--radius-xl', `${br + 4}px`);
    root.style.setProperty('--radius-2xl', `${br + 8}px`);
    root.style.setProperty('--radius-3xl', `${br + 12}px`);
    root.style.setProperty('--radius-full', '9999px');

    // 阴影层级 - Material Design 3 标准
    const shadowMultiplier = [0.3, 0.6, 1, 1.4, 1.8][settings.shadowIntensity];
    root.style.setProperty('--shadow-multiplier', shadowMultiplier.toString());
    root.style.setProperty('--shadow-sm', `0 ${1 * shadowMultiplier}px ${2 * shadowMultiplier}px 0 rgba(0, 0, 0, 0.05)`);
    root.style.setProperty('--shadow-md', `0 ${4 * shadowMultiplier}px ${6 * shadowMultiplier}px -1px rgba(0, 0, 0, 0.1)`);
    root.style.setProperty('--shadow-lg', `0 ${10 * shadowMultiplier}px ${15 * shadowMultiplier}px -3px rgba(0, 0, 0, 0.1)`);
    root.style.setProperty('--shadow-xl', `0 ${20 * shadowMultiplier}px ${25 * shadowMultiplier}px -5px rgba(0, 0, 0, 0.1)`);
    root.style.setProperty('--shadow-2xl', `0 ${25 * shadowMultiplier}px ${50 * shadowMultiplier}px -12px rgba(0, 0, 0, 0.25)`);

    // Material Design 3 Elevation Tokens (基于3dp, 6dp, 8dp, 12dp标准)
    const elevationMultiplier = [1, 2, 3, 4, 5][settings.shadowIntensity];
    root.style.setProperty('--elevation-0', 'none');
    root.style.setProperty('--elevation-1', `0 1px ${2 * elevationMultiplier}px 0 rgba(0,0,0,0.05), 0 1px ${3 * elevationMultiplier}px 0 rgba(0,0,0,0.1)`);
    root.style.setProperty('--elevation-2', `0 ${2 * elevationMultiplier}px ${4 * elevationMultiplier}px 0 rgba(0,0,0,0.1), 0 ${4 * elevationMultiplier}px ${6 * elevationMultiplier}px 0 rgba(0,0,0,0.1)`);
    root.style.setProperty('--elevation-3', `0 ${4 * elevationMultiplier}px ${8 * elevationMultiplier}px 0 rgba(0,0,0,0.1), 0 ${6 * elevationMultiplier}px ${12 * elevationMultiplier}px 0 rgba(0,0,0,0.1)`);
    root.style.setProperty('--elevation-4', `0 ${6 * elevationMultiplier}px ${12 * elevationMultiplier}px 0 rgba(0,0,0,0.15), 0 ${8 * elevationMultiplier}px ${16 * elevationMultiplier}px 0 rgba(0,0,0,0.1)`);
    root.style.setProperty('--elevation-5', `0 ${8 * elevationMultiplier}px ${16 * elevationMultiplier}px 0 rgba(0,0,0,0.15), 0 ${12 * elevationMultiplier}px ${24 * elevationMultiplier}px 0 rgba(0,0,0,0.15)`);

    // Material Design 3 State Layer Tokens (opacity值)
    root.style.setProperty('--state-layer-hover', '0.08');
    root.style.setProperty('--state-layer-focus', '0.12');
    root.style.setProperty('--state-layer-pressed', '0.12');
    root.style.setProperty('--state-layer-dragged', '0.16');

    // Material Design 3 Motion Tokens
    root.style.setProperty('--motion-duration-1', '50ms');
    root.style.setProperty('--motion-duration-2', '100ms');
    root.style.setProperty('--motion-duration-3', '150ms');
    root.style.setProperty('--motion-duration-4', '200ms');
    root.style.setProperty('--motion-duration-5', '250ms');
    root.style.setProperty('--motion-easing-standard', 'cubic-bezier(0.2, 0, 0, 1)');
    root.style.setProperty('--motion-easing-emphasized', 'cubic-bezier(0.2, 0, 0, 1)');
    root.style.setProperty('--motion-easing-decelerated', 'cubic-bezier(0, 0, 0.2, 1)');
    root.style.setProperty('--motion-easing-accelerated', 'cubic-bezier(0.4, 0, 1, 1)');

    // 间距系统 - 基于8px基础单位
    const densityMap: Record<InterfaceDensity, string> = {
      compact: '12px',
      comfortable: '16px',
      spacious: '24px',
    };
    root.style.setProperty('--spacing-unit', densityMap[settings.density]);
    root.style.setProperty('--spacing-xs', `${parseFloat(densityMap[settings.density]) * 0.25}px`);  // 4px
    root.style.setProperty('--spacing-sm', `${parseFloat(densityMap[settings.density]) * 0.5}px`);   // 8px
    root.style.setProperty('--spacing-md', densityMap[settings.density]);                              // 16px
    root.style.setProperty('--spacing-lg', `${parseFloat(densityMap[settings.density]) * 1.5}px`);   // 24px
    root.style.setProperty('--spacing-xl', `${parseFloat(densityMap[settings.density]) * 2}px`);     // 32px
    root.style.setProperty('--spacing-2xl', `${parseFloat(densityMap[settings.density]) * 3}px`);    // 48px

    // 侧边栏透明度设置
    root.style.setProperty('--sidebar-transparent', settings.sidebarTransparent ? '1' : '0');
    root.style.setProperty('--sidebar-opacity', settings.sidebarOpacity.toString());
    root.style.setProperty('--sidebar-bg-opacity', settings.sidebarTransparent ? settings.sidebarOpacity.toString() : '1');
  }, [settings, isDark, getCurrentColors]);

  // 监听系统主题变化（自动模式）
  useEffect(() => {
    if (settings.mode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setResolvedMode(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setResolvedMode(settings.mode);
    }
  }, [settings.mode]);

  // 主题切换后清理过渡类 - 防止过渡效果累积
  useEffect(() => {
    const root = document.documentElement;
    const timeoutId = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [isDark, settings.animation]);

  // 应用主题并保存
  useEffect(() => {
    applyTheme();
    storeSettings(settings);
  }, [settings, applyTheme]);

  // 更新设置
  const updateSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // 重置设置
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <ThemeContext.Provider value={{
      settings,
      updateSettings,
      resetSettings,
      applyTheme,
      isDark,
      isAutoMode,
      applyPreset,
      getCurrentColors,
      checkContrast,
      meetsWCAGAA,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ========== Hook 导出 ==========
export const useThemeSettings = () => {
  const { settings, updateSettings, resetSettings, applyPreset } = useTheme();

  const setMode = (mode: ThemeMode) => updateSettings({ mode });
  const setAnimation = (animation: boolean) => updateSettings({ animation });
  const setDensity = (density: InterfaceDensity) => updateSettings({ density });
  const setFontSize = (fontSize: number) => updateSettings({ fontSize });
  const setFontFamily = (fontFamily: string) => updateSettings({ fontFamily });
  const setFontColor = (fontColor: string) => updateSettings({ fontColor });
  const setAccentColor = (accentColor: string) => updateSettings({ accentColor });
  const setBorderRadius = (borderRadius: number) => updateSettings({ borderRadius });
  const setShadowIntensity = (shadowIntensity: ShadowIntensity) => updateSettings({ shadowIntensity });
  const setCustomColors = (mode: 'light' | 'dark', colors: Partial<ColorScheme>) =>
    updateSettings({
      customColors: {
        ...settings.customColors,
        [mode]: { ...settings.customColors[mode], ...colors },
      },
    });
  const setCloudSync = (cloudSync: boolean) => updateSettings({ cloudSync });
  const setSidebarCollapsed = (sidebarCollapsed: boolean) => updateSettings({ sidebarCollapsed });
  const setSidebarTransparent = (sidebarTransparent: boolean) => updateSettings({ sidebarTransparent });
  const setSidebarOpacity = (sidebarOpacity: number) => updateSettings({ sidebarOpacity });

  return {
    settings,
    setMode,
    setAnimation,
    setDensity,
    setFontSize,
    setFontFamily,
    setFontColor,
    setAccentColor,
    setBorderRadius,
    setShadowIntensity,
    setCustomColors,
    setCloudSync,
    setSidebarCollapsed,
    setSidebarTransparent,
    setSidebarOpacity,
    applyPreset,
    resetSettings,
  };
};

// 导出工具函数供外部使用
// 为了向后兼容性保留旧版本的 SettingsPage 而添加
export const FONT_COLOR_PRESETS = [
  { id: 'default', name: '默认黑', color: '#0f172a' },
  { id: 'dark-gray', name: '深灰', color: '#334155' },
  { id: 'navy', name: '藏青', color: '#1e3a8a' },
  { id: 'forest', name: '森林绿', color: '#059669' },
  { id: 'ocean', name: '海洋蓝', color: '#2563eb' },
  { id: 'purple', name: '紫罗兰', color: '#7c3aed' },
  { id: 'rose', name: '玫瑰红', color: '#e11d48' },
  { id: 'amber', name: '琥珀', color: '#d97706' },
];

export const THEME_PRESETS = [
  { id: 'forest', name: '森林绿', accentColor: '#059669', description: '自然、健康，专业' },
  { id: 'ocean', name: '海洋蓝', accentColor: '#2563EB', description: '科技、清晰、信任' },
  { id: 'purple', name: '生物紫', accentColor: '#7C3AED', description: '创新、智能、前沿' },
  { id: 'teal', name: '科技青', accentColor: '#0891B2', description: '现代、活力' },
  { id: 'google-light', name: 'Google 浅色', accentColor: '#4285F4', description: '现代、简洁、专业' },
];

export const colorUtils = {
  hexToRgb,
  rgbToHsl,
  getContrastRatio,
  checkWCAGAACompliance,
  generateColorVariants,
};
