import { useChartTheme } from '@/utils/chartTheme'
import { CHART_TYPOGRAPHY } from '../../utils/typography'

interface ChartTooltipProps {
  active?: boolean
  payload?: {
    value: number | string
    name: string
    color: string
  }[]
  label?: string
  formatter?: (value: number | string, name: string) => [string, string]
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  const theme = useChartTheme()

  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      style={{
        background: theme.tooltip.contentStyle.backgroundColor,
        border: `1px solid ${theme.tooltip.contentStyle.border}`,
        borderRadius: '14px',
        padding: '14px 18px',
        boxShadow: theme.tooltip.contentStyle.boxShadow,
      }}
    >
      {label && (
        <p
          style={{
            color: theme.tooltip.labelStyle.color,
            fontWeight: CHART_TYPOGRAPHY.tooltipTitle.fontWeight,
            fontSize: CHART_TYPOGRAPHY.tooltipTitle.fontSize + 'px',
            marginBottom: '6px',
          }}
        >
          {label}
        </p>
      )}
      {payload.map((entry, index) => {
        const value = formatter ? formatter(entry.value, entry.name) : [String(entry.value), entry.name || '']
        return (
          <p
            key={index}
            style={{
              color: entry.color || theme.colors.text,
              fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
              margin: '2px 0',
            }}
          >
            <span style={{ color: theme.colors.textSecondary }}>{value[1]}: </span>
            <span style={{ fontWeight: CHART_TYPOGRAPHY.dataLabel.fontWeight }}>{value[0]}</span>
          </p>
        )
      })}
    </div>
  )
}

export function useChartTooltipStyle() {
  const theme = useChartTheme()
  return {
    backgroundColor: theme.tooltip.contentStyle.backgroundColor,
    border: `1px solid ${theme.tooltip.contentStyle.border}`,
    borderRadius: '14px',
    color: theme.tooltip.contentStyle.color,
    fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
    boxShadow: theme.tooltip.contentStyle.boxShadow,
  }
}
