import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/safeLogger';


type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'rmfood_ui_theme_preference'

interface ThemeState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
}

export function useThemePersistence() {
  const [state, setState] = useState<ThemeState>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored) {
        const theme = stored as Theme
        return {
          theme,
          resolvedTheme: theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
            : theme,
        }
      }
    } catch (error) {
      logger.warn('Error reading theme from localStorage:', error)
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return {
      theme: 'system',
      resolvedTheme: prefersDark ? 'dark' : 'light',
    }
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      if (state.theme === 'system') {
        setState(prev => ({
          ...prev,
          resolvedTheme: e.matches ? 'dark' : 'light',
        }))
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [state.theme])

  useEffect(() => {
    const root = document.documentElement

    if (state.resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [state.resolvedTheme])

  const setTheme = useCallback((theme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)

      const resolvedTheme = theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme

      setState({ theme, resolvedTheme })
    } catch (error) {
      logger.warn('Error saving theme to localStorage:', error)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const newTheme = state.resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }, [state.resolvedTheme, setTheme])

  return {
    theme: state.theme,
    resolvedTheme: state.resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: state.resolvedTheme === 'dark',
  }
}

export type { Theme, ThemeState }
