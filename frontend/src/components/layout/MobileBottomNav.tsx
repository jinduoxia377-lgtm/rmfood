/**
 * MobileBottomNav — 移动端底部导航栏（v2 修复版）
 *
 * 修复点：
 * - "更多"面板 z-55 高于 bottom nav z-45，解决层级遮挡
 * - "更多"面板打开时遮罩覆盖全页（含底部导航），阻断主内容点击
 * - 面板关闭时添加过渡动画
 * - 移除未使用的 activePath prop（改为内部 useLocation）
 */
import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FlaskConical,
  TestTubes,
  Brain,
  MoreHorizontal,
  X,
  BarChart3,
  Bell,
  Settings,
} from 'lucide-react';
import {
  filterNavByRole,
  isActive as isNavActive,
  NAV_GROUPS,
} from '@/components/layout/navConfig';
import { useAuthStore } from '@/stores/auth';

interface BottomNavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

// 默认显示的项数（留 1 个给"更多"）
const VISIBLE_COUNT = 4;

export default function MobileBottomNav() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelRef = useRef<HTMLDivElement>(null);

  // 根据用户角色过滤底部导航项
  const filteredItems = filterNavByRole(NAV_GROUPS, user?.role as string)
    .flatMap((g) => g.items)
    .filter((item) => [
      '/dashboard', '/formulas', '/experiments', '/ai',
      '/analytics', '/notifications', '/settings',
    ].includes(item.to));

  const visibleItems: BottomNavItem[] = filteredItems.slice(0, VISIBLE_COUNT).map((i) => ({
    to: i.to,
    label: i.label,
    icon: i.icon,
    badge: i.badge,
  }));

  const moreItems: BottomNavItem[] = filteredItems.slice(VISIBLE_COUNT).map((i) => ({
    to: i.to,
    label: i.label,
    icon: i.icon,
    badge: i.badge,
  }));

  // Escape 键关闭"更多"面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && moreOpen) setMoreOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [moreOpen]);

  // 面板打开时锁定 body 滚动
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [moreOpen]);

  return (
    <>
      {/* 底部导航栏 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[150]"
        style={{
          // 高度 = header-height(56px) + safe-area
          height: 'var(--header-height, 56px)',
          background: 'var(--bg-surface, #ffffff)',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
          paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
        }}
        aria-label="移动端底部导航"
      >
        <div className="flex items-stretch h-full">
          {/* 常驻导航项 */}
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.to, location.pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* 图标容器 — 40×40, radius-xl */}
                <div
                  className="relative flex items-center justify-center transition-all duration-200"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: active ? 'var(--radius-xl, 16px)' : '0',
                    background: active ? 'var(--color-primary-container, #ecfdf5)' : 'transparent',
                  }}
                >
                  <Icon size={22} strokeWidth={active ? 2 : 1.75} />
                  {/* 激活指示点 */}
                  {active && (
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: 'var(--color-primary, #10b981)' }}
                    />
                  )}
                </div>
                {/* 标签 — text-overline 11px */}
                <span
                  className="truncate px-1"
                  style={{
                    fontSize: 'var(--text-overline, 11px)',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--color-primary, #10b981)' : 'var(--text-secondary, #64748b)',
                    lineHeight: '1.45',
                    letterSpacing: 'var(--text-overline-tracking, 0.05em)',
                  }}
                >
                  {item.label}
                </span>
                {/* 徽章 */}
                {item.badge && !active && (
                  <div
                    className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: 'var(--color-error, #ef4444)' }}
                  >
                    {item.badge}
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* 更多按钮 */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200 focus:outline-none"
            style={{ color: 'var(--text-secondary, #64748b)' }}
            aria-label="更多导航"
          >
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
              style={{ background: 'var(--bg-surface-hover, #f1f5f9)', borderRadius: 'var(--radius-xl, 16px)' }}
            >
              <MoreHorizontal size={20} strokeWidth={1.75} />
            </div>
            <span
              className="truncate px-1"
              style={{
                fontSize: 'var(--text-overline, 11px)',
                fontWeight: 500,
                lineHeight: '1.45',
              }}
            >
              更多
            </span>
          </button>
        </div>
      </nav>

      {/* "更多"面板 — z-[600]，高于所有导航层 */}
      {moreOpen && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center">
          {/* 遮罩 — 覆盖全页（含底部导航），阻止主内容点击 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          {/* 面板内容 */}
          <div
            ref={morePanelRef}
            className="relative w-full max-w-lg animate-slide-up"
            style={{
              background: 'var(--bg-surface, #ffffff)',
              borderTopLeftRadius: 'var(--radius-2xl, 24px)',
              borderTopRightRadius: 'var(--radius-2xl, 24px)',
              boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2))',
              paddingBottom: 'var(--safe-area-inset-bottom, 0px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="更多导航"
          >
            {/* 拖拽手柄 */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--border-color, #e2e8f0)' }}
              />
            </div>

            {/* 标题栏 */}
            <div
              className="flex items-center justify-between px-5 pb-3 border-b"
              style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
            >
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary, #0f172a)', fontSize: '16px' }}>
                更多功能
              </h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-xl transition-all duration-200 hover:bg-[var(--bg-surface-hover)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="关闭"
                style={{ color: 'var(--text-secondary, #64748b)', borderRadius: 'var(--radius-xl, 16px)' }}
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            {/* 菜单项 */}
            <div
              className="px-5 py-3 space-y-1 overflow-y-auto"
              style={{ maxHeight: 'calc(60vh - 80px)' }}
            >
              {moreItems.length > 0 ? moreItems.map((item) => {
                const Icon = item.icon;
                const itemActive = isNavActive(item.to, location.pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      itemActive ? 'bg-[var(--color-primary-container)]' : 'hover:bg-[var(--bg-surface-hover)]',
                    )}
                    style={{ color: itemActive ? 'var(--color-primary)' : 'var(--text-primary)' }}
                    aria-current={itemActive ? 'page' : undefined}
                  >
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-200"
                      style={{
                        borderRadius: 'var(--radius-xl, 16px)',
                        background: itemActive ? 'var(--color-primary)' : 'var(--bg-surface-elevated, #f1f5f9)',
                        color: itemActive ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <span className="flex-1 font-medium" style={{ fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className="flex items-center justify-center font-semibold min-w-[20px] h-5 px-1.5 rounded-full text-[11px] text-white"
                        style={{ background: 'var(--color-error, #ef4444)' }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {itemActive && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                    )}
                  </NavLink>
                );
              }) : (
                <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                  暂无更多功能
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
