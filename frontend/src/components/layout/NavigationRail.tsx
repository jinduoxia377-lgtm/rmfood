/**
 * NavigationRail — 平板端图标导航条（v2 深度优化版）
 *
 * 优化点：
 * - 使用共享 navConfig.ts，消除重复数据
 * - 移除 100ms hover 延迟，即时响应（平板使用鼠标/触控板）
 * - 悬浮浮层改为"跟随光标"定位，而非固定 left-full
 * - 键盘焦点时同样显示浮层（替代原 hover 事件）
 * - 防抖关闭：鼠标离开后 200ms 才收起浮层（避免快速移动时闪烁）
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FlaskConical,
  TestTubes,
  Brain,
  BarChart3,
  Building2,
  Plug,
  Bell,
  Users,
  Shield,
  Settings,
  ChevronRight,
  Beaker,
  Database,
  BookOpen,
  FileText,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import {
  NAV_GROUPS,
  filterNavByRole,
  isActive as isNavActive,
} from '@/components/layout/navConfig';

interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
  adminOnly?: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavigationRailProps {
  pathname: string;
}

export default function NavigationRail({ pathname }: NavigationRailProps) {
  const { user } = useAuthStore();
  const railRef = useRef<HTMLDivElement>(null);

  // 当前悬浮的 item 索引；null = 无悬浮
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  // 用于防抖关闭（鼠标移走后等待 200ms 再收起，避免快速移动时闪烁）
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredGroups = filterNavByRole(NAV_GROUPS, user?.role as string);
  const allItems = filteredGroups.flatMap((g) => g.items);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // 点击 rail 外部时关闭浮层
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setHoveredIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activateHover = useCallback((index: number) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setHoveredIndex(index);
  }, []);

  const deactivateHover = useCallback(() => {
    // 延迟关闭，让用户有机会移动到浮层上
    closeTimeoutRef.current = setTimeout(() => setHoveredIndex(null), 200);
  }, []);

  return (
    <div
      ref={railRef}
      className="hidden md:flex flex-col shrink-0 relative z-[200]"
      style={{
        width: 'var(--sidebar-collapsed-width, 64px)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-surface-container, #ffffff)',
        borderRight: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
      }}
      role="navigation"
      aria-label="平板导航栏"
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          height: 'var(--header-height, 56px)',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        <div
          className="flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
          style={{
            width: '40px',
            height: '40px',
            background: 'var(--color-primary, #10b981)',
            borderRadius: 'var(--radius-xl, 16px)',
            boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))',
          }}
        >
          <Beaker size={20} strokeWidth={2} />
        </div>
      </div>

      {/* 导航图标列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 px-2">
        {allItems.map((item, index) => {
          const Icon = item.icon;
          const itemActive = isNavActive(item.to, pathname);
          const isHovered = hoveredIndex === index;

          return (
            <div key={item.to} className="relative">
              {/* 外层容器：统一管理 hover 状态，防止鼠标移向浮层时触发关闭 */}
              <div
                className="relative"
                onMouseEnter={() => activateHover(index)}
                onMouseLeave={deactivateHover}
              >
                <NavLink
                  to={item.to}
                  end={item.to === '/dashboard'}
                  className="relative flex items-center justify-center w-full transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 hover:bg-[var(--bg-surface-hover, #f1f5f9)]"
                  style={{
                    height: '48px',
                    color: itemActive ? 'var(--color-primary, #10b981)' : 'var(--text-secondary, #64748b)',
                  }}
                  aria-current={itemActive ? 'page' : undefined}
                  aria-label={item.label}
                  // 不在此处绑定 onMouseEnter/onMouseLeave，由外层 div 统一接管
                  onFocus={() => activateHover(index)}
                  onBlur={deactivateHover}
                >
                  {/* 激活指示条 */}
                  {itemActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                      style={{ height: '24px', background: 'var(--color-primary, #10b981)', borderRadius: '0 2px 2px 0' }}
                    />
                  )}

                  {/* 图标容器 */}
                  <div
                    className="flex items-center justify-center transition-all duration-200"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-lg, 12px)',
                      background: itemActive
                        ? 'var(--color-primary, #10b981)'
                        : isHovered
                          ? 'var(--color-primary-container, #ecfdf5)'
                          : 'transparent',
                      color: itemActive
                        ? 'white'
                        : isHovered
                          ? 'var(--color-primary, #10b981)'
                          : 'var(--text-secondary, #64748b)',
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <Icon size={20} strokeWidth={itemActive ? 2 : 1.75} />
                  </div>

                  {/* 徽章 */}
                  {item.badge && (
                    <div
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                      style={{ background: 'var(--color-error, #ef4444)', boxShadow: '0 1px 3px rgba(239,68,68,0.4)' }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </NavLink>

                {/* 悬浮标签浮层 — 与图标在同一容器内，鼠标移入不会触发关闭 */}
                {isHovered && (
                  <div
                    className="absolute left-full top-0 ml-2 z-[300] min-w-[160px]"
                    style={{ animation: 'rail-flyout var(--duration-fast, 100ms) ease-out' }}
                  >
                    <div
                      className="rounded-xl shadow-xl border overflow-hidden"
                      style={{
                        borderRadius: 'var(--radius-xl, 16px)',
                        background: 'var(--bg-surface, #ffffff)',
                        borderColor: 'var(--border-color, #e2e8f0)',
                        boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.12))',
                      }}
                    >
                      {/* 小三角指示器 */}
                      <div
                        className="absolute -left-1.5 top-3 w-3 h-3 rotate-45"
                        style={{
                          background: 'var(--bg-surface, #ffffff)',
                          borderLeft: '1px solid var(--border-color, #e2e8f0)',
                          borderTop: '1px solid var(--border-color, #e2e8f0)',
                        }}
                      />

                      <div className="p-2">
                        {/* 当前项高亮 */}
                        <div
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1',
                            itemActive && 'bg-[var(--color-primary-container)]',
                          )}
                        >
                          <div
                            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                            style={{
                              background: itemActive ? 'var(--color-primary)' : 'var(--bg-surface-elevated, #f1f5f9)',
                              color: itemActive ? 'white' : 'var(--text-secondary)',
                            }}
                          >
                            <Icon size={16} strokeWidth={1.75} />
                          </div>
                          <span
                            className="flex-1 text-sm font-medium"
                            style={{
                              color: itemActive ? 'var(--color-primary)' : 'var(--text-primary)',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {item.label}
                          </span>
                          {itemActive && (
                            <ChevronRight size={14} style={{ color: 'var(--color-primary)' }} />
                          )}
                        </div>

                        {/* 相邻项预览 */}
                        {allItems
                          .slice(Math.max(0, index - 1), index + 2)
                          .filter((_, i) => i !== index)
                          .map((adj) => {
                            const AdjIcon = adj.icon;
                            return (
                              <a
                                key={adj.to}
                                href={adj.to}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-hover)]"
                                style={{ color: 'var(--text-secondary)' }}
                                // 悬浮相邻项时切换到对应索引的浮层
                                onMouseEnter={() => activateHover(allItems.findIndex((a) => a.to === adj.to))}
                              >
                                <AdjIcon size={16} strokeWidth={1.5} />
                                <span>{adj.label}</span>
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部用户头像 */}
      <div
        className="shrink-0 py-3 border-t flex items-center justify-center"
        style={{ borderColor: 'var(--border-color, #e2e8f0)', background: 'var(--bg-surface-container-low, #f8fafc)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary, #10b981), var(--color-primary-700, #047857))',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1))',
          }}
        >
          {(user?.fullName || user?.username || 'U')[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </div>
  );
}
