/**
 * 最近配方列表
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Common'

interface FormulaItem {
  id: number
  name: string
  code: string
  status: string
}

interface Props {
  items: FormulaItem[] | null
  loading: boolean
}

export const RecentFormulas: FC<Props> = ({ items, loading }) => {
  const { t } = useTranslation()
  // C-06: 骨架行数自适应实际条数（加载态未知时默认 3）
  const skeletonRows = items?.length ? Math.min(5, Math.max(2, items.length)) : 3

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle as="h2" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t('pages.dashboard.cards.recentFormulas')}</CardTitle>
            <span className="text-xs text-primary-700 hover:text-primary-700 dark:text-primary-700 font-semibold">{t('pages.dashboard.cards.viewAll')}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="px-6 py-3"><Skeleton className="h-5 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const list = items?.length ? items.slice(0, 5) : []

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle as="h2" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('pages.dashboard.cards.recentFormulas')}</CardTitle>
          <Link to="/formulas" className="text-xs text-primary-700 hover:text-primary-700 dark:text-primary-700 font-semibold flex items-center gap-1 transition-colors min-h-[44px] px-2 -mx-2 -my-3.5">
            {t('pages.dashboard.cards.viewAll')} <ArrowRight size={14} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
          {list.length === 0 ? (
            <div className="px-6 py-10 text-center text-neutral-500 dark:text-neutral-400 text-sm">{t('pages.dashboard.cards.noFormulaData')}</div>
          ) : (
            list.map((f) => (
              <Link key={f.id} to={`/formulas/${f.id}`} className="block px-6 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{f.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{f.code}</p>
                  </div>
                  <StatusBadge status={f.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
