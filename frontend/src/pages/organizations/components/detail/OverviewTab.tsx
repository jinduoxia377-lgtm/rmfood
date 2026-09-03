import { useMemo, memo } from 'react'
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
}

interface ActivityItem {
  id: string
  type: 'join' | 'upload' | 'create' | 'update' | 'leave'
  user: { name: string; avatar?: string }
  target: string
  targetType: string
  time: string
}

// Activities are derived from members/teams data instead of mock
function deriveActivities(members: Member[], teams: Team[]): ActivityItem[] {
  const activities: ActivityItem[] = []
  members.slice(0, 3).forEach((m, i) => {
    activities.push({
      id: `join-${m.id}`,
      type: 'join' as const,
      user: { name: m.displayName },
      target: teams[i % teams.length]?.name || '组织',
      targetType: '团队',
      time: formatTimeAgo(m.joinedAt),
    })
  })
  return activities
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
  join: 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
  upload: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400',
  create: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  update: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  leave: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
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
    <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              trend.up ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white">{value}</p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</p>
      {subValue && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{subValue}</p>}
    </div>
  )
}

const OverviewTab = memo(({ members, teams, memberCount, teamCount, organization }: OverviewTabProps) => {
  const recentActivities = useMemo(() => deriveActivities(members, teams), [members, teams])
  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'active').length
    const activeRate = memberCount > 0 ? Math.round((activeMembers / memberCount) * 100) : 0

    return [
      {
        icon: Users,
        label: '成员总数',
        value: memberCount,
        subValue: `${activeMembers} 人活跃`,
        color: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400',
        trend: { value: '+12%', up: true },
      },
      {
        icon: Activity,
        label: '活跃率',
        value: `${activeRate}%`,
        subValue: '较上周 +3%',
        color: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
        trend: { value: '+3%', up: true },
      },
      {
        icon: HardDrive,
        label: '存储空间',
        value: organization?.storageUsed ? `${(organization.storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB` : '-',
        subValue: `/ ${organization?.storageLimit ? `${(organization.storageLimit / (1024 * 1024 * 1024)).toFixed(0)}GB` : '-'}`,
        color: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
      },
      {
        icon: Zap,
        label: 'API 调用',
        value: organization?.apiCalls?.toLocaleString() || '-',
        subValue: '本月累计',
        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        trend: { value: '+8%', up: true },
      },
    ]
  }, [members, memberCount, teamCount, organization])

  const quickActions = useMemo(
    () => [
      { icon: UserPlus, label: '邀请成员', description: '邀请新成员加入组织', primary: true },
      { icon: FolderPlus, label: '创建团队', description: '创建新的工作团队', primary: false },
      { icon: Shield, label: '设置权限', description: '管理角色和权限配置', primary: false },
    ],
    [],
  )

  return (
    <div className="p-8 space-y-8">
      {/* Stats Grid */}
      <section aria-label="统计概览">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-5">数据概览</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      {/* Recent Activities */}
      <section aria-label="最近活动">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">最近活动</h2>
          <button className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300 flex items-center gap-1 transition-colors">
            查看全部 <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 divide-y divide-slate-100 dark:divide-slate-700">
          {recentActivities.map((activity, index) => {
            const Icon = ACTIVITY_ICONS[activity.type]
            return (
              <div
                key={activity.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-neutral-700/30 transition-colors"
              >
                {/* Timeline dot */}
                <div className="relative flex flex-col items-center">
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', ACTIVITY_COLORS[activity.type])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {index < recentActivities.length - 1 && (
                    <div className="w-px h-full bg-neutral-200 dark:bg-neutral-700 absolute top-10" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium text-neutral-900 dark:text-white">{activity.user.name}</span>{' '}
                    {ACTIVITY_LABELS[activity.type]}{' '}
                    <span className="font-medium text-neutral-900 dark:text-white">"{activity.target}"</span>
                    <span className="text-neutral-500 dark:text-neutral-400 ml-1">{activity.targetType}</span>
                  </p>
                </div>

                {/* Time */}
                <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {activity.time}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="快捷操作">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-5">快捷操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.label}
                className={cn(
                  'group flex items-start gap-4 p-5 rounded-xl border transition-all text-left',
                  action.primary
                    ? 'border-blue-200 bg-secondary-50/50 dark:border-blue-800 dark:bg-secondary-900/10 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                    : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm',
                )}
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    action.primary
                      ? 'bg-secondary-100 text-secondary-600 group-hover:bg-secondary-200 dark:bg-secondary-900/40 dark:text-secondary-400'
                      : 'bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-400',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      action.primary
                        ? 'text-secondary-700 dark:text-secondary-300'
                        : 'text-neutral-900 dark:text-white',
                    )}
                  >
                    {action.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{action.description}</p>
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
