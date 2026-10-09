import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRealtimeEntity, type CDCChangeEvent } from '@/hooks/useRealtimeSync';
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
  LineChart,
  Line,
} from 'recharts';
import { adminApi, type PreRegisterRequest, type PreRegisterStatus } from '@/api/admin';
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
import { ROLE_CONFIG, ROLE_OPTIONS, STATUS_OPTIONS, STATUS_CONFIG, PAGE_SIZE_OPTIONS, CHART_COLORS, resolveRoleKey, getRoleConfig, useDebounce, formatTimeAgo, SortField, SortDirection, UserDetail, ConfirmAction, OperationLog, ActivityRecord, MOCK_ACTIVITY_RECORDS, MOCK_OPERATION_LOGS } from './UserManagementHelpers'

export default function UserManagementPage() {
  const currentUser = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 350);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importErrorDetail, setImportErrorDetail] = useState<any[]>([]);
  const [showOpLogPanel, setShowOpLogPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // ── 账号申请（预注册）队列状态 ──
  const [preRegTab, setPreRegTab] = useState<PreRegisterStatus>('pending');
  const [preRegSearch, setPreRegSearch] = useState('');
  const [preRegPage, setPreRegPage] = useState(1);
  const [preRegPageSize] = useState(20);
  const [preRegDetail, setPreRegDetail] = useState<PreRegisterRequest | null>(null);
  const [preRegApproveForm, setPreRegApproveForm] = useState({ role: 'researcher', password: '' });
  const [preRegRejectReason, setPreRegRejectReason] = useState('');
  const [detailTab, setDetailTab] = useState('info');
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: UserRole.VIEWER,
    department: '',
    organization_id: null as number | null,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', full_name: '', phone: '', department: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['admin-users', page, pageSize, search, roleFilter, statusFilter, orgFilter],
    queryFn: () =>
      adminApi.listUsers({
        page,
        page_size: pageSize,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        organization_id: orgFilter || undefined,
      }),
  });
  const { data: auditLogData } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => adminApi.getAuditLogs({ page: 1, page_size: 50 }),
    enabled: showOpLogPanel,
  });

  const userActivityQuery = useQuery({
    queryKey: ['user-activity', detailUser?.id],
    queryFn: () => detailUser ? adminApi.getUserActivity(detailUser.id) : null,
    enabled: !!detailUser && detailTab === 'activity',
  });

  const { data: userTrendData } = useQuery({
    queryKey: ['user-trend'],
    queryFn: () => adminApi.getUserTrend(30),
    staleTime: 5 * 60 * 1000,
  });

  // MEDIUM #8+#14: Organization list from dedicated API endpoint
  const { data: orgListData } = useQuery({
    queryKey: ['orgs-for-users'],
    queryFn: () => adminApi.getOrganizations().then((r) => r.organizations || []),
    staleTime: 10 * 60 * 1000,
  });

  const registrationTrendChart = useMemo(() => {
    if (!userTrendData?.data || !Array.isArray(userTrendData.data)) return [];
    return userTrendData.data.slice(-14).map((d: any) => ({
      date: d.date || d.time || '',
      count: Number(d.count ?? d.value ?? d.total ?? 0),
    }));
  }, [userTrendData]);

  // ── 账号申请（预注册）队列 ──
  const { data: preRegData, isLoading: preRegLoading } = useQuery({
    queryKey: ['pre-register-requests', preRegTab, preRegPage, preRegSearch],
    queryFn: () =>
      adminApi.listPreRegisterRequests({
        page: preRegPage,
        page_size: preRegPageSize,
        status: preRegTab,
        search: preRegSearch || undefined,
      }),
  });
  const preRegItems = preRegData?.items ?? [];
  const preRegStatusCounts = preRegData?.status_counts ?? { pending: 0, approved: 0, rejected: 0 };

  const approvePreRegMutation = useMutation({
    mutationFn: (vars: { requestId: number; role?: string; password?: string }) =>
      adminApi.approvePreRegisterRequest(vars.requestId, {
        role: vars.role,
        password: vars.password || undefined,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        data.temp_password
          ? `账号已开通：${data.username}，临时密码 ${data.temp_password}（请转告用户首次登录修改）`
          : `账号已开通：${data.username}`,
      );
      setPreRegDetail(null);
      setPreRegApproveForm({ role: 'researcher', password: '' });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || '开通账号失败，请重试');
    },
  });

  const rejectPreRegMutation = useMutation({
    mutationFn: (vars: { requestId: number; reason?: string }) =>
      adminApi.rejectPreRegisterRequest(vars.requestId, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      toast.success('申请已拒绝');
      setPreRegDetail(null);
      setPreRegRejectReason('');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || '拒绝操作失败，请重试');
    },
  });

  const roleLabelMap: Record<string, string> = {
    guest: '访客',
    researcher: '研究员',
    formulator: '配方师',
    reviewer: '审核员',
    admin: '管理员',
  };
  const preRegStatusLabel: Record<PreRegisterStatus, string> = {
    pending: '待审核',
    approved: '已开通',
    rejected: '已拒绝',
  };
  const preRegStatusColor: Record<PreRegisterStatus, string> = {
    pending: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
    approved: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    rejected: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
  };

  // P3-5: CDC 实时通知 - 用户变更时显示 toast
  useRealtimeEntity('users', useCallback((change: CDCChangeEvent) => {
    const { action, entity_id } = change;
    if (action === 'INSERT') {
      toast.success(`新用户 #${entity_id} 已注册`);
    } else if (action === 'UPDATE') {
      toast.info(`用户 #${entity_id} 信息已更新`);
    } else if (action === 'DELETE') {
      toast.warning(`用户 #${entity_id} 已被禁用`);
    }
  }, [toast]));

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
        organization_id: data.organization_id || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', email: '', full_name: '', role: UserRole.VIEWER, department: '', organization_id: null });
      setCreateErrors({});
      toast.success('用户创建成功');
    },
    onError: () => {
      toast.error('用户创建失败，请检查输入信息后重试');
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (userId: number) => adminApi.toggleUserStatus(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('用户已禁用');
    },
    onError: () => {
      toast.error('禁用用户失败，请重试');
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (userIds: number[]) => Promise.all(userIds.map((id) => adminApi.toggleUserStatus(id))),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedIds(new Set());
      toast.success(`已成功禁用 ${vars.length} 个用户`);
    },
    onError: () => {
      toast.error('批量禁用失败，请重试');
    },
  });

  const editProfileMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Record<string, any> }) =>
      adminApi.updateUser(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      if (detailUser) qc.invalidateQueries({ queryKey: ['user-lock-status', detailUser.id] });
      setEditProfileOpen(false);
      toast.success('用户资料已更新');
    },
    onError: () => {
      toast.error('更新失败，请重试');
    },
  });

  // CRITICAL #1: lockStatus moved to component top-level (was inside Modal IIFE - Rules of Hooks violation)
  const { data: lockStatus } = useQuery({
    queryKey: ['user-lock-status', detailUser?.id],
    queryFn: () => detailUser ? adminApi.getAccountLockStatus(detailUser.id) : null,
    enabled: !!detailUser,
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
    let result = sortedUsers;
    // Apply server-side filters that also need client-side filtering for select-all consistency
    if (statusFilter !== 'all') {
      result = result.filter((u) => (statusFilter === 'active' ? u.is_active : !u.is_active));
    }
    if (orgFilter !== null) {
      result = result.filter((u) => (u as any).organization_id === orgFilter);
    }
    return result;
  }, [sortedUsers, statusFilter, orgFilter]);

  // 虚拟滚动：数据量大时启用
  const enableVirtualScroll = filteredUsers.length > 100;
  const rowVirtualizer = useVirtualizer({
    count: enableVirtualScroll ? filteredUsers.length : 0,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => tableDensity === 'compact' ? 40 : 56,
    overscan: 5,
    enabled: enableVirtualScroll,
  });

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

  const anomalyCount = useMemo(() => {
    if (auditLogData?.items) {
      return auditLogData.items.filter(
        (l: any) => l.action?.includes('login') || l.action?.includes('auth') || l.action?.includes('lock'),
      ).length;
    }
    return MOCK_OPERATION_LOGS.filter(
      (l) => l.type === 'login_anomaly' || l.type === 'security_event',
    ).length;
  }, [auditLogData]);

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

  const handleLogClick = useCallback((logId: number) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  }, []);

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
        if (confirmAction.userId) deactivateUserMutation.mutate(confirmAction.userId);
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
    deactivateUserMutation,
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

  const requestBatchRoleChange = useCallback(
    (userIds: number[]) => {
      if (userIds.includes(currentUser?.id ?? -1)) {
        toast.warning('批量操作中包含当前登录用户，已自动排除');
        const filtered = userIds.filter((id) => id !== currentUser?.id);
        if (filtered.length === 0) return;
        setConfirmAction({
          type: 'batch_role',
          userIds: filtered,
          newValue: UserRole.RESEARCHER,
          label: '批量更改角色',
          description: `确定要将选中 ${filtered.length} 个用户的角色更改为「研究员」吗？`,
          confirmLabel: '确认更改',
          variant: 'warning',
        });
        return;
      }
      setConfirmAction({
        type: 'batch_role',
        userIds,
        newValue: UserRole.RESEARCHER,
        label: '批量更改角色',
        description: `确定要将选中 ${userIds.length} 个用户的角色更改为「研究员」吗？`,
        confirmLabel: '确认更改',
        variant: 'warning',
      });
    },
    [currentUser, toast],
  );

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!createForm.username.trim()) errors.username = '用户名不能为空';
    else if (!/^[a-zA-Z0-9_]{3,50}$/.test(createForm.username))
      errors.username = '用户名需3-50位，仅允许字母、数字、下划线';
    if (!createForm.password) errors.password = '密码不能为空';
    else if (createForm.password.length < 8) errors.password = '密码至少8个字符';
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
        toast.warning('不能禁用自己的账户');
        return;
      }
      setConfirmAction({
        type: 'delete',
        userId: user.id,
        label: '禁用用户',
        description: `确定要禁用用户「${user.username}」吗？禁用后该用户将无法登录系统。`,
        confirmLabel: '确认禁用',
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
      label: '批量禁用用户',
      description: `确定要禁用选中 ${ids.length} 个用户吗？禁用后这些用户将无法登录系统。`,
      confirmLabel: `确认禁用 (${ids.length})`,
      variant: 'danger',
    });
  }, [selectedIds, currentUser, toast]);

  const exportToCSV = useCallback(async () => {
    // Export ALL matching users (not just current page) by fetching all pages
    const headers = ['用户名', '姓名', '邮箱', '角色', '状态', '部门', '注册时间', '最后登录'];
    const allRows: string[][] = [];
    const params: any = {
      search: search || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      organization_id: orgFilter || undefined,
    };
    try {
      let currentPage = 1;
      let total = Infinity;
      while (currentPage * 100 <= total || currentPage === 1) {
        const res: any = await adminApi.listUsers({ ...params, page: currentPage, page_size: 100 });
        const items = res.items || [];
        total = res.total ?? items.length;
        for (const u of items) {
          allRows.push([
            u.username, u.full_name || '', u.email || '',
            getRoleConfig(u.role).label, u.is_active ? '正常' : '已禁用',
            u.department || '',
            u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '',
            u.last_login ? new Date(u.last_login).toLocaleDateString('zh-CN') : '',
          ]);
        }
        if (currentPage * 100 >= total) break;
        currentPage++;
      }
    } catch {
      // Fallback: export current filteredUsers only
      allRows.push(...filteredUsers.map((u) => [
        u.username, u.full_name || '', u.email || '',
        getRoleConfig(u.role).label, u.is_active ? '正常' : '已禁用',
        u.department || '',
        u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '',
        u.last_login ? new Date(u.last_login).toLocaleDateString('zh-CN') : '',
      ]));
    }
    const csv = [headers.join(','), ...allRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${allRows.length} 条用户数据`);
  }, [filteredUsers, toast, search, roleFilter, statusFilter, orgFilter]);

  const handleCSVImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const result = await adminApi.batchImportUsers(file);
        toast.success(`导入完成: 成功 ${result.created} 个，跳过 ${result.skipped_duplicate} 个重复`);
        if (result.errors.length > 0) {
          setImportErrorDetail(result.errors);
          toast.warning(`有 ${result.errors.length} 条记录导入失败，点击查看明细`);
        }
        qc.invalidateQueries({ queryKey: ['admin-users'] });
        setShowImportModal(false);
      } catch {
        toast.error('导入失败，请检查文件格式后重试');
      }
      e.target.value = '';
    },
    [toast, qc],
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
      className={`inline-flex ml-0.5 ${sortField === field ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-300 dark:text-neutral-400'}`}
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
    deactivateUserMutation.isPending ||
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
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter">

      {/* ── 顶部主色横幅 ── */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">用户管理</h1>
            <p className="mt-1 text-white/90 text-sm">
              共 <strong className="text-white font-semibold">{total}</strong> 位注册用户
              {isFetching && !isLoading && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-white/80">
                  <RefreshCw className="w-3 h-3 animate-spin" />同步中…
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            {selectedIds.size > 0 && (
              <span className="px-3 py-1 rounded-full bg-white dark:bg-neutral-900/20 backdrop-blur-sm text-white text-xs font-medium">
                已选 {selectedIds.size}
              </span>
            )}
            <Button variant="glass" size="sm" icon={<UserRoundPlus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}>新增用户</Button>
            <Button variant="secondary" size="sm" icon={<Upload className="w-4 h-4" />}
              onClick={() => setShowImportModal(true)}>导入</Button>
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
              onClick={exportToCSV} disabled={filteredUsers.length === 0}>导出</Button>
            <Button variant="glass" size="sm" icon={<Terminal className="w-4 h-4" />}
              onClick={() => setShowOpLogPanel(!showOpLogPanel)}>
              操作日志
              {anomalyCount > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] bg-white dark:bg-neutral-800 text-primary-700 text-xs font-bold rounded-full flex items-center justify-center px-1">{anomalyCount}</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 账号申请待审核提醒横幅
          问题背景: "账号申请"队列模块位于本页最底部, 首屏无任何提示,
          管理员以为"用户管理看不到登录页提交的申请"。
          修复: pending>0 时在页首高亮提醒, 点击平滑滚动直达队列模块 (#prereg-queue)。 */}
      {preRegStatusCounts.pending > 0 && (
        <button
          type="button"
          onClick={() =>
            document.getElementById('prereg-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="w-full flex items-center gap-3 rounded-xl border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 px-5 py-3.5 text-left transition-colors hover:bg-warning-100/80 dark:hover:bg-warning-900/30"
        >
          <UserRoundPlus className="w-5 h-5 text-warning-600 dark:text-warning-700 shrink-0" />
          <span className="flex-1 text-sm text-warning-800 dark:text-warning-200">
            有 <strong className="font-bold">{preRegStatusCounts.pending}</strong> 条登录页提交的账号申请待审核
          </span>
          <span className="text-xs font-semibold text-warning-700 dark:text-warning-700">前往处理 →</span>
        </button>
      )}

      {/* ── Data Visualization Dashboard ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="overflow-hidden group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-emerald-500 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 dark:from-emerald-900/50 dark:via-emerald-900/30 dark:to-teal-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary-700 dark:text-primary-700" />
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
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1.5 font-medium">活跃率 {activeRate}%</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-red-500 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-100 via-red-50 to-orange-50 dark:from-red-900/50 dark:via-red-900/30 dark:to-orange-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <ShieldAlert className="w-4.5 h-4.5 text-error-600 dark:text-error-600" />
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
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1.5 font-medium">
              占比 {users.length > 0 ? Math.round((inactiveCount / users.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2 group cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 via-indigo-50 to-violet-50 dark:from-blue-900/50 dark:via-indigo-900/30 dark:to-violet-900/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <PieIcon className="w-4.5 h-4.5 text-secondary-600 dark:text-secondary-700" />
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
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] tabular-nums">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-neutral-300 dark:text-neutral-400 text-sm">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ── 用户注册趋势 ── */}
      {registrationTrendChart.length > 1 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                用户注册趋势
                <span className="text-xs font-normal text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">近 14 天</span>
              </h3>
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                总计 {registrationTrendChart.reduce((s: number, d: any) => s + d.count, 0)} 人
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={registrationTrendChart} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary, #0A84FF)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary, #0A84FF)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--text-muted, #9A9A9F)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted, #9A9A9F)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${value} 人`, '新增注册']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-primary, #0A84FF)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-primary, #0A84FF)' }}
                  activeDot={{ r: 5 }}
                  fill="url(#regGrad)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Operation Log Panel (Collapsible) ── */}
      {showOpLogPanel && (
        <Card className="overflow-hidden border-primary-200 dark:border-primary-800 animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg ring-1 ring-primary-100 dark:ring-primary-900/30">
          <CardContent className="p-6">
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
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {(auditLogData?.items?.length ? auditLogData.items : MOCK_OPERATION_LOGS).slice(0, 10).map((log: any) => (
                <div key={log.id}>
                  <div
                    onClick={() => handleLogClick(log.id)}
                    className={`flex items-start gap-3 p-2.5 rounded-lg text-xs cursor-pointer transition-all duration-150 hover:bg-primary-50 dark:hover:bg-primary-900/10 ${
                      log.type === 'login_anomaly' || log.type === 'security_event'
                        ? 'border border-red-200 dark:border-red-800/30'
                        : log.type === 'batch_op'
                          ? 'border border-amber-200 dark:border-amber-800/30'
                          : 'border border-transparent'
                    } ${expandedLogId === log.id ? 'bg-primary-50 dark:bg-primary-900/10 rounded-t-none' : ''}`}
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
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">{log.target || log.username || '系统'}</span>
                        <span className="ml-auto text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
                          {expandedLogId === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </span>
                      </div>
                      <p className="text-neutral-500 dark:text-neutral-400 mt-0.5 text-xs truncate">
                        {log.details || log.action}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        <Clock className="w-3 h-3" />
                        {log.created_at || log.timestamp}
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                        <span className="font-mono">{log.username || log.operator || '—'}</span>
                        {log.user_role && (
                          <>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                            <span className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs">{log.user_role}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedLogId === log.id && (
                    <div className="mx-2 mb-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
                      {log.entity_type && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">实体类型:</span>
                          <span className="font-mono text-neutral-700 dark:text-neutral-300">{log.entity_type}</span>
                        </div>
                      )}
                      {log.entity_id && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">实体ID:</span>
                          <span className="font-mono text-neutral-700 dark:text-neutral-300">{log.entity_id}</span>
                        </div>
                      )}
                      {log.ip_address && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">IP地址:</span>
                          <span className="font-mono text-neutral-700 dark:text-neutral-300">{log.ip_address}</span>
                        </div>
                      )}
                      {log.details && typeof log.details === 'string' && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">详情:</span>
                          <span className="text-neutral-600 dark:text-neutral-400 break-all">{log.details}</span>
                        </div>
                      )}
                      {log.details && typeof log.details === 'object' && (
                        <pre className="mt-1 p-2 rounded bg-white dark:bg-neutral-900 font-mono text-xs overflow-x-auto text-neutral-600 dark:text-neutral-400">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Left Sidebar: Filters ── */}
        <Card className="lg:col-span-1 transition-all duration-300 hover:shadow-md shadow-md border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-primary-700 dark:text-primary-700" />
                </div>
                筛选条件{' '}
              </h3>
              {(roleFilter !== 'all' || statusFilter !== 'all' || orgFilter !== null || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-danger-600"
                  onClick={() => {
                    setRoleFilter('all');
                    setStatusFilter('all');
                    setOrgFilter(null);
                    setSearchInput('');
                    setPage(1);
                  }}
                >
                  清除全部
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">搜索</label>
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="用户名、姓名、邮箱..."
                prefix={<Search size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">角色</label>
              <Select
                value={roleFilter}
                onChange={(v) => {
                  setRoleFilter(v);
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
              <label className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">状态</label>
              <Select
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
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

            {/* P3-4: 组织筛选 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">组织</label>
              <Select
                value={orgFilter !== null ? String(orgFilter) : 'all'}
                onChange={(v) => {
                  setOrgFilter(v === 'all' ? null : Number(v));
                  setPage(1);
                }}
                size="sm"
              >
                <option value="all">全部组织</option>
                {orgListData?.map((org: { id: number; name: string }) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <p className="text-[13px] font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">显示设置</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">每页数量</label>
                <Select
                  value={String(pageSize)}
                  onChange={(v) => {
                    setPageSize(Number(v));
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
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-700'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> 舒适{' '}
                </button>
                <button
                  onClick={() => setTableDensity('compact')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tableDensity === 'compact'
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-700'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> 紧凑
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2.5">统计概览</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-primary-700 dark:text-primary-700">
                    <span className="w-2 h-2 rounded-full bg-primary-500" /> 正常
                  </span>
                  <span className="font-semibold tabular-nums">{activeCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-error-500 dark:text-error-600">
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
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-relaxed">
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-mono">Ctrl+A</kbd>{' '}
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
              <Check className="w-4 h-4 text-primary-700" />
              <AlertTitle className="text-sm font-medium">
                已选择 <strong className="text-primary-700 dark:text-primary-700">{selectedIds.size}</strong> 个用户
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2 mt-2">
                <Select
                  value=""
                  onChange={(v) => {
                    if (v)
                      setConfirmAction({
                        type: 'batch_role',
                        userIds: [...selectedIds],
                        newValue: v,
                        label: '批量更改角色',
                        description: `确定要将选中 ${selectedIds.size} 个用户的角色更改为「${getRoleConfig(v).label}」吗？`,
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
                  className="text-primary-700 border-emerald-200 hover:bg-primary-50 dark:border-emerald-800 dark:hover:bg-primary-900/20"
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
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 批量禁用
                </Button>
                <Button size="sm" variant="ghost" className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" onClick={() => setSelectedIds(new Set())}>
                  取消选择
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
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
            className="transition-all duration-300 hover:shadow-xl shadow-md ring-1 ring-slate-200/60 dark:ring-slate-700/40 overflow-visible border-neutral-200 dark:border-neutral-700/60"
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
                  title={search || roleFilter !== 'all' || statusFilter !== 'all' || orgFilter !== null ? '没有匹配的用户' : '暂无用户'}
                  description={
                    search || roleFilter !== 'all' || statusFilter !== 'all' || orgFilter !== null
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
                    <tbody ref={tableBodyRef} className="divide-y divide-slate-100 dark:divide-slate-700/50">
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
                        const isLocked = !!(user as any).locked_until && new Date((user as any).locked_until) > new Date();

                        return (
                          <tr
                            key={user.id}
                            className={`group animate-in fade-in slide-in-from-4 duration-300 fill-mode-both hover:[&]:bg-slate-50 dark:bg-neutral-800/90 dark:hover:bg-neutral-800/50 [&]:transition-colors [&]:duration-150 ${
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
                                className="flex items-center gap-2.5 text-left hover:text-primary-700 dark:hover:text-primary-600 transition-all duration-200 active:scale-[0.98] rounded-lg p-1 -m-1 hover:shadow-sm hover:bg-neutral-100 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/30"
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
                                    {isLocked && <Lock className="w-3 h-3 ml-1 inline text-error-500" />}
                                  </p>
                                  <p className="text-xs text-neutral-400 dark:text-neutral-400 truncate max-w-[140px]">
                                    ID: {user.id}
                                  </p>
                                </div>
                              </button>
                            </td>
                            <td className={`${cellPadding} text-neutral-600 dark:text-neutral-300 hidden sm:table-cell`}>
                              <span className="truncate block max-w-[100px]">
                                {user.full_name || (
                                  <span className="text-neutral-300 dark:text-neutral-400 italic">未设置</span>
                                )}
                              </span>
                            </td>
                            <td className={`${cellPadding} hidden md:table-cell`}>
                              {user.email ? (
                                <a
                                  href={`mailto:${user.email}`}
                                  className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-primary-700 transition-colors truncate max-w-[180px]"
                                  title={user.email}
                                >
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{user.email}</span>
                                </a>
                              ) : (
                                <span className="text-neutral-300 dark:text-neutral-400 italic text-xs">-</span>
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
                                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 transition-colors"
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
                                      <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> 查看详情
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-slate-50 dark:bg-neutral-800 dark:hover:bg-neutral-700/50 transition-colors"
                                      onClick={() => {
                                        // Cycle through roles: ADMIN -> MANAGER -> RESEARCHER -> ANALYST -> VIEWER -> ADMIN
                                        const roleOrder = [UserRole.ADMIN, UserRole.MANAGER, UserRole.RESEARCHER, UserRole.ANALYST, UserRole.VIEWER];
                                        const currentIdx = roleOrder.indexOf(user.role as UserRole);
                                        const nextRole = roleOrder[(currentIdx + 1) % roleOrder.length];
                                        requestRoleChange(user, nextRole);
                                        setActionMenuId(null);
                                      }}
                                      disabled={isSelf}
                                    >
                                      <UserCog className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" /> 更改角色
                                    </button>
                                    <div className="my-1 mx-3 border-t border-neutral-100 dark:border-neutral-700" />
                                    <button
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                                        user.is_active
                                          ? 'text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20'
                                          : 'text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20'
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
                                      <Trash2 className="w-4 h-4" /> 删除账户
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

      {/* ═══════════════════════════════════════════════════════════
          账号申请（预注册）队列管理
          登录页"申请开通账号"通道 → POST /auth/pre-register 入队，
          管理员在此审核通过（自动建号）/ 拒绝。
          #prereg-queue: 页首待审核提醒横幅的锚点目标。
          ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-4" id="prereg-queue">
        <Card>
          <CardContent className="p-6 space-y-5">
            {/* 队列标题 + 状态 Tab */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UserRoundPlus className="w-5 h-5 text-primary-700 dark:text-primary-700" />
                  账号申请
                  {preRegStatusCounts.pending > 0 && (
                    <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-700 text-xs font-bold flex items-center justify-center">
                      {preRegStatusCounts.pending}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  登录页提交的账号开通申请，审核通过后自动创建用户
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="搜索邮箱 / 姓名 / 部门…"
                  value={preRegSearch}
                  onChange={(e) => { setPreRegSearch(e.target.value); setPreRegPage(1); }}
                  prefix={<Search className="w-4 h-4" />}
                  size="sm"
                  className="w-56"
                />
                <Tabs value={preRegTab} onValueChange={(v) => { setPreRegTab(v as PreRegisterStatus); setPreRegPage(1); }}>
                  <TabsList>
                    <TabsTrigger value="pending">待审核{preRegStatusCounts.pending ? ` (${preRegStatusCounts.pending})` : ''}</TabsTrigger>
                    <TabsTrigger value="approved">已开通{preRegStatusCounts.approved ? ` (${preRegStatusCounts.approved})` : ''}</TabsTrigger>
                    <TabsTrigger value="rejected">已拒绝{preRegStatusCounts.rejected ? ` (${preRegStatusCounts.rejected})` : ''}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* 队列表格 */}
            {preRegLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : preRegItems.length === 0 ? (
              <EmptyState
                icon={<UserRoundPlus size={40} strokeWidth={1.5} />}
                title={preRegTab === 'pending' ? '暂无待审核的申请' : `暂无${preRegStatusLabel[preRegTab]}的申请`}
                description="登录页提交的账号申请会显示在此，审核通过后自动创建用户"
              />
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-200/80 dark:border-neutral-700/60">
                      <th className="py-2.5 px-3 font-medium">申请时间</th>
                      <th className="py-2.5 px-3 font-medium">邮箱</th>
                      <th className="py-2.5 px-3 font-medium">姓名</th>
                      <th className="py-2.5 px-3 font-medium">部门</th>
                      <th className="py-2.5 px-3 font-medium">状态</th>
                      <th className="py-2.5 px-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preRegItems.map((req) => (
                      <tr key={req.id} className="border-b border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          {new Date(req.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-3 font-medium">{req.email}</td>
                        <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">{req.full_name || '—'}</td>
                        <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">{req.department || '—'}</td>
                        <td className="py-3 px-3">
                          <Badge variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : 'danger'} size="sm">
                            {preRegStatusLabel[req.status]}
                            {req.status === 'rejected' && req.reject_reason && (
                              <span className="ml-1 normal-case text-xs opacity-80">（{req.reject_reason.slice(0, 12)}{req.reject_reason.length > 12 ? '…' : ''}）</span>
                            )}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {req.status === 'pending' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="glass" size="sm"
                                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onClick={() => { setPreRegDetail(req); setPreRegApproveForm({ role: 'researcher', password: '' }); setPreRegRejectReason(''); }}
                              >
                                开通
                              </Button>
                              <Button
                                variant="secondary" size="sm"
                                icon={<X className="w-3.5 h-3.5" />}
                                onClick={() => { setPreRegDetail(req); setPreRegRejectReason(''); }}
                              >
                                拒绝
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                              {req.status === 'approved' && req.user_id ? `→ 用户 #${req.user_id}` : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {preRegData && preRegData.total > preRegPageSize && (
                  <div className="px-3 py-3 border-t border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      共 <span className="font-medium text-neutral-700 dark:text-neutral-300">{preRegData.total}</span> 条
                    </p>
                    <Pagination
                      page={preRegPage}
                      pageSize={preRegPageSize}
                      total={preRegData.total}
                      onPageChange={setPreRegPage}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 账号申请审核 Modal（开通 / 拒绝） ── */}
      <Modal
        open={!!preRegDetail}
        onClose={() => setPreRegDetail(null)}
        title={preRegDetail?.status === 'pending' ? '审核账号申请' : '申请详情'}
        size="md"
      >
        {preRegDetail && (
          <div className="space-y-5">
            {/* 申请信息 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary-700 dark:text-primary-700" />
                </div>
                <div>
                  <p className="font-medium">{preRegDetail.email}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {preRegDetail.full_name || '未填姓名'}{preRegDetail.department ? ` · ${preRegDetail.department}` : ''}
                  </p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                申请时间：{new Date(preRegDetail.created_at).toLocaleString('zh-CN')}
              </p>
              {preRegDetail.status === 'rejected' && preRegDetail.reject_reason && (
                <div className="rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 p-3 text-sm text-error-700 dark:text-error-600">
                  <strong>拒绝原因：</strong>{preRegDetail.reject_reason}
                </div>
              )}
              {preRegDetail.status === 'approved' && preRegDetail.user_id && (
                <div className="rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 p-3 text-sm text-success-700 dark:text-success-600">
                  <strong>已开通</strong>，对应用户 #{preRegDetail.user_id}
                </div>
              )}
            </div>

            {/* 待审核：操作区 */}
            {preRegDetail.status === 'pending' && (
              <div className="space-y-4 border-t border-neutral-200/80 dark:border-neutral-700/60 pt-4">
                {/* 开通区 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-success-500" />
                    开通账号
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">初始角色</label>
                      <Select
                        value={preRegApproveForm.role}
                        onChange={(v) => setPreRegApproveForm((f) => ({ ...f, role: v }))}
                        size="sm"
                        className="w-full"
                      >
                        <option value="researcher">{roleLabelMap.researcher}</option>
                        <option value="formulator">{roleLabelMap.formulator}</option>
                        <option value="reviewer">{roleLabelMap.reviewer}</option>
                        <option value="guest">{roleLabelMap.guest}</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">初始密码（可选，留空则系统生成）</label>
                      <Input
                        value={preRegApproveForm.password}
                        onChange={(e) => setPreRegApproveForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="留空则系统生成临时密码"
                        minLength={preRegApproveForm.password ? 8 : undefined}
                      />
                    </div>
                  </div>
                  <Button
                    variant="glass"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => approvePreRegMutation.mutate({
                      requestId: preRegDetail.id,
                      role: preRegApproveForm.role,
                      password: preRegApproveForm.password,
                    })}
                    disabled={approvePreRegMutation.isPending || (preRegApproveForm.password ? preRegApproveForm.password.length < 8 : false)}
                  >
                    确认开通并创建用户
                  </Button>
                </div>

                {/* 拒绝区 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <X className="w-4 h-4 text-error-500" />
                    或拒绝申请
                  </div>
                  <Input
                    value={preRegRejectReason}
                    onChange={(e) => setPreRegRejectReason(e.target.value)}
                    placeholder="拒绝原因（可选，会记录到申请）"
                  />
                  <Button
                    variant="secondary"
                    icon={<X className="w-4 h-4" />}
                    onClick={() => rejectPreRegMutation.mutate({
                      requestId: preRegDetail.id,
                      reason: preRegRejectReason,
                    })}
                    disabled={rejectPreRegMutation.isPending}
                  >
                    拒绝该申请
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

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
                        ...(lockStatus ? [{
                          icon: lockStatus.is_locked ? Lock : Unlock,
                          label: '账号锁定',
                          value: lockStatus.is_locked ? `已锁定${lockStatus.lock_info?.remaining_time ? ` 剩余${Math.ceil(lockStatus.lock_info.remaining_time / 60)}分钟` : ''}` : '未锁定',
                          highlight: lockStatus.is_locked,
                        }] : []),
                      ].map(({ icon: Icon, label, value, highlight }) => (
                        <div
                          key={label}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg ${highlight ? 'bg-warning-50 dark:bg-warning-900/10 border border-amber-200 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-neutral-800/50'}`}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-warning-500' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-400 dark:text-neutral-400">{label}</p>
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Edit Profile Button / Form */}
                    {!editProfileOpen ? (
                      <button
                        disabled={isSelf}
                        onClick={() => {
                          if (isSelf) return;
                          setEditForm({
                            email: detailUser.email || '',
                            full_name: detailUser.full_name || '',
                            phone: (detailUser as any).phone || '',
                            department: detailUser.department || '',
                          });
                          setEditErrors({});
                          setEditProfileOpen(true);
                        }}
                        className={`self-stretch flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          isSelf
                            ? 'opacity-40 cursor-not-allowed border-neutral-200 dark:border-neutral-700 text-neutral-400'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                        }`}
                      >
                        <Edit3 className="w-4 h-4" /> 编辑资料
                      </button>
                    ) : (
                      <div className="self-stretch w-full space-y-3 bg-white dark:bg-neutral-900/50 rounded-xl border border-primary-200 dark:border-primary-800/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">编辑用户资料</span>
                          <button onClick={() => setEditProfileOpen(false)} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">邮箱</label>
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                              placeholder="user@example.com"
                              prefix={<Mail size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                              error={!!editErrors.email}
                            />
                            {editErrors.email && <p className="text-xs text-error-500">{editErrors.email}</p>}
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">姓名</label>
                            <Input
                              value={editForm.full_name}
                              onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                              placeholder="真实姓名"
                              prefix={<UserCog size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">电话</label>
                            <Input
                              value={editForm.phone}
                              onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                              placeholder="手机号码"
                              prefix={<Phone size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">部门</label>
                            <Input
                              value={editForm.department}
                              onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
                              placeholder="所属部门"
                              prefix={<Building2 size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditProfileOpen(false)}>
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              const errs: Record<string, string> = {};
                              if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errs.email = '邮箱格式无效';
                              setEditErrors(errs);
                              if (Object.keys(errs).length > 0) return;
                              const payload: Record<string, any> = {};
                              if (editForm.email) payload.email = editForm.email;
                              if (editForm.full_name) payload.full_name = editForm.full_name;
                              if (editForm.phone) payload.phone = editForm.phone;
                              if (editForm.department) payload.department = editForm.department;
                              if (detailUser) editProfileMutation.mutate({ userId: detailUser.id, data: payload });
                            }}
                            disabled={editProfileMutation.isPending}
                          >
                            {editProfileMutation.isPending ? '保存中...' : '保存更改'}
                          </Button>
                        </div>
                      </div>
                    )}

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
                          disabled={deactivateUserMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" /> 删除账户
                        </Button>
                      )}
                      {lockStatus?.is_locked && !isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-warning-600 border-amber-200 hover:bg-warning-50 dark:border-amber-800 dark:hover:bg-warning-900/20"
                          onClick={async () => {
                            try {
                              await adminApi.unlockUserAccount(detailUser.id);
                              toast.success('账号已解锁');
                              setDetailUser(null);
                            } catch {
                              toast.error('解锁失败，请重试');
                            }
                          }}
                        >
                          <Unlock className="w-4 h-4 mr-1.5" /> 解锁账号
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
                                {TgtIcon && <TgtIcon className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                                <div>
                                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</p>
                                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{targetCfg?.description}</p>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {/* P5-7: 2FA Toggle */}
                    <div className="pt-3 border-t border-neutral-100 dark:border-neutral-700">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <KeyRound className="w-4 h-4 text-primary-700 dark:text-primary-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">两步验证 (2FA)</p>
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">增强账户安全，登录时需要额外验证码</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            (detailUser as any).totp_enabled
                              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-600'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            {(detailUser as any).totp_enabled ? '已启用' : '未启用'}
                          </span>
                          <Button
                            size="sm"
                            variant={(detailUser as any).totp_enabled ? 'outline' : 'default'}
                            disabled={isSelf}
                            onClick={() => {
                              if ((detailUser as any).totp_enabled) {
                                toast.info('2FA 管理功能开发中');
                              } else {
                                toast.info('2FA 启用功能开发中，敬请期待');
                              }
                            }}
                          >
                            {(detailUser as any).totp_enabled ? '管理' : '启用'}
                          </Button>
                        </div>
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
                                className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-primary-700' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}
                              />
                              <div>
                                <p
                                  className={`text-xs font-medium ${isActive ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-600 dark:text-neutral-400'}`}
                                >
                                  {cfg.label}
                                </p>
                                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{cfg.description}</p>
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
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">最近 7 天</span>
                    </div>

                    <div className="relative pl-4 border-l-2 border-neutral-200/80 dark:border-neutral-700/60 space-y-0">
                      {(detailUser ? (
        userActivityQuery.data?.items?.length
          ? userActivityQuery.data.items.map((log) => ({
              id: log.id,
              action: log.action || '未知操作',
              time: log.created_at || '',
              ip: log.ip_address || '-',
              location: '本地',
              status: (log.status_code === 200 || log.status_code === undefined) ? 'success' : 'failed',
            }))
          : MOCK_ACTIVITY_RECORDS
      ) : MOCK_ACTIVITY_RECORDS).map((record) => (
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
                                    ? 'text-primary-700'
                                    : record.status === 'failed'
                                      ? 'text-error-600'
                                      : 'text-warning-600'
                                }`}
                              >
                                {record.action}
                              </span>
                              {record.status === 'failed' && <AlertTriangle className="w-3 h-3 text-error-500" />}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {(() => { const d = new Date(record.time); return isNaN(d.getTime()) ? record.time : d.toLocaleDateString('zh-CN'); })()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {(() => { const d = new Date(record.time); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); })()}
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
                        <p className="text-lg font-bold text-primary-700 tabular-nums">
                          {detailUser && userActivityQuery.data?.items ? userActivityQuery.data.items.filter((l) => l.status_code === 200).length : MOCK_ACTIVITY_RECORDS.filter((r) => r.status === 'success').length}
                        </p>
                        <p className="text-xs text-primary-700/70">成功操作</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-error-50 dark:bg-error-900/10">
                        <p className="text-lg font-bold text-error-600 tabular-nums">
                          {detailUser && userActivityQuery.data?.items ? userActivityQuery.data.items.filter((l) => l.status_code !== 200).length : MOCK_ACTIVITY_RECORDS.filter((r) => r.status === 'failed').length}
                        </p>
                        <p className="text-xs text-error-600/70">失败操作</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-warning-50 dark:bg-warning-900/10">
                        <p className="text-lg font-bold text-warning-600 tabular-nums">
                          {detailUser && userActivityQuery.data?.items?.[0]?.created_at ? formatTimeAgo(userActivityQuery.data.items[0].created_at) : formatTimeAgo(MOCK_ACTIVITY_RECORDS[0]?.time || '')}
                        </p>
                        <p className="text-xs text-warning-600/70">最近活动</p>
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
                <span className="line-through text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{getRoleConfig(confirmAction.currentValue).label}</span>
                <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <span className="font-medium text-primary-700 dark:text-primary-700">
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
            <Upload className="w-10 h-10 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              点击选择或拖拽 CSV 文件到此区域
            </p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-4">支持 .csv 格式，最大 5MB</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-1.5" /> 选择文件
            </Button>
          </div>

          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] space-y-1">
            <p className="font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">CSV 格式示例：</p>
            <pre className="bg-slate-50 dark:bg-neutral-800/50 p-2.5 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed">
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

      {/* ── Import Error Detail Modal ── */}
      <Modal
        open={importErrorDetail.length > 0}
        onClose={() => setImportErrorDetail([])}
        title={`导入错误 (${importErrorDetail.length})`}
        size="md"
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {importErrorDetail.map((err: any, i: number) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800/30 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-error-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-error-700 dark:text-error-600">
                  第 {err.row || '?'} 行 · {err.field || '未知字段'}
                </p>
                <p className="text-error-600/80 dark:text-error-500/70 mt-0.5">{err.message || String(err)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-3">
          <Button variant="ghost" size="sm" onClick={() => setImportErrorDetail([])}>
            关闭
          </Button>
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
                <UserRoundPlus className="w-4 h-4 text-primary-700 dark:text-primary-700" />
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
                prefix={<Hash size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
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
                  placeholder="至少8个字符"
                  prefix={<Lock size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
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
                prefix={<Mail size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
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
                prefix={<UserCog size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
                className="h-10 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">角色</label>
              <Select
                value={createForm.role}
                onChange={(v) => setCreateForm((prev) => ({ ...prev, role: v as UserRole }))}
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
                prefix={<Building2 size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
                className="focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-800 transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">组织</label>
              <Select
                value={createForm.organization_id != null ? String(createForm.organization_id) : 'all'}
                onChange={(v) => setCreateForm((prev) => ({ ...prev, organization_id: v === 'all' ? null : Number(v) }))}
                size="sm"
              >
                <option value="all">不限组织</option>
                {orgListData?.map((org: { id: number; name: string }) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-700/30 border border-neutral-200/60 dark:border-neutral-700/40 rounded-xl p-3.5 ring-1 ring-slate-200/60 dark:ring-slate-700/40">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              <span className="inline-flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300">
                <Zap className="w-3 h-3" /> 提示：{' '}
              </span>
              新创建的用户默认状态为「正常」。创建后可随时在列表中修改角色或禁用账户。用户名仅支持英文字母、数字和下划线，密码长度至少8位。{' '}
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
                  organization_id: null,
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
