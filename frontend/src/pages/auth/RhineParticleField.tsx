/**
 * 莱茵分子 — RhineParticleField
 * 交互式 Canvas 分子粒子场
 *
 * 特性:
 * - 150 粒子 (桌面) / 80 (平板) / 40 (手机)
 * - 鼠标引力/斥力交互
 * - 粒子间连接线 (距离 < 80px)
 * - 生物技术色彩：翠绿 + 辉光蓝 + 白色
 * - requestAnimationFrame 60fps 渲染
 * - 移动端性能降级
 */
import { useRef, useEffect, useCallback, type FC } from 'react'

/* ── 类型 ── */
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
  baseX: number
  baseY: number
}

interface Props {
  error?: boolean
}

/* ── 常量 ── */
const COLORS = ['#00c9a7', '#00c9a7', '#00c9a7', '#00c9a7', '#4dabf7', '#4dabf7', '#4dabf7', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.6)']
const ERROR_COLORS = ['#e91e8a', '#e91e8a', '#e91e8a', '#f0a500', '#f0a500', '#4dabf7', 'rgba(255,255,255,0.4)']
const MOUSE_RADIUS = 150
const CONNECT_DIST = 80
const PARTICLE_DESKTOP = 150
const PARTICLE_TABLET = 80
const PARTICLE_MOBILE = 40

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
const RhineParticleField: FC<Props> = ({ error = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const animRef = useRef<number>(0)
  const errorRef = useRef(false)

  /* ── 粒子工厂 ── */
  const createParticle = useCallback((w: number, h: number, colors: string[]): Particle => {
    const x = Math.random() * w
    const y = Math.random() * h
    return {
      x, y,
      baseX: x,
      baseY: y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2.5 + 1,
      opacity: Math.random() * 0.5 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }
  }, [])

  /* ── 初始化粒子 ── */
  const initParticles = useCallback((canvas: HTMLCanvasElement) => {
    const w = canvas.width
    const h = canvas.height
    const count = w < 640 ? PARTICLE_MOBILE : w < 1024 ? PARTICLE_TABLET : PARTICLE_DESKTOP
    const colors = errorRef.current ? ERROR_COLORS : COLORS
    const arr: Particle[] = []
    for (let i = 0; i < count; i++) {
      arr.push(createParticle(w, h, colors))
    }
    particlesRef.current = arr
  }, [createParticle])

  /* ── 动画循环 ── */
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const particles = particlesRef.current

    ctx.clearRect(0, 0, w, h)

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      /* ── 鼠标交互 ── */
      const dx = mx - p.x
      const dy = my - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS
        const fx = (dx / dist) * force * 0.8
        const fy = (dy / dist) * force * 0.8
        p.vx -= fx
        p.vy -= fy
      }

      /* ── 回到原位 ── */
      p.vx += (p.baseX - p.x) * 0.002
      p.vy += (p.baseY - p.y) * 0.002

      /* ── 阻尼 ── */
      p.vx *= 0.98
      p.vy *= 0.98

      /* ── 移动 ── */
      p.x += p.vx
      p.y += p.vy

      /* ── 边界 ── */
      if (p.x < 0) { p.x = 0; p.vx *= -1 }
      if (p.x > w) { p.x = w; p.vx *= -1 }
      if (p.y < 0) { p.y = 0; p.vy *= -1 }
      if (p.y > h) { p.y = h; p.vy *= -1 }

      /* ── 绘制连接线 ── */
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j]
        const ddx = p.x - q.x
        const ddy = p.y - q.y
        const d = Math.sqrt(ddx * ddx + ddy * ddy)
        if (d < CONNECT_DIST) {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.strokeStyle = `rgba(0, 201, 167, ${0.08 * (1 - d / CONNECT_DIST)})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }

    /* ── 绘制粒子 ── */
    for (const p of particles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.opacity
      ctx.fill()

      /* 辉光 */
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.opacity * 0.12
      ctx.fill()
    }
    ctx.globalAlpha = 1

    animRef.current = requestAnimationFrame(animate)
  }, [])

  /* ── 生命周期 ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles(canvas)
    }
    resize()
    window.addEventListener('resize', resize)

    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [animate, initParticles])

  /* ── 错误状态响应 ── */
  useEffect(() => {
    errorRef.current = error
    if (error && canvasRef.current) {
      const colors = ERROR_COLORS
      particlesRef.current.forEach(p => {
        p.color = colors[Math.floor(Math.random() * colors.length)]!
      })
    }
  }, [error])

  /* ── 鼠标事件 ── */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 }
  }, [])
  const handleClick = useCallback(() => {
    /* 点击时粒子爆发 */
    const particles = particlesRef.current
    for (const p of particles) {
      p.vx += (Math.random() - 0.5) * 3
      p.vy += (Math.random() - 0.5) * 3
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="rhine-particle-canvas"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      aria-hidden="true"
      role="presentation"
    />
  )
}

export default RhineParticleField
