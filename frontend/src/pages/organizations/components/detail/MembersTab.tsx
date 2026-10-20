import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Search,
  UserPlus,
  MoreVertical,
  Mail,
  Trash2,
  Crown,
  Shield,
  UserCheck,
  Eye,
  Loader2,
  Filter,
  ChevronDown,
  X,
  Users,
  Download,
  Ban,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import api from '@/api/client';
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail';

interface MembersTabProps {
  organizationId: number;
  members: Member[];
  teams: Team[];
  memberCount: number;
  teamCount: number;
  organization?: { storageUsed: number; storageLimit: number; apiCalls?: number; plan: string };
  onInvite?: (email: string, role?: Role) => Promise<void>;
  onRemoveMember?: (memberId: number) => Promise<void>;
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>;
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>;
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>;
  onDeleteTeam?: (teamId: number) => Promise<void>;
  onRefresh?: () => void;
  canManageMembers?: boolean;
}

const ROLE_OPTIONS: { value: Role; label: string; description: string; color: string }[] = [
  { value: 'owner', label: '所有者', description: '拥有所有权限', color: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' },
  { value: 'admin', label: '管理员', description: '可管理成员和设置', color: 'text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]' },
  { value: 'member', label: '成员', description: '标准权限', color: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' },
  { value: 'viewer', label: '访客', description: '只读访问', color: 'text-[var(--text-muted)]' },
];

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; textColor: string }> = {
  active: { label: '活跃', dotColor: 'bg-[var(--color-success-container)]0', textColor: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' },
  pending: { label: '待激活', dotColor: 'bg-[var(--color-warning-container)]0', textColor: 'text-[var(--color-warning-text)]' },
  invited: { label: '已邀请', dotColor: 'bg-[var(--color-secondary-container)]0', textColor: 'text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]' },
  suspended: { label: '已停用', dotColor: 'bg-[var(--color-error-container)]0', textColor: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]' },
};

function getRoleIcon(role: Role) {
  switch (role) {
    case 'owner':
      return <Crown className="w-4 h-4 text-[var(--color-warning-text)]0" />;
    case 'admin':
      return <Shield className="w-4 h-4 text-[var(--color-secondary-text)]0" />;
    case 'member':
      return <UserCheck className="w-4 h-4 text-[var(--color-success-text)]0" />;
    case 'viewer':
      return <Eye className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />;
    default:
      return null;
  }
}

function getRoleBadgeClass(role: Role): string {
  const map: Record<Role, string> = {
    owner: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
    admin: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]',
    member: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]',
    viewer: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
  };
  return map[role] || map.viewer;
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

function MemberAvatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-[var(--radius-pill)] object-cover shrink-0')}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-[var(--radius-pill)] bg-gradient-to-br from-secondary-500 to-accent-500 flex items-center justify-center text-white font-medium shrink-0',
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentOption = ROLE_OPTIONS.find((r) => r.value === value);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium transition-colors cursor-pointer',
          getRoleBadgeClass(value),
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {getRoleIcon(value)}
        {currentOption?.label}
        {!disabled && <ChevronDown className="w-3 h-3" />}
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10"  role="button" tabIndex={0} onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-40 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] shadow-lg border border-[var(--border-color)] py-1 z-20 animate-scale-in">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-[var(--space-apple-sm)] py-2 text-sm transition-colors text-left',
                  option.value === value
                    ? 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]',
                )}
              >
                {getRoleIcon(option.value)}
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const MembersTab = memo(
  ({ organizationId, members, memberCount, onInvite, onRemoveMember, onUpdateRole, onRefresh, canManageMembers = true }: MembersTabProps) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<Role>('member');
    const [inviting, setInviting] = useState(false);
    const [actionMenuMemberId, setActionMenuMemberId] = useState<number | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);

    const filteredMembers = useMemo(() => {
      return members.filter((member) => {
        const matchSearch =
          !searchQuery ||
          member.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchRole = roleFilter === 'all' || member.role === roleFilter;
        const matchStatus = statusFilter === 'all' || member.status === statusFilter;
        return matchSearch && matchRole && matchStatus;
      });
    }, [members, searchQuery, roleFilter, statusFilter]);

    const handleInvite = useCallback(async () => {
      if (!inviteEmail.trim()) {
        toast.warning('请输入邮箱地址');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteEmail)) {
        toast.error('请输入有效的邮箱地址');
        return;
      }

      setInviting(true);
      try {
        await onInvite?.(inviteEmail.trim(), inviteRole);
        toast.success(`邀请已发送至 ${inviteEmail}`);
        setInviteEmail('');
        setInviteRole('member');
        setShowInviteModal(false);
      } catch (err: any) {
        toast.error(err.message || '邀请失败，请重试');
      } finally {
        setInviting(false);
      }
    }, [inviteEmail, inviteRole, onInvite, toast]);

    const handleRemove = useCallback(
      async (memberId: number) => {
        setRemovingId(memberId);
        try {
          await onRemoveMember?.(memberId);
          toast.success('成员已移除');
          setActionMenuMemberId(null);
        } catch (err: any) {
          toast.error(err.message || '移除失败');
        } finally {
          setRemovingId(null);
        }
      },
      [onRemoveMember, toast],
    );

    const handleUpdateRole = useCallback(
      async (memberId: number, newRole: Role) => {
        setUpdatingRoleId(memberId);
        try {
          await onUpdateRole?.(memberId, newRole);
          toast.success('角色已更新');
        } catch (err: any) {
          toast.error(err.message || '更新失败');
        } finally {
          setUpdatingRoleId(null);
        }
      },
      [onUpdateRole, toast],
    );

    // ── 批量操作（真实调用后端 batch 接口）──
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [batchRole, setBatchRole] = useState<Role>('member');
    const [batchBusy, setBatchBusy] = useState(false);

    const toggleSelect = useCallback((userId: number) => {
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        if (next.has(userId)) next.delete(userId); else next.add(userId);
        return next;
      });
    }, []);

    const toggleSelectAll = useCallback(() => {
      setSelectedMemberIds((prev) => {
        if (prev.size === filteredMembers.length) return new Set();
        return new Set(filteredMembers.map((m) => m.userId));
      });
    }, [filteredMembers]);

    const runBatch = useCallback(async (action: string, extra?: Record<string, unknown>) => {
      const ids = Array.from(selectedMemberIds);
      if (ids.length === 0) return;
      setBatchBusy(true);
      try {
        const body: Record<string, unknown> = { user_ids: ids, ...extra };
        await api.post(`/organizations/${organizationId}/members/${action}`, body);
        toast.success(`批量操作成功（${ids.length} 人）`);
        setSelectedMemberIds(new Set());
        onRefresh?.();
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || '批量操作失败，请重试');
      } finally {
        setBatchBusy(false);
      }
    }, [selectedMemberIds, organizationId, toast, onRefresh]);

    const handleBatchExport = useCallback(async () => {
      const ids = Array.from(selectedMemberIds);
      if (ids.length === 0) return;
      try {
        const res = await api.post(`/organizations/${organizationId}/members/export`, { user_ids: ids }, { params: { format_type: 'csv' }, responseType: 'blob' });
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `members_${organizationId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`已导出 ${ids.length} 名成员`);
      } catch {
        toast.error('导出失败，请重试');
      }
    }, [selectedMemberIds, organizationId, toast]);

    // ── 自定义角色分配 ──
    const [orgCustomRoles, setOrgCustomRoles] = useState<Array<{ code: string; name: string; description?: string }>>([]);
    const [assignMember, setAssignMember] = useState<{ userId: number; displayName: string; codes: string[] } | null>(null);
    const [assignBusy, setAssignBusy] = useState(false);

    const loadCustomRoles = useCallback(async () => {
      try {
        const { data } = await api.get(`/organizations/${organizationId}/roles`);
        setOrgCustomRoles(data?.roles ?? []);
      } catch { /* 忽略 */ }
    }, [organizationId]);

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomRoles();
  }, [loadCustomRoles]);

    const roleNameOf = useCallback((code: string) => {
      return orgCustomRoles.find(r => r.code === code)?.name || code;
    }, [orgCustomRoles]);

    const openAssign = useCallback((member: Member) => {
      loadCustomRoles();
      setAssignMember({ userId: member.userId, displayName: member.displayName, codes: [...(member.customRoles ?? [])] });
    }, [loadCustomRoles]);

    const saveAssign = useCallback(async () => {
      if (!assignMember) return;
      setAssignBusy(true);
      try {
        await api.put(`/organizations/${organizationId}/members/${assignMember.userId}/custom-roles`, { role_codes: assignMember.codes });
        toast.success('自定义角色已更新');
        setAssignMember(null);
        onRefresh?.();
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || '分配失败，请重试');
      } finally {
        setAssignBusy(false);
      }
    }, [assignMember, organizationId, toast, onRefresh]);

    const activeMembers = members.filter((m) => m.status === 'active').length;

    return (
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">成员管理</h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              共 {memberCount} 名成员 · {activeMembers} 人活跃
            </p>
          </div>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 px-[var(--space-apple-md)] py-2.5 bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container transition-colors text-sm font-medium shadow-sm shadow-secondary-500/25"
            >
              <UserPlus className="w-4 h-4" />
              邀请成员
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            <input
              type="text"
              placeholder="搜索姓名或邮箱..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors">
                <Filter className="w-4 h-4" />
                角色
                <ChevronDown className="w-3 h-3" />
              </button>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="按角色筛选"
              >
                <option value="all">全部角色</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <button className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors">
                <Filter className="w-4 h-4" />
                状态
                <ChevronDown className="w-3 h-3" />
              </button>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="按状态筛选"
              >
                <option value="all">全部状态</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 批量操作栏（仅管理员可见） */}
        {canManageMembers && selectedMemberIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/50 bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/10">
            <span className="text-sm font-medium text-[var(--color-primary-text)]">
              已选择 {selectedMemberIds.size} 名成员
            </span>
            <select
              value={batchRole}
              onChange={(e) => setBatchRole(e.target.value as Role)}
              className="min-h-[40px] rounded-[var(--radius-Apple-sm)] border border-input bg-[var(--bg-secondary)] px-2 py-1.5 text-sm"
              aria-label="批量角色"
            >
              {ROLE_OPTIONS.filter((r) => r.value !== 'owner').map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={() => runBatch('batch-role', { role: batchRole })}
              disabled={batchBusy}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-secondary-container text-secondary-main disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" /> 批量改角色
            </button>
            <button
              onClick={() => runBatch('batch-suspend')}
              disabled={batchBusy}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-[var(--color-warning-container)] text-[var(--color-warning-text)] disabled:opacity-50"
            >
              <Ban className="w-4 h-4" /> 批量停用
            </button>
            <button
              onClick={() => runBatch('batch-resume')}
              disabled={batchBusy}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-[var(--color-success-container)] text-[var(--color-success-text)] disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> 批量恢复
            </button>
            <button
              onClick={() => runBatch('batch-remove')}
              disabled={batchBusy}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-[var(--color-error-container)] text-[var(--color-error-text)] disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> 批量移除
            </button>
            <button
              onClick={handleBatchExport}
              disabled={batchBusy}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> 导出 CSV
            </button>
            <button
              onClick={() => setSelectedMemberIds(new Set())}
              className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              取消选择
            </button>
            {batchBusy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary-text)]" />}
          </div>
        )}

        {/* Members Table */}
        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-[var(--space-apple-sm)]" />
              <p className="text-[var(--text-muted)] font-medium">暂无匹配的成员</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? '尝试调整筛选条件'
                  : '点击上方按钮邀请第一位成员'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="成员列表">
                <thead>
                  <tr className="border-b border-[var(--border-color)] dark:border-neutral-700 bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-tertiary)]/50">
                    <th className="px-[var(--space-apple-md)] py-4 w-10">
                      {canManageMembers && (
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.size === filteredMembers.length && filteredMembers.length > 0}
                          onChange={toggleSelectAll}
                          aria-label="全选成员"
                          className="rounded"
                        />
                      )}
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      成员
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      角色
                    </th>
                    <th className="hidden md:table-cell px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      加入时间
                    </th>
                    <th className="hidden lg:table-cell px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      最后活跃
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]/30 transition-colors group"
                    >
                      <td className="px-[var(--space-apple-md)] py-4">
                        {canManageMembers && (
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.has(member.userId)}
                            onChange={() => toggleSelect(member.userId)}
                            aria-label={`选择 ${member.displayName}`}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/users?highlight=${member.userId}`)}
                          className="flex items-center gap-[var(--space-apple-sm)] text-left group/member"
                          title="点击查看用户详情"
                        >
                          <MemberAvatar name={member.displayName} avatarUrl={member.avatarUrl} />
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate group-hover/member:text-[var(--color-primary-text)] dark:group-hover/member:text-[var(--color-primary-text)] transition-colors">
                              {member.displayName}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        {updatingRoleId === member.id ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-secondary-text)]0" />
                            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">更新中...</span>
                          </div>
                        ) : (
                          <>
                            <RoleSelect
                              value={member.role}
                              onChange={(newRole) => handleUpdateRole(member.userId, newRole)}
                              disabled={member.role === 'owner'}
                            />
                            {member.customRoles && member.customRoles.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 max-w-[180px]">
                                {member.customRoles.map(code => (
                                  <span
                                    key={code}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/15 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]/50 truncate max-w-[140px]"
                                    title={roleNameOf(code)}
                                  >
                                    {roleNameOf(code)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-5 py-4 text-sm text-[var(--text-muted)]">
                        {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="hidden lg:table-cell px-5 py-4 text-sm text-[var(--text-muted)]">
                        {formatTimeAgo(member.lastActiveAt || '')}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-[var(--radius-pill)]',
                              STATUS_CONFIG[member.status]?.dotColor || 'bg-neutral-400',
                            )}
                          />
                          <span
                            className={cn(
                              'text-xs font-medium',
                              STATUS_CONFIG[member.status]?.textColor || 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]',
                            )}
                          >
                            {STATUS_CONFIG[member.status]?.label || member.status}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuMemberId(actionMenuMemberId === member.id ? null : member.id)}
                            className="p-1.5 rounded-[var(--radius-Apple-sm)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="更多操作"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {actionMenuMemberId === member.id && (
                            <>
                              <div className="fixed inset-0 z-10"  role="button" tabIndex={0} onClick={() => setActionMenuMemberId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] shadow-lg border border-[var(--border-color)] py-1 z-20 animate-scale-in">
                                <button
                                  onClick={() => { setActionMenuMemberId(null); openAssign(member); }}
                                  className="flex items-center gap-2 w-full px-[var(--space-apple-sm)] py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  分配自定义角色
                                </button>
                                <button
                                  onClick={() => handleRemove(member.userId)}
                                  disabled={removingId === member.id || member.role === 'owner'}
                                  className={cn(
                                    'flex items-center gap-2 w-full px-[var(--space-apple-sm)] py-2 text-sm transition-colors',
                                    removingId === member.id
                                      ? 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] cursor-not-allowed'
                                      : 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/10',
                                    member.role === 'owner' && 'opacity-50 cursor-not-allowed',
                                  )}
                                >
                                  {removingId === member.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  移除成员
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          {filteredMembers.length > 0 && (
            <div className="px-5 py-4 border-t border-[var(--border-color)] dark:border-neutral-700 flex items-center justify-between text-sm text-[var(--text-muted)]">
              <span>
                显示 {filteredMembers.length} / {memberCount} 名成员
              </span>
            </div>
          )}
        </div>

        {/* Invite Modal */}
        <Modal
          open={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setInviteEmail('');
          }}
          title="邀请新成员"
          size="md"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="invite-email"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
              >
                邮箱地址
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  placeholder="colleague@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="invite-role"
                className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
              >
                初始角色
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent"
              >
                {ROLE_OPTIONS.filter((r) => r.value !== 'owner').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] p-[var(--space-apple-sm)]">
              <p className="text-sm text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">
                邀请邮件将发送至指定邮箱，受邀者可通过链接加入组织。
              </p>
            </div>

            <div className="flex justify-end gap-[var(--space-apple-sm)] pt-2">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                }}
                className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm rounded-[var(--radius-Apple-sm)] transition-colors',
                  inviting || !inviteEmail.trim()
                    ? 'bg-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed'
                    : 'bg-secondary-container text-secondary-main hover:bg-secondary-container',
                )}
              >
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                发送邀请
              </button>
            </div>
          </div>
        </Modal>

        {/* 分配自定义角色 Modal */}
        <Modal
          open={!!assignMember}
          onClose={() => setAssignMember(null)}
          title={`分配自定义角色：${assignMember?.displayName || ''}`}
          size="md"
        >
          <div className="space-y-[var(--space-apple-md)]">
            <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
              选择要授予该成员的自定义角色（additive 授权，不影响系统角色）。
            </p>
            {orgCustomRoles.length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                暂无自定义角色，请先在「设置 → 自定义角色」中创建。
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto">
                {orgCustomRoles.map(role => {
                  const checked = assignMember?.codes.includes(role.code) ?? false;
                  return (
                    <label
                      key={role.code}
                      className={`flex items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border cursor-pointer transition-all ${
                        checked
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-container)]'
                          : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAssignMember(prev => prev ? {
                            ...prev,
                            codes: checked
                              ? prev.codes.filter(c => c !== role.code)
                              : [...prev.codes, role.code],
                          } : prev)
                        }
                        className="rounded"
                      />
                      <div>
                        <p className="font-medium text-[var(--text-primary)] text-sm">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{role.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-[var(--space-apple-sm)] pt-2">
              <button
                onClick={() => setAssignMember(null)}
                className="px-[var(--space-apple-md)] py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveAssign}
                disabled={assignBusy}
                className="inline-flex items-center gap-2 px-[var(--space-apple-md)] py-2 text-sm rounded-[var(--radius-Apple-sm)] transition-colors bg-secondary-container text-secondary-main hover:bg-secondary-container disabled:opacity-50"
              >
                {assignBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                保存分配
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
);

export default MembersTab;
