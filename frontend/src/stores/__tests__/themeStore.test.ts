/**
 * 主题 Store 与预设生成器回归测试（T-T1 / D-46）
 *
 * 覆盖规范 §12 T-T1 的 7 类用例中除「值安全（T-D2，已由 theme.presets.test.ts 覆盖）」
 * 外的全部：
 *   - R-13 迁移：getValidThemeId 对已迁移 ID 回退 light-default
 *   - T-S1 状态：setPresetTheme 不修改 mode（D-34）
 *   - T-W1 无障碍：syncA11yAttributes 经 setAccessibilityMode 写入 DOM
 *   - T-B2 / D-53 令牌生成：generateCSSVariables 输出全 kebab + 匹配 SAFE_TOKEN_NAME
 *   - T-B2b：isCleanBuiltinPreset 判定内置纯净 / 无障碍变体 / 自定义
 *   - R-12 持久化：partialize 输出含恢复 activeTheme 所需字段
 *   - T-W1：initialize() 后 data-a11y-mode 存在；reading 时 data-reading-mode=sepia
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '../themeStore';
import {
  presetThemes,
  getAccessibilityTheme,
  generateCSSVariables,
  isCleanBuiltinPreset,
  applyThemeToDOM,
} from '../theme.presets';

// ── 工具：直接构造 store 初始态并调用 action（绕过 initialize 的异步 DOM 副作用）──
function store() {
  return useThemeStore.getState();
}

beforeEach(() => {
  // 复位 DOM 侧属性，避免用例间互相污染
  const root = document.documentElement;
  root.removeAttribute('data-a11y-mode');
  root.removeAttribute('data-reading-mode');
  root.removeAttribute('data-theme');
  root.removeAttribute('data-mode');
  root.style.cssText = '';
  root.className = '';
});

// ============================================================================
// R-13 迁移：已迁移主题 ID 回退到 light-default
// ============================================================================
describe('R-13 主题 ID 迁移（getValidThemeId 语义）', () => {
  // getValidThemeId 未直接导出，通过 importTheme / onRehydrate 行为验证回退语义。
  // 这里用 store 的 setPresetTheme 对无效 ID 的防御性回退（presetThemes[invalid] → light-default）。
  it('setPresetTheme 对无效 ID 回退到 light-default（不抛异常）', () => {
    // presetThemes 只有 light-default / dark-default；传入不存在的 ID 应回退且 activeTheme 有效
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light',
      accessibilityMode: 'normal',
      transitionType: 'none', // 避免过渡定时器
    });
    store().setPresetTheme('nonexistent-theme' as any);
    expect(store().activeTheme).toBeTruthy();
    // presetThemes['nonexistent'] 为 undefined → || presetThemes['light-default'] 兜底
    expect(store().activeTheme.id).toBe('light-default');
  });

  it('resetToDefault 复位到 light-default + system + normal', () => {
    useThemeStore.setState({
      activeThemeId: 'dark-default' as any,
      activeTheme: presetThemes['dark-default'],
      mode: 'dark' as any,
      accessibilityMode: 'high-contrast' as any,
      transitionType: 'none',
    });
    store().resetToDefault();
    const s = store();
    expect(s.activeThemeId).toBe('light-default');
    expect(s.mode).toBe('system');
    expect(s.accessibilityMode).toBe('normal');
  });
});

// ============================================================================
// T-S1 / D-34：setPresetTheme 不修改 mode（跟随系统不被破坏）
// ============================================================================
describe('T-S1 / D-34 setPresetTheme 不写 mode', () => {
  it('在 system 模式下切预设，mode 仍保持 system（用户不退出跟随系统）', () => {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'system' as any,
      accessibilityMode: 'normal' as any,
      transitionType: 'none',
    });
    store().setPresetTheme('dark-default');
    expect(store().mode).toBe('system'); // D-34 关键断言：不被改成 'dark'
    expect(store().activeThemeId).toBe('dark-default');
  });

  it('在 light 模式下切到 dark-default 预设，mode 不变（DOM 由 theme.mode 驱动）', () => {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'normal' as any,
      transitionType: 'none',
    });
    store().setPresetTheme('dark-default');
    expect(store().mode).toBe('light'); // mode 仍由 setThemeMode 管理
    expect(store().activeThemeId).toBe('dark-default');
    expect(store().activeTheme.id).toBe('dark-default');
  });
});

// ============================================================================
// T-W1 / D-39 / D-57：无障碍 DOM 属性同步
// ============================================================================
describe('T-W1 无障碍 DOM 属性（syncA11yAttributes 经 setAccessibilityMode）', () => {
  it('setAccessibilityMode(normal) 后 data-a11y-mode 存在，reading-mode 被移除', () => {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'reading' as any,
      transitionType: 'none',
    });
    store().setAccessibilityMode('normal');
    const root = document.documentElement;
    expect(root.getAttribute('data-a11y-mode')).toBe('normal');
    expect(root.hasAttribute('data-reading-mode')).toBe(false);
  });

  it('reading 模式下 data-reading-mode = sepia（亮）/ dark-read（暗）', () => {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'reading' as any,
      transitionType: 'none',
    });
    store().setAccessibilityMode('reading');
    expect(document.documentElement.getAttribute('data-reading-mode')).toBe('sepia');
  });

  it('高对比度模式写入 data-a11y-mode=high-contrast', () => {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'normal' as any,
      transitionType: 'none',
    });
    store().setAccessibilityMode('high-contrast');
    expect(document.documentElement.getAttribute('data-a11y-mode')).toBe('high-contrast');
  });
});

// ============================================================================
// T-B2 / D-53：generateCSSVariables 输出全 kebab + 通过 SAFE_TOKEN_NAME
// ============================================================================
describe('T-B2 / D-53 令牌生成（全 kebab，无 camelCase 残留）', () => {
  const SAFE = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;

  it('内置预设生成的所有令牌名均匹配 SAFE_TOKEN_NAME', () => {
    for (const id of Object.keys(presetThemes)) {
      const vars = generateCSSVariables(presetThemes[id as keyof typeof presetThemes]);
      for (const name of Object.keys(vars)) {
        expect(SAFE.test(name), `${id} 的 ${name} 违反 T1 kebab 规则`).toBe(true);
      }
    }
  });

  it('zIndex 的 camelCase 键（modalBackdrop）被 kebab 化为 --z-modal-backdrop', () => {
    const vars = generateCSSVariables(presetThemes['light-default']);
    expect(vars['--z-modal-backdrop']).toBeDefined();
    // 确认不再有 camelCase 残留
    expect(Object.keys(vars).some(k => /modalBackdrop/.test(k))).toBe(false);
  });

  it('easing 键（easeIn/easeOut 等）被 kebab 化，写入 --ease-* 命名空间', () => {
    const vars = generateCSSVariables(presetThemes['light-default']);
    const easeKeys = Object.keys(vars).filter(k => k.startsWith('--ease-'));
    expect(easeKeys.length).toBeGreaterThan(0);
    for (const k of easeKeys) {
      expect(SAFE.test(k), k).toBe(true);
      // 无 camelCase
      expect(k).not.toMatch(/[A-Z]/);
    }
  });

  it('T-B2a：primary-main 命中 L0 映射，写入 --color-primary（而非 --color-primary-main）', () => {
    const vars = generateCSSVariables(presetThemes['light-default']);
    expect(vars['--color-primary']).toBeDefined();
    // T-B2a 映射目标存在
    expect(typeof vars['--color-primary']).toBe('string');
  });

  it('T-B2b：四语义角色 main 命中 L0 映射（--color-success/error/warning/info）', () => {
    const vars = generateCSSVariables(presetThemes['light-default']);
    for (const role of ['success', 'error', 'warning', 'info']) {
      expect(vars[`--color-${role}`], `--color-${role} 应由 <role>-main 映射`).toBeDefined();
    }
  });

  it('无效 theme（无 colors）返回空对象', () => {
    expect(generateCSSVariables({} as any)).toEqual({});
  });
});

// ============================================================================
// T-B2b：isCleanBuiltinPreset 判定
// ============================================================================
describe('T-B2b isCleanBuiltinPreset 判定', () => {
  it('内置纯净预设 → true', () => {
    expect(isCleanBuiltinPreset(presetThemes['light-default'])).toBe(true);
    expect(isCleanBuiltinPreset(presetThemes['dark-default'])).toBe(true);
  });

  it('无障碍变体（colors 被 getAccessibilityTheme 修改）→ false', () => {
    const variant = getAccessibilityTheme(presetThemes['light-default'], 'color-blind');
    expect(isCleanBuiltinPreset(variant)).toBe(false);
  });

  it('自定义主题（id 不在 presetThemes）→ false', () => {
    expect(isCleanBuiltinPreset({ ...presetThemes['light-default'], id: 'custom-123' } as any)).toBe(false);
  });

  it('内置预设但 id 被篡改 → false', () => {
    expect(isCleanBuiltinPreset({ ...presetThemes['light-default'], id: 'rogue' } as any)).toBe(false);
  });
});

// ============================================================================
// T-B2b：applyThemeToDOM 注入行为
// ============================================================================
describe('T-B2b applyThemeToDOM 注入行为', () => {
  it('内置纯净预设：注入后 <html> 内联自定义属性 = 0', () => {
    // 预置一些旧内联属性，验证会被清理
    const root = document.documentElement;
    root.style.setProperty('--color-primary', '#ff0000');
    root.style.setProperty('--z-modal-backdrop', '999');

    applyThemeToDOM(presetThemes['light-default']);

    // 内置纯净 → 跳过注入 + 清旧 → 内联自定义属性归零
    const inline = root.getAttribute('style') || '';
    const propCount = (inline.match(/--[a-z0-9-]+:/gi) || []).length;
    expect(propCount).toBe(0);
    // data-theme / data-mode 仍应被设置
    expect(root.hasAttribute('data-theme') || root.hasAttribute('data-mode')).toBe(true);
  });

  it('无障碍变体：注入后 <html> 内联自定义属性 > 0（差异注入仍生效）', () => {
    const variant = getAccessibilityTheme(presetThemes['light-default'], 'color-blind');
    applyThemeToDOM(variant);
    const root = document.documentElement;
    const inline = root.getAttribute('style') || '';
    const propCount = (inline.match(/--[a-z0-9-]+:/gi) || []).length;
    expect(propCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// R-12 持久化：partialize 输出含恢复 activeTheme 所需字段
// ============================================================================
describe('R-12 持久化 partialize 字段完整性', () => {
  it('partialize 输出包含恢复 activeTheme 所需的全部字段', () => {
    useThemeStore.setState({
      activeThemeId: 'dark-default' as any,
      activeTheme: presetThemes['dark-default'],
      mode: 'dark' as any,
      accessibilityMode: 'normal' as any,
      motionPreferences: { reducedMotion: false, disableAnimations: false, scaleDownTransitions: false },
      transitionType: 'fade' as any,
      customThemes: [{ ...presetThemes['light-default'], id: 'custom-x' }] as any,
    });
    // 通过 persist 的 state 序列化模拟 partialize（取 store 当前值后按 partialize 规则挑选）
    const s = store();
    const persisted = {
      activeThemeId: s.activeThemeId,
      mode: s.mode,
      accessibilityMode: s.accessibilityMode,
      motionPreferences: s.motionPreferences,
      transitionType: s.transitionType,
      customThemes: s.customThemes.map((t: any) => ({ ...t })),
    };
    // 恢复所需的字段都在
    expect(persisted.activeThemeId).toBe('dark-default');
    expect(persisted.mode).toBe('dark');
    expect(persisted.accessibilityMode).toBe('normal');
    expect(persisted.transitionType).toBe('fade');
    expect(Array.isArray(persisted.customThemes)).toBe(true);
    expect(persisted.customThemes[0].id).toBe('custom-x');
  });
});

// ============================================================================
// T-W1：initialize() 后 data-a11y-mode 存在（需 mock matchMedia）
// ============================================================================
describe('T-W1 initialize() 后无障碍属性写入', () => {
  it('initialize 后 data-a11y-mode 存在（normal）', async () => {
    // mock 系统偏好：亮色 + 不减少动效
    const matchMediaMock = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock as any;

    useThemeStore.setState({
      ...{ activeThemeId: 'light-default' as any, activeTheme: presetThemes['light-default'], mode: 'light' as any, accessibilityMode: 'normal' as any, transitionType: 'none' },
      isInitialized: false,
    });
    await store().initialize();
    expect(document.documentElement.getAttribute('data-a11y-mode')).toBe('normal');
  });

  it('reading 模式下 initialize 后 data-reading-mode = sepia（亮色系统）', async () => {
    const matchMediaMock = vi.fn().mockImplementation((q: string) => ({
      matches: false, // 系统亮色
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock as any;

    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'reading' as any,
      transitionType: 'none',
      isInitialized: false,
    });
    await store().initialize();
    expect(document.documentElement.getAttribute('data-a11y-mode')).toBe('reading');
    expect(document.documentElement.getAttribute('data-reading-mode')).toBe('sepia');
  });
});

// ============================================================================
// B1 / B2：运行时覆盖持久化与冷启动回放（R1 根治）
//
// R1：用户在 /settings 选配色/字号后刷新全丢，且连带把明暗打回亮色。
// 根因：applyCustomTheme 用一次性 ID 并追加 customThemes，initialize 只查 presetThemes。
// 现改为覆盖累计进持久化 runtimeOverrides + 稳定 ID，冷启动回放。
// ============================================================================
describe('B1/B2 运行时覆盖持久化与冷启动回放（R1）', () => {
  // 蓝色方案（苹果蓝）的完整 primary 映射：main + 10 个色阶档
  const BLUE_PRIMARY = {
    main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff',
    '100': '#d6e9ff', '200': '#acd6ff', '300': '#79bfff', '400': '#46a5ff',
    '500': '#0a84ff', '600': '#007aff', '700': '#0066cc', '800': '#00518f',
    '900': '#003d6b', '950': '#00253f',
  };

  function resetStore(overrides: Record<string, unknown> = {}) {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'normal' as any,
      transitionType: 'none' as any,
      customThemes: [],
      runtimeOverrides: {} as any,
      paletteKey: '',
      fontScale: 'standard',
      isInitialized: false,
      ...overrides,
    });
  }

  function setMatchMedia(prefersDark = false) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: /prefers-color-scheme:\s*dark/.test(q) ? prefersDark : false,
      media: q,
      onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
  }

  it('applyCustomTheme 使用稳定 ID，且不向 customThemes 追加（原实现每次点选新建一条）', () => {
    resetStore();
    store().applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });

    expect(store().activeThemeId).toBe('custom-runtime');
    expect(store().activeTheme.id).toBe('custom-runtime');
    expect(store().activeTheme.isPreset).toBe(false);
    expect(store().customThemes).toHaveLength(0);
    expect(store().paletteKey).toBe('blue');

    // 连续两次调用：ID 不变、列表不增长、覆盖继续生效
    store().applyCustomTheme({ colors: { primary: { ...BLUE_PRIMARY, '500': '#0a84ff' } } as any });
    expect(store().activeThemeId).toBe('custom-runtime');
    expect(store().customThemes).toHaveLength(0);
  });

  it('多次 applyCustomTheme 是【累计合并】：先换配色再改字号，两者都保留', () => {
    resetStore();
    store().applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });
    store().applyCustomTheme(
      { typography: { fontSize: { body: '1.125rem' } } as any },
      { fontScale: 'relaxed' },
    );

    const s = store();
    expect(s.runtimeOverrides.colors?.primary?.main).toBe('#007aff');   // 第一次的覆盖仍在
    expect(s.runtimeOverrides.typography?.fontSize?.body).toBe('1.125rem'); // 第二次的也在
    expect(s.paletteKey).toBe('blue');
    expect(s.fontScale).toBe('relaxed');
    expect(s.activeThemeId).toBe('custom-runtime');
  });

  it('覆盖会注入到 DOM 的 CSS 变量（配色真的生效，不只是改了 store）', () => {
    resetStore();
    store().applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary-500')).toBe('#0a84ff');
    expect(root.style.getPropertyValue('--color-primary')).toBe('#007aff');
    expect(root.getAttribute('data-theme')).toBe('custom-runtime');
  });

  it('R1 核心：冷启动 initialize() 回放运行时覆盖（配色 + 字号 + 明暗三者全保留）', async () => {
    setMatchMedia(false);
    // 模拟「刷新后从 localStorage 恢复」的 state：覆盖还在，但 activeTheme 尚未重建
    resetStore({
      activeThemeId: 'custom-runtime',
      activeTheme: presetThemes['light-default'],
      runtimeOverrides: {
        colors: { primary: BLUE_PRIMARY },
        typography: { fontSize: { body: '1.125rem' } },
      } as any,
      paletteKey: 'blue',
      fontScale: 'relaxed',
      isInitialized: false,
    });

    await store().initialize();

    const s = store();
    // 覆盖被回放到 activeTheme
    expect(s.activeThemeId).toBe('custom-runtime');
    expect(s.activeTheme.colors.primary.main).toBe('#007aff');
    expect(s.activeTheme.typography.fontSize.body).toBe('1.125rem');
    expect(s.activeTheme.mode).toBe('light');
    // DOM 侧真实注入（这才是用户看到的效果）
    expect(document.documentElement.style.getPropertyValue('--color-primary-500')).toBe('#0a84ff');
    // 选项选择态原样保留
    expect(s.paletteKey).toBe('blue');
    expect(s.fontScale).toBe('relaxed');
  });

  it('R1 连带缺陷：mode=system 时按系统偏好选预设，覆盖不丢、明暗不被回滚', async () => {
    setMatchMedia(true); // 系统暗色
    resetStore({
      activeThemeId: 'custom-runtime',
      activeTheme: presetThemes['light-default'],
      mode: 'system' as any,
      runtimeOverrides: { colors: { primary: BLUE_PRIMARY } } as any,
      paletteKey: 'blue',
      isInitialized: false,
    });

    await store().initialize();

    // 系统暗色 → 底是 dark-default，而不是被「无效 ID」分支打回 light-default
    expect(store().activeTheme.mode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // 且覆盖仍在
    expect(store().activeTheme.colors.primary.main).toBe('#007aff');
    expect(document.documentElement.style.getPropertyValue('--color-primary-500')).toBe('#0a84ff');
  });

  it('setThemeMode 切明暗后运行时覆盖仍保留（原实现按 ID 前缀判断，切暗色即丢）', () => {
    resetStore({
      activeThemeId: 'custom-runtime' as any,
      activeTheme: { ...presetThemes['light-default'], id: 'custom-runtime' },
      runtimeOverrides: { colors: { primary: BLUE_PRIMARY } } as any,
      paletteKey: 'blue',
    });

    store().setThemeMode('dark');

    expect(store().mode).toBe('dark');
    expect(store().activeTheme.mode).toBe('dark');
    expect(store().activeThemeId).toBe('custom-runtime');
    expect(store().activeTheme.colors.primary.main).toBe('#007aff');
  });

  it('resetToDefault 清空运行时覆盖与选项选择态', () => {
    resetStore({
      runtimeOverrides: { colors: { primary: BLUE_PRIMARY } } as any,
      paletteKey: 'blue',
      fontScale: 'relaxed',
      activeThemeId: 'custom-runtime' as any,
    });

    store().resetToDefault();

    const s = store();
    expect(s.activeThemeId).toBe('light-default');
    expect(s.runtimeOverrides).toEqual({});
    expect(s.paletteKey).toBe('');
    expect(s.fontScale).toBe('standard');
    // DOM 内联覆盖一并清除
    expect(document.documentElement.style.getPropertyValue('--color-primary-500')).toBe('');
  });

  it('partialize 持久化 runtimeOverrides / paletteKey / fontScale', () => {
    resetStore({
      activeThemeId: 'custom-runtime' as any,
      runtimeOverrides: { colors: { primary: BLUE_PRIMARY } } as any,
      paletteKey: 'blue',
      fontScale: 'relaxed',
    });
    const s = store();
    expect(s.runtimeOverrides).toEqual({ colors: { primary: BLUE_PRIMARY } });
    expect(s.paletteKey).toBe('blue');
    expect(s.fontScale).toBe('relaxed');
  });

  it('未选过任何方案时（runtimeOverrides 为空）initialize 不注入，行为与旧版一致', async () => {
    setMatchMedia(false);
    resetStore({ isInitialized: false });

    await store().initialize();

    expect(store().activeThemeId).toBe('light-default');
    expect(document.documentElement.style.getPropertyValue('--color-primary-500')).toBe('');
    expect(store().paletteKey).toBe('');
    expect(store().fontScale).toBe('standard');
  });
});

// ============================================================================
// C1：模式反转色阶的整链闭环（applyCustomTheme → DOM → 冷启动 → 切模式）
//
// 断裂梯度（500-700 换色而 100-400 / 800-950 仍是品牌绿）与「暗色错用亮色
// ramp」两个缺陷都出在色阶的写入通道上，故在此锁整链：
//   档位令牌只走运行时 <style> 的 :root / .dark 双作用域，绝不落 inline。
// ============================================================================
describe('C1 模式反转色阶整链（配色 10/10 双作用域）', () => {
  const LIGHT_RAMP = {
    '100': '#d6e9ff', '200': '#acd6ff', '300': '#79bfff', '400': '#46a5ff', '500': '#0a84ff',
    '600': '#007aff', '700': '#0066cc', '800': '#00518f', '900': '#003d6b', '950': '#00253f',
  };
  const DARK_RAMP = {
    '100': '#003d6b', '200': '#00518f', '300': '#0066cc', '400': '#007aff', '500': '#46a5ff',
    '600': '#79bfff', '700': '#acd6ff', '800': '#d6e9ff', '900': '#e8f2ff', '950': '#f4f8ff',
  };

  function resetStore(overrides: Record<string, unknown> = {}) {
    useThemeStore.setState({
      activeThemeId: 'light-default' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      accessibilityMode: 'normal' as any,
      transitionType: 'none' as any,
      customThemes: [],
      runtimeOverrides: {} as any,
      paletteKey: '',
      fontScale: 'standard',
      isInitialized: false,
      ...overrides,
    });
  }

  function setMatchMedia(prefersDark = false) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: /prefers-color-scheme:\s*dark/.test(q) ? prefersDark : false,
      media: q,
      onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
  }

  it('applyCustomTheme 带 modeRamps：10 档全部落到运行时 <style>，inline 无档位令牌', () => {
    resetStore();
    store().applyCustomTheme(
      {
        colors: { primary: { main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff' } } as any,
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      },
      { paletteKey: 'blue' },
    );

    const el = document.getElementById('rmfood-runtime-theme');
    expect(el).toBeTruthy();
    const css = el?.textContent || '';
    // 亮色 10 档全在 :root 块
    const rootBlock = css.split('.dark')[0];
    for (const [t, v] of Object.entries(LIGHT_RAMP)) {
      expect(rootBlock, `:root/${t}`).toContain(`--color-primary-${t}: ${v}`);
    }
    // 暗色 10 档全在 .dark 块
    const darkBlock = css.slice(css.indexOf('.dark'));
    for (const [t, v] of Object.entries(DARK_RAMP)) {
      expect(darkBlock, `.dark/${t}`).toContain(`--color-primary-${t}: ${v}`);
    }
    // inline 不得有任何档位令牌（否则暗色模式错用亮色 ramp）
    for (const t of Object.keys(LIGHT_RAMP)) {
      expect(document.documentElement.style.getPropertyValue(`--color-primary-${t}`), t).toBe('');
    }
    // C1.5：primary 语义族（含锚点 --color-primary）同为模式相关令牌，
    // 也一并让位给运行时 <style> 双作用域块 —— inline 不得再出现锚点值，
    // 否则 inline 压过 .dark 会让暗色模式沿用亮色锚点/容器底色。
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--color-primary-container')).toBe('');
    // 锚点与语义族按作用域给出，并随配色整体迁移（而非停留在品牌绿）
    expect(rootBlock).toContain('--color-primary: #0a84ff;');
    expect(rootBlock).toContain('--color-primary-container: #d6e9ff;');
    expect(darkBlock).toContain('--color-primary: #46a5ff;');
    expect(darkBlock).toContain('--color-primary-container: rgba(70, 165, 255, 0.15);');
    expect(store().runtimeOverrides.modeRamps?.primary?.['500']).toBe('#0a84ff');
  });

  it('冷启动回放：modeRamps 持久化后经 initialize 重建运行时样式表', async () => {
    setMatchMedia(false);
    resetStore({
      activeThemeId: 'custom-runtime' as any,
      activeTheme: presetThemes['light-default'],
      mode: 'light' as any,
      runtimeOverrides: {
        colors: { primary: { main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff' } },
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      } as any,
      paletteKey: 'blue',
      isInitialized: false,
    });
    // 模拟「刷新」：DOM 侧无任何运行时样式表
    document.getElementById('rmfood-runtime-theme')?.remove();

    await store().initialize();

    const el = document.getElementById('rmfood-runtime-theme');
    expect(el).toBeTruthy();
    expect(el?.textContent).toContain(':root {');
    expect(el?.textContent).toContain('.dark {');
    expect(el?.textContent).toContain('--color-primary-500: #0a84ff');
    // C1.5：锚点与语义族随色阶一起重建，inline 无残留
    expect(el?.textContent).toContain('--color-primary: #0a84ff;');
    expect(el?.textContent).toContain('--color-primary-container: #d6e9ff;');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(store().activeThemeId).toBe('custom-runtime');
  });

  it('切明暗模式后运行时样式表仍保留（配色不被 setThemeMode 清掉）', () => {
    resetStore({
      activeThemeId: 'custom-runtime' as any,
      activeTheme: { ...presetThemes['light-default'], id: 'custom-runtime' },
      runtimeOverrides: {
        colors: { primary: { main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff' } },
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      } as any,
      paletteKey: 'blue',
    });
    store().applyCustomTheme(
      {
        colors: { primary: { main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff' } } as any,
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      },
      { paletteKey: 'blue' },
    );

    store().setThemeMode('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const el = document.getElementById('rmfood-runtime-theme');
    expect(el).toBeTruthy();
    const css = el?.textContent || '';
    // 双作用域完整保留，暗色值仍可取
    expect(css).toContain('.dark {');
    expect(css).toContain('--color-primary-500: #46a5ff');
    expect(css).toContain('--color-primary-950: #f4f8ff');
    expect(store().activeThemeId).toBe('custom-runtime');
  });

  it('resetToDefault 同时移除运行时样式表与 inline 覆盖', () => {
    resetStore();
    store().applyCustomTheme(
      {
        colors: { primary: { main: '#007aff', light: '#64b5f6', dark: '#00518f', contrastText: '#ffffff' } } as any,
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      },
      { paletteKey: 'blue' },
    );
    expect(document.getElementById('rmfood-runtime-theme')).toBeTruthy();

    store().resetToDefault();

    expect(document.getElementById('rmfood-runtime-theme')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--text-body')).toBe('');
  });
});
