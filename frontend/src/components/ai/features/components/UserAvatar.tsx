import React, { useMemo } from 'react'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number

export interface UserAvatarProps {
  username?: string
  src?: string
  size?: AvatarSize
  bordered?: boolean
  shadowed?: boolean
  alt?: string
  className?: string
}

const SIZE_MAP: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

function getInitials(username?: string): string {
  if (!username?.trim()) return 'U'
  const trimmed = username.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return trimmed[0].toUpperCase()
}

function resolveSize(size?: AvatarSize): number {
  if (typeof size === 'number') return size
  return SIZE_MAP[size ?? 'md']
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  username,
  src,
  size = 'md',
  bordered = false,
  shadowed = false,
  alt,
  className = '',
}) => {
  const dimension = useMemo(() => resolveSize(size), [size])
  const initials = useMemo(() => getInitials(username), [username])

  const fontSize = Math.max(dimension * 0.4, 12)

  const baseStyle: React.CSSProperties = {
    width: dimension,
    height: dimension,
    borderRadius: '50%',
    background: src ? undefined : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: '#fff',
    fontSize: `${fontSize}px`,
    lineHeight: 1,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
    border: bordered ? '2px solid #fff' : undefined,
    boxShadow: bordered
      ? '0 2px 8px rgba(0,0,0,0.15)'
      : shadowed
        ? '0 4px 16px rgba(0,0,0,0.18)'
        : undefined,
  }

  const ariaLabel = alt || (username ? `${username}的头像` : '用户头像')

  if (src) {
    return (
      <img
        src={src}
        alt={ariaLabel}
        style={baseStyle}
        className={className}
        role="img"
        aria-label={ariaLabel}
      />
    )
  }

  return (
    <div
      style={baseStyle}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {initials}
    </div>
  )
}

export default UserAvatar
