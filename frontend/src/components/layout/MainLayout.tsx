/**
 * MainLayout — 主布局 v11.0 (汉堡导航统一版)
 *
 * v11.0 变更（对应"导航栏仅保留汉堡菜单"决策）：
 * - 移除桌面端 NavigationRail 图标条，恢复汉堡按钮 + 统一抽屉（全尺寸单一布局）
 * - 三端收敛为"一个汉堡入口 + 一套渐进式分组抽屉"（Apple Familiarity）
 * - 抽屉 focus trap：Tab/Shift+Tab 圈闭、Escape 回焦汉堡按钮
 * - body 滚动锁定加 padding-right 补偿，消除横向偏移
 * - inert 加 visibility fallback（旧版 Safari）
 * - 汉堡按钮联动视觉：开合时主色背景反馈
 * - z-index 体系统一：遮罩 350 / 抽屉 400 / 底部"更多"面板 450（不得高于抽屉）
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { KeepAliveOutlet } from '@/components/layout/KeepAliveOutlet';
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
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';
import { ThemeSwitcher } from '@/theme';
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

// ── 跳转链接（无障碍） ──
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:px-4 focus:py-2 focus:bg-[var(--color-primary-surface,theme(colors.primary.700))] focus:text-[var(--color-on-primary-surface,#fff)] focus:rounded-md"
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

// ── 移动端抽屉侧边栏内容 ──
interface MobileSidebarContentProps {
  setSidebarOpen: (v: boolean) => void;
  filteredGroups: typeof NAV_GROUPS;
  pathname: string;
  user: User | null;
  handleLogout: () => void;
  navigate: (to: string) => void;
}

/**
 * 渐进式分组（Apple Simplicity 原则：常见路径浮在最前，高级选项下沉一层）
 * 高频组常驻展开；低频组收入"更多功能"手风琴
 */
const PRIMARY_NAV_TITLES = new Set(['核心工作', '实验中心', '智能工具']);

function MobileSidebarContent({
  setSidebarOpen,
  filteredGroups,
  pathname,
  user,
  handleLogout,
  navigate,
}: MobileSidebarContentProps) {
  // "更多功能"手风琴展开状态（默认收起）
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryGroups = filteredGroups.filter((g) => PRIMARY_NAV_TITLES.has(g.title));
  const secondaryGroups = filteredGroups.filter((g) => !PRIMARY_NAV_TITLES.has(g.title));

  // 渲染一组导航项
  const renderGroup = (group: (typeof filteredGroups)[number]) => (
    <div key={group.title} className="mb-5">
      <p
        className="mb-2 px-1"
        style={{
          fontSize: 'var(--text-caption, 12px)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0',
          textTransform: 'none',
        }}
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
              className="group flex items-center gap-3 transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-[var(--bg-surface-hover)] active:bg-[var(--color-primary-container)]"
              style={{
                height: '48px',
                padding: '0 12px',
                color: itemActive ? 'var(--color-primary)' : 'var(--text-primary)',
                background: itemActive ? 'var(--color-primary-container)' : 'transparent',
                transitionProperty: 'background-color, color',
                transitionDuration: '120ms',
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
              <span className="flex-1 font-medium truncate" style={{ fontSize: 'var(--text-body, 15px)', fontFamily: 'var(--font-sans)' }}>
                {item.label}
              </span>
              {item.badge && (
                <span
                  className="flex items-center justify-center font-semibold shrink-0"
                  style={{ minWidth: '20px', height: '20px', fontSize: 'var(--text-overline, 11px)', background: 'var(--color-primary)', color: 'white', borderRadius: '9999px', padding: '0 6px' }}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col" style={{ width: 'var(--sidebar-width, 256px)' }}>
      {/* Logo 区 */}
      <div
        className="flex items-center gap-3 h-[64px] shrink-0 px-4"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface-container-low)' }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          // D-50 修复：原用 var(--color-primary) 作底 + text-white，
          // 而品牌主色在暗色下翻转为 #34d399（浅色）→ 白图标对比度仅 1.92:1。
          // 改用不参与反转的 surface 令牌对（亮 5.55:1 / 暗 7.78:1）。
          style={{ width: '40px', height: '40px', background: 'var(--color-primary-surface)', color: 'var(--color-on-primary-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)' }}
        >
          <Beaker size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold tracking-tight leading-none" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
            RMFOOD
          </h1>
          <p className="font-medium leading-tight mt-0.5" style={{ fontSize: 'var(--text-caption, 12px)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            配方平台
          </p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--bg-surface-hover)] active:scale-95 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={{ color: 'var(--text-secondary)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="关闭菜单"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* 导航列表 — 高频组常驻 + 低频组收纳 */}
      <nav className="flex-1 overflow-y-auto py-4" style={{ padding: '0 12px' }} aria-label="主导航">
        {primaryGroups.map(renderGroup)}

        {/* "更多功能"手风琴 — 低频组收纳（Apple：常见路径先展示，高级选项下沉一层） */}
        {secondaryGroups.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="w-full flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 hover:bg-[var(--bg-surface-hover)] active:bg-[var(--color-primary-container)] transition-all duration-200"
              style={{ height: '48px', padding: '0 12px' }}
              aria-expanded={moreOpen}
              aria-controls="nav-more-panel"
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface-elevated, #f1f5f9)',
                  color: 'var(--text-secondary)',
                }}
              >
                <MoreHorizontal size={20} strokeWidth={1.5} />
              </div>
              <span className="flex-1 text-left font-medium" style={{ fontSize: 'var(--text-body, 15px)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                更多功能
              </span>
              <motion.span
                animate={{ rotate: moreOpen ? 180 : 0 }}
                transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronDown size={16} strokeWidth={2} />
              </motion.span>
            </button>

            {/* 展开/收起：bounce:0 无超调回弹（取消抖动），仍可中途反向 */}
            <AnimatePresence initial={false}>
              {moreOpen && (
                <motion.div
                  id="nav-more-panel"
                  key="more-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ paddingTop: '4px' }}>
                    {secondaryGroups.map(renderGroup)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      {/* 用户卡片 */}
      <div
        className="shrink-0 border-t"
        style={{ borderColor: 'var(--border-color)', padding: '12px', background: 'var(--bg-surface-container-low)' }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer rounded-xl transition-all duration-200 hover:bg-[var(--bg-surface-hover)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          role="button" tabIndex={0} onClick={() => { navigate('/settings'); setSidebarOpen(false); }}
          style={{ padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)' }}
          aria-label={`${user?.fullName || user?.username || '用户'}的账户菜单`}
        >
          <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-700))', borderRadius: 'var(--radius-xl)', fontSize: '14px' }}
          >
            {String(user?.fullName || user?.username || 'U')[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate leading-tight" style={{ fontSize: 'var(--text-body, 15px)', color: 'var(--text-primary)' }}>
              {String(user?.fullName || user?.username || '') || '未登录'}
            </p>
            <p className="truncate" style={{ fontSize: 'var(--text-caption, 12px)', color: 'var(--text-secondary)' }}>
              {roleLabels[String(user?.role || 'guest')] ?? String(user?.role || '访客')}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            className="p-2 rounded-lg transition-all duration-200 shrink-0 hover:bg-[var(--color-error-container)] hover:text-[var(--color-error)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-error"
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
 * 主布局 — 汉堡导航统一版（全尺寸单一布局）
 *
 * 设计：
 * - 顶栏左上角常驻 ☰ 汉堡按钮（经典三条横杠，所有屏幕尺寸可见）
 * - 点击 → 全屏抽屉（z-400），遮罩 z-350
 * - 移动端 (<768px) 额外显示底部导航栏 + 滑动手势支持
 * - 无 NavigationRail，无页面切换动画
 */
export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useShortcutHelp();
  const { isMobile } = useBreakpoint();

  useRealtimeSync();

  // ── 抽屉状态 ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // 处理 Logout
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // 根据当前用户角色过滤导航
  const filteredGroups = filterNavByRole(NAV_GROUPS, user?.role as string);

  // 打开/关闭抽屉
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ── Escape 键关闭抽屉 + 回焦汉堡按钮 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // ── 抽屉 focus trap：Tab/Shift+Tab 圈闭在抽屉内 ──
  useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return;

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        drawerRef.current!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [drawerOpen]);

  // ── 抽屉打开时锁定 body 滚动 + 焦点管理 + 滚动条补偿 ──
  useEffect(() => {
    if (drawerOpen) {
      // 补偿滚动条宽度，避免横向偏移（布局稳定）
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      const tid = setTimeout(() => {
        const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }, 50);
      return () => {
        clearTimeout(tid);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [drawerOpen]);

  // 滑动手势（仅移动端）
  const swipeHandlers = useSwipe({
    onSwipeRight: () => { if (!drawerOpen) setDrawerOpen(true); },
    onSwipeLeft:  () => { if (drawerOpen)  setDrawerOpen(false); },
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
        {/* ── 左侧：汉堡按钮（经典三条横杠，所有尺寸常驻） ── */}
        <button
          ref={hamburgerRef}
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="flex items-center justify-center shrink-0 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={{
            color: drawerOpen ? 'var(--color-primary)' : 'var(--text-secondary)',
            background: drawerOpen ? 'var(--color-primary-container, #ecfdf5)' : 'transparent',
            width: '44px',
            height: '44px',
          }}
          aria-label={drawerOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={drawerOpen}
          aria-controls="main-drawer"
        >
          {drawerOpen ? (
            <X size={22} strokeWidth={2} />
          ) : (
            <Menu size={22} strokeWidth={2} />
          )}
        </button>

        {/* ── 右侧：工具栏（小屏 <900px 隐藏低优先级的"键盘快捷键"，避免 6 图标挤爆） ── */}
        <div className="flex items-center gap-1 overflow-hidden">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('rmfood:open-command-palette'))}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="设置"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={openHelp}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500 max-[900px]:hidden"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="键盘快捷键"
            title="键盘快捷键 (Ctrl+/)"
          >
            <Keyboard size={18} />
          </button>
        </div>
      </header>

      {/* ── 全屏抽屉遮罩（z-350） ──
           减重：0.3 无 blur — 导航是"可并行的临时面"，保留背景可读性 ── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="drawer-overlay"
            className="fixed inset-0 z-[350]"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── 全屏抽屉（z-400） ──
           弹簧 bounce:0 / duration 0.45 无超调回弹（已取消抖动），可中途反向、从当前呈现值起步
           inert + visibility fallback：旧版 Safari 无 inert 时靠 visibility 阻断 Tab ── */}
      <motion.div
        ref={drawerRef}
        {...(isMobile ? swipeHandlers : {})}
        id="main-drawer"
        className="fixed inset-y-0 left-0 z-[400]"
        style={{
          width: 'var(--sidebar-width, 256px)',
          background: 'var(--bg-surface-container, #ffffff)',
          boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2))',
          overscrollBehavior: 'contain',
          // visibility fallback：旧版 Safari 无 inert 属性，用 visibility 阻断 Tab 聚焦
          visibility: drawerOpen ? 'visible' : 'hidden',
        }}
        initial={false}
        animate={{
          x: drawerOpen ? 0 : -260,
        }}
        transition={{
          type: 'spring',
          bounce: 0,
          duration: 0.45,
        }}
        role="dialog"
        aria-modal={drawerOpen || undefined}
        aria-label="主导航菜单"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen ? true : undefined}
      >
        <MobileSidebarContent
          setSidebarOpen={setDrawerOpen}
          filteredGroups={filteredGroups}
          pathname={location.pathname}
          user={user}
          handleLogout={handleLogout}
          navigate={navigate}
        />
      </motion.div>

      {/* ── 主内容区（抽屉打开时阻断交互） ── */}
      <main
        id="main-content"
        className={cn(
          'flex-1 overflow-auto p-5',
          drawerOpen && 'pointer-events-none',
        )}
        style={{
          background: 'linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))',
          paddingBottom: isMobile ? 'calc(var(--header-height, 56px) + var(--safe-area-inset-bottom, 0px) + 16px)' : '24px',
        }}
        tabIndex={-1}
      >
        <Outlet />
        <KeepAliveOutlet />
      </main>

      {/* ── 底部导航栏（仅移动端） ── */}
      {isMobile && <MobileBottomNav />}

      <CommandPalette />
    </div>
  );
}
