/**
 * RMFOOD 设计系统 — 主布局 v8.0 (汉堡导航统一版)
 *
 * v8.0 修复清单：
 * - 汉堡按钮 ☰ 所有屏幕尺寸常驻可见（不再仅在 isMobile 分支）
 * - 移除三端分支（if isMobile/isTablet return），统一为单一布局
 * - 移除桌面端固定侧边栏，点击汉堡打开全屏抽屉（z-400）
 * - 移动端 (<768px) 额外显示底部导航栏 + 滑动手势支持
 * - 清理未使用的 lucide-react 导入
 * - 所有尺寸共享同一套 MobileSidebarContent 抽屉内容
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  FlaskConical,
  Settings,
  LogOut,
  Menu,
  X,
  Beaker,
  Search,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';
import { ThemeSwitcher } from '@/theme';
import { NotificationBell } from '@/components/ui';
import CommandPalette from '@/components/ui/CommandPalette';
import { useShortcutHelp } from '@/hooks/useKeyboardShortcuts.tsx';
import { useBreakpoint, useSwipe } from '@/hooks/useMobile';
import { NotificationCenter } from '@/components/notification/NotificationCenter';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import {
  NAV_GROUPS,
  filterNavByRole,
  isActive as isNavActive,
} from '@/components/layout/navConfig';

// ── 页面过渡动画 ──
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-page-enter">
      {children}
    </div>
  );
}

// ── 跳转链接（无障碍） ──
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md"
    >
      跳转到主要内容
    </a>
  );
}

// ── 角色显示映射 ──
const roleLabels: Record<string, string> = {
  admin: '管理员',
  ADMIN: '管理员',
  reviewer: '审核员',
  formulator: '配方师',
  researcher: '研究员',
  guest: '访客',
};

// ── 移动端抽屉侧边栏内容（共享过滤逻辑） ──
interface MobileSidebarContentProps {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  filteredGroups: typeof NAV_GROUPS;
  pathname: string;
  user: User | null;
  handleLogout: () => void;
  navigate: (to: string) => void;
}

function MobileSidebarContent({
  sidebarOpen,
  setSidebarOpen,
  filteredGroups,
  pathname,
  user,
  handleLogout,
  navigate,
}: MobileSidebarContentProps) {
  return (
    <div className="flex h-full flex-col" style={{ width: 'var(--sidebar-width, 256px)' }}>
      {/* Logo 区 */}
      <div
        className="flex items-center gap-3 h-[64px] shrink-0 px-4"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface-container-low)' }}
      >
        <div
          className="flex items-center justify-center text-white shrink-0"
          style={{ width: '40px', height: '40px', background: 'var(--color-primary)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)' }}
        >
          <Beaker size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold tracking-tight leading-none" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
            RMFOOD
          </h1>
          <p className="font-medium leading-tight mt-0.5" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            配方平台
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--bg-surface-hover)] shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={{ color: 'var(--text-secondary)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="关闭菜单"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 overflow-y-auto py-4" style={{ padding: '0 12px' }} aria-label="主导航">
        {filteredGroups.map((group) => (
          <div key={group.title} className="mb-5">
            <p
              className="uppercase tracking-wider mb-2 px-1"
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em' }}
            >
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const itemActive = isNavActive(item.to, pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-[var(--bg-surface-hover)]"
                    style={{
                      height: '48px',
                      padding: '0 12px',
                      color: itemActive ? 'var(--color-primary)' : 'var(--text-primary)',
                      background: itemActive ? 'var(--color-primary-container)' : 'transparent',
                    }}
                    aria-current={itemActive ? 'page' : undefined}
                  >
                    <div
                      className="flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-lg)',
                        background: itemActive ? 'var(--color-primary)' : 'transparent',
                        color: itemActive ? 'white' : 'var(--text-secondary)',
                      }}
                    >
                      <Icon size={20} strokeWidth={itemActive ? 2 : 1.5} />
                    </div>
                    <span className="flex-1 font-medium truncate" style={{ fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className="flex items-center justify-center font-semibold shrink-0"
                        style={{ minWidth: '20px', height: '20px', fontSize: '11px', background: 'var(--color-primary)', color: 'white', borderRadius: '9999px', padding: '0 6px' }}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 用户卡片 */}
      <div
        className="shrink-0 border-t"
        style={{ borderColor: 'var(--border-color)', padding: '12px', background: 'var(--bg-surface-container-low)' }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer rounded-xl transition-all duration-200 hover:bg-[var(--bg-surface-hover)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          onClick={() => { navigate('/settings'); setSidebarOpen(false); }}
          style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)' }}
          aria-label={`${user?.fullName || user?.username || '用户'}的账户菜单`}
        >
          <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-700))', borderRadius: 'var(--radius-xl)', fontSize: '11px' }}
          >
            {String(user?.fullName || user?.username || 'U')[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate leading-tight" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {String(user?.fullName || user?.username || '') || '未登录'}
            </p>
            <p className="truncate" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {roleLabels[String(user?.role || 'guest')] ?? String(user?.role || '访客')}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            className="p-2 rounded-lg transition-all duration-200 shrink-0 hover:bg-[var(--color-error-container)] hover:text-[var(--color-error)] focus:outline-none focus:ring-2 focus:ring-error"
            style={{ color: 'var(--text-secondary)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 主布局 — 汉堡导航统一版
 *
 * 设计：
 * - 顶栏左上角常驻 ☰ 汉堡按钮（所有屏幕尺寸均可见）
 * - 点击 → 全屏抽屉（z-400），遮罩 z-350
 * - 移动端 (<768px) 额外显示底部导航栏
 * - 桌面/平板：抽屉打开时主内容 pointer-events-none，遮挡底层侧边栏
 */
export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useShortcutHelp();
  const { isMobile } = useBreakpoint();

  useRealtimeSync();

  // ── 抽屉状态 ──
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

  // 处理 Logout
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // 根据当前用户角色过滤导航
  const filteredGroups = filterNavByRole(NAV_GROUPS, user?.role as string);

  // 当前页面名称（面包屑用）
  const currentPage = NAV_GROUPS.flatMap((g) => g.items).find((item) =>
    isNavActive(item.to, location.pathname),
  );
  const pageName = currentPage?.label ?? '';

  // ── Escape 键关闭抽屉 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileDrawerOpen) setMobileDrawerOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileDrawerOpen]);

  // ── 抽屉打开时锁定 body 滚动 + 焦点管理 ──
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
      const tid = setTimeout(() => {
        const firstFocusable = mobileDrawerRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }, 50);
      return () => clearTimeout(tid);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileDrawerOpen]);

  // 滑动手势（仅移动端）
  const swipeHandlers = useSwipe({
    onSwipeRight: () => { if (!mobileDrawerOpen) setMobileDrawerOpen(true); },
    onSwipeLeft:  () => { if (mobileDrawerOpen)  setMobileDrawerOpen(false); },
    threshold: 80,
  });

  // ═══════════════════════════════════════════════════════════
  // 统一布局 — 汉堡按钮所有尺寸常驻可见
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-gradient-start, #f8fafc)' }}>
      <SkipLink />

      {/* ── 顶栏（所有尺寸） ── */}
      <header
        className="sticky top-0 z-[100] flex items-center justify-between"
        style={{
          height: 'var(--header-height, 56px)',
          paddingLeft: 'var(--space-3, 12px)',
          paddingRight: 'var(--space-3, 12px)',
          background: 'var(--header-bg, rgba(255,255,255,0.92))',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
          paddingTop: 'var(--safe-area-inset-top, 0px)',
        }}
        aria-label="顶部导航栏"
      >
        {/* ── 左侧：汉堡按钮（始终可见） ── */}
        <button
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          className="flex items-center justify-center shrink-0 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={{
            color: mobileDrawerOpen ? 'var(--color-primary)' : 'var(--text-secondary)',
            width: '44px',
            height: '44px',
          }}
          aria-label={mobileDrawerOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={mobileDrawerOpen}
          aria-controls="main-drawer"
        >
          {mobileDrawerOpen ? (
            <X size={22} strokeWidth={2} />
          ) : (
            <Menu size={22} strokeWidth={2} />
          )}
        </button>

        {/* ── 右侧：工具栏 ── */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="搜索"
          >
            <Search size={18} />
          </button>
          <NotificationCenter />
          <ThemeSwitcher variant="icon-only" size="sm" showLabel={false} />
          <button
            onClick={() => navigate('/formulas/new')}
            className="p-2 rounded-lg text-white transition-all duration-200 active:scale-95 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="新建配方"
          >
            <FlaskConical size={18} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="设置"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={openHelp}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="键盘快捷键"
            title="键盘快捷键 (Ctrl+/)"
          >
            <Keyboard size={18} />
          </button>
        </div>
      </header>

      {/* ── 全屏抽屉遮罩（z-350） ── */}
      <div
        className={cn(
          'fixed inset-0 z-[350] transition-opacity duration-300',
          mobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        style={{ background: 'var(--overlay-bg, rgba(0,0,0,0.5))', backdropFilter: 'blur(4px)' }}
        onClick={() => setMobileDrawerOpen(false)}
        aria-hidden={!mobileDrawerOpen}
      />

      {/* ── 全屏抽屉（z-400） ── */}
      <div
        ref={mobileDrawerRef}
        {...(isMobile ? swipeHandlers : {})}
        id="main-drawer"
        className={cn(
          'fixed inset-y-0 left-0 z-[400] transition-transform duration-300 ease-in-out',
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          width: 'var(--sidebar-width, 256px)',
          background: 'var(--bg-surface-container, #ffffff)',
          boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2))',
          overscrollBehavior: 'contain',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="主导航菜单"
        aria-hidden={!mobileDrawerOpen}
      >
        <MobileSidebarContent
          sidebarOpen={mobileDrawerOpen}
          setSidebarOpen={setMobileDrawerOpen}
          filteredGroups={filteredGroups}
          pathname={location.pathname}
          user={user}
          handleLogout={handleLogout}
          navigate={navigate}
        />
      </div>

      {/* ── 主内容区（drawer 打开时 pointer-events-none） ── */}
      <main
        id="main-content"
        className={cn(
          'flex-1 overflow-auto p-5',
          mobileDrawerOpen && 'pointer-events-none',
        )}
        style={{
          background: 'linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))',
          paddingBottom: isMobile ? 'calc(var(--header-height, 56px) + var(--safe-area-inset-bottom, 0px) + 16px)' : '24px',
        }}
        tabIndex={-1}
      >
        <PageTransition><Outlet /></PageTransition>
      </main>

      {/* ── 底部导航栏（仅移动端） ── */}
      {isMobile && <MobileBottomNav />}

      <CommandPalette />
    </div>
  );
}
