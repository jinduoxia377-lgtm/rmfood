/**
 * HeroMetricsBar — Hero 底部全宽指标浮标
 *
 * 从 Hero.tsx 拆出（v11 性能优化）：
 *   - 纯静态指标列表（4 项）
 *   - 无状态，无副作用
 */
export default function HeroMetricsBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-[var(--space-apple-sm)] mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-neutral-200, #e2e8f0)' }}>
      <span className="lp-hero-metric">
        <span aria-hidden="true" style={{ color: 'var(--color-primary-700, #047857)' }}>●</span>
        <strong>9</strong> 研发机构
      </span>
      <span className="lp-hero-metric">
        <span aria-hidden="true" style={{ color: 'var(--color-accent-700, #6d28d9)' }}>●</span>
        <strong>14.7K</strong> 实体节点
      </span>
      <span className="lp-hero-metric">
        <span aria-hidden="true" style={{ color: 'var(--color-secondary-700, #1d4ed8)' }}>●</span>
        <strong>6</strong> 大数据源
      </span>
      <span className="lp-hero-metric">
        <span aria-hidden="true" style={{ color: 'var(--color-warning-700, #b45309)' }}>●</span>
        <strong>7</strong> 种算法引擎
      </span>
    </div>
  );
}
