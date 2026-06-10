import { useTheme } from '@/hooks/useTheme'

export interface ChartThemeConfig {
  background: string
  grid: {
    color: string
    strokeDasharray: string
  }
  axis: {
    stroke: string
    tick: string
  }
  legend: {
    text: string
  }
  tooltip: {
    background: string
    border: string
    text: string
  }
  radar: {
    grid: string
    axis: string
    fill: string
    fillOpacity: number
    stroke: string
  }
  line: {
    stroke: string
    fill: string
  }
  bar: {
    fill: string
    background: string
  }
  pie: {
    colors: string[]
  }
}

export const darkModeChartTheme: ChartThemeConfig = {
  background: 'transparent',
  grid: {
    color: '#4B5563',
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: '#9CA3AF',
    tick: '#9CA3AF',
  },
  legend: {
    text: '#D1D5DB',
  },
  tooltip: {
    background: '#1F2937',
    border: '#374151',
    text: '#F9FAFB',
  },
  radar: {
    grid: '#4B5563',
    axis: '#9CA3AF',
    fill: '#3B82F6',
    fillOpacity: 0.3,
    stroke: '#60A5FA',
  },
  line: {
    stroke: '#60A5FA',
    fill: '#3B82F6',
  },
  bar: {
    fill: '#3B82F6',
    background: '#374151',
  },
  pie: {
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'],
  },
}

export const lightModeChartTheme: ChartThemeConfig = {
  background: 'transparent',
  grid: {
    color: '#E5E7EB',
    strokeDasharray: '3 3',
  },
  axis: {
    stroke: '#6B7280',
    tick: '#6B7280',
  },
  legend: {
    text: '#374151',
  },
  tooltip: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    text: '#1F2937',
  },
  radar: {
    grid: '#E5E7EB',
    axis: '#6B7280',
    fill: '#14B8A6',
    fillOpacity: 0.2,
    stroke: '#14B8A6',
  },
  line: {
    stroke: '#14B8A6',
    fill: '#14B8A6',
  },
  bar: {
    fill: '#14B8A6',
    background: '#F3F4F6',
  },
  pie: {
    colors: ['#059669', '#2563EB', '#7C3AED', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'],
  },
}

export function useChartTheme(): ChartThemeConfig {
  const { isDark } = useTheme()
  return isDark ? darkModeChartTheme : lightModeChartTheme
}

export const chartColors = {
  primary: {
    light: '#059669',
    dark: '#10B981',
  },
  secondary: {
    light: '#2563EB',
    dark: '#3B82F6',
  },
  tertiary: {
    light: '#7C3AED',
    dark: '#8B5CF6',
  },
  success: {
    light: '#10B981',
    dark: '#34D399',
  },
  warning: {
    light: '#F59E0B',
    dark: '#FBBF24',
  },
  danger: {
    light: '#EF4444',
    dark: '#F87171',
  },
  text: {
    light: '#6B7280',
    dark: '#9CA3AF',
  },
  grid: {
    light: '#E5E7EB',
    dark: '#4B5563',
  },
}
