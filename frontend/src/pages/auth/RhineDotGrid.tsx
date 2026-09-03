/**
 * 莱茵分子 — RhineDotGrid
 * 半透明点状网格背景层
 *
 * 特性:
 * - SVG pattern 点阵（蜂窝点 + 正交点混合）
 * - 极低透明度，不干扰主视觉
 * - 亮色/暗色双模式适配
 * - 缓慢呼吸动画
 * - 科学网格美学（分子点阵、电路板感）
 */
import { type FC } from 'react'

const RhineDotGrid: FC = () => (
  <div
    className="rhine-dot-grid"
    aria-hidden="true"
    role="presentation"
  >
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* 小圆点图案 — 基础网格 */}
        <pattern
          id="rhine-dot-small"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="12"
            cy="12"
            r="1"
            className="rhine-dot-fg"
          />
        </pattern>

        {/* 中等圆点图案 — 主网格 */}
        <pattern
          id="rhine-dot-medium"
          x="0"
          y="0"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="24"
            cy="24"
            r="1.5"
            className="rhine-dot-fg"
          />
          {/* 四角小点装饰 */}
          <circle cx="0" cy="0" r="0.6" className="rhine-dot-sub" />
          <circle cx="48" cy="0" r="0.6" className="rhine-dot-sub" />
          <circle cx="0" cy="48" r="0.6" className="rhine-dot-sub" />
          <circle cx="48" cy="48" r="0.6" className="rhine-dot-sub" />
        </pattern>

        {/* 大号圆点图案 — 稀疏点缀 */}
        <pattern
          id="rhine-dot-large"
          x="0"
          y="0"
          width="96"
          height="96"
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx="48"
            cy="48"
            r="2"
            className="rhine-dot-accent"
          />
        </pattern>
      </defs>

      {/* 三层叠加：小点 + 中点 + 大点 */}
      <rect width="100%" height="100%" fill="url(#rhine-dot-small)" />
      <rect width="100%" height="100%" fill="url(#rhine-dot-medium)" />
      <rect width="100%" height="100%" fill="url(#rhine-dot-large)" />
    </svg>
  </div>
)

export default RhineDotGrid
