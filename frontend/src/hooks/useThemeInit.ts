/**
 * 主题初始化 Hook
 * 用于全局主题初始化，包括系统偏好检测和自动初始化
 */

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

/**
 * 使用主题初始化的 Hook
 * 应该在 App 根组件中调用一次
 */
export function useThemeInit() {
  const { mode } = useThemeStore();

  useEffect(() => {
    // 初始化主题

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') {
        // useThemeStore.getState().setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  // 监听过渡类型变化
  useEffect(() => {
    const unsubscribe = useThemeStore.subscribe((state) => {
      if (state.transitionType !== 'none') {
        document.documentElement.classList.add('theme-transitioning');
        const timer = setTimeout(() => {
          document.documentElement.classList.remove('theme-transitioning');
        }, 300);
        clearTimeout(timer);
      }
    });

    return unsubscribe;
  }, []);
}

/**
 * 获取当前系统主题偏好
 */
export function getSystemThemePreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/**
 * 检测是否支持 CSS 变量
 */
export function supportsCSSVariables(): boolean {
  if (typeof CSS === 'undefined') return false;
  return CSS.supports('color', 'var(--test)');
}



