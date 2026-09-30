/**
 * RMFOOD 设计系统 — 轻量 Badge / Text 包装层
 *
 * ── 变更历史（T-R1 / D-41 / D-10）──────────────────────────────────────
 * 原实现基于 `@radix-ui/themes` 的 Badge / Text 原语。但该库的样式表
 * `@radix-ui/themes/styles.css` **从未被导入**（全仓 0 引用），导致：
 *   · `.radix-themes` 根节点上 `--gray-*` / `--font-size-*` / `--radius-*` 全部为空；
 *   · Radix 原语渲染出的元素实际拿不到任何 Radix 令牌；
 *   · `RadixThemeProvider` 内联 `<style>` 手写的 `--accent-1..12` 中 `--accent-6`
 *     还是 `#0066cc`（蓝色），插在绿色阶中间（D-10）。
 * 即：这一层一直处于「引入了但没生效」的状态。
 *
 * 现改为**项目原生实现**，直接消费 §3 的语义令牌，并满足本文档约定的无障碍契约
 * （Badge 具备 role="status" 与 aria-label）。对外导出的名称与 props 完全保持不变，
 * 因此所有既有消费方（/radix-demo 页面、RadixUsageGuide、components/ui 索引）无需改动。
 *
 * 注意：命名保留 `Radix*` 前缀仅为兼容既有导入路径；实现已与 Radix 无关。
 * 后续 `components/ui/Badge.tsx`（cva 版）与本文件存在功能重叠，建议在 M3 的
 * 死代码清理中合并为单一 Badge 实现。
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════
// Badge
// ═══════════════════════════════════════════════════════════════

export interface RadixBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  dot?: boolean
  icon?: React.ReactNode
}

/** variant → 语义工具类（静态映射，禁止动态拼接类名，见规范 C-9/C-10） */
const BADGE_VARIANT_CLASS: Record<NonNullable<RadixBadgeProps['variant']>, string> = {
  default: 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  success: 'bg-success-container text-success-main border-success-main',
  warning: 'bg-warning-container text-warning-main border-warning-main',
  error: 'bg-error-container text-error-main border-error-main',
  info: 'bg-info-container text-info-main border-info-main',
}

export const RadixBadge = React.forwardRef<HTMLSpanElement, RadixBadgeProps>(
  ({ className, variant = 'default', dot = false, icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        // 无障碍契约：状态类徽章对屏幕阅读器可见（原 Radix 实现未提供，本实现补齐）
        role="status"
        aria-label={typeof children === 'string' ? children : undefined}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none',
          BADGE_VARIANT_CLASS[variant],
          className,
        )}
        {...props}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
        {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
        <span>{children}</span>
      </span>
    )
  }
)
RadixBadge.displayName = 'RadixBadge'

// ═══════════════════════════════════════════════════════════════
// Text
// ═══════════════════════════════════════════════════════════════

type RadixTextAs = 'p' | 'span' | 'div' | 'label' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export interface RadixTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: RadixTextAs
  /** 与旧 Radix 1–7 档位保持兼容；映射到项目排版令牌 */
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  weight?: 'regular' | 'medium' | 'bold'
  color?: 'gray' | 'mint' | 'orange' | 'red' | 'mauve' | 'auto'
}

/** size → 项目排版令牌（见 base.css）。用 var() 引用而非动态类名。 */
const TEXT_SIZE_VAR: Record<NonNullable<RadixTextProps['size']>, string> = {
  '1': 'var(--text-caption, 0.75rem)',   // 12px
  '2': 'var(--text-body-sm, 0.875rem)',  // 14px
  '3': 'var(--text-body, 0.9375rem)',    // 15px
  '4': 'var(--text-body-lg, 1rem)',      // 16px
  '5': 'var(--text-h5, 1.125rem)',       // 18px
  '6': 'var(--text-h4, 1.375rem)',       // 22px
  '7': 'var(--text-h3, 1.5rem)',         // 24px
}

const TEXT_WEIGHT_VAR: Record<NonNullable<RadixTextProps['weight']>, number> = {
  regular: 400,
  medium: 500,
  bold: 700,
}

/** color → 语义令牌。'auto' / 'mauve' 保持继承，交由上下文决定。 */
const TEXT_COLOR_VAR: Record<NonNullable<RadixTextProps['color']>, string | undefined> = {
  gray: 'var(--text-secondary)',
  mint: 'var(--color-success)',
  orange: 'var(--color-warning)',
  red: 'var(--color-error)',
  mauve: undefined,
  auto: undefined,
}

export const RadixText = React.forwardRef<HTMLElement, RadixTextProps>(
  (
    { className, as: Tag = 'p', size = '2', weight = 'regular', color = 'gray', style, children, ...props },
    ref,
  ) => {
    const Component = Tag as React.ElementType
    const resolvedColor = TEXT_COLOR_VAR[color]
    return (
      <Component
        ref={ref}
        className={cn(className)}
        style={{
          fontSize: TEXT_SIZE_VAR[size],
          fontWeight: TEXT_WEIGHT_VAR[weight],
          ...(resolvedColor ? { color: resolvedColor } : {}),
          ...style,
        }}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
RadixText.displayName = 'RadixText'

export { RadixBadge as Badge, RadixText as Text }
