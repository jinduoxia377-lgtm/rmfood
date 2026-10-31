import { useMemo, useState, useEffect, memo } from 'react'
import {
  Users,
  Activity,
  HardDrive,
  Zap,
  UserPlus,
  FolderPlus,
  Shield,
  Clock,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/api/client'
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail'

interface OverviewTabProps {
  organizationId: number
  members: Member[]
  teams: Team[]
  memberCount: number
  teamCount: number
  organization?: {
    storageUsed: number
    storageLimit: number
    apiCalls?: number
  }
  onInvite?: (email: string, role?: Role) => Promise<void>
  onRemoveMember?: (memberId: number) => Promise<void>
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>
  onDeleteTeam?: (teamId: number) => Promise<void>
  onRefresh?: () => void
  onNavigateTab?: (tab: 'members' | 'teams' | 'settings') => void
}

interface ActivityItem {
  id: string
  type: 'join' | 'upload' | 'create' | 'update' | 'leave'
  user: { name: string; avatar?: string }
  target: string
  targetType: string
  time: string
}

// 活动来自真实审计日志（后端 GET /organizations/{id}/audit-log）
interface AuditLog {
  action_type?: string
  username?: string
  target_type?: string
  target_id?: number
  metadata?: Record<string, unknown>
  created_at?: string
}

function mapAuditActivities(logs: AuditLog[]): ActivityItem[] {
  const typeMap: Record<string, ActivityItem['type']> = {
    'teams.create': 'create',
    'teams.update': 'update',
    'teams.delete': 'leave',
    'organization.clone': 'create',
    'organization.create': 'create',
    'organization.archive': 'update',
    'organization.restore': 'update',
    'members.invite': 'join',
    'members.role_change': 'update',
    'members.custom_roles': 'update',
    'permissions.update': 'update',
  }
  return logs.slice(0, 8).map((log) => {
    const action = log.action_type || 'update'
    const metadata = log.metadata || {}
    const targetName =
      (typeof metadata.name === 'string' && metadata.name) ||
      (typeof metadata.role === 'string' ? `角色 ${metadata.role}` : '') ||
      '组织'
    return {
      id: String(log.target_id ?? action),
      type: typeMap[action] || 'update',
      user: { name: log.username || '未知用户' },
      target: targetName,
      targetType: String(
        metadata.targetType ||
        (log.target_type === 'team' ? '团队' : log.target_type === 'organization' ? '组织' : '') ||
        '',
      ),
      time: formatTimeAgo(log.created_at || ''),
    }
  })
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '刚刚'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const ACTIVITY_ICONS: Record<ActivityItem['type'], typeof Users> = {
  join: UserPlus,
  upload: FileText,
  create: FolderPlus,
  update: FileText,
  leave: Users,
}

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  join: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]',
  upload: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]',
  create: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
  update: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
  leave: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]',
}

const ACTIVITY_LABELS: Record<ActivityItem['type'], string> = {
  join: '加入了',
  upload: '上传了',
  create: '创建了',
  update: '更新了',
  leave: '离开了',
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  trend,
}: {
  icon: typeof Users
  label: string
  value: string | number
  subValue?: string
  color: string
  trend?: { value: string; up: boolean }
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] p-5 border border-[var(--border-color)] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
        <div className={cn('w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-[var(--radius-pill)]',
              trend.up ? 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]' : 'bg-[var(--color-error-container)] text-[var(--color-error-text)] dark:bg-[var(--color-error-container)]/25 dark:text-[var(--color-error-text)]',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-muted)] mt-0.5">{label}</p>
      {subValue && <p className="text-xs text-[var(--text-muted)] mt-1">{subValue}</p>}
    </div>
  )
}

const OverviewTab = memo(({ organizationId, members, memberCount, teamCount, organization, onNavigateTab }: OverviewTabProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // 最近活动：来自真实审计日志
  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivityLoading(true)
    api.get(`/organizations/${organizationId}/audit-log`)
      .then((res) => {
        if (cancelled) return
        const logs = res.data?.logs || res.data?.items || []
        setActivities(mapAuditActivities(logs))
      })
      .catch(() => { if (!cancelled) setActivities([]) })
      .finally(() => { if (!cancelled) setActivityLoading(false) })
    return () => { cancelled = true }
  }, [organizationId])

  const recentActivities = activities
  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'active').length
    const activeRate = memberCount > 0 ? Math.round((activeMembers / memberCount) * 100) : 0

    return [
      {
        icon: Users,
        label: '成员总数',
        value: memberCount,
        subValue: `${activeMembers} 人活跃`,
        color: 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]',
      },
      {
        icon: Activity,
        label: '活跃率',
        value: `${activeRate}%`,
        subValue: `共 ${memberCount} 名成员`,
        color: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] dark:bg-[var(--color-primary-container)]/25 dark:text-[var(--color-primary-text)]',
      },
      {
        icon: HardDrive,
        label: '存储空间',
        value: organization?.storageUsed ? `${(organization.storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB` : '-',
        subValue: `/ ${organization?.storageLimit ? `${(organization.storageLimit / (1024 * 1024 * 1024)).toFixed(0)}GB` : '-'}`,
        color: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]',
      },
      {
        icon: Zap,
        label: 'API 调用',
        value: organization?.apiCalls?.toLocaleString() || (organization as unknown as Record<string, unknown>)?.apiUsage?.toLocaleString() || '-',
        subValue: '近 30 天累计',
        color: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)] dark:bg-[var(--color-warning-container)]/25 dark:text-[var(--color-warning-text)]',
      },
    ]
  }, [members, memberCount, teamCount, organization])

  const quickActions = useMemo(
    () => [
      { icon: UserPlus, label: '邀请成员', description: '邀请新成员加入组织', primary: true, tab: 'members' as const },
      { icon: FolderPlus, label: '创建团队', description: '创建新的工作团队', primary: false, tab: 'teams' as const },
      { icon: Shield, label: '设置权限', description: '管理角色和权限配置', primary: false, tab: 'settings' as const },
    ],
    [],
  )

  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-8">
      {/* Stats Grid */}
      <section aria-label="统计概览">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">数据概览</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      {/* Recent Activities */}
      <section aria-label="最近活动">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">最近活动</h2>
          <button
            onClick={() => onNavigateTab?.('members')}
            className="text-sm text-[var(--color-secondary-text)] hover:text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] dark:hover:text-[var(--color-secondary-text)] flex items-center gap-1 transition-colors cursor-pointer"
          >
            查看全部 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] divide-y divide-neutral-100 dark:divide-neutral-700">
          {activityLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
              加载活动记录...
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
              暂无活动记录
            </div>
          ) : (
            recentActivities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type]
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-secondary)]/30 transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="relative flex flex-col items-center">
                    <div className={cn('w-9 h-9 rounded-[var(--radius-pill)] flex items-center justify-center shrink-0', ACTIVITY_COLORS[activity.type])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {index < recentActivities.length - 1 && (
                      <div className="w-px h-full bg-[var(--border-color)] absolute top-10" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium text-[var(--text-primary)]">{activity.user.name}</span>{' '}
                      {ACTIVITY_LABELS[activity.type]}{' '}
                      <span className="font-medium text-[var(--text-primary)]">"{activity.target}"</span>
                      <span className="text-[var(--text-muted)] ml-1">{activity.targetType}</span>
                    </p>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {activity.time}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="快捷操作">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5">快捷操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                onClick={() => onNavigateTab?.(action.tab)}
                className={cn(
                  'group flex items-start gap-4 p-5 rounded-[var(--radius-Apple-md)] border transition-all text-left cursor-pointer',
                  action.primary
                    ? 'border-[var(--color-secondary-border)] bg-[var(--color-secondary-container)]/50 dark:border-[var(--color-secondary)] dark:bg-[var(--color-secondary-container)]/15 hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)] hover:shadow-md'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)] dark:border-neutral-700 dark:bg-[var(--bg-tertiary)] hover:border-[var(--border-color)] dark:hover:border-neutral-600 hover:shadow-sm',
                )}
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-[var(--radius-Apple-md)] flex items-center justify-center shrink-0 transition-colors',
                    action.primary
                      ? 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] group-hover:bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/30 dark:text-[var(--color-secondary-text)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] group-hover:bg-[var(--border-color)] dark:text-[var(--text-muted)]',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      action.primary
                        ? 'text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {action.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{action.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
})

export default OverviewTab

