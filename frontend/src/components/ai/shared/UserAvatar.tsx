/**
 * UserAvatar — 全局用户头像组件
 *
 * 实时同步「用户账户」中的头像（useAuthStore + resolveAvatarUrl），
 * 未设置时回退到用户名首字母 + 深色渐变。
 * 供 /agent 各对话框（专家聊天 / 研发助手 / 群聊协作）统一复用。
 */
import { useAuthStore } from '@/stores/auth';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

export interface UserAvatarProps {
  size?: 'sm' | 'md';
}

export function UserAvatar({ size = 'sm' }: UserAvatarProps) {
  const user = useAuthStore((s) => s.user);
  const avatarUrl = resolveAvatarUrl(user?.avatarUrl);
  const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="用户头像"
        data-testid="user-real-avatar"
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover ring-1 ring-border`}
      />
    );
  }

  const initial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();
  return (
    <span
      className={`${sizeClass} flex flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 via-[#10b981] to-emerald-400 text-sm font-semibold text-white`}
      role="img"
      aria-label="用户头像"
    >
      {initial}
    </span>
  );
}