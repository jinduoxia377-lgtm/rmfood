import { useState, useEffect, useCallback } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import type { ThemeStyles, ThemeMode } from '@/types/theme-mode'

export function useThemeQuery() {
  const { mode, activeTheme } = useThemeStore()

  const getColor = useCallback(
    (token: string): string => {
      const colorMap: Record<string, string> = {
        primary: activeTheme?.colors?.primary?.main || '#059669',
        secondary: activeTheme?.colors?.secondary?.main || '#10b981',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#111827',
      }
      return colorMap[token] ?? '#000000'
    },
    [activeTheme],
  )

  const getTypography = useCallback(() => ({
    fontFamily: activeTheme?.typography?.fontFamily ?? "'Microsoft YaHei', sans-serif",
    fontSize: activeTheme?.typography?.fontSize ?? 16,
    lineHeight: 1.5,
    fontWeight: 400,
  }), [activeTheme])

  const getSpacing = useCallback(() => ({
    spacing: 8,
    borderRadius: activeTheme?.borderRadius?.lg ?? 12,
    shadowIntensity: 2,
  }), [activeTheme])

  const getStyles = useCallback((groups: ('colors' | 'typography' | 'spacing')[]) => {
    const result: Record<string, unknown> = {}
    if (groups.includes('colors')) result.colors = { primary: getColor('primary') }
    if (groups.includes('typography')) result.typography = getTypography()
    if (groups.includes('spacing')) result.spacing = getSpacing()
    return result
  }, [getColor, getTypography, getSpacing])

  return { mode: mode as ThemeMode, getColor, getTypography, getSpacing, getStyles }
}
