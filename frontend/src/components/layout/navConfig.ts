/**
 * navConfig.ts — 共享导航配置
 *
 * 单一数据源：MainLayout / NavigationRail / MobileSidebarContent / MobileBottomNav
 * 均从此文件导入，修改只需一处。
 */
import type { ElementType } from 'react';
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
  Database,
  BookOpen,
  FileText,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';

// ── 类型定义 ──
export interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
  adminOnly?: boolean;
  badge?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// ── 完整导航配置（单一来源） ──
export const NAV_GROUPS: NavGroup[] = [
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
      { to: '/regulations', label: '合规标准', icon: ShieldCheck },
      { to: '/terminology', label: '术语管理', icon: BookOpen },
      { to: '/workflows', label: '工作流管理', icon: GitBranch },
    ],
  },
  {
    title: '企业功能 (SSS)',
    items: [
      { to: '/analytics', label: '数据分析中心', icon: BarChart3 },
      { to: '/organizations', label: '组织管理', icon: Building2 },
      { to: '/integrations', label: '集成与 API', icon: Plug },
    ],
  },
  {
    title: '系统',
    items: [
      { to: '/notifications', label: '通知中心', icon: Bell, badge: 3 },
      { to: '/users', label: '用户管理', icon: Users, adminOnly: true },
      { to: '/audit-logs', label: '审计日志', icon: Shield, adminOnly: true },
      { to: '/settings', label: '设置', icon: Settings },
    ],
  },
];

// ── 移动端底部导航的高频项（前 4 个，不区分角色过滤） ──
export const MOBILE_BOTTOM_NAV_ITEMS = [
  { to: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { to: '/formulas', label: '配方', icon: FlaskConical },
  { to: '/experiments', label: '实验', icon: TestTubes },
  { to: '/ai', label: 'AI 助手', icon: Brain },
  { to: '/analytics', label: '数据', icon: BarChart3 },
  { to: '/notifications', label: '通知', icon: Bell, badge: 3 },
  { to: '/settings', label: '设置', icon: Settings },
] as const;

// ── 激活状态判断（统一逻辑，三端复用） ──
export function isActive(to: string, pathname: string): boolean {
  if (to === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(to);
}

// ── 根据角色过滤导航项 ──
export function filterNavByRole(
  groups: NavGroup[],
  userRole?: string,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.adminOnly || userRole?.toUpperCase() === 'ADMIN',
      ),
    }))
    .filter((group) => group.items.length > 0);
}
