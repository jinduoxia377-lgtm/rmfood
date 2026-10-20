/**
 * SynergyRadarChart - 药食同源与多肽成分协同效果交互式雷达图
 *
 * 技术选型说明:
 * - 使用 Recharts 作为基础图表库（项目已集成 ^2.15.3）
 * - 选择理由: React 原生支持、TypeScript 类型完善、生态成熟、与现有代码风格一致
 * - 相比 @nivo/radar: 无需新增依赖、团队已有使用经验
 * - 相比 D3.js: 开发效率更高、维护成本更低
 *
 * 关键实现细节:
 * 1. 六维数据模型：协同强度、生物利用度提升、功效倍增效应、安全性指数、稳定性改善、口感平衡度
 * 2. 支持单/多组合对比模式，最多4个数据系列
 * 3. 完整的交互系统：悬停高亮、点击回调、图例切换
 * 4. 内置维度详情面板：展示评分标准、科学机制和优化建议
 * 5. 导出功能：支持 PNG (2x Retina) 和 SVG 格式
 * 6. 响应式设计 + 深色模式自动适配
 * 7. 性能优化：React.memo + useMemo + requestAnimationFrame
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from 'react'
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import html2canvas from 'html2canvas'


import { logger } from '@/utils/safeLogger';
export type SynergyDimension =
  | 'synergyStrength'
  | 'bioavailabilityEnhancement'
  | 'efficacyMultiplication'
  | 'safetyIndex'
  | 'stabilityImprovement'
  | 'tasteBalance'

export interface DimensionScore {
  dimension: SynergyDimension
  value: number
}

export interface SynergyRadarData {
  id: string
  name: string
  scores: DimensionScore[]
  color?: string
}

export interface SynergyRadarChartProps {
  data: SynergyRadarData[]
  width?: number
  height?: number
  showLegend?: boolean
  interactive?: boolean
  onDimensionClick?: (dimension: SynergyDimension, value: number) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

const DIMENSION_CONFIG: Record<
  SynergyDimension,
  {
    label: string
    labelEn: string
    description: string
    scoringCriteria: { range: string; level: string; color: string }[]
    mechanism: string
    optimizationTips: string[]
  }
> = {
  synergyStrength: {
    label: '协同强度',
    labelEn: 'Synergy Strength',
    description: '衡量药食同源成分与多肽之间的协同作用强弱程度',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '基于多靶点协同理论，评估成分间的互补增效作用。通过分子对接模拟和体外实验验证协同指数。',
    optimizationTips: [
      '调整成分比例以优化分子间相互作用',
      '考虑添加天然协同增强剂（如胡椒碱）',
      '优化提取工艺保留活性成分完整性',
      '参考传统配伍经验进行组方优化',
    ],
  },
  bioavailabilityEnhancement: {
    label: '生物利用度提升',
    labelEn: 'Bioavailability Enhancement',
    description: '成分组合对生物利用度的改善效果',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '评估成分间对吸收、代谢、分布的相互影响。包括P-gp抑制、CYP450酶调控、肠道通透性改善等机制。',
    optimizationTips: [
      '添加吸收促进剂（如磷脂复合物）',
      '采用纳米载体技术提高溶解度',
      '优化给药时间和剂型选择',
      '考虑脂质体或微乳递送系统',
    ],
  },
  efficacyMultiplication: {
    label: '功效倍增效应',
    labelEn: 'Efficacy Multiplication',
    description: '组合后的功效是否呈现1+1>2的倍增效果',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '基于网络药理学和多通路调控理论，评估成分组合对多个靶点的协同激活或抑制作用。',
    optimizationTips: [
      '识别关键信号通路节点进行精准干预',
      '采用时序释放策略延长作用时间',
      '结合个体差异进行个性化配方调整',
      '建立量效关系模型确定最佳剂量范围',
    ],
  },
  safetyIndex: {
    label: '安全性指数',
    labelEn: 'Safety Index',
    description: '综合评估成分组合的安全性水平',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '综合毒理学评估、药物相互作用风险、不良反应概率等多维度安全性指标。',
    optimizationTips: [
      '严格筛选无已知相互禁忌的成分组合',
      '控制各成分在安全剂量范围内',
      '建立完整的不良反应监测体系',
      '参考权威数据库（如ToxCast）进行预筛',
    ],
  },
  stabilityImprovement: {
    label: '稳定性改善',
    labelEn: 'Stability Improvement',
    description: '成分组合对产品稳定性的提升程度',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '评估抗氧化保护、光热稳定性、货架期延长等物理化学稳定性指标。',
    optimizationTips: [
      '添加天然抗氧化剂（如维生素C/E、多酚类）',
      '优化包装材料和储存条件',
      '采用微胶囊化技术隔离敏感成分',
      '建立加速稳定性试验方案',
    ],
  },
  tasteBalance: {
    label: '口感平衡度',
    labelEn: 'Taste Balance',
    description: '最终产品的风味协调性和适口性',
    scoringCriteria: [
      { range: '85-100', level: '优秀', color: 'var(--color-primary-400)' },
      { range: '70-84', level: '良好', color: 'var(--color-secondary-500)' },
      { range: '55-69', level: '一般', color: '#D97706' },
      { range: '0-54', level: '需改进', color: '#FF3B30' },
    ],
    mechanism:
      '基于感官科学和味觉掩蔽技术，评估苦味、异味掩盖及整体风味平衡性。',
    optimizationTips: [
      '采用环糊精包埋技术掩蔽不良气味',
      '添加天然甜味剂和风味调节剂',
      '利用味觉竞争原理优化配方',
      '开展感官评价测试收集反馈',
    ],
  },
}

const DEFAULT_COLORS = ['var(--color-secondary-500)', 'var(--color-primary-400)', '#D97706', '#FF3B30']

const DIMENSION_ORDER: SynergyDimension[] = [
  'synergyStrength',
  'bioavailabilityEnhancement',
  'efficacyMultiplication',
  'safetyIndex',
  'stabilityImprovement',
  'tasteBalance',
]

interface ChartDataPoint {
  dimension: string
  dimensionKey: SynergyDimension
  [key: string]: string | number
}

const SynergyRadarChartComponent: React.FC<SynergyRadarChartProps> = ({
  data,
  width,
  height = 400,
  showLegend = true,
  interactive = true,
  onDimensionClick,
  loading = false,
  error,
  onRetry,
}) => {
  const [hoveredDimension, setHoveredDimension] =
    useState<SynergyDimension | null>(null)
  const [selectedDimension, setSelectedDimension] =
    useState<SynergyDimension | null>(null)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  const isDarkMode = useMemo(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  }, [])

  const themeColors = useMemo(
    () => ({
      background: isDarkMode ? '#1F2937' : '#FFFFFF',
      grid: isDarkMode ? '#4B5563' : '#E5E7EB',
      axisText: isDarkMode ? '#D1D5DB' : '#6B7280',
      tooltipBg: isDarkMode ? '#374151' : '#FFFFFF',
      tooltipBorder: isDarkMode ? '#4B5563' : '#E5E7EB',
      textPrimary: isDarkMode ? '#F9FAFB' : '#111827',
      textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
      emptyStateText: isDarkMode ? '#9CA3AF' : '#9CA3AF',
    }),
    [isDarkMode],
  )

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return DIMENSION_ORDER.map((dim) => {
      const config = DIMENSION_CONFIG[dim]
      const point: ChartDataPoint = {
        dimension: config.label,
        dimensionKey: dim,
      }

      data.forEach((dataset) => {
        if (!hiddenSeries.has(dataset.id)) {
          const score = dataset.scores.find((s) => s.dimension === dim)
          point[dataset.name] = score ? Math.max(0, Math.min(100, score.value)) : 0
        }
      })

      return point
    })
  }, [data, hiddenSeries])

  const visibleData = useMemo(
    () => data.filter((d) => !hiddenSeries.has(d.id)),
    [data, hiddenSeries],
  )

  const handleLegendClick = useCallback(
    (entry: { value: string }) => {
      setHiddenSeries((prev) => {
        const next = new Set(prev)
        const dataset = data.find((d) => d.name === entry.value)
        if (dataset) {
          if (next.has(dataset.id)) {
            next.delete(dataset.id)
          } else {
            if (next.size < data.length - 1) {
              next.add(dataset.id)
            }
          }
        }
        return next
      })
    },
    [data],
  )

  const handleDimensionClick = useCallback(
    (dimension: SynergyDimension, value: number) => {
      if (!interactive) return

      setSelectedDimension(dimension)
      onDimensionClick?.(dimension, value)
    },
    [interactive, onDimensionClick],
  )

  const closeDetailPanel = useCallback(() => {
    setSelectedDimension(null)
  }, [])

  const exportChart = useCallback(
    async (format: 'png' | 'svg') => {
      if (!chartRef.current || isExporting) return

      setIsExporting(true)

      try {
        if (format === 'png') {
          const canvas = await html2canvas(chartRef.current, {
            scale: 2,
            backgroundColor: themeColors.background,
            useCORS: true,
            logging: false,
          })

          const link = document.createElement('a')
          link.download = `synergy-radar-${Date.now()}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        } else if (format === 'svg') {
          const svgElement = chartRef.current.querySelector('svg')
          if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement)
            const blob = new Blob([svgData], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.download = `synergy-radar-${Date.now()}.svg`
            link.href = url
            link.click()

            URL.revokeObjectURL(url)
          }
        }
      } catch (err) {
        logger.error('导出失败:', err)
      } finally {
        setIsExporting(false)
      }
    },
    [isExporting, themeColors.background],
  )

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const CustomTooltip = useMemo(
    () =>
      ({ active, payload }: { active?: boolean; payload?: { payload: ChartDataPoint; color: string; name: string; value: number }[] }) => {
        if (!active || !payload?.length) return null

        const firstEntry = payload[0]
        if (!firstEntry) return null

        const dimensionData = firstEntry.payload
        if (!dimensionData) return null

        const dimConfig = DIMENSION_CONFIG[dimensionData.dimensionKey]
        if (!dimConfig) return null

        return (
          <div
            className="rounded-lg p-4 shadow-xl border backdrop-blur-sm"
            style={{
              backgroundColor: `${themeColors.tooltipBg}F5`,
              borderColor: themeColors.tooltipBorder,
              maxWidth: '280px',
            }}
            role="tooltip"
            aria-label={`${dimConfig.label}: ${firstEntry.value}`}
          >
            <div className="mb-2">
              <p className="font-semibold text-sm" style={{ color: themeColors.textPrimary }}>
                {dimConfig.label}
              </p>
              <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {dimConfig.description}
              </p>
            </div>

            <div className="space-y-1.5 mt-3 border-t pt-2" style={{ borderColor: themeColors.tooltipBorder }}>
              {payload.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
                      {entry.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: themeColors.textPrimary }}>
                    {Math.round(entry.value)}
                  </span>
                </div>
              ))}
            </div>

            {interactive && (
              <button
                onClick={() =>
                  handleDimensionClick(dimensionData.dimensionKey, firstEntry.value)
                }
                className="mt-3 w-full text-xs py-1.5 px-3 rounded-md transition-colors"
                style={{
                  backgroundColor: `${themeColors.textPrimary}10`,
                  color: themeColors.textPrimary,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = `${themeColors.textPrimary}20`)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = `${themeColors.textPrimary}10`)
                }
              >
                查看详情 →
              </button>
            )}
          </div>
        )
      },
    [themeColors, interactive, handleDimensionClick],
  )

  const CustomLegend = useMemo(
    () =>
      ({ payload: legendPayload }: { payload?: { value: string; color: string }[] }) => {
        if (!showLegend || !legendPayload?.length) return null

        return (
          <div
            className="flex flex-wrap justify-center gap-4 mt-4 px-4"
            role="legend"
            aria-label="图表图例"
          >
            {legendPayload.map((entry, index) => {
              const dataset = data.find((d) => d.name === entry.value)
              const isHidden = dataset ? hiddenSeries.has(dataset.id) : false

              return (
                <button
                  key={index}
                  onClick={() => handleLegendClick(entry)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                    interactive ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                  } ${isHidden ? 'opacity-40 line-through' : ''}`}
                  style={{ color: themeColors.textSecondary }}
                  aria-pressed={!isHidden}
                  aria-label={`${entry.value}${isHidden ? ' (已隐藏)' : ''}`}
                  disabled={!interactive}
                >
                  <div
                    className="w-3 h-3 rounded-full transition-transform"
                    style={{
                      backgroundColor: entry.color,
                      transform: isHidden ? 'scale(0.8)' : 'scale(1)',
                    }}
                  />
                  <span className="font-medium">{entry.value}</span>
                </button>
              )
            })}
          </div>
        )
      },
    [showLegend, data, hiddenSeries, interactive, handleLegendClick, themeColors.textSecondary],
  )

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8"
        style={{
          width: width || '100%',
          height: height || 400,
          minHeight: 300,
          backgroundColor: `${themeColors.background}50`,
          borderColor: themeColors.grid,
        }}
        role="status"
        aria-label="加载中"
      >
        <div className="relative w-16 h-16 mb-4">
          <div
            className="absolute inset-0 rounded-full border-4 animate-ping"
            style={{ borderColor: themeColors.axisText, borderTopColor: 'transparent' }}
          />
          <div
            className="absolute inset-2 rounded-full border-4 animate-spin"
            style={{
              borderColor: themeColors.axisText,
              borderTopColor: 'var(--color-secondary-500)',
              borderBottomColor: 'var(--color-secondary-500)',
            }}
          />
        </div>
        <p className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
          正在分析协同数据...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8"
        style={{
          width: width || '100%',
          height: height || 400,
          minHeight: 300,
          backgroundColor: `${themeColors.background}50`,
          borderColor: '#FF3B30',
        }}
        role="alert"
        aria-label={`错误: ${error}`}
      >
        <svg
          className="w-12 h-12 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#FF3B30"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-error, #FF3B30)' }}>
          {error || '加载失败'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary-main bg-secondary-container hover:bg-secondary-container transition-colors"
            aria-label="重试加载"
          >
            重试
          </button>
        )}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8"
        style={{
          width: width || '100%',
          height: height || 400,
          minHeight: 300,
          backgroundColor: `${themeColors.background}50`,
          borderColor: themeColors.grid,
        }}
        role="status"
        aria-label="暂无数据"
      >
        <svg
          className="w-16 h-16 mb-4 opacity-30"
          fill="none"
          viewBox="0 0 24 24"
          stroke={themeColors.emptyStateText}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="text-base font-medium mb-1" style={{ color: themeColors.emptyStateText }}>
          暂无协同分析数据
        </p>
        <p className="text-sm" style={{ color: themeColors.emptyStateText, opacity: 0.7 }}>
          请选择配方组合后查看协同效果分析
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {/* 工具栏 */}
      <div
        className="flex justify-end gap-2 mb-3 px-2"
        role="toolbar"
        aria-label="图表工具栏"
      >
        <button
          onClick={() => exportChart('png')}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${themeColors.textPrimary}08`,
            color: themeColors.textSecondary,
            border: `1px solid ${themeColors.grid}`,
          }}
          aria-label="导出为PNG图片"
          title="导出PNG (2x Retina)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {isExporting ? '导出中...' : 'PNG'}
        </button>

        <button
          onClick={() => exportChart('svg')}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${themeColors.textPrimary}08`,
            color: themeColors.textSecondary,
            border: `1px solid ${themeColors.grid}`,
          }}
          aria-label="导出为SVG矢量图"
          title="导出SVG矢量格式"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          SVG
        </button>
      </div>

      {/* 图表主体 */}
      <div ref={chartRef} className="relative" style={{ width: width || '100%', height, minHeight: 300 }} role="img" aria-label="协同效果六维雷达图">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart
            cx="50%"
            cy="50%"
            outerRadius="72%"
            data={chartData}
            onMouseEnter={() => {}}
            onMouseLeave={() => setHoveredDimension(null)}
          >
            <PolarGrid
              stroke={themeColors.grid}
              strokeDasharray="3 3"
              opacity={0.6}
            />

            <PolarAngleAxis
              dataKey="dimension"
              tick={{
                fill: themeColors.axisText,
                fontSize: window.innerWidth < 640 ? 10 : 12,
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
              tickLine={false}
            />

            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{
                fill: themeColors.axisText,
                fontSize: 10,
                opacity: 0.7,
              }}
              axisLine={false}
              tickCount={5}
              tickFormatter={(value: number) => `${value}`}
            />

            {/* eslint-disable-next-line react-hooks/static-components */}
            <Tooltip content={<CustomTooltip />} animationDuration={200} />

            {visibleData.map((dataset, index) => {
              const color = dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

              return (
                <Radar
                  key={dataset.id}
                  name={dataset.name}
                  dataKey={dataset.name}
                  stroke={color}
                  fill={color}
                  fillOpacity={visibleData.length === 1 ? 0.35 : 0.15}
                  strokeWidth={2.5}
                  dot={{
                    r: hoveredDimension ? 4 : 3,
                    fill: themeColors.background,
                    stroke: color,
                    strokeWidth: 2,
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                  activeDot={{
                    r: 6,
                    fill: color,
                    stroke: themeColors.background,
                    strokeWidth: 2,
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                  isAnimationActive={true}
                  animationDuration={500}
                  animationEasing="ease-out"
                  onMouseEnter={(e: React.MouseEvent & { payload?: ChartDataPoint }) => {
                    if (e.payload) {
                      setHoveredDimension(e.payload.dimensionKey)
                    }
                  }}
                  onClick={(e: React.MouseEvent & { payload?: ChartDataPoint }) => {
                    if (interactive && e.payload) {
                      const dim = e.payload.dimensionKey
                      const score = e.payload[dataset.name] as number
                      handleDimensionClick(dim, score)
                    }
                  }}
                  style={{ cursor: interactive ? 'pointer' : 'default' }}
                />
              )
            })}
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>

      {/* 自定义图例 */}
      {/* eslint-disable-next-line react-hooks/static-components */}
      <CustomLegend />

      {/* 维度详情面板 */}
      {selectedDimension && interactive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-panel-title"
        >
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6"
            style={{
              backgroundColor: themeColors.tooltipBg,
              border: `1px solid ${themeColors.tooltipBorder}`,
            }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={closeDetailPanel}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:bg-black/5"
              style={{ color: themeColors.textSecondary }}
              aria-label="关闭详情面板"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 标题 */}
            <h3
              id="detail-panel-title"
              className="text-xl font-bold mb-2 pr-8"
              style={{ color: themeColors.textPrimary }}
            >
              {DIMENSION_CONFIG[selectedDimension].label}
            </h3>
            <p className="text-sm mb-4" style={{ color: themeColors.textSecondary }}>
              {DIMENSION_CONFIG[selectedDimension].description}
            </p>

            {/* 评分标准 */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold mb-3" style={{ color: themeColors.textPrimary }}>
                评分标准
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DIMENSION_CONFIG[selectedDimension].scoringCriteria.map((criteria, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: `${criteria.color}15` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: criteria.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: criteria.color }}>
                        {criteria.level}
                      </p>
                      <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                        {criteria.range} 分
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 科学机制 */}
            <div className="mb-5">
              <h4 className="text-sm font-semibold mb-2" style={{ color: themeColors.textPrimary }}>
                科学机制
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: themeColors.textSecondary }}>
                {DIMENSION_CONFIG[selectedDimension].mechanism}
              </p>
            </div>

            {/* 优化建议 */}
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ color: themeColors.textPrimary }}>
                优化建议
              </h4>
              <ul className="space-y-2">
                {DIMENSION_CONFIG[selectedDimension].optimizationTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: themeColors.textSecondary }}>
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-secondary-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const SynergyRadarChart = memo(SynergyRadarChartComponent)

export default SynergyRadarChart

