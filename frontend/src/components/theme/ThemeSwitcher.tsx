import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Eye, Accessibility, Zap, Palette } from 'lucide-react';
import { useTheme, type ThemeMode, type AccessibilityMode, type TransitionType, presetThemes, type PresetThemeId, type ThemeConfig } from '@/theme';

interface ThemeSwitcherProps {
  variant?: 'icon-only' | 'compact' | 'full';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ThemeSwitcher({
  variant = 'compact',
  size = 'md',
  showLabel = true,
  className = '',
}: ThemeSwitcherProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [transitionType, setTransitionType] = useState<'fade' | 'slide' | 'scale'>('fade');

  const {
    mode,
    accessibilityMode,
    setThemeMode,
    setPresetTheme,
    setAccessibilityMode,
  } = useTheme();

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

  // ESC关闭
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
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
        aria-label="切换主题"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {mode === 'dark' ? (
          <MoonIcon />
        ) : mode === 'system' ? (
          <MonitorIcon />
        ) : (
          <SunIcon />
        )}

        {showLabel && variant !== 'icon-only' && (
          <span className="hidden sm:inline font-medium text-sm">
            {accessibilityMode === 'high-contrast'
              ? '高对比度'
              : accessibilityMode === 'reading'
              ? '阅读'
              : mode === 'dark'
              ? '深色'
              : mode === 'system'
              ? '跟随系统'
              : '浅色'}
          </span>
        )}

        {(variant === 'full' || variant === 'compact') && (
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className={`
            absolute right-0 mt-2
            bg-surface-default rounded-xl shadow-lg border border-border-default
            overflow-hidden
            z-dropdown
            animate-in fade-in slide-in-from-top-2 duration-200
            w-${variant === 'full' ? '96' : variant === 'compact' ? '80' : '72'}
          `}
          role="dialog"
          aria-label="主题设置"
          aria-modal="false"
        >
          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
            {/* 主题模式选择 */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Palette size={16} />
                主题模式
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: 'light' as ThemeMode, icon: Sun, label: '浅色' },
                  { mode: 'dark' as ThemeMode, icon: Moon, label: '深色' },
                  { mode: 'system' as ThemeMode, icon: Monitor, label: '跟随系统' },
                ].map(({ mode: modeOption, icon: Icon, label }) => (
                  <button
                    key={modeOption}
                    onClick={() => setThemeMode(modeOption)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                      ${mode === modeOption
                        ? 'border-primary-main bg-primary-main/10'
                        : 'border-border-default hover:border-border-hover bg-background-elevated'}
                    `}
                  >
                    <Icon size={20} className={mode === modeOption ? 'text-primary-main' : 'text-text-secondary'} />
                    <span className="text-xs mt-1.5 font-medium text-text-primary">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 无障碍模式 */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Accessibility size={16} />
                无障碍模式
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { mode: 'normal' as AccessibilityMode, label: '标准' },
                  { mode: 'high-contrast' as AccessibilityMode, label: '高对比度' },
                  { mode: 'reading' as AccessibilityMode, label: '阅读' },
                  { mode: 'color-blind' as AccessibilityMode, label: '色盲友好' },
                ].map(({ mode: accMode, label }) => (
                  <button
                    key={accMode}
                    onClick={() => setAccessibilityMode(accMode)}
                    className={`
                      px-3 py-2 rounded-lg border text-sm font-medium transition-all
                      ${accessibilityMode === accMode
                        ? 'border-primary-main bg-primary-main/10 text-primary-main'
                        : 'border-border-default hover:border-border-hover text-text-secondary'}
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 过渡效果 */}
            {variant === 'full' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Zap size={16} />
                  过渡效果
                </h3>
                <div className="flex gap-2">
                  {([
                    { value: 'fade' as const, label: '淡入淡出' },
                    { value: 'slide' as const, label: '滑动' },
                    { value: 'scale' as const, label: '缩放' },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTransitionType(option.value)}
                      className={`
                        flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                        ${transitionType === option.value
                          ? 'border-primary-main bg-primary-main/10 text-primary-main'
                          : 'border-border-default hover:border-border-hover text-text-secondary'}
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 快速预设预览 */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">快速切换</h3>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(presetThemes) as [PresetThemeId, ThemeConfig][]).slice(0, 6).map(([id, theme]) => (
                  <button
                    key={id}
                    onClick={() => setPresetTheme(id)}
                    className={`
                      flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left
                      ${theme.id === presetThemes[mode === 'dark' ? 'dark-default' : 'light-default']?.id
                        ? 'border-primary-main ring-1 ring-primary-main/30'
                        : 'border-border-default hover:border-border-hover'}
                    `}
                  >
                    <div
                      className="w-6 h-6 rounded-md shrink-0"
                      style={{ backgroundColor: theme.colors.primary.main }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-text-primary truncate">{theme.name}</div>
                      <div className="text-[10px] text-text-secondary">{theme.mode}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 图标组件 ====================

function SunIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default ThemeSwitcher;
