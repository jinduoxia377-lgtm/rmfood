/**
 * 配方对比页面 - Phase 5 增强
 * 左右对比两个配方的详细差异
 */
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, X, CheckCircle2, Search, ArrowRight } from 'lucide-react'
import { useFormulas } from '@/hooks/useQueries'
import { FormulaCompare } from './components/FormulaCompare'
import { Button, Input, Card, CardContent } from '@/components/ui'
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
    <div className="max-w-[1600px] mx-auto space-y-6 py-[var(--space-apple-lg)]">
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-[var(--space-apple-md)]">
          <div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">配方对比</h1>
            <p className="mt-1 text-sm text-white/80">并排对比多个配方的成分与指标</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/formulas')}
              className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              返回列表
            </button>
          </div>
        </div>
      </div>

      {/* 选择器 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* 左侧配方选择 */}
        <Card>
          <CardContent className="p-[var(--space-apple-md)]">
            <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">配方 A</h3>
              {leftId && (
                <button
                  onClick={() => setLeftId(null)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 flex items-center gap-1"
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
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-xl max-h-64 overflow-y-auto">
                    {leftLoading ? (
                      <div className="p-[var(--space-apple-sm)] space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : leftList.length > 0 ? (
                      leftList.map((formula: Formula) => (
                        <button
                          key={formula.id}
                          onClick={() => { setLeftId(formula.id); setShowLeftPicker(false); setLeftSearch('') }}
                          className="w-full text-left px-[var(--space-apple-sm)] py-2 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{formula.name}</span>
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formula.code}</p>
                            </div>
                            <StatusBadge status={formula.status} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-[var(--space-apple-md)] text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到配方</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--color-primary-container)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-primary-text)]">
                      {leftList.find((f: Formula) => f.id === leftId)?.name || `#${leftId}`}
                    </p>
                    <p className="text-xs text-[var(--color-primary-text)]0">
                      {leftList.find((f: Formula) => f.id === leftId)?.code}
                    </p>
                  </div>
                  <CheckCircle2 size={18} className="text-[var(--color-primary-text)]0" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 中间 VS */}
        <Card>
          <CardContent className="p-[var(--space-apple-md)] flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-2">
                <ArrowRight size={20} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
              </div>
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">对比</p>
            </div>
          </CardContent>
        </Card>

        {/* 右侧配方选择 */}
        <Card>
          <CardContent className="p-[var(--space-apple-md)]">
            <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">配方 B</h3>
              {rightId && (
                <button
                  onClick={() => setRightId(null)}
                  className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 flex items-center gap-1"
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
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-xl max-h-64 overflow-y-auto">
                    {rightLoading ? (
                      <div className="p-[var(--space-apple-sm)] space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : rightList.length > 0 ? (
                      rightList.map((formula: Formula) => (
                        <button
                          key={formula.id}
                          onClick={() => { setRightId(formula.id); setShowRightPicker(false); setRightSearch('') }}
                          className="w-full text-left px-[var(--space-apple-sm)] py-2 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{formula.name}</span>
                              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formula.code}</p>
                            </div>
                            <StatusBadge status={formula.status} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-[var(--space-apple-md)] text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到配方</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--color-primary-container)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)] rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-primary-text)]">
                      {rightList.find((f: Formula) => f.id === rightId)?.name || `#${rightId}`}
                    </p>
                    <p className="text-xs text-[var(--color-primary-text)]0">
                      {rightList.find((f: Formula) => f.id === rightId)?.code}
                    </p>
                  </div>
                  <CheckCircle2 size={18} className="text-[var(--color-primary-text)]0" />
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
