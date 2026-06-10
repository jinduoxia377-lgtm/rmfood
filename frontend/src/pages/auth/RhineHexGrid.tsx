/**
 * 莱茵分子 — RhineHexGrid
 * SVG 六边形晶格叠加层
 *
 * 特性:
 * - 重复六边形图案 (分子晶格结构)
 * - 极低透明度 (不干扰主视觉)
 * - CSS 动画渐变透明度
 * - 科学网格美学
 */
import { type FC } from 'react'

const RhineHexGrid: FC = () => (
  <div className="rhine-hex-grid" aria-hidden="true" role="presentation">
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      className="rhine-hex-svg"
    >
      <defs>
        <pattern
          id="rhine-hex-pattern"
          x="0"
          y="0"
          width="60"
          height="104"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(1.5)"
        >
          {/* 六边形 1 */}
          <polygon
            points="30,0 60,17 60,52 30,69 0,52 0,17"
            fill="none"
            stroke="rgba(0, 201, 167, 0.08)"
            strokeWidth="0.5"
          />
          {/* 六边形 2 (偏移) */}
          <polygon
            points="30,104 60,87 60,52 30,35 0,52 0,87"
            fill="none"
            stroke="rgba(77, 171, 247, 0.05)"
            strokeWidth="0.5"
          />
          {/* 六边形中心点 */}
          <circle
            cx="30"
            cy="34.5"
            r="1"
            fill="rgba(0, 201, 167, 0.15)"
          />
          <circle
            cx="0"
            cy="69"
            r="0.8"
            fill="rgba(77, 171, 247, 0.1)"
          />
          <circle
            cx="60"
            cy="69"
            r="0.8"
            fill="rgba(77, 171, 247, 0.1)"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rhine-hex-pattern)" />
    </svg>
  </div>
)

export default RhineHexGrid
