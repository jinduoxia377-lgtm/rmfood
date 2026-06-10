import React from 'react'
import * as LucideIcons from 'lucide-react'
import { ICON_MAP, ICON_SIZES, IconName, IconSize } from './icon-mapping'

interface ChatIconProps {
  name: IconName
  size?: IconSize | number
  color?: string
  strokeWidth?: number
  ariaLabel?: string
  className?: string
  onClick?: () => void
  disabled?: boolean
}

const IconComponent = LucideIcons as Record<string, React.FC<LucideIcons.LucideProps>>

export const ChatIcon: React.FC<ChatIconProps> = ({
  name,
  size = 'md',
  color = 'currentColor',
  strokeWidth = 1.5,
  ariaLabel,
  className = '',
  onClick,
  disabled = false,
}) => {
  const iconName = ICON_MAP[name]
  const Component = IconComponent[iconName]

  if (!Component) {
    return null
  }

  const resolvedSize = typeof size === 'string' ? ICON_SIZES[size] : size
  const role = onClick ? 'button' : 'img'

  const style: React.CSSProperties = {
    color,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : undefined,
  }

  return (
    <Component
      size={resolvedSize}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      tabIndex={onClick && !disabled ? 0 : undefined}
    />
  )
}

export default ChatIcon
