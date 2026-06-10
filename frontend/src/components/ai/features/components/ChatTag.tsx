import { memo, useCallback } from 'react'
import { X } from 'lucide-react'
import { ChatIcon } from './ChatIcon'

export interface ChatTagProps {
  label: string
  icon?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'filled'
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  closable?: boolean
  onClose?: () => void
  onClick?: () => void
  className?: string
}

type TagSize = 'sm' | 'md' | 'lg'
type TagVariant = 'default' | 'outline' | 'filled'
type TagColor = 'primary' | 'success' | 'warning' | 'error' | 'info'

const SIZE_CONFIG: Record<TagSize, {
  height: string
  padding: string
  fontSize: string
  fontWeight: string
  iconSize: number
  closeSize: number
}> = {
  sm: {
    height: 'h-7',
    padding: 'px-3 py-[6px]',
    fontSize: 'text-xs',
    fontWeight: 'font-medium',
    iconSize: 14,
    closeSize: 12,
  },
  md: {
    height: 'h-8',
    padding: 'px-4 py-2',
    fontSize: 'text-[13px]',
    fontWeight: 'font-medium',
    iconSize: 16,
    closeSize: 14,
  },
  lg: {
    height: 'h-9',
    padding: 'px-5 py-[10px]',
    fontSize: 'text-sm',
    fontWeight: 'font-semibold',
    iconSize: 18,
    closeSize: 16,
  },
}

const COLOR_MAP: Record<TagColor, {
  gradient: string
  lightBg: string
  darkText: string
  border: string
  shadowColor: string
}> = {
  primary: {
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    lightBg: '#eef2ff',
    darkText: '#4c51bf',
    border: '#a5b4fc',
    shadowColor: '#667eea',
  },
  success: {
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    lightBg: '#ecfdf5',
    darkText: '#047857',
    border: '#6ee7b7',
    shadowColor: '#10b981',
  },
  warning: {
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    lightBg: '#fffbeb',
    darkText: '#b45309',
    border: '#fcd34d',
    shadowColor: '#f59e0b',
  },
  error: {
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    lightBg: '#fef2f2',
    darkText: '#b91c1c',
    border: '#fca5a5',
    shadowColor: '#ef4444',
  },
  info: {
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    lightBg: '#eff6ff',
    darkText: '#1d4ed8',
    border: '#93c5fd',
    shadowColor: '#3b82f6',
  },
}

function ChatTag({
  label,
  icon,
  size = 'md',
  variant = 'default',
  color = 'primary',
  closable = false,
  onClose,
  onClick,
  className = '',
}: ChatTagProps) {
  const sizeConfig = SIZE_CONFIG[size]
  const colorConfig = COLOR_MAP[color]

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.()
  }, [onClose])

  const handleClick = useCallback(() => {
    onClick?.()
  }, [onClick])

  const baseStyles = `
    inline-flex items-center gap-1.5 rounded-full
    ${sizeConfig.height} ${sizeConfig.padding}
    ${sizeConfig.fontSize} ${sizeConfig.fontWeight}
    transition-all duration-150 ease-out
    select-none whitespace-nowrap
    ${onClick ? 'cursor-pointer' : 'cursor-default'}
    ${className}
  `

  const hoverStyles = onClick
    ? 'hover:-translate-y-px hover:shadow-md active:scale-[0.98]'
    : ''

  const renderDefaultVariant = () => (
    <span
      className={`${baseStyles} ${hoverStyles}`}
      style={{
        background: 'white',
        color: colorConfig.darkText,
        position: 'relative',
      }}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <style>{`
        .chat-tag-gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          padding: 2px;
          background: ${colorConfig.gradient};
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>
      <span className="chat-tag-gradient-border absolute inset-0 rounded-full pointer-events-none" />
      {icon && (
        <ChatIcon name={icon as any} size={sizeConfig.iconSize} />
      )}
      <span className="relative z-10">{label}</span>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          className="
            relative z-10 ml-1 rounded-full p-0.5
            text-gray-400 hover:text-gray-600 hover:bg-gray-100/80
            transition-all duration-150 ease-out
            focus:outline-none focus:ring-2 focus:ring-gray-300
            opacity-0 group-hover:opacity-100
          "
          aria-label={`移除 ${label}`}
        >
          <X size={sizeConfig.closeSize} strokeWidth={2} />
        </button>
      )}
    </span>
  )

  const renderOutlineVariant = () => (
    <span
      className={`${baseStyles} ${hoverStyles}`}
      style={{
        background: 'transparent',
        color: colorConfig.darkText,
        border: `2px solid ${colorConfig.border}`,
      }}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {icon && (
        <ChatIcon name={icon as any} size={sizeConfig.iconSize} />
      )}
      <span>{label}</span>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          className="
            ml-1 rounded-full p-0.5
            opacity-50 hover:opacity-100 hover:bg-black/5
            transition-all duration-150 ease-out
            focus:outline-none focus:ring-2 focus:ring-current/20
          "
          aria-label={`移除 ${label}`}
          style={{ color: colorConfig.darkText }}
        >
          <X size={sizeConfig.closeSize} strokeWidth={2} />
        </button>
      )}
    </span>
  )

  const renderFilledVariant = () => (
    <span
      className={`${baseStyles} ${hoverStyles}`}
      style={{
        backgroundColor: colorConfig.lightBg,
        color: colorConfig.darkText,
      }}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {icon && (
        <ChatIcon name={icon as any} size={sizeConfig.iconSize} />
      )}
      <span>{label}</span>
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          className="
            ml-1 rounded-full p-0.5
            opacity-60 hover:opacity-100 hover:bg-black/5
            transition-all duration-150 ease-out
            focus:outline-none focus:ring-2 focus:ring-current/20
          "
          aria-label={`移除 ${label}`}
          style={{ color: colorConfig.darkText }}
        >
          <X size={sizeConfig.closeSize} strokeWidth={2} />
        </button>
      )}
    </span>
  )

  const variants: Record<TagVariant, () => React.ReactNode> = {
    default: renderDefaultVariant,
    outline: renderOutlineVariant,
    filled: renderFilledVariant,
  }

  return (
    <div className="group inline-flex">
      {variants[variant]()}
    </div>
  )
}

ChatTag.displayName = 'ChatTag'

export const ChatTagMemo = memo(ChatTag)
export default ChatTag
export type { TagSize, TagVariant, TagColor }
