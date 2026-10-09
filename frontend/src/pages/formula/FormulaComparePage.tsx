/**
 * 配方对比页面 - Phase 5 增强
 * 左右对比两个配方的详细差异
 */
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, X, CheckCircle2, Search, ArrowRight } from 'lucide-react'
import { useFormulas } from '@/hooks/useQueries'
import { FormulaCompare } from './components/FormulaCompare'
import { Button, Input, PageHeader, Card, CardContent } from '@/components/ui'
import { StatusBadge, Skeleton } from '@/components/ui/Common'
import type { Formula } from '@/types'

export default function FormulaComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [leftId, setLeftId] = useState<number | null>(Number(searchParams.get('left')) || null)
  const [rightId, setRightId] = useState<number | null>(Number(searchParams.get('right')) || null)
  const [leftSearch, setLeftSearch] = useState('')
  const [rightSearch, setRightSearch] = useState('')
  const [showLeftPicker, setShowLeftPicker] = useState(false)
  const [showRightPicker, setShowRightPicker] = useState(false)

  const { data: leftFormulas, isLoading: leftLoading } = useFormulas({
    page: 1,
    page_size: 20,
    search: leftSearch || undefined,
  })

  const { data: rightFormulas, isLoading: rightLoading } = useFormulas({
    page: 1,
    page_size: 20,
    search: rightSearch || undefined,
  })

  const leftList = ((leftFormulas as { data?: Formula[] } | null | undefined)?.data) || []
  const rightList = ((rightFormulas as { data?: Formula[] } | null | undefined)?.data) || []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="配方对比"
        description="选择两个配方进行详细对比分析"
        actions={
          <button
            onClick={() => navigate('/formulas')}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            <ArrowLeft size={16} />
            返回列表
          </button>
        }
      />

      {/* 选择器 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 左侧配方选择 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">配方 A</h3>
              {leftId && (
                <button
                  onClick={() => setLeftId(null)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 flex items-center gap-1"
                >
                  <X size={12} />
                  清除
                </button>
              )}
            </div>
            {!leftId ? (
              <div className="relative">
                <Input
                  value={leftSearch}
                  onChange={(e) => { setLeftSearch(e.target.value); setShowLeftPicker(true) }}
                  onFocus={() => setShowLeftPicker(true)}
                  placeholder="搜索配方..."
                  prefix={<Search size={14} />}
                />
                {showLeftPicker && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {leftLoading ? (
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : leftList.length > 0 ? (
                      leftList.map((formula: Formula) => (
                        <button
                          key={formula.id}
                          onClick={() => { setLeftId(formula.id); setShowLeftPicker(false); setLeftSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800 last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-neutral-900 dark:text-white">{formula.name}</span>
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formula.code}</p>
                            </div>
                            <StatusBadge status={formula.status} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到配方</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-700 dark:text-primary-700">
                      {leftList.find((f: Formula) => f.id === leftId)?.name || `#${leftId}`}
                    </p>
                    <p className="text-xs text-primary-500">
                      {leftList.find((f: Formula) => f.id === leftId)?.code}
                    </p>
                  </div>
                  <CheckCircle2 size={18} className="text-primary-500" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 中间 VS */}
        <Card>
          <CardContent className="p-4 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-2">
                <ArrowRight size={20} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </div>
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">对比</p>
            </div>
          </CardContent>
        </Card>

        {/* 右侧配方选择 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">配方 B</h3>
              {rightId && (
                <button
                  onClick={() => setRightId(null)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500 flex items-center gap-1"
                >
                  <X size={12} />
                  清除
                </button>
              )}
            </div>
            {!rightId ? (
              <div className="relative">
                <Input
                  value={rightSearch}
                  onChange={(e) => { setRightSearch(e.target.value); setShowRightPicker(true) }}
                  onFocus={() => setShowRightPicker(true)}
                  placeholder="搜索配方..."
                  prefix={<Search size={14} />}
                />
                {showRightPicker && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                    {rightLoading ? (
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : rightList.length > 0 ? (
                      rightList.map((formula: Formula) => (
                        <button
                          key={formula.id}
                          onClick={() => { setRightId(formula.id); setShowRightPicker(false); setRightSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800 last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-neutral-900 dark:text-white">{formula.name}</span>
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formula.code}</p>
                            </div>
                            <StatusBadge status={formula.status} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到配方</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-700 dark:text-primary-700">
                      {rightList.find((f: Formula) => f.id === rightId)?.name || `#${rightId}`}
                    </p>
                    <p className="text-xs text-primary-500">
                      {rightList.find((f: Formula) => f.id === rightId)?.code}
                    </p>
                  </div>
                  <CheckCircle2 size={18} className="text-primary-500" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 对比结果 */}
      <FormulaCompare leftId={leftId} rightId={rightId} />

      {/* 快捷操作 */}
      {(leftId || rightId) && (
        <div className="flex justify-center gap-4">
          {leftId && (
            <Link to={`/formulas/${leftId}`}>
              <Button variant="secondary" size="sm">
                查看配方 A 详情
              </Button>
            </Link>
          )}
          {rightId && (
            <Link to={`/formulas/${rightId}`}>
              <Button variant="secondary" size="sm">
                查看配方 B 详情
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
