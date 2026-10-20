/**
 * UserMenu — 顶栏右侧用户头像下拉菜单
 *
 * 方案 A：用户头像从侧边栏剥离，放入顶栏右侧。
 * 点击头像弹出下拉菜单：用户信息卡 / 账户设置 / 退出登录。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { resolveAvatarUrl } from '@/utils/avatarUrl';
import type { User } from '@/types';

const roleLabels: Record<string, string> = {
  admin: '管理员',
  ADMIN: '管理员',
  reviewer: '审核员',
  formulator: '配方师',
  researcher: '研究员',
  guest: '访客',
};

interface UserMenuProps {
  user: User | null;
  handleLogout: () => void;
}

export function UserMenu({ user, handleLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayName = String(user?.fullName || user?.username || '') || '未登录';
  const avatarSrc = resolveAvatarUrl(user?.avatarUrl);
  const role = roleLabels[String(user?.role || 'guest')] ?? String(user?.role || '访客');

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 min-h-[44px] pl-1 pr-1 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 active:scale-95 focus:outline-none focus-visible:ring-0"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="用户菜单"
        aria-expanded={open}
        aria-haspopup="menu"
        title="账户菜单"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="shrink-0 object-cover"
            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-xl)' }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-700))', borderRadius: 'var(--radius-xl)', fontSize: '13px' }}
          >
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <ChevronDown size={14} strokeWidth={2} style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[500] w-60 overflow-hidden rounded-[var(--radius-xl)] border"
          style={{
            background: 'var(--bg-surface, #ffffff)',
            borderColor: 'var(--border-color)',
            boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2))',
          }}
        >
          {/* 用户信息卡 */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="shrink-0 object-cover" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-xl)' }} />
            ) : (
              <div
                className="flex items-center justify-center text-white font-bold shrink-0"
                style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-700))', borderRadius: 'var(--radius-xl)', fontSize: '14px' }}
              >
                {displayName[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate leading-tight" style={{ fontSize: 'var(--text-body, 15px)', color: 'var(--text-primary)' }}>
                {displayName}
              </p>
              <p className="truncate" style={{ fontSize: 'var(--text-caption, 12px)', color: 'var(--text-secondary)' }}>
                {role}
              </p>
            </div>
          </div>

          {/* 菜单项 */}
          <div className="p-1.5">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)] focus:outline-none focus-visible:ring-0"
              style={{ color: 'var(--text-primary)' }}
            >
              <Settings size={16} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 'var(--text-body, 14px)', fontFamily: 'var(--font-sans)' }}>账户设置</span>
            </button>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); handleLogout(); }}
              className="w-full flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 transition-colors hover:bg-[var(--color-error-container)] focus:outline-none focus-visible:ring-0"
              style={{ color: 'var(--color-error)' }}
            >
              <LogOut size={16} strokeWidth={1.75} />
              <span style={{ fontSize: 'var(--text-body, 14px)', fontFamily: 'var(--font-sans)' }}>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}