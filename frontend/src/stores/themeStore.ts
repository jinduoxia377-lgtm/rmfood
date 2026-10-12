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
  // RUNTIME_THEME_ID 是运行时覆盖的稳定 ID（不落 presetThemes），
  // 必须放行 —— 否则 onRehydrateStorage 会把它判为无效并强制改回 light-default。
  return themeId in presetThemes || themeId === RUNTIME_THEME_ID;
}

/**
 * 获取有效的主题ID（如果当前无效则回退到默认值）
 */
function getValidThemeId(currentId: string): PresetThemeId {
  if (isValidThemeId(currentId)) {
    return currentId as PresetThemeId;
  }

  // 所有非当前预设的 ID 均视为已迁移/已删除，统一回退到 light-default
  // 原因：theme-cleanup 后 presetThemes 仅保留 light-default / dark-default
  const MIGRATED_IDS = new Set(['light-warm', 'light-cool', 'dark-warm', 'dark-cool', 'dark-oled',
    'high-contrast-light', 'high-contrast-dark', 'reading-sepia', 'reading-dark']);

  if (MIGRATED_IDS.has(currentId)) {
    logger.warn(`[Theme System] ⚠️ 已迁移主题ID: ${currentId}，原预设已删除，回退到 light-default`);
    return 'light-default';
  }

  // 完全无效，使用默认主题
  logger.warn(`[Theme System] ⚠️ 无效的主题ID: ${currentId}，使用默认主题`);
  return 'light-default';
}

// ============================================================================
// 无障碍 DOM 属性同步（D-39 修复）
// ----------------------------------------------------------------------------
// 必须在【初始化】与【交互切换】两条路径上都调用，否则刷新后属性丢失，
// 使 semantic-utils.css 中 [data-a11y-mode] / [data-reading-mode] 规则整层失效。
// ============================================================================

function syncA11yAttributes(mode: AccessibilityMode, themeMode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-a11y-mode', mode);
  if (mode === 'reading') {
    root.setAttribute('data-reading-mode', themeMode === 'dark' ? 'dark-read' : 'sepia');
  } else {
    root.removeAttribute('data-reading-mode');
  }
}

// ============================================================================
// 运行时覆盖合成（执行方案阶段 B1 / B2 —— R1 根治）
// ----------------------------------------------------------------------------
// R1 根因链：applyCustomTheme 用 `custom-${Date.now()}` 生成新 ID 并追加进 customThemes
// → initialize() 只用 `presetThemes[activeThemeId]` 查表 → 查不到 → warn「无效的主题ID」
// → 回退 light-default。用户在设置里选的配色/字号刷新即丢，且连带把 mode 打回亮色。
//
// 修复：覆盖以**幂等累计**的方式存进持久化的 runtimeOverrides，activeThemeId 用稳定
// ID；任何需要主题的代码路径都经 composeTheme() 重建（预设 × 覆盖 × 无障碍变体），
// 而不是各自拼一遍 —— 原先 setThemeMode / setPresetTheme / setAccessibilityMode
// 三条路径各自手搓 base 主题，漏掉了 runtimeOverrides 这一层。
// ============================================================================

/** 运行时自定义主题的稳定 ID（不再每次新建，避免 customThemes 无限膨胀） */
export const RUNTIME_THEME_ID = 'custom-runtime';

/** 覆盖对象是否非空 */
function hasOverrides(o: CustomThemeOverrides | undefined | null): o is CustomThemeOverrides {
  if (!o) return false;
  return !!(o.colors || o.typography || o.spacing || o.borderRadius || o.transitions);
}

/** 同维度浅合并（override 优先，缺省保留 prev） */
function mergeDim<T>(prev: T | undefined, next: T | undefined): T | undefined {
  if (!prev) return next;
  if (!next) return prev;
  return { ...prev, ...next };
}

/** 累计合并两次覆盖 */
function mergeCustomOverrides(
  prev: CustomThemeOverrides,
  next: CustomThemeOverrides,
): CustomThemeOverrides {
  return {
    colors: mergeDim(prev.colors, next.colors),
    typography: mergeDim(prev.typography, next.typography),
    spacing: mergeDim(prev.spacing, next.spacing),
    borderRadius: mergeDim(prev.borderRadius, next.borderRadius),
    transitions: mergeDim(prev.transitions, next.transitions),
  };
}

/**
 * 按当前 mode 解析底层预设 ID（system 时按系统实际偏好）。
 * 原先 initialize / setThemeMode / setAccessibilityMode 三处各自手写这段判断。
 */
function systemThemeIdFor(mode: ThemeMode): PresetThemeId {
  if (mode !== 'system') {
    return mode === 'dark' ? 'dark-default' : 'light-default';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark-default'
    : 'light-default';
}

/**
 * 合成最终主题：预设 × 运行时覆盖 × 无障碍变体。
 *
 * @param themeId  作为底层的预设 ID
 * @param overrides 持久化的运行时覆盖（可选）
 * @param a11yMode 无障碍模式（可选，normal 时不转换）
 */
function composeTheme(
  themeId: PresetThemeId,
  overrides?: CustomThemeOverrides,
  a11yMode: AccessibilityMode = 'normal',
): ThemeConfig {
  let theme = presetThemes[themeId] || presetThemes['light-default'];
  if (hasOverrides(overrides)) {
    theme = mergeThemeOverrides(theme, overrides);
    // 打上运行时 ID：data-theme 应反映「这是带覆盖的主题」；
    // 也令 isCleanBuiltinPreset 的第一条判定（id 不在 presetThemes）直接判非纯净，
    // 避免「id 仍是 light-default 但 colors 已被改」这种语义上自相矛盾的对象。
    theme = { ...theme, id: RUNTIME_THEME_ID, name: 'Custom Theme', isPreset: false };
  }
  if (a11yMode !== 'normal') {
    theme = getAccessibilityTheme(theme, a11yMode);
  }
  return theme;
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
  runtimeOverrides: {},
  paletteKey: '',
  fontScale: 'standard',
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
          // D-37 修复：mode==='system' 时**必须**按系统实际偏好选择预设，
          // 而非直接沿用持久化的 activeThemeId。原实现算了 effectiveMode 却只用于
          // 日志（见下方 logger），导致「跟随系统」在冷启动时失效 ——
          // 例如用户在亮色下把 mode 设为 system 后熄灯，下次冷启动仍应用亮色预设。
          const systemThemeId: PresetThemeId = systemThemeIdFor(effectiveMode);
          // B1：activeThemeId 可能是运行时自定义 ID（custom-runtime / 旧版 custom-* /
          // imported-*），presetThemes 查不到。这类 ID 必须按 mode 解析出预设，
          // 而不是落到下面「无效的主题ID」分支回退 light-default —— 那正是 R1 的表现：
          // 用户选了配色/字号后刷新，配色丢失且 mode 被连带打回亮色。
          const persistedId = state.activeThemeId as PresetThemeId;
          const resolvedThemeId: PresetThemeId =
            state.mode === 'system' || !presetThemes[persistedId]
              ? systemThemeId
              : persistedId;

          // resolvedThemeId 必为 systemThemeIdFor() 的两个合法返回值之一，
          // presetThemes 必然命中，故此处无需「无效 ID」回退分支 —— 该分支在旧实现里
          // 正是 R1 的触发点（查不到就回退亮色默认并丢覆盖），已随 composeTheme 移除。
          let baseTheme = composeTheme(
            resolvedThemeId,
            state.runtimeOverrides,
            state.accessibilityMode,
          );

          // 5. 应用运动偏好
          const motionPrefs: MotionPreferences = {
            ...state.motionPreferences,
            reducedMotion: prefersReducedMotion || state.motionPreferences.reducedMotion,
          };

          // 6. 更新状态并应用主题
          set({
            activeTheme: baseTheme,
            // D-37：system 模式下解析出的实际预设要回写，避免 activeThemeId 与
            // activeTheme 长期不一致。B1：带运行时覆盖时回写稳定 ID，
            // 使 activeThemeId 与 activeTheme（id=custom-runtime）保持一致。
            activeThemeId: hasOverrides(state.runtimeOverrides)
              ? RUNTIME_THEME_ID
              : resolvedThemeId,
            motionPreferences: motionPrefs,
            isInitialized: true,
          });

          // 6.5 应用 reduced-motion 到 DOM（初始化时）
          if (motionPrefs.reducedMotion || motionPrefs.disableAnimations) {
            document.documentElement.classList.add('reduce-motion');
          }

          // 7. 应用到 DOM
          // D-49 修复：首次应用必须【瞬时】，不得走过渡动画。
          // 原实现用 applyThemeWithTransition(..., 'fade')，会先把 <html> 设为 opacity:0 再淡入，
          // 与首屏 FOUC 叠加产生额外空白。用户可见的过渡只应发生在「用户主动切换」时。
          applyThemeToDOM(baseTheme);

          // 7.5 恢复持久化的过渡类型到 DOM（时长/缓动/即时类），使刷新后
          // 「切换过渡」选项与用户所选一致（setTransitionType 的 DOM 接线）。
          if (state.transitionType && state.transitionType !== 'fade') {
            get().setTransitionType(state.transitionType);
          }

          // D-39 修复：无障碍 DOM 属性必须在初始化路径同样写入，
          // 否则刷新后 data-a11y-mode / data-reading-mode 丢失，
          // 使 semantic-utils.css 的阅读/高对比规则整层失效。
          syncA11yAttributes(state.accessibilityMode, baseTheme.mode);

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

        // 根据新模式确定底层预设（mode 决定明暗，与是否带运行时覆盖无关）
        const baseThemeId: PresetThemeId = effectiveMode === 'dark' ? 'dark-default' : 'light-default';

        // B1：叠加持久化的运行时覆盖（配色/字号）—— 原实现只在 activeThemeId 不含
        // 'custom' 时才按 mode 换预设，一旦带了自定义 ID 就把上一次的覆盖结果当 base，
        // 明暗切换后覆盖语义彻底错乱。
        const newTheme = composeTheme(baseThemeId, state.runtimeOverrides, state.accessibilityMode);

        // 更新状态并应用
        set({
          mode,
          activeThemeId: hasOverrides(state.runtimeOverrides) ? RUNTIME_THEME_ID : baseThemeId,
          activeTheme: newTheme,
        });

        applyThemeWithTransition(newTheme, state.transitionType);
      },

      /**
       * 切换到指定预设主题
       */
      setPresetTheme: (themeId: PresetThemeId) => {
        const state = get();

        // B1：经 composeTheme 统一重建，切换预设后仍需叠加运行时覆盖（配色/字号）
        const baseTheme = composeTheme(themeId, state.runtimeOverrides, state.accessibilityMode);

        // D-34 修复：**不再**按 ID 前缀强写 mode。
        // 原实现 `const newMode = themeId.startsWith('dark-') ? 'dark' : 'light'` 会
        // 破坏「跟随系统」：mode==='system' 时，ThemeProvider 的系统偏好监听器会调用
        // setPresetTheme('dark-default'|'light-default')，而该赋值随即把 mode 改成
        // 'dark'/'light' → 用户**首次系统切换后就永久退出 system 模式**（规范 R-27 实测）。
        // mode 只应由 setThemeMode() 与系统监听器改变；DOM 侧由 activeTheme.mode
        // 驱动（applyThemeToDOM 用 theme.mode 设置 .dark / data-mode / colorScheme），
        // 因此不写 mode 也能正确切换外观。
        set({
          activeThemeId: themeId,
          activeTheme: baseTheme,
        });

        applyThemeWithTransition(baseTheme, state.transitionType);
      },

      /**
       * 应用自定义主题覆盖
       */
      applyCustomTheme: (overrides, meta) => {
        const state = get();

        // B2：稳定 ID + 幂等累计。
        // 原实现每次生成 `custom-${Date.now()}` 新 ID 并追加进 customThemes ——
        // 面板每次点配色/字号都新建一条，列表无限膨胀，且新 ID 在 presetThemes 查不到，
        // 冷启动时 initialize() 只能 warn「无效的主题ID」并回退亮色默认（R1）。
        // 现改为覆盖累计进持久化的 runtimeOverrides，ID 固定为 RUNTIME_THEME_ID。
        const nextOverrides = mergeCustomOverrides(state.runtimeOverrides, overrides);
        const presetId = presetThemes[state.activeThemeId as PresetThemeId]
          ? (state.activeThemeId as PresetThemeId)
          : systemThemeIdFor(state.mode);
        const customTheme = composeTheme(presetId, nextOverrides, state.accessibilityMode);
        customTheme.name = 'Custom Theme';

        set({
          activeThemeId: RUNTIME_THEME_ID,
          activeTheme: customTheme,
          runtimeOverrides: nextOverrides,
          ...(meta?.paletteKey !== undefined && { paletteKey: meta.paletteKey }),
          ...(meta?.fontScale !== undefined && { fontScale: meta.fontScale }),
        });

        applyThemeWithTransition(customTheme, state.transitionType);
      },

      /**
       * 设置辅助功能模式
       */
      setAccessibilityMode: (mode: AccessibilityMode) => {
        const state = get();

        // B1：经 composeTheme 统一重建，确保运行时覆盖（配色/字号）在无障碍切换后
        // 依然保留 —— 原实现查不到 preset 时直接把 activeTheme 当 base 再叠无障碍变体，
        // 会把上一次的覆盖结果当成底层预设，语义混乱。
        const basePresetId: PresetThemeId = presetThemes[state.activeThemeId as PresetThemeId]
          ? (state.activeThemeId as PresetThemeId)
          : systemThemeIdFor(state.mode);
        const finalTheme = composeTheme(basePresetId, state.runtimeOverrides, mode);

        set({
          accessibilityMode: mode,
          activeTheme: finalTheme,
        });

        // 无障碍属性由 applyThemeWithTransition 统一同步（D-57），此处不再重复调用
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
       *
       * 真实接线（非骨架）：过渡样式由 index.css 的 `.theme-transition` 类驱动，
       * 此前时长/缓动写死（0.2s / cubic-bezier(0.25,0.1,0.25,1.0)），setTransitionType
       * 只改 state、从不影响 DOM → 「切换过渡」三选项实际无效。现：
       *  - none：在 :root 挂 .theme-transition-instant（过渡类置 0.01ms，即时切换）
       *  - fade / scale / slide：同步 :root 的 --theme-transition-duration/-timing
       *    （与 index.css `:root.theme-animations-enabled` 的同名令牌对齐），
       *    .theme-transition 类在每次切换时挂载，读取这些变量 → 类型选择真正生效。
       * 值白名单（仅接受预设时长/缓动），防任意 CSS 注入。
       */
      setTransitionType: (type: TransitionType) => {
        set({ transitionType: type });
        const root = document.documentElement;
        const DUR: Record<TransitionType, string> = {
          fade: '0.3s', scale: '0.2s', slide: '0.25s', none: '0.01ms',
        };
        const EASE: Record<TransitionType, string> = {
          fade: 'cubic-bezier(0.4, 0, 0.2, 1)',
          scale: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          slide: 'cubic-bezier(0.4, 0, 0.2, 1)',
          none: 'linear',
        };
        if (type === 'none') {
          root.classList.add('theme-transition-instant');
          root.style.removeProperty('--theme-transition-duration');
          root.style.removeProperty('--theme-transition-timing');
        } else {
          root.classList.remove('theme-transition-instant');
          root.style.setProperty('--theme-transition-duration', DUR[type]);
          root.style.setProperty('--theme-transition-timing', EASE[type]);
        }
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

        // 持久化由 Zustand persist middleware 统一处理（rmfood-theme-storage）
        // 不再双写 themeStorage，避免数据竞争
      },

      /**
       * 删除自定义主题
       */
      deleteCustomTheme: (themeId: string) => {
        const state = get();
        const updatedThemes = state.customThemes.filter(t => t.id !== themeId);

        set({ customThemes: updatedThemes });
        // 持久化由 Zustand persist middleware 统一处理

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
        // B2：运行时覆盖 + 面板选项选择态必须持久化，否则刷新即丢（R1）
        runtimeOverrides: state.runtimeOverrides,
        paletteKey: state.paletteKey,
        fontScale: state.fontScale,
      }),
      // ── 兼容旧版 themeStorage 写入的 CUSTOM_THEMES 键 ──
      // migrate 阶段从 themeStorage 迁移旧数据（一次性）
      version: 5, // v5：运行时覆盖改为持久化 runtimeOverrides + 稳定 ID（B1/B2）

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

        // v4: 从旧的 themeStorage CUSTOM_THEMES 键迁移自定义主题（一次性）
        if (version === undefined || version < 4) {
          try {
            // 优先走 themeStorage 的 read-only 迁移 API（封装了键名与容错），
            // 回退到直接读 localStorage（防御 themeStorage 不可用）
            const migrated = themeStorage.loadCustomThemes();
            const oldThemes: any[] = migrated ?? [];
            if (Array.isArray(oldThemes) && oldThemes.length > 0 && (!persistedState?.customThemes || persistedState.customThemes.length === 0)) {
              logger.info(`[Theme System] 🔄 v3→v4 迁移 ${oldThemes.length} 个自定义主题从旧存储键`);
              persistedState.customThemes = oldThemes;
            }
            // R-15：迁移完成后删除遗留存储键（一次性清理僵尸数据）
            localStorage.removeItem('rmfood-custom-themes');
            localStorage.removeItem('rmfood-theme-state');
            localStorage.removeItem('rmfood-theme-preferences');
            localStorage.removeItem('rmfood-theme-versions');
          } catch { /* 忽略迁移错误 */ }
        }

        // v5：运行时覆盖迁移（B1/B2）。
        // v4 及以前 applyCustomTheme 用 `custom-${Date.now()}` 生成一次性 ID，这些 ID
        // 不在 presetThemes 中，冷启动会被判为「无效的主题ID」并回退亮色默认（R1）。
        // 覆盖现由 runtimeOverrides 承载、ID 统一为 RUNTIME_THEME_ID。旧版覆盖无法从
        // 合并结果反推，故只规范化 ID —— 用户下一次在面板点选即恢复。
        if (version === undefined || version < 5) {
          const id = String(persistedState?.activeThemeId ?? '');
          if (id && !isValidThemeId(id)) {
            logger.info(`[Theme System] 🔄 v${version ?? '0'}→v5 规范化非预设主题ID: ${id} → light-default`);
            persistedState.activeThemeId = 'light-default';
          }
        }
        // 旧版存储无这三个键时补默认值（persist 合并时 undefined 不会覆盖 initialState，
        // 但显式兜底更直观，也保证 migrate 产物结构完整）
        if (!persistedState.runtimeOverrides || typeof persistedState.runtimeOverrides !== 'object') {
          persistedState.runtimeOverrides = {};
        }
        persistedState.paletteKey ??= '';
        persistedState.fontScale ??= 'standard';

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
// 辅助函数：应用主题（含过渡标记）
// ----------------------------------------------------------------------------
// D-8 修复：原实现用 <html> 的 inline opacity / transform 做主题过渡
//   （applyFadeTransition / applySlideTransition / applyScaleTransition），
//   问题有三：
//     1) 整页重绘：opacity/transform 作用于 <html>，触发全文档合成层重建；
//     2) 可访问性遮挡：过渡期间内容处于 opacity:0，屏幕阅读器与自动化测试可能读到空内容；
//     3) 与首屏 FOUC 叠加，冷启动额外空白（D-49）。
// 现改为：仅在切换瞬间挂载 .theme-transition 类，由 CSS transition 处理颜色插值，
//   完全不触碰 opacity / transform。该类已存在于 index.css（颜色/边框/阴影/fill/stroke）。
// ============================================================================

let _transitionTimer: ReturnType<typeof setTimeout> | null = null;

async function applyThemeWithTransition(theme: ThemeConfig, transitionType: TransitionType): Promise<void> {
  const root = document.documentElement;

  // D-57 修复：无障碍 DOM 属性**必须**与主题一并应用。
  // 本函数是全部应用路径的唯一汇聚点（setThemeMode / setPresetTheme /
  // applyCustomTheme / resetToDefault / importTheme / setAccessibilityMode），
  // 在此统一同步可覆盖此前遗漏的 5 条路径。此前仅 initialize() 与
  // setAccessibilityMode() 两处调用，导致 resetToDefault() 残留
  // data-a11y-mode="reading"、reading 模式下切亮暗不更新 data-reading-mode。
  // 读 store 当前值而非入参：各调用点均已先 set({ accessibilityMode })，顺序安全。
  syncA11yAttributes(useThemeStore.getState().accessibilityMode, theme.mode);

  if (transitionType === 'none') {
    applyThemeToDOM(theme);
    return;
  }

  useThemeStore.setState({ isTransitioning: true });
  root.classList.add('theme-transition');

  try {
    applyThemeToDOM(theme);
  } finally {
    if (_transitionTimer !== null) clearTimeout(_transitionTimer);
    // 过渡时长与 index.css 的 .theme-transition（200ms）保持一致，略留余量
    _transitionTimer = setTimeout(() => {
      root.classList.remove('theme-transition');
      _transitionTimer = null;
      useThemeStore.setState({ isTransitioning: false });
    }, 260);
  }
}

export default useThemeStore;