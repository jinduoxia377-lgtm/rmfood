import { useState, useMemo, useCallback } from 'react'
import {
  Building2, Plus, Users, HardDrive, Zap,
  Search, Filter, LayoutGrid, List, Columns,
  Archive, Trash2, Download, ShieldCheck,
  TrendingUp, TrendingDown,
  X, RefreshCw, AlertCircle, BarChart3,
} from 'lucide-react'
import {
  PageHeader, Button, Tabs, TabsList, TabsTrigger, TabsContent,
  Card, CardContent, Input, Select, Badge, Progress,
  Skeleton, EmptyStateIllustration, useToast,
} from '@/components/ui'
import { useOrganizations } from '@/hooks/useOrganizations'
import type { Organization } from '@/hooks/useOrganizations'
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary'

import { OrganizationList } from './components/OrganizationList'
import { OrganizationAnalytics } from './components/OrganizationAnalytics'
import { BulkOperationsPanel } from './components/BulkOperationsPanel'
import { DataExportDialog } from './components/DataExportDialog'
import { logger } from '@/utils/safeLogger';


type OrgTab = 'overview' | 'analytics' | 'my-orgs' | 'all' | 'trash'
type ViewMode = 'card' | 'table' | 'compact'

interface LocalFilters {
  plan: string
  memberRange: string
  status: string
  sortBy: string
}

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
  const toast = useToast()

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
  } = useOrganizations({ autoFetch: true })

  const filteredOrganizations = useMemo(() => {
    let result = [...organizations]

    if (activeTab === 'my-orgs') {
      result = result.filter(org => org.myRole === 'owner' || org.myRole === 'admin')
    }

    if (localFilters.plan !== 'all') {
      result = result.filter(org => org.plan === localFilters.plan)
    }

    if (localFilters.memberRange !== 'all') {
      result = result.filter(org => {
        switch (localFilters.memberRange) {
          case 'small': return org.memberCount < 10
          case 'medium': return org.memberCount >= 10 && org.memberCount <= 50
          case 'large': return org.memberCount > 50
          default: return true
        }
      })
    }

    if (localFilters.status !== 'all') {
      result = result.filter(org => {
        if (localFilters.status === 'active') return org.isActive
        if (localFilters.status === 'paused') return !org.isActive && !org.isPinned
        return org.isPinned
      })
    }

    if (search.trim()) {
      const keyword = search.toLowerCase()
      result = result.filter(org =>
        org.name.toLowerCase().includes(keyword) ||
        org.slug.toLowerCase().includes(keyword),
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

  const stats = useMemo(() => ({
    totalOrgs: organizations.length,
    totalMembers: organizations.reduce((sum, org) => sum + org.memberCount, 0),
    avgStorageUsage: organizations.length > 0
      ? organizations.reduce((sum, org) => sum + (org.storageUsed / org.storageLimit * 100), 0) / organizations.length
      : 0,
    monthlyApiCalls: organizations.reduce((sum, org) => sum + org.apiUsage, 0),
    apiTrend: '+12.5%',
  }), [organizations])

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

  const handleBulkAction = useCallback(async (action: string) => {
    const count = selectedIds.size
    switch (action) {
      case 'export':
        setShowExportDialog(true)
        break
      case 'archive':
        toast.success(`已归档 ${count} 个组织`)
        clearSelection()
        break
      case 'delete':
        toast.warning(`确定要删除 ${count} 个组织吗? 此操作不可恢复!`)
        break
      case 'permission':
        toast.info('权限修改功能开发中...')
        break
      default:
        toast.info(`批量${action}功能开发中...`)
    }
  }, [selectedIds.size, toast, clearSelection])

  const handleExportComplete = useCallback((format: string, count: number) => {
    toast.success(`成功导出 ${count} 条记录为 ${format.toUpperCase()} 格式`)
  }, [toast])

  return (
    <AnalyticsErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-page-enter">
        <PageHeader
          title="组织管理"
          description="管理您的组织、团队成员和资源配额"
          action={
            <Button onClick={handleCreateOrg} variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              创建组织
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrgTab)}>
          <TabsList>
            <TabsTrigger value="overview">
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              概览
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              数据分析
            </TabsTrigger>
            <TabsTrigger value="my-orgs">
              <Building2 className="w-4 h-4 mr-1.5" />
              我的组织
            </TabsTrigger>
            <TabsTrigger value="all">
              <Users className="w-4 h-4 mr-1.5" />
              全部
            </TabsTrigger>
            <TabsTrigger value="trash">
              <Trash2 className="w-4 h-4 mr-1.5" />
              回收站
            </TabsTrigger>
          </TabsList>

          {/* 概览 Tab */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* KPI 统计卡片 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-100 dark:border-blue-900/30">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalOrgs}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">总组织数</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-100 dark:border-emerald-900/30">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalMembers.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">总成员数</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-100 dark:border-violet-900/30">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <HardDrive className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        {stats.avgStorageUsage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={stats.avgStorageUsage} className="h-2 mt-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">平均存储使用率</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-100 dark:border-amber-900/30">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Zap className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      <span className={`flex items-center text-xs font-medium ${stats.apiTrend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.apiTrend.startsWith('+') ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {stats.apiTrend}
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(stats.monthlyApiCalls / 1000).toFixed(1)}K
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">本月 API 调用量</p>
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
                handleBulkAction={handleBulkAction}
                clearSelection={clearSelection}
                refetch={refetch}
              />
            </div>
          </TabsContent>

          {/* 数据分析 Tab */}
          <TabsContent value="analytics">
            <OrganizationAnalytics timeRange="30d" onTimeRangeChange={(range) => logger.info('Time range:', range)} />
          </TabsContent>

          {/* 我的组织 Tab */}
          <TabsContent value="my-orgs">
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
              handleBulkAction={handleBulkAction}
              clearSelection={clearSelection}
              refetch={refetch}
            />
          </TabsContent>

          {/* 全部 Tab */}
          <TabsContent value="all">
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
              handleBulkAction={handleBulkAction}
              clearSelection={clearSelection}
              refetch={refetch}
            />
          </TabsContent>

          {/* 回收站 Tab */}
          <TabsContent value="trash">
            <Card>
              <CardContent className="p-12 text-center">
                <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">回收站</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  已删除的组织将在此保留 30 天，之后将被永久清除。
                </p>
                <EmptyStateIllustration type="no-users" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 批量操作面板 */}
        {someSelected && (
          <BulkOperationsPanel
            selectedIds={selectedIds}
            onClearSelection={clearSelection}
            onBulkChangePermissions={() => handleBulkAction('permission')}
            onBulkExport={() => handleBulkAction('export')}
            onBulkArchive={() => handleBulkAction('archive')}
            onBulkDelete={() => handleBulkAction('delete')}
          />
        )}

        {/* 数据导出对话框 */}
        <DataExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          organizations={organizations.map(org => ({
            id: String(org.id),
            name: org.name,
            slug: org.slug,
            description: org.description || '',
            plan: org.plan,
            memberCount: org.memberCount,
            teamCount: 0,
            storageUsed: org.storageUsed * 1024 * 1024 * 1024,
            storageLimit: org.storageLimit * 1024 * 1024 * 1024,
            apiCalls: org.apiUsage,
            status: org.isActive ? 'active' : 'suspended',
            createdAt: org.createdAt,
            updatedAt: org.updatedAt || org.createdAt,
            isFavorite: false,
            isPinned: false,
          }))}
          selectedIds={selectedIds as unknown as Set<string> | undefined}
          onExportComplete={handleExportComplete}
        />
      </div>
    </AnalyticsErrorBoundary>
  )
}

interface OrganizationContentProps {
  organizations: Organization[]
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
  handleBulkAction: (action: string) => void
  clearSelection: () => void
  refetch: () => void
}

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
}: OrganizationContentProps) {
  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">加载失败</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error.message}</p>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选工具栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索组织名称或 Slug..."
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-sm ${
              showFilters
                ? 'bg-primary-50 dark:bg-primary-940/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>

          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            {[
              { mode: 'card' as ViewMode, icon: LayoutGrid, label: '卡片' },
              { mode: 'table' as ViewMode, icon: List, label: '表格' },
              { mode: 'compact' as ViewMode, icon: Columns, label: '紧凑' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
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
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">计划类型</label>
                <select
                  value={localFilters.plan}
                  onChange={(e) => setLocalFilters({ ...localFilters, plan: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {PLAN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">成员数量</label>
                <select
                  value={localFilters.memberRange}
                  onChange={(e) => setLocalFilters({ ...localFilters, memberRange: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {MEMBER_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">状态</label>
                <select
                  value={localFilters.status}
                  onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">排序方式</label>
                <select
                  value={localFilters.sortBy}
                  onChange={(e) => setLocalFilters({ ...localFilters, sortBy: e.target.value })}
                  className="w-full px-3 py-2 input text-sm"
                >
                  {SORT_OPTIONS.map(opt => (
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">暂无组织</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              创建您的第一个组织开始协作吧！
            </p>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-2" />
              创建组织
            </Button>
          </CardContent>
        </Card>
      ) : (
        <OrganizationList
          organizations={organizations.map(org => ({
            id: String(org.id),
            name: org.name,
            slug: org.slug,
            description: org.description || '',
            plan: org.plan,
            avatar: null,
            memberCount: org.memberCount,
            teamCount: 0,
            storageUsed: org.storageUsed * 1024 * 1024 * 1024,
            storageLimit: org.storageLimit * 1024 * 1024 * 1024,
            apiCalls: org.apiUsage,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt || org.createdAt,
            status: org.isActive ? 'active' : 'suspended',
            isFavorite: false,
            isPinned: false,
          }))}
          loading={false}
          viewMode={viewMode}
          search={search}
          selectedIds={new Set(Array.from(selectedIds).map(String))}
          onToggleSelect={(id) => toggleSelect(Number(id))}
          onSelectAll={selectAll}
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

interface OrganizationSkeletonProps {
  viewMode: ViewMode
}

function OrganizationSkeleton({ viewMode }: OrganizationSkeletonProps) {
  if (viewMode === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-4">
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
      <div className="divide-y divide-gray-100">
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
