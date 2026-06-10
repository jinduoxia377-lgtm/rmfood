/**
 * RMFOOD 设计系统 — 主布局 v5.0 (Material Design 3)
 * v5.0 优化:
 * - 全面采用 Google Material Design 3 设计规范
 * - 建立统一的字体层级系统 (Google Sans)
 * - 标准化色彩方案，确保对比度符合 WCAG AA 标准
 * - 优化交互反馈效果，添加悬停/激活/聚焦状态
 * - 完善响应式设计，支持移动端/平板/桌面端
 * - 增强可访问性，添加完整的 ARIA 属性
 */
import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import {
  LayoutDashboard, FlaskConical, TestTubes, Users, Settings,
  LogOut, Menu, X, ChevronRight, ChevronLeft, Beaker, Brain, Database, Search,
  Bell, GitBranch, Shield, Keyboard, FileText,
  BarChart3, Building2, Plug, BellRing,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types'
import { UserRole } from '@/types'
import { ThemeSwitcher } from '@/theme'
import { NotificationBell } from '@/components/ui'
import CommandPalette from '@/components/ui/CommandPalette'
import { useShortcutHelp } from '@/hooks/useKeyboardShortcuts.tsx'
import { useBreakpoint, useSwipe } from '@/hooks/useMobile'

// SSS 企业级功能组件
import { NotificationCenter } from '@/components/notification/NotificationCenter'

// Material Design 3 设计常量
const MD3 = {
  sidebar: {
    width: '264px',
    collapsedWidth: '72px',
    headerHeight: '64px',
    itemHeight: '48px',
    padding: '16px',
    itemPadding: '0 12px',
  },
  typography: {
    headlineSmall: '14px',
    headlineWeight: 700,
    labelLarge: '14px',
    labelMedium: '12px',
    labelSmall: '11px',
    bodyMedium: '14px',
    bodySmall: '12px',
    caption: '11px',
  },
  elevation: {
    level1: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    level2: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    level3: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    level4: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  shape: {
    cornerSmall: '8px',
    cornerMedium: '12px',
    cornerLarge: '16px',
    cornerExtraLarge: '28px',
  },
  animation: {
    duration: '200ms',
    durationSlow: '300ms',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
}

/**
 * 页面过渡动画组件
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-[page-enter_0.35s_ease-out]">
      {children}
    </div>
  )
}

// ── 跳转链接（无障碍） ──
function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      跳转到主要内容
    </a>
  )
}

// ── 导航分组 ──
interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
  badge?: number
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '工作区',
    items: [
      { to: '/dashboard', label: '工作台', icon: LayoutDashboard },
      { to: '/formulas', label: '配方管理', icon: FlaskConical },
      { to: '/experiments', label: '实验管理', icon: TestTubes },
    ],
  },
  {
    title: '智能工具',
    items: [
      { to: '/ai', label: 'AI 智能助手', icon: Brain },
      { to: '/academic-report', label: '学术报告', icon: FileText },
      { to: '/databases', label: '数据库检索', icon: Database },
      { to: '/workflows', label: '工作流管理', icon: GitBranch },
    ],
  },
  {
    title: '企业功能 (SSS)',
    items: [
      { to: '/analytics', label: '数据分析中心', icon: BarChart3 },
      { to: '/organizations', label: '组织管理', icon: Building2 },
      { to: '/integrations', label: '集成与API', icon: Plug },
    ],
  },
  {
    title: '系统',
    items: [
      { to: '/notifications', label: '通知中心', icon: Bell, badge: 3 },
      { to: '/users', label: '用户管理', icon: Users, adminOnly: true },
      { to: '/audit-logs', label: '审计日志', icon: Shield, adminOnly: true },
    ],
  },
]

// ── 角色显示映射 ──
const roleLabels: Record<string, string> = {
  admin: '管理员',
  ADMIN: '管理员',
  reviewer: '审核员',
  formulator: '配方师',
  researcher: '研究员',
  guest: '访客',
}

// ── 侧边栏 Props ──
interface SidebarContentProps {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  filteredGroups: NavGroup[]
  pathname: string
  user: User | null
  handleLogout: () => void
  navigate: (to: string) => void
}

/**
 * 侧边栏内容 — Material Design 3 规范实现
 */
function SidebarContent({
  sidebarCollapsed,
  setSidebarCollapsed,
  setSidebarOpen,
  filteredGroups,
  pathname,
  user,
  handleLogout,
  navigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col" style={{ width: MD3.sidebar.width }}>
      {/* Logo 区 - Material Design 3 Top App Bar 规范 */}
      <div
        className="flex items-center gap-3 h-[64px] shrink-0 px-4 transition-all duration-300"
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface-container-low)',
        }}
      >
        <div
          className="flex items-center justify-center text-white shrink-0 transition-all duration-300"
          style={{
            width: '40px',
            height: '40px',
            background: 'var(--color-primary)',
            borderRadius: MD3.shape.cornerLarge,
            boxShadow: MD3.elevation.level2,
          }}
        >
          <Beaker size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1
            className="font-bold tracking-tight leading-none"
            style={{
              fontSize: MD3.typography.headlineSmall,
              fontWeight: MD3.typography.headlineWeight,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            RMFOOD
          </h1>
          <p
            className="font-medium leading-tight mt-0.5"
            style={{
              fontSize: MD3.typography.caption,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            配方平台
          </p>
        </div>
        <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg transition-all duration-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            style={{
              color: 'var(--text-secondary)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            aria-label="关闭菜单"
            aria-controls="sidebar"
          >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      {/* 导航列表 - Material Design 3 Navigation Rail 规范 */}
      <nav
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{ padding: MD3.sidebar.padding }}
        aria-label="主导航"
      >
        {filteredGroups.map((group, groupIndex) => (
          <div key={group.title} className="mb-6">
            {/* 分组标题 - Material Design 3 Label 规范 */}
            <p
              className="uppercase tracking-wider mb-3"
              style={{
                fontSize: MD3.typography.labelSmall,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.1em',
                padding: '0 12px',
              }}
            >
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
                    style={{
                      height: MD3.sidebar.itemHeight,
                      padding: MD3.sidebar.itemPadding,
                      color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
                      background: isActive
                        ? 'var(--color-primary-container)'
                        : 'transparent',
                      transition: `all ${MD3.animation.duration} ${MD3.animation.ease}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-surface-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    {/* 图标容器 - Material Design 3 Icon Button 规范 */}
                    <div
                      className="flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: MD3.shape.cornerMedium,
                        background: isActive ? 'var(--color-primary)' : 'transparent',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <Icon
                        size={20}
                        strokeWidth={isActive ? 2 : 1.5}
                        style={{
                          transition: `all ${MD3.animation.duration} ${MD3.animation.ease}`,
                        }}
                      />
                    </div>
                    {/* 标签文本 */}
                    <span
                      className="flex-1 font-medium truncate"
                      style={{
                        fontSize: MD3.typography.bodyMedium,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {item.label}
                    </span>
                    {/* 徽章 */}
                    {item.badge && (
                      <span
                        className="flex items-center justify-center font-semibold shrink-0"
                        style={{
                          minWidth: '20px',
                          height: '20px',
                          fontSize: MD3.typography.labelSmall,
                          background: 'var(--color-primary)',
                          color: 'white',
                          borderRadius: MD3.shape.cornerExtraLarge,
                          padding: '0 6px',
                          boxShadow: MD3.elevation.level1,
                        }}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                    {/* 激活指示器 */}
                    {isActive && (
                      <ChevronRight
                        size={16}
                        strokeWidth={2}
                        style={{
                          color: 'var(--color-primary)',
                          opacity: 0.8,
                        }}
                      />
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 用户卡片 - Material Design 3 Card 规范 */}
      <div
        className="shrink-0 transition-all duration-300"
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: MD3.sidebar.padding,
          background: 'var(--bg-surface-container-low)',
        }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          onClick={() => navigate('/settings')}
          style={{
            padding: '12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            boxShadow: MD3.elevation.level1,
            transition: `all ${MD3.animation.duration} ${MD3.animation.ease}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface-hover)'
            e.currentTarget.style.borderColor = 'var(--color-primary)'
            e.currentTarget.style.boxShadow = MD3.elevation.level2
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-surface)'
            e.currentTarget.style.borderColor = 'var(--border-color)'
            e.currentTarget.style.boxShadow = MD3.elevation.level1
          }}
          aria-label={`${user?.full_name || user?.username || '用户'}的账户菜单`}
        >
          {/* 用户头像 */}
          <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-700))',
              borderRadius: MD3.shape.cornerLarge,
              fontSize: MD3.typography.labelLarge,
              boxShadow: MD3.elevation.level2,
            }}
          >
            {String(user?.full_name || user?.username || 'U')[0]?.toUpperCase() || 'U'}
          </div>
          {/* 用户信息 */}
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold truncate leading-tight"
              style={{
                fontSize: MD3.typography.bodyMedium,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {String(user?.full_name || user?.username || '') || '未登录'}
            </p>
            <p
              className="truncate"
              style={{
                fontSize: MD3.typography.caption,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {roleLabels[String(user?.role || 'guest')] ?? String(user?.role || '访客')}
            </p>
          </div>
          {/* 退出按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); handleLogout() }}
            className="p-2 rounded-lg transition-all duration-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2"
            style={{
              color: 'var(--text-secondary)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-error-container)'
              e.currentTarget.style.color = 'var(--color-error)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const { openHelp } = useShortcutHelp()
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  // 启用 CDC 实时数据同步
  useRealtimeSync()

  // 侧边栏滑动手势：向左滑动关闭侧边栏
  const sidebarSwipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (sidebarOpen) setSidebarOpen(false)
    },
    threshold: 80,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || (user?.role as string)?.toUpperCase() === UserRole.ADMIN),
  })).filter((group) => group.items.length > 0)

  const currentPage = navGroups
    .flatMap((g) => g.items)
    .find((item) => location.pathname.startsWith(item.to))
  const pageName = currentPage?.label ?? ''

  const sidebarProps: SidebarContentProps = {
    sidebarCollapsed: false,
    setSidebarCollapsed: () => {},
    setSidebarOpen,
    filteredGroups,
    pathname: location.pathname,
    user,
    handleLogout,
    navigate,
  }

  return (
    <div
      className="flex h-screen"
      style={{ background: 'linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))' }}
    >
      <SkipLink />

      {/* 遮罩层 - 所有设备通用 */}
      <div
        className={cn(
          'fixed inset-0 z-40 backdrop-blur-sm transition-all duration-300 ease-in-out',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
        aria-label="关闭菜单"
        tabIndex={sidebarOpen ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            setSidebarOpen(false)
          }
        }}
      />

      {/* 侧边栏 - 统一汉堡菜单模式 (桌面/移动/平板通用) */}
      <aside
        {...(isMobile || isTablet ? sidebarSwipeHandlers : {})}
        className={cn(
          'fixed inset-y-0 left-0 z-50 shadow-2xl transform transition-all duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          width: MD3.sidebar.width,
          background: 'var(--bg-surface-container)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--border-color)',
          boxShadow: MD3.elevation.level4,
          position: 'fixed',
          top: '0',
          height: '100vh',
          overflowY: 'auto',
        }}
        aria-hidden={!sidebarOpen}
        aria-label="主导航"
        tabIndex={sidebarOpen ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setSidebarOpen(false)
          }
        }}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col transition-all duration-300 min-w-0">
        {/* 顶栏 */}
        <header
          className="sticky top-0 z-20"
          style={{
            background: 'var(--header-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--border-color)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div className={cn(
            'flex items-center justify-between h-14',
            isMobile ? 'px-3' : isTablet ? 'px-4' : 'px-6',
          )}>
            <div className="flex items-center gap-3">
              {/* 汉堡菜单按钮 - 所有设备通用 */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  'flex items-center justify-center rounded-lg transition-all duration-200 touch-target',
                  'hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  sidebarOpen ? 'bg-primary-50 dark:bg-primary-900/20' : '',
                )}
                style={{
                  color: sidebarOpen ? 'var(--color-primary)' : 'var(--text-secondary)',
                  width: '44px',
                  height: '44px',
                }}
                aria-label={sidebarOpen ? "关闭菜单" : "打开菜单"}
                aria-expanded={sidebarOpen}
                aria-haspopup="true"
                aria-controls="sidebar"
              >
                {sidebarOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
              </button>
              {pageName && (
                <nav className={cn(
                  'items-center gap-2 text-sm',
                  isMobile ? 'hidden' : 'flex',
                )} aria-label="面包屑">
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>RMFOOD</span>
                  <ChevronRight size={12} style={{ color: 'var(--border-color)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{pageName}</span>
                </nav>
              )}
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-2">
              {/* 搜索按钮 */}
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className={cn(
                  'hidden items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200',
                  isMobile ? 'hidden' : 'flex',
                )}
                style={{
                  background: 'var(--hover-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-50)'
                  e.currentTarget.style.borderColor = 'var(--color-primary-200)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--hover-bg)'
                  e.currentTarget.style.borderColor = 'var(--border-color)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                aria-label="全局搜索"
              >
                <Search size={12} />
                <span className="text-xs font-medium">搜索...</span>
                <kbd
                  className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Ctrl+K
                </kbd>
              </button>

              {/* 移动端搜索 */}
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200 touch-target',
                  isMobile ? 'flex' : 'hidden',
                )}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-50)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                aria-label="搜索"
              >
                <Search size={16} />
              </button>

              {/* SSS级企业通知中心 */}
              <NotificationCenter />

              {/* 主题切换器 - 专业级主题系统 */}
              <ThemeSwitcher variant="icon-only" size="sm" showLabel={false} />

              {/* 新建配方按钮 */}
              <button
                onClick={() => navigate('/formulas/new')}
                className={cn(
                  'items-center gap-2 text-xs font-semibold text-white transition-all duration-200 active:scale-[0.98]',
                  isMobile ? 'hidden' : 'flex',
                )}
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
                  borderRadius: 'var(--radius-md)',
                  padding: '7px 14px',
                  boxShadow: '0 4px 16px rgba(var(--color-primary-rgb), 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-800))'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(var(--color-primary-rgb), 0.4)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--color-primary-rgb), 0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <FlaskConical size={12} strokeWidth={2.2} />
                新建配方
              </button>

              {/* 移动端/平板端新建 */}
              <button
                onClick={() => navigate('/formulas/new')}
                className={cn(
                  'p-2 rounded-lg text-white transition-all duration-200 active:scale-[0.98] touch-target',
                  isMobile ? 'flex' : 'hidden',
                )}
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
                  boxShadow: '0 4px 16px rgba(var(--color-primary-rgb), 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-700), var(--color-primary-800))'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(var(--color-primary-rgb), 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--color-primary-rgb), 0.3)'
                }}
                aria-label="新建配方"
              >
                <FlaskConical size={16} />
              </button>

              <button
                onClick={() => navigate('/settings')}
                className="p-1.5 rounded-lg transition-all duration-200 touch-target"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-50)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                aria-label="系统设置"
              >
                <Settings size={16} />
              </button>

              {/* 快捷键帮助按钮 */}
              <button
                onClick={openHelp}
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200',
                  isMobile ? 'hidden' : 'flex',
                )}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary-50)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                aria-label="键盘快捷键"
                title="键盘快捷键 (Ctrl+/)"
              >
                <Keyboard size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-auto transition-all duration-300',
            isMobile ? 'p-3' : isTablet ? 'p-4' : 'p-5',
          )}
          tabIndex={-1}
          style={{
            background: 'linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end))',
          }}
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* 全局 Command Palette */}
      <CommandPalette />
    </div>
  )
}
