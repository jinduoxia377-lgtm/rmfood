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
  const isStandard  = type === 'standard'
  const isGb2760    = type === 'gb2760'
  const isGb14880   = type === 'gb14880'
  const isProhibited = type === 'prohibited'

  const headerBg = isStandard  ? 'from-primary-600 to-primary-700'
                 : isGb2760   ? 'from-info-600 to-info-700'
                 : isGb14880  ? 'from-purple-600 to-purple-700'
                 : 'from-error-600 to-error-700'

  const titleIcon = isStandard  ? <FileText size={15} className="shrink-0" />
                  : isGb2760   ? <Beaker size={15} className="shrink-0" />
                  : isGb14880  ? <TestTube size={15} className="shrink-0" />
                  : <ShieldAlert size={15} className="shrink-0" />

  const title = isStandard  ? `${item?.standard_code} · ${item?.title}`
              : isGb2760   ? `${item?.name} — GB 2760 详情`
              : isGb14880  ? `${item?.name} — GB 14880 详情`
              : `${item?.name} — 禁用品详情`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-neutral-200 dark:border-neutral-700">
        <div className={`flex items-center justify-between px-6 py-3.5 bg-gradient-to-r ${headerBg} text-white shrink-0`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {titleIcon}
            <h3 className="font-semibold text-sm truncate">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white dark:bg-neutral-900/20 rounded-lg transition-colors">
            <X size={16} />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {isStandard && (() => {
            const s = item
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoBlock label="标准号" value={s.standard_code} />
                  <InfoBlock label="状态" value={<Badge variant={s.status === '最新' ? 'default' : 'outline'}>{s.status}</Badge>} />
                  <InfoBlock label="发布日期" value={s.publish_date} />
                  <InfoBlock label="实施日期" value={s.implementation_date} />
                  <InfoBlock label="优先级" value={<Badge variant={s.priority?.startsWith('P0') ? 'default' : 'secondary'} className="text-xs">{s.priority?.replace('P0-核心必备','核心必备').replace('P1-重要','重要')}</Badge>} />
                  <InfoBlock label="类别" value={s.category} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">标准摘要</p>
                  <p className="text-sm text-text-primary bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">{s.summary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">详细内容</p>
                  <p className="text-sm text-text-primary bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3 whitespace-pre-wrap">{s.content || s.summary}</p>
                </div>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary-700 dark:text-primary-700 hover:underline">
                    <ExternalLink size={12} />查看官方标准原文
                  </a>
                )}
              </div>
            )
          })()}

          {isGb2760 && (() => {
            const a = item
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoBlock label="添加剂名称" value={a.name} />
                  <InfoBlock label="功能类别" value={<Badge variant="outline" className="text-xs">{a.function}</Badge>} />
                  <InfoBlock label="CAS号" value={a.cas || '—'} />
                  <InfoBlock label="E编码" value={a.e_number || '—'} />
                  <InfoBlock label="最大使用量" value={<span className="font-semibold text-info-600 dark:text-info-600">{a.max_usage}</span>} />
                  <InfoBlock label="备注" value={a.notes || '—'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">适用食品类别</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(a.categories || []).map((cat: string, j: number) => (
                      <span key={j} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-600 border border-info-200 dark:border-info-800">{cat}</span>
                    ))}
                  </div>
                </div>
                {a.notes && (
                  <div className="bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-warning-700 dark:text-warning-700 mb-1 flex items-center gap-1.5">
                      <AlertTriangle size={12} />注意事项
                    </p>
                    <p className="text-sm text-warning-800 dark:text-warning-700">{a.notes}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {isGb14880 && (() => {
            const e = item
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoBlock label="强化剂名称" value={e.name} />
                  <InfoBlock label="功能类别" value={<Badge variant="outline" className="text-xs">{e.function}</Badge>} />
                  <InfoBlock label="CAS号" value={e.cas || '—'} />
                  <InfoBlock label="最小用量" value={<span className="font-semibold text-purple-600 dark:text-purple-400">{e.min}</span>} />
                  <InfoBlock label="最大用量" value={<span className="font-semibold text-purple-600 dark:text-purple-400">{e.max}</span>} />
                  <InfoBlock label="备注" value={e.notes || '—'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1.5">适用食品类别</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(e.categories || []).map((cat: string, j: number) => (
                      <span key={j} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">{cat}</span>
                    ))}
                  </div>
                </div>
                {e.notes && (
                  <div className="bg-info-50 dark:bg-info-900/10 border border-info-200 dark:border-info-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-info-700 dark:text-info-600 mb-1 flex items-center gap-1.5">
                      <Info size={12} />说明
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoBlock label="禁用品名称" value={<span className="font-semibold text-error-600 dark:text-error-600">{p.name}</span>} />
                  <InfoBlock label="类别" value={<Badge variant="destructive" className="text-xs">{p.category}</Badge>} />
                  <InfoBlock label="法规依据" value={p.source_law} />
                  <InfoBlock label="禁用原因" value={p.reason} />
                </div>
                <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
                  <p className="text-xs font-semibold text-error-700 dark:text-error-600 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={14} />健康危害
                  </p>
                  <p className="text-sm text-error-800 dark:text-error-600 leading-relaxed">{p.hazard}</p>
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
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    compliant:    { color: 'text-success-600 dark:text-success-600', bg: 'bg-success-50  dark:bg-success-900/20', border: 'border-success-200 dark:border-success-800', label: '合规' },
    warning:      { color: 'text-warning-600 dark:text-warning-700', bg: 'bg-warning-50  dark:bg-warning-900/20', border: 'border-warning-200 dark:border-warning-800', label: '需注意' },
    non_compliant:{ color: 'text-error-600  dark:text-error-600',   bg: 'bg-error-50  dark:bg-error-900/20',   border: 'border-error-200 dark:border-error-800',   label: '不合规' },
  }
  const c = config[status] ?? config.compliant
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.border} ${c.color}`}>
      <CheckCircle2 className="w-3 h-3" /> {c.label}
    </span>
  )
}

// ─── 违规类型标签（页面内复用） ───
function ViolationTypeTag({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    exceeds_limit:  { label: '超限量',  color: 'text-error-600 dark:text-error-600', bg: 'bg-error-50  dark:bg-error-900/20', border: 'border-error-200 dark:border-error-800' },
    prohibited_combo: { label: '禁忌搭配', color: 'text-warning-600 dark:text-warning-700', bg: 'bg-warning-50  dark:bg-warning-900/20', border: 'border-warning-200 dark:border-warning-800' },
    child_forbidden:{ label: '儿童禁忌', color: 'text-accent-600 dark:text-accent-700', bg: 'bg-accent-50  dark:bg-accent-900/20', border: 'border-accent-200 dark:border-accent-800' },
    not_in_directory:{ label: '非目录',  color: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-50  dark:bg-neutral-800/50', border: 'border-neutral-200 dark:border-neutral-700' },
    gb2760:         { label: 'GB 2760', color: 'text-info-600  dark:text-info-600',   bg: 'bg-info-50   dark:bg-info-900/20',   border: 'border-info-200 dark:border-info-800' },
    gb14880:        { label: 'GB 14880',color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
    prohibited_tcm: { label: '禁用品',  color: 'text-error-600 dark:text-error-600', bg: 'bg-error-50  dark:bg-error-900/20', border: 'border-error-200 dark:border-error-800' },
  }
  const c = config[type] ?? config.not_in_directory
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.bg} ${c.border} ${c.color}`}>
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
  const [homologySort, setHomologySort] = useState<{ field: 'name' | 'max_dosage'; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' })
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
      label: '国家标准总数',
      value: standardsCount,
      icon: FileText,
      variant: 'primary' as const,
      subtitle: '覆盖 GB 2760 / 2762 / 2763 等核心标准',
    },
    {
      label: '药食同源物质',
      value: homologyCount,
      icon: BookOpen,
      variant: 'success' as const,
      subtitle: '卫健委公告收录药食同源中药材',
    },
    {
      label: 'GB 2760 添加剂',
      value: gb2760Additives.length,
      icon: Beaker,
      variant: 'info' as const,
      subtitle: '食品添加剂使用标准（2024版）',
    },
    {
      label: 'GB 14880 强化剂',
      value: gb14880Enrichers.length,
      icon: TestTube,
      variant: 'secondary' as const,
      subtitle: '营养强化剂使用标准',
    },
    {
      label: '禁忌搭配对数',
      value: prohibitedPairs.length,
      icon: ShieldAlert,
      variant: 'warning' as const,
      subtitle: '十八反十九畏配伍禁忌',
    },
    {
      label: '食品安全禁用品',
      value: gbProhibitedItems.length,
      icon: XCircle,
      variant: 'warning' as const,
      subtitle: '中国食品安全法规禁用品清单',
    },
  ]

  // 排序图标组件
  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <span className="w-3 h-3 ml-0.5 opacity-20 inline-block">—</span>
    return dir === 'asc' ? <span className="w-3 h-3 ml-0.5 inline-block text-primary-500">↑</span> : <span className="w-3 h-3 ml-0.5 inline-block text-primary-500">↓</span>
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ════════════════════════════════════════════ */}
        {/*  欢迎横幅（参照 DashboardPage）               */}
        {/* ════════════════════════════════════════════ */}
        <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight">合规标准中心</h2>
              <p className="mt-1 text-white/80 text-sm">
                国家标准查询 · 药食同源目录 · GB 2760/14880 · 禁忌搭配检查 · 配方合规验证
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={14} />}
                onClick={handleRefresh}
              >
                刷新数据
              </Button>
              <Link to="/ai">
                <Button variant="secondary" size="sm" icon={<ShieldCheck size={14} />}>
                  AI 合规助手
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════ */}
        {/*  KPI 统计卡片行（参照 DashboardPage）         */}
        {/* ════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
        <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          {[
            { key: 'standards', label: '国家标准目录', icon: FileText, count: standardsCount },
            { key: 'homology', label: '药食同源目录', icon: BookOpen, count: homologyCount },
            { key: 'gb', label: 'GB 2760/14880', icon: Beaker, count: gb2760Additives.length + gb14880Enrichers.length },
            { key: 'prohibited', label: '禁忌禁用品', icon: ShieldAlert, count: prohibitedPairs.length + gbProhibitedItems.length },
            { key: 'check', label: '合规检查', icon: ShieldCheck },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as typeof activeSection)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeSection === key
                  ? 'bg-white dark:bg-neutral-700 text-primary-700 dark:text-primary-700 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-text-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  activeSection === key
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-700'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
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
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Scale className="w-5 h-5 text-primary-700 dark:text-primary-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary leading-relaxed">
                      食品安全国家标准目录（持续更新）
                    </p>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      涵盖 GB 2760（食品添加剂）、GB 2763（农药残留）、GB 2762（污染物）等 P0 核心标准，
                      以及乳制品、饮料、调味品等品类标准。数据来源：国家卫生健康委员会 / FoodTalks。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 筛选工具栏 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={standardSearch}
                  onChange={e => setStandardSearch(e.target.value)}
                  placeholder="搜索标准号或名称..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_CATEGORIES.slice(0, 6).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setStandardCategory(cat === standardCategory ? '' : cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      standardCategory === cat
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-700'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-700 dark:text-primary-700" />
                    国家标准列表（{filteredStandards.length} 项）
                  </CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    icon={<Download className="w-3.5 h-3.5" />}
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
                    导出
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setStandardsSort(p => ({ field: 'standard_code', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            标准号 <SortIcon active={standardsSort.field === 'standard_code'} dir={standardsSort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">标准名称</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setStandardsSort(p => ({ field: 'publish_date', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            实施日期 <SortIcon active={standardsSort.field === 'publish_date'} dir={standardsSort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">优先级</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standardsLoading ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : filteredStandards.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-text-muted text-sm">暂无匹配标准</td></tr>
                      ) : filteredStandards.map((s: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'standard', item: s })}
                          className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-700 dark:text-primary-700">{s.standard_code}</td>
                          <td className="px-4 py-3 max-w-[320px]">
                            <p className="font-medium text-text-primary text-sm leading-snug">{s.title}</p>
                            <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{s.summary}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                              {s.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted tabular-nums">{s.implementation_date || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={s.priority?.startsWith('P0') ? 'default' : s.priority?.startsWith('P1') ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {s.priority?.replace('P0-核心必备', '核心').replace('P1-重要', '重要') || '—'}
                              </Badge>
                              <ExternalLink size={12} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" />
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
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-success-600 dark:text-success-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary leading-relaxed">
                      药食同源物质目录（卫健委公告）
                    </p>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      收录已获批用于普通食品的药食同源中药材，含拉丁学名、适用人群、每日限量、用法形式及禁忌事项。
                      数据来源于国家卫健委公告及 TCMSP 中药系统药理学数据库。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                <Input
                  value={homologySearch}
                  onChange={e => setHomologySearch(e.target.value)}
                  placeholder="搜索药材名称..."
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline" size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
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
                导出
              </Button>
            </div>

            {homologyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-5 space-y-3">
                      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sortedHomology.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-text-muted text-sm">暂无匹配药材</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedHomology.map((m: any, i: number) => (
                  <Card key={i} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-text-primary text-base">{m.name}</p>
                          <p className="text-xs text-text-muted italic mt-0.5">{m.latin_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          m.status === '允许用于普通食品'
                            ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-600'
                            : m.status === '试点用于普通食品'
                            ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-700'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          {m.status === '允许用于普通食品' ? '允许' : m.status === '试点用于普通食品' ? '试点' : '—'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-muted">分类</span>
                          <span className="font-medium text-text-primary">{m.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">日用量上限</span>
                          <span className="font-semibold text-primary-700 dark:text-primary-700">{m.max_dosage || '无限制'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">批准日期</span>
                          <span className="text-text-muted">{m.approval_date || '传统'}</span>
                        </div>
                      </div>
                      {m.restrictions && m.restrictions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                          <p className="text-xs font-semibold text-warning-600 dark:text-warning-700 mb-1.5 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> 禁忌人群
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {m.restrictions.map((r: string, j: number) => (
                              <span key={j} className="px-2 py-0.5 rounded bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-700 text-xs border border-warning-200 dark:border-warning-800">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.usage_forms && m.usage_forms.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.usage_forms.map((f: string, j: number) => (
                            <span key={j} className="px-2 py-0.5 rounded bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-600 text-xs border border-info-200 dark:border-info-800">
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-info-600 dark:text-info-600" />
                    GB 2760-2024 食品添加剂使用标准
                    <Badge variant="default" className="text-xs">2025年2月8日实施</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}
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
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder="搜索添加剂名称..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setGb2760Sort(p => ({ field: 'name', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            添加剂名称 <SortIcon active={gb2760Sort.field === 'name'} dir={gb2760Sort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">功能类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setGb2760Sort(p => ({ field: 'max_usage', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            最大使用量 <SortIcon active={gb2760Sort.field === 'max_usage'} dir={gb2760Sort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">适用食品类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gb2760Loading ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : sortedGb2760.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据</td></tr>
                      ) : sortedGb2760.map((a: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'gb2760', item: a })}
                          className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-info-50 dark:hover:bg-info-900/10 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-medium text-text-primary">{a.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-600 border border-info-200 dark:border-info-800">
                              {a.function || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold text-info-600 dark:text-info-600">{a.max_usage}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(a.categories || []).map((cat: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-muted max-w-[160px] truncate" title={a.notes}>{a.notes || '—'}</td>
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <TestTube className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    GB 14880-2012 营养强化剂使用标准
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}
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
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder="搜索强化剂名称..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'name', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            强化剂名称 <SortIcon active={gb14880Sort.field === 'name'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">功能类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'min', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            最小用量 <SortIcon active={gb14880Sort.field === 'min'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                          <button onClick={() => setGb14880Sort(p => ({ field: 'max', dir: p.dir === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 hover:text-primary-700 transition-colors">
                            最大用量 <SortIcon active={gb14880Sort.field === 'max'} dir={gb14880Sort.dir} />
                          </button>
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">适用食品类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gb14880Loading ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : sortedGb14880.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据</td></tr>
                      ) : sortedGb14880.map((e: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'gb14880', item: e })}
                          className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-medium text-text-primary">{e.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                              {e.function || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-purple-600 dark:text-purple-400">{e.min}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold text-purple-600 dark:text-purple-400">{e.max}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(e.categories || []).map((cat: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-muted max-w-[160px] truncate" title={e.notes}>{e.notes || '—'}</td>
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-success-600 dark:text-success-600" />
                    药食同源目录限量参考（2023版）
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}
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
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={standardSearch} onChange={e => setStandardSearch(e.target.value)}
                    placeholder="搜索药材名称..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">成分名称</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">日用量上限 (mg)</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">法规来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {limitsLoading ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : Object.entries(limits).length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据</td></tr>
                      ) : Object.entries(limits)
                        .sort(([, a], [, b]) => Number(a) - Number(b))
                        .filter(([, mg]) => !standardSearch || String(mg).includes(standardSearch))
                        .map(([name, mg], i) => (
                          <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-text-primary">{name}</td>
                            <td className="px-4 py-2.5 tabular-nums font-semibold text-success-600 dark:text-success-600">{Number(mg).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-text-muted text-xs">卫健委药食同源目录（2023版）</td>
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-warning-600 dark:text-warning-700" />
                    中药十八反十九畏禁忌搭配
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}
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
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                  <Input value={prohibitedSearch} onChange={e => setProhibitedSearch(e.target.value)}
                    placeholder="搜索搭配成分..." className="pl-9" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">搭配成分</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">禁忌类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prohibitedLoading ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : filteredProhibited.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据</td></tr>
                      ) : filteredProhibited.map((p: any, i: number) => (
                        <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {p.pair.map((n: string, j: number) => (
                                <span key={j} className="inline-flex items-center px-2 py-0.5 rounded bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-700 text-xs font-medium border border-warning-200 dark:border-warning-800">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
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
                  <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-error-600 dark:text-error-600" />
                    中国食品安全法规禁用品清单
                    <Badge variant="destructive" className="text-xs">{gbProhibitedItems.length} 项</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}
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
                      <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">禁用品名称</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">类别</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">法规依据</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">禁用原因</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">健康危害</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gbProhibitedLoading ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">加载中...</td></tr>
                      ) : gbProhibitedItems.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">暂无数据</td></tr>
                      ) : gbProhibitedItems.map((item: any, i: number) => (
                        <tr
                          key={i}
                          onClick={() => setDetailModal({ type: 'prohibited', item })}
                          className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-error-50 dark:hover:bg-error-900/10 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-medium text-error-600 dark:text-error-600">{item.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-600 border border-error-200 dark:border-error-800">
                              {item.category || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-muted max-w-[160px] truncate" title={item.source_law}>{item.source_law || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-text-muted max-w-[180px] truncate" title={item.reason}>{item.reason || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-text-muted max-w-[160px] truncate" title={item.hazard}>{item.hazard || '—'}</td>
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
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary-700 dark:text-primary-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary leading-relaxed">
                      配方合规性检查
                    </p>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      输入配方成分及日用量，对照国家标准（GB 2760/GB 14880/药食同源目录）自动检查合规性。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 人群选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">目标人群：</span>
              {(['adults', 'children', 'elderly'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPopulation(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    population === p
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-700 border border-primary-200 dark:border-primary-800'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {p === 'adults' ? '成人' : p === 'children' ? '儿童' : '老人'}
                </button>
              ))}
            </div>

            {/* 成分输入 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700">配方成分</CardTitle>
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
                        <button onClick={() => removeIngredient(idx)} className="p-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={addIngredient} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>添加成分</Button>
                  <Button variant="primary" size="sm" onClick={handleCheck}
                    disabled={checking || !ingredients.some(i => i.name.trim())}
                    icon={checking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    {checking ? '检查中...' : '开始合规检查'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 检查结果 */}
            {showCheckResult && checkResult && (
              <div className="space-y-4">
                {/* 总体评分 */}
                <Card className={`border-l-4 ${
                  checkResult.status === 'compliant' ? 'border-l-success-500'
                  : checkResult.status === 'warning' ? 'border-l-warning-500'
                  : 'border-l-error-500'
                }`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          checkResult.status === 'compliant' ? 'bg-success-100 dark:bg-success-900/30'
                          : checkResult.status === 'warning' ? 'bg-warning-100 dark:bg-warning-900/30'
                          : 'bg-error-100 dark:bg-error-900/30'
                        }`}>
                          {checkResult.status === 'compliant' ? <CheckCircle2 className="w-6 h-6 text-success-600 dark:text-success-600" />
                          : checkResult.status === 'warning' ? <AlertTriangle className="w-6 h-6 text-warning-600 dark:text-warning-700" />
                          : <XCircle className="w-6 h-6 text-error-600 dark:text-error-600" />}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-text-primary">
                            合规评分：<span className={
                              checkResult.status === 'compliant' ? 'text-success-600'
                              : checkResult.status === 'warning' ? 'text-warning-600'
                              : 'text-error-600'
                            }>{checkResult.score.toFixed(1)}</span>/100
                          </p>
                          <div className="mt-1"><StatusBadge status={checkResult.status} /></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">违规数</p>
                        <p className="text-2xl font-bold text-text-primary">{checkResult.violations.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 违规详情 */}
                {checkResult.violations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700">违规详情</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {checkResult.violations.map((v, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-100 dark:border-error-900/30">
                            <XCircle className="w-4 h-4 text-error-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-text-primary text-sm">{v.ingredient}</span>
                                <ViolationTypeTag type={v.type} />
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">{v.message}</p>
                            </div>
                            {v.max_allowed !== undefined && v.actual_value !== undefined && (
                              <div className="text-right shrink-0">
                                <p className="text-xs text-text-muted">限量</p>
                                <p className="text-sm font-semibold text-error-600 dark:text-error-600">{v.max_allowed}mg</p>
                                <p className="text-xs text-text-muted">实际</p>
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
                      <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700">警告</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {checkResult.warnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-warning-700 dark:text-warning-700">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
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
                      <CardTitle className="text-sm font-semibold tracking-tight text-neutral-700">建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {checkResult.suggestions.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-text-primary">
                            <CheckCircle2 className="w-4 h-4 text-success-500 shrink-0" />
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
    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-700 px-3 py-2.5">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm text-text-primary leading-snug">{value}</p>
    </div>
  )
}
