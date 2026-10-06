import React, { useEffect, useState } from 'react';
import {
  Sun, Moon, Monitor, Gauge, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTheme, useThemeStore, useIsDarkMode,
  type TransitionType,
} from '@/theme';

/**
 * ThemePanel — 明暗主题核心模块（嵌入 SettingsPage「主题」tab）
 *
 * 设计原则（按产品要求：只聚焦明/暗主题核心，不引入其他主题）：
 *  - 全部调用 themeStore / useTheme 现成 API，不新增 store 代码
 *  - §8.2 U-4：状态读写一律走 useTheme() / useThemeStore()
 *  - §4.3 C-24：选中态用 .border-primary-main + .bg-primary-container
 *    （不可反转，非 400..950 色阶配白字），双模式对比度合规
 *  - §10.3 GATE-12/13：只用 L1 已登记语义类 / L0 已登记令牌
 *
 * 五区块（均为明暗核心能力）：
 *  ① 明暗三态切换（light/dark/system，setThemeMode）
 *  ② 跟随系统实时状态（matchMedia 只读 + useIsDarkMode，system 态下显示系统实际偏好）
 *  ③ 切换过渡动画（fade/scale/none，setTransitionType）
 *  ④ 减少动画开关（motionPreferences，setMotionPreferences）
 *  ⑤ 明暗实时预览（随当前明暗即时渲染的迷你卡片，证明双模式生效）
 */
export const ThemePanel: React.FC = () => {
  const { mode, setThemeMode } = useTheme();
  const {
    transitionType, setTransitionType,
    motionPreferences, setMotionPreferences,
  } = useThemeStore();
  const isDark = useIsDarkMode();

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

  const cardBase = 'rounded-2xl border border-neutral-200 surface-card p-5';
  const headBase = 'flex items-center gap-2.5 mb-4';
  const headTitle = 'text-sm font-semibold text-neutral-900';
  const tileActive = 'border-primary-main bg-primary-container';
  const tileIdle = 'border-neutral-200 surface-hover';

  return (
    <div className="space-y-6">
      {/* ═══ ① 明暗三态切换 ═══ */}
      <section className={cardBase} aria-labelledby="tp-mode-h">
        <div className={headBase}>
          <Sun size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-mode-h" className={headTitle}>外观模式</h3>
          <span className="text-xs text-neutral-500 ml-auto">快捷键 Ctrl+Shift+T</span>
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
                <span className="text-xs text-neutral-500">{desc}</span>
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
            <p className="text-xs text-neutral-500 mt-1">系统偏好变化时自动同步（无需刷新）</p>
          </div>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
              systemPref === 'dark' ? 'border-neutral-700 bg-neutral-800 text-neutral-100'
                : systemPref === 'light' ? 'border-neutral-200 bg-white text-neutral-700'
                : 'border-neutral-200 bg-neutral-50 text-neutral-400'
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
                <span className="text-xs text-neutral-500">{desc}</span>
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
            <p className="text-xs text-neutral-500 mt-1">开启后停用全部过渡动画（系统「减弱动态效果」偏好会自动同步此开关）</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={motionPreferences.reducedMotion}
            aria-label="切换减少动画"
            onClick={() => setMotionPreferences({ reducedMotion: !motionPreferences.reducedMotion })}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
              motionPreferences.reducedMotion ? 'bg-primary-main' : 'border border-neutral-300'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                motionPreferences.reducedMotion ? 'translate-x-5' : 'translate-x-0'
              )}
              aria-hidden
            />
          </button>
        </div>
      </section>

      {/* ═══ ⑤ 明暗实时预览 ═══ */}
      <section className={cardBase} aria-labelledby="tp-preview-h">
        <div className={headBase}>
          <Eye size={18} className="text-primary-main" aria-hidden />
          <h3 id="tp-preview-h" className={headTitle}>实时预览</h3>
          <span className="text-xs text-neutral-500 ml-auto">{isDark ? '深色' : '浅色'}模式即时渲染</span>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4 transition-colors',
            isDark ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white'
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

      {/* 当前状态摘要 */}
      <p className="text-xs text-neutral-500 px-1" aria-live="polite">
        当前：{isDark ? '深色' : '浅色'}渲染
        · 模式：{mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
        · 过渡：{TRANSITIONS.find(t => t.t === transitionType)?.label ?? transitionType}
        · 减少动画：{motionPreferences.reducedMotion ? '开启' : '关闭'}
      </p>
    </div>
  );
};

export default ThemePanel;
