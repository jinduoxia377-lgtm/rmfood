/**
 * ThemeProvider 上下文包装器回归测试
 *
 * 覆盖一个**潜在 R1 回归向量**：`useTheme()` 暴露的 `applyCustomTheme` 曾是单参
 * 签名 `(overrides) => void`，在把参数透传给 store 之前吞掉了第二个 `meta` 参数。
 *
 * `meta` 承载 `paletteKey` / `fontScale` —— 它们是 `partialize` 持久化与冷启动回放
 * 的唯一依据，也是面板选中态（U-6：选中态必须从 store 派生）的数据来源。
 * 一旦经此包装器调用，配色/字号会静默不持久化：刷新后配色回到品牌绿、字号回到标准，
 * 而用户看不到任何报错。这与 store 内部旧 `custom-${Date.now()}` 一次性 ID 问题
 * 是同一类断裂，只是发生在更外层。
 *
 * 原实现被 TypeScript 类型挡住（context 接口声明的是单参签名），因此无活跃消费方
 * 触发过该缺陷；但接口签名本身**主动隐藏**了 `meta`，任何按 §8.4 SOP 用「官方 hook」
 * 写主题设置的开发者都会踩中。修复后签名与 store 一致，本文件固化该契约。
 *
 * 运行：npx vitest run src/stores/__tests__/ThemeProvider.test.tsx
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { useThemeStore } from '../themeStore';

// ── 工具 ────────────────────────────────────────────────────────────────

/** 蓝色主色覆盖：与 themeStore.test.ts 的 BLUE_PRIMARY 同构 */
const BLUE_PRIMARY = {
  main: '#007aff',
  light: '#64b5f6',
  dark: '#00518f',
  contrastText: '#ffffff',
} as any;

/** 在 ThemeProvider 内渲染 useTheme()，返回 context 值 */
function renderThemeHook() {
  return renderHook(() => useTheme(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    ),
  });
}

/** 复位 store 与持久化，避免用例间污染 */
function resetStore() {
  localStorage.clear();
  useThemeStore.setState({
    paletteKey: undefined,
    fontScale: undefined,
    runtimeOverrides: {},
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  cleanup();
});

// ============================================================================
// meta 透传（R1 契约）
// ============================================================================

describe('ThemeProvider.applyCustomTheme 必须透传 meta', () => {
  it('透传 paletteKey：context 调用后 store 的选中态键被写入', () => {
    const { result } = renderThemeHook();

    act(() => {
      result.current.applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });
    });

    // 若 meta 被吞掉，这里会是 undefined，刷新后配色静默回退品牌绿
    expect(useThemeStore.getState().paletteKey).toBe('blue');
  });

  it('透传 fontScale：context 调用后 store 的字号档被写入', () => {
    const { result } = renderThemeHook();

    act(() => {
      result.current.applyCustomTheme(
        { typography: { fontSize: { body: '1.125rem' } } as any },
        { fontScale: 'relaxed' },
      );
    });

    expect(useThemeStore.getState().fontScale).toBe('relaxed');
  });

  it('透传 radiusScale：context 调用后 store 的圆角档被写入', () => {
    const { result } = renderThemeHook();

    act(() => {
      result.current.applyCustomTheme(
        { borderRadius: { sm: '10px', md: '14px', lg: '20px' } as any },
        { radiusScale: 'rounded' },
      );
    });

    expect(useThemeStore.getState().radiusScale).toBe('rounded');
  });

  it('同一次调用同时携带两个键，两者都被写入', () => {
    const { result } = renderThemeHook();

    act(() => {
      result.current.applyCustomTheme(
        {
          colors: { primary: BLUE_PRIMARY },
          typography: { fontSize: { body: '1.125rem' } },
        } as any,
        { paletteKey: 'blue', fontScale: 'relaxed' },
      );
    });

    const s = useThemeStore.getState();
    expect(s.paletteKey).toBe('blue');
    expect(s.fontScale).toBe('relaxed');
  });

  it('不传 meta 时是【累计保留】而非清空：之前设过的 paletteKey 仍在', () => {
    const { result } = renderThemeHook();

    act(() => {
      result.current.applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });
    });

    // 只改字号、不传 meta
    act(() => {
      result.current.applyCustomTheme({ typography: { fontSize: { body: '1.125rem' } } as any });
    });

    const s = useThemeStore.getState();
    expect(s.paletteKey).toBe('blue');                          // 未被第二次调用清空
    expect(s.runtimeOverrides.colors?.primary?.main).toBe('#007aff');   // 第一次的覆盖仍在
    expect(s.runtimeOverrides.typography?.fontSize?.body).toBe('1.125rem');
  });

  it('context 与 store 直调写入同一个持久化面（两条路径一致）', () => {
    // 路径 A：直调 store（ThemePanel 的现状）
    act(() => {
      useThemeStore.getState().applyCustomTheme({ colors: { primary: BLUE_PRIMARY } as any }, { paletteKey: 'blue' });
    });
    expect(useThemeStore.getState().paletteKey).toBe('blue');

    // 路径 B：经 context 包装器 —— 必须落在同一个 runtimeOverrides
    const { result } = renderThemeHook();
    act(() => {
      result.current.applyCustomTheme({ typography: { fontSize: { body: '1.125rem' } } as any }, { fontScale: 'relaxed' });
    });

    const s = useThemeStore.getState();
    expect(s.runtimeOverrides.colors?.primary?.main).toBe('#007aff'); // 路径 A 的覆盖仍在
    expect(s.runtimeOverrides.typography?.fontSize?.body).toBe('1.125rem');
    expect(s.paletteKey).toBe('blue');
    expect(s.fontScale).toBe('relaxed');
  });
});
