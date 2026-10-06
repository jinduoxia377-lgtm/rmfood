import React, { useRef, useState } from 'react';
import {
  Sun, Moon, Monitor, Palette, Accessibility, BookOpen, Eye,
  Download, Upload, RotateCcw, CheckCircle2, AlertCircle, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTheme, useThemeStore,
  presetThemes,
  type PresetThemeId,
} from '@/theme';

/**
 * ThemePanel — 主题设置面板（嵌入 SettingsPage「主题」tab）
 *
 * 规范依据（RMFOOD-主题系统设计规范 v1.1.9）：
 *  - §8.2 U-4：状态读写一律走 useTheme() / useThemeStore()
 *  - §8.2 U-5：导入/导出禁止自造格式，走 themeStore.exportTheme()/importTheme()
 *  - §8.2 U-6：预设选中态从 store 派生（activeThemeId），禁止本地 state 初值
 *  - §4.3 C-24：反转色阶（400..950）禁止配白字 → 选中态用 .bg-primary-container + .border-primary-main
 *  - §10.3 GATE-12：只用 L1 已登记的语义类（semantic-utils.css），禁双前缀伪类名
 *
 * 颜色令牌体系（全部 L1 语义色，暗色自动反转，无需 dark: 变体）：
 *  - 文字：.text-neutral-900 / .text-neutral-700 / .text-neutral-500 / .text-primary-main / .text-error-main
 *  - 表面：.surface-card / .surface-hover（单前缀，非 bg-surface-*）
 *  - 边框：.border-neutral-200 / .border-primary-main
 *  - 选中态：.bg-primary-container（浅色 #d1fae5 / 深色 #047857，对比度 4.5:1 合规）
 */
export const ThemePanel: React.FC = () => {
  const {
    mode, accessibilityMode, activeThemeId,
    setThemeMode, setPresetTheme, setAccessibilityMode, resetToDefault,
  } = useTheme();

  const { motionPreferences, setMotionPreferences, exportTheme, importTheme } = useThemeStore();

  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportTheme();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmfood-theme-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ok = importTheme(String(ev.target?.result ?? ''));
      setImportError(ok ? null : '导入失败：无效的主题配置（仅接受 RMFOOD 导出的 JSON）');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const MODES = [
    { mode: 'light' as const, icon: Sun, label: '浅色模式', desc: '明亮清爽，适合白天使用' },
    { mode: 'dark' as const, icon: Moon, label: '深色模式', desc: '护眼沉浸，适合夜间使用' },
    { mode: 'system' as const, icon: Monitor, label: '跟随系统', desc: '自动适配操作系统偏好' },
  ];

  const ACCESS = [
    { m: 'normal' as const, icon: Eye, label: '标准', desc: '默认显示' },
    { m: 'high-contrast' as const, icon: Palette, label: '高对比度', desc: '增强色差' },
    { m: 'reading' as const, icon: BookOpen, label: '阅读模式', desc: '护眼色调' },
    { m: 'color-blind' as const, icon: Accessibility, label: '色盲友好', desc: '色觉安全色板' },
  ];

  // 选中 / 未选中 tile 类名（全部 L1 语义色）
  const tileActive = 'border-primary-main bg-primary-container';
  const tileIdle = 'border-neutral-200 surface-hover';

  return (
    <div className="space-y-6">
      {/* ═══ 1. 主题模式（三态）═══ */}
      <div className="surface-card rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Sun size={18} className="text-primary-main" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">外观模式</h3>
          <span className="text-xs text-neutral-500 ml-auto">快捷键 Ctrl+Shift+T 快速切换</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="主题模式">
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
                {active && <CheckCircle2 size={14} className="absolute top-2.5 right-2.5 text-primary-main" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 2. 预设主题（U-6：选中态从 activeThemeId 派生）═══ */}
      <div className="surface-card rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles size={18} className="text-primary-main" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">预设主题</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(presetThemes).map((t) => {
            const active = activeThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPresetTheme(t.id as PresetThemeId)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <span
                  className="w-9 h-9 rounded-lg shadow-sm shrink-0"
                  style={{ backgroundColor: t.colors.primary.main }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900 truncate">{t.name}</span>
                  <span className="block text-xs text-neutral-500 truncate">{t.description}</span>
                </span>
                {active && <CheckCircle2 size={18} className="text-primary-main shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. 无障碍模式（4 档）═══ */}
      <div className="surface-card rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Accessibility size={18} className="text-primary-main" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">无障碍模式</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACCESS.map(({ m, icon: Icon, label, desc }) => {
            const active = accessibilityMode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setAccessibilityMode(m)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50',
                  active ? tileActive : tileIdle
                )}
              >
                <Icon size={20} className={active ? 'text-primary-main' : 'text-neutral-700'} aria-hidden />
                <span className="text-xs font-medium text-neutral-900">{label}</span>
                <span className="text-[11px] text-neutral-500 text-center leading-tight">{desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 4. 减少动画（motionPreferences）═══ */}
      <div className="surface-card rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">减少动画</h3>
            <p className="text-xs text-neutral-500 mt-1">降低或禁用界面动效，可配合系统「减弱动态效果」偏好</p>
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
      </div>

      {/* ═══ 5. 导入 / 导出 / 重置（U-5：themeStore 权威通道）═══ */}
      <div className="surface-card rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Download size={18} className="text-primary-main" aria-hidden />
          <h3 className="text-sm font-semibold text-neutral-900">导入 / 导出 / 重置</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
          >
            <Download size={14} aria-hidden /> 导出配置
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
          >
            <Upload size={14} aria-hidden /> 导入配置
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" aria-hidden />
          <button
            type="button"
            onClick={() => { resetToDefault(); setImportError(null); }}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/50"
          >
            <RotateCcw size={14} aria-hidden /> 重置默认
          </button>
          {importError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-error-main w-full">
              <AlertCircle size={14} aria-hidden />{importError}
            </p>
          )}
        </div>
      </div>

      {/* 当前状态摘要 */}
      <p className="text-xs text-neutral-500 px-1" aria-live="polite">
        当前模式：{mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}
        · 无障碍：{accessibilityMode}
        · 预设：{activeThemeId}
        · 减少动画：{motionPreferences.reducedMotion ? '开启' : '关闭'}
      </p>
    </div>
  );
};

export default ThemePanel;
