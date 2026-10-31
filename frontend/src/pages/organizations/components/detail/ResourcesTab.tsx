import { useMemo, memo } from 'react'
import {
  HardDrive,
  Zap,
  Users,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Inbox,
  BarChart3,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail'

interface ResourcesTabProps {
  organizationId: number
  members: Member[]
  teams: Team[]
  memberCount: number
  teamCount: number
  organization?: {
    storageUsed: number
    storageLimit: number
    apiUsage?: number
    apiCalls?: number
    apiLimit?: number
    plan: string
    id?: number
  }
  onInvite?: (email: string, role?: Role) => Promise<void>
  onRemoveMember?: (memberId: number) => Promise<void>
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>
  onDeleteTeam?: (teamId: number) => Promise<void>
  onRefresh?: () => void
  onNavigateTab?: (tab: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getStorageColor(percentage: number): { bar: string; text: string } {
  if (percentage < 60) return { bar: 'bg-[var(--color-success-container)]0', text: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' }
  if (percentage < 90) return { bar: 'bg-[var(--color-warning-container)]0', text: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' }
  return { bar: 'bg-[var(--color-error-container)]0', text: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]' }
}

function ProgressBar({
  value,
  max,
  showLabel = true,
  height = 8,
  format = 'bytes',
}: {
  value: number
  max: number
  showLabel?: boolean
  height?: number
  format?: 'bytes' | 'number'
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const colors = getStorageColor(percentage)

  const formattedValue = format === 'bytes' ? formatBytes(value) : value.toLocaleString()
  const formattedMax = format === 'bytes' ? formatBytes(max) : max.toLocaleString()

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', colors.text)}>
          {formattedValue} / {formattedMax}
        </span>
        {showLabel && (
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-[var(--radius-pill)]', colors.bar.replace('bg-', 'bg-opacity-20 bg-').replace('500', '100') + ` ${colors.text}`)}>
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="w-full bg-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden" style={{ height }}>
        <div
          className={cn('h-full rounded-[var(--radius-pill)] transition-all duration-500 ease-out', colors.bar)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}

/** 通用「暂无数据」空态（功能待后端支持） */
function NotSupportedEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText
  title: string
  description: string
}) {
  return (
    <div className="border border-dashed border-[var(--border-color)] dark:border-neutral-700 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-md)] py-8 text-center">
      <Icon className="w-8 h-8 mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-2" />
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{description}</p>
    </div>
  )
}

const ResourcesTab = memo(({ organization, memberCount, onRefresh, onNavigateTab }: ResourcesTabProps) => {
  const storageUsed = useMemo(() => organization?.storageUsed || 0, [organization])
  const storageLimit = useMemo(() => organization?.storageLimit || 10 * 1024 * 1024 * 1024, [organization])

  // Plan-based limits（与后端 PLAN_LIMITS 对齐：free=5/pro=20/enterprise=无限制）
  const planLimits: Record<string, { members: number; apiCalls: number }> = {
    free: { members: 5, apiCalls: 1000 },
    pro: { members: 20, apiCalls: 10000 },
    enterprise: { members: -1, apiCalls: -1 },
  }
  const planConfig = planLimits[organization?.plan || 'free'] || planLimits.free
  const apiCallsUsed = useMemo(
    () => organization?.apiUsage ?? organization?.apiCalls ?? 0,
    [organization],
  )
  // 优先使用后端返回的 apiLimit，缺失时回退到计划配置
  const apiCallsLimit = useMemo(
    () => organization?.apiLimit ?? planConfig.apiCalls,
    [organization, planConfig],
  )
  const memberLimit = useMemo(() => planConfig.members, [planConfig])

  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">资源配额</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">查看组织的存储空间、API 调用和成员席位使用情况</p>
      </div>

      {/* Storage Section */}
      <section aria-label="存储空间" className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-8 space-y-6">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className="w-11 h-11 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/25 flex items-center justify-center">
            <HardDrive className="w-5.5 h-5.5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">存储空间</h3>
            <p className="text-sm text-[var(--text-muted)]">文件和数据占用情况</p>
          </div>
        </div>

        <ProgressBar value={storageUsed} max={storageLimit} />

        {/* 文件类型分布（后端暂无接口，不展示假数据） */}
        <NotSupportedEmptyState
          icon={FileText}
          title="暂无文件类型分布数据"
          description="文件类型分布接口尚未提供，功能待后端支持"
        />

        {/* 大文件 TOP 10（后端暂无文件级明细接口，不展示假数据） */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            大文件 TOP 10
          </h4>
          <NotSupportedEmptyState
            icon={Inbox}
            title="暂无大文件数据"
            description="文件级明细接口尚未提供，功能待后端支持"
          />
        </div>
      </section>

      {/* API Calls Section */}
      <section aria-label="API调用配额" className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-8 space-y-6">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className="w-11 h-11 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 flex items-center justify-center">
            <Zap className="w-5.5 h-5.5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">API 调用配额</h3>
            <p className="text-sm text-[var(--text-muted)]">本月 API 使用量统计</p>
          </div>
        </div>

        <ProgressBar value={apiCallsUsed} max={apiCallsLimit} format="number" />

        {/* API 端点排行（后端暂无端点级统计接口，不展示假数据） */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            端点使用排行 TOP 10
          </h4>
          <NotSupportedEmptyState
            icon={BarChart3}
            title="暂无 API 端点排行数据"
            description="端点级统计接口尚未提供，功能待后端支持"
          />
        </div>
      </section>

      {/* Members Section */}
      <section aria-label="成员席位" className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-8 space-y-6">
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className="w-11 h-11 rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25 flex items-center justify-center">
            <Users className="w-5.5 h-5.5 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">成员席位</h3>
            <p className="text-sm text-[var(--text-muted)]">组织成员数量与上限</p>
          </div>
        </div>

        <ProgressBar
          value={memberCount}
          max={memberLimit > 0 ? memberLimit : memberCount + 10}
          showLabel={memberLimit > 0}
          format="number"
        />

        {memberLimit <= 0 && (
          <p className="text-sm text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-sm)] px-[var(--space-apple-sm)] py-2">
            企业版计划无成员数量限制
          </p>
        )}

        {/* Invite Link & Upgrade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="rounded-[var(--radius-Apple-sm)] border border-dashed border-[var(--border-color)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
            <p className="text-sm font-medium text-[var(--text-primary)]">邀请成员</p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] leading-relaxed">
              组织邀请采用「邮箱 + 一次性令牌」闭环：在成员页输入邮箱发送邀请后，系统会生成带 token 的邀请链接并通过邮件发送。
              受邀人打开
              <code className="mx-1 px-1 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] dark:bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                {window.location.origin}/invitations/accept?token=...
              </code>
              即可接受邀请并加入组织。
            </p>
            <button
              onClick={() => onNavigateTab?.('members')}
              className="inline-flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 text-xs font-medium bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              前往成员页发送邀请
            </button>
          </div>

          <div className="rounded-[var(--radius-Apple-sm)] bg-gradient-to-br from-secondary-50 to-accent-50 dark:from-secondary-900/20 dark:to-accent-900/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] p-[var(--space-apple-md)] space-y-2">
            <p className="text-sm font-medium text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] flex items-center gap-1.5">
              需要更多席位？
              <ArrowUpRight className="w-4 h-4" />
            </p>
            <p className="text-xs text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">升级计划以解锁更多成员席位和高级功能</p>
            <button
              onClick={() => onRefresh?.()}
              className="mt-1 px-[var(--space-apple-sm)] py-1.5 text-xs font-medium bg-secondary-container text-secondary-main rounded-[var(--radius-Apple-sm)] hover:bg-secondary-container transition-colors"
            >
              刷新数据
            </button>
          </div>
        </div>
      </section>
    </div>
  )
})

export default ResourcesTab