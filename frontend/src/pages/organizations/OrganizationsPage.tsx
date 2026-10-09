// @ts-nocheck
/**
 * 组织管理页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard 风格统一
 *   - 横排药丸 Tab 导航（桌面自动显示，移动端自动折叠）
 *   - 宽卡片布局，去除紧凑限制，充分利用空间
 *   - 全页面间距宽松（space-y-6、card p-6、section gap-6）
 *   - 去除侧边栏，内容全宽展开
 */
import { useState, useMemo, useCallback, useRef, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Archive,
  Trash2,
  Download,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  X,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  Button,
  Tabs,
  TabsContent,
  Card,
  CardContent,
  Input,
  Badge,
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

const TABS: { id: OrgTab; label: string; icon: typeof Building2 }[] = [
  { id: 'overview',   label: '概览',     icon: LayoutGrid },
  { id: 'analytics',  label: '数据分析', icon: BarChart3 },
  { id: 'my-orgs',    label: '我的组织', icon: Building2 },
  { id: 'all',        label: '全部',     icon: Users },
  { id: 'trash',      label: '回收站',   icon: Trash2 },
]

const PLAN_OPTIONS = [
  { value: 'all', label: '全部计划' },
  { value: 'free', label: '免费版' },
  { value: 'pro', label: '专业版' },
  { value: 'enterprise', label: '企业版' },
]

const MEMBER_RANGE_OPTIONS = [
  { value: 'all', label: '全部成员数' },
  { value: 'small', label: '< 10 人' },
  { value: 'medium', label: '10 - 50 人' },
  { value: 'large', label: '> 50 人' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '活跃' },
  { value: 'paused', label: '已暂停' },
  { value: 'archived', label: '已归档' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'name', label: '名称' },
  { value: 'memberCount', label: '成员数' },
  { value: 'updatedAt', label: '最后活动' },
]

export default function OrganizationsPage() {
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

  const filteredOrganizations = useMemo(() => {
    let result = [...organizations]

    if (activeTab === 'my-orgs') {
      result = result.filter((org) => org.myRole === 'owner' || org.myRole === 'admin')
    }

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

  const handleCreateOrg = useCallback(async () => {
    try {
      await createOrganization({
        name: '新组织',
        slug: `new-org-${Date.now()}`,
        description: '',
        plan: 'free',
      })
      toast.success('组织创建成功!')
    } catch (err) {
      toast.error('创建组织失败，请重试')
    }
  }, [createOrganization, toast])

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
            await Promise.all(ids.map(id => api.patch(`/organizations/${id}/archive`, { isActive: false })))
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
            toast.info('权限批量修改功能开发中...')
            break
          default:
            toast.info(`批量${action}功能开发中...`)
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
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-page-enter">

        {/* ── 顶部横幅 — 与 Dashboard 一致 ── */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold leading-snug">组织管理</h1>
              <p className="mt-1 text-white/90 text-sm">管理您的组织、团队成员和资源配额</p>
            </div>
            <Button onClick={() => setShowCreateWizard(true)} variant="secondary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              创建组织
            </Button>
          </div>
        </div>

        {/* ── 横向药丸 Tab — 与 Settings / Dashboard 一致风格 ── */}
        <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="inline-flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl p-1.5 min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  isTabActive(id)
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50',
                )}
              >
                <Icon className={cn('w-4 h-4', isTabActive(id) ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-400 dark:text-neutral-400')} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 概览 Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI 统计卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-neutral-200 dark:border-neutral-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Building2 className="w-8 h-8 text-secondary-600 dark:text-secondary-700" />
                    <TrendingUp className="w-4 h-4 text-success-600" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{stats.totalOrgs}</div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">总组织数</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-neutral-200 dark:border-neutral-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Users className="w-8 h-8 text-primary-700 dark:text-primary-700" />
                    <TrendingUp className="w-4 h-4 text-success-600" />
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">
                    {stats.totalMembers.toLocaleString()}
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">总成员数</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-neutral-200 dark:border-neutral-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <HardDrive className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                      {stats.avgStorageUsage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats.avgStorageUsage} className="h-2 mt-2" />
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">平均存储使用率</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-700/50 border-neutral-200 dark:border-neutral-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Zap className="w-8 h-8 text-warning-600 dark:text-warning-700" />
                    <span
                      className={`flex items-center text-xs font-medium ${stats.apiTrend.startsWith('+') ? 'text-success-600' : 'text-error-600'}`}
                    >
                      {stats.apiTrend.startsWith('+') ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {stats.apiTrend}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">
                    {(stats.monthlyApiCalls / 1000).toFixed(1)}K
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">本月 API 调用量</p>
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
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                最近访问
              </h3>
              <button onClick={clearRecent} className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                清除
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {recent.map((entry) => (
                <a
                  key={`${entry.id}-${entry.visitedAt}`}
                  href={`/organizations/${entry.id}`}
                  className="flex items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-secondary-300 dark:hover:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-all group"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-secondary-500 to-accent-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {entry.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white">
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
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">回收站</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
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
                  <Loader2 className="w-8 h-8 mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] animate-spin mb-4" />
                  <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">加载中...</p>
                </CardContent>
              </Card>
            ) : trashedOrganizations.length === 0 ? (
              <Card>
                <CardContent className="p-16 text-center">
                  <Trash2 className="w-16 h-16 mx-auto text-neutral-300 dark:text-neutral-400 mb-4" />
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">回收站为空</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    已删除的组织会显示在这里，您可以恢复或永久删除它们。
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">组织名称</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">Slug</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">计划</th>
                      <th className="px-5 py-4 text-left text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">删除时间</th>
                      <th className="px-5 py-4 text-right text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {trashedOrganizations.map((org: Organization) => (
                      <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-neutral-400 to-neutral-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                              {org.name.charAt(0)}
                            </div>
                            <span className="font-medium text-neutral-900 dark:text-white">{org.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">@{org.slug}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            org.plan === 'pro' ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-700' :
                            org.plan === 'enterprise' ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-700' :
                            'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
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
                              className="px-3 py-1.5 text-sm font-medium text-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 rounded-lg transition-colors"
                            >
                              恢复
                            </button>
                            <button
                              onClick={() => permanentDeleteOrganization(org.id)}
                              className="px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors"
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
            onBulkChangePermissions={async () => { toast.info('批量修改权限功能开发中'); return undefined }}
            onBulkExport={async () => { toast.info('请使用右侧导出按钮进行数据导出'); return undefined }}
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
            setShowCreateWizard(false)
          }}
        />

        {/* 数据导出对话框 */}
        <DataExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          organizations={organizations.map((org) => ({
            id: String(org.id),
            name: org.name,
            slug: org.slug,
            description: org.description || '',
            plan: org.plan,
            avatar: null,
            memberCount: org.memberCount,
            teamCount: org.teamCount,
            storageUsed: org.storageUsed * 1024 * 1024 * 1024,
            storageLimit: org.storageLimit * 1024 * 1024 * 1024,
            apiCalls: org.apiUsage,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt || org.createdAt,
            status: org.isActive ? 'active' : 'suspended',
            isFavorite: false,
            isPinned: false,
            myRole: org.myRole,
          }))}
          selectedIds={selectedIds as unknown as Set<any> | undefined}
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
          <AlertCircle className="w-16 h-16 mx-auto text-error-400 mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">加载失败</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{error.message}</p>
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
            placeholder="搜索组织名称或 Slug..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-sm',
              showFilters
                ? 'bg-primary-50 dark:bg-primary-940/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-700'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800',
            )}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>

          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1.5">
            {[
              { mode: 'card' as ViewMode, icon: LayoutGrid, label: '卡片' },
              { mode: 'table' as ViewMode, icon: List, label: '表格' },
              { mode: 'compact' as ViewMode, icon: Columns, label: '紧凑' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  viewMode === mode
                    ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-700'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
                )}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <Card className="border-primary-200 dark:border-primary-800">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">计划类型</label>
                <select
                  value={localFilters.plan}
                  onChange={(e) => setLocalFilters({ ...localFilters, plan: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">成员数量</label>
                <select
                  value={localFilters.memberRange}
                  onChange={(e) => setLocalFilters({ ...localFilters, memberRange: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {MEMBER_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">状态</label>
                <select
                  value={localFilters.status}
                  onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">排序方式</label>
                <select
                  value={localFilters.sortBy}
                  onChange={(e) => setLocalFilters({ ...localFilters, sortBy: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4 mb-2">暂无组织</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">创建您的第一个组织开始协作吧！</p>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              创建组织
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OrganizationList
          organizations={organizations.map((org) => ({
            id: String(org.id),
            name: org.name,
            slug: org.slug,
            description: org.description || '',
            plan: org.plan,
            avatar: null,
            memberCount: org.memberCount,
            teamCount: org.teamCount,
            storageUsed: org.storageUsed * 1024 * 1024 * 1024,
            storageLimit: org.storageLimit * 1024 * 1024 * 1024,
            apiCalls: org.apiUsage,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt || org.createdAt,
            status: org.isActive ? 'active' : 'suspended',
            isFavorite: false,
            isPinned: false,
            myRole: org.myRole,
          }))}
          loading={loading}
          viewMode={viewMode}
          search={search}
          selectedIds={new Set(Array.from(selectedIds).map(String))}
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
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="w-11 h-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-14 rounded-lg" />
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
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="divide-y divide-slate-100">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="w-7 h-7 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-full hidden md:block" />
            <Skeleton className="h-4 w-12 hidden lg:block" />
          </div>
        ))}
      </div>
    </Card>
  )
}
