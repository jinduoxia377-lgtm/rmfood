import React from 'react'
import * as LucideIcons from 'lucide-react'

// 定义图标名称类型
export type IconName = keyof typeof LucideIcons

export type IconVariant = 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | 'info' | 'text' | 'muted'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  color?: string
  variant?: IconVariant
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  className = '',
  color,
  variant,
}) => {
  const LucideIcon = (LucideIcons as any)[name]

  if (!LucideIcon || typeof LucideIcon !== 'function') {
    return null
  }

  let iconColor: string | undefined = color

  if (!color && variant) {
    switch (variant) {
      case 'primary':
        iconColor = 'var(--color-primary)'
        break
      case 'secondary':
        iconColor = 'var(--color-secondary)'
        break
      case 'tertiary':
        iconColor = 'var(--color-tertiary)'
        break
      case 'success':
        iconColor = 'var(--color-success)'
        break
      case 'warning':
        iconColor = 'var(--color-warning)'
        break
      case 'error':
        iconColor = 'var(--color-error)'
        break
      case 'info':
        iconColor = 'var(--color-info)'
        break
      case 'text':
        iconColor = 'var(--text-primary)'
        break
      case 'muted':
        iconColor = 'var(--text-secondary)'
        break
      default:
        iconColor = 'var(--text-primary)'
    }
  }

  return (
    <LucideIcon
      size={size}
      className={className}
      style={iconColor ? { color: iconColor } : undefined}
      aria-hidden="true"
    />
  )
}

// 导出所有 Lucide 图标，保持向后兼容
export * from 'lucide-react'
