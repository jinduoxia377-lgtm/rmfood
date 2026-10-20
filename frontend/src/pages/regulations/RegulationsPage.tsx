/**
 * 合规标准页面 — 独立页面版（仪表盘框架升级）
 * 展示国家标准（GB 2760/GB 14880/药食同源）、禁忌搭配、合规检查
 *
 * 原为 DatabasePage 的 regulations Tab，现独立为 /regulations 路由
 * 参照 DashboardPage 框架升级：顶部欢迎横幅 + KPI 统计卡片行 + 内容区
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck, ShieldAlert, FileText, BookOpen,
  Beaker, TestTube, CheckCircle2, AlertTriangle,
  XCircle, Search, RefreshCw, Download,
  Pill, Scale, X, ExternalLink, Info,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Button, Badge, Input, StatCard,
} from '@/components/ui'
import { complianceApi } from '@/api/compliance'
import type { ComplianceResult } from '@/api/compliance'

// ─── 居中详情弹窗 ───
function DetailModal({
  item, type, onClose,
}: {
  item: any; type: 'standard' | 'gb2760' | 'gb14880' | 'prohibited'; onClose: () => void
}) {
  const { t } = useTranslation()
  const isStandard  = type === 'standard'
  const isGb2760    = type === 'gb2760'
  const isGb14880   = type === 'gb14880'
  const isProhibited = type === 'prohibited'

  const headerBg = isStandard  ? 'from-primary-600 to-primary-700'
                 : isGb2760   ? 'from-info-600 to-info-700'
                 : isGb14880  ? 'from-accent-600 to-accent-700'
                 : 'from-error-600 to-error-700'

  const titleIcon = isStandard  ? <FileText aria-hidden="true" size={15} className="shrink-0" />
                  : isGb2760   ? <Beaker aria-hidden="true" size={15} className="shrink-0" />
                  : isGb14880  ? <TestTube aria-hidden="true" size={15} className="shrink-0" />
                  : <ShieldAlert aria-hidden="true" size={15} className="shrink-0" />

  const title = isStandard  ? `${item?.standard_code} · ${item?.title}`
              : isGb2760   ? `${item?.name} — GB 2760 详情`
              : isGb14880  ? `${item?.name} — GB 14880 详情`
              : `${item?.name} — 禁用品详情`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-[var(--space-apple-md)]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--bg-secondary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[var(--border-color)]">
        <div className={`flex items-center justify-between px-6 py-3.5 bg-gradient-to-r ${headerBg} text-white shrink-0`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {titleIcon}
            <h2 className="font-semibold text-sm truncate">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}
            className="text-[var(--color-primary-text)]/80 dark:text-white/80 hover:text-[var(--color-primary-text)] dark:hover:text-white hover:bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-sm)] transition-colors">
            <X size={16} />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {isStandard && (() => {
            const s = item
            return (
              <div className="space-y-[var(--space-apple-md)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                  <InfoBlock label={t('pages.regulations.thStandardCode')} value={s.standard_code} />
                  <InfoBlock label={t('pages.regulations.status')} value={<Badge variant={s.status === t('pages.regulations.statusLatest') ? 'default' : 'outline'}>{s.status}</Badge>} />
                  <InfoBlock label={t('pages.regulations.thApprovalDate')} value={s.publish_date} />
                  <InfoBlock label={t('pages.regulations.thImplementationDate')} value={s.implementation_date} />
                  <InfoBlock label={t('pages.regulations.thPriority')} value={<Badge variant={s.priority?.startsWith('P0') ? 'default' : 'secondary'} className="text-xs">{s.priority?.replace('P0-核心必备', t('pages.regulations.priorityCore')).replace('P1-重要', t('pages.regulations.priorityImportant'))}</Badge>} />
                  <InfoBlock label={t('pages.regulations.thCategory')} value={s.category} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">{t('pages.regulations.standardSummary')}</p>
                  <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">{s.summary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">{t('pages.regulations.detailedContent')}</p>
                  <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)] whitespace-pre-wrap">{s.content || s.summary}</p>
                </div>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-primary-text)] hover:underline">
                    <ExternalLink aria-hidden="true" size={12} />{t('pages.regulations.viewOfficialStandard')}
                  </a>
                )}
              </div>
            )
          })()}

          {isGb2760 && (() => {
            const a = item
            return (
              <div className="space-y-[var(--space-apple-md)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                  <InfoBlock label={t('pages.regulations.thName')} value={a.name} />
                  <InfoBlock label={t('pages.regulations.thFunction')} value={<Badge variant="outline" className="text-xs">{a.function}</Badge>} />
                  <InfoBlock label="CAS号" value={a.cas || '—'} />
                  <InfoBlock label="E编码" value={a.e_number || '—'} />
                  <InfoBlock label={t('pages.regulations.thMaxUsage')} value={<span className="font-semibold text-info-600 dark:text-info-600">{a.max_usage}</span>} />
                  <InfoBlock label={t('pages.regulations.thNotes')} value={a.notes || '—'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">{t('pages.regulations.applicableFoodCategories')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(a.categories || []).map((cat: string, j: number) => (
                      <span key={j} className="px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-info-50 dark:bg-info-300/20 text-info-700 dark:text-info-600 border border-info-200 dark:border-info-800">{cat}</span>
                    ))}
                  </div>
                </div>
                {a.notes && (
                  <div className="bg-[var(--color-warning-container)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                    <p className="text-xs font-semibold text-[var(--color-warning-text)] mb-1 flex items-center gap-1.5">
                      <AlertTriangle aria-hidden="true" size={12} />{t('pages.regulations.notes')}
                    </p>
                    <p className="text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">{a.notes}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {isGb14880 && (() => {
            const e = item
            return (
              <div className="space-y-[var(--space-apple-md)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                  <InfoBlock label={t('pages.regulations.thName')} value={e.name} />
                  <InfoBlock label={t('pages.regulations.thFunction')} value={<Badge variant="outline" className="text-xs">{e.function}</Badge>} />
                  <InfoBlock label="CAS号" value={e.cas || '—'} />
                  <InfoBlock label={t('pages.regulations.thDailyLimit')} value={<span className="font-semibold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.min}</span>} />
                  <InfoBlock label={t('pages.regulations.thMaxUsage')} value={<span className="font-semibold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.max}</span>} />
                  <InfoBlock label={t('pages.regulations.thNotes')} value={e.notes || '—'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">{t('pages.regulations.applicableFoodCategories')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(e.categories || []).map((cat: string, j: number) => (
                      <span key={j} className="px-2.5 py-1 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]">{cat}</span>
                    ))}
                  </div>
                </div>
                {e.notes && (
                  <div className="bg-info-50 dark:bg-info-300/15 border border-info-200 dark:border-info-800 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                    <p className="text-xs font-semibold text-info-700 dark:text-info-600 mb-1 flex items-center gap-1.5">
                      <Info aria-hidden="true" size={12} />说明
                    </p>
                    <p className="text-sm text-info-800 dark:text-info-600">{e.notes}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {isProhibited && (() => {
            const p = item
            return (
              <div className="space-y-[var(--space-apple-md)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                  <InfoBlock label={t('pages.regulations.thName')} value={<span className="font-semibold text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{p.name}</span>} />
                  <InfoBlock label={t('pages.regulations.thCategory')} value={<Badge variant="destructive" className="text-xs">{p.category}</Badge>} />
                  <InfoBlock label={t('pages.regulations.viewOfficialStandard')} value={p.source_law} />
                  <InfoBlock label={t('pages.regulations.thRestrictedGroups')} value={p.reason} />
                </div>
                <div className="bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-md)]">
                  <p className="text-xs font-semibold text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle aria-hidden="true" size={14} />{t('pages.regulations.hazard')}
                  </p>
                  <p className="text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)] leading-relaxed">{p.hazard}</p>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── 合规状态徽标（页面内复用） ───
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    compliant:    { color: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]', bg: 'bg-[var(--color-success-container)]', border: 'border-[var(--color-success-border)] dark:border-[var(--color-success)]', label: t('pages.regulations.statusCompliant') },
    warning:      { color: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]', bg: 'bg-[var(--color-warning-container)]', border: 'border-[var(--color-warning-border)] dark:border-[var(--color-warning)]', label: t('pages.regulations.statusWarning') },
    non_compliant:{ color: 'text-[var(--color-error-text)]  dark:text-[var(--color-error-text)]',   bg: 'bg-[var(--color-error-container)]',   border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]',   label: t('pages.regulations.statusNonCompliant') },
  }
  const c = config[status] ?? config.compliant
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-semibold border ${c.bg} ${c.border} ${c.color}`}>
      <CheckCircle2 aria-hidden="true" className="w-3 h-3" /> {c.label}
    </span>
  )
}

// ─── 违规类型标签（页面内复用） ───
function ViolationTypeTag({ type }: { type: string }) {
  const { t } = useTranslation()
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    exceeds_limit:  { label: t('pages.regulations.violationExceeds'),  color: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bg: 'bg-[var(--color-error-container)]', border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]' },
    prohibited_combo: { label: t('pages.regulations.violationProhibitedCombo'), color: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]', bg: 'bg-[var(--color-warning-container)]', border: 'border-[var(--color-warning-border)] dark:border-[var(--color-warning)]' },
    child_forbidden:{ label: t('pages.regulations.violationChildForbidden'), color: 'text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]', bg: 'bg-[var(--color-accent-container)]', border: 'border-[var(--color-accent-border)] dark:border-[var(--color-accent)]' },
    not_in_directory:{ label: t('pages.regulations.violationNotInDirectory'),  color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-tertiary)]', border: 'border-[var(--border-color)]' },
    gb2760:         { label: 'GB 2760', color: 'text-info-600  dark:text-info-600',   bg: 'bg-info-50   dark:bg-info-300/20',   border: 'border-info-200 dark:border-info-800' },
    gb14880:        { label: 'GB 14880',color: 'text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]', bg: 'bg-[var(--color-accent-container)]', border: 'border-[var(--color-accent-border)] dark:border-[var(--color-accent)]' },
    prohibited_tcm: { label: t('pages.regulations.violationProhibitedTcm'),  color: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bg: 'bg-[var(--color-error-container)]', border: 'border-[var(--color-error-border)] dark:border-[var(--color-error)]' },
  }
  const c = config[type] ?? config.not_in_directory
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium border ${c.bg} ${c.border} ${c.color}`}>
      {c.label}
    </span>
  )
}

// ─── CSV 导出辅助 ───
function exportCSV(rows: Record<string, any>[], columns: string[], filename: string) {
  const csvRows = rows.map(row =>
    columns.map(c => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const blob = new Blob(['\uFEFF' + [columns.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 主组件 ───
export default function RegulationsPage() {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<'standards' | 'homology' | 'gb' | 'prohibited' | 'check'>('standards')
  const [population, setPopulation] = useState<'adults' | 'children' | 'elderly'>('adults')
  const [ingredients, setIngredients] = useState<{ name: string; dosage_mg: string }[]>([{ name: '', dosage_mg: '' }])
  const [checkResult, setCheckResult] = useState<ComplianceResult | null>(null)
  const [checking, setChecking] = useState(false)

  // 搜索状态
  const [standardSearch, setStandardSearch] = useState('')
  const [standardCategory, setStandardCategory] = useState('')
  const [homologySearch, setHomologySearch] = useState('')
  const [prohibitedSearch, setProhibitedSearch] = useState('')
  const [showCheckResult, setShowCheckResult] = useState(false)

  // 详情弹窗状态（居中固定，不受滚动影响）
  const [detailModal, setDetailModal] = useState<{ type: 'standard' | 'gb2760' | 'gb14880' | 'prohibited'; item: any } | null>(null)

  // 排序状态
  const [gb2760Sort, setGb2760Sort] = useState<{ field: 'name' | 'max_usage'; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
  const [gb14880Sort, setGb14880Sort] = useState<{ field: 'name' | 'min' | 'max'; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
  const [homologySort] = useState<{ field: 'name' | 'max_dosage'; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
  const [standardsSort, setStandardsSort] = useState<{ field: 'standard_code' | 'publish_date' | 'category'; dir: 'asc' | 'desc' }>({ field: 'publish_date', dir: 'desc' })

  // 加载所有合规数据
  const { data: limitsData, isLoading: limitsLoading } = useQuery({
    queryKey: ['compliance-limits'], queryFn: () => complianceApi.getLimits(),
  })
  const { data: prohibitedData, isLoading: prohibitedLoading } = useQuery({
    queryKey: ['compliance-prohibited'], queryFn: () => complianceApi.getProhibited(),
  })
  const { data: gb2760Data, isLoading: gb2760Loading } = useQuery({
    queryKey: ['compliance-gb2760'], queryFn: () => complianceApi.getGB2760(), retry: 1,
  })
  const { data: gb14880Data, isLoading: gb14880Loading } = useQuery({
    queryKey: ['compliance-gb14880'], queryFn: () => complianceApi.getGB14880(), retry: 1,
  })
  const { data: gbProhibitedData, isLoading: gbProhibitedLoading } = useQuery({
    queryKey: ['compliance-gb-prohibited'], queryFn: () => complianceApi.getGBProhibited(), retry: 1,
  })
  const { data: standardsData, isLoading: standardsLoading } = useQuery({
    queryKey: ['compliance-standards', standardCategory], queryFn: () => complianceApi.getStandards(standardCategory || undefined), retry: 1,
  })
  const { data: homologyData, isLoading: homologyLoading } = useQuery({
    queryKey: ['compliance-food-homology', homologySearch], queryFn: () => complianceApi.getFoodHomology(homologySearch || undefined), retry: 1,
  })

  // 统计数据
  const limits = limitsData?.data?.limits ?? {}
  const prohibitedPairs = prohibitedData?.data?.combinations ?? []
  const gb2760Additives = gb2760Data?.data?.additives ?? []
  const gb14880Enrichers = gb14880Data?.data?.enrichers ?? []
  const gbProhibitedItems = gbProhibitedData?.data?.items ?? []
  const foodSafetyStandards = standardsData?.data?.standards ?? []
  const foodHomologyMaterials = homologyData?.data?.materials ?? []
  const standardsCount = standardsData?.data?.count ?? 0
  const homologyCount = homologyData?.data?.count ?? 0

  // GB 2760 排序过滤
  const sortedGb2760 = [...gb2760Additives]
    .sort((a: any, b: any) => {
      const av = gb2760Sort.field === 'name' ? a.name : a.max_usage
      const bv = gb2760Sort.field === 'name' ? b.name : b.max_usage
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return gb2760Sort.dir === 'asc' ? cmp : -cmp
    })
    .filter(a => !standardSearch || a.name.includes(standardSearch))

  // GB 14880 排序过滤
  const sortedGb14880 = [...gb14880Enrichers]
    .sort((a: any, b: any) => {
      const av = gb14880Sort.field === 'name' ? a.name : gb14880Sort.field === 'min' ? a.min : a.max
      const bv = gb14880Sort.field === 'name' ? b.name : gb14880Sort.field === 'min' ? b.min : b.max
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return gb14880Sort.dir === 'asc' ? cmp : -cmp
    })
    .filter(a => !standardSearch || a.name.includes(standardSearch))

  // 药食同源排序
  const sortedHomology = [...foodHomologyMaterials]
    .sort((a: any, b: any) => {
      const av = homologySort.field === 'name' ? a.name : String(a.max_dosage || '')
      const bv = homologySort.field === 'name' ? b.name : String(b.max_dosage || '')
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return homologySort.dir === 'asc' ? cmp : -cmp
    })

  // 国家标准目录排序过滤
  const filteredStandards = foodSafetyStandards
    .sort((a: any, b: any) => {
      const av = standardsSort.field === 'standard_code' ? a.standard_code :
                 standardsSort.field === 'publish_date' ? a.publish_date : a.category
      const bv = standardsSort.field === 'standard_code' ? b.standard_code :
                 standardsSort.field === 'publish_date' ? b.publish_date : b.category
      const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
      return standardsSort.dir === 'asc' ? cmp : -cmp
    })
    .filter(s => {
      const matchSearch = !standardSearch ||
        s.standard_code.toLowerCase().includes(standardSearch.toLowerCase()) ||
        s.title.includes(standardSearch) ||
        s.summary.includes(standardSearch)
      const matchCategory = !standardCategory || standardCategory === '全部' || s.category === standardCategory
      return matchSearch && matchCategory
    })

  // 禁忌搜索
  const filteredProhibited = prohibitedPairs.filter((p: any) =>
    !prohibitedSearch || p.pair.some((n: string) => n.includes(prohibitedSearch))
  )

  // STANDARD_CATEGORIES
  const STANDARD_CATEGORIES = ['全部', '食品添加剂', '农药残留', '污染物限量', '微生物控制', '乳制品', '饮料', '调味品', '油脂', '婴幼儿食品', '冷冻食品', '蛋白质类', '食品接触材料', '兽药残留']

  // 成分管理
  const addIngredient = () => setIngredients(prev => [...prev, { name: '', dosage_mg: '' }])
  const removeIngredient = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx))
  const updateIngredient = (idx: number, field: string, value: string) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing))
  }

  const handleCheck = async () => {
    const valid = ingredients.filter(i => i.name.trim() && i.dosage_mg.trim())
    if (valid.length === 0) return
    setChecking(true)
    setShowCheckResult(false)
    try {
      const res = await complianceApi.bulkCheck(
        valid.map(i => ({ name: i.name.trim(), dosage_mg: parseFloat(i.dosage_mg) || 0 })),
        population,
      )
      setCheckResult(res.data)
      setShowCheckResult(true)
    } catch {
      setCheckResult({ score: 0, status: 'non_compliant', violations: [], warnings: ['检查失败，请重试'], suggestions: [] })
      setShowCheckResult(true)
    } finally {
      setChecking(false)
    }
  }

  // 刷新按钮
  const handleRefresh = () => {
    window.location.reload()
  }

  // ─── KPI 统计卡片数据 ───
  const statCards = [
    {
      label: t('pages.regulations.totalStandards'),
      value: standardsCount,
      icon: FileText,
      variant: 'primary' as const,
      subtitle: t('pages.regulations.standardsSubtitle'),
    },
    {
      label: t('pages.regulations.foodHomologyMaterials'),
      value: homologyCount,
      icon: BookOpen,
      variant: 'success' as const,
      subtitle: t('pages.regulations.homologySubtitle'),
    },
    {
      label: t('pages.regulations.gb2760Additives'),
      value: gb2760Additives.length,
      icon: Beaker,
      variant: 'info' as const,
      subtitle: t('pages.regulations.gb2760Subtitle'),
    },
    {
      label: t('pages.regulations.gb14880Enrichers'),
      value: gb14880Enrichers.length,
      icon: TestTube,
      variant: 'secondary' as const,
      subtitle: t('pages.regulations.gb14880Subtitle'),
    },
    {
      label: t('pages.regulations.prohibitedPairs'),
      value: prohibitedPairs.length,
      icon: ShieldAlert,
      variant: 'warning' as const,
      subtitle: t('pages.regulations.prohibitedSubtitle'),
    },
    {
      label: t('pages.regulations.foodSafetyProhibited'),
      value: gbProhibitedItems.length,
      icon: XCircle,
      variant: 'warning' as const,
      subtitle: t('pages.regulations.prohibitedListSubtitle'),
    },
  ]

  // 排序图标组件
  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <span className="w-3 h-3 ml-0.5 opacity-20 inline-block">—</span>
    return dir === 'asc' ? <span className="w-3 h-3 ml-0.5 inline-block text-[var(--color-primary-text)]0">↑</span> : <span className="w-3 h-3 ml-0.5 inline-block text-[var(--color-primary-text)]0">↓</span>
  }

  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-6">

        {/* ════════════════════════════════════════════ */}
        {/*  欢迎横幅（surface-primary 对齐 DashboardPage）*/}
        {/* ════════════════════════════════════════════ */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
            <div>
              <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.regulations.title')}</h1>
              <p className="mt-1 text-sm text-white/80">{t('pages.regulations.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw aria-hidden="true" size={14} />}
                onClick={handleRefresh}
              >
                {t('pages.regulations.refreshData')}
              </Button>
              <Link to="/ai">
                <Button variant="secondary" size="sm" icon={<ShieldCheck aria-hidden="true" size={14} />}>
                  {t('pages.regulations.aiComplianceAssistant')}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════ */}
        {/*  KPI 统计卡片行（参照 DashboardPage）         */}
        {/* ════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card, idx) => (
            <StatCard
              key={idx}
              label={card.label}
              value={card.value}
              icon={card.icon}
              variant={card.variant}
              subtitle={card.subtitle}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════ */}
        {/*  导航 Tabs + 内容区                           */}
        {/* ════════════════════════════════════════════ */}
        {/* 导航栏 */}
        <div className="flex flex-wrap gap-2 p-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-md)]">
          {[
            { key: 'standards', label: t('pages.regulations.tabStandards'), icon: FileText, count: standardsCount },
            { key: 'homology', label: t('pages.regulations.tabHomology'), icon: BookOpen, count: homologyCount },
            { key: 'gb', label: t('pages.regulations.tabGb'), icon: Beaker, count: gb2760Additives.length + gb14880Enrichers.length },
            { key: 'prohibited', label: t('pages.regulations.tabProhibited'), icon: ShieldAlert, count: prohibitedPairs.length + gbProhibitedItems.length },
            { key: 'check', label: t('pages.regulations.tabCheck'), icon: ShieldCheck },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as typeof activeSection)}
              className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-[var(--radius-Apple-sm)] text-sm font-semibold transition-all ${
                activeSection === key
                  ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--color-primary-text)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-[var(--radius-pill)] ${
                  activeSection === key
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                    : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/*  国家标准目录                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {activeSection === 'standards' && (
          <div className="space-y-[var(--space-apple-md)]">
            <Card>
              <CardContent className="p-[var(--space-apple-md)]">
                <div className="flex items-start gap-[var(--space-apple-sm)]">
                  <Scale aria-hidden="true" className="w-5 h-5 text-[var(--color-primary-text)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                      {t('pages.regulations.standardsIntro')}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      {t('pages.regulations.standardsIntroDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 筛选工具栏 */}
            <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)]">
              <div className="relative flex-1 min-w-[220px]">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  placeholder={t('pages.regulations.searchStandard')}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_CATEGORIES.slice(0, 6).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setStandardCategory(cat === standardCategory ? '' : cat)}
                    className={`px-[var(--space-apple-sm)] py-1.5 min-h-[44px] inline-flex items-center text-xs font-medium rounded-[var(--radius-Apple-sm)] border transition-all ${
                      standardCategory === cat
                        ? 'bg-[var(--color-primary-container)] border-[var(--color-primary-border)] dark:border-[var(--color-primary)] text-[var(--color-primary-text)]'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 标准列表 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <FileText aria-hidden="true" className="w-4 h-4 text-[var(--color-primary-text)]" />
                    {t('pages.regulations.standardList', { count: filteredStandards.length })}
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      filteredStandards.map(s => ({
                        标准号: s.standard_code, 名称: s.title, 类别: s.category,
                        状态: s.status, 发布日期: s.publish_date, 实施日期: s.implementation_date,
                      })),
                      ['标准号', '名称', '类别', '状态', '发布日期', '实施日期'],
                      `food_safety_standards_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={standardsLoading}
                  >
                    {t('pages.regulations.export')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setStandardsSort(p => ({ field: 'standard_code', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            {t('pages.regulations.thStandardCode')}
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={standardsSort.field === 'standard_code'} dir={standardsSort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.thStandardName')}</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.thCategory')}</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setStandardsSort(p => ({ field: 'publish_date', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            {t('pages.regulations.thImplementationDate')}
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={standardsSort.field === 'publish_date'} dir={standardsSort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.thPriority')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardsLoading ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-12 text-center text-[var(--text-muted)] text-sm">{t('pages.regulations.loading')}</td></tr>
                      ) : filteredStandards.length === 0 ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-12 text-center text-[var(--text-muted)] text-sm">{t('pages.regulations.noMatchingStandard')}</td></tr>
                      ) : filteredStandards.map((s: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'standard', item: s })}
                          className="border-b border-[var(--border-color)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/10 transition-colors cursor-pointer"
                        >
                          <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] font-mono text-xs font-semibold text-[var(--color-primary-text)]">{s.standard_code}</td>
                          <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] max-w-[320px]">
                            <p className="font-medium text-[var(--text-primary)] text-sm leading-snug">{s.title}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{s.summary}</p>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              {s.category}
                            </span>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-xs text-[var(--text-muted)] tabular-nums">{s.implementation_date || '—'}</td>
                          <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={s.priority?.startsWith('P0') ? 'default' : s.priority?.startsWith('P1') ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {s.priority?.replace('P0-核心必备', '核心').replace('P1-重要', '重要') || '—'}
                              </Badge>
                              <ExternalLink aria-hidden="true" size={12} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/*  药食同源目录                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {activeSection === 'homology' && (
          <div className="space-y-[var(--space-apple-md)]">
            <Card>
              <CardContent className="p-[var(--space-apple-md)]">
                <div className="flex items-start gap-[var(--space-apple-sm)]">
                  <BookOpen aria-hidden="true" className="w-5 h-5 text-[var(--color-success-text)] dark:text-[var(--color-success-text)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                      药食同源物质目录（卫健委公告）
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      收录已获批用于普通食品的药食同源中药材，含拉丁学名、适用人群、每日限量、用法形式及禁忌事项。
                      数据来源于国家卫健委公告及 TCMSP 中药系统药理学数据库。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="relative flex-1 min-w-[240px]">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={homologySearch}
                  onChange={e => setHomologySearch(e.target.value)}
                  placeholder={t('pages.regulations.searchHerb')}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline" size="sm"
                icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                onClick={() => exportCSV(
                  sortedHomology.map(m => ({
                    名称: m.name, 拉丁名: m.latin_name, 类别: m.category,
                    限量: m.max_dosage, 禁用人群: (m.restrictions || []).join('；'),
                  })),
                  ['名称', '拉丁名', '类别', '限量', '禁用人群'],
                  `food_homology_${new Date().toISOString().slice(0, 10)}.csv`,
                )}
                disabled={homologyLoading}
              >
                {t('pages.regulations.export')}
              </Button>
            </div>

            {homologyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5 space-y-[var(--space-apple-sm)]">
                      <div className="h-4 bg-[var(--border-color)] rounded-[var(--radius-Apple-sm)] w-1/2" />
                      <div className="h-3 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] w-3/4" />
                      <div className="h-3 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sortedHomology.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-[var(--text-muted)] text-sm">{t('pages.regulations.noMatchingHerb')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedHomology.map((m: any, i: number) => (
                  <Card key={i} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-[var(--space-apple-sm)]">
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-base">{m.name}</p>
                          <p className="text-xs text-[var(--text-muted)] italic mt-0.5">{m.latin_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold ${
                          m.status === '允许用于普通食品'
                            ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                            : m.status === '试点用于普通食品'
                            ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25 text-[var(--color-warning-text)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                        }`}>
                          {m.status === '允许用于普通食品' ? '允许' : m.status === '试点用于普通食品' ? '试点' : '—'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">{t('pages.regulations.thCategory')}</span>
                          <span className="font-medium text-[var(--text-primary)]">{m.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">{t('pages.regulations.thDailyLimit')}</span>
                          <span className="font-semibold text-[var(--color-primary-text)]">{m.max_dosage || t('pages.regulations.unlimited')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-muted)]">{t('pages.regulations.thApprovalDate')}</span>
                          <span className="text-[var(--text-muted)]">{m.approval_date || t('pages.regulations.traditional')}</span>
                        </div>
                      </div>
                      {m.restrictions && m.restrictions.length > 0 && (
                        <div className="mt-[var(--space-apple-sm)] pt-3 border-t border-[var(--border-color)]">
                          <p className="text-xs font-semibold text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] mb-1.5 flex items-center gap-1">
                            <ShieldAlert aria-hidden="true" className="w-3 h-3" /> {t('pages.regulations.thRestrictedGroups')}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {m.restrictions.map((r: string, j: number) => (
                              <span key={j} className="px-2 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)] text-[var(--color-warning-text)] text-xs border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.usage_forms && m.usage_forms.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.usage_forms.map((f: string, j: number) => (
                            <span key={j} className="px-2 py-0.5 rounded-[var(--radius-Apple-sm)] bg-info-50 dark:bg-info-300/20 text-info-700 dark:text-info-600 text-xs border border-info-200 dark:border-info-800">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/*  GB 2760 / GB 14880                                 */}
        {/* ══════════════════════════════════════════════════ */}
        {activeSection === 'gb' && (
          <div className="space-y-6">
            {/* GB 2760 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <Beaker aria-hidden="true" className="w-4 h-4 text-info-600 dark:text-info-600" />
                    GB 2760-2024 食品添加剂使用标准
                    <Badge variant="default" className="text-xs">2025年2月8日实施</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      gb2760Additives.map((a: any) => ({ name: a.name, max_usage: a.max_usage, categories: a.categories.join(';') })),
                      ['name', 'max_usage', 'categories'],
                      `gb2760_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={gb2760Loading}
                  >导出</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-[var(--space-apple-sm)]">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder={t('pages.regulations.searchAdditive')} className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setGb2760Sort(p => ({ field: 'name', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            {t('pages.regulations.thName')}
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={gb2760Sort.field === 'name'} dir={gb2760Sort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.thFunction')}</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setGb2760Sort(p => ({ field: 'max_usage', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            {t('pages.regulations.thMaxUsage')}
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={gb2760Sort.field === 'max_usage'} dir={gb2760Sort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.applicableFoodCategories')}</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('pages.regulations.thNotes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gb2760Loading ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">{t('pages.regulations.loading')}</td></tr>
                      ) : sortedGb2760.length === 0 ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">{t('pages.regulations.noData')}</td></tr>
                      ) : sortedGb2760.map((a: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'gb2760', item: a })}
                          className="border-b border-[var(--border-color)] hover:bg-info-50 dark:hover:bg-info-900/10 transition-colors cursor-pointer"
                        >
                          <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{a.name}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-info-50 dark:bg-info-300/20 text-info-700 dark:text-info-600 border border-info-200 dark:border-info-800">
                              {a.function || '—'}
                            </span>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-info-600 dark:text-info-600">{a.max_usage}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(a.categories || []).map((cat: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-xs text-[var(--text-muted)] max-w-[160px] truncate" title={a.notes}>{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* GB 14880 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <TestTube aria-hidden="true" className="w-4 h-4 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                    GB 14880-2012 营养强化剂使用标准
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      gb14880Enrichers.map((e: any) => ({ name: e.name, min: e.min, max: e.max, categories: e.categories.join(';') })),
                      ['name', 'min', 'max', 'categories'],
                      `gb14880_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={gb14880Loading}
                  >导出</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-[var(--space-apple-sm)]">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder="搜索强化剂名称..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'name', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            强化剂名称
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={gb14880Sort.field === 'name'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">功能类别</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'min', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            最小用量
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={gb14880Sort.field === 'min'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'max', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-[var(--color-primary-text)] transition-colors">
                            最大用量
                            {/* eslint-disable-next-line react-hooks/static-components */}
                            <SortIcon active={gb14880Sort.field === 'max'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">适用食品类别</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gb14880Loading ? (
                        <tr><td colSpan={6} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                      ) : sortedGb14880.length === 0 ? (
                        <tr><td colSpan={6} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                      ) : sortedGb14880.map((e: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'gb14880', item: e })}
                          className="border-b border-[var(--border-color)] hover:bg-[var(--color-accent-container)] dark:hover:bg-[var(--color-accent-container)]/10 transition-colors cursor-pointer"
                        >
                          <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{e.name}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] border border-[var(--color-accent-border)] dark:border-[var(--color-accent)]">
                              {e.function || '—'}
                            </span>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.min}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{e.max}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(e.categories || []).map((cat: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-xs text-[var(--text-muted)] max-w-[160px] truncate" title={e.notes}>{e.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 药食同源目录限量参考 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <Pill aria-hidden="true" className="w-4 h-4 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                    药食同源目录限量参考（2023版）
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      Object.entries(limits).map(([name, mg]) => ({ name, dosage_mg: Number(mg) })),
                      ['name', 'dosage_mg'],
                      `homology_limits_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={limitsLoading}
                  >导出</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-[var(--space-apple-sm)]">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder="搜索药材名称..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">成分名称</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">日用量上限 (mg)</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">法规来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {limitsLoading ? (
                        <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                      ) : Object.entries(limits).length === 0 ? (
                        <tr><td colSpan={3} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                      ) : Object.entries(limits)
                        .sort(([, a], [, b]) => Number(a) - Number(b))
                        .filter(([, mg]) => !standardSearch || String(mg).includes(standardSearch))
                        .map(([name, mg], i) => (
                          <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors">
                            <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--text-primary)]">{name}</td>
                            <td className="px-[var(--space-apple-md)] py-2.5 tabular-nums font-semibold text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{Number(mg).toLocaleString()}</td>
                            <td className="px-[var(--space-apple-md)] py-2.5 text-[var(--text-muted)] text-xs">卫健委药食同源目录（2023版）</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/*  禁忌禁用品                                         */}
        {/* ══════════════════════════════════════════════════ */}
        {activeSection === 'prohibited' && (
          <div className="space-y-6">
            {/* 十八反十九畏 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldAlert aria-hidden="true" className="w-4 h-4 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                    中药十八反十九畏禁忌搭配
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      prohibitedPairs.map((p: any) => ({ pair: p.pair.join(' + '), rule: p.rule })),
                      ['pair', 'rule'],
                      `prohibited_pairs_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={prohibitedLoading}
                  >导出</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-[var(--space-apple-sm)]">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={prohibitedSearch} onChange={e => setProhibitedSearch(e.target.value)}
                    placeholder="搜索搭配成分..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">搭配成分</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">禁忌类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prohibitedLoading ? (
                        <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                      ) : filteredProhibited.length === 0 ? (
                        <tr><td colSpan={2} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                      ) : filteredProhibited.map((p: any, i: number) => (
                        <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors">
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {p.pair.map((n: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] bg-[var(--color-warning-container)] text-[var(--color-warning-text)] text-xs font-medium border border-[var(--color-warning-border)] dark:border-[var(--color-warning)]">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              {p.rule}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 中国食品安全禁用品 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                    <XCircle aria-hidden="true" className="w-4 h-4 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]" />
                    中国食品安全法规禁用品清单
                    <Badge variant="destructive" className="text-xs">{gbProhibitedItems.length} 项</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download aria-hidden="true" className="w-3.5 h-3.5" />}
                    onClick={() => exportCSV(
                      gbProhibitedItems.map((item: string) => ({ item, source: '中国食品安全法规' })),
                      ['item', 'source'],
                      `gb_prohibited_${new Date().toISOString().slice(0, 10)}.csv`,
                    )}
                    disabled={gbProhibitedLoading}
                  >导出</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">禁用品名称</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">类别</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">法规依据</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">禁用原因</th>
                        <th className="px-[var(--space-apple-md)] py-2.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">健康危害</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gbProhibitedLoading ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">加载中...</td></tr>
                      ) : gbProhibitedItems.length === 0 ? (
                        <tr><td colSpan={5} className="px-[var(--space-apple-md)] py-8 text-center text-[var(--text-muted)] text-sm">暂无数据</td></tr>
                      ) : gbProhibitedItems.map((item: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'prohibited', item })}
                          className="border-b border-[var(--border-color)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/10 transition-colors cursor-pointer"
                        >
                          <td className="px-[var(--space-apple-md)] py-2.5 font-medium text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{item.name}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium bg-[var(--color-error-container)] text-[var(--color-error-text)] dark:text-[var(--color-error-text)] border border-[var(--color-error-border)] dark:border-[var(--color-error)]">
                              {item.category || '—'}
                            </span>
                          </td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-xs text-[var(--text-muted)] max-w-[160px] truncate" title={item.source_law}>{item.source_law || '—'}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-xs text-[var(--text-muted)] max-w-[180px] truncate" title={item.reason}>{item.reason || '—'}</td>
                          <td className="px-[var(--space-apple-md)] py-2.5 text-xs text-[var(--text-muted)] max-w-[160px] truncate" title={item.hazard}>{item.hazard || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/*  合规检查                                           */}
        {/* ══════════════════════════════════════════════════ */}
        {activeSection === 'check' && (
          <div className="space-y-[var(--space-apple-md)]">
            <Card>
              <CardContent className="p-[var(--space-apple-md)]">
                <div className="flex items-start gap-[var(--space-apple-sm)]">
                  <ShieldCheck aria-hidden="true" className="w-5 h-5 text-[var(--color-primary-text)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                      配方合规性检查
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      输入配方成分及日用量，对照国家标准（GB 2760/GB 14880/药食同源目录）自动检查合规性。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 人群选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">目标人群：</span>
              {(['adults', 'children', 'elderly'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPopulation(p)}
                  className={`px-[var(--space-apple-sm)] py-1.5 min-h-[44px] inline-flex items-center text-xs font-semibold rounded-[var(--radius-Apple-sm)] transition-all ${
                    population === p
                      ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {p === 'adults' ? '成人' : p === 'children' ? '儿童' : '老人'}
                </button>
              ))}
            </div>

            {/* 成分输入 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">配方成分</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={ing.name}
                        onChange={e => updateIngredient(idx, 'name', e.target.value)}
                        placeholder="成分名称（如：黄芪）"
                        className="flex-1 h-9 text-sm"
                      />
                      <Input
                        value={ing.dosage_mg}
                        onChange={e => updateIngredient(idx, 'dosage_mg', e.target.value)}
                        placeholder="日用量(mg)"
                        type="number"
                        className="w-28 h-9 text-sm"
                      />
                      {ingredients.length > 1 && (
                        <button onClick={() => removeIngredient(idx)} className="p-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-[var(--space-apple-sm)]">
                  <Button variant="outline" size="sm" onClick={addIngredient} icon={<CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />}>添加成分</Button>
                  <Button variant="primary" size="sm" onClick={handleCheck}
                    disabled={checking || !ingredients.some(i => i.name.trim())}
                    icon={checking ? <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5" />}
                  >
                    {checking ? '检查中...' : '开始合规检查'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 检查结果 */}
            {showCheckResult && checkResult && (
              <div className="space-y-[var(--space-apple-md)]">
                {/* 总体评分 */}
                <Card className={`border-l-4 ${
                  checkResult.status === 'compliant' ? 'border-l-success-500'
                  : checkResult.status === 'warning' ? 'border-l-warning-500'
                  : 'border-l-error-500'
                }`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[var(--radius-pill)] flex items-center justify-center ${
                          checkResult.status === 'compliant' ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/25'
                          : checkResult.status === 'warning' ? 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/25'
                          : 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/25'
                        }`}>
                          {checkResult.status === 'compliant' ? <CheckCircle2 aria-hidden="true" className="w-6 h-6 text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                          : checkResult.status === 'warning' ? <AlertTriangle aria-hidden="true" className="w-6 h-6 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                          : <XCircle aria-hidden="true" className="w-6 h-6 text-[var(--color-error-text)] dark:text-[var(--color-error-text)]" />}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[var(--text-primary)]">
                            合规评分：<span className={
                              checkResult.status === 'compliant' ? 'text-[var(--color-success-text)]'
                              : checkResult.status === 'warning' ? 'text-[var(--color-warning-text)]'
                              : 'text-[var(--color-error-text)]'
                            }>{checkResult.score.toFixed(1)}</span>/100
                          </p>
                          <div className="mt-1"><StatusBadge status={checkResult.status} /></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-muted)]">违规数</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">{checkResult.violations.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 违规详情 */}
                {checkResult.violations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">违规详情</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {checkResult.violations.map((v, i) => (
                          <div key={i} className="flex items-start gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-error-900/30">
                            <XCircle aria-hidden="true" className="w-4 h-4 text-[var(--color-error-text)]0 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-[var(--text-primary)] text-sm">{v.ingredient}</span>
                                <ViolationTypeTag type={v.type} />
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">{v.message}</p>
                            </div>
                            {v.max_allowed !== undefined && v.actual_value !== undefined && (
                              <div className="text-right shrink-0">
                                <p className="text-xs text-[var(--text-muted)]">限量</p>
                                <p className="text-sm font-semibold text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">{v.max_allowed}mg</p>
                                <p className="text-xs text-[var(--text-muted)]">实际</p>
                                <p className="text-sm font-semibold">{v.actual_value}mg</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 警告 */}
                {checkResult.warnings.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">警告</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {checkResult.warnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-[var(--color-warning-text)]">
                            <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 建议 */}
                {checkResult.suggestions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {checkResult.suggestions.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                            <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-[var(--color-success-text)]0 shrink-0" />
                            {s}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 居中详情弹窗 — Portal 挂载至 document.body，彻底脱离父容器布局约束 */}
      {detailModal && createPortal(
        <DetailModal
          item={detailModal.item}
          type={detailModal.type}
          onClose={() => setDetailModal(null)}
        />,
        document.body
      )}
    </div>
  )
}

// ─── 详情信息块（行内复用） ───
function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] dark:border-neutral-700 px-[var(--space-apple-sm)] py-2.5">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm text-[var(--text-primary)] leading-snug">{value}</p>
    </div>
  )
}
