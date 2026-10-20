/**
 * 用户角色分布统计卡（API-05）
 * 消费 /dashboard/statistics 的 users.by_role（guest/researcher/formulator/reviewer/admin）
 */
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, ShieldCheck, FlaskConical, ClipboardList, UserCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardSkeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

interface UserRoleStatsProps {
  byRole: Record<string, number>
  total: number
  loading?: boolean
}

const ROLE_META: Record<string, { labelKey: string; Icon: typeof Users; color: string; bar: string }> = {
  guest: { labelKey: 'pages.dashboard.cards.guest', Icon: Users, color: 'text-neutral-500 dark:text-neutral-400', bar: 'bg-neutral-400' },
  researcher: { labelKey: 'pages.dashboard.cards.researcher', Icon: FlaskConical, color: 'text-secondary-600 dark:text-secondary-700', bar: 'bg-secondary-500' },
  formulator: { labelKey: 'pages.dashboard.cards.formulator', Icon: Users, color: 'text-primary-700 dark:text-primary-700', bar: 'bg-primary-500' },
  reviewer: { labelKey: 'pages.dashboard.cards.reviewer', Icon: ShieldCheck, color: 'text-warning-600 dark:text-warning-700', bar: 'bg-warning-500' },
  admin: { labelKey: 'pages.dashboard.cards.admin', Icon: ClipboardList, color: 'text-error-600 dark:text-error-600', bar: 'bg-error-500' },
}

const ROLE_ORDER = ['admin', 'reviewer', 'formulator', 'researcher', 'guest']

export const UserRoleStats: FC<UserRoleStatsProps> = ({ byRole, total, loading }) => {
  const { t } = useTranslation()
  if (loading) {
    return <CardSkeleton count={1} className="h-full" />
  }

  const maxCount = Math.max(1, ...Object.values(byRole))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserCheck size={18} className="text-primary-700 dark:text-primary-700" />
            <CardTitle as="h2" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pages.dashboard.cards.userRoleDistribution')}</CardTitle>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('pages.dashboard.cards.totalUsers', { total })}</span>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="space-y-3">
          {ROLE_ORDER.filter((role) => byRole[role] !== undefined).map((role) => {
            const meta = ROLE_META[role]
            const count = byRole[role] ?? 0
            const percent = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={role} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={cn('flex items-center gap-1.5 font-medium', meta.color)}>
                    <meta.Icon size={13} />
                    {t(meta.labelKey)}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {t('pages.dashboard.cards.usersCount', { count, percent })}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', meta.bar)}
                    style={{ width: `${Math.max(count > 0 ? 4 : 0, (count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}