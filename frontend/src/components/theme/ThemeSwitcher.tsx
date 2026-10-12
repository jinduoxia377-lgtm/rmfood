import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '@/theme';

interface ThemeSwitcherProps {
  variant?: 'icon-only' | 'compact' | 'full';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * ThemeSwitcher — 侧栏【轻量】明暗切换器（执行方案阶段 C5）
 *
 * 定位：只负责一件事 —— 在 light / dark / system 三态间快速切换。
 * 配色、字号、无障碍模式、过渡动画等完整控制在 SettingsPage「主题」tab
 * （ThemePanel）统一承载，此处提供跳转入口，避免两处各管一半：
 *
 * 移除的四块及原因：
 *  - 无障碍模式四态：已由 C3 迁入 ThemePanel。原先只有侧栏下拉能改无障碍模式，
 *    而 /settings 主入口反而够不着 —— 主入口残缺、快捷入口反而更全，是倒置的。
 *  - 过渡效果：重复 ThemePanel ③，且**功能坏** —— 用本地 useState 而 store 里的
 *    transitionType 从不被改，选了不生效。
 *  - 快速预设切换（light-default/dark-default）：重复 ThemePanel ①，且**功能坏**
 *    —— setPresetTheme 按设计不修改 mode（D-34），点击后 mode 保持不动。
 *  - 「高对比度/阅读」标签优先于明暗标签：会让按钮文字与实际明暗脱节，易误导。
 *
 * 状态读写走 useThemeStore（§8.2 U-4），选中态从 store 派生（§8.2 U-6）。
 */
export function ThemeSwitcher({
  variant = 'compact',
  size = 'md',
  showLabel = true,
  className = '',
}: ThemeSwitcherProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { mode, setThemeMode, accessibilityMode } = useThemeStore();

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return;
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return;
  }, [isOpen]);

  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-11 h-11',
  };

  const MODES: { value: ThemeMode; label: string; icon: React.FC<{ size?: number | string }> }[] = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ];

  const current = MODES.find((m) => m.value === mode) ?? MODES[0];
  const CurrentIcon = current.icon;

  return (
    <div className={`theme-switcher relative ${className}`} ref={panelRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          ${sizeClasses[size]}
          inline-flex items-center justify-center
          rounded-lg
          bg-background-elevated hover:bg-background-hover
          border border-border-default focus:border-primary-main
          text-text-primary
          cursor-pointer
          transition-all duration-150 ease-out
          hover:shadow-md
          focus:outline-none focus:ring-2 focus:ring-primary-main/30 focus:ring-offset-2
          active:scale-95
          min-w-[44px] min-h-[44px]
          ${variant === 'icon-only' ? '' : 'gap-2 px-3'}
        `}
        aria-label={`切换主题：当前${current.label}${accessibilityMode === 'high-contrast' ? '，已开启高对比度' : accessibilityMode === 'reading' ? '，已开启阅读模式' : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <CurrentIcon size={18} />

        {showLabel && variant !== 'icon-only' && (
          <span className="hidden sm:inline font-medium text-sm">{current.label}</span>
        )}

        {(variant === 'full' || variant === 'compact') && (
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-background-elevated shadow-xl z-50 p-2"
          role="listbox"
          aria-label="选择主题模式"
        >
          <div className="grid grid-cols-1 gap-1" role="radiogroup" aria-label="明暗模式">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${m.label}模式`}
                  onClick={() => {
                    setThemeMode(m.value);
                    setIsOpen(false);
                  }}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm transition-all
                    cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/30
                    ${active
                      ? 'border-primary-main bg-primary-container'
                      : 'border-transparent hover:bg-background-hover'}
                  `}
                >
                  <Icon size={16} aria-hidden />
                  <span className="flex-1 text-left text-neutral-800 dark:text-neutral-200">{m.label}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-main" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <a
            href="/settings?tab=theme"
            onClick={() => setIsOpen(false)}
            className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-background-hover hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main/30"
          >
            <SlidersHorizontal size={14} aria-hidden />
            配色 / 字号 / 无障碍 等完整主题设置
          </a>
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
