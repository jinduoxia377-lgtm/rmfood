/**
 * 主题配置导出 / 导入往返测试（阶段 E1）
 *
 * 锁定一条完整的可迁移链路：
 *   面板选配色/字号/圆角 → exportTheme 导出快照 → normalizeImportedConfig 回放
 *   → applyCustomTheme 落回 store → 刷新后仍生效（经 runtimeOverrides 持久化）。
 *
 * 两个历史缺陷在此固化：
 *   - D-36 扁平形态静默无效：直接传 `{ primary, secondary, accent }` 给
 *     applyCustomTheme 会因 mergeThemeOverrides 只读 `overrides.colors` 而
 *     **什么都不发生**，用户以为导入成功。故扁平形态必须先规范化。
 *   - 旧版 exportTheme 只导 `theme`（base × 覆盖的合并结果），丢掉了解析不了的
 *     modeRamps（整档色阶）与选中态，导入后配色按钮失去高亮、色阶退回品牌绿。
 *     故新版必须导出 runtimeOverrides + paletteKey / fontScale / radiusScale。
 *
 * 运行：npx vitest run src/theme/__tests__/ThemeImport.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';
import { presetThemes, applyThemeToDOM } from '@/stores/theme.presets';
import { RADIUS_SCALES } from '@/components/theme/theme-palette';
import {
  isHexColor,
  normalizeImportedConfig,
  pickContrastText,
} from '../ThemeImport';

// ── 工具 ────────────────────────────────────────────────────────────────

const BLUE_PRIMARY = {
  main: '#007aff',
  light: '#64b5f6',
  dark: '#00518f',
  contrastText: '#ffffff',
};

const LIGHT_RAMP = {
  '50': '#eff6ff', '100': '#d6e9ff', '200': '#acd6ff', '300': '#79bfff', '400': '#46a5ff',
  '500': '#0a84ff', '600': '#007aff', '700': '#0066cc', '800': '#00518f',
  '900': '#003d6b', '950': '#00253f',
};
const DARK_RAMP = {
  '50': '#00253f', '100': '#003d6b', '200': '#00518f', '300': '#0066cc', '400': '#007aff',
  '500': '#46a5ff', '600': '#79bfff', '700': '#acd6ff', '800': '#d6e9ff',
  '900': '#e8f2ff', '950': '#f4f8ff',
};

/** 复位 store 到干净亮色基线，避免用例间污染 */
function resetStore() {
  localStorage.clear();
  document.documentElement.style.cssText = '';
  useThemeStore.setState({
    activeThemeId: 'light-default',
    activeTheme: presetThemes['light-default'],
    mode: 'light',
    accessibilityMode: 'normal',
    transitionType: 'none',
    customThemes: [],
    runtimeOverrides: {},
    paletteKey: '',
    fontScale: 'standard',
    radiusScale: 'standard',
    isInitialized: false,
  } as any);
}

beforeEach(() => {
  resetStore();
});

// ============================================================================
// 基础校验函数
// ============================================================================

describe('isHexColor / pickContrastText', () => {
  it('isHexColor 接受 3/4/6/8 位 hex，拒绝其余', () => {
    expect(isHexColor('#f00')).toBe(true);
    expect(isHexColor('#f0f0')).toBe(true);
    expect(isHexColor('#10b981')).toBe(true);
    expect(isHexColor('#10b981cc')).toBe(true);
    expect(isHexColor(' #ff0000 ')).toBe(true); // 容忍首尾空白
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#zzz')).toBe(false);
    expect(isHexColor('')).toBe(false);
    expect(isHexColor(123)).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  it('pickContrastText 对浅底选深色前景、对深底选白色', () => {
    // 白底：与白色对比 1:1，与深色对比极高 → 选深色
    expect(pickContrastText('#ffffff')).toBe('#052e16');
    // 黑底：与白色对比极高 → 选白色
    expect(pickContrastText('#000000')).toBe('#ffffff');
    // 品牌绿 #10b981（较浅）→ 深色前景
    expect(pickContrastText('#10b981')).toBe('#052e16');
    // 深绿 #047857 → 白色前景
    expect(pickContrastText('#047857')).toBe('#ffffff');
  });
});

// ============================================================================
// normalizeImportedConfig：三种形态
// ============================================================================

describe('normalizeImportedConfig', () => {
  it('v2 导出形态：runtimeOverrides 原样回放，选中态键一并回收', () => {
    const raw = {
      runtimeOverrides: {
        colors: { primary: BLUE_PRIMARY },
        typography: { fontSize: { body: '1.125rem' } },
        borderRadius: RADIUS_SCALES.rounded,
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      },
      paletteKey: 'blue',
      fontScale: 'relaxed',
      radiusScale: 'rounded',
    };

    const result = normalizeImportedConfig(raw);
    expect(result).not.toBeNull();
    expect(result!.overrides).toBe(raw.runtimeOverrides); // 同一引用，零拷贝
    expect(result!.meta).toEqual({
      paletteKey: 'blue',
      fontScale: 'relaxed',
      radiusScale: 'rounded',
    });
  });

  it('v2 形态但无选中态键：meta 为 undefined（不传空对象）', () => {
    const result = normalizeImportedConfig({
      runtimeOverrides: { colors: { primary: BLUE_PRIMARY } },
      paletteKey: '',
    });
    expect(result!.overrides).toEqual({ colors: { primary: BLUE_PRIMARY } });
    expect(result!.meta).toBeUndefined();
  });

  it('嵌套形态：{ colors } 直接当覆盖，不额外规范化', () => {
    const result = normalizeImportedConfig({
      colors: { primary: { main: '#ff3b30', contrastText: '#ffffff' } },
    });
    expect(result!.overrides).toEqual({
      colors: { primary: { main: '#ff3b30', contrastText: '#ffffff' } },
    });
  });

  it('扁平形态：映射到 colors 并补 contrastText（D-36 回归锁定）', () => {
    // 扁平对象若直接传给 applyCustomTheme 会静默无效；此处必须被映射
    const result = normalizeImportedConfig({
      primary: '#ff3b30',
      accent: '#ff9500',
    });
    expect(result!.overrides).toEqual({
      colors: {
        primary: { ...(presetThemes['light-default'].colors.primary as any), main: '#ff3b30', contrastText: pickContrastText('#ff3b30') },
        tertiary: { ...(presetThemes['light-default'].colors.tertiary as any), main: '#ff9500', contrastText: pickContrastText('#ff9500') },
      },
    });
    // accent 对外 → tertiary 对内
    expect(result!.overrides.colors!.tertiary).toBeDefined();
    expect(result!.overrides.colors!.accent).toBeUndefined();
  });

  it('扁平形态非法颜色值：跳过该字段而非中断', () => {
    const result = normalizeImportedConfig({
      primary: 'not-a-color',
      secondary: '#007aff',
    });
    expect(result!.overrides.colors!.secondary!.main).toBe('#007aff');
    expect(result!.overrides.colors!.primary).toBeUndefined();
  });

  it('无任何可接受字段：返回 null（UI 侧据此报错）', () => {
    expect(normalizeImportedConfig({})).toBeNull();
    expect(normalizeImportedConfig({ foo: 'bar' })).toBeNull();
    expect(normalizeImportedConfig({ colors: 'not-an-object' })).toBeNull();
  });
});

// ============================================================================
// exportTheme → 导入 往返闭环
// ============================================================================

describe('导出 / 导入往返闭环', () => {
  /** 在 store 上做出完整的三类选择，返回导出快照 */
  function applyAndExport() {
    const st = useThemeStore.getState();
    st.applyCustomTheme(
      {
        colors: { primary: BLUE_PRIMARY },
        typography: { fontSize: { body: '1.125rem', bodySm: '1.0625rem' } },
        borderRadius: RADIUS_SCALES.rounded,
        modeRamps: { primary: LIGHT_RAMP, primaryDark: DARK_RAMP },
      } as any,
      { paletteKey: 'blue', fontScale: 'relaxed', radiusScale: 'rounded' },
    );
    return JSON.parse(useThemeStore.getState().exportTheme()) as any;
  }

  it('导出快照含全部可回放字段（含 modeRamps 与三个选中态键）', () => {
    const snap = applyAndExport();

    expect(snap.version).toBe('2.0.0');
    expect(snap.app).toBe('rmfood-theme');
    expect(typeof snap.exportedAt).toBe('string');
    // 用户实际的选择 —— 导入回放的全部依据
    expect(snap.runtimeOverrides.modeRamps).toEqual({ primary: LIGHT_RAMP, primaryDark: DARK_RAMP });
    expect(snap.runtimeOverrides.colors.primary.main).toBe('#007aff');
    expect(snap.runtimeOverrides.borderRadius.lg).toBe('20px');
    // 选中态 —— 还原后 UI 按钮高亮须与当前值一致（U-6）
    expect(snap.paletteKey).toBe('blue');
    expect(snap.fontScale).toBe('relaxed');
    expect(snap.radiusScale).toBe('rounded');
    // 模式类设置
    expect(snap.settings.mode).toBe('light');
    expect(snap.theme).toBeDefined();
  });

  it('整链往返：导出 → 规范化 → 回放，选中态与覆盖全部还原', () => {
    const snap = applyAndExport();
    const before = useThemeStore.getState();

    // 清空 store，模拟另一台设备 / 冷启动
    resetStore();

    const result = normalizeImportedConfig(snap)!;
    useThemeStore.getState().applyCustomTheme(result.overrides as any, result.meta as any);

    const after = useThemeStore.getState();
    expect(after.paletteKey).toBe('blue');
    expect(after.fontScale).toBe('relaxed');
    expect(after.radiusScale).toBe('rounded');
    expect(after.runtimeOverrides).toEqual(before.runtimeOverrides);
  });

  it('往返后令牌真实落地到 DOM（--radius-lg 生效）', () => {
    const snap = applyAndExport();
    resetStore();

    const result = normalizeImportedConfig(snap)!;
    useThemeStore.getState().applyCustomTheme(result.overrides as any, result.meta as any);
    applyThemeToDOM(useThemeStore.getState().activeTheme);

    expect(document.documentElement.style.getPropertyValue('--radius-lg')).toBe('20px');
    expect(document.documentElement.style.getPropertyValue('--radius-sm')).toBe('10px');
  });

  it('导入 v2 快照后「重置默认」能完全回到 L0 基线', () => {
    const snap = applyAndExport();
    resetStore();
    const result = normalizeImportedConfig(snap)!;
    useThemeStore.getState().applyCustomTheme(result.overrides as any, result.meta as any);

    useThemeStore.getState().resetToDefault();

    const s = useThemeStore.getState();
    expect(s.runtimeOverrides).toEqual({});
    expect(s.paletteKey).toBe('');
    expect(s.radiusScale).toBe('standard');
  });
});
