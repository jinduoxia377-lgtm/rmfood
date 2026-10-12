import React, { useEffect, useState } from 'react';
import {
  Sun, Moon, Monitor, Gauge, Eye, Palette, Type, RotateCcw, Accessibility,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useThemeStore, useIsDarkMode,
  type TransitionType, type AccessibilityMode,
} from '@/theme';
import { APPLE_HIG_PALETTES, FONT_SCALES, FONT_SCHEME_META, getPaletteScales } from './theme-palette';

/**
 * ThemePanel — 全站主题控制核心模块（嵌入 SettingsPage「主题」tab）
 *
 * 设计原则（执行方案《RMFOOD-主题设置模块系统性控制执行方案》基线 1）：
 *  - **单通道落地**：所有覆盖一律经
 *      applyCustomTheme → mergeThemeOverrides → generateCSSVariables → applyThemeToDOM
 *    UI 层**不得**直接 `root.style.setProperty`（GATE-17 门禁拦截）。
 *    旧实现里 `applyFontScale` / `applyBrandScale` 两条直写路径已被删除：
 *    它们只改当前明暗模式的 3 个档 / 3 个正文字号，既造不成整档一致，
 *    又因写在 inline 上而无法区分 `:root` 与 `.dark` 作用域。
 *  - §8.2 U-4：状态读写一律走 useThemeStore()
 *  - §8.2 U-6：**选中态从 store 派生**（paletteKey / fontScale 持久化），
 *    禁止 `aria-checked={false}` 这类写死值 —— 用户必须看得出当前生效方案。
 *  - §4.3 C-24：选中态用 .border-primary-main + .bg-primary-container
 *    （不可反转，非 400..950 色阶配白字），双模式对比度合规
 *  - §10.3 GATE-12/13：只用 L1 已登记语义类 / L0 已登记令牌
 *
 * 九区块：
 *  ① 明暗三态切换（light/dark/system，setThemeMode）
 *  ② 跟随系统实时状态（matchMedia 只读 + useIsDarkMode）
 *  ③ 切换过渡动画（fade/scale/none，setTransitionType）
 *  ④ 减少动画开关（motionPreferences，setMotionPreferences）
 *  ⑤ 明暗实时预览（随当前明暗即时渲染的迷你卡片）
 *  ⑥ 快捷键实际绑定（Ctrl+Shift+T 在明暗间切换）
 *  ⑦ 字体方案（紧凑/标准/宽松 → 完整 L0 排版档 12 键，--text-* 令牌）
 *  ⑧ 配色方案（Apple HIG 系统色板 → 主色阶整档 11/11 双作用域注入）
 *  ⑨ 无障碍模式四态（normal/high-contrast/reading/color-blind，setAccessibilityMode）
 *     —— C3：四态原只在侧栏 ThemeSwitcher 的下拉里可达，/settings 主入口反而够不着。
 *     主入口补全后 Switcher 退化为轻量明暗切换器（C5），不再重复/丢失功能。
 *
 * ⑦⑧ 持久性：覆盖累计进 store.runtimeOverrides 并持久化，冷启动由 initialize()
 * 回放，刷新后配色/字号/明暗三者全部保持（GATE-15 断言）。
 * ⑧ 的色阶走运行时 `<style>` 双作用域块（见 theme-palette 的档位单调性说明），
 * 切明暗模式不再丢失配色。
 * ⑨ 的 accessibilityMode 已由 partialize 持久化，刷新后保持。
 */
export const ThemePanel: React.FC = () => {
  const {
    mode, setThemeMode,
    applyCustomTheme, resetToDefault,
    transitionType, setTransitionType,
    motionPreferences, setMotionPreferences,
    paletteKey, fontScale,
    accessibilityMode, setAccessibilityMode,
  } = useThemeStore();
  const isDark = useIsDarkMode();

  // ⑦⑧ 的选中态基线：未做任何选择时视同「默认绿」与「标准」字号。
  const activePalette = paletteKey || 'green';
  const activeFontScale = fontScale || 'standard';

  // ── ⑥ Ctrl+Shift+T 快捷键实际绑定（在 light/dark 间切换）──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey && (e.key === 'T' || e.key === 't'))) return;
      e.preventDefault();
      const st = useThemeStore.getState();
      const next = st.mode === 'light' ? 'dark' : 'light';
      if (st.motionPreferences?.reducedMotion || st.transitionType === 'none') {
        st.setTransitionType('none');
        st.setThemeMode(next);
        st.setTransitionType('fade');
      } else {
        st.setThemeMode(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── ② 系统偏好实时状态（只读 matchMedia + 订阅 change）──
  const [systemPref, setSystemPref] = useState<'light' | 'dark' | 'unknown'>('unknown');
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      setSystemPref('unknown');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemPref(mq.matches ? 'dark' : 'light');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const MODES = [
    { mode: 'light' as const, icon: Sun, label: '浅色', desc: '明亮清爽，适合白天' },
    { mode: 'dark' as const, icon: Moon, label: '深色', desc: '护眼沉浸，适合夜间' },
    { mode: 'system' as const, icon: Monitor, label: '跟随系统', desc: '自动适配系统偏好' },
  ];

  const TRANSITIONS: { t: TransitionType; label: string; desc: string }[] = [
    { t: 'fade', label: '淡入淡出', desc: '柔和过渡（默认）' },
    { t: 'scale', label: '缩放', desc: '轻微缩放过渡' },
    { t: 'none', label: '无过渡', desc: '即时切换' },
  ];

  // ⑨ 无障碍模式四态（C3：原仅侧栏 ThemeSwitcher 下拉可达，主入口补全）
  // 状态走 store（持久化），DOM 副作用 data-a11y-mode / data-reading-mode 由
  // setAccessibilityMode → applyThemeWithTransition → syncA11yAttributes 统一写入。
  const A11Y_MODES: { key: AccessibilityMode; label: string; desc: string }[] = [
    { key: 'normal', label: '标准', desc: '默认视觉' },
    { key: 'high-contrast', label: '高对比度', desc: '增强前景/背景对比' },
    { key: 'reading', label: '阅读模式', desc: '纸感底色，长文舒适' },
    { key: 'color-blind', label: '色觉辅助', desc: '规避红绿混淆' },
  ];

  // ── ⑦ 字体方案（完整 L0 排版档 12 键 → --text-* 令牌）──
  const FONT_SIZES = FONT_SCHEME_META.map((s) => ({
    key: s.key,
    label: s.label,
    desc: s.desc,
    base: FONT_SCALES[s.key].body,
  }));

  // ── ⑧ 配色方案（Apple HIG 系统色板，含明暗双值 + 整档色阶）──
  const PALETTES = APPLE_HIG_PALETTES;

  /**
   * ⑦ 应用字体方案。
   *
   * FONT_SCALES 产出 12 个 L0 排版键（body / bodySm / caption / bodyLg /
   * overline / tiny / h1..h6），generateCSSVariables 经 toKebab 生成
   * `--text-body-sm` 这类正确命名后写入 inline。
   * 排版令牌在两种模式下取值相同，inline 单作用域即正确，无需双作用域块。
   * （旧实现只注入 3 个键，且直写 inline，既覆盖不全又绕过持久化通道。）
   */
  const applyFont = (key: string) => {
    applyCustomTheme(
      { typography: { fontSize: FONT_SCALES[key] } },
      { fontScale: key },
    );
  };

  /**
   * ⑧ 应用配色方案。
   *
   * 分两层，因为两类令牌的【作用域模型】不同：
   *  - `colors.primary` 只带模式无关的角色字段（main / light / dark /
   *    contrastText），映射到 `--color-primary` 等语义令牌，走 inline 单作用域。
   *  - `--color-primary-<档>` 是模式反转令牌（base.css 100 浅→950 深、
   *    dark.css 100 深→950 浅，暗色值作用域在 `.dark`），inline 无法区分二者，
   *    故由 modeRamps 携带亮/暗两组【完整 10 档】色阶，经运行时 `<style>`
   *    双作用域落地。整档同向替换保证单调性，不会出现「500-700 换色而两头
   *    仍是品牌绿」的断裂梯度。
   *
   * 旧实现 applyBrandScale 只改 500/600/700 三档并直写 inline —— 既产生断裂
   * 梯度，又因 inline 压过 .dark 导致暗色模式错用亮色值，且完全不持久化。
   */
  const applyPalette = (p: (typeof PALETTES)[number]) => {
    const scales = getPaletteScales(p);
    applyCustomTheme(
      {
        colors: {
          primary: {
            main: isDark ? p.dark : p.light,
            light: p.sub,
            dark: p.subDark,
            contrastText: p.contrastText,
          },
        },
        modeRamps: { primary: scales.light, primaryDark: scales.dark },
      },
      { paletteKey: p.key },
    );
  };

  const handleReset = () => {
    // resetToDefault 清空 runtimeOverrides → applyThemeToDOM 同时清除 <html>
    // 内联自定义属性与运行时色阶 <style>，回到 L0 基线。无需手动 removeProperty。
    resetToDefault();
  };

  const cardBase = 'rounded-2xl border border-neutral-200 dark:border-neutral-700 surface-card p-5';
  const headBase = 'flex items-center gap-2.5 mb-4';
  const headTitle = 'text-sm font-semibold text-neutral-900';
  const tileActive = 'border-primary-main bg-primary-container';
  const tileIdle = 'border-neutral-200 dark:border-neutral-700 surface-hover';

  return (
    <div className="space-y-6">
      {/* ═══ ① 明暗三态切换 ═══ */}
      <section className={cardBase} aria-labelledby="tp-mode-h">
        <div className={headBase}>
          <Sun size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-mode-h" className={headTitle}>外观模式</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">快捷键 Ctrl+Shift+T 即时明暗切换</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="明暗模式">
          {MODES.map(({ mode: m, icon: Icon, label, desc }) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setThemeMode(m)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <Icon size={22} className={active ? 'text-primary-main' : 'text-neutral-700'} aria-hidden />
                <span className={cn('text-sm font-medium', active ? 'text-neutral-900' : 'text-neutral-700')}>{label}</span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{desc}</span>
                {active && <span className="absolute top-2.5 right-2.5 text-xs font-semibold text-primary-main">✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ ② 跟随系统实时状态 ═══ */}
      <section className={cardBase} aria-labelledby="tp-sys-h">
        <div className={headBase}>
          <Monitor size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-sys-h" className={headTitle}>跟随系统</h3>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-700">
              {mode === 'system'
                ? '当前「跟随系统」，将自动匹配下方系统偏好'
                : '当前为手动模式，系统偏好变化不会自动切换'}
            </p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">系统偏好变化时自动同步（无需刷新）</p>
          </div>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
              systemPref === 'dark' ? 'border-neutral-700 bg-neutral-800 text-neutral-100'
                : systemPref === 'light' ? 'border-neutral-200 bg-white dark:bg-neutral-900 text-neutral-700'
                : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
            )}
            role="status"
            aria-live="polite"
          >
            {systemPref === 'dark' ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
            系统当前：<span className="font-semibold">{systemPref === 'dark' ? '深色' : systemPref === 'light' ? '浅色' : '检测中'}</span>
          </div>
        </div>
      </section>

      {/* ═══ ③ 切换过渡动画 ═══ */}
      <section className={cardBase} aria-labelledby="tp-trans-h">
        <div className={headBase}>
          <Gauge size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-trans-h" className={headTitle}>明暗切换过渡</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="过渡动画">
          {TRANSITIONS.map(({ t, label, desc }) => {
            const active = transitionType === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTransitionType(t)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <span className={cn('text-sm font-medium', active ? 'text-neutral-900' : 'text-neutral-700')}>{label}</span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ ④ 减少动画 ═══ */}
      <section className={cardBase} aria-labelledby="tp-motion-h">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 id="tp-motion-h" className={headTitle}>减少动画</h3>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">开启后停用全部过渡动画（系统「减弱动态效果」偏好会自动同步此开关）</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={motionPreferences.reducedMotion}
            aria-label="切换减少动画"
            onClick={() => setMotionPreferences({ reducedMotion: !motionPreferences.reducedMotion })}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
              motionPreferences.reducedMotion ? 'bg-primary-main' : 'border border-neutral-300 dark:border-neutral-700'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white dark:bg-neutral-900 shadow transition-transform',
                motionPreferences.reducedMotion ? 'translate-x-5' : 'translate-x-0'
              )}
              aria-hidden
            />
          </button>
        </div>
      </section>

      {/* ═══ ⑨ 无障碍模式（C3：从侧栏 Switcher 迁入主入口）═══ */}
      <section className={cardBase} aria-labelledby="tp-a11y-h">
        <div className={headBase}>
          <Accessibility size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-a11y-h" className={headTitle}>无障碍模式</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">
            {A11Y_MODES.find((m) => m.key === accessibilityMode)?.label ?? '标准'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="radiogroup" aria-label="无障碍模式">
          {A11Y_MODES.map((m) => {
            const active = accessibilityMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${m.label}无障碍模式`}
                onClick={() => setAccessibilityMode(m.key)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <span className={cn('text-sm font-medium', active ? 'text-neutral-900' : 'text-neutral-700')}>{m.label}</span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{m.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2">
          写入 <code className="font-mono">data-a11y-mode</code> / <code className="font-mono">data-reading-mode</code>，
          刷新后保持；「重置默认」回到标准模式
        </p>
      </section>

      {/* ═══ ⑤ 明暗实时预览 ═══ */}
      <section className={cardBase} aria-labelledby="tp-preview-h">
        <div className={headBase}>
          <Eye size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-preview-h" className={headTitle}>实时预览</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">{isDark ? '深色' : '浅色'}模式即时渲染</span>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4 transition-colors',
            isDark ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white dark:bg-neutral-900'
          )}
          aria-label="当前明暗预览卡片"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isDark ? 'bg-primary-container' : 'bg-primary-container'
              )}
            >
              {isDark ? <Moon size={18} className="text-primary-main" aria-hidden /> : <Sun size={18} className="text-primary-main" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('h-2.5 w-28 rounded-full', isDark ? 'bg-neutral-600' : 'bg-neutral-300')} />
              <div className={cn('mt-2 h-2 w-44 rounded-full', isDark ? 'bg-neutral-700' : 'bg-neutral-200')} />
            </div>
          </div>
          <button
            type="button"
            className={cn(
              'mt-4 w-full rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
              'bg-primary-container text-primary-main'
            )}
          >
            主按钮示例（不可反转底色 + 语义前景）
          </button>
        </div>
      </section>

      {/* ═══ ⑦ 字体方案 ═══ */}
      <section className={cardBase} aria-labelledby="tp-font-h">
        <div className={headBase}>
          <Type size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-font-h" className={headTitle}>字体大小</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">调整全局正文字号</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="字体大小">
          {FONT_SIZES.map((f) => {
            const active = activeFontScale === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${f.label}字号方案`}
                onClick={() => applyFont(f.key)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <span className={cn('text-sm font-medium', active ? 'text-neutral-900' : 'text-neutral-700')}>{f.label}</span>
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{f.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2">
          当前：{FONT_SIZES.find((f) => f.key === activeFontScale)?.label ?? '标准'}
          · 覆盖 12 个 L0 排版档，刷新后保持；「重置默认」回到标准字号
        </p>
      </section>

      {/* ═══ ⑧ 配色方案（Apple HIG）═══ */}
      <section className={cardBase} aria-labelledby="tp-palette-h">
        <div className={headBase}>
          <Palette size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-palette-h" className={headTitle}>配色方案</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">参照 Apple HIG 系统色板</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3" role="radiogroup" aria-label="配色方案">
          {PALETTES.map((p) => {
            const active = activePalette === p.key;
            const swatch = isDark ? p.dark : p.light;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${p.name}配色方案`}
                onClick={() => applyPalette(p)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
                title={`${p.name}：${p.note}`}
              >
                <span
                  className="h-8 w-8 rounded-full border border-black/10"
                  style={{ background: swatch }}
                  aria-hidden
                />
                <span className={cn('text-xs font-medium', active ? 'text-neutral-900' : 'text-neutral-700')}>{p.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2">
          当前：{PALETTES.find((p) => p.key === activePalette)?.name ?? '默认绿'}
          · 整档 10 档同步注入，明暗双作用域，切模式不丢失；「重置默认」恢复品牌默认绿
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 surface-hover px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
          >
            <RotateCcw size={14} aria-hidden /> 重置默认
          </button>
        </div>
      </section>

      {/* 当前状态摘要（全部从 store 派生，U-6） */}
      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] px-1" aria-live="polite">
        当前：{isDark ? '深色' : '浅色'}渲染
        · 模式：{mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
        · 配色：{PALETTES.find((p) => p.key === activePalette)?.name ?? '默认绿'}
        · 字号：{FONT_SIZES.find((f) => f.key === activeFontScale)?.label ?? '标准'}
        · 过渡：{TRANSITIONS.find(t => t.t === transitionType)?.label ?? transitionType}
        · 无障碍：{A11Y_MODES.find((m) => m.key === accessibilityMode)?.label ?? '标准'}
        · 减少动画：{motionPreferences.reducedMotion ? '开启' : '关闭'}
      </p>
    </div>
  );
};

export default ThemePanel;
