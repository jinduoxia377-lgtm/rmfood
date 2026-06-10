/**
 * Material Design 3 Theme Switcher Component
 *
 * 主题切换组件，支持明暗模式切换和主题预设选择
 */

import React from 'react';
import clsx from 'clsx';
import { useThemeMode, useThemePreset } from '../ThemeProvider';

export interface ThemeSwitcherProps {
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className }) => {
  const { mode, setMode } = useThemeMode();
  const { preset, presets, setPreset } = useThemePreset();

  return (
    <div className={clsx('flex flex-col gap-4 p-4', className)}>
      {/* 模式切换 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-text-secondary">模式</span>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('light')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              mode === 'light'
                ? 'bg-primary text-primary-on shadow-md'
                : 'bg-surface-variant text-text-secondary hover:bg-surface-variant/80',
            )}
          >
            浅色
          </button>
          <button
            onClick={() => setMode('dark')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              mode === 'dark'
                ? 'bg-primary text-primary-on shadow-md'
                : 'bg-surface-variant text-text-secondary hover:bg-surface-variant/80',
            )}
          >
            深色
          </button>
        </div>
      </div>

      {/* 主题预设选择 */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-secondary">主题预设</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                preset.id === p.id
                  ? 'bg-primary text-primary-on'
                  : 'bg-surface-variant text-text-secondary hover:bg-surface-variant/80',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThemeSwitcher;
