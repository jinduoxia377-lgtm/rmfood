/**
 * MainLayout — 主布局 v12.0 (桌面可折叠侧边栏 + 移动端汉堡抽屉)
 *
 * v12.0 变更（导航栏改造）：
 * - 桌面端（≥1024px）新增常驻可折叠侧边栏：展开=图标+名称，折叠=仅图标（默认折叠，localStorage 持久化）
 * - Logo 从侧边栏剥离，移入顶栏最左（品牌优先），☰ 紧邻右侧
 * - 用户头像从侧边栏底部移入顶栏右侧菜单（UserMenu：账户设置/退出登录）
 * - 移动端（<1024px）保留全屏抽屉（移除 Logo 区与用户卡片，仅紧凑头部 + 导航）
 * - 保留：抽屉 focus trap、Escape 回焦、body 滚动锁定、bounce:0 无回弹
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeepAliveOutlet } from '@/components/layout/KeepAliveOutlet';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  FlaskConical,
  Settings,
  Menu,
  X,
  Beaker,
  Keyboard,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { ThemeSwitcher } from '@/theme';
import CommandPalette from '@/components/ui/CommandPalette';
import { useShortcutHelp } from '@/hooks/useKeyboardShortcuts.tsx';
import { useBreakpoint, useSwipe } from '@/hooks/useMobile';
import { envConfig } from '@/config/env';
import { NotificationCenter } from '@/components/notification/NotificationCenter';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { UserMenu } from '@/components/layout/UserMenu';
import {
  NAV_GROUPS,
  filterNavByRole,
  isActive as isNavActive,
} from '@/components/layout/navConfig';

// ── 跳转链接（无障碍） ──
function SkipLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#main-content"
      className="rhine-skip-link"
    >
      {t('nav.skipToContent')}
    </a>
  );
}

// ── 移动端抽屉侧边栏内容 ──
interface MobileSidebarContentProps {
  setSidebarOpen: (v: boolean) => void;
  filteredGroups: typeof NAV_GROUPS;
  pathname: string;
}

/**
 * 渐进式分组（Apple Simplicity 原则：常见路径浮在最前，高级选项下沉一层）
 * 高频组常驻展开；低频组收入"更多功能"手风琴
 */
const PRIMARY_NAV_GROUP_KEYS = new Set(['core', 'lab', 'intelligence']);

function MobileSidebarContent({
  setSidebarOpen,
  filteredGroups,
  pathname,
}: MobileSidebarContentProps) {
  const { t } = useTranslation();
  // "更多功能"手风琴展开状态（默认收起）
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryGroups = filteredGroups.filter((g) => PRIMARY_NAV_GROUP_KEYS.has(g.key));
  const secondaryGroups = filteredGroups.filter((g) => !PRIMARY_NAV_GROUP_KEYS.has(g.key));

  // 渲染一组导航项
  const renderGroup = (group: (typeof filteredGroups)[number]) => (
    <div key={group.key} className="mb-5">
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
        {t(`nav.groups.${group.key}`)}
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
              className="group relative flex items-center gap-3 transition-all duration-200 rounded-xl focus:outline-none focus-visible:ring-0 focus-visible:bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-hover)] active:bg-[var(--bg-surface-hover)]"
              style={{
                height: '48px',
                padding: '0 12px',
                color: itemActive ? 'var(--color-primary)' : 'var(--text-primary)',
                background: 'transparent',
                transitionProperty: 'background-color, color',
                transitionDuration: '120ms',
              }}
              aria-current={itemActive ? 'page' : undefined}
            >
              {itemActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: '3px', height: '22px', background: 'var(--color-primary)' }}
                />
              )}
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
                {t(`nav.items.${item.key}`)}
              </span>
              {item.badge && (
                <span
                  className="flex items-center justify-center font-semibold shrink-0"
                  style={{ minWidth: '20px', height: '20px', fontSize: 'var(--text-overline, 12px)', background: 'var(--color-primary)', color: 'white', borderRadius: '9999px', padding: '0 6px' }}
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
    <div className="flex h-full flex-col" style={{ width: '256px' }}>
      {/* 抽屉顶部：紧凑头部（Logo 已移入顶栏） */}
      <div
        className="flex items-center justify-between min-h-[56px] shrink-0 px-3"
        style={{
          minHeight: 'calc(56px + var(--safe-area-inset-top, 0px))',
          paddingTop: 'var(--safe-area-inset-top, 0px)',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface-container-low)',
        }}
      >
        <span className="font-semibold" style={{ fontSize: 'var(--text-body, 15px)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
          {t('nav.mainNav')}
        </span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--bg-surface-hover)] active:scale-95 shrink-0 focus:outline-none focus-visible:ring-0 focus-visible:bg-[var(--bg-surface-hover)]"
          style={{ color: 'var(--text-secondary)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={t('nav.closeMenu')}
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* 导航列表 — 高频组常驻 + 低频组收纳 */}
      <nav className="flex-1 overflow-y-auto py-4" style={{ padding: '0 12px' }} aria-label={t('nav.mainNav')}>
        {primaryGroups.map(renderGroup)}

        {/* "更多功能"手风琴 — 低频组收纳（Apple：常见路径先展示，高级选项下沉一层） */}
        {secondaryGroups.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="w-full flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-0 focus-visible:bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-hover)] active:bg-[var(--color-primary-container)] transition-all duration-200"
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
                {t('nav.moreFunctions')}
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { openHelp } = useShortcutHelp();
  const { isMobile } = useBreakpoint();

  useRealtimeSync();

  // ── 抽屉状态（移动端 <1024px） ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // ── 桌面端常驻侧边栏状态（≥1024px） ──
  const [isDesktop, setIsDesktop] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 折叠状态：默认折叠（用户决策），并持久化到 localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rmfood-sidebar-collapsed') === 'true';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('rmfood-sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

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
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-gradient-start, #f8fafc)', height: '100dvh' }}>
      <SkipLink />

      {/* ── 顶栏（所有尺寸）：Logo 最左 + ☰ 紧邻；右侧含用户头像菜单 ── */}
      <header
        className="sticky top-0 z-[100] flex items-center justify-between"
        style={{
          /* iOS 安全区：不使用固定 height（会被 padding-top 挤压内容），
             改为 min-height = 常规高度 + 刘海安全区，padding 叠加在顶部。 */
          minHeight: 'calc(var(--header-height, 56px) + var(--safe-area-inset-top, 0px))',
          paddingTop: 'var(--safe-area-inset-top, 0px)',
          paddingLeft: 'var(--space-3, 12px)',
          paddingRight: 'var(--space-3, 12px)',
          background: 'var(--header-bg, rgba(255,255,255,0.92))',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
        }}
        aria-label={t('nav.topNav')}
      >
        {/* ── 左侧：Logo（品牌优先）；移动端额外显示菜单按钮（桌面端顶栏保持纯净） ── */}
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex items-center gap-2 px-1 shrink-0" aria-label="RMFOOD">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: '36px', height: '36px', background: 'var(--color-primary-surface)', color: 'var(--color-on-primary-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}
            >
              <Beaker size={18} strokeWidth={2} />
            </div>
            <div className="hidden sm:block min-w-0 leading-none">
              <div className="font-bold tracking-tight" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>
                RMFOOD
              </div>
              <p className="font-medium mt-0.5" style={{ fontSize: 'var(--text-caption, 11px)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                {t('nav.brandSubtitle')}
              </p>
            </div>
          </div>

          {/* 移动端（<1024px）菜单按钮：桌面端不显示，顶栏不被导航占用 */}
          {!isDesktop && (
            <button
              ref={hamburgerRef}
              onClick={() => setDrawerOpen(true)}
              className="flex items-center justify-center shrink-0 rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 active:scale-95 focus:outline-none"
              style={{ color: 'var(--text-secondary)', width: '44px', height: '44px' }}
              aria-label={t('nav.openMenu')}
              aria-expanded={drawerOpen}
              aria-controls="main-drawer"
            >
              <Menu size={22} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* ── 右侧：工具栏（小屏 <900px 隐藏低优先级的"键盘快捷键"，避免图标挤爆） ──
            注意：此容器必须保持 overflow-visible，否则通知/主题的下拉面板会被裁剪 */}
        <div className="flex items-center gap-1 overflow-visible">
          <NotificationCenter />
          <ThemeSwitcher variant="icon-only" size="sm" showLabel={false} />
          <button
            onClick={() => navigate('/formulas/new')}
            className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 hover:text-[var(--color-primary)] active:scale-95 focus:outline-none"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px' }}
            aria-label={t('nav.newFormula')}
            title={t('nav.newFormula')}
          >
            <FlaskConical size={18} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 hover:text-[var(--color-primary)] active:scale-95 focus:outline-none"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={openHelp}
            className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-[var(--color-primary-50)] dark:hover:bg-[var(--color-primary)]/15 hover:text-[var(--color-primary)] active:scale-95 focus:outline-none max-[900px]:hidden"
            style={{ color: 'var(--text-secondary)', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={t('nav.keyboardShortcuts')}
            title={t('nav.keyboardShortcutsHint')}
          >
            <Keyboard size={18} />
          </button>
          <UserMenu user={user} handleLogout={handleLogout} />
        </div>
      </header>

      {/* ── 移动端抽屉（仅 <1024px）── */}
      {!isDesktop && (
        <>
          {/* 全屏抽屉遮罩（z-350） */}
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

          {/* 全屏抽屉（z-400） */}
          <motion.div
            ref={drawerRef}
            {...(isMobile ? swipeHandlers : {})}
            id="main-drawer"
            className="fixed inset-y-0 left-0 z-[400]"
            style={{
              width: '256px',
              maxWidth: '100vw',
              background: 'var(--bg-surface-container, #ffffff)',
              boxShadow: 'var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2))',
              overscrollBehavior: 'contain',
              visibility: drawerOpen ? 'visible' : 'hidden',
            }}
            initial={false}
            animate={{
              x: drawerOpen ? 0 : -264,
            }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.45,
            }}
            role="dialog"
            aria-modal={drawerOpen || undefined}
            aria-label={t('nav.mainNav')}
            aria-hidden={!drawerOpen}
            inert={!drawerOpen ? true : undefined}
          >
            <MobileSidebarContent
              setSidebarOpen={setDrawerOpen}
              filteredGroups={filteredGroups}
              pathname={location.pathname}
            />
          </motion.div>
        </>
      )}

      {/* ── 内容区：桌面端常驻侧边栏 + 主内容 ── */}
      <div className="flex flex-1 overflow-hidden">
        {isDesktop && (
          <div
            id="app-sidebar"
            className="shrink-0 transition-all duration-300"
            style={{
              width: sidebarCollapsed ? '68px' : 'var(--sidebar-width, 176px)',
              overflow: 'hidden',
              background: 'var(--bg-surface-container, #ffffff)',
              borderRight: '1px solid var(--border-color)',
            }}
          >
            <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
          </div>
        )}

        {/* 主内容区（移动端抽屉打开时阻断交互） */}
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-auto p-3 sm:p-5 bg-grid',
            drawerOpen && 'pointer-events-none',
          )}
          style={{
            backgroundColor: 'var(--bg-canvas)',
            paddingBottom: isMobile ? '16px' : '24px',
            /* iOS：内部滚动容器禁止把滚动“穿透”到浏览器页面，避免触发下拉刷新 */
            overscrollBehavior: 'contain',
          }}
          tabIndex={-1}
        >
          <Outlet />
          <KeepAliveOutlet />
        </main>
      </div>

      {/* ── 站点页脚（A-14）──
          此前全站没有 contentinfo 地标，屏幕阅读器缺少「页面底部信息」定位点。
          补一条 32px 高的窄条：<footer> 是 <div> 的直接子元素（不在 main /
          section / article 内），因此自动获得 contentinfo 角色。
          移动端用 paddingBottom 让位给固定底部导航栏，避免被 64px 的 nav 盖住。 */}
      <footer
        className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
        style={{
          paddingBottom: isMobile ? 'calc(64px + var(--safe-area-inset-bottom, 0px))' : '8px',
          fontSize: 'var(--text-caption, 12px)',
          color: 'var(--text-secondary, #64748b)',
        }}
      >
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <span>RMFOOD · {t('nav.platformName')}</span>
          <span
            className="rounded border border-neutral-300/60 px-1.5 py-px font-medium leading-none tracking-wide dark:border-neutral-700/60"
            title={t('common.info')}
          >
            v{envConfig.app.version}
          </span>
        </span>
        <span>© {new Date().getFullYear()} 莱茵分子</span>
      </footer>

      {/* ── 底部导航栏（仅移动端） ── */}
      {isMobile && <MobileBottomNav />}

      <CommandPalette />
    </div>
  );
}
