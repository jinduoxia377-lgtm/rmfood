/**
 * navConfig.ts — 共享导航配置
 *
 * 单一数据源：MainLayout（MobileSidebarContent）/ MobileBottomNav
 * 均从此文件导入，修改只需一处。
 *
 * 规范：所有导航项标签统一为 4 个汉字
 */
import type { ComponentType } from 'react';
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
  Workflow,
  ShieldCheck,
  Package,
  Beaker,
  Clock,
  FileCheck,
  Scale,
  ScanLine,
  ScanText,
  Barcode,
  Dna,
  Bot,
} from 'lucide-react';

// ── 类型定义 ──
export interface NavItem {
  to: string;
  /** i18n key 后缀（完整 key 为 nav.items.<key>），供多语言渲染 */
  key: string;
  /** 中文标签（默认语言兜底，规范：统一为 4 个汉字） */
  label: string;
  icon: ComponentType<any>;
  adminOnly?: boolean;
  badge?: number;
}

export interface NavGroup {
  /** i18n key 后缀（完整 key 为 nav.groups.<key>） */
  key: string;
  title: string;
  items: NavItem[];
}

// ── 完整导航配置（单一来源） ──
// 规范：所有 label 统一为 4 个汉字
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'core',
    title: '核心工作',
    items: [
      { to: '/dashboard',       key: 'dashboard',       label: '系统概览', icon: LayoutDashboard },
      { to: '/formulas',        key: 'formulas',        label: '配方管理', icon: FlaskConical },
      { to: '/batches',         key: 'batches',         label: '生产批次', icon: Package },
    ],
  },
  {
    key: 'lab',
    title: '实验中心',
    items: [
      { to: '/experiments',     key: 'experiments',     label: '实验管理', icon: TestTubes },
      { to: '/doe',             key: 'doe',             label: '实验设计', icon: Beaker },
      { to: '/stability',       key: 'stability',       label: '稳定分析',   icon: Clock },
      { to: '/documents',       key: 'documents',       label: '智能提取', icon: FileCheck },
    ],
  },
  {
    key: 'compliance',
    title: '合规质量',
    items: [
      { to: '/compliance',      key: 'compliance',      label: '合规核验', icon: Scale },
      { to: '/label-check',     key: 'labelCheck',     label: '配料核查', icon: ScanText },
      { to: '/ingredient-analysis', key: 'ingredientAnalysis', label: '配料分析', icon: ScanLine },
      { to: '/labels',          key: 'labels',          label: '标签生成', icon: Barcode },
    ],
  },
  {
    key: 'intelligence',
    title: '智能工具',
    items: [
      { to: '/ai',              key: 'ai',              label: '智能助手',   icon: Brain },
      { to: '/agent',           key: 'agent',           label: '智能协作',   icon: Bot },
      { to: '/academic-report', key: 'academicReport', label: '学术报告',   icon: FileText },
      { to: '/databases',       key: 'databases',       label: '数据检索',   icon: Database },
      { to: '/peptide-structure', key: 'peptideStructure', label: '肽链结构', icon: Dna },
      { to: '/regulations',     key: 'regulations',     label: '法规标准',   icon: ShieldCheck },
      { to: '/terminology',     key: 'terminology',     label: '术语辞典',   icon: BookOpen },
      { to: '/workflows',       key: 'workflows',       label: '流程管理',   icon: Workflow },
    ],
  },
  {
    key: 'enterprise',
    title: '企业管理',
    items: [
      { to: '/analytics',       key: 'analytics',       label: '数据分析', icon: BarChart3 },
      { to: '/organizations', key: 'organizations', label: '组织架构', icon: Building2 },
      { to: '/integrations',  key: 'integrations',  label: '系统集成', icon: Plug },
    ],
  },
  {
    key: 'system',
    title: '系统设置',
    items: [
      { to: '/notifications', key: 'notifications', label: '消息通知', icon: Bell },
      { to: '/users',         key: 'users',         label: '用户管理', icon: Users, adminOnly: true },
      { to: '/audit-logs',    key: 'auditLogs',    label: '审计日志', icon: Shield, adminOnly: true },
      { to: '/settings',      key: 'settings',      label: '系统设置', icon: Settings },
    ],
  },
];

// ── 移动端底部导航（高频项，不区分角色） ──
export const MOBILE_BOTTOM_NAV_ITEMS = [
  { to: '/dashboard', label: '系统概览', icon: LayoutDashboard },
  { to: '/formulas',  label: '配方管理', icon: FlaskConical },
  { to: '/experiments', label: '实验管理', icon: TestTubes },
  { to: '/ai',        label: '智能助手', icon: Brain },
  { to: '/analytics', label: '数据分析', icon: BarChart3 },
  { to: '/notifications', label: '消息通知', icon: Bell },
  { to: '/settings',  label: '系统设置', icon: Settings },
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
