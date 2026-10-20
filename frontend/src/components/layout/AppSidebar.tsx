/**
 * AppSidebar — 桌面端常驻可折叠侧边栏
 *
 * 形态：
 * - 展开态：分组标题 + 图标(40px) + 栏目名称
 * - 折叠态：仅图标居中（宽度 68px），分组标题换成分隔线，hover 显示 tooltip
 *
 * 与 MobileSidebarContent 的区别：
 * - 无 Logo 区（Logo 已移入顶栏）
 * - 无用户卡片（用户头像已移入顶栏右侧菜单）
 * - 折叠态直接展示所有导航项图标（不分手风琴）
 */
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { NAV_GROUPS, filterNavByRole, isActive } from '@/components/layout/navConfig';
import { useAuthStore } from '@/stores/auth';

const PRIMARY_NAV_GROUP_KEYS = new Set(['core', 'lab', 'intelligence']);

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  const filteredGroups = filterNavByRole(NAV_GROUPS, user?.role as string);
  const primaryGroups = filteredGroups.filter((g) => PRIMARY_NAV_GROUP_KEYS.has(g.key));
  const secondaryGroups = filteredGroups.filter((g) => !PRIMARY_NAV_GROUP_KEYS.has(g.key));
  const [moreOpen, setMoreOpen] = useState(false);

  // ── 单个导航项（展开：图标+名称；折叠：仅图标；激活用左侧指示条+实色图标，无半透明底） ──
  const renderItem = (item: (typeof NAV_GROUPS)[number]['items'][number]) => {
    const Icon = item.icon;
    const active = isActive(item.to, pathname);
    const label = t(`nav.items.${item.key}`);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/dashboard'}
        title={collapsed ? label : undefined}
        className="group relative flex items-center gap-3 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-0 focus-visible:bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-hover)] active:bg-[var(--bg-surface-hover)]"
        style={{
          height: '48px',
          padding: collapsed ? '0' : '0 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: active ? 'var(--color-primary)' : 'var(--text-primary)',
          background: 'transparent',
          transitionProperty: 'background-color, color',
          transitionDuration: '120ms',
        }}
        aria-current={active ? 'page' : undefined}
      >
        {/* 激活指示条（实色，无半透明） */}
        {active && (
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
            background: active ? 'var(--color-primary)' : 'transparent',
            color: active ? 'white' : 'var(--text-secondary)',
          }}
        >
          <Icon size={20} strokeWidth={active ? 2 : 1.5} />
        </div>
        {!collapsed && (
          <span className="flex-1 font-medium truncate" style={{ fontSize: 'var(--text-body, 15px)', fontFamily: 'var(--font-sans)' }}>
            {label}
          </span>
        )}
        {!collapsed && item.badge && (
          <span
            className="flex items-center justify-center font-semibold shrink-0"
            style={{ minWidth: '20px', height: '20px', fontSize: 'var(--text-overline, 12px)', background: 'var(--color-primary)', color: 'white', borderRadius: '9999px', padding: '0 6px' }}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  // ── 分组渲染（展开态） ──
  const renderExpandedGroup = (group: (typeof NAV_GROUPS)[number]) => (
    <div key={group.key} className="mb-5">
      <div className="mb-2 h-px" style={{ background: 'var(--border-color)' }} />
      <p
        className="mb-2 px-3 pt-1"
        style={{
          fontSize: 'var(--text-caption, 11px)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.08em',
          textTransform: 'none',
        }}
      >
        {t(`nav.groups.${group.key}`)}
      </p>
      <div className="space-y-1">
        {group.items.map(renderItem)}
      </div>
    </div>
  );

  // ── 折叠态：顶部折叠开关 + 所有分组仅显示图标（背景由 MainLayout 容器提供毛玻璃） ──
  if (collapsed) {
    return (
      <nav
        className="flex h-full flex-col overflow-y-auto py-3"
        style={{ width: '68px', background: 'transparent' }}
        aria-label={t('nav.mainNav')}
      >
        <button
          onClick={onToggle}
          className="mx-auto mb-3 flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 hover:bg-[var(--bg-surface-hover)] focus:outline-none focus-visible:ring-0"
          aria-label={t('nav.expandSidebar')}
          title={t('nav.expandSidebar')}
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronsRight size={18} strokeWidth={2} />
        </button>
        {filteredGroups.map((group) => (
          <div key={group.key} className="mb-2">
            <div className="mx-2 mb-2 h-px" style={{ background: 'var(--border-color)' }} />
            <div className="space-y-1">
              {group.items.map(renderItem)}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  // ── 展开态：右对齐折叠按钮 + 分隔线分组标题 + 高频组常驻 + 低频组手风琴 ──
  // 导航项占满全宽（无外层左右 padding），hover/激活背景从左到右铺满，消除右侧空白
  return (
    <nav
      className="flex h-full flex-col overflow-y-auto py-3"
      style={{ width: 'var(--sidebar-width, 176px)', background: 'transparent' }}
      aria-label={t('nav.mainNav')}
    >
      {/* 轻量折叠按钮（右对齐，不占主要视觉） */}
      <div className="mb-1 flex justify-end px-2">
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200 hover:bg-[var(--bg-surface-hover)] focus:outline-none focus-visible:ring-0"
          aria-label={t('nav.collapseSidebar')}
          title={t('nav.collapseSidebar')}
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronsLeft size={18} strokeWidth={2} />
        </button>
      </div>
      {primaryGroups.map(renderExpandedGroup)}

      {secondaryGroups.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="w-full flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-0 focus-visible:bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-hover)] active:bg-[var(--color-primary-container)] transition-all duration-200"
            style={{ height: '48px', padding: '0 12px' }}
            aria-expanded={moreOpen}
            aria-controls="app-sidebar-more-panel"
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'transparent', color: 'var(--text-secondary)' }}
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

          <AnimatePresence initial={false}>
            {moreOpen && (
              <motion.div
                id="app-sidebar-more-panel"
                key="app-more-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: '4px' }}>
                  {secondaryGroups.map(renderExpandedGroup)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </nav>
  );
}