/**
 * 莱茵分子 — RhineDNAHelix
 * CSS 3D DNA 双螺旋结构可视化
 *
 * 特性:
 * - CSS 3D perspective 双螺旋
 * - 8 圈螺旋，每圈 10 个碱基对
 * - 缓慢自转 (60s 一圈)
 * - 辉光节点
 * - A-T / G-C 颜色编码碱基对
 * - 密码强度反应 (完整性 0-100%)
 */
import { type FC } from 'react'

/* ── 碱基对颜色 ── */
const BASE_PAIRS = [
  { top: '#00c9a7', bottom: '#4dabf7' },  // A-T: 绿-蓝
  { top: '#f0a500', bottom: '#e91e8a' },  // G-C: 金-品红
  { top: '#00c9a7', bottom: '#4dabf7' },
  { top: '#f0a500', bottom: '#e91e8a' },
  { top: '#4dabf7', bottom: '#00c9a7' },  // T-A: 蓝-绿
  { top: '#00c9a7', bottom: '#4dabf7' },
  { top: '#f0a500', bottom: '#e91e8a' },
  { top: '#00c9a7', bottom: '#4dabf7' },
]

interface Props {
  strength?: number // 0-4, 密码强度影响螺旋完整性
}

/* ── 生成螺旋节点 ── */
function generateHelixNodes(turns: number, nodesPerTurn: number, strength: number) {
  const nodes: {
    x1: number; y1: number; x2: number; y2: number
    topColor: string; bottomColor: string
    opacity: number; delay: number
  }[] = []

  const totalNodes = turns * nodesPerTurn
  const strengthRatio = (strength + 1) / 5

  for (let i = 0; i < totalNodes; i++) {
    const angle = (i / nodesPerTurn) * Math.PI * 2
    const y = (i / totalNodes) * 100
    const radius = 30
    const x1 = Math.cos(angle) * radius + 50
    const x2 = Math.cos(angle + Math.PI) * radius + 50
    const pair = BASE_PAIRS[i % BASE_PAIRS.length]
    const active = i / totalNodes < strengthRatio + 0.2
    nodes.push({
      x1, y1: y, x2, y2: y,
      topColor: pair.top,
      bottomColor: pair.bottom,
      opacity: active ? 0.9 : 0.15,
      delay: (i / totalNodes) * 1.2,
    })
  }
  return nodes
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
const RhineDNAHelix: FC<Props> = ({ strength = 0 }) => {
  const nodes = generateHelixNodes(8, 10, strength)

  return (
    <div className="rhine-dna-container" aria-hidden="true">
      <div className="rhine-dna-scene">
        {nodes.map((n, i) => (
          <div
            key={i}
            className="rhine-dna-pair"
            style={{
              top: `${n.y1}%`,
              opacity: n.opacity,
              animationDelay: `${n.delay}s`,
            }}
          >
            {/* 左链节点 */}
            <div
              className="rhine-dna-node"
              style={{
                left: `${n.x1}%`,
                backgroundColor: n.topColor,
                boxShadow: `0 0 8px ${n.topColor}, 0 0 16px ${n.topColor}40`,
              }}
            />
            {/* 右链节点 */}
            <div
              className="rhine-dna-node"
              style={{
                left: `${n.x2}%`,
                backgroundColor: n.bottomColor,
                boxShadow: `0 0 8px ${n.bottomColor}, 0 0 16px ${n.bottomColor}40`,
              }}
            />
            {/* 碱基对横档 */}
            <div
              className="rhine-dna-rung"
              style={{
                left: `${Math.min(n.x1, n.x2)}%`,
                width: `${Math.abs(n.x2 - n.x1)}%`,
                background: `linear-gradient(90deg, ${n.topColor}40, ${n.bottomColor}40)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default RhineDNAHelix
