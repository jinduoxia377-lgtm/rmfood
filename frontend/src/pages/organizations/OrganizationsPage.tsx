 
/**
 * 组织管理页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard 风格统一
 *   - 横排药丸 Tab 导航（桌面自动显示，移动端自动折叠）
 *   - 宽卡片布局，去除紧凑限制，充分利用空间
 *   - 全页面间距宽松（space-y-6、card p-[var(--space-apple-lg)]、section gap-6）
 *   - 去除侧边栏，内容全宽展开
 */
import { useState, useMemo, useCallback, useRef, useEffect, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Building2,
  Plus,
  Users,
  HardDrive,
  Zap,
  Search,
  Filter,
  LayoutGrid,
  List,
  Columns,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Input,
  Progress,
  Skeleton,
  EmptyStateIllustration,
  useToast,
} from '@/components/ui'
import api from '@/api/client'
import { useOrganizations } from '@/hooks/useOrganizations'
import type { Organization } from '@/hooks/useOrganizations'
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary'

import { OrganizationList } from './components/OrganizationList'
import { OrganizationAnalytics } from './components/OrganizationAnalytics'
import { BulkOperationsPanel } from './components/BulkOperationsPanel'
import { DataExportDialog } from './components/DataExportDialog'
import { CloneOrgDialog } from './components/CloneOrgDialog'
import { CreateOrgWizard } from './components/CreateOrgWizard'
import { SubscriptionPanel } from './components/SubscriptionPanel'
import { ShortcutHints, useKeyboardShortcuts } from '@/hooks/useOrgKeyboardShortcuts.tsx'
import { useRecentOrganizations } from '@/hooks/useRecentOrganizations'
import { logger } from '@/utils/safeLogger'

type OrgTab = 'overview' | 'analytics' | 'my-orgs' | 'all' | 'trash'
type ViewMode = 'card' | 'table' | 'compact'

interface LocalFilters {
  plan: string
  memberRange: string
  status: string
  sortBy: string
}

const TABS: { id: OrgTab; labelKey: string; icon: typeof Building2 }[] = [
  { id: 'overview',   labelKey: 'pages.organizations.tabOverview',   icon: LayoutGrid },
  { id: 'analytics',  labelKey: 'pages.organizations.tabAnalytics', icon: BarChart3 },
  { id: 'my-orgs',    labelKey: 'pages.organizations.tabMyOrgs', icon: Building2 },
  { id: 'all',        labelKey: 'pages.organizations.tabAll',     icon: Users },
  { id: 'trash',      labelKey: 'pages.organizations.tabTrash',   icon: Trash2 },
]

const PLAN_OPTIONS = [
  { value: 'all', labelKey: 'pages.organizations.allPlans' },
  { value: 'free', labelKey: 'pages.organizations.planFree' },
  { value: 'pro', labelKey: 'pages.organizations.planPro' },
  { value: 'enterprise', labelKey: 'pages.organizations.planEnterprise' },
]

const MEMBER_RANGE_OPTIONS = [
  { value: 'all', labelKey: 'pages.organizations.allMemberRanges' },
  { value: 'small', labelKey: 'pages.organizations.smallRange' },
  { value: 'medium', labelKey: 'pages.organizations.mediumRange' },
  { value: 'large', labelKey: 'pages.organizations.largeRange' },
]

const STATUS_OPTIONS = [
  { value: 'all', labelKey: 'pages.organizations.allStatuses' },
  { value: 'active', labelKey: 'pages.organizations.statusActive' },
  { value: 'paused', labelKey: 'pages.organizations.statusPaused' },
  { value: 'archived', labelKey: 'pages.organizations.statusArchived' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', labelKey: 'pages.organizations.sortByCreatedAt' },
  { value: 'name', labelKey: 'pages.organizations.sortByName' },
  { value: 'memberCount', labelKey: 'pages.organizations.sortByMemberCount' },
  { value: 'updatedAt', labelKey: 'pages.organizations.sortByUpdatedAt' },
]

export default function OrganizationsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<OrgTab>('overview')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [localFilters, setLocalFilters] = useState<LocalFilters>({
    plan: 'all',
    memberRange: 'all',
    status: 'all',
    sortBy: 'createdAt',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [cloneSourceOrg, setCloneSourceOrg] = useState<{ id: number; name: string; slug: string; plan: string } | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const { recent, addRecent, clearRecent } = useRecentOrganizations()
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [searchParams] = useSearchParams()
  const urlOrgId = searchParams.get('org')
  const [manageOrgId, setManageOrgId] = useState<number | null>(urlOrgId ? Number(urlOrgId) : null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const {
    organizations,
    loading,
    error,
    search,
    setSearch,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    allSelected,
    someSelected,
    createOrganization,
    refetch,
    trashedOrganizations,
    trashLoading,
    fetchTrashedOrganizations,
    restoreOrganization,
    permanentDeleteOrganization,
    cloneOrganization,
    toggleFavorite,
    togglePin,
  } = useOrganizations({ autoFetch: true })

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onAction: (action) => {
      switch (action) {
        case 'new':
          setShowCreateWizard(true)
          break
        case 'search':
          searchInputRef.current?.focus()
          break
        case 'overview':
          setActiveTab('overview')
          break
        case 'myOrgs':
          setActiveTab('my-orgs')
          break
        case 'all':
          setActiveTab('all')
          break
        case 'analytics':
          setActiveTab('analytics')
          break
        case 'escape':
          setShowFilters(false)
          setShowExportDialog(false)
          setShowCloneDialog(false)
          break
      }
    },
  })

  // 切换回收站 Tab 时自动加载已归档组织
  useEffect(() => {
    if (activeTab === 'trash') {
      fetchTrashedOrganizations()
    }
  }, [activeTab, fetchTrashedOrganizations])

  const filteredOrganizations = useMemo(() => {
    let result = [...organizations]

    // "我的组织"应显示当前用户加入的所有组织（含 member 角色），不做 owner/admin 过滤

    if (localFilters.plan !== 'all') {
      result = result.filter((org) => org.plan === localFilters.plan)
    }

    if (localFilters.memberRange !== 'all') {
      result = result.filter((org) => {
        switch (localFilters.memberRange) {
          case 'small':
            return org.memberCount < 10
          case 'medium':
            return org.memberCount >= 10 && org.memberCount <= 50
          case 'large':
            return org.memberCount > 50
          default:
            return true
        }
      })
    }

    if (localFilters.status !== 'all') {
      result = result.filter((org) => {
        if (localFilters.status === 'active') return org.isActive
        if (localFilters.status === 'paused') return !org.isActive && !org.isPinned
        return org.isPinned
      })
    }

    if (search.trim()) {
      const keyword = search.toLowerCase()
      result = result.filter(
        (org) => org.name.toLowerCase().includes(keyword) || org.slug.toLowerCase().includes(keyword),
      )
    }

    result.sort((a, b) => {
      const field = localFilters.sortBy
      let comparison = 0
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'zh-CN')
          break
        case 'memberCount':
          comparison = a.memberCount - b.memberCount
          break
        case 'createdAt':
        case 'updatedAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        default:
          comparison = 0
      }
      return comparison
    })

    return result
  }, [organizations, activeTab, localFilters, search])

  const stats = useMemo(
    () => ({
      totalOrgs: organizations.length,
      totalMembers: organizations.reduce((sum, org) => sum + org.memberCount, 0),
      avgStorageUsage:
        organizations.length > 0
          ? organizations.reduce((sum, org) => sum + (org.storageUsed / org.storageLimit) * 100, 0) /
            organizations.length
          : 0,
      monthlyApiCalls: organizations.reduce((sum, org) => sum + org.apiUsage, 0),
      apiTrend: '+12.5%',
    }),
    [organizations],
  )

  const handleCloneOrg = useCallback(async (newName: string): Promise<number> => {
    if (!cloneSourceOrg) throw new Error('没有源组织')
    const newId = await cloneOrganization(cloneSourceOrg.id, newName)
    return newId
  }, [cloneSourceOrg, cloneOrganization])

  const openCloneDialog = useCallback((org: Organization) => {
    setCloneSourceOrg({ id: org.id, name: org.name, slug: org.slug, plan: org.plan })
    setShowCloneDialog(true)
  }, [])

  const [isProcessing, setIsProcessing] = useState(false)

  const handleBulkAction = useCallback(
    async (action: string) => {
      const ids = Array.from(selectedIds)
      const count = ids.length
      setIsProcessing(true)
      try {
        switch (action) {
          case 'export':
            setShowExportDialog(true)
            break
          case 'archive':
            await Promise.all(ids.map(id => api.put(`/organizations/${id}/archive`)))
            toast.success(`已归档 ${count} 个组织`)
            clearSelection()
            refetch()
            break
          case 'delete':
            // 先确认再删除
            if (window.confirm(`确定要删除 ${count} 个组织吗？此操作不可恢复！`)) {
              await Promise.all(ids.map(id => api.delete(`/organizations/${id}`)))
              toast.success(`已删除 ${count} 个组织`)
              clearSelection()
              refetch()
            }
            break
          case 'permission':
            // 批量修改计划已由 BulkOperationsPanel 的权限/计划弹窗处理
            break
          default:
            // 未识别的批量操作：静默忽略（所有真实操作均由 BulkOperationsPanel 专用处理器完成）
            logger.info(`[organizations] 未识别的批量操作: ${action}`)
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || '操作失败，请重试')
      } finally {
        setIsProcessing(false)
      }
    },
    [selectedIds, toast, clearSelection, refetch],
  )

  const handleExportComplete = useCallback(
    (format: string, count: number) => {
      toast.success(`成功导出 ${count} 条记录为 ${format.toUpperCase()} 格式`)
    },
    [toast],
  )

  const isTabActive = (id: OrgTab) => activeTab === id

  return (
    <AnalyticsErrorBoundary>
      <div className="space-y-8 max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">

        {/* ── 顶部横幅 — 与 Dashboard 一致 ── */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold leading-snug">{t('pages.organizations.title')}</h1>
              <p className="mt-1 text-white/90 text-sm">{t('pages.organizations.subtitle')}</p>
            </div>
            <Button onClick={() => setShowCreateWizard(true)} variant="secondary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t('pages.organizations.createOrg')}
            </Button>
          </div>
        </div>

        {/* ── 横向药丸 Tab — 与 Settings / Dashboard 一致风格 ── */}
        <div className="overflow-x-auto pb-1 -mx-4 px-[var(--space-apple-md)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="inline-flex items-center gap-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-md)] p-1.5 min-w-max">
            {TABS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all duration-150',
                  isTabActive(id)
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/60 dark:hover:bg-[var(--bg-secondary)]/50',
                )}
              >
                <Icon className={cn('w-4 h-4', isTabActive(id) ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]')} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* ── 概览 Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI 统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-[var(--border-color)]">
                <CardContent className="p-[var(--space-apple-lg)]">
                  <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                    <Building2 className="w-8 h-8 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]" />
                    <TrendingUp className="w-4 h-4 text-[var(--color-success-text)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.totalOrgs}</div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">总组织数</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-[var(--border-color)]">
                <CardContent className="p-[var(--space-apple-lg)]">
                  <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                    <Users className="w-8 h-8 text-[var(--color-primary-text)]" />
                    <TrendingUp className="w-4 h-4 text-[var(--color-success-text)]" />
                  </div>
                  <div className="text-3xl font-bold text-[var(--text-primary)]">
                    {stats.totalMembers.toLocaleString()}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">总成员数</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-[var(--border-color)]">
                <CardContent className="p-[var(--space-apple-lg)]">
                  <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                    <HardDrive className="w-8 h-8 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                    <span className="text-xs font-medium text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">
                      {stats.avgStorageUsage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.avgStorageUsage} className="h-2 mt-2" />
                  <p className="text-sm text-[var(--text-secondary)] mt-2">平均存储使用率</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-[var(--border-color)]">
                <CardContent className="p-[var(--space-apple-lg)]">
                  <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                    <Zap className="w-8 h-8 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                    <span
                      className={`flex items-center text-xs font-medium ${stats.apiTrend.startsWith('+') ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'}`}
                    >
                      {stats.apiTrend.startsWith('+') ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {stats.apiTrend}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-[var(--text-primary)]">
                    {(stats.monthlyApiCalls / 1000).toFixed(1)}K
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">本月 API 调用量</p>
                </CardContent>
              </Card>
            </div>

            {/* 组织列表 */}
            <OrganizationContent
              organizations={filteredOrganizations}
              loading={loading}
              error={error}
              viewMode={viewMode}
              setViewMode={setViewMode}
              search={search}
              setSearch={setSearch}
              localFilters={localFilters}
              setLocalFilters={setLocalFilters}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              selectAll={selectAll}
              allSelected={allSelected}
              clearSelection={clearSelection}
              refetch={refetch}
              searchInputRef={searchInputRef}
              navigate={navigate}
              addRecent={addRecent}
              openCloneDialog={openCloneDialog}
              toggleFavorite={toggleFavorite}
              togglePin={togglePin}
            />
          </div>
        )}

        {/* 最近访问 */}
        {recent.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-[var(--space-apple-lg)]">
            <div className="flex items-center justify-between mb-[var(--space-apple-md)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-secondary-text)]0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                最近访问
              </h3>
              <button onClick={clearRecent} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)] transition-colors">
                清除
              </button>
            </div>
            <div className="flex flex-wrap gap-[var(--space-apple-sm)]">
              {recent.map((entry) => (
                <a
                  key={`${entry.id}-${entry.visitedAt}`}
                  href={`/organizations/${entry.id}`}
                  className="flex items-center gap-2 px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/20 transition-all group"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {entry.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] dark:group-hover:text-white">
                    {entry.name}
                  </span>
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{new Date(entry.visitedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── 数据分析 Tab ── */}
        {activeTab === 'analytics' && (
          <OrganizationAnalytics timeRange="30d" onTimeRangeChange={(range) => logger.info('Time range:', range)} />
        )}

        {/* ── 我的组织 Tab ── */}
        {activeTab === 'my-orgs' && (
          <>
            {organizations.length > 0 && (
              <div className="space-y-[var(--space-apple-sm)]">
                <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)] p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-tertiary)]/60 border border-[var(--border-color)]">
                  <label htmlFor="org-subscription-select" className="text-sm font-medium text-[var(--text-primary)]">
                    订阅与用量管理：
                  </label>
                  <select
                    id="org-subscription-select"
                    value={manageOrgId ?? ''}
                    onChange={(e) => setManageOrgId(e.target.value ? Number(e.target.value) : null)}
                    className="min-h-[44px] rounded-[var(--radius-Apple-sm)] border border-input bg-transparent px-[var(--space-apple-sm)] py-2 text-sm"
                  >
                    <option value="">选择组织查看订阅/用量</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}（{o.plan === 'pro' ? '专业版' : o.plan === 'enterprise' ? '企业版' : '免费版'}）
                      </option>
                    ))}
                  </select>
                </div>
                {manageOrgId != null && <SubscriptionPanel organizationId={manageOrgId} />}
              </div>
            )}
            <OrganizationContent
              organizations={filteredOrganizations}
              loading={loading}
              error={error}
              viewMode={viewMode}
              setViewMode={setViewMode}
              search={search}
              setSearch={setSearch}
              localFilters={localFilters}
              setLocalFilters={setLocalFilters}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              selectAll={selectAll}
              allSelected={allSelected}
              clearSelection={clearSelection}
              refetch={refetch}
              searchInputRef={searchInputRef}
              navigate={navigate}
              addRecent={addRecent}
              openCloneDialog={openCloneDialog}
              toggleFavorite={toggleFavorite}
              togglePin={togglePin}
            />
          </>
        )}

        {/* ── 全部 Tab ── */}
        {activeTab === 'all' && (
          <OrganizationContent
            organizations={filteredOrganizations}
            loading={loading}
            error={error}
            viewMode={viewMode}
            setViewMode={setViewMode}
            search={search}
            setSearch={setSearch}
            localFilters={localFilters}
            setLocalFilters={setLocalFilters}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            selectAll={selectAll}
            allSelected={allSelected}
            clearSelection={clearSelection}
            refetch={refetch}
            searchInputRef={searchInputRef}
            navigate={navigate}
            addRecent={addRecent}
            openCloneDialog={openCloneDialog}
            toggleFavorite={toggleFavorite}
            togglePin={togglePin}
          />
        )}

        {/* ── 回收站 Tab ── */}
        {activeTab === 'trash' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">回收站</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  已删除的组织将在此保留 30 天，之后将被永久清除。
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => fetchTrashedOrganizations()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
            </div>

            {trashLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Loader2 className="w-8 h-8 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] animate-spin mb-[var(--space-apple-md)]" />
                  <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">加载中...</p>
                </CardContent>
              </Card>
            ) : trashedOrganizations.length === 0 ? (
              <Card>
                <CardContent className="p-16 text-center">
                  <Trash2 className="w-16 h-16 mx-auto text-[var(--text-muted)] dark:text-[var(--text-muted)] mb-[var(--space-apple-md)]" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">回收站为空</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    已删除的组织会显示在这里，您可以恢复或永久删除它们。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--bg-tertiary)]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">组织名称</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">Slug</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">计划</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">删除时间</th>
                      <th className="px-5 py-4 text-right text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                    {trashedOrganizations.map((org: Organization) => (
                      <tr key={org.id} className="hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-[var(--space-apple-sm)]">
                            <div className="w-9 h-9 bg-gradient-to-br from-neutral-400 to-neutral-600 rounded-[var(--radius-Apple-sm)] flex items-center justify-center text-white font-bold text-sm">
                              {org.name.charAt(0)}
                            </div>
                            <span className="font-medium text-[var(--text-primary)]">{org.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">@{org.slug}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium ${
                            org.plan === 'pro' ? 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]' :
                            org.plan === 'enterprise' ? 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]' :
                            'bg-[var(--bg-tertiary)] text-[var(--text-primary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]'
                          }`}>
                            {org.plan === 'free' ? '免费版' : org.plan === 'pro' ? '专业版' : '企业版'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          {new Date(org.updatedAt || org.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => restoreOrganization(org.id)}
                              className="px-[var(--space-apple-sm)] py-1.5 text-sm font-medium text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/20 rounded-[var(--radius-Apple-sm)] transition-colors"
                            >
                              恢复
                            </button>
                            <button
                              onClick={() => permanentDeleteOrganization(org.id)}
                              className="px-[var(--space-apple-sm)] py-1.5 text-sm font-medium text-[var(--color-error-text)] hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20 rounded-[var(--radius-Apple-sm)] transition-colors"
                            >
                              永久删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 快捷键提示 */}
        <div className="flex items-center justify-end">
          <ShortcutHints />
        </div>

        {/* 批量操作面板 */}
        {someSelected && (
          <BulkOperationsPanel
            selectedIds={selectedIds}
            onClearSelection={clearSelection}
            onBulkChangePermissions={async (ids, plan) => {
              try {
                const { data } = await api.post('/organizations/batch-plan', { org_ids: ids, plan })
                toast.success(`已将 ${data.updated || ids.length} 个组织的计划更新为「${plan}」`)
                clearSelection()
                refetch()
              } catch (err: any) {
                toast.error(err?.response?.data?.detail || '批量修改计划失败，请重试')
              }
            }}
            onBulkExport={async (ids, format) => {
              try {
                if (ids.length === 0) return
                // 逐组织调用真实导出接口，CSV 合并为一个文件下载
                if (format === 'csv') {
                  const parts: string[] = []
                  for (let i = 0; i < ids.length; i++) {
                    const res = await api.post(
                      `/organizations/${ids[i]}/export?format_type=csv`,
                      {},
                      { responseType: 'blob' },
                    )
                    const text = await (res.data as Blob).text()
                    const cleaned = text.replace(/^\ufeff/, '')
                    // 去掉重复表头（仅保留首个文件表头）
                    if (i > 0) {
                      const lines = cleaned.split(/\r?\n/)
                      lines.shift()
                      parts.push(lines.join('\n'))
                    } else {
                      parts.push(cleaned)
                    }
                  }
                  const blob = new Blob(['\ufeff' + parts.join('\n')], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `organizations_bulk_export.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                  toast.success(`已导出 ${ids.length} 个组织数据（CSV）`)
                } else {
                  // excel/pdf：逐个下载
                  for (const id of ids) {
                    const res = await api.post(
                      `/organizations/${id}/export?format_type=${format}`,
                      {},
                      { responseType: 'blob' },
                    )
                    const blob = res.data as Blob
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `organization_${id}_export.${format === 'excel' ? 'xlsx' : 'pdf'}`
                    a.click()
                    URL.revokeObjectURL(url)
                  }
                  toast.success(`已导出 ${ids.length} 个组织文件`)
                }
                clearSelection()
              } catch (err: any) {
                toast.error(err?.response?.data?.detail || '批量导出失败，请重试')
              }
            }}
            onBulkArchive={handleBulkAction.bind(null, 'archive')}
            onBulkDelete={handleBulkAction.bind(null, 'delete')}
            isProcessing={isProcessing}
          />
        )}

        {/* 克隆组织对话框 */}
        <CloneOrgDialog
          open={showCloneDialog}
          sourceOrg={cloneSourceOrg}
          onClone={handleCloneOrg}
          onClose={() => setShowCloneDialog(false)}
          onCloned={() => refetch()}
        />

        {/* 创建组织向导 */}
        <CreateOrgWizard
          open={showCreateWizard}
          onClose={() => setShowCreateWizard(false)}
          onCreate={async (data) => {
            await createOrganization(data)
            toast.success('组织创建成功!')
            // 不在此处关闭弹窗：由向导内部进入 success 步骤，用户点击「完成」后关闭
          }}
        />

        {/* 数据导出对话框 */}
        <DataExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          organizations={organizations}
          selectedIds={selectedIds}
          onExportComplete={handleExportComplete}
        />
      </div>
    </AnalyticsErrorBoundary>
  )
}

// ── 组织列表内容区 ──
function OrganizationContent({
  organizations,
  loading,
  error,
  viewMode,
  setViewMode,
  search,
  setSearch,
  localFilters,
  setLocalFilters,
  showFilters,
  setShowFilters,
  selectedIds,
  toggleSelect,
  selectAll,
  allSelected,
  clearSelection,
  refetch,
  searchInputRef,
  navigate,
  addRecent,
  openCloneDialog,
  toggleFavorite,
  togglePin,
}: {
  organizations: (Organization | any)[]
  loading: boolean
  error: Error | null
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  search: string
  setSearch: (search: string) => void
  localFilters: LocalFilters
  setLocalFilters: (filters: LocalFilters) => void
  showFilters: boolean
  setShowFilters: (show: boolean) => void
  selectedIds: Set<number>
  toggleSelect: (id: number) => void
  selectAll: () => void
  allSelected: boolean
  clearSelection: () => void
  refetch: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
  navigate: (to: string) => void
  addRecent: (id: number, name: string, slug: string) => void
  openCloneDialog: (org: Organization) => void
  toggleFavorite: (id: number) => void
  togglePin: (id: number) => void
}) {
  const { t } = useTranslation()
  void allSelected;
  void clearSelection;
  // 认证错误（401）直接跳转登录页，不显示错误卡片
  const isAuthError = error?.message?.includes('401') || error?.message?.includes('Unauthorized')
  if (isAuthError) {
    navigate('/login')
    return null
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-[var(--color-error-text)] mb-[var(--space-apple-md)]" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">加载失败</h3>
          <p className="text-sm text-[var(--text-muted)] mb-[var(--space-apple-md)]">{error.message}</p>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 搜索和筛选工具栏 */}
      <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] pointer-events-none" />
          <Input
            ref={searchInputRef}
            id="org-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.organizations.searchPlaceholder')}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-[var(--space-apple-sm)] w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'px-[var(--space-apple-sm)] py-2 min-h-[44px] rounded-[var(--radius-Apple-sm)] border transition-all flex items-center gap-2 text-sm',
              showFilters
                ? 'bg-[var(--color-primary-container)] dark:bg-primary-940/40 border-[var(--color-primary-border)] dark:border-[var(--color-primary)] text-[var(--color-primary-text)]'
                : 'border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]',
            )}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>

          <div className="flex bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] p-1.5">
            {[
              { mode: 'card' as ViewMode, icon: LayoutGrid, label: '卡片' },
              { mode: 'table' as ViewMode, icon: List, label: '表格' },
              { mode: 'compact' as ViewMode, icon: Columns, label: '紧凑' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] rounded-[var(--radius-Apple-sm)] transition-colors',
                  viewMode === mode
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] shadow-sm text-[var(--color-primary-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
                title={label}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <Card className="border-[var(--color-primary-border)] dark:border-[var(--color-primary)]">
          <CardContent className="p-[var(--space-apple-lg)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">计划类型</label>
                <select
                  value={localFilters.plan}
                  onChange={(e) => setLocalFilters({ ...localFilters, plan: e.target.value })}
                  className="w-full px-[var(--space-apple-sm)] py-2 input text-sm"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">成员数量</label>
                <select
                  value={localFilters.memberRange}
                  onChange={(e) => setLocalFilters({ ...localFilters, memberRange: e.target.value })}
                  className="w-full px-[var(--space-apple-sm)] py-2 input text-sm"
                >
                  {MEMBER_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">状态</label>
                <select
                  value={localFilters.status}
                  onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                  className="w-full px-[var(--space-apple-sm)] py-2 input text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">排序方式</label>
                <select
                  value={localFilters.sortBy}
                  onChange={(e) => setLocalFilters({ ...localFilters, sortBy: e.target.value })}
                  className="w-full px-[var(--space-apple-sm)] py-2 input text-sm"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 加载状态 / 空状态 / 列表内容 */}
      {loading ? (
        <OrganizationSkeleton viewMode={viewMode} />
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyStateIllustration type="no-users" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-[var(--space-apple-md)] mb-2">{t('pages.organizations.noOrgs')}</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">{t('pages.organizations.noOrgsDesc')}</p>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              {t('pages.organizations.createOrg')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OrganizationList
          organizations={organizations}
          loading={loading}
          viewMode={viewMode}
          search={search}
          selectedIds={selectedIds}
          onToggleSelect={(id) => toggleSelect(Number(id))}
          onSelectAll={selectAll}
          onNavigateToDetail={(id) => {
            const org = organizations.find(o => o.id === Number(id))
            if (org) {
              addRecent(org.id, org.name, org.slug)
              navigate(`/organizations/${id}`)
            }
          }}
          onToggleFavorite={toggleFavorite}
          onTogglePin={togglePin}
          onClone={(id) => {
            const org = organizations.find(o => o.id === id)
            if (org) openCloneDialog(org)
          }}
          page={1}
          pageSize={20}
          total={organizations.length}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
        />
      )}
    </div>
  )
}

// ── 骨架屏 ──
function OrganizationSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
              <div className="flex items-start gap-[var(--space-apple-sm)]">
                <Skeleton className="w-11 h-11 rounded-[var(--radius-Apple-md)]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-[var(--radius-pill)]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-apple-sm)]">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-14 rounded-[var(--radius-Apple-sm)]" />
                ))}
              </div>
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (viewMode === 'table') {
    return (
      <Card>
        <div className="p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="divide-y divide-neutral-100">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] flex items-center gap-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="w-7 h-7 rounded-[var(--radius-Apple-sm)]" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-[var(--radius-pill)] hidden md:block" />
            <Skeleton className="h-4 w-12 hidden lg:block" />
          </div>
        ))}
      </div>
    </Card>
  )
}
