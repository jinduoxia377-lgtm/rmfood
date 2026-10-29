import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeEntity, type CDCChangeEvent } from '@/hooks/useRealtimeSync';
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
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
  Edit3,
  ChevronRight,
  Lock,
  Unlock,
  UserCog,
  FileText,
  Hash,
  Activity,
  Zap,
  Globe,
  KeyRound,
  Upload,
  History,
  ShieldQuestion,
  TrendingUp,
  PieChart as PieIcon,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MapPin,
  Wifi,
  UserRoundPlus,
  Eye as EyeIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  Modal,
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
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { ROLE_CONFIG, ROLE_OPTIONS, STATUS_OPTIONS, STATUS_CONFIG, PAGE_SIZE_OPTIONS, resolveRoleKey, getRoleConfig, useDebounce, formatTimeAgo, SortField, SortDirection, UserDetail, ConfirmAction } from './UserManagementHelpers'

/** 将 axios 错误响应统一格式化为可读消息（detail 可能是对象或字符串） */
function formatApiError(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const msg = (detail as { message?: string }).message;
    if (msg) return msg;
  }
  return fallback;
}

/** 判断申请是否超过审核 SLA（默认 3 天） */
function isRequestOverdue(createdAt: string, days = 3): boolean {
  return Date.now() - new Date(createdAt).getTime() > days * 86400000;
}

function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$';
  const all = upper + lower + digits + special;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  const chars = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    special[arr[3] % special.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[arr[i] % all.length]);
  }
  // 洗牌
  for (let i = chars.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * 本地原生 Select：兼容本页面历史用法（以 <option> 子元素声明选项）。
 * 注意：不要使用 @/components/ui 的 Radix Select（其 API 为 SelectTrigger/SelectItem），
 * 二者混用会导致下拉框无法渲染。
 */
function Select({
  value,
  onChange,
  children,
  className,
  size,
}: {
  value?: string;
  onChange?: (v: string) => void;
  children?: React.ReactNode;
  className?: string;
  size?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius-Apple-sm)] border border-input bg-transparent px-[var(--space-apple-sm)] py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'text-xs' : ''} ${className || ''}`}
    >
      {children}
    </select>
  );
}

export default function UserManagementPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null;

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
  const [pageSize, setPageSize] = useState(10);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importErrorDetail, setImportErrorDetail] = useState<any[]>([]);
  const [showOpLogPanel, setShowOpLogPanel] = useState(false);
  const [showDataViz, setShowDataViz] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // ── 账号申请（预注册）队列状态 ──
  const [preRegTab, setPreRegTab] = useState<PreRegisterStatus>('pending');
  const [preRegSearch, setPreRegSearch] = useState('');
  const [preRegPage, setPreRegPage] = useState(1);
  const [preRegPageSize] = useState(20);
  const [preRegDetail, setPreRegDetail] = useState<PreRegisterRequest | null>(null);
  const [preRegApproveForm, setPreRegApproveForm] = useState({ role: 'researcher', password: '', note: '' });
  const [preRegRejectReason, setPreRegRejectReason] = useState('');
  const [preRegSelected, setPreRegSelected] = useState<number[]>([]);
  const [detailTab, setDetailTab] = useState('info');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: UserRole.RESEARCHER,
    department: '',
    organization_id: null as number | null,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', full_name: '', phone: '', department: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdResult, setResetPwdResult] = useState<string | null>(null);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['admin-users', page, pageSize, search, roleFilter, statusFilter, orgFilter, sortField, sortDir],
    queryFn: () =>
      adminApi.listUsers({
        page,
        page_size: pageSize,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        organization_id: orgFilter || undefined,
        sort_field: sortField,
        sort_dir: sortDir,
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
      date: d.period || d.date || d.time || '',
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
  const preRegStatusCounts = preRegData?.status_counts ?? { pending: 0, approved: 0, rejected: 0, expired: 0 };

  const approvePreRegMutation = useMutation({
    mutationFn: (vars: { requestId: number; role?: string; password?: string; note?: string }) =>
      adminApi.approvePreRegisterRequest(vars.requestId, {
        role: vars.role,
        password: vars.password || undefined,
        note: vars.note || undefined,
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
      setPreRegApproveForm({ role: 'researcher', password: '', note: '' });
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '开通账号失败，请重试'));
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
      toast.error(formatApiError(e, '拒绝操作失败，请重试'));
    },
  });

  const batchApprovePreRegMutation = useMutation({
    mutationFn: (vars: { ids: number[]; role?: string; password?: string; note?: string }) =>
      adminApi.batchApprovePreRegisterRequests(vars.ids, {
        role: vars.role,
        password: vars.password,
        note: vars.note,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`批量通过完成：成功 ${data.success_count}，失败 ${data.fail_count}`);
      setPreRegSelected([]);
      setPreRegDetail(null);
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '批量通过失败，请重试'));
    },
  });

  const batchRejectPreRegMutation = useMutation({
    mutationFn: (vars: { ids: number[]; reason?: string }) =>
      adminApi.batchRejectPreRegisterRequests(vars.ids, vars.reason),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      toast.success(`批量拒绝完成：成功 ${data.success_count}，失败 ${data.fail_count}`);
      setPreRegSelected([]);
      setPreRegDetail(null);
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '批量拒绝失败，请重试'));
    },
  });

  const resendPreRegMutation = useMutation({
    mutationFn: (requestId: number) => adminApi.resendPreRegisterCode(requestId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      toast.success(`已向 ${data.email} 重发验证码邮件`);
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '重发验证码失败，请重试'));
    },
  });

  const reactivatePreRegMutation = useMutation({
    mutationFn: (requestId: number) => adminApi.reactivatePreRegisterRequest(requestId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      toast.success(data.detail || '申请已重新激活');
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '重新激活失败，请重试'));
    },
  });

  const undoRejectPreRegMutation = useMutation({
    mutationFn: (requestId: number) => adminApi.undoRejectPreRegisterRequest(requestId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pre-register-requests'] });
      toast.success(data.detail || '已撤销拒绝');
    },
    onError: (e: any) => {
      toast.error(formatApiError(e, '撤销拒绝失败，请重试'));
    },
  });

  // ── 账号申请：批量选择/操作/导出 ──
  const preRegPageSelected = preRegItems.length > 0 && preRegItems.every((item) => preRegSelected.includes(item.id));

  const toggleSelectOnePreReg = (id: number) => {
    setPreRegSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllPreReg = () => {
    setPreRegSelected((prev) => {
      const pageIds = preRegItems.map((i) => i.id);
      const allSelected = pageIds.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !pageIds.includes(id));
      return Array.from(new Set([...prev, ...pageIds]));
    });
  };

  const handleBatchApprove = () => {
    if (preRegSelected.length === 0) return;
    batchApprovePreRegMutation.mutate({ ids: preRegSelected, role: 'researcher' });
  };

  const handleBatchReject = () => {
    if (preRegSelected.length === 0) return;
    batchRejectPreRegMutation.mutate({ ids: preRegSelected });
  };

  const handleExportPreReg = () => {
    adminApi
      .exportPreRegisterRequests({
        status: preRegTab,
        search: preRegSearch || undefined,
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pre_register_requests.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('导出失败，请重试'));
  };

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
    expired: '已过期',
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
      // 同步详情弹窗中的角色显示
      setDetailUser((prev) => (prev && prev.id === vars.userId ? { ...prev, role: vars.role } : prev));
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : '角色更新失败，请重试');
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
    mutationFn: (vars: { userIds: number[]; enable: boolean }) =>
      Promise.all(vars.userIds.map((id) => adminApi.setUserStatus(id, vars.enable))),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedIds(new Set());
      toast.success(`已${vars.enable ? '启用' : '禁用'} ${vars.userIds.length} 个用户`);
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
        department: data.department || undefined,
        role: data.role,
        organization_id: data.organization_id || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', email: '', full_name: '', role: UserRole.RESEARCHER, department: '', organization_id: null });
      setCreateErrors({});
      toast.success('用户创建成功');
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : '用户创建失败，请检查输入信息后重试');
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

  const handleResetPassword = useCallback(async () => {
    if (!detailUser) return;
    setResetPwdLoading(true);
    setResetPwdResult(null);
    try {
      const res = await adminApi.resetUserPassword(detailUser.id, resetPwdValue || undefined);
      setResetPwdValue('');
      setResetPwdResult(
        res.temp_password
          ? `用户「${res.username}」临时密码：${res.temp_password}（请转告用户首次登录后修改）`
          : `用户「${res.username}」密码已重置`,
      );
      toast.success('密码已重置');
    } catch {
      toast.error('密码重置失败，请重试');
    } finally {
      setResetPwdLoading(false);
    }
  }, [detailUser, resetPwdValue, toast]);

  // CRITICAL #1: lockStatus moved to component top-level (was inside Modal IIFE - Rules of Hooks violation)
  const { data: lockStatus } = useQuery({
    queryKey: ['user-lock-status', detailUser?.id],
    queryFn: () => detailUser ? adminApi.getAccountLockStatus(detailUser.id) : null,
    enabled: !!detailUser,
  });

  // 2FA 状态（仅打开“权限管理”Tab 时拉取）
  const twofaQuery = useQuery({
    queryKey: ['user-2fa-status', detailUser?.id],
    queryFn: () => (detailUser ? adminApi.getUser2faStatus(detailUser.id) : null),
    enabled: !!detailUser && detailTab === 'permissions',
  });
  const [twofaSecretInfo, setTwofaSecretInfo] = useState<{ secret: string; otpauth_url: string; username: string } | null>(null);
  const [confirmDisable2fa, setConfirmDisable2fa] = useState(false);

  const handleEnable2fa = useCallback(async () => {
    if (!detailUser) return;
    try {
      const res = await adminApi.enableUser2fa(detailUser.id);
      setTwofaSecretInfo({ secret: res.secret, otpauth_url: res.otpauth_url, username: res.username });
      setConfirmDisable2fa(false);
      qc.invalidateQueries({ queryKey: ['user-2fa-status', detailUser.id] });
      toast.success('2FA 已启用，请把密钥提供给用户');
    } catch {
      toast.error('启用 2FA 失败，请重试');
    }
  }, [detailUser, qc, toast]);

  const handleDisable2fa = useCallback(async () => {
    if (!detailUser) return;
    try {
      await adminApi.disableUser2fa(detailUser.id);
      setTwofaSecretInfo(null);
      setConfirmDisable2fa(false);
      qc.invalidateQueries({ queryKey: ['user-2fa-status', detailUser.id] });
      toast.success('2FA 已禁用');
    } catch {
      toast.error('禁用 2FA 失败，请重试');
    }
  }, [detailUser, qc, toast]);

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
      result = result.filter((u) => (u as unknown as { organization_id: number | null }).organization_id === orgFilter);
    }
    return result;
  }, [sortedUsers, statusFilter, orgFilter]);

  // ── ?highlight=userId 自动打开用户详情（供组织成员 Tab 跳转）──
  useEffect(() => {
    if (highlightUserId == null) return;
    const target = filteredUsers.find((u) => u.id === highlightUserId);
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetailUser(target);
       
      setDetailTab('info');
    }
  }, [highlightUserId, filteredUsers]);

  // 全量统计（来自后端 /admin/users 的 stats 字段，不随分页变化）
  const fullStats = (data as unknown as { stats: { role_counts?: Record<string, number>; total_users?: number; active_users?: number; inactive_users?: number } })?.stats;

  const roleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    Object.keys(ROLE_CONFIG).forEach((k) => {
      stats[k] = 0;
    });
    // 优先使用后端全量{t('pages.userManagement.roleStats')}；键为 DB 存储的枚举名（大写），经 resolveRoleKey 归一化
    if (fullStats?.role_counts) {
      Object.entries(fullStats.role_counts).forEach(([roleKey, cnt]) => {
        const k = resolveRoleKey(roleKey);
        stats[k] = (stats[k] || 0) + Number(cnt || 0);
      });
    } else {
      users.forEach((u) => {
        const key = resolveRoleKey(u.role);
        stats[key] = (stats[key] || 0) + 1;
      });
    }
    return stats;
  }, [fullStats, users]);

  const totalUsers = fullStats?.total_users ?? users.length;
  const activeCount = fullStats?.active_users ?? users.filter((u) => u.is_active).length;
  const inactiveCount = fullStats?.inactive_users ?? users.length - activeCount;
  const activeRate = totalUsers > 0 ? Math.round((activeCount / totalUsers) * 100) : 0;

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
    if (!auditLogData?.items) return 0;
    return auditLogData.items.filter(
      (l: any) => l.action?.includes('login') || l.action?.includes('auth') || l.action?.includes('lock'),
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
        if (confirmAction.userIds)
          batchStatusMutation.mutate({ userIds: confirmAction.userIds, enable: confirmAction.enable ?? true });
        break;
      case 'batch_role':
        if (confirmAction.userIds && confirmAction.newValue)
          batchRoleMutation.mutate({ userIds: confirmAction.userIds, role: confirmAction.newValue });
        break;
    }
    setConfirmAction(null);
  }, [
    confirmAction,
    statusMutation,
    roleMutation,
    batchStatusMutation,
    batchRoleMutation,
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
          enable,
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
        enable,
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

  const exportToCSV = useCallback(async () => {
    // Export ALL matching users (not just current page) by fetching all pages
    const headers = [t('pages.userManagement.thUsername'), '姓名', t('pages.userManagement.thEmail'), t('pages.userManagement.thRole'), t('pages.userManagement.thStatus'), '部门', t('pages.userManagement.thRegisteredAt'), t('pages.userManagement.thLastLogin')];
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
    // CSV 字段转义（防注入 + 正确处理逗号/引号/换行）
    const csvEscape = (val: unknown): string => {
      const s = String(val ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.map(csvEscape).join(','),
      ...allRows.map((r) => r.map(csvEscape).join(',')),
    ].join('\n');
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
      className={`inline-flex ml-0.5 ${sortField === field ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)] dark:text-[var(--text-muted)]'}`}
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
    createUserMutation.isPending;
  /* 表格密度统一为舒适档（原侧栏「舒适/紧凑」切换移除后不再需要动态密度值） */
  const cellPadding = 'px-[var(--space-apple-md)] py-[var(--space-apple-md)]';
  const textSize = 'text-sm';

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">

      {/* ── 顶部主色横幅（对齐 DashboardPage 页头设计）──
          surface-primary 实底 + 白字（C-24 方案 A，GATE-04/11）；
          控件沿用 ui 组件（Button variant="secondary" 深底），
          与仪表盘欢迎横幅的胶囊控件组保持同一视觉语言。 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.userManagement.title')}</h1>
              {/* 数据量胶囊：固定白底 + 固定深灰文字 #334155（不参与主题反转）。
                  白底压在 surface-primary 上为 C-24 方案 B（不可反转色阶）；
                  两模式恒定，在品牌绿实底上亮暗均 ≥ 8.6:1（AA 达标） */}
              <span className="text-xs font-medium bg-[var(--bg-secondary)] px-2.5 py-0.5 rounded-[var(--radius-pill)] tabular-nums shrink-0"
                style={{ color: '#334155' }}>
                {t('pages.userManagement.totalUsersCount', { count: total })}
              </span>
            </div>
            <p className="mt-1 text-white/80 text-sm flex items-center gap-[var(--space-apple-sm)]">
              <span>
                <strong className="text-white font-semibold tabular-nums">{activeCount}</strong> {t('pages.userManagement.activeUsers')}
                · <strong className="text-white font-semibold tabular-nums">{inactiveCount}</strong> {t('pages.userManagement.disabledUsers')}
              </span>
              {/* 同步指示：从副标题行移至徽章右侧，避免与胶囊徽章混排 */}
              {isFetching && !isLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-white/70">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {t('pages.userManagement.syncing')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {selectedIds.size > 0 && (
              <span className="px-[var(--space-apple-sm)] py-1 rounded-[var(--radius-pill)] bg-[var(--bg-secondary)] text-xs font-medium tabular-nums"
                style={{ color: '#334155' }}>
                {t('pages.userManagement.selectedCount', { count: selectedIds.size })}
              </span>
            )}
            <Button variant="secondary" size="sm" icon={<UserRoundPlus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}>
              {t('pages.userManagement.newUser')}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={<Upload className="w-4 h-4" />}
                onClick={() => setShowImportModal(true)}>
                {t('pages.userManagement.importUsers')}
              </Button>
              <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}
                onClick={exportToCSV} disabled={filteredUsers.length === 0}>
                {t('pages.userManagement.exportUsers')}
              </Button>
            </div>
            <Button variant="secondary" size="sm" icon={<Terminal className="w-4 h-4" />}
              onClick={() => setShowOpLogPanel(!showOpLogPanel)}>
              {t('pages.userManagement.operationLogs')}
              {anomalyCount > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] bg-[var(--bg-secondary)] text-xs font-bold rounded-[var(--radius-pill)] flex items-center justify-center px-1 tabular-nums"
                  style={{ color: '#b91c1c' }}>
                  {anomalyCount}
                </span>
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
          className="w-full flex items-center gap-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] bg-[var(--color-warning-container)] px-5 py-[14px] text-left transition-colors hover:bg-[var(--color-warning-container)]/80 dark:hover:bg-[var(--color-warning-container)]/30"
        >
          <UserRoundPlus className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] shrink-0" />
          <span className="flex-1 text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
            有 <strong className="font-bold">{preRegStatusCounts.pending}</strong> 条登录页提交的账号申请待审核
          </span>
          <span className="text-xs font-semibold text-[var(--color-warning-text)]">前往处理 →</span>
        </button>
      )}

      {/* ── Data Visualization Dashboard（可折叠，减少首屏信息过载） ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowDataViz((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors min-h-[44px] px-2 -mx-2"
          aria-expanded={showDataViz}
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', showDataViz ? '' : '-rotate-90')} />
          数据概览
        </button>
        {!showDataViz && (
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            点击展开统计卡
          </span>
        )}
      </div>

      {showDataViz && (
        <>
      {/* ── 统计概览卡（对齐 FormulaListPage 的 StatCard 网格）──
          设计系统组件 StatCard（ui/StatCard.tsx）：顶部色条 + 图标圆 + 数值 + 副标题，
          取代原手写大卡（手写大卡的 borderLeftWidth 内联 style 依赖 --color-success-main 等
          未随主题反转的令牌，且大数字直接用 text-[var(--color-success-text)]/error-600 亮色档在白底 3.77:1 不达标）。 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="注册用户"
          value={totalUsers}
          icon={Users}
          variant="primary"
          subtitle={`活跃率 ${activeRate}%`}
        />
        <StatCard
          label="活跃用户"
          value={activeCount}
          icon={CheckCircle2}
          variant="success"
          subtitle={`占比 ${totalUsers > 0 ? Math.round((activeCount / totalUsers) * 100) : 0}%`}
          trend={{ direction: activeRate >= 50 ? 'up' : 'down', value: `${activeRate}% 活跃` }}
        />
        <StatCard
          label="已禁用"
          value={inactiveCount}
          icon={ShieldAlert}
          variant="warning"
          subtitle={`占比 ${totalUsers > 0 ? Math.round((inactiveCount / totalUsers) * 100) : 0}%`}
        />
        <StatCard
          label="角色分布"
          value={pieChartData.length}
          icon={PieIcon}
          variant="secondary"
          subtitle="在下方环形图中查看各角色人数"
          onClick={() => {
            document.getElementById('role-distribution-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      </div>

      {/* ── 角色分布环形图卡（StatCard 网格的展开详情）── */}
      <Card id="role-distribution-card" className="transition-all duration-300 hover:shadow-lg shadow-md">
        <CardContent className="p-[var(--space-apple-lg)]">
          <div className="flex items-center justify-between mb-[var(--space-apple-md)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-[var(--color-secondary-container)] flex items-center justify-center">
                <PieIcon className="w-3.5 h-3.5 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]" aria-hidden="true" />
              </div>
              角色分布
            </h3>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-[var(--radius-pill)] font-medium tabular-nums">
              共 {totalUsers} 人
            </span>
          </div>
          {pieChartData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0">
                <ResponsiveContainer width={180} height={150}>
                  <PieChart>
                    <Pie rootTabIndex={-1}
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
              </div>
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {pieChartData.map((entry) => {
                  const pct = totalUsers > 0 ? ((entry.value / totalUsers) * 100).toFixed(0) : '0';
                  return (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span className="w-2.5 h-2.5 rounded-[var(--radius-pill)] shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-[var(--text-secondary)] truncate">{entry.name}</span>
                      <span className="font-semibold tabular-nums text-[var(--text-primary)] ml-auto">
                        {entry.value}
                      </span>
                      <span className="text-[var(--text-muted)] tabular-nums">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-[var(--text-muted)] text-sm">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>


      {/* ── 用户注册趋势 ── */}
      {registrationTrendChart.length > 1 && (
        <Card>
          <CardContent className="p-[var(--space-apple-lg)]">
            <div className="flex items-center justify-between mb-[var(--space-apple-md)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-primary-text)]0" aria-hidden="true" />
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
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #9A9A9F)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #9A9A9F)' }} tickLine={false} axisLine={false} allowDecimals={false} />
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
      </>
      )}

      {/* ── Operation Log Panel (Collapsible) ── */}
      {showOpLogPanel && (
        <Card className="overflow-hidden border-[var(--color-primary-border)] dark:border-[var(--color-primary)] animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg ring-1 ring-[var(--color-primary-container)] dark:ring-primary-900/30">
          <CardContent className="p-[var(--space-apple-lg)]">
            <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center">
                  <History className="w-3.5 h-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                </div>
                {t('pages.userManagement.operationLogsTitle')}
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
              {!auditLogData?.items?.length && (
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] py-[var(--space-apple-lg)] text-center">
                  {t('pages.userManagement.noOperationLogs')}
                </p>
              )}
              {(auditLogData?.items ?? []).slice(0, 10).map((log: any) => (
                <div key={log.id}>
                  <div
                    onClick={() => handleLogClick(log.id)}
                    className={`flex items-start gap-[var(--space-apple-sm)] p-2.5 rounded-[var(--radius-Apple-sm)] text-xs cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/10 ${
                      log.type === 'login_anomaly' || log.type === 'security_event'
                        ? 'border border-[var(--color-error-border)] dark:border-[var(--color-error)]/30'
                        : log.type === 'batch_op'
                          ? 'border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/30'
                          : 'border border-transparent'
                    } ${expandedLogId === log.id ? 'bg-[var(--color-primary-container)] rounded-t-none' : ''}`}
                  >
                    <div
                      className={`shrink-0 w-7 h-7 rounded-[var(--radius-pill)] flex items-center justify-center ${
                        log.type === 'role_change'
                          ? 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)]'
                          : log.type === 'status_toggle'
                            ? 'bg-[var(--border-color)] text-[var(--text-secondary)]'
                            : log.type === 'batch_op'
                              ? 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]'
                              : log.type === 'login_anomaly'
                                ? 'bg-[var(--color-error-container)] text-[var(--color-error-text)]'
                                : 'bg-[var(--color-error-container)] text-[var(--color-error-text)]'
                      }`}
                    >
                      {log.type === 'role_change' ? (
                        <UserCog className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : log.type === 'status_toggle' ? (
                        <ShieldQuestion className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : log.type === 'batch_op' ? (
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{log.action}</span>
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate">{log.target || log.username || '系统'}</span>
                        <span className="ml-auto text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
                          {expandedLogId === log.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </span>
                      </div>
                      <p className="text-[var(--text-muted)] mt-0.5 text-xs truncate">
                        {typeof log.details === 'string' ? log.details : log.action}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {log.created_at || log.timestamp}
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                        <span className="font-mono">{log.username || log.operator || '—'}</span>
                        {log.user_role && (
                          <>
                            <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">|</span>
                            <span className="px-1 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] text-xs">{log.user_role}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedLogId === log.id && (
                    <div className="mx-2 mb-2 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs space-y-1.5">
                      {log.entity_type && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">实体类型:</span>
                          <span className="font-mono text-[var(--text-primary)]">{log.entity_type}</span>
                        </div>
                      )}
                      {log.entity_id && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">实体ID:</span>
                          <span className="font-mono text-[var(--text-primary)]">{log.entity_id}</span>
                        </div>
                      )}
                      {log.ip_address && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">IP地址:</span>
                          <span className="font-mono text-[var(--text-primary)]">{log.ip_address}</span>
                        </div>
                      )}
                      {log.details && typeof log.details === 'string' && (
                        <div className="flex gap-2">
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">详情:</span>
                          <span className="text-[var(--text-secondary)] break-all">{log.details}</span>
                        </div>
                      )}
                      {log.details && typeof log.details === 'object' && (
                        <pre className="mt-1 p-2 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)] font-mono text-xs overflow-x-auto text-[var(--text-secondary)]">
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

      {/* ── Main Content Grid ──
          双列布局门槛 = xl(1280px)：xl 下表格列可分配 4/5×1216≈973px ≥ 表格全列 932px（无滚动），
          侧栏 1/5≈224px 够放筛选卡。xl 以下（1024~1279 平板/窄桌面）单列堆叠，表格全宽，
          各列断点同步上移一档（{t('pages.userManagement.thEmail')} md→lg / 组织 lg→xl / 注册时间 xl→2xl），避免窄容器挤压。 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* ── Left Sidebar: Filters ── */}
        <Card className="xl:col-span-1 transition-all duration-300 hover:shadow-md shadow-md border-[var(--border-color)] bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-800/50">
          <CardContent className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-800 dark:text-[var(--text-primary)] flex items-center gap-2">
                <div className="w-7 h-7 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
                  <Filter className="w-3.5 h-3.5 text-[var(--color-primary-text)]" aria-hidden="true" />
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
              <label className="text-sm font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">搜索</label>
              {/* A-24：placeholder 不是可访问名称，且该 <label> 无 htmlFor 无法关联 */}
              <Input
                aria-label={t('pages.userManagement.searchAria')}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder={t('pages.userManagement.searchPlaceholder')}
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
                <option value="all">{t('pages.userManagement.allRoles')}</option>
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

            <div className="mt-[var(--space-apple-md)] pt-[var(--space-apple-md)] border-t border-[var(--border-color)] space-y-[var(--space-apple-sm)]">
              <p className="text-sm font-medium text-[var(--text-secondary)]">显示设置</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-muted)]">每页数量</label>
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
            </div>

            <div className="pt-3 border-t border-[var(--border-color)]">
              <p className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2.5">{t('pages.userManagement.roleStats')}</p>
              <div className="space-y-2">
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-[var(--text-muted)] truncate">
                      <cfg.icon className="w-3.5 h-3.5 shrink-0" /> {cfg.label}
                    </span>
                    <span className="font-medium tabular-nums">{roleStats[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)]">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-relaxed">
                <kbd className="px-1 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] text-xs font-mono">Ctrl+A</kbd>{' '}
                {t('pages.userManagement.selectHint')}{' '}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Table Area ── */}
        <div className="xl:col-span-4 space-y-[var(--space-apple-md)]">
          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <Alert className="rounded-[var(--radius-Apple-md)] border-[var(--color-primary-border)] bg-gradient-to-r from-primary-50/80 to-secondary-50/60 dark:border-[var(--color-primary)] dark:from-primary-950/30 dark:to-secondary-950/20 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-sm">
              <Check className="w-4 h-4 text-[var(--color-primary-text)]" />
              <AlertTitle className="text-sm font-medium">
                已选择 <strong className="text-[var(--color-primary-text)]">{selectedIds.size}</strong> 个用户
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
                    {t('pages.userManagement.batchChangeRole')}
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
                  className="text-[var(--color-primary-text)] border-[var(--color-success-border)] hover:bg-[var(--color-primary-container)] dark:border-[var(--color-success)] dark:hover:bg-[var(--color-primary-container)]/20"
                  onClick={() => requestBatchStatusToggle(true)}
                  disabled={batchStatusMutation.isPending}
                >
                  <Unlock className="w-3.5 h-3.5 mr-1" /> 批量启用
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[var(--color-error-text)] border-[var(--color-error-border)] hover:bg-[var(--color-error-container)] dark:border-[var(--color-error)] dark:hover:bg-[var(--color-error-container)]/20"
                  onClick={() => requestBatchStatusToggle(false)}
                  disabled={batchStatusMutation.isPending}
                >
                  <Lock className="w-3.5 h-3.5 mr-1" /> 批量禁用
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

          {/* Table Card — 桌面端 5 列网格中的右 4 列；窄屏时整行，表格横向滚动兜底 */}
          <Card
            className="xl:col-span-4 transition-all duration-300 hover:shadow-md shadow-sm overflow-hidden border-[var(--border-color)] bg-[var(--bg-secondary)]"
            id="user-table-card"
          >
            {/* 表头工具条：左侧「用户列表 + 条数」承接 h2，右侧已选数量（批量操作时显示） */}
            <div className="flex items-center justify-between gap-[var(--space-apple-sm)] px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-[var(--space-apple-sm)] min-w-0">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">用户列表</h2>
                <span className="text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2.5 py-0.5 rounded-[var(--radius-pill)] tabular-nums shrink-0">
                  共 {total} 条
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="text-xs font-medium text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] bg-[var(--color-primary-container)] px-2.5 py-0.5 rounded-[var(--radius-pill)] tabular-nums shrink-0">
                  {t('pages.userManagement.selectedCount', { count: selectedIds.size })}
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-sm)]">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-Apple-sm)]" />
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
                        <UserPlus className="w-4 h-4 mr-1.5" /> {t('pages.userManagement.importUsers')}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                {/* 表格横向滚动容器：移动端/窄屏下 min-w 兜底，滚动条只在溢出时出现。
                    表头 11px overline + primary-bg/primary 文字（DESIGN.md data-table 规范），
                    表格行 14px + ink-secondary，行悬停 primary-bg，底边 hairline 1px。 */}
                <div className="overflow-x-auto">
                  <table className={`w-full ${textSize} min-w-0 md:min-w-[640px]`} role="table" aria-label="用户列表">
                    <thead className="sticky top-0 z-10 bg-[var(--color-primary-container)] border-b border-[var(--border-color)] text-[var(--text-primary)]">
                      <tr>
                        <th className={`w-10 ${cellPadding} text-left`}>
                          <Checkbox
                            checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredUsers.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="全选"
                          />
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors group`}
                          onClick={() => handleSort('username')}
                        >
                          <span className="inline-flex items-center">
                            {t('pages.userManagement.thUsername')}
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon field="username" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors hidden sm:table-cell`}
                          onClick={() => handleSort('full_name')}
                        >
                          <span className="inline-flex items-center">
                            姓名
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon field="full_name" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider hidden md:table-cell max-w-[160px]`}
                        >
                          {t('pages.userManagement.thEmail')}
                        </th>
                        <th
                          className={`${cellPadding} text-left font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider hidden lg:table-cell w-[150px] min-w-[130px]`}
                        >
                          所属组织
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider cursor-pointer select-none hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors`}
                          onClick={() => handleSort('role')}
                        >
                          <span className="inline-flex items-center justify-center">
                            角色
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon field="role" />
                          </span>
                        </th>
                        <th className={`${cellPadding} text-center font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider`}>
                          状态
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider hidden xl:table-cell cursor-pointer select-none hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors`}
                          onClick={() => handleSort('created_at')}
                        >
                          <span className="inline-flex items-center justify-center">
                            注册时间
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon field="created_at" />
                          </span>
                        </th>
                        <th
                          className={`${cellPadding} text-center font-semibold text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] text-xs uppercase tracking-wider w-12`}
                        >
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                      {filteredUsers.map((user, idx) => {
                        const roleCfg = getRoleConfig(user.role);
                        const RoleIcon = roleCfg.icon;
                        const statusKey = user.is_active ? ('active' as const) : ('inactive' as const);
                        const statusCfg = STATUS_CONFIG[statusKey];
                        const isSelected = selectedIds.has(user.id);
                        const isSelf = user.id === currentUser?.id;
                        const showMenu = actionMenuId === user.id;
                        const hasAnomaly = (user.login_attempts ?? 0) >= 3;
                        const isLocked = !!(user as unknown as { locked_until?: string | null }).locked_until && new Date((user as unknown as { locked_until?: string | null }).locked_until!) > new Date();

                        return (
                          <tr
                            key={user.id}
                            className={`group align-middle animate-in fade-in slide-in-from-4 duration-300 fill-mode-both transition-colors duration-150 hover:bg-[var(--color-primary-container)]/40 dark:hover:bg-[var(--color-primary-container)]/10 ${
                              isSelected
                                ? 'bg-[var(--color-primary-container)]/60 dark:bg-[var(--color-primary-container)]/20'
                                : ''
                            }`}
                            style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                          >
                            <td className={cellPadding}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectOne(user.id)}
                                aria-label={`选择用户 ${user.username}`}
                              />
                            </td>
                            <td className={cellPadding}>
                              <button
                                className="flex items-center gap-2.5 text-left hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-all duration-200 active:scale-[0.98] rounded-[var(--radius-Apple-sm)] p-1 -m-1 hover:shadow-sm hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]/30"
                                onClick={() => {
                                  setDetailUser(user);
                                  setDetailTab('info');
                                }}
                              >
                                <div
                                  className={`w-9 h-9 rounded-[var(--radius-Apple-md)] flex items-center justify-center text-xs font-bold shadow-sm shrink-0 ring-1 ring-white dark:ring-neutral-700 ${roleCfg.color}`}
                                >
                                  {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  {/* 单行排版：{t('pages.userManagement.thUsername')} + 弱化内联 ID + 状态图标，避免两行堆叠造成行高参差 */}
                                  <p className="font-semibold text-[var(--text-primary)] truncate leading-6 max-w-[180px]">
                                    {user.username}
                                    <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)] tabular-nums">
                                      #{user.id}
                                    </span>
                                    {isSelf && (
                                      <Badge size="sm" className="ml-1.5 font-normal">
                                        你
                                      </Badge>
                                    )}
                                    {hasAnomaly && <AlertTriangle className="w-3 h-3 ml-1 inline text-[var(--color-warning-text)]0" />}
                                    {isLocked && <Lock className="w-3 h-3 ml-1 inline text-[var(--color-error-text)]0" />}
                                  </p>
                                </div>
                              </button>
                            </td>
                            <td className={`${cellPadding} text-[var(--text-secondary)] hidden sm:table-cell`}>
                              <span className="truncate block max-w-[100px]">
                                {user.full_name || (
                                  <span className="text-[var(--text-muted)] italic">未设置</span>
                                )}
                              </span>
                            </td>
                            <td className={`${cellPadding} hidden md:table-cell`}>
                              {user.email ? (
                                <a
                                  href={`mailto:${user.email}`}
                                  className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors truncate max-w-[160px]"
                                  title={user.email}
                                >
                                  <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span className="truncate">{user.email}</span>
                                </a>
                              ) : (
                                <span className="text-[var(--text-muted)] italic text-xs">-</span>
                              )}
                            </td>
                            <td className={`${cellPadding} hidden lg:table-cell`}>
                              {user.organizations && user.organizations.length > 0 ? (
                                <div className="flex items-center gap-1 flex-nowrap min-w-0 max-w-[150px]">
                                  {user.organizations.slice(0, 2).map((org) => (
                                    <button
                                      key={org.id}
                                      type="button"
                                      onClick={() => setOrgFilter(org.id)}
                                      className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-xs bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)]/60 truncate max-w-[90px] shrink hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/30 hover:border-[var(--color-secondary)] transition-colors cursor-pointer"
                                      title={`${org.name}（${org.role}）· 点击筛选该组织`}
                                    >
                                      {org.name}
                                    </button>
                                  ))}
                                  {user.organizations.length > 2 && (
                                    <span className="inline-flex items-center px-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">
                                      +{user.organizations.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)] italic text-xs">-</span>
                              )}
                            </td>
                            <td className={`${cellPadding} text-center`}>
                              <button
                                onClick={() =>
                                  !isSelf &&
                                  requestRoleChange(
                                    user,
                                    user.role === UserRole.ADMIN ? UserRole.REVIEWER : UserRole.ADMIN,
                                  )
                                }
                                disabled={isSelf}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[28px] rounded-[var(--radius-pill)] text-xs font-semibold border-0 cursor-pointer transition-all duration-200 hover:shadow-sm focus:ring-2 focus:ring-offset-1 ${roleCfg.color} ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={`${roleCfg.description}${isSelf ? '（不可修改）' : ''}`}
                              >
                                <RoleIcon className="w-3.5 h-3.5" />
                                {roleCfg.label}
                              </button>
                            </td>
                            <td className={`${cellPadding} text-center`}>
                              <Badge variant={statusCfg.variant} size="sm" className="cursor-default font-medium">
                                <span className={`w-1.5 h-1.5 rounded-[var(--radius-pill)] mr-1.5 ${statusCfg.dotColor}`} />
                                {statusCfg.label}
                              </Badge>
                            </td>
                            <td
                              className={`${cellPadding} text-center text-[var(--text-muted)] hidden xl:table-cell`}
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
                                  className="p-1.5 min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] dark:hover:text-[var(--text-muted)] transition-colors"
                                  aria-label={`${user.username} 的操作菜单`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMenu && (
                                  <div
                                    className="absolute right-0 w-44 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] shadow-lg shadow-black/10 border border-[var(--border-color)] py-1 z-[60] animate-in fade-in duration-150 origin-top-right min-w-[176px]"
                                    style={{
                                      top: 'calc(100% + 6px)',
                                      maxHeight: 'none',
                                    }}
                                  >
                                    <div className="absolute -top-1.5 right-3 w-2.5 h-2.5 bg-[var(--bg-secondary)] border-l border-t border-[var(--border-color)] rotate-45 shadow-sm" />
                                    <button
                                      className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20 transition-colors"
                                      onClick={() => {
                                        setDetailUser(user);
                                        setDetailTab('info');
                                        setActionMenuId(null);
                                      }}
                                    >
                                      <FileText className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" /> 查看详情
                                    </button>
                                    <button
                                      className="w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]/50 transition-colors"
                                      onClick={() => {
                                        // Cycle through roles: ADMIN -> REVIEWER -> RESEARCHER -> FORMULATOR -> GUEST -> ADMIN
                                        const roleOrder = [UserRole.ADMIN, UserRole.REVIEWER, UserRole.RESEARCHER, UserRole.FORMULATOR, UserRole.GUEST];
                                        const currentIdx = roleOrder.indexOf(user.role as UserRole);
                                        const nextRole = roleOrder[(currentIdx + 1) % roleOrder.length];
                                        requestRoleChange(user, nextRole);
                                        setActionMenuId(null);
                                      }}
                                      disabled={isSelf}
                                    >
                                      <UserCog className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" /> {t('pages.userManagement.changeRole')}
                                    </button>
                                    <div className="my-1 mx-3 border-t border-[var(--border-color)]" />
                                    <button
                                      className={`w-full flex items-center gap-2.5 px-[var(--space-apple-sm)] py-2 text-sm transition-colors ${
                                        user.is_active
                                          ? 'text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20'
                                          : 'text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20'
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
                    className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-between bg-gradient-to-r from-neutral-50 to-neutral-50/80 dark:from-neutral-800/50 dark:to-neutral-800/30"
                  >
                    <p className="text-xs text-[var(--text-muted)]">
                      显示第
                      <span className="font-medium text-[var(--text-primary)]">
                        {(page - 1) * pageSize + 1}
                      </span>
                      -
                      <span className="font-medium text-[var(--text-primary)]">
                        {Math.min(page * pageSize, total)}
                      </span>{' '}
                      条，共<span className="font-medium text-[var(--text-primary)]">{total}</span> 条{' '}
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
          {t('pages.userManagement.preRegisterQueue')}
          登录页"申请开通账号"通道 → POST /auth/pre-register 入队，
          管理员在此审核通过（自动建号）/ 拒绝。
          #prereg-queue: 页首待审核提醒横幅的锚点目标。
          ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-[var(--space-apple-md)]" id="prereg-queue">
        <Card>
          <CardContent className="p-[var(--space-apple-lg)] space-y-5">
            {/* 队列标题 + 状态 Tab */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UserRoundPlus className="w-5 h-5 text-[var(--color-primary-text)]" aria-hidden="true" />
                  账号申请
                  {preRegStatusCounts.pending > 0 && (
                    <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)] text-[var(--color-primary-text)] text-xs font-bold flex items-center justify-center">
                      {preRegStatusCounts.pending}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  登录页提交的账号开通申请，审核通过后自动创建用户
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  aria-label={t('pages.userManagement.preRegisterSearchAria')}
                  placeholder={t('pages.userManagement.preRegisterSearch')}
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
                    <TabsTrigger value="expired">已过期{preRegStatusCounts.expired ? ` (${preRegStatusCounts.expired})` : ''}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExportPreReg}>
                  {t('pages.userManagement.preRegExport')}
                </Button>
              </div>
            </div>

            {/* 批量操作栏 */}
            {preRegSelected.length > 0 && (
              <div className="flex items-center gap-2 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)]/40 border border-[var(--color-primary-border)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--color-primary-text)]">
                  {t('pages.userManagement.preRegSelected', { count: preRegSelected.length })}
                </span>
                <Button
                  variant="glass" size="sm"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  onClick={handleBatchApprove}
                  disabled={batchApprovePreRegMutation.isPending}
                >
                  {t('pages.userManagement.preRegBatchApprove')}
                </Button>
                <Button
                  variant="secondary" size="sm"
                  icon={<X className="w-3.5 h-3.5" />}
                  onClick={handleBatchReject}
                  disabled={batchRejectPreRegMutation.isPending}
                >
                  {t('pages.userManagement.preRegBatchReject')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreRegSelected([])}>
                  {t('pages.userManagement.preRegClearSelection')}
                </Button>
              </div>
            )}

            {/* 队列表格 */}
            {preRegLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-Apple-sm)]" />
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
                <table className="w-full text-sm min-w-[960px]">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="py-2.5 px-[var(--space-apple-sm)] w-8">
                        <Checkbox
                          checked={preRegPageSelected}
                          onCheckedChange={toggleSelectAllPreReg}
                          aria-label={t('pages.userManagement.preRegSelectAll')}
                        />
                      </th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThCreatedAt')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.thEmail')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThName')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThDepartment')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThReason')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThSource')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThVerify')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThDeadline')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThStatus')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium">{t('pages.userManagement.preRegThReviewer')}</th>
                      <th className="py-2.5 px-[var(--space-apple-sm)] font-medium text-right">{t('pages.userManagement.preRegThActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preRegItems.map((req) => {
                      const selected = preRegSelected.includes(req.id);
                      const isPending = req.status === 'pending';
                      const isExpired = req.status === 'expired';
                      const isOverdue = isPending && isRequestOverdue(req.created_at);
                      return (
                        <tr key={req.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors">
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)]">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleSelectOnePreReg(req.id)}
                              aria-label={`${t('pages.userManagement.preRegSelect')} ${req.email}`}
                            />
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-muted)] whitespace-nowrap">
                            {new Date(req.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] font-medium">{req.email}</td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)]">{req.full_name || '—'}</td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)]">{req.department || '—'}</td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)] max-w-[180px] truncate" title={req.apply_reason || ''}>
                            {req.apply_reason || '—'}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)] whitespace-nowrap">
                            {req.source === 'whitelist_page' ? t('pages.userManagement.preRegSourcePage')
                              : req.source === 'login' ? t('pages.userManagement.preRegSourceLogin')
                                : req.source === 'legacy' ? t('pages.userManagement.preRegSourceLegacy')
                                  : req.source || '—'}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)] whitespace-nowrap">
                            {req.email_verified_at ? '✓ ' + t('pages.userManagement.preRegVerified') : '—'}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)] whitespace-nowrap">
                            {req.review_deadline
                              ? new Date(req.review_deadline).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })
                              : req.cooldown_until
                                ? `${t('pages.userManagement.preRegCooldownUntil')} ${new Date(req.cooldown_until).toLocaleDateString('zh-CN')}`
                                : '—'}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)]">
                            <Badge variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : req.status === 'expired' ? 'secondary' : 'danger'} size="sm">
                              {preRegStatusLabel[req.status]}
                              {isOverdue && (
                                <span className="ml-1 normal-case text-xs font-bold text-[var(--color-error)]">{t('pages.userManagement.preRegOverdue')}</span>
                              )}
                              {req.status === 'rejected' && req.reject_reason && (
                                <span className="ml-1 normal-case text-xs opacity-80">（{req.reject_reason.slice(0, 12)}{req.reject_reason.length > 12 ? '…' : ''}）</span>
                              )}
                            </Badge>
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-[var(--text-secondary)] whitespace-nowrap">
                            {req.reviewed_by_name || '—'}
                          </td>
                          <td className="py-[var(--space-apple-md)] px-[var(--space-apple-sm)] text-right whitespace-nowrap">
                            {isPending ? (
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  variant="glass" size="sm"
                                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                  onClick={() => { setPreRegDetail(req); setPreRegApproveForm({ role: 'researcher', password: '', note: '' }); setPreRegRejectReason(''); }}
                                >
                                  {t('pages.userManagement.preRegApprove')}
                                </Button>
                                <Button
                                  variant="secondary" size="sm"
                                  icon={<X className="w-3.5 h-3.5" />}
                                  onClick={() => { setPreRegDetail(req); setPreRegRejectReason(''); }}
                                >
                                  {t('pages.userManagement.preRegReject')}
                                </Button>
                                {!req.email_verified_at && (
                                  <Button
                                    variant="ghost" size="sm"
                                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                                    onClick={() => resendPreRegMutation.mutate(req.id)}
                                    disabled={resendPreRegMutation.isPending}
                                  >
                                    {t('pages.userManagement.preRegResend')}
                                  </Button>
                                )}
                              </div>
                            ) : isExpired ? (
                              <Button
                                variant="secondary" size="sm"
                                icon={<RefreshCw className="w-3.5 h-3.5" />}
                                onClick={() => reactivatePreRegMutation.mutate(req.id)}
                                disabled={reactivatePreRegMutation.isPending}
                              >
                                {t('pages.userManagement.preRegReactivate')}
                              </Button>
                            ) : req.status === 'rejected' ? (
                              <Button
                                variant="ghost" size="sm"
                                icon={<RefreshCw className="w-3.5 h-3.5" />}
                                onClick={() => undoRejectPreRegMutation.mutate(req.id)}
                                disabled={undoRejectPreRegMutation.isPending}
                              >
                                {t('pages.userManagement.preRegUndoReject')}
                              </Button>
                            ) : (
                              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                                {req.status === 'approved' && req.user_id ? `→ 用户 #${req.user_id}` : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {preRegData && preRegData.total > preRegPageSize && (
                  <div className="px-[var(--space-apple-sm)] py-[var(--space-apple-md)] border-t border-[var(--border-color)] flex items-center justify-between">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      共 <span className="font-medium text-[var(--text-primary)]">{preRegData.total}</span> 条
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
            <div className="space-y-[var(--space-apple-sm)]">
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                <div className="w-10 h-10 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/25 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[var(--color-primary-text)]" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">{preRegDetail.email}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {preRegDetail.full_name || '未填姓名'}{preRegDetail.department ? ` · ${preRegDetail.department}` : ''}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                申请时间：{new Date(preRegDetail.created_at).toLocaleString('zh-CN')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)] text-xs text-[var(--text-muted)]">
                <span>来源：<strong className="text-[var(--text-primary)]">
                  {preRegDetail.source === 'whitelist_page' ? '白名单申请页'
                    : preRegDetail.source === 'login' ? '登录页'
                      : preRegDetail.source === 'legacy' ? '旧预登记'
                        : preRegDetail.source || '—'}
                </strong></span>
                <span>邮箱验证：<strong className="text-[var(--text-primary)]">
                  {preRegDetail.email_verified_at ? '已认证' : '未验证'}
                </strong></span>
                <span>审核截止：<strong className="text-[var(--text-primary)]">
                  {preRegDetail.review_deadline ? new Date(preRegDetail.review_deadline).toLocaleString('zh-CN') : '—'}
                </strong></span>
                <span>冷却截止：<strong className="text-[var(--text-primary)]">
                  {preRegDetail.cooldown_until ? new Date(preRegDetail.cooldown_until).toLocaleString('zh-CN') : '—'}
                </strong></span>
                <span>验证尝试：<strong className="text-[var(--text-primary)]">{preRegDetail.verify_attempts ?? 0} / 5</strong></span>
                <span>申请次数：<strong className="text-[var(--text-primary)]">{preRegDetail.attempt_count ?? 1}</strong></span>
                <span>申请 IP：<strong className="text-[var(--text-primary)]">{preRegDetail.ip_address || '—'}</strong></span>
                {preRegDetail.expired_at && (
                  <span>过期时间：<strong className="text-[var(--text-primary)]">
                    {new Date(preRegDetail.expired_at).toLocaleString('zh-CN')}
                  </strong></span>
                )}
              </div>
              {preRegDetail.apply_reason && (
                <p className="text-xs text-[var(--text-muted)]">
                  申请理由：<span className="text-[var(--text-secondary)]">{preRegDetail.apply_reason}</span>
                </p>
              )}
              {preRegDetail.review_note && (
                <p className="text-xs text-[var(--text-muted)]">
                  审核备注：<span className="text-[var(--text-secondary)]">{preRegDetail.review_note}</span>
                </p>
              )}
              {preRegDetail.status === 'rejected' && preRegDetail.reject_reason && (
                <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] p-[var(--space-apple-sm)] text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
                  <strong>拒绝原因：</strong>{preRegDetail.reject_reason}
                </div>
              )}
              {preRegDetail.status === 'approved' && preRegDetail.user_id && (
                <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-success-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)] p-[var(--space-apple-sm)] text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-text)] flex items-center justify-between">
                  <span><strong>已开通</strong>，对应用户 #{preRegDetail.user_id}</span>
                  <Button
                    variant="glass" size="sm"
                    onClick={() => {
                      adminApi.listUsers({ search: preRegDetail.email, page: 1, page_size: 1 })
                        .then((res) => {
                          const items = (res as unknown as { items?: UserDetail[]; data?: UserDetail[] }).items || (res as unknown as { items?: UserDetail[]; data?: UserDetail[] }).data || [];
                          if (items[0]) {
                            setDetailUser(items[0]);
                            setDetailTab('info');
                            setPreRegDetail(null);
                          } else {
                            toast.error('未找到对应用户');
                          }
                        })
                        .catch(() => toast.error('查询用户失败'));
                    }}
                  >
                    查看用户
                  </Button>
                </div>
              )}
            </div>

            {/* 待审核：操作区 */}
            {preRegDetail.status === 'pending' && (
              <div className="space-y-[var(--space-apple-md)] border-t border-[var(--border-color)] pt-[var(--space-apple-md)]">
                {/* 开通区 */}
                <div className="space-y-[var(--space-apple-sm)]">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-success-text)]0" />
                    开通账号
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--text-muted)]">初始角色</label>
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
                      <label className="text-xs text-[var(--text-muted)]">初始密码（可选，留空则系统生成）</label>
                      <Input
                        value={preRegApproveForm.password}
                        onChange={(e) => setPreRegApproveForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="留空则系统生成临时密码"
                        minLength={preRegApproveForm.password ? 8 : undefined}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs text-[var(--text-muted)]">审核备注（可选）</label>
                      <Input
                        value={preRegApproveForm.note}
                        onChange={(e) => setPreRegApproveForm((f) => ({ ...f, note: e.target.value }))}
                        placeholder="回填到申请的 review_note"
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
                      note: preRegApproveForm.note,
                    })}
                    disabled={approvePreRegMutation.isPending || (preRegApproveForm.password ? preRegApproveForm.password.length < 8 : false)}
                  >
                    确认开通并创建用户
                  </Button>
                </div>

                {/* 拒绝区 */}
                <div className="space-y-[var(--space-apple-sm)]">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <X className="w-4 h-4 text-[var(--color-error-text)]0" />
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
                        className={`w-20 h-20 rounded-[var(--radius-Apple-md)] flex items-center justify-center text-xl font-bold bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-800 shadow-lg ring-2 ring-white dark:ring-neutral-700 ${roleCfg.color}`}
                      >
                        {(detailUser.full_name || detailUser.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                          {detailUser.username}
                          {isSelf && <Badge size="sm">当前用户</Badge>}
                          {(detailUser.login_attempts ?? 0) >= 3 && (
                            <Tooltip content="存在异常登录行为">
                              <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)]0" />
                            </Tooltip>
                          )}
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">
                          {detailUser.full_name || '未设置姓名'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={statusCfg.variant}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium ${roleCfg.color}`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {roleCfg.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
                      {[
                        { icon: Hash, label: '用户 ID', value: String(detailUser.id) },
                        { icon: Mail, label: '邮箱', value: detailUser.email || '未设置' },
                        { icon: Phone, label: '电话', value: detailUser.phone || '未设置' },
                        { icon: Building2, label: '部门', value: detailUser.department || '未分配' },
                        {
                          icon: Building2,
                          label: '所属组织',
                          value: detailUser.organizations && detailUser.organizations.length > 0
                            ? detailUser.organizations.map(o => o.name).join('、')
                            : (detailUser.organization_name || '未加入组织'),
                        },
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
                          className={`flex items-start gap-2.5 p-2.5 rounded-[var(--radius-Apple-sm)] ${highlight ? 'bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/30' : 'bg-[var(--bg-tertiary)]'}`}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-[var(--color-warning-text)]0' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs text-[var(--text-muted)]">{label}</p>
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{value}</p>
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
                            phone: (detailUser as unknown as { phone?: string }).phone || '',
                            department: detailUser.department || '',
                          });
                          setEditErrors({});
                          setEditProfileOpen(true);
                        }}
                        className={`self-stretch flex items-center justify-center gap-2 px-[var(--space-apple-md)] py-2.5 rounded-[var(--radius-Apple-md)] text-sm font-medium border transition-all ${
                          isSelf
                            ? 'opacity-40 cursor-not-allowed border-[var(--border-color)] text-[var(--text-muted)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20'
                        }`}
                      >
                        <Edit3 className="w-4 h-4" /> 编辑资料
                      </button>
                    ) : (
                      <div className="self-stretch w-full space-y-[var(--space-apple-sm)] bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 p-[var(--space-apple-md)]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">编辑用户资料</span>
                          <button onClick={() => setEditProfileOpen(false)} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-secondary)]">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
                          <div className="space-y-1">
                            <label className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.userManagement.thEmail')}</label>
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                              placeholder="user@example.com"
                              prefix={<Mail size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                              error={!!editErrors.email}
                            />
                            {editErrors.email && <p className="text-xs text-[var(--color-error-text)]0">{editErrors.email}</p>}
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

                    {/* 更改密码（管理员重置） */}
                    <div className="pt-3 border-t border-[var(--border-color)]">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" aria-hidden="true" />
                          更改密码
                        </h4>
                        {!isSelf && !resetPwdOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setResetPwdOpen(true); setResetPwdResult(null); setResetPwdValue(''); }}
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" /> 重置密码
                          </Button>
                        )}
                      </div>
                      {isSelf ? (
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          不能在此修改自己的密码，请前往「个人设置」修改。
                        </p>
                      ) : resetPwdOpen ? (
                        <div className="space-y-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 bg-[var(--bg-secondary)] p-[var(--space-apple-md)]">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={resetPwdValue}
                              onChange={(e) => setResetPwdValue(e.target.value)}
                              placeholder="输入新密码（至少8位），留空则系统生成"
                              prefix={<KeyRound size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                              size="sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setResetPwdValue(generateRandomPassword())}
                            >
                              随机生成
                            </Button>
                          </div>
                          {resetPwdValue && resetPwdValue.length < 8 && (
                            <p className="text-xs text-[var(--color-error-text)]0">密码至少 8 个字符</p>
                          )}
                          {resetPwdResult && (
                            <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]/40 p-[var(--space-apple-sm)] text-xs break-all text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
                              {resetPwdResult}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setResetPwdOpen(false); setResetPwdResult(null); }}>
                              取消
                            </Button>
                            <Button
                              size="sm"
                              disabled={resetPwdLoading || (resetPwdValue.length > 0 && resetPwdValue.length < 8)}
                              onClick={handleResetPassword}
                            >
                              {resetPwdLoading ? '提交中...' : '确认重置'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          点击「重置密码」可为该用户设置新密码或生成临时密码。
                        </p>
                      )}
                    </div>

                    <div className="gap-2.5 pt-3 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] -mx-6 -mb-6 px-6 py-4 rounded-b-[var(--radius-Apple-md)] flex items-center">
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
                          className="flex-1 text-[var(--color-error-text)] border-[var(--color-error-border)] hover:bg-[var(--color-error-container)] dark:border-[var(--color-error)] dark:hover:bg-[var(--color-error-container)]/20"
                          onClick={() => {
                            requestStatusToggle(detailUser);
                            setDetailUser(null);
                          }}
                          disabled={statusMutation.isPending}
                        >
                          <EyeOff className="w-4 h-4 mr-1.5" /> 禁用此账户{' '}
                        </Button>
                      )}
                      {lockStatus?.is_locked && !isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-[var(--color-warning-text)] border-[var(--color-warning-border)] hover:bg-[var(--color-warning-container)] dark:border-[var(--color-warning)] dark:hover:bg-[var(--color-warning-container)]/20"
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

                    <div className="space-y-[var(--space-apple-sm)]">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">当前角色</h4>
                      <div
                        className={`inline-flex items-center gap-2 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-md)] ${roleCfg.bgColor} border ${roleCfg.color.split(' ')[0].replace('bg-', 'border-')}-200`}
                      >
                        <RoleIcon className="w-5 h-5" />
                        <span className="font-semibold">{roleCfg.label}</span>
                        <span className="text-xs opacity-70">（{roleCfg.description}）</span>
                      </div>
                    </div>

                    <div className="space-y-[var(--space-apple-sm)]">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{t('pages.userManagement.changeRole')}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ROLE_OPTIONS.filter((r) => r.value !== resolveRoleKey(detailUser.role)).map(
                          ({ value, label }) => {
                            const targetCfg = ROLE_CONFIG[value];
                            const TgtIcon = targetCfg?.icon;
                            return (
                              <button
                                key={value}
                                disabled={isSelf}
                                onClick={() => !isSelf && requestRoleChange(detailUser, value)}
                                className={`flex items-center gap-2.5 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border-2 transition-all text-left ${
                                  isSelf
                                    ? 'opacity-40 cursor-not-allowed border-[var(--border-color)]'
                                    : 'border-[var(--border-color)] hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)] hover:shadow-sm'
                                }`}
                              >
                                {TgtIcon && <TgtIcon className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                                <div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{targetCfg?.description}</p>
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {/* P5-7: 2FA Toggle（管理员管理） */}
                    <div className="pt-3 border-t border-[var(--border-color)]">
                      <div className="flex items-center justify-between p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]">
                        <div className="flex items-center gap-[var(--space-apple-sm)]">
                          <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)] flex items-center justify-center">
                            <KeyRound className="w-4 h-4 text-[var(--color-primary-text)]" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">两步验证 (2FA)</p>
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                              {isSelf ? '不能在详情页管理自己的 2FA，请前往个人设置' : '增强账户安全，登录时需要额外验证码'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--radius-pill)] ${
                            twofaQuery.data?.enabled
                              ? 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]'
                          }`}>
                            {twofaQuery.isLoading ? '加载中...' : twofaQuery.data?.enabled ? '已启用' : '未启用'}
                          </span>
                          {!isSelf && !twofaQuery.data?.enabled && (
                            <Button size="sm" onClick={handleEnable2fa} disabled={twofaQuery.isLoading}>
                              <KeyRound className="w-3.5 h-3.5 mr-1" /> 启用
                            </Button>
                          )}
                          {!isSelf && twofaQuery.data?.enabled && (
                            <Button
                              size="sm"
                              variant={confirmDisable2fa ? 'danger' : 'outline'}
                              onClick={() => {
                                if (confirmDisable2fa) {
                                  handleDisable2fa();
                                } else {
                                  setConfirmDisable2fa(true);
                                }
                              }}
                              onMouseLeave={() => setConfirmDisable2fa(false)}
                            >
                              {confirmDisable2fa ? '确认禁用？' : '禁用'}
                            </Button>
                          )}
                        </div>
                      </div>
                      {twofaSecretInfo && (
                        <div className="mt-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/40 bg-[var(--bg-secondary)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
                          <p className="text-xs font-medium text-[var(--text-primary)]">
                            2FA 已为「{twofaSecretInfo.username}」启用，请将以下密钥提供给用户添加至身份验证器：
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="flex-1 min-w-[200px] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] px-[var(--space-apple-sm)] py-2 text-xs font-mono break-all">
                              {twofaSecretInfo.secret}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard?.writeText(twofaSecretInfo.secret);
                                toast.success('密钥已复制');
                              }}
                            >
                              复制密钥
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="flex-1 min-w-[200px] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] px-[var(--space-apple-sm)] py-2 text-xs font-mono break-all">
                              {twofaSecretInfo.otpauth_url}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard?.writeText(twofaSecretInfo.otpauth_url);
                                toast.success('OTPAuth 链接已复制');
                              }}
                            >
                              复制链接
                            </Button>
                          </div>
                          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                            用户可使用 Google Authenticator / Microsoft Authenticator 等应用扫描二维码或手动输入密钥。
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[var(--border-color)]">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">权限说明</h4>
                      <div className="space-y-2">
                        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                          const isActive = resolveRoleKey(detailUser.role) === key;
                          const PermIcon = cfg.icon;
                          return (
                            <div
                              key={key}
                              className={`flex items-start gap-2.5 p-2 rounded-[var(--radius-Apple-sm)] ${isActive ? 'bg-[var(--color-primary-container)]/50 dark:bg-[var(--color-primary-container)]/10 ring-1 ring-[var(--color-primary-container)] dark:ring-[var(--color-primary)]' : ''}`}
                            >
                              <PermIcon
                                className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-[var(--color-primary-text)]' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}
                              />
                              <div>
                                <p
                                  className={`text-xs font-medium ${isActive ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-secondary)]'}`}
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
                  <div className="space-y-[var(--space-apple-md)]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Clock className="w-4 h-4" /> 最近活动记录{' '}
                      </h4>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">最近 7 天</span>
                    </div>

                    {userActivityQuery.isLoading ? (
                      <div className="py-8 text-center text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        加载中...
                      </div>
                    ) : !userActivityQuery.data?.items?.length ? (
                      <div className="py-8 text-center text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                        暂无活动记录
                      </div>
                    ) : (
                      <div className="relative pl-4 border-l-2 border-[var(--border-color)] space-y-0">
                        {userActivityQuery.data.items.map((log) => {
                          const record = {
                            id: log.id,
                            action: log.action || '未知操作',
                            time: log.created_at || '',
                            ip: log.ip_address || '-',
                            location: '本地',
                            status: (log.status_code === 200 || log.status_code === undefined) ? 'success' : 'failed',
                          };
                          return (
                            <div key={record.id} className="relative pb-[var(--space-apple-md)] last:pb-0">
                              <div
                                className={`absolute -left-[21px] w-3 h-3 rounded-[var(--radius-pill)] border-2 shadow-sm background-white dark:bg-[var(--bg-secondary)] ${
                                  record.status === 'success'
                                    ? 'border-[var(--color-success)] bg-[var(--color-primary-container)]0'
                                    : record.status === 'failed'
                                      ? 'border-[var(--color-error)] bg-[var(--color-error-container)]0'
                                      : 'border-[var(--color-warning)] bg-[var(--color-warning-container)]0'
                                }`}
                              />
                              <div className="pl-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-medium ${
                                      record.status === 'success'
                                        ? 'text-[var(--color-primary-text)]'
                                        : record.status === 'failed'
                                          ? 'text-[var(--color-error-text)]'
                                          : 'text-[var(--color-warning-text)]'
                                    }`}
                                  >
                                    {record.action}
                                  </span>
                                  {record.status === 'failed' && <AlertTriangle className="w-3 h-3 text-[var(--color-error-text)]0" />}
                                </div>
                                <div className="flex items-center gap-[var(--space-apple-sm)] mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" aria-hidden="true" />
                                    {(() => { const d = new Date(record.time); return isNaN(d.getTime()) ? record.time : d.toLocaleDateString('zh-CN'); })()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" aria-hidden="true" />
                                    {(() => { const d = new Date(record.time); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }); })()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" aria-hidden="true" />
                                    {record.location}
                                  </span>
                                  <span className="flex items-center gap-1 font-mono">
                                    <Wifi className="w-3 h-3" aria-hidden="true" />
                                    {record.ip}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-3 border-t border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                      <div className="text-center p-2 rounded-[var(--radius-Apple-sm)] bg-[var(--color-primary-container)]">
                        <p className="text-lg font-bold text-[var(--color-primary-text)] tabular-nums">
                          {userActivityQuery.data?.items ? userActivityQuery.data.items.filter((l) => l.status_code === 200).length : 0}
                        </p>
                        <p className="text-xs text-[var(--color-primary-text)]/70">成功操作</p>
                      </div>
                      <div className="text-center p-2 rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)]">
                        <p className="text-lg font-bold text-[var(--color-error-text)] tabular-nums">
                          {userActivityQuery.data?.items ? userActivityQuery.data.items.filter((l) => l.status_code !== 200).length : 0}
                        </p>
                        <p className="text-xs text-[var(--color-error-text)]">失败操作</p>
                      </div>
                      <div className="text-center p-2 rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)]">
                        <p className="text-lg font-bold text-[var(--color-warning-text)] tabular-nums">
                          {userActivityQuery.data?.items?.[0]?.created_at ? formatTimeAgo(userActivityQuery.data.items[0].created_at) : '—'}
                        </p>
                        <p className="text-xs text-[var(--color-warning-text)]/70">最近活动</p>
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
          <div className="space-y-[var(--space-apple-md)]">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{confirmAction.description}</p>
            {confirmAction.currentValue && confirmAction.newValue && (
              <div className="flex items-center gap-[var(--space-apple-sm)] p-2.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] text-sm">
                <span className="line-through text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{getRoleConfig(confirmAction.currentValue).label}</span>
                <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <span className="font-medium text-[var(--color-primary-text)]">
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
        <div className="space-y-[var(--space-apple-md)]">
          <Alert>
            <Upload className="w-4 h-4" />
            <AlertTitle>CSV 格式导入</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {`支持标准 CSV 格式文件。首行为标题行："${t('pages.userManagement.thUsername')}", "${t('pages.userManagement.preRegThName')}, ${t('pages.userManagement.thEmail')}, ${t('pages.userManagement.thRole')}, ${t('pages.userManagement.thDepartment')}`}
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-[var(--border-color)] rounded-[var(--radius-Apple-md)] p-8 text-center hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)] transition-colors">
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} aria-hidden="true" tabIndex={-1} />
            <Upload className="w-10 h-10 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-sm)]" />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              点击选择或拖拽 CSV 文件到此区域
            </p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-[var(--space-apple-md)]">支持 .csv 格式，最大 5MB</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-1.5" /> 选择文件
            </Button>
          </div>

          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] space-y-1">
            <p className="font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">CSV 格式示例：</p>
            <pre className="bg-[var(--bg-tertiary)] p-2.5 rounded-[var(--radius-Apple-sm)] overflow-x-auto font-mono text-xs leading-relaxed">
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
        <div className="space-y-[var(--space-apple-sm)] max-h-[400px] overflow-y-auto pr-1">
          {importErrorDetail.map((err: any, i: number) => (
            <div
              key={i}
              className="flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)]/30 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-[var(--color-error-text)]0 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
                  第 {err.row || '?'} 行 · {err.field || '未知字段'}
                </p>
                <p className="text-[var(--color-error-text)] dark:text-[var(--color-error-text)]/70 mt-0.5">{err.message || String(err)}</p>
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
        title={t('pages.userManagement.newUser')}
        size="md"
      >
        <div className="space-y-6">
          <Alert className="bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-secondary-900/20 dark:to-accent-900/10 border-[var(--color-secondary-border)]/60 dark:border-[var(--color-secondary)]/30">
            <div className="flex items-start gap-[var(--space-apple-sm)]">
              <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 flex items-center justify-center shadow-md ring-1 ring-white/50 shrink-0 mt-0.5">
                <UserRoundPlus className="w-4 h-4 text-[var(--color-primary-text)]" aria-hidden="true" />
              </div>
              <div>
                <AlertTitle className="text-sm">创建新用户账户</AlertTitle>
                <AlertDescription className="text-xs mt-1.5 leading-relaxed text-[var(--text-secondary)]">
                  填写以下信息创建新的系统用户。
                  <span className="font-medium text-[var(--text-primary)]">{t('pages.userManagement.thUsername')}</span>和
                  <span className="font-medium text-[var(--text-primary)]">密码</span>为必填项。{' '}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">
                {t('pages.userManagement.thUsername')}<span className="text-[var(--color-error-text)]0 ml-0.5">*</span>
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
                className="focus:ring-2 focus:ring-[var(--color-primary-container)] dark:focus:ring-[var(--color-primary)] transition-all duration-200"
              />
              {createErrors.username && <p className="text-xs text-[var(--color-error-text)]0 mt-1">{createErrors.username}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                密码 <span className="text-[var(--color-error-text)]0">*</span>
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
                  className="h-10 pr-9 focus:ring-2 focus:ring-[var(--color-primary-container)] dark:focus:ring-[var(--color-primary)] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] transition-colors"
                >
                  <EyeIcon size={14} />
                </button>
              </div>
              {createErrors.password && <p className="text-xs text-[var(--color-error-text)]0 mt-1">{createErrors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                {t('pages.userManagement.thEmail')} <span className="text-[var(--color-error-text)]0">*</span>
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
                className="h-10 focus:ring-2 focus:ring-[var(--color-primary-container)] dark:focus:ring-[var(--color-primary)] transition-all duration-200"
              />
              {createErrors.email && <p className="text-xs text-[var(--color-error-text)]0 mt-1">{createErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">姓名</label>
              <Input
                value={createForm.full_name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="真实姓名（可选）"
                prefix={<UserCog size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
                className="h-10 focus:ring-2 focus:ring-[var(--color-primary-container)] dark:focus:ring-[var(--color-primary)] transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)]">角色</label>
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
              <label className="text-xs font-medium text-[var(--text-secondary)]">部门</label>
              <Input
                value={createForm.department}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="所属部门（可选）"
                prefix={<Building2 size={14} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />}
                size="sm"
                className="focus:ring-2 focus:ring-[var(--color-primary-container)] dark:focus:ring-[var(--color-primary)] transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">组织</label>
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

          <div className="bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-700/30 border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] p-[14px] ring-1 ring-neutral-200/60 dark:ring-neutral-700/40">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                <Zap className="w-3 h-3" /> 提示：{' '}
              </span>
              新创建的用户默认状态为「正常」。创建后可随时在列表中修改角色或禁用账户。{t('pages.userManagement.thUsername')}仅支持英文字母、数字和下划线，密码长度至少8位。{' '}
            </p>
          </div>

          <div className="flex items-center gap-[var(--space-apple-sm)] pt-1">
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
                  role: UserRole.RESEARCHER,
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
