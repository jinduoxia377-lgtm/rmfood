import React, { useMemo } from 'react'
import { Bot, Sparkles } from 'lucide-react'
import type { AvatarSize } from './UserAvatar'

export type AIStatus = 'online' | 'thinking' | 'offline'

export interface AIAvatarProps {
  status?: AIStatus
  size?: AvatarSize
  showStatus?: boolean
  className?: string
}

const SIZE_MAP: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

function resolveSize(size?: AvatarSize): number {
  if (typeof size === 'number') return size
  return SIZE_MAP[size ?? 'md']
}

const STATUS_COLORS: Record<AIStatus, string> = {
  online: '#22c55e',
  thinking: '#f59e0b',
  offline: '#9ca3af',
}

const STATUS_STYLES: Record<AIStatus, React.CSSProperties> = {
  online: {
    backgroundColor: STATUS_COLORS.online,
    animation: 'thinkingPulse 1.5s ease-in-out infinite',
  },
  thinking: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)',
    animation: 'statusSpin 1s linear infinite',
  },
  offline: {
    backgroundColor: STATUS_COLORS.offline,
  },
}

export const AIAvatar: React.FC<AIAvatarProps> = ({
  status = 'online',
  size = 'md',
  showStatus = true,
  className = '',
}) => {
  const dimension = useMemo(() => resolveSize(size), [size])
  const iconSize = Math.max(dimension * 0.5, 12)
  const statusDotSize = Math.max(dimension * 0.25, 8)

  const avatarStyle: React.CSSProperties = {
    width: dimension,
    height: dimension,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  }

  const statusStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: statusDotSize,
    height: statusDotSize,
    borderRadius: '50%',
    border: '2px solid #fff',
    zIndex: 2,
    ...STATUS_STYLES[status],
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} className={className}>
      <div style={avatarStyle} role="img" aria-label={`AI头像 - ${status === 'online' ? '在线' : status === 'thinking' ? '思考中' : '离线'}`}>
        {dimension >= 32 ? (
          <Sparkles size={iconSize} strokeWidth={2} />
        ) : (
          <Bot size={iconSize} strokeWidth={2} />
        )}
      </div>
      {showStatus && (
        <div style={statusStyle} aria-label={status} role="status" />
      )}
      <style>{`
        @keyframes thinkingPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes statusSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default AIAvatar
