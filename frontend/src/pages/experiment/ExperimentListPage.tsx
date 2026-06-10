/**
 * 实验列表页 - Phase 5 增强版
 * 搜索高亮 + 关联配方显示 + 批量操作 + 列排序 + 高级筛选
 */
import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Filter, TestTubes, Trash2, X,
  ChevronUp, ChevronDown, ArrowUpDown, FlaskConical, Calendar,
} from 'lucide-react'
import { useExperiments } from '@/hooks/useQueries'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge, EmptyState, Pagination, Skeleton } from '@/components/ui/Common'
import { Button, Input, PageHeader, Badge, Card, CardContent } from '@/components/ui'
import { Highlight } from '@/components/common'
import { cn } from '@/lib/utils'
import { experimentApi } from '@/api/experiment'
import { useToast } from '@/components/ui/Toast'

const statusFilters = [
  { value: '', label: '全部' },
  { value: 'planned', label: '计划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '已失败' },
]

type SortKey = 'title' | 'updated_at' | 'status' | 'code'

interface SortIconProps {
  field: SortKey;
  sortKey: SortKey | null;
  sortDir: 'asc' | 'desc';
}

const SortIcon: React.FC<SortIconProps> = ({ field, sortKey, sortDir }) => {
  if (sortKey !== field) return <ArrowUpDown size={13} className="text-slate-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-violet-500" />
    : <ChevronDown size={13} className="text-violet-500" />
}

export default function ExperimentListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { addToast } = useToast()

  const page = Number(searchParams.get('page') ?? 1)
  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(search)

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { data, isLoading } = useExperiments({
    page,
    page_size: 12,
    status: status || undefined,
    search: search || undefined,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  // 排序
  const sortedItems = useMemo(() => {
    if (!sortKey) return items
    return [...items].sort((a, b) => {
      const av = String(a[sortKey as keyof typeof a] ?? '')
      const bv = String(b[sortKey as keyof typeof b] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [items, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams)
    if (searchInput) params.set('search', searchInput)
    else params.delete('search')
    params.set('page', '1')
    setSearchParams(params)
    setSelectedIds(new Set())
  }

  const handleFilter = (newStatus: string) => {
    const params = new URLSearchParams(searchParams)
    if (newStatus) params.set('status', newStatus)
    else params.delete('status')
    params.set('page', '1')
    setSearchParams(params)
    setSelectedIds(new Set())
  }

  const clearAllFilters = () => {
    setSearchParams({})
    setSearchInput('')
    setSelectedIds(new Set())
    setSortKey(null)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }



  // 批量删除
  const batchDeleteMut = useMutation({
    mutationFn: (ids: number[]) => experimentApi.batchDelete(ids),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.message || '批量删除成功' })
      qc.invalidateQueries({ queryKey: ['experiments'] })
      setSelectedIds(new Set())
    },
    onError: () => {
      addToast({ type: 'error', message: '批量删除失败' })
    },
  })

  const totalPages = Math.ceil(total / 12)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title="实验管理"
        description={`共 ${total} 个实验`}
        actions={
          <Link to="/experiments/new">
            <Button icon={<Plus size={16} />} size="md" className="bg-violet-600 hover:bg-violet-700 shadow-violet-600/25">
              新建实验
            </Button>
          </Link>
        }
      />

      {/* 搜索 + 过滤 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索实验标题或编号..."
                prefix={<Search size={16} />}
                className="flex-1"
              />
              {(search || status || sortKey) && (
                <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearAllFilters}>
                  清除筛选
                </Button>
              )}
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-slate-400" />
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    (status || !f.value) === (f.value || '') && (!f.value ? !status : true)
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  {f.label}
                </button>
              ))}

              {/* 高级筛选按钮 */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  'ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  showAdvanced
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                排序选项
              </button>
            </div>

            {/* 高级排序面板 */}
            {showAdvanced && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="text-xs text-slate-500 shrink-0">排序依据:</span>
                {([
                  { key: 'title' as SortKey, label: '标题' },
                  { key: 'code' as SortKey, label: '编号' },
                  { key: 'status' as SortKey, label: '状态' },
                  { key: 'updated_at' as SortKey, label: '更新时间' },
                ]).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleSort(opt.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                      sortKey === opt.key
                        ? 'bg-violet-500 text-white'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700',
                    )}
                  >
                    {opt.label}
                    {sortKey === opt.key && (
                      <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 多选提示条 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-xl animate-fade-in">
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            已选中 {selectedIds.size} 个实验
          </span>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={13} />}
            loading={batchDeleteMut.isPending}
            onClick={() => batchDeleteMut.mutate(Array.from(selectedIds))}
          >
            批量删除
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/3 mb-3" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon={<TestTubes size={48} />}
          title="暂无实验"
          description="创建实验来验证您的配方方案"
          action={
            <Link to="/experiments/new">
              <Button icon={<Plus size={14} />} size="sm" className="bg-violet-600 hover:bg-violet-700">
                新建实验
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* 表头 */}
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_140px_100px_120px_100px_40px] gap-3 px-5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400" role="rowgroup">
            <div className="w-5" role="columnheader" />
            <button
              onClick={() => toggleSort('title')}
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
              role="columnheader"
              aria-sort={sortKey === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              标题 <SortIcon field="title" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">编号</div>
            <button
              onClick={() => toggleSort('status')}
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
              role="columnheader"
              aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              状态 <SortIcon field="status" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader">关联配方</div>
            <button
              onClick={() => toggleSort('updated_at')}
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
              role="columnheader"
              aria-sort={sortKey === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              更新时间 <SortIcon field="updated_at" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <div role="columnheader" />
          </div>

          {/* 列表行 */}
          {sortedItems.map((exp) => {
            const isSelected = selectedIds.has(exp.id)
            return (
              <div
                key={exp.id}
                className={cn(
                  'group block',
                  isSelected && 'ring-2 ring-violet-400 rounded-2xl',
                )}
              >
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-center gap-3 p-5">
                    {/* 勾选框 */}
                    <button
                      onClick={(e) => { e.preventDefault(); toggleSelect(exp.id) }}
                      className={cn(
                        'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-violet-500 border-violet-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-violet-400',
                      )}
                    >
                      {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>

                    {/* 主内容 */}
                    <Link to={`/experiments/${exp.id}`} className="flex-1 min-w-0 grid sm:grid-cols-[1fr_140px_100px_120px_100px] gap-3 items-start">
                      {/* 标题 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FlaskConical size={14} className="text-violet-400 shrink-0" />
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-violet-600 transition-colors">
                            <Highlight text={exp.title} keyword={search} />
                          </h3>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 pl-[22px]">
                            <Highlight text={exp.description} keyword={search} />
                          </p>
                        )}
                        {exp.objectives && exp.objectives.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 pl-[22px]">
                            {exp.objectives.slice(0, 3).map((obj, i) => (
                              <Badge key={i} variant="info" size="sm">{obj}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 编号 (sm only) */}
                      <div className="hidden sm:block text-xs font-mono text-slate-500 dark:text-slate-400">
                        <Highlight text={exp.code} keyword={search} />
                      </div>

                      {/* 状态 */}
                      <div className="hidden sm:block">
                        <StatusBadge status={exp.status} />
                      </div>

                      {/* 关联配方 */}
                      <div className="hidden sm:block">
                        {exp.formula_id ? (
                          <Link
                            to={`/formulas/${exp.formula_id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FlaskConical size={11} />
                            {(exp).formula_name || `配方#${exp.formula_id}`}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>

                      {/* 更新时间 (sm only) */}
                      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <Calendar size={11} />
                        {new Date(exp.updated_at).toLocaleDateString('zh-CN')}
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => {
            const params = new URLSearchParams(searchParams)
            params.set('page', String(p))
            setSearchParams(params)
          }}
        />
      )}
    </div>
  )
}
