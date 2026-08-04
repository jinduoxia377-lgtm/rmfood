import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { adminApi } from '@/api/admin';
import { UserRole } from '@/types';
import { useAuthStore } from '@/stores/auth';
import {
  Search,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  MoreVertical,
  UserPlus,
  RefreshCw,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  Building2,
  CalendarDays,
  Phone,
  Check,
  X,
  AlertTriangle,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lock,
  Unlock,
  UserCog,
  FileText,
  Copy,
  Hash,
  Activity,
  Zap,
  Globe,
  KeyRound,
  Upload,
  History,
  Settings,
  ShieldQuestion,
  TrendingUp,
  LayoutGrid,
  List,
  BarChart3,
  PieChart as PieIcon,
  Terminal,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Calendar,
  MapPin,
  Cpu,
  Wifi,
  WifiOff,
  UserRoundPlus,
  Eye as EyeIcon,
} from 'lucide-react';
import {
  Button,
  Input,
  PageHeader,
  Badge,
  Card,
  CardContent,
  Modal,
  Select,
  Tooltip,
  Checkbox,
  Alert,
  AlertTitle,
  AlertDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { EmptyState, Skeleton, Pagination } from '@/components/ui/Common';
import { Progress } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/Toast';

const ROLE_CONFIG: Record<
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
    color: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
    icon: Shield,
    description: '拥有所有权限',
    bgColor: 'bg-error-50 dark:bg-red-950/30',
    chartColor: 'var(--color-error, #FF3B30)',
  },
  [UserRole.MANAGER]: {
    label: '管理员',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    icon: ShieldCheck,
    description: '管理用户和内容审核',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    chartColor: 'var(--color-orange-500, #EA580C)',
  },
  [UserRole.RESEARCHER]: {
    label: '研究员',
    color: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400',
    icon: Users,
    description: '配方研发人员',
    bgColor: 'bg-secondary-50 dark:bg-blue-950/30',
    chartColor: 'var(--color-secondary, #0A84FF)',
  },
  [UserRole.ANALYST]: {
    label: '分析师',
    color: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
    icon: Filter,
    description: '数据分析与评估',
    bgColor: 'bg-accent-50 dark:bg-purple-950/30',
    chartColor: 'var(--color-purple-500, #A855F7)',
  },
  [UserRole.VIEWER]: {
    label: '访客',
    color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    icon: Eye,
    description: '只读访问权限',
    bgColor: 'bg-slate-50 dark:bg-neutral-900/30',
    chartColor: 'var(--text-muted, #9A9A9F)',
  },
};

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '已禁用' },
];

const STATUS_CONFIG = {
  active: { label: '正常', variant: 'success' as const, icon: ShieldCheck, dotColor: 'bg-primary-500' },
  inactive: { label: '已禁用', variant: 'danger' as const, icon: ShieldAlert, dotColor: 'bg-error-500' },
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
];

const CHART_COLORS = ['var(--color-error, #FF3B30)', '#EA580C', 'var(--color-secondary, #0A84FF)', '#a855f7', 'var(--text-muted, #9A9A9F)'];

function resolveRoleKey(role: string | undefined): string {
  if (!role) return UserRole.VIEWER;
  const upper = role.toUpperCase();
  if (upper in ROLE_CONFIG) return upper;
  return UserRole.VIEWER;
}

function getRoleConfig(role: string | undefined) {
  return ROLE_CONFIG[resolveRoleKey(role)] || ROLE_CONFIG[UserRole.VIEWER];
}

type SortField = 'username' | 'full_name' | 'role' | 'created_at' | 'last_login';
type SortDirection = 'asc' | 'desc';

interface UserDetail {
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
}

interface ConfirmAction {
  type: 'status' | 'role' | 'batch_status' | 'batch_role' | 'delete' | 'batch_delete';
  userId?: number;
  userIds?: number[];
  currentValue?: string;
  newValue?: string;
  label: string;
  description: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'primary';
}

interface OperationLog {
  id: number;
  timestamp: string;
  operator: string;
  action: string;
  target: string;
  details: string;
  type: 'role_change' | 'status_toggle' | 'batch_op' | 'login_anomaly' | 'security_event';
}

interface ActivityRecord {
  id: number;
  time: string;
  action: string;
  ip: string;
  location: string;
  status: 'success' | 'failed' | 'warning';
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function formatTimeAgo(dateStr: string): string {
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

const MOCK_ACTIVITY_RECORDS: ActivityRecord[] = [
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

const MOCK_OPERATION_LOGS: OperationLog[] = [
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

export default function UserManagementPage() {
  const currentUser = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOpLogPanel, setShowOpLogPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTab, setDetailTab] = useState('info');
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: UserRole.VIEWER,
    department: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['admin-users', page, pageSize, search, roleFilter, statusFilter],
    queryFn: () =>
      adminApi.listUsers({
        page,
        page_size: pageSize,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => adminApi.updateUserRole(userId, role),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      const newRole = getRoleConfig(vars.role).label;
      toast.success(`角色已更新为「${newRole}」`);
    },
    onError: () => {
      toast.error('角色更新失败，请重试');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (userId: number) => adminApi.toggleUserStatus(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('用户状态已更新');
    },
    onError: () => {
      toast.error('状态切换失败，请重试');
    },
  });

  const batchRoleMutation = useMutation({
    mutationFn: ({ userIds, role }: { userIds: number[]; role: string }) =>
      Promise.all(userIds.map((id) => adminApi.updateUserRole(id, role))),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedIds(new Set());
      const newRole = getRoleConfig(vars.role).label;
      toast.success(`已将 ${vars.userIds.length} 个用户的角色更新为「${newRole}」`);
    },
    onError: () => {
      toast.error('批量角色更新失败，请重试');
    },
  });

  const batchStatusMutation = useMutation({
    mutationFn: (userIds: number[]) => Promise.all(userIds.map((id) => adminApi.toggleUserStatus(id))),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedIds(new Set());
      toast.success(`已更新 ${vars.length} 个用户的状态`);
    },
    onError: () => {
      toast.error('批量状态更新失败，请重试');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      adminApi.createUser({
        username: data.username,
        password: data.password,
        email: data.email,
        full_name: data.full_name || undefined,
        role: data.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', email: '', full_name: '', role: UserRole.VIEWER, department: '' });
      setCreateErrors({});
      toast.success('用户创建成功');
    },
    onError: () => {
      toast.error('用户创建失败，请检查输入信息后重试');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('用户已删除');
    },
    onError: () => {
      toast.error('删除用户失败，请重试');
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (userIds: number[]) => Promise.all(userIds.map((id) => adminApi.deleteUser(id))),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedIds(new Set());
      toast.success(`已成功删除 ${vars.length} 个用户`);
    },
    onError: () => {
      toast.error('批量删除失败，请重试');
    },
  });

  const total = data?.total ?? 0;
  const users = (data?.items ?? []) as unknown as UserDetail[];
  const totalPages = Math.ceil(total / pageSize);

  const sortedUsers = useMemo(() => {
    if (!users.length) return [];
    return [...users].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'username':
          cmp = a.username.localeCompare(b.username);
          break;
        case 'full_name':
          cmp = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'role':
          cmp = (a.role || '').localeCompare(b.role || '');
          break;
        case 'created_at':
          cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          break;
        case 'last_login':
          cmp = new Date(a.last_login || 0).getTime() - new Date(b.last_login || 0).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, sortField, sortDir]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'all') return sortedUsers;
    return sortedUsers.filter((u) => (statusFilter === 'active' ? u.is_active : !u.is_active));
  }, [sortedUsers, statusFilter]);

  const roleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    Object.keys(ROLE_CONFIG).forEach((k) => {
      stats[k] = 0;
    });
    users.forEach((u) => {
      const key = resolveRoleKey(u.role);
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }, [users]);

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.length - activeCount;
  const activeRate = users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0;

  const pieChartData = useMemo(
    () =>
      Object.entries(ROLE_CONFIG)
        .filter(([key]) => (roleStats[key] || 0) > 0)
        .map(([key, cfg]) => ({
          name: cfg.label,
          value: roleStats[key] || 0,
          color: cfg.chartColor,
        })),
    [roleStats],
  );

  const anomalyCount = MOCK_OPERATION_LOGS.filter(
    (l) => l.type === 'login_anomaly' || l.type === 'security_event',
  ).length;

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField],
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
  }, [selectedIds.size, filteredUsers]);

  const toggleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;
    switch (confirmAction.type) {
      case 'status':
        if (confirmAction.userId) statusMutation.mutate(confirmAction.userId);
        break;
      case 'role':
        if (confirmAction.userId && confirmAction.newValue)
          roleMutation.mutate({ userId: confirmAction.userId, role: confirmAction.newValue });
        break;
      case 'batch_status':
        if (confirmAction.userIds) batchStatusMutation.mutate(confirmAction.userIds);
        break;
      case 'batch_role':
        if (confirmAction.userIds && confirmAction.newValue)
          batchRoleMutation.mutate({ userIds: confirmAction.userIds, role: confirmAction.newValue });
        break;
      case 'delete':
        if (confirmAction.userId) deleteUserMutation.mutate(confirmAction.userId);
        break;
      case 'batch_delete':
        if (confirmAction.userIds) batchDeleteMutation.mutate(confirmAction.userIds);
        break;
    }
    setConfirmAction(null);
  }, [
    confirmAction,
    statusMutation,
    roleMutation,
    batchStatusMutation,
    batchRoleMutation,
    deleteUserMutation,
    batchDeleteMutation,
  ]);

  const requestStatusToggle = useCallback(
    (user: UserDetail) => {
      if (user.id === currentUser?.id) {
        toast.warning('不能修改自己的账户状态');
        return;
      }
      setConfirmAction({
        type: 'status',
        userId: user.id,
        label: user.is_active ? '禁用用户' : '启用用户',
        description: `确定要${user.is_active ? '禁用' : '启用'}用户「${user.username}」吗？${user.is_active ? '禁用后该用户将无法登录系统。' : ''}`,
        confirmLabel: user.is_active ? '确认禁用' : '确认启用',
        variant: user.is_active ? 'danger' : 'primary',
      });
    },
    [currentUser, toast],
  );

  const requestRoleChange = useCallback(
    (user: UserDetail, newRole: string) => {
      if (user.id === currentUser?.id && newRole !== user.role) {
        toast.warning('不能修改自己的角色');
        return;
      }
      const newRoleLabel = getRoleConfig(newRole).label;
      setConfirmAction({
        type: 'role',
        userId: user.id,
        currentValue: user.role,
        newValue: newRole,
        label: '更改角色',
        description: `确定要将用户「${user.username}」的角色从「${getRoleConfig(user.role).label}」更改为「${newRoleLabel}」吗？`,
        confirmLabel: '确认更改',
        variant: 'warning',
      });
    },
    [currentUser, toast],
  );

  const requestBatchStatusToggle = useCallback(
    (enable: boolean) => {
      if ([...selectedIds].includes(currentUser?.id ?? -1)) {
        toast.warning('批量操作中包含当前登录用户，已自动排除');
        const filtered = new Set(selectedIds);
        filtered.delete(currentUser?.id ?? -1);
        if (filtered.size === 0) return;
        setConfirmAction({
          type: 'batch_status',
          userIds: [...filtered],
          label: enable ? '批量启用' : '批量禁用',
          description: `确定要${enable ? '启用' : '禁用'}选中 ${filtered.size} 个用户吗？`,
          confirmLabel: enable ? '确认启用' : '确认禁用',
          variant: enable ? 'primary' : 'danger',
        });
        return;
      }
      setConfirmAction({
        type: 'batch_status',
        userIds: [...selectedIds],
        label: enable ? '批量启用' : '批量禁用',
        description: `确定要${enable ? '启用' : '禁用'}选中 ${selectedIds.size} 个用户吗？`,
        confirmLabel: enable ? '确认启用' : '确认禁用',
        variant: enable ? 'primary' : 'danger',
      });
    },
    [selectedIds, currentUser, toast],
  );

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!createForm.username.trim()) errors.username = '用户名不能为空';
    else if (!/^[a-zA-Z0-9_]{3,50}$/.test(createForm.username))
      errors.username = '用户名需3-50位，仅允许字母、数字、下划线';
    if (!createForm.password) errors.password = '密码不能为空';
    else if (createForm.password.length < 6) errors.password = '密码至少6个字符';
    if (!createForm.email.trim()) errors.email = '邮箱不能为空';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = '请输入有效的邮箱地址';
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = useCallback(() => {
    if (!validateCreateForm()) return;
    createUserMutation.mutate(createForm);
  }, [createForm, createUserMutation]);

  const requestDeleteUser = useCallback(
    (user: UserDetail) => {
      if (user.id === currentUser?.id) {
        toast.warning('不能删除自己的账户');
        return;
      }
      setConfirmAction({
        type: 'delete',
        userId: user.id,
        label: '删除用户',
        description: `确定要删除用户「${user.username}」吗？此操作将停用该账户，删除后数据不可恢复。`,
        confirmLabel: '确认删除',
        variant: 'danger',
      });
    },
    [currentUser, toast],
  );

  const requestBatchDelete = useCallback(() => {
    let ids = [...selectedIds];
    if (ids.includes(currentUser?.id ?? -1)) {
      toast.warning('批量操作中包含当前登录用户，已自动排除');
      ids = ids.filter((id) => id !== currentUser?.id);
      if (ids.length === 0) return;
    }
    setConfirmAction({
      type: 'batch_delete',
      userIds: ids,
      label: '批量删除用户',
      description: `确定要删除选中 ${ids.length} 个用户吗？此操作将停用这些账户，删除后数据不可恢复。`,
      confirmLabel: `确认删除 (${ids.length})`,
      variant: 'danger',
    });
  }, [selectedIds, currentUser, toast]);

  const exportToCSV = useCallback(() => {
    const headers = ['用户名', '姓名', '邮箱', '角色', '状态', '部门', '注册时间', '最后登录'];
    const rows = filteredUsers.map((u) => [
      u.username,
      u.full_name || '',
      u.email || '',
      getRoleConfig(u.role).label,
      u.is_active ? '正常' : '已禁用',
      u.department || '',
      u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '',
      u.last_login ? new Date(u.last_login).toLocaleDateString('zh-CN') : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filteredUsers.length} 条用户数据`);
  }, [filteredUsers, toast]);

  const handleCSVImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const lines = text
            .split('\n')
            .filter((l) => l.trim())
            .slice(1);
          if (lines.length === 0) {
            toast.error('CSV 文件中没有有效数据行');
            return;
          }
          toast.success(`已解析 ${lines.length} 条记录（预览模式，实际导入需后端支持）`);
          setShowImportModal(false);
        } catch {
          toast.error('CSV 解析失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [toast],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          toggleSelectAll();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleSelectAll]);

  const SortIcon = ({ field }: { field: SortField }) => (
    <span
      className={`inline-flex ml-0.5 ${sortField === field ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-300 dark:text-neutral-600'}`}
    >
      {sortField === field && sortDir === 'desc' ? (
        <ChevronDown className="w-3 h-3" />
      ) : sortField === field && sortDir === 'asc' ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronUp className="w-3 h-3 opacity-0" />
      )}
    </span>
  );

  const isMutating =
    roleMutation.isPending ||
    statusMutation.isPending ||
    batchRoleMutation.isPending ||
    batchStatusMutation.isPending ||
    createUserMutation.isPending ||
    deleteUserMutation.isPending ||
    batchDeleteMutation.isPending;
  const cellPadding = tableDensity === 'compact' ? 'px-4 py-2.5' : 'px-4 py-3';
  const textSize = tableDensity === 'compact' ? 'text-xs' : 'text-sm';

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="max-w-[1520px] mx-auto space-y-8 px-4 lg:px-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="用户管理"
        description={
          <span className="inline-flex items-center gap-3 leading-relaxed">
            <span>
              共<strong className="font-semibold text-neutral-900 dark:text-white">{total}</strong> 位注册用户
            </span>
            {isFetching && !isLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
                <RefreshCw className="w-3 h-3 animate-spin" /> 同步中...{' '}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <span className="mr-1 px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium animate-pulse">
                已选 {selectedIds.size}
              </span>
            )}
            <Button
              variant={'primary'}
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-200 h-8 px-3 inline-flex items-center"
            >
              <UserRoundPlus className="w-[15px] h-[15px] mr-1.5 shrink-0" /> 新增用户
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="hover:shadow-sm active:scale-[0.97] transition-all duration-200 h-8 px-2.5 inline-flex items-center"
            >
              <Upload className="w-[15px] h-[15px] mr-1.5 shrink-0" /> 导入
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={filteredUsers.length === 0}
              className="hover:shadow-sm active:scale-[0.97] transition-all duration-200 h-8 px-2.5 inline-flex items-center"
            >
              <Download className="w-[15px] h-[15px] mr-1.5 shrink-0" /> 导出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
              disabled={isFetching}
              className="hover:shadow-sm active:scale-[0.97] transition-all duration-200 h-8 px-2.5 inline-flex items-center"
            >
              <RefreshCw className={`w-[15px] h-[15px] mr-1.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} /> 刷新
            </Button>
            <Button
              variant={showOpLogPanel ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowOpLogPanel(!showOpLogPanel)}
              className={`h-8 px-2.5 inline-flex items-center${anomalyCount > 0 ? ' relative animate-pulse' : ''}`}
            >
              <Terminal className="w-[15px] h-[15px] mr-1.5 shrink-0" />
              操作日志
              {anomalyCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-error-500 text-white text-[10px] font-semibold rounded-full shadow-sm px-1 leading-none flex items-center justify-center">
                  {anomalyCount}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* ── Data Visualization Dashboard ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-emerald-500 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 dark:from-emerald-900/50 dark:via-emerald-900/30 dark:to-teal-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">活跃用户</span>
              </div>
              <Badge variant="success" size="sm">
                +{activeCount}
              </Badge>
            </div>
            <p className="text-[28px] font-bold bg-gradient-to-r bg-clip-text text-transparent from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 tabular-nums tracking-tight">
              {activeCount}
            </p>
            <Progress value={activeRate} max={100} variant="success" size="sm" className="mt-3" />
            <p className="text-xs text-neutral-400 mt-1.5 font-medium">活跃率 {activeRate}%</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-red-500 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 via-red-50 to-orange-50 dark:from-red-900/50 dark:via-red-900/30 dark:to-orange-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <ShieldAlert className="w-4.5 h-4.5 text-error-600 dark:text-error-400" />
                </div>
                <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">已禁用</span>
              </div>
              <Badge variant="danger" size="sm">
                {inactiveCount}
              </Badge>
            </div>
            <p className="text-[28px] font-bold bg-gradient-to-r bg-clip-text text-transparent from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 tabular-nums tracking-tight">
              {inactiveCount}
            </p>
            <Progress
              value={users.length > 0 ? Math.round((inactiveCount / users.length) * 100) : 0}
              max={100}
              variant={'danger'}
              size="sm"
              className="mt-3"
            />
            <p className="text-xs text-neutral-400 mt-1.5 font-medium">
              占比 {users.length > 0 ? Math.round((inactiveCount / users.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2 group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 via-indigo-50 to-violet-50 dark:from-blue-900/50 dark:via-indigo-900/30 dark:to-violet-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <PieIcon className="w-4.5 h-4.5 text-secondary-600 dark:text-secondary-400" />
                </div>
                <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">角色分布</span>
              </div>
              <span className="text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full font-medium">
                共 {users.length} 人
              </span>
            </div>
            {pieChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={180} height={150}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={4}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      label={CustomPieLabel}
                      labelLine={false}
                      isAnimationActive
                    >
                      {pieChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: 'none',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 min-w-0">
                  {pieChartData.map((entry) => {
                    const pct = users.length > 0 ? ((entry.value / users.length) * 100).toFixed(0) : '0';
                    return (
                      <div key={entry.name} className="flex items-center gap-2 text-[13px]">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-neutral-600 dark:text-neutral-400 truncate">{entry.name}</span>
                        <span className="font-semibold tabular-nums text-neutral-900 dark:text-white ml-auto">
                          {entry.value}
                        </span>
                        <span className="text-neutral-400 tabular-nums">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-neutral-300 dark:text-neutral-600 text-sm">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Operation Log Panel (Collapsible) ── */}
      {showOpLogPanel && (
        <Card className="overflow-hidden border-primary-200 dark:border-primary-800 animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg ring-1 ring-primary-100 dark:ring-primary-900/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                  <History className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
                </div>
                操作日志与安全监控{' '}
                {anomalyCount > 0 && (
                  <Badge variant="danger" size="sm" className="ml-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {anomalyCount} 条异常{' '}
                  </Badge>
                )}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowOpLogPanel(false)}>
                收起 <ChevronUp className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {MOCK_OPERATION_LOGS.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg text-xs ${
                    log.type === 'login_anomaly' || log.type === 'security_event'
                      ? 'bg-error-50 dark:bg-error-900/10 border border-red-200 dark:border-red-800/30'
                      : log.type === 'batch_op'
                        ? 'bg-warning-50 dark:bg-warning-900/10 border border-amber-200 dark:border-amber-800/30'
                        : 'bg-slate-50 dark:bg-neutral-800/50'
                  }`}
                >
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      log.type === 'role_change'
                        ? 'bg-accent-100 text-accent-600'
                        : log.type === 'status_toggle'
                          ? 'bg-neutral-200 text-neutral-600'
                          : log.type === 'batch_op'
                            ? 'bg-warning-100 text-warning-600'
                            : log.type === 'login_anomaly'
                              ? 'bg-error-100 text-error-600'
                              : 'bg-error-100 text-error-600'
                    }`}
                  >
                    {log.type === 'role_change' ? (
                      <UserCog className="w-3.5 h-3.5" />
                    ) : log.type === 'status_toggle' ? (
                      <ShieldQuestion className="w-3.5 h-3.5" />
                    ) : log.type === 'batch_op' ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{log.action}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-500 truncate">{log.target}</span>
                    </div>
                    <p className="text-neutral-400 mt-0.5 truncate">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {log.timestamp}
                      <span className="text-neutral-300">|</span>
                      <span className="font-mono">{log.operator}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Left Sidebar: Filters ── */}
        <Card className="lg:col-span-1 transition-all duration-300 hover:shadow-md shadow-md border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                </div>
                筛选条件{' '}
              </h3>
              {(roleFilter !== 'all' || statusFilter !== 'all' || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-neutral-500 hover:text-danger-600"
                  onClick={() => {
                    setRoleFilter('all');
                    setStatusFilter('all');
                    setSearchInput('');
                    setPage(1);
                  }}
                >
                  清除全部
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-neutral-500">搜索</label>
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="用户名、姓名、邮箱..."
                prefix={<Search size={14} className="text-neutral-400" />}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">角色</label>
              <Select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                size="sm"
              >
                <option value="all">全部角色</option>
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">状态</label>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                size="sm"
              >
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <p className="text-[13px] font-medium text-neutral-500">显示设置</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500">每页数量</label>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  size="sm"
                >
                  {PAGE_SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTableDensity('comfortable')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tableDensity === 'comfortable'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> 舒适{' '}
                </button>
                <button
                  onClick={() => setTableDensity('compact')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tableDensity === 'compact'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> 紧凑
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2.5">统计概览</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
                    <span className="w-2 h-2 rounded-full bg-primary-500" /> 正常
                  </span>
                  <span className="font-semibold tabular-nums">{activeCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-error-500 dark:text-error-400">
                    <span className="w-2 h-2 rounded-full bg-error-500" /> 已禁用
                  </span>
                  <span className="font-semibold tabular-nums">{inactiveCount}</span>
                </div>
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 truncate">
                      <cfg.icon className="w-3.5 h-3.5 shrink-0" /> {cfg.label}
                    </span>
                    <span className="font-medium tabular-nums">{roleStats[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono">Ctrl+A</kbd>{' '}
                全选 · 点击用户名查看详情{' '}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Table Area ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <Alert className="rounded-xl border-primary-200 bg-gradient-to-r from-primary-50/80 to-blue-50/60 dark:border-primary-800 dark:from-primary-950/30 dark:to-blue-950/20 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-sm">
              <Check className="w-4 h-4 text-primary-600" />
              <AlertTitle className="text-sm font-medium">
                已选择 <strong className="text-primary-700 dark:text-primary-300">{selectedIds.size}</strong> 个用户
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2 mt-2">
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      setConfirmAction({
                        type: 'batch_role',
                        userIds: [...selectedIds],
                        newValue: e.target.value,
                        label: '批量更改角色',
                        description: `确定要将选中 ${selectedIds.size} 个用户的角色更改为「${getRoleConfig(e.target.value).label}」吗？`,
                        confirmLabel: '确认更改',
                        variant: 'warning',
                      });
                  }}
                  size="sm"
                  className="w-auto min-w-[120px]"
                >
                  <option value="" disabled>
                    批量改角色
                  </option>
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-primary-600 border-emerald-200 hover:bg-primary-50 dark:border-emerald-800 dark:hover:bg-primary-900/20"
                  onClick={() => requestBatchStatusToggle(true)}
                  disabled={batchStatusMutation.isPending}
                >
                  <Unlock className="w-3.5 h-3.5 mr-1" /> 批量启用
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-error-600 border-red-200 hover:bg-error-50 dark:border-red-800 dark:hover:bg-error-900/20"
                  onClick={() => requestBatchStatusToggle(false)}
                  disabled={batchStatusMutation.isPending}
                >
                  <Lock className="w-3.5 h-3.5 mr-1" /> 批量禁用
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-error-600 border-red-200 hover:bg-error-50 dark:border-red-800 dark:hover:bg-error-900/20"
                  onClick={() => requestBatchDelete()}
                  disabled={batchDeleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 批量删除
                </Button>
                <Button size="sm" variant="ghost" className="text-neutral-500" onClick={() => setSelectedIds(new Set())}>
                  取消选择
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="danger">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription className="flex items-center gap-2 mt-1.5">
                <span>无法获取用户数据，请检查网络连接后重试</span>
                <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> 重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Table Card */}
          <Card
            className="transition-all duration-300 hover:shadow-xl shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/40 overflow-visible"
            id="user-table-card"
          >
            {isLoading ? (
              <div className={`p-6 space-y-${tableDensity === 'compact' ? '2' : '3'}`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className={`h-${tableDensity === 'compact' ? '10' : '14'} w-full rounded-lg`} />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16">
                <EmptyState
                  title={search || roleFilter !== 'all' || statusFilter !== 'all' ? '没有匹配的用户' : '暂无用户'}
                  description={
                    search || roleFilter !== 'all' || statusFilter !== 'all'
                      ? '尝试调整搜索关键词或筛选条件'
                      : '系统中还没有注册用户'
                  }
                  action={
                    !search && roleFilter === 'all' && statusFilter === 'all' ? (
                      <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
                        <UserPlus className="w-4 h-4 mr-1.5" /> 导入用户
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                <div className="overflow-visible">
                  <table className={`w-full ${textSize}`} role="table" aria-label="用户列表">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-neutral-800/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-700 text-[13px] uppercase">
                      <tr>
                        <th className={`w-10 ${cellPadding}`}>
                          <Checkbox
                            checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredUsers.length}
                            onChange={toggleSelectAll}
                            aria-label="全选"
                          />
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors group`}
                          onClick={() => handleSort('username')}
                        >
                          <span className="inline-flex items-center">
                            用户名
                            <SortIcon field="username" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors hidden sm:table-cell`}
                          onClick={() => handleSort('full_name')}
                        >
                          <span className="inline-flex items-center">
                            姓名 <SortIcon field="full_name" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-neutral-600 dark:text-neutral-400 hidden md:table-cell`}
                        >
                          邮箱
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors`}
                          onClick={() => handleSort('role')}
                        >
                          <span className="inline-flex items-center justify-center">
                            角色 <SortIcon field="role" />
                          </span>
                        </th>
                        <th className={`${cellPadding} text-center font-semibold text-neutral-600 dark:text-neutral-400`}>
                          状态
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-neutral-600 dark:text-neutral-400 hidden xl:table-cell cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors`}
                          onClick={() => handleSort('created_at')}
                        >
                          <span className="inline-flex items-center justify-center">
                            注册时间 <SortIcon field="created_at" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-neutral-600 dark:text-neutral-400 w-20`}
                        >
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredUsers.map((user, idx) => {
                        const roleCfg = getRoleConfig(user.role);
                        const RoleIcon = roleCfg.icon;
                        const statusKey = user.is_active ? ('active' as const) : ('inactive' as const);
                        const statusCfg = STATUS_CONFIG[statusKey];
                        const StatusIcon = statusCfg.icon;
                        const isSelected = selectedIds.has(user.id);
                        const isSelf = user.id === currentUser?.id;
                        const showMenu = actionMenuId === user.id;
                        const hasAnomaly = (user.login_attempts ?? 0) >= 3;

                        return (
                          <tr
                            key={user.id}
                            className={`group animate-in fade-in slide-in-from-4 duration-300 fill-mode-both hover:[&]:bg-slate-50/90 dark:hover:bg-neutral-800/50 [&]:transition-colors [&]:duration-150 ${
                              isSelected
                                ? 'bg-primary-50/60 dark:bg-primary-950/20 ring-1 ring-primary-200 dark:ring-primary-800'
                                : ''
                            }`}
                            style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                          >
                            <td className={cellPadding}>
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleSelectOne(user.id)}
                                aria-label={`选择用户 ${user.username}`}
                              />
                            </td>
                            <td className={cellPadding}>
                              <button
                                className="flex items-center gap-2.5 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 active:scale-[0.98] rounded-lg p-1 -m-1 hover:shadow-sm hover:bg-neutral-100/80 dark:hover:bg-neutral-700/30"
                                onClick={() => {
                                  setDetailUser(user);
                                  setDetailTab('info');
                                }}
                              >
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm shrink-0 ring-1 ring-white dark:ring-slate-700 ${roleCfg.color}`}
                                >
                                  {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-neutral-900 dark:text-white truncate max-w-[140px]">
                                    {user.username}
                                    {isSelf && (
                                      <Badge size="sm" className="ml-1.5 font-normal">
                                        你
                                      </Badge>
                                    )}
                                    {hasAnomaly && <AlertTriangle className="w-3 h-3 ml-1 inline text-warning-500" />}
                                  </p>
                                  <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate max-w-[140px]">
                                    ID: {user.id}
                                  </p>
                                </div>
                              </button>
                            </td>
                            <td className={`${cellPadding} text-neutral-600 dark:text-neutral-300 hidden sm:table-cell`}>
                              <span className="truncate block max-w-[100px]">
                                {user.full_name || (
                                  <span className="text-neutral-300 dark:text-neutral-600 italic">未设置</span>
                                )}
                              </span>
                            </td>
                            <td className={`${cellPadding} hidden md:table-cell`}>
                              {user.email ? (
                                <a
                                  href={`mailto:${user.email}`}
                                  className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-primary-600 transition-colors truncate max-w-[180px]"
                                  title={user.email}
                                >
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{user.email}</span>
                                </a>
                              ) : (
                                <span className="text-neutral-300 dark:text-neutral-600 italic text-xs">-</span>
                              )}
                            </td>
                            <td className={`${cellPadding} text-center`}>
                              <button
                                onClick={() =>
                                  !isSelf &&
                                  requestRoleChange(
                                    user,
                                    user.role === UserRole.ADMIN ? UserRole.MANAGER : UserRole.ADMIN,
                                  )
                                }
                                disabled={isSelf}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer transition-all duration-200 hover:shadow-sm focus:ring-2 focus:ring-offset-1 ${roleCfg.color} ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={`${roleCfg.description}${isSelf ? '（不可修改）' : ''}`}
                              >
                                <RoleIcon className="w-3.5 h-3.5" />
                                {roleCfg.label}
                              </button>
                            </td>
                            <td className={`${cellPadding} text-center`}>
                              <Badge variant={statusCfg.variant} size="sm" className="cursor-default font-medium">
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusCfg.dotColor}`} />
                                {statusCfg.label}
                              </Badge>
                            </td>
                            <td
                              className={`${cellPadding} text-center text-neutral-500 dark:text-neutral-400 hidden xl:table-cell`}
                            >
                              {user.created_at ? (
                                <span className="tabular-nums text-xs">
                                  {new Date(user.created_at).toLocaleDateString('zh-CN')}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className={`${cellPadding} text-center`}>
                              <div className="relative inline-block" ref={showMenu ? actionMenuRef : undefined}>
                                <button
                                  onClick={() => setActionMenuId(showMenu ? null : user.id)}
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                  aria-label={`${user.username} 的操作菜单`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMenu && (
                                  <div
                                    className="absolute right-0 w-44 bg-white dark:bg-neutral-800 rounded-lg shadow-lg shadow-black/10 border border-neutral-200/80 dark:border-neutral-700 py-1 z-[60] animate-in fade-in duration-150 origin-top-right min-w-[176px]"
                                    style={{
                                      top: 'calc(100% + 6px)',
                                      maxHeight: 'none',
                                    }}
                                  >
                                    <div className="absolute -top-1.5 right-3 w-2.5 h-2.5 bg-white dark:bg-neutral-800 border-l border-t border-neutral-200 dark:border-neutral-700 rotate-45 shadow-sm" />
                                    <button
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                      onClick={() => {
                                        setDetailUser(user);
                                        setDetailTab('info');
                                        setActionMenuId(null);
                                      }}
                                    >
                                      <FileText className="w-4 h-4 text-neutral-400" /> 查看详情
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-700/50 transition-colors"
                                      onClick={() => {
                                        requestRoleChange(
                                          user,
                                          user.role === UserRole.ADMIN ? UserRole.MANAGER : UserRole.ADMIN,
                                        );
                                        setActionMenuId(null);
                                      }}
                                      disabled={isSelf}
                                    >
                                      <UserCog className="w-4 h-4 text-neutral-400" /> 更改角色
                                    </button>
                                    <div className="my-1 mx-3 border-t border-neutral-100 dark:border-neutral-700" />
                                    <button
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                                        user.is_active
                                          ? 'text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20'
                                          : 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                                      }`}
                                      onClick={() => {
                                        requestStatusToggle(user);
                                        setActionMenuId(null);
                                      }}
                                      disabled={isSelf}
                                    >
                                      {user.is_active ? (
                                        <>
                                          <EyeOff className="w-4 h-4" /> 禁用账户
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-4 h-4" /> 启用账户
                                        </>
                                      )}
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                                      onClick={() => {
                                        requestDeleteUser(user);
                                        setActionMenuId(null);
                                      }}
                                      disabled={isSelf}
                                    >
                                      <Trash2 className="w-4 h-4" /> 删除用户
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div
                    className={`px-6 ${tableDensity === 'compact' ? 'py-3' : 'py-4'} border-t border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-50/80 dark:from-slate-800/50 dark:to-slate-800/30`}
                  >
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      显示第
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {(page - 1) * pageSize + 1}
                      </span>
                      -
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {Math.min(page * pageSize, total)}
                      </span>{' '}
                      条，共<span className="font-medium text-neutral-700 dark:text-neutral-300">{total}</span> 条{' '}
                    </p>
                    <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── Detail Modal (Tabbed) ── */}
      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title="用户详情" size="lg">
        {detailUser &&
          (() => {
            const roleCfg = getRoleConfig(detailUser.role);
            const RoleIcon = roleCfg.icon;
            const statusKey = detailUser.is_active ? ('active' as const) : ('inactive' as const);
            const statusCfg = STATUS_CONFIG[statusKey];
            const StatusIcon = statusCfg.icon;
            const isSelf = detailUser.id === currentUser?.id;

            return (
              <Tabs defaultValue="info" value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="mb-1">
                  <TabsTrigger value="info" icon={<FileText className="w-3.5 h-3.5" />}>
                    基本信息
                  </TabsTrigger>
                  <TabsTrigger value="permissions" icon={<Shield className="w-3.5 h-3.5" />}>
                    权限管理
                  </TabsTrigger>
                  <TabsTrigger value="activity" icon={<Activity className="w-3.5 h-3.5" />}>
                    活动历史
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Basic Info */}
                <TabsContent value="info">
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg ring-2 ring-white dark:ring-slate-700 ${roleCfg.color}`}
                      >
                        {(detailUser.full_name || detailUser.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                          {detailUser.username}
                          {isSelf && <Badge size="sm">当前用户</Badge>}
                          {(detailUser.login_attempts ?? 0) >= 3 && (
                            <Tooltip content="存在异常登录行为">
                              <AlertTriangle className="w-4 h-4 text-warning-500" />
                            </Tooltip>
                          )}
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {detailUser.full_name || '未设置姓名'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={statusCfg.variant}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleCfg.color}`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {roleCfg.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: Hash, label: '用户 ID', value: String(detailUser.id) },
                        { icon: Mail, label: '邮箱', value: detailUser.email || '未设置' },
                        { icon: Phone, label: '电话', value: detailUser.phone || '未设置' },
                        { icon: Building2, label: '部门', value: detailUser.department || '未分配' },
                        {
                          icon: CalendarDays,
                          label: '注册时间',
                          value: detailUser.created_at ? new Date(detailUser.created_at).toLocaleString('zh-CN') : '-',
                        },
                        {
                          icon: Activity,
                          label: '最后登录',
                          value: detailUser.last_login ? formatTimeAgo(detailUser.last_login) : '从未登录',
                        },
                        {
                          icon: KeyRound,
                          label: '登录尝试',
                          value: String(detailUser.login_attempts ?? 0),
                          highlight: (detailUser.login_attempts ?? 0) >= 3,
                        },
                        { icon: Globe, label: '头像', value: detailUser.avatar_url ? '已设置' : '未设置' },
                      ].map(({ icon: Icon, label, value, highlight }) => (
                        <div
                          key={label}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg ${highlight ? 'bg-warning-50 dark:bg-warning-900/10 border border-amber-200 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-neutral-800/50'}`}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-warning-500' : 'text-neutral-400'}`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-400 dark:text-neutral-500">{label}</p>
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/30 -mx-6 -mb-6 px-6 py-4 rounded-b-xl flex items-center">
                      {!detailUser.is_active && !isSelf && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            requestStatusToggle(detailUser);
                            setDetailUser(null);
                          }}
                          disabled={statusMutation.isPending}
                        >
                          <Eye className="w-4 h-4 mr-1.5" /> 启用此账户{' '}
                        </Button>
                      )}
                      {detailUser.is_active && !isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-error-600 border-red-200 hover:bg-error-50 dark:border-red-800 dark:hover:bg-error-900/20"
                          onClick={() => {
                            requestStatusToggle(detailUser);
                            setDetailUser(null);
                          }}
                          disabled={statusMutation.isPending}
                        >
                          <EyeOff className="w-4 h-4 mr-1.5" /> 禁用此账户{' '}
                        </Button>
                      )}
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant={'danger'}
                          className="flex-1"
                          onClick={() => {
                            requestDeleteUser(detailUser);
                            setDetailUser(null);
                          }}
                          disabled={deleteUserMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" /> 删除用户
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setDetailUser(null)} className="flex-1">
                        关闭
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Permission Management */}
                <TabsContent value="permissions">
                  <div className="space-y-5">
                    <Alert>
                      <ShieldQuestion className="w-4 h-4" />
                      <AlertTitle>权限管理</AlertTitle>
                      <AlertDescription className="text-xs mt-1">
                        在此调整用户角色。不同角色拥有不同的系统访问权限和功能使用范围。{' '}
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">当前角色</h4>
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${roleCfg.bgColor} border ${roleCfg.color.split(' ')[0].replace('bg-', 'border-')}-200`}
                      >
                        <RoleIcon className="w-5 h-5" />
                        <span className="font-semibold">{roleCfg.label}</span>
                        <span className="text-xs opacity-70">（{roleCfg.description}）</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">更改角色</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ROLE_OPTIONS.filter((r) => r.value !== resolveRoleKey(detailUser.role)).map(
                          ({ value, label }) => {
                            const targetCfg = ROLE_CONFIG[value];
                            const TgtIcon = targetCfg?.icon;
                            return (
                              <button
                                key={value}
                                disabled={isSelf}
                                onClick={() => !isSelf && requestRoleChange(detailUser, value)}
                                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                                  isSelf
                                    ? 'opacity-40 cursor-not-allowed border-neutral-100 dark:border-neutral-700'
                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                                }`}
                              >
                                {TgtIcon && <TgtIcon className="w-5 h-5 text-neutral-500" />}
                                <div>
                                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</p>
                                  <p className="text-[11px] text-neutral-400">{targetCfg?.description}</p>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-700">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">权限说明</h4>
                      <div className="space-y-2">
                        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                          const isActive = resolveRoleKey(detailUser.role) === key;
                          const PermIcon = cfg.icon;
                          return (
                            <div
                              key={key}
                              className={`flex items-start gap-2.5 p-2 rounded-lg ${isActive ? 'bg-primary-50/50 dark:bg-primary-950/10 ring-1 ring-primary-200 dark:ring-primary-800' : ''}`}
                            >
                              <PermIcon
                                className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary-600' : 'text-neutral-400'}`}
                              />
                              <div>
                                <p
                                  className={`text-xs font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                  {cfg.label}
                                </p>
                                <p className="text-[11px] text-neutral-400">{cfg.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Activity History */}
                <TabsContent value="activity">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> 最近活动录{' '}
                      </h4>
                      <span className="text-xs text-neutral-400">最近 7 天</span>
                    </div>

                    <div className="relative pl-4 border-l-2 border-neutral-200/80 dark:border-neutral-700/60 space-y-0">
                      {MOCK_ACTIVITY_RECORDS.map((record, idx) => (
                        <div key={record.id} className="relative pb-4 last:pb-0">
                          <div
                            className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 shadow-sm background-white dark:bg-neutral-900 ${
                              record.status === 'success'
                                ? 'border-emerald-500 bg-primary-500'
                                : record.status === 'failed'
                                  ? 'border-red-500 bg-error-500'
                                  : 'border-amber-500 bg-warning-500'
                            }`}
                          />
                          <div className="pl-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-medium ${
                                  record.status === 'success'
                                    ? 'text-primary-600'
                                    : record.status === 'failed'
                                      ? 'text-error-600'
                                      : 'text-warning-600'
                                }`}
                              >
                                {record.action}
                              </span>
                              {record.status === 'failed' && <AlertTriangle className="w-3 h-3 text-error-500" />}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {record.time.split(' ')[0]}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {record.time.split(' ')[1]}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {record.location}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <Wifi className="w-3 h-3" />
                                {record.ip}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-700 grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-lg bg-primary-50 dark:bg-primary-900/10">
                        <p className="text-lg font-bold text-primary-600 tabular-nums">
                          {MOCK_ACTIVITY_RECORDS.filter((r) => r.status === 'success').length}
                        </p>
                        <p className="text-[11px] text-primary-600/70">成功操作</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-error-50 dark:bg-error-900/10">
                        <p className="text-lg font-bold text-error-600 tabular-nums">
                          {MOCK_ACTIVITY_RECORDS.filter((r) => r.status === 'failed').length}
                        </p>
                        <p className="text-[11px] text-error-600/70">失败操作</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-warning-50 dark:bg-warning-900/10">
                        <p className="text-lg font-bold text-warning-600 tabular-nums">
                          {formatTimeAgo(MOCK_ACTIVITY_RECORDS[0]?.time || '')}
                        </p>
                        <p className="text-[11px] text-warning-600/70">最近活动</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            );
          })()}
      </Modal>

      {/* ── Confirm Dialog ── */}
      <Modal
        open={!!confirmAction}
        onClose={() => !isMutating && setConfirmAction(null)}
        title={confirmAction?.label || ''}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{confirmAction.description}</p>
            {confirmAction.currentValue && confirmAction.newValue && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-neutral-800/50 text-sm">
                <span className="line-through text-neutral-400">{getRoleConfig(confirmAction.currentValue).label}</span>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
                <span className="font-medium text-primary-600 dark:text-primary-400">
                  {getRoleConfig(confirmAction.newValue).label}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant={confirmAction.variant === 'danger' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleConfirmAction}
                disabled={isMutating}
                className="flex-1"
              >
                {isMutating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> 处理中..
                  </>
                ) : (
                  confirmAction.confirmLabel
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmAction(null)}
                disabled={isMutating}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── CSV Import Modal ── */}
      <Modal open={showImportModal} onClose={() => setShowImportModal(false)} title="导入用户数据" size="md">
        <div className="space-y-4">
          <Alert>
            <Upload className="w-4 h-4" />
            <AlertTitle>CSV 格式导入</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              支持标准 CSV 格式文件。首行为标题行："用户名", "姓名, 邮箱, 角色, 部门
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl p-8 text-center hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} />
            <Upload className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              点击选择或拖拽 CSV 文件到此区域
            </p>
            <p className="text-xs text-neutral-400 mb-4">支持 .csv 格式，最大 5MB</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-1.5" /> 选择文件
            </Button>
          </div>

          <div className="text-xs text-neutral-400 space-y-1">
            <p className="font-medium text-neutral-500">CSV 格式示例：</p>
            <pre className="bg-slate-50 dark:bg-neutral-800/50 p-2.5 rounded-lg overflow-x-auto font-mono text-[11px] leading-relaxed">
              {`username,full_name,email,role,department
zhangsan,张三,zhang@example.com,researcher,研发部
lisi,李四,li@example.com,analyst,数据部`}
            </pre>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Create User Modal ── */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateErrors({});
        }}
        title="新增用户"
        size="md"
      >
        <div className="space-y-6">
          <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border-blue-200/60 dark:border-blue-800/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 flex items-center justify-center shadow-md ring-1 ring-white/50 shrink-0 mt-0.5">
                <UserRoundPlus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <AlertTitle className="text-sm">创建新用户账户</AlertTitle>
                <AlertDescription className="text-xs mt-1.5 leading-relaxed text-neutral-600 dark:text-neutral-400">
                  填写以下信息创建新的系统用户。
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">用户名</span>和
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">密码</span>为必填项。{' '}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                用户名<span className="text-error-500 ml-0.5">*</span>
              </label>
              <Input
                value={createForm.username}
                onChange={(e) => {
                  setCreateForm((prev) => ({ ...prev, username: e.target.value }));
                  setCreateErrors((prev) => {
                    const next = { ...prev };
                    delete next.username;
                    return next;
                  });
                }}
                placeholder="3-50位字母、数字或下划线"
                prefix={<Hash size={14} className="text-neutral-400" />}
                size="sm"
                error={!!createErrors.username}
                className="focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
              {createErrors.username && <p className="text-xs text-error-500 mt-1">{createErrors.username}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                密码 <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => {
                    setCreateForm((prev) => ({ ...prev, password: e.target.value }));
                    setCreateErrors((prev) => {
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                  }}
                  placeholder="至少6个字符"
                  prefix={<Lock size={14} className="text-neutral-400" />}
                  size="sm"
                  error={!!createErrors.password}
                  className="h-10 pr-9 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <EyeIcon size={14} />
                </button>
              </div>
              {createErrors.password && <p className="text-xs text-error-500 mt-1">{createErrors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                邮箱 <span className="text-error-500">*</span>
              </label>
              <Input
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }));
                  setCreateErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }}
                placeholder="user@example.com"
                prefix={<Mail size={14} className="text-neutral-400" />}
                size="sm"
                error={!!createErrors.email}
                className="h-10 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
              {createErrors.email && <p className="text-xs text-error-500 mt-1">{createErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">姓名</label>
              <Input
                value={createForm.full_name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="真实姓名（可选）"
                prefix={<UserCog size={14} className="text-neutral-400" />}
                size="sm"
                className="h-10 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">角色</label>
              <Select
                value={createForm.role}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                size="sm"
              >
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">部门</label>
              <Input
                value={createForm.department}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="所属部门（可选）"
                prefix={<Building2 size={14} className="text-neutral-400" />}
                size="sm"
                className="focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-700/30 border border-neutral-200/60 dark:border-neutral-700/40 rounded-xl p-3.5 ring-1 ring-slate-200/60 dark:ring-slate-700/40">
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                <Zap className="w-3 h-3" /> 提示：{' '}
              </span>
              新创建的用户默认状态为「正常」。创建后可随时在列表中修改角色或禁用账户。用户名仅支持英文字母、数字和下划线，密码长度至少6位。{' '}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant={'primary'}
              size="md"
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              className="flex-1 active:scale-[0.98] transition-transform h-11"
            >
              {createUserMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> 创建中...
                </>
              ) : (
                <>
                  <UserRoundPlus className="w-4 h-4 mr-1.5" /> 确认创建
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowCreateModal(false);
                setCreateErrors({});
                setCreateForm({
                  username: '',
                  password: '',
                  email: '',
                  full_name: '',
                  role: UserRole.VIEWER,
                  department: '',
                });
              }}
              disabled={createUserMutation.isPending}
              className="flex-1 h-11"
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
