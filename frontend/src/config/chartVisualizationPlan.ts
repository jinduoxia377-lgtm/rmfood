/**
 * 图表可视化规划方案
 * 基于 Recharts 的企业级数据可视化架构设计
 *
 * 📊 文档版本: v1.0
 * 📅 创建日期: 2025-01-08
 * 👤 作者: AI 架构师
 */

// ═══════════════════════════════════════════
// 1. 架构概述
// ═══════════════════════════════════════════

export interface ChartArchitectureConfig {
  defaultLibrary: 'recharts' | 'echarts'
  enableEChartsFallback: boolean
  animation: {
    enabled: boolean
    duration: number
    easing: string
  }
  responsive: {
    breakpoints: {
      mobile: number
      tablet: number
      desktop: number
    }
    simplifyOnMobile: boolean
  }
  performance: {
    virtualScrollThreshold: number
    samplingThreshold: number
    maxFPS: number
  }
}

export const DEFAULT_CHART_ARCHITECTURE_CONFIG: ChartArchitectureConfig = {
  defaultLibrary: 'recharts',
  enableEChartsFallback: true,
  animation: {
    enabled: true,
    duration: 800,
    easing: 'ease-in-out',
  },
  responsive: {
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1440,
    },
    simplifyOnMobile: true,
  },
  performance: {
    virtualScrollThreshold: 10000,
    samplingThreshold: 50000,
    maxFPS: 60,
  },
}

// ═══════════════════════════════════════════
// 2. 技术选型与对比
// ═══════════════════════════════════════════

export type ChartLibraryType = 'recharts' | 'echarts'

export interface ChartLibraryAdapter<T = any> {
  library: ChartLibraryType
  render: (container: HTMLElement, options: T) => void
  destroy: () => void
  updateData: (data: any[]) => void
  resize: () => void
  exportImage: (format: 'png' | 'svg' | 'jpeg') => Blob
  getInstance: () => any
}

// ═══════════════════════════════════════════
// 3. 核心组件体系
// ═══════════════════════════════════════════

export interface BaseChartProps {
  id?: string
  data: any[]
  width?: number | string
  height?: number | string
  responsive?: boolean
  loading?: boolean
  error?: string | Error
  emptyText?: string
  className?: string
  style?: React.CSSProperties
  onClick?: (data: any, index: number) => void
  onHover?: (data: any | null, index?: number) => void
  transformData?: (data: any[]) => any[]
}

export interface BarChartProps extends BaseChartProps {
  xKey: string
  yKeys: {
    key: string
    name: string
    color?: string
    stackId?: string
  }[]
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
  barSize?: number
  showValues?: boolean
  valueFormatter?: (value: number) => string
}

export interface LineChartProps extends BaseChartProps {
  xKey: string
  series: {
    key: string
    name: string
    color?: string
    lineWidth?: number
    dashed?: boolean
    type?: 'monotone' | 'linear' | 'step' | 'basis'
  }[]
  smooth?: boolean
  showDots?: boolean
  area?: boolean
  areaOpacity?: number
}

export interface PieChartProps extends BaseChartProps {
  nameKey: string
  valueKey: string
  donut?: boolean
  innerRadius?: number
  showPercentages?: boolean
  activeIndex?: number
  labelPosition?: 'inside' | 'outside' | 'center'
}

export interface RadarChartProps extends BaseChartProps {
  series: {
    name: string
    data: Record<string, number>
    color?: string
    fillOpacity?: number
  }[]
  dimensions: {
    key: string
    label: string
    max?: number
  }[]
  filled?: boolean
  startAngle?: number
}

export interface ScatterPlotProps extends BaseChartProps {
  xKey: string
  yKey: string
  sizeKey?: string
  colorKey?: string
  pointSize?: number
  trendLine?: boolean
  trendLineType?: 'linear' | 'polynomial' | 'exponential'
}

// ═══════════════════════════════════════════
// 4. 数据接口规范
// ═══════════════════════════════════════════

export type ChartDataPoint = Record<string, any>;

export interface TimeSeriesDataPoint extends ChartDataPoint {
  timestamp: string | Date
  value: number
  category?: string
}

export interface CategoricalDataPoint extends ChartDataPoint {
  category: string
  value: number
  subcategory?: string
}

export interface MultiDimensionalData {
  dimensions: string[]
  values: number[]
}

export interface HierarchicalNode {
  name: string
  value?: number
  children?: HierarchicalNode[]
}

export interface GeoDataPoint {
  name: string
  value: number
  coordinates?: [number, number]
}

export interface DataTransformer<Input, Output> {
  transform: (input: Input) => Output
  reverseTransform?: (output: Output) => Input
  validate: (input: Input) => { valid: boolean; errors: string[] }
}

export const DataTransformers = {
  formulaToPieData: (
    ingredients: { name: string; percentage: number }[],
  ) =>
    ingredients.map(ing => ({
      name: ing.name,
      value: ing.percentage,
    })),

  timeSeriesToTrendData: (
    data: TimeSeriesDataPoint[],
    groupBy?: string,
  ) => {
    if (!groupBy) return data

    const grouped = data.reduce((acc, item) => {
      const key = item[groupBy] || 'default'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, TimeSeriesDataPoint[]>)

    return Object.entries(grouped).map(([name, items]) => ({
      name,
      data: items.map(item => ({
        timestamp: item.timestamp,
        value: item.value,
      })),
    }))
  },

  assessmentToRadarData: (
    assessment: Record<string, number>,
    labels?: Record<string, string>,
  ) => ({
    dimensions: Object.keys(assessment).map(key => ({
      key,
      label: labels?.[key] || key,
      max: 100,
    })),
    values: Object.values(assessment),
  }),
}

// ═══════════════════════════════════════════
// 5. 主题系统设计
// ═══════════════════════════════════════════

export interface ChartTheme {
  name: string
  colors: {
    primary: string[]
    secondary: string[]
    semantic: {
      success: string
      warning: string
      error: string
      info: string
    }
    grayscale: string[]
  }
  typography: {
    fontFamily: string
    titleSize: number
    labelSize: number
    tickSize: number
  }
  grid: {
    color: string
    dashArray: string
    visible: boolean
  }
  tooltip: {
    backgroundColor: string
    borderColor: string
    textColor: string
    borderRadius: number
    fontSize: number
  }
  legend: {
    fontSize: number
    iconSize: number
    position: 'top' | 'bottom' | 'left' | 'right'
  }
  animation: {
    enabled: boolean
    duration: number
    easing: string
  }
}

export const ChartThemes = {
  light: {
    name: 'Light',
    colors: {
      primary: ['var(--color-secondary-500)', '#16a34a', '#B45309', '#B91C1C', '#9333ea'],
      secondary: ['#6ECAFF', '#4ade80', '#F59E0B', '#EF4444', '#c084fc'],
      semantic: {
        success: '#16a34a',
        warning: '#B45309',
        error: '#B91C1C',
        info: 'var(--color-secondary-500)',
      },
      grayscale: ['#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      titleSize: 16,
      labelSize: 12,
      tickSize: 11,
    },
    grid: {
      color: '#e5e7eb',
      dashArray: '3 3',
      visible: true,
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      textColor: '#374151',
      borderRadius: 8,
      fontSize: 13,
    },
    legend: {
      fontSize: 12,
      iconSize: 14,
      position: 'bottom' as const,
    },
    animation: {
      enabled: true,
      duration: 500,
      easing: 'ease-out',
    },
  } as ChartTheme,

  dark: {
    name: 'Dark',
    colors: {
      primary: ['var(--color-secondary-500)', 'var(--color-primary-400)', '#D97706', '#FF3B30', '#a855f7'],
      secondary: ['#6ECAFF', '#4ade80', '#F59E0B', '#EF4444', '#c084fc'],
      semantic: {
        success: 'var(--color-primary-400)',
        warning: '#D97706',
        error: '#FF3B30',
        info: 'var(--color-secondary-500)',
      },
      grayscale: ['#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151'],
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      titleSize: 16,
      labelSize: 12,
      tickSize: 11,
    },
    grid: {
      color: '#374151',
      dashArray: '3 3',
      visible: true,
    },
    tooltip: {
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textColor: '#f3f4f6',
      borderRadius: 8,
      fontSize: 13,
    },
    legend: {
      fontSize: 12,
      iconSize: 14,
      position: 'bottom' as const,
    },
    animation: {
      enabled: true,
      duration: 500,
      easing: 'ease-out',
    },
  } as ChartTheme,

  professional: {
    name: 'Professional',
    colors: {
      primary: ['#003E87', '#1E8E3E', '#D97706', '#be123c', '#6b21a8'],
      secondary: ['var(--color-secondary-500)', 'var(--color-primary-400)', '#D97706', '#FF3B30', 'var(--color-accent-500)'],
      semantic: {
        success: 'var(--color-primary-500)',
        warning: '#B45309',
        error: '#B91C1C',
        info: 'var(--color-secondary-500)',
      },
      grayscale: ['#1f2937', '#4b5563', '#9ca3af', '#d1d5db', '#f3f4f6'],
    },
    typography: {
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      titleSize: 18,
      labelSize: 13,
      tickSize: 12,
    },
    grid: {
      color: '#e5e7eb',
      dashArray: '4 4',
      visible: true,
    },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      textColor: '#111827',
      borderRadius: 12,
      fontSize: 14,
    },
    legend: {
      fontSize: 13,
      iconSize: 16,
      position: 'top' as const,
    },
    animation: {
      enabled: true,
      duration: 600,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  } as ChartTheme,
}

// ═══════════════════════════════════════════
// 6. 性能优化策略
// ═══════════════════════════════════════════

export interface PerformanceConfig {
  enableVirtualScroll: boolean
  sampling: {
    enabled: boolean
    algorithm: 'lttb' | 'largest-triangle' | 'random'
    maxPoints: number
  }
  worker: {
    enabled: boolean
    maxWorkers: number
  }
  cache: {
    enabled: boolean
    maxSize: number
    ttl: number
  }
  rendering: {
    useRAF: boolean
    useOffscreenCanvas: boolean
    enableGPUAcceleration: boolean
  }
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableVirtualScroll: true,
  sampling: {
    enabled: true,
    algorithm: 'lttb',
    maxPoints: 1000,
  },
  worker: {
    enabled: true,
    maxWorkers: 4,
  },
  cache: {
    enabled: true,
    maxSize: 50,
    ttl: 300,
  },
  rendering: {
    useRAF: true,
    useOffscreenCanvas: false,
    enableGPUAcceleration: false,
  },
}

// ═══════════════════════════════════════════
// 7. 交互功能规划
// ═══════════════════════════════════════════

export interface InteractionConfig {
  zoom: {
    enabled: boolean
    sensitivity: number
    minZoom: number
    maxZoom: number
  }
  pan: {
    enabled: boolean
    constraint: 'none' | 'horizontal' | 'vertical' | 'both'
  }
  brush: {
    enabled: boolean
    mode: 'single' | 'multi' | 'range'
  }
  crossFilter: {
    enabled: boolean
    debounceMs: number
  }
  drillDown: {
    enabled: boolean
    maxDepth: number
  }
}

// ═══════════════════════════════════════════
// 8. 导出与分享
// ═══════════════════════════════════════════

export interface ExportOptions {
  format: 'png' | 'svg' | 'jpeg' | 'pdf' | 'csv'
  imageOptions?: {
    pixelRatio?: 1 | 2 | 3
    backgroundColor?: string
    width?: number
    height?: number
    includeTitle?: boolean
    includeLegend?: boolean
    quality?: number
  }
  pdfOptions?: {
    title?: string
    orientation?: 'portrait' | 'landscape'
    margins?: { top: number; right: number; bottom: number; left: number }
  }
  watermark?: {
    enabled: boolean
    text: string
    opacity: number
    fontSize: number
  }
}

// ═══════════════════════════════════════════
// 9. 实施路线图
// ═══════════════════════════════════════════

export interface RoadmapPhase {
  phase: number
  name: string
  duration: string
  tasks: {
    id: string
    name: string
    priority: 'high' | 'medium' | 'low'
    status: 'pending' | 'in-progress' | 'completed'
    dependencies?: string[]
  }[]
}

export const CHART_ROADMAP: RoadmapPhase[] = [
  {
    phase: 1,
    name: '基础设施',
    duration: '2周',
    tasks: [
      { id: '1.1', name: '图表组件库搭建', priority: 'high', status: 'completed' },
      { id: '1.2', name: '统一数据接口', priority: 'high', status: 'completed' },
      { id: '1.3', name: '主题系统集成', priority: 'medium', status: 'completed' },
      { id: '1.4', name: '响应式布局', priority: 'medium', status: 'completed' },
    ],
  },
  {
    phase: 2,
    name: '核心图表',
    duration: '2周',
    tasks: [
      { id: '2.1', name: '柱状图/条形图', priority: 'high', status: 'pending' },
      { id: '2.2', name: '折线图/面积图', priority: 'high', status: 'pending' },
      { id: '2.3', name: '饼图/环形图', priority: 'high', status: 'pending' },
      { id: '2.4', name: '雷达图', priority: 'high', status: 'pending' },
      { id: '2.5', name: '散点图', priority: 'medium', status: 'pending' },
    ],
  },
  {
    phase: 3,
    name: '高级功能',
    duration: '2周',
    tasks: [
      { id: '3.1', name: '交互功能（缩放、筛选）', priority: 'high', status: 'pending' },
      { id: '3.2', name: '联动效果', priority: 'medium', status: 'pending' },
      { id: '3.3', name: '导出功能', priority: 'medium', status: 'pending' },
      { id: '3.4', name: '性能优化', priority: 'high', status: 'pending' },
    ],
  },
]
