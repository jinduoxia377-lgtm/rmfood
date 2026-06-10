import { useChartTheme } from './DarkModeChartTheme'
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
        background: theme.tooltip.background,
        border: `1px solid ${theme.tooltip.border}`,
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {label && (
        <p
          style={{
            color: theme.tooltip.text,
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
              color: entry.color || theme.tooltip.text,
              fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
              margin: '2px 0',
            }}
          >
            <span style={{ color: theme.legend.text }}>{value[1]}: </span>
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
    backgroundColor: theme.tooltip.background,
    border: `1px solid ${theme.tooltip.border}`,
    borderRadius: '8px',
    color: theme.tooltip.text,
    fontSize: CHART_TYPOGRAPHY.tooltipContent.fontSize + 'px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }
}
