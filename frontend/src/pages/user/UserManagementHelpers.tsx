/**
 * UserManagementPage helpers, constants, interfaces, and mock data
 */
import React, { useState, useEffect } from 'react'
import {
  Shield, ShieldCheck, Users, Filter, Eye, ShieldAlert,
} from 'lucide-react'
import { UserRole } from '@/types'

export const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.ComponentType<any>;
    description: string;
    bgColor: string;
    chartColor: string;
  }
> = {
  [UserRole.ADMIN]: {
    label: '系统管理员',
    color: 'bg-error-100 text-error-700 dark:bg-error-300/25 dark:text-error-600',
    icon: Shield,
    description: '拥有所有权限',
    bgColor: 'bg-error-50 dark:bg-error-950/30',
    chartColor: 'var(--color-error, #FF3B30)',
  },
  [UserRole.REVIEWER]: {
    label: '审核员',
    color: 'bg-warning-100 text-warning-700 dark:bg-warning-300/25 dark:text-warning-700',
    icon: ShieldCheck,
    description: '管理用户和内容审核',
    bgColor: 'bg-warning-50 dark:bg-warning-950/30',
    chartColor: 'var(--color-warning-500, #EA580C)',
  },
  [UserRole.RESEARCHER]: {
    label: '研究员',
    color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-300/25 dark:text-secondary-700',
    icon: Users,
    description: '配方研发人员',
    bgColor: 'bg-secondary-50 dark:bg-secondary-950/30',
    chartColor: 'var(--color-secondary, #0A84FF)',
  },
  [UserRole.FORMULATOR]: {
    label: '配方师',
    color: 'bg-accent-100 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700',
    icon: Filter,
    description: '配方设计与开发',
    bgColor: 'bg-accent-50 dark:bg-accent-950/30',
    chartColor: 'var(--color-accent-500, #A855F7)',
  },
  [UserRole.GUEST]: {
    label: '访客',
    color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    icon: Eye,
    description: '只读访问权限',
    bgColor: 'bg-neutral-50 dark:bg-neutral-900/30',
    chartColor: 'var(--text-muted, #9A9A9F)',
  },
};

export const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

export const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '已禁用' },
];

export const STATUS_CONFIG = {
  active: { label: '正常', variant: 'success' as const, icon: ShieldCheck, dotColor: 'bg-primary-500' },
  inactive: { label: '已禁用', variant: 'danger' as const, icon: ShieldAlert, dotColor: 'bg-error-500' },
};

export const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' },
];

export const CHART_COLORS = ['var(--color-error, #FF3B30)', '#EA580C', 'var(--color-secondary, #0A84FF)', '#a855f7', 'var(--text-muted, #9A9A9F)'];

export function resolveRoleKey(role: string | undefined): string {
  if (!role) return UserRole.GUEST;
  const lower = role.toLowerCase();
  if (lower in ROLE_CONFIG) return lower;
  return UserRole.GUEST;
}

export function getRoleConfig(role: string | undefined) {
  return ROLE_CONFIG[resolveRoleKey(role)] || ROLE_CONFIG[UserRole.GUEST];
}

export type SortField = 'username' | 'full_name' | 'role' | 'created_at' | 'last_login';
export type SortDirection = 'asc' | 'desc';

export interface UserDetail {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: UserRole | string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
  department?: string | null;
  phone?: string | null;
  avatar_url?: string;
  login_attempts?: number;
  locked_until?: string | null;
  organization_id?: number | null;
  organization_name?: string | null;
}

export interface ConfirmAction {
  type: 'status' | 'role' | 'batch_status' | 'batch_role';
  userId?: number;
  userIds?: number[];
  currentValue?: string;
  newValue?: string;
  label: string;
  description: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'primary';
}

export interface OperationLog {
  id: number;
  timestamp: string;
  operator: string;
  action: string;
  target: string;
  details: string;
  type: 'role_change' | 'status_toggle' | 'batch_op' | 'login_anomaly' | 'security_event';
}

export interface ActivityRecord {
  id: number;
  time: string;
  action: string;
  ip: string;
  location: string;
  status: 'success' | 'failed' | 'warning';
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '从未';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export const MOCK_ACTIVITY_RECORDS: ActivityRecord[] = [
  { id: 1, time: '2026-05-31 14:32:00', action: '登录系统', ip: '192.168.1.105', location: '北京', status: 'success' },
  { id: 2, time: '2026-05-31 09:15:22', action: '登录系统', ip: '192.168.1.105', location: '北京', status: 'success' },
  {
    id: 3,
    time: '2026-05-30 18:45:10',
    action: '修改配方 #128',
    ip: '192.168.1.105',
    location: '北京',
    status: 'success',
  },
  {
    id: 4,
    time: '2026-05-30 11:20:33',
    action: '登录失败 (密码错误)',
    ip: '10.0.0.55',
    location: '上海',
    status: 'failed',
  },
  { id: 5, time: '2026-05-29 16:08:45', action: '登录系统', ip: '192.168.1.105', location: '北京', status: 'success' },
  {
    id: 6,
    time: '2026-05-29 10:30:00',
    action: '导出实验数据',
    ip: '192.168.1.105',
    location: '北京',
    status: 'success',
  },
  {
    id: 7,
    time: '2026-05-28 14:55:12',
    action: '角色变更: 研究员→管理员',
    ip: '192.168.1.100',
    location: '内部网络',
    status: 'warning',
  },
];

export const MOCK_OPERATION_LOGS: OperationLog[] = [
  {
    id: 1,
    timestamp: '2026-05-31 15:23:41',
    operator: 'admin',
    action: '角色变更',
    target: 'researcher_01',
    details: '研究员→分析师',
    type: 'role_change',
  },
  {
    id: 2,
    timestamp: '2026-05-31 14:10:08',
    operator: 'admin',
    action: '批量启用',
    target: '3 个用户',
    details: '批量恢复已禁用账户',
    type: 'batch_op',
  },
  {
    id: 3,
    timestamp: '2026-05-31 11:45:22',
    operator: 'system',
    action: '异常登录检测',
    target: 'user_0042',
    details: '5分钟内多次登录失败',
    type: 'login_anomaly',
  },
  {
    id: 4,
    timestamp: '2026-05-30 17:30:00',
    operator: 'admin',
    action: '账户禁用',
    target: 'test_user',
    details: '长期未使用，自动禁用',
    type: 'status_toggle',
  },
  {
    id: 5,
    timestamp: '2026-05-30 09:15:33',
    operator: 'admin',
    action: '角色变更',
    target: 'new_hire',
    details: '访客→研究员',
    type: 'role_change',
  },
  {
    id: 6,
    timestamp: '2026-05-29 16:42:18',
    operator: 'system',
    action: '安全事件',
    target: 'IP: 203.0.113.45',
    details: '检测到异常地理位置登录尝试',
    type: 'security_event',
  },
];
