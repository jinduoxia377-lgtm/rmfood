interface RadarMiniChartProps {
  synergy: number
  taste: number
  stability: number
  safety: number
  overall: number
}

export function RadarMiniChart({ synergy, taste, stability, safety, overall }: RadarMiniChartProps) {
  const data = [
    { value: synergy, angle: 0 },
    { value: taste, angle: 1 },
    { value: stability, angle: 2 },
    { value: safety, angle: 3 },
    { value: overall, angle: 4 },
  ]

  const calculatePoint = (value: number, angleIndex: number) => {
    const angle = (angleIndex * 72 - 90) * (Math.PI / 180)
    const radius = value * 40
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    }
  }

  const pointsString = data.map(d => {
    const point = calculatePoint(d.value, d.angle)
    return `${point.x},${point.y}`
  }).join(' ')

  // P0 修复：标签半径从 52 调整到 48，确保不超出 100×100 viewBox
  const labelRadius = 48

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* 背景网格 */}
      {[1, 0.75, 0.5, 0.25].map((r, i) => {
        const gridPoints = [0, 1, 2, 3, 4].map(idx => {
          const angle = (idx * 72 - 90) * (Math.PI / 180)
          const radius = r * 40
          return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`
        }).join(' ')
        return (
          <polygon
            key={i}
            points={gridPoints}
            fill="none"
            stroke="var(--border-subtle, rgba(0,0,0,0.06))"
            strokeWidth={1}
          />
        )
      })}
      {/* 坐标轴 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * 72 - 90) * (Math.PI / 180)
        return (
          <line
            key={i}
            x1={50}
            y1={50}
            x2={50 + 40 * Math.cos(angle)}
            y2={50 + 40 * Math.sin(angle)}
            stroke="var(--border-subtle, rgba(0,0,0,0.06))"
            strokeWidth={1}
          />
        )
      })}
      {/* 数据区域 */}
      <polygon
        points={pointsString}
        fill="var(--color-tertiary, var(--color-accent-500))"
        fillOpacity={0.3}
        stroke="var(--color-tertiary, var(--color-accent-500))"
        strokeWidth={2}
      />
      {/* 数据点 — P1 修复：显示实际数值 */}
      {data.map((d, i) => {
        const point = calculatePoint(d.value, d.angle)
        return (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={3}
              fill="var(--color-tertiary, var(--color-accent-500))"
            />
            {/* 数值标签 */}
            <text
              x={point.x}
              y={point.y - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-secondary, #6E6E73)"
              fontSize={7}
              fontWeight={600}
            >
              {Math.round(d.value * 100)}
            </text>
          </g>
        )
      })}
      {/* 维度标签 — P0 修复：半径调整防裁剪 */}
      {[
        { label: '协同', angle: 0 },
        { label: '口感', angle: 1 },
        { label: '稳定', angle: 2 },
        { label: '安全', angle: 3 },
        { label: '综合', angle: 4 },
      ].map((item) => {
        const angle = (item.angle * 72 - 90) * (Math.PI / 180)
        const radius = labelRadius
        return (
          <text
            key={item.label}
            x={50 + radius * Math.cos(angle)}
            y={50 + radius * Math.sin(angle)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-secondary, #6E6E73)"
            fontSize={8}
          >
            {item.label}
          </text>
        )
      })}
    </svg>
  )
}
