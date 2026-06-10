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
            stroke="#e5e7eb"
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
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        )
      })}
      {/* 数据区域 */}
      <polygon
        points={pointsString}
        fill="#8B5CF6"
        fillOpacity={0.3}
        stroke="#8B5CF6"
        strokeWidth={2}
      />
      {/* 数据点 */}
      {data.map((d, i) => {
        const point = calculatePoint(d.value, d.angle)
        return (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="#8B5CF6"
          />
        )
      })}
      {/* 标签 */}
      {[
        { label: '协同', angle: 0 },
        { label: '口感', angle: 1 },
        { label: '稳定', angle: 2 },
        { label: '安全', angle: 3 },
        { label: '综合', angle: 4 },
      ].map((item) => {
        const angle = (item.angle * 72 - 90) * (Math.PI / 180)
        const radius = 52
        return (
          <text
            key={item.label}
            x={50 + radius * Math.cos(angle)}
            y={50 + radius * Math.sin(angle)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#6b7280"
            fontSize={8}
          >
            {item.label}
          </text>
        )
      })}
    </svg>
  )
}
