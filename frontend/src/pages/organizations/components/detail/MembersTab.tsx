import { useState, useMemo, useCallback, memo } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail'

interface MembersTabProps {
  organizationId: number
  members: Member[]
  teams: Team[]
  memberCount: number
  teamCount: number
  organization: any
  onInvite?: (email: string, role?: Role) => Promise<void>
  onRemoveMember?: (memberId: number) => Promise<void>
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>
  onDeleteTeam?: (teamId: number) => Promise<void>
  onRefresh?: () => void
}

const ROLE_OPTIONS: { value: Role; label: string; description: string; color: string }[] = [
  { value: 'owner', label: '所有者', description: '拥有所有权限', color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'admin', label: '管理员', description: '可管理成员和设置', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'member', label: '成员', description: '标准权限', color: 'text-green-600 dark:text-green-400' },
  { value: 'viewer', label: '访客', description: '只读访问', color: 'text-gray-500 dark:text-gray-400' },
]

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; textColor: string }> = {
  active: { label: '活跃', dotColor: 'bg-green-500', textColor: 'text-green-700 dark:text-green-400' },
  pending: { label: '待激活', dotColor: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400' },
  invited: { label: '已邀请', dotColor: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-400' },
  suspended: { label: '已停用', dotColor: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' },
}

function getRoleIcon(role: Role) {
  switch (role) {
    case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />
    case 'admin': return <Shield className="w-4 h-4 text-blue-500" />
    case 'member': return <UserCheck className="w-4 h-4 text-green-500" />
    case 'viewer': return <Eye className="w-4 h-4 text-slate-400" />
    default: return null
  }
}

function getRoleBadgeClass(role: Role): string {
  const map: Record<Role, string> = {
    owner: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    member: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    viewer: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  }
  return map[role] || map.viewer
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 30) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

function MemberAvatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover shrink-0')}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium shrink-0',
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (role: Role) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const currentOption = ROLE_OPTIONS.find((r) => r.value === value)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
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
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 animate-scale-in">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left',
                  option.value === value
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
                )}
              >
                {getRoleIcon(option.value)}
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const MembersTab = memo(({ organizationId, members, onInvite, onRemoveMember, onUpdateRole }: MembersTabProps) => {
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)
  const [actionMenuMemberId, setActionMenuMemberId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null)

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchSearch =
        !searchQuery ||
        member.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchRole = roleFilter === 'all' || member.role === roleFilter
      const matchStatus = statusFilter === 'all' || member.status === statusFilter
      return matchSearch && matchRole && matchStatus
    })
  }, [members, searchQuery, roleFilter, statusFilter])

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      toast.warning('请输入邮箱地址')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      toast.error('请输入有效的邮箱地址')
      return
    }

    setInviting(true)
    try {
      await onInvite?.(inviteEmail.trim(), inviteRole)
      toast.success(`邀请已发送至 ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('member')
      setShowInviteModal(false)
    } catch (err: any) {
      toast.error(err.message || '邀请失败，请重试')
    } finally {
      setInviting(false)
    }
  }, [inviteEmail, inviteRole, onInvite, toast])

  const handleRemove = useCallback(async (memberId: number) => {
    setRemovingId(memberId)
    try {
      await onRemoveMember?.(memberId)
      toast.success('成员已移除')
      setActionMenuMemberId(null)
    } catch (err: any) {
      toast.error(err.message || '移除失败')
    } finally {
      setRemovingId(null)
    }
  }, [onRemoveMember, toast])

  const handleUpdateRole = useCallback(async (memberId: number, newRole: Role) => {
    setUpdatingRoleId(memberId)
    try {
      await onUpdateRole?.(memberId, newRole)
      toast.success('角色已更新')
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    } finally {
      setUpdatingRoleId(null)
    }
  }, [onUpdateRole, toast])

  const activeMembers = members.filter((m) => m.status === 'active').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">成员管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            共 {memberCount} 名成员 · {activeMembers} 人活跃
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-500/25"
        >
          <UserPlus className="w-4 h-4" />
          邀请成员
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索姓名或邮箱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <button className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <button className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
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
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">暂无匹配的成员</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? '尝试调整筛选条件'
                : '点击上方按钮邀请第一位成员'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="成员列表">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">成员</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">角色</th>
                  <th className="hidden md:table-cell px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">加入时间</th>
                  <th className="hidden lg:table-cell px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">最后活跃</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">状态</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={member.displayName} avatarUrl={member.avatarUrl} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{member.displayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {updatingRoleId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          <span className="text-xs text-slate-400">更新中...</span>
                        </div>
                      ) : (
                        <RoleSelect
                          value={member.role}
                          onChange={(newRole) => handleUpdateRole(member.id, newRole)}
                          disabled={member.role === 'owner'}
                        />
                      )}
                    </td>
                    <td className="hidden md:table-cell px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="hidden lg:table-cell px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatTimeAgo(member.lastActiveAt || '')}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full', STATUS_CONFIG[member.status]?.dotColor || 'bg-slate-400')} />
                        <span className={cn('text-xs font-medium', STATUS_CONFIG[member.status]?.textColor || 'text-slate-500')}>
                          {STATUS_CONFIG[member.status]?.label || member.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setActionMenuMemberId(actionMenuMemberId === member.id ? null : member.id)
                          }
                          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="更多操作"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {actionMenuMemberId === member.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActionMenuMemberId(null)} />
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 animate-scale-in">
                              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Mail className="w-3.5 h-3.5" />
                                发送消息
                              </button>
                              <button
                                onClick={() => handleRemove(member.id)}
                                disabled={removingId === member.id || member.role === 'owner'}
                                className={cn(
                                  'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors',
                                  removingId === member.id
                                    ? 'text-slate-400 cursor-not-allowed'
                                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10',
                                  (member.role === 'owner') && 'opacity-50 cursor-not-allowed',
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
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>显示 {filteredMembers.length} / {memberCount} 名成员</span>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteEmail('') }}
        title="邀请新成员"
        size="md"
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="colleague@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              初始角色
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ROLE_OPTIONS.filter((r) => r.value !== 'owner').map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              邀请邮件将发送至指定邮箱，受邀者可通过链接加入组织。
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowInviteModal(false); setInviteEmail('') }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors',
                inviting || !inviteEmail.trim()
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
            >
              {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
              发送邀请
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
})

export default MembersTab
