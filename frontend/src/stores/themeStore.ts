/**
 * RMFOOD 主题系统 - Zustand 状态管理
 * 专业级主题切换、持久化存储、辅助功能支持
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ThemeStore,
  ThemeState,
  ThemeConfig,
  ThemeMode,
  AccessibilityMode,
  TransitionType,
  PresetThemeId,
  CustomThemeOverrides,
  MotionPreferences,
} from '../types/theme.types';
import {
  presetThemes,
  getAccessibilityTheme,
  mergeThemeOverrides,
  applyThemeToDOM,
} from './theme.presets';
import { themeStorage } from './theme.storage';
import { logger } from '@/utils/safeLogger';


// ============================================================================
// 主题ID验证与迁移工具
// ============================================================================

/**
 * 验证主题ID是否有效
 * 用于在从localStorage恢复状态时检查主题是否存在
 */
function isValidThemeId(themeId: string): boolean {
  return themeId in presetThemes;
}

/**
 * 获取有效的主题ID（如果当前无效则回退到默认值）
 */
function getValidThemeId(currentId: string): PresetThemeId {
  if (isValidThemeId(currentId)) {
    return currentId as PresetThemeId;
  }

  // 旧版本主题ID映射表（用于平滑迁移）
  const legacyThemeMap: Record<string, PresetThemeId> = {
    'google-light': 'light-default',
    'google-dark': 'dark-default',
    'material-light': 'light-warm',
    'material-dark': 'dark-default',
    'apple-light': 'light-cool',
    'apple-dark': 'dark-oled',
  };

  // 检查是否是旧版主题ID
  if (currentId in legacyThemeMap) {
    const mappedId = legacyThemeMap[currentId];
    if (mappedId) {
      logger.log(`[Theme System] 🔄 迁移旧主题ID: ${currentId} → ${mappedId}`);
      return mappedId;
    }
  }

  // 完全无效，使用默认主题
  logger.warn(`[Theme System] ⚠️ 无效的主题ID: ${currentId}，使用默认主题`);
  return 'light-default';
}

// ============================================================================
// 初始状态
// ============================================================================

const initialState: ThemeState = {
  activeThemeId: 'light-default',
  activeTheme: presetThemes['light-default'],
  mode: 'system',
  accessibilityMode: 'normal',
  motionPreferences: {
    reducedMotion: false,
    disableAnimations: false,
    scaleDownTransitions: false,
  },
  transitionType: 'fade',
  isTransitioning: false,
  customThemes: [],
  isInitialized: false,
};

// ============================================================================
// Theme Store 创建
// ============================================================================

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // ==================== State ====================
      ...initialState,

      // ==================== Actions ====================

      /**
       * 初始化主题系统
       * 检测系统偏好、加载持久化配置、应用初始主题
       */
      initialize: async () => {
        const state = get();

        try {
          // 1. 检测系统颜色方案偏好
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const systemMode: ThemeMode = prefersDark ? 'dark' : 'light';

          // 2. 检测 reduced motion 偏好
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          // 3. 计算实际应用的主题模式
          let effectiveMode = state.mode;
          if (state.mode === 'system') {
            effectiveMode = systemMode;
          }

          // 4. 获取基础主题配置
          let baseTheme = presetThemes[state.activeThemeId as PresetThemeId];

          // 防御性检查：如果主题ID无效，回退到默认主题
          if (!baseTheme) {
            logger.warn('[Theme System] ⚠️ 无效的主题ID:', state.activeThemeId, '，回退到默认主题');
            baseTheme = presetThemes['light-default'];
          }

          // 如果是辅助功能模式，获取对应的辅助功能主题变体
          if (state.accessibilityMode !== 'normal') {
            baseTheme = getAccessibilityTheme(baseTheme, state.accessibilityMode);
          }

          // 5. 应用运动偏好
          const motionPrefs: MotionPreferences = {
            ...state.motionPreferences,
            reducedMotion: prefersReducedMotion || state.motionPreferences.reducedMotion,
          };

          // 6. 更新状态并应用主题
          set({
            activeTheme: baseTheme,
            motionPreferences: motionPrefs,
            isInitialized: true,
          });

          // 6.5 应用 reduced-motion 到 DOM（初始化时）
          if (motionPrefs.reducedMotion || motionPrefs.disableAnimations) {
            document.documentElement.classList.add('reduce-motion');
          }

          // 7. 应用到 DOM
          await applyThemeWithTransition(baseTheme, state.transitionType);

          logger.info('✅ [Theme System] Initialized successfully', {
            mode: effectiveMode,
            accessibility: state.accessibilityMode,
            reducedMotion: motionPrefs.reducedMotion,
          });
        } catch (error) {
          logger.error('❌ [Theme System] Initialization failed:', error);
          // 回退到默认主题
          set({
            activeTheme: presetThemes['light-default'],
            mode: 'light',
            isInitialized: true,
          });
        }
      },

      /**
       * 切换主题模式（light/dark/system）
       */
      setThemeMode: (mode: ThemeMode) => {
        const state = get();

        let effectiveMode = mode;

        // 如果选择 system，检测当前系统偏好
        if (mode === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          effectiveMode = prefersDark ? 'dark' : 'light';
        }

        // 根据新模式确定基础主题 ID
        let newBaseThemeId = state.activeThemeId;

        // 如果当前是预设主题且不是 system 相关的，需要映射到对应模式的版本
        if (!newBaseThemeId.includes('custom')) {
          // 映射逻辑：保持主题类型，只改变明暗模式
          const currentType = state.activeThemeId.split('-').slice(1).join('-');
          newBaseThemeId = `${effectiveMode}-${currentType}`;

          // 如果该模式+类型组合不存在，回退到默认
          if (!presetThemes[newBaseThemeId as PresetThemeId]) {
            newBaseThemeId = effectiveMode === 'dark' ? 'dark-default' : 'light-default';
          }
        }

        // 获取基础主题
        let newTheme = presetThemes[newBaseThemeId as PresetThemeId] || presetThemes['light-default'];

        // 应用辅助功能模式
        if (state.accessibilityMode !== 'normal') {
          newTheme = getAccessibilityTheme(newTheme, state.accessibilityMode);
        }

        // 更新状态并应用
        set({
          mode,
          activeThemeId: newBaseThemeId,
          activeTheme: newTheme,
        });

        applyThemeWithTransition(newTheme, state.transitionType);
      },

      /**
       * 切换到指定预设主题
       */
      setPresetTheme: (themeId: PresetThemeId) => {
        const state = get();

        // 获取预设主题
        let baseTheme = presetThemes[themeId] || presetThemes['light-default'];

        // 应用辅助功能模式
        if (state.accessibilityMode !== 'normal') {
          baseTheme = getAccessibilityTheme(baseTheme, state.accessibilityMode);
        }

        // 从主题 ID 推断模式
        const newMode = themeId.startsWith('dark-') ? 'dark' : 'light';

        set({
          activeThemeId: themeId,
          activeTheme: baseTheme,
          mode: newMode,
        });

        applyThemeWithTransition(baseTheme, state.transitionType);
      },

      /**
       * 应用自定义主题覆盖
       */
      applyCustomTheme: (overrides: CustomThemeOverrides) => {
        const state = get();

        // 合并自定义配置与当前主题
        const customTheme = mergeThemeOverrides(state.activeTheme, overrides);

        // 生成唯一 ID
        const customThemeId = `custom-${Date.now()}`;
        customTheme.id = customThemeId;
        customTheme.name = 'Custom Theme';
        customTheme.isPreset = false;

        // 更新状态
        set({
          activeThemeId: customThemeId,
          activeTheme: customTheme,
          customThemes: [...state.customThemes, customTheme],
        });

        applyThemeWithTransition(customTheme, state.transitionType);
      },

      /**
       * 设置辅助功能模式
       */
      setAccessibilityMode: (mode: AccessibilityMode) => {
        const state = get();

        // 获取当前基础主题（非辅助功能版本）
        let baseTheme = presetThemes[state.activeThemeId as PresetThemeId] || state.activeTheme;

        // 如果已经是辅助功能主题，尝试找到原始版本
        if (baseTheme.id.startsWith('high-contrast-') || baseTheme.id.startsWith('reading-')) {
          // 找到对应的基础主题
          const baseId = state.activeThemeId.replace(/^(high-contrast|reading)-/, '') as PresetThemeId;
          baseTheme = presetThemes[baseId] || presetThemes['light-default'];
        }

        // 应用辅助功能变体
        let finalTheme = baseTheme;
        if (mode !== 'normal') {
          finalTheme = getAccessibilityTheme(baseTheme, mode);
        }

        set({
          accessibilityMode: mode,
          activeTheme: finalTheme,
        });

        applyThemeWithTransition(finalTheme, state.transitionType);
      },

      /**
       * 设置运动偏好
       */
      setMotionPreferences: (prefs: Partial<MotionPreferences>) => {
        const state = get();
        const newPrefs = { ...state.motionPreferences, ...prefs };

        set({ motionPreferences: newPrefs });

        // 如果禁用动画或启用 reduced-motion，更新 DOM
        if (prefs.disableAnimations !== undefined || prefs.reducedMotion !== undefined) {
          document.documentElement.style.setProperty(
            '--transition-duration-multiplier',
            newPrefs.disableAnimations ? '0' : newPrefs.scaleDownTransitions ? '0.5' : '1',
          );

          // 设置 reduced-motion 媒体查询模拟
          if (newPrefs.disableAnimations || newPrefs.reducedMotion) {
            document.documentElement.classList.add('reduce-motion');
          } else {
            document.documentElement.classList.remove('reduce-motion');
          }
        }
      },

      /**
       * 切换过渡效果类型
       */
      setTransitionType: (type: TransitionType) => {
        set({ transitionType: type });
      },

      /**
       * 保存自定义主题到列表
       */
      saveCustomTheme: (theme: ThemeConfig) => {
        const state = get();
        const exists = state.customThemes.find(t => t.id === theme.id);

        let updatedThemes;
        if (exists) {
          updatedThemes = state.customThemes.map(t => t.id === theme.id ? theme : t);
        } else {
          updatedThemes = [...state.customThemes, theme];
        }

        set({ customThemes: updatedThemes });

        // 同时保存到持久化存储
        themeStorage.saveCustomThemes(updatedThemes);
      },

      /**
       * 删除自定义主题
       */
      deleteCustomTheme: (themeId: string) => {
        const state = get();
        const updatedThemes = state.customThemes.filter(t => t.id !== themeId);

        set({ customThemes: updatedThemes });
        themeStorage.saveCustomThemes(updatedThemes);

        // 如果删除的是当前激活的主题，回退到默认
        if (state.activeThemeId === themeId) {
          get().setPresetTheme('light-default');
        }
      },

      /**
       * 重置为默认主题
       */
      resetToDefault: () => {
        set({
          ...initialState,
          isInitialized: true,
        });

        applyThemeWithTransition(presetThemes['light-default'], 'fade');
      },

      /**
       * 导出主题配置为 JSON 字符串
       */
      exportTheme: (): string => {
        const state = get();
        return JSON.stringify({
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          theme: state.activeTheme,
          settings: {
            mode: state.mode,
            accessibilityMode: state.accessibilityMode,
            motionPreferences: state.motionPreferences,
            transitionType: state.transitionType,
          },
        }, null, 2);
      },

      /**
       * 导入主题配置
       */
      importTheme: (configJson: string): boolean => {
        try {
          const config = JSON.parse(configJson);

          if (config.theme?.colors) {
            const importedTheme: ThemeConfig = {
              ...config.theme,
              id: `imported-${Date.now()}`,
              name: config.theme.name || 'Imported Theme',
              isPreset: false,
            };

            get().saveCustomTheme(importedTheme);

            // 导入后自动应用
            set({
              activeThemeId: importedTheme.id,
              activeTheme: importedTheme,
            });

            applyThemeWithTransition(importedTheme, get().transitionType);

            return true;
          }

          return false;
        } catch (error) {
          logger.error('[Theme System] Import failed:', error);
          return false;
        }
      },
    }),
    {
      name: 'rmfood-theme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化关键状态，避免存储完整主题对象（太大）
        activeThemeId: state.activeThemeId,
        mode: state.mode,
        accessibilityMode: state.accessibilityMode,
        motionPreferences: state.motionPreferences,
        transitionType: state.transitionType,
        customThemes: state.customThemes.map(t => ({ ...t })),
      }),
      version: 3, // 版本号升级到3（添加主题ID验证）

      // 主题ID迁移与验证（v3新增）
      migrate: (persistedState: any, version) => {
        if (version === undefined || version < 3) {
          // v3之前的版本需要验证和修复activeThemeId
          if (persistedState && typeof persistedState === 'object' && 'activeThemeId' in persistedState) {
            const oldId = String(persistedState.activeThemeId);
            const validId = getValidThemeId(oldId);

            if (oldId !== validId) {
              logger.log(`[Theme System] 🔄 v${version || 1}→v3 迁移主题ID: ${oldId} → ${validId}`);
              persistedState.activeThemeId = validId;
            }
          }
        }

        return persistedState;
      },

      // 存储恢复后验证状态有效性
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // 验证并修复activeThemeId
        if (state.activeThemeId && !isValidThemeId(state.activeThemeId)) {
          logger.warn('[Theme System] ⚠️ 检测到无效的主题ID，正在修复...');
          const validId = getValidThemeId(state.activeThemeId);

          // 使用setTimeout避免在rehydration过程中直接修改状态
          setTimeout(() => {
            useThemeStore.setState({ activeThemeId: validId });
          }, 0);
        }
      },
    },
  ),
);

// ============================================================================
// 辅助函数：带过渡效果的应用主题
// ============================================================================

async function applyThemeWithTransition(theme: ThemeConfig, transitionType: TransitionType): Promise<void> {
  // 标记开始过渡
  useThemeStore.setState({ isTransitioning: true });

  try {
    switch (transitionType) {
      case 'fade':
        await applyFadeTransition(theme);
        break;
      case 'slide':
        await applySlideTransition(theme);
        break;
      case 'scale':
        await applyScaleTransition(theme);
        break;
      case 'none':
      default:
        applyThemeToDOM(theme);
        break;
    }
  } finally {
    // 过渡完成
    setTimeout(() => {
      useThemeStore.setState({ isTransitioning: false });
    }, 300); // 等待过渡动画完成
  }
}

/** 淡入淡出过渡 */
async function applyFadeTransition(theme: ThemeConfig): Promise<void> {
  const root = document.documentElement;

  // 淡出
  root.style.transition = 'opacity 0.15s ease-out';
  root.style.opacity = '0';

  await new Promise(resolve => setTimeout(resolve, 150));

  // 应用新主题
  applyThemeToDOM(theme);

  // 淡入
  root.style.opacity = '1';

  await new Promise(resolve => setTimeout(resolve, 150));

  // 清理
  root.style.removeProperty('transition');
}

/** 滑动过渡 */
async function applySlideTransition(theme: ThemeConfig): Promise<void> {
  const root = document.documentElement;

  // 向左滑出
  root.style.transition = 'transform 0.2s ease-in, opacity 0.2s ease-in';
  root.style.transform = 'translateX(-20px)';
  root.style.opacity = '0';

  await new Promise(resolve => setTimeout(resolve, 200));

  // 应用新主题
  applyThemeToDOM(theme);

  // 从右滑入
  root.style.transform = 'translateX(20px)';
  root.style.transition = 'none';

  requestAnimationFrame(() => {
    root.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
    root.style.transform = 'translateX(0)';
    root.style.opacity = '1';
  });

  await new Promise(resolve => setTimeout(resolve, 250));

  // 清理
  root.style.removeProperty('transform');
  root.style.removeProperty('transition');
  root.style.removeProperty('opacity');
}

/** 缩放过渡 */
async function applyScaleTransition(theme: ThemeConfig): Promise<void> {
  const root = document.documentElement;

  // 缩小 + 淡出
  root.style.transition = 'transform 0.15s ease-in, opacity 0.15s ease-in';
  root.style.transform = 'scale(0.98)';
  root.style.opacity = '0';

  await new Promise(resolve => setTimeout(resolve, 150));

  // 应用新主题
  applyThemeToDOM(theme);

  // 放大 + 淡入
  root.style.transform = 'scale(1.02)';
  root.style.transition = 'none';

  requestAnimationFrame(() => {
    root.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
    root.style.transform = 'scale(1)';
    root.style.opacity = '1';
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  // 清理
  root.style.removeProperty('transform');
  root.style.removeProperty('transition');
  root.style.removeProperty('opacity');
}

export default useThemeStore;
