/**
 * Command Palette / 全局搜索组件
 * Ctrl+K 快捷键唤起，跨模块搜索配方/实验/药材/肽
 *
 * v2.0: 增加真实键盘导航（上下箭头选中 + Enter 确认 + 自动滚动）
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FlaskConical, TestTubes, Leaf, Dna, ArrowRight, Command, Plus, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult, type SearchSuggestion } from '@/api/search'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: typeof FlaskConical; label: string; color: string }> = {
  formula: { icon: FlaskConical, label: '配方', color: 'text-primary-600 dark:text-primary-400' },
  experiment: { icon: TestTubes, label: '实验', color: 'text-blue-600 dark:text-blue-400' },
  herb: { icon: Leaf, label: '药材', color: 'text-primary-600 dark:text-primary-400' },
  peptide: { icon: Dna, label: '肽', color: 'text-violet-600 dark:text-violet-400' },
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', pending_review: '待审核', approved: '已通过', rejected: '已驳回', archived: '已归档',
  planned: '计划中', in_progress: '进行中', completed: '已完成', failed: '已失败', cancelled: '已取消',
  food_homology: '药食同源', tcm: '中药材',
}

/** 可选择项的通用接口 */
interface SelectableItem {
  id: string | number
  type: string
}

function ResultItem({
  item,
  onSelect,
  isSelected,
  itemRef,
}: {
  item: SearchResult
  onSelect: () => void
  isSelected: boolean
  itemRef: (el: HTMLButtonElement | null) => void
}) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.formula
  const Icon = config.icon

  return (
    <button
      ref={itemRef}
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-150',
        'group',
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70',
      )}
    >
      <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800', config.color)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-slate-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300',
        )}>
          {item.title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.status && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            {STATUS_LABELS[item.status] || item.status}
          </span>
        )}
        {isSelected ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            跳转
          </span>
        ) : (
          <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </button>
  )
}

/** 聚焦选中的项（自动滚动到可视区域） */
function scrollToItem(el: HTMLButtonElement | null) {
  if (!el) return
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const navigate = useNavigate()

  // ── 快捷键 Ctrl+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // 聚焦输入框 + 重置状态 + Focus Trap
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelectedIndex(-1)
      itemRefs.current.clear()

      // Focus Trap: 阻止 Tab 焦点逃出命令面板
      const handleTabTrap = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return
        const focusable = document.querySelectorAll<HTMLElement>(
          '#command-palette-search, [data-command-item]',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
      document.addEventListener('keydown', handleTabTrap)
      return () => document.removeEventListener('keydown', handleTabTrap)
    } else {
      setQuery('')
    }
  }, [open])

  // ── 搜索请求（防抖 300ms） ──
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: suggestData } = useQuery({
    queryKey: ['search-suggest', debouncedQuery],
    queryFn: () => searchApi.suggest(debouncedQuery),
    enabled: open && debouncedQuery.length > 0,
  })

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['search-global', debouncedQuery],
    queryFn: () => searchApi.global(debouncedQuery),
    enabled: open && debouncedQuery.length > 0,
    staleTime: 0,
  })

  // ── 合并结果 ──
  const allResults: SearchResult[] = []
  if (searchData?.results) {
    if (searchData.results.formulas) allResults.push(...searchData.results.formulas)
    if (searchData.results.experiments) allResults.push(...searchData.results.experiments)
    if (searchData.results.herbs) allResults.push(...searchData.results.herbs)
    if (searchData.results.peptides) allResults.push(...searchData.results.peptides)
  }

  const suggestions = suggestData?.suggestions ?? []

  // ── 选择结果 → 跳转 ──
  const handleSelect = useCallback((item: SearchResult | SearchSuggestion) => {
    const type = item.type
    if (type === 'formula') navigate(`/formulas/${item.id}`)
    else if (type === 'experiment') navigate(`/experiments/${item.id}`)
    else if (type === 'herb') navigate('/databases?tab=herbs')
    else if (type === 'peptide') navigate('/databases?tab=peptides')
    setOpen(false)
  }, [navigate])

  // 搜索时重置选中索引
  useEffect(() => {
    setSelectedIndex(-1)
  }, [searchData, suggestData])

  // ── 键盘导航（上下箭头 + Enter） ──
  const totalItems = allResults.length > 0 ? allResults.length : suggestions.length

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (totalItems === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev < totalItems - 1 ? prev + 1 : 0
          scrollToItem(itemRefs.current.get(next) ?? null)
          return next
        })
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : totalItems - 1
          scrollToItem(itemRefs.current.get(next) ?? null)
          return next
        })
        break

      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < allResults.length) {
          handleSelect(allResults[selectedIndex])
        } else if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex])
        }
        break
    }
  }, [totalItems, allResults, suggestions, selectedIndex, handleSelect])

  // 设置 item ref
  const setItemRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(index, el)
    else itemRefs.current.delete(index)
  }, [])

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 命令面板 */}
      <div
        className={cn(
          'fixed left-1/2 top-[15%] z-[70] w-full max-w-xl -translate-x-1/2',
          'bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700',
          'overflow-hidden flex flex-col',
          'transition-all duration-200 origin-top',
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
        )}
        style={{ maxHeight: '70vh' }}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-search"
            name="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索配方、实验、药材、活性肽..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              清除
            </button>
          )}
          <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="overflow-y-auto flex-1 py-2">
          {query.length === 0 ? (
            /* 空状态 - 显示快捷入口 */
            <div className="px-4 py-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Command size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">输入关键词开始搜索</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">支持搜索配方、实验、中药材、活性肽</p>

              {/* 快捷入口 */}
              <div className="mt-5 grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <button
                  onClick={() => { navigate('/formulas/new'); setOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
                >
                  <Plus size={14} /> 新建配方
                </button>
                <button
                  onClick={() => { navigate('/experiments/new'); setOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-sm font-medium"
                >
                  <Plus size={14} /> 新建实验
                </button>
                <button
                  onClick={() => { navigate('/ai'); setOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-sm font-medium"
                >
                  <Sparkles size={14} /> AI 助手
                </button>
                <button
                  onClick={() => { navigate('/databases'); setOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                >
                  <Dna size={14} /> 数据库
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Leaf size={12} /> 药材</span>
                <span className="flex items-center gap-1"><FlaskConical size={12} /> 配方</span>
                <span className="flex items-center gap-1"><TestTubes size={12} /> 实验</span>
                <span className="flex items-center gap-1"><Dna size={12} /> 肽</span>
              </div>
            </div>
          ) : searching ? (
            <div className="px-4 py-6 text-center">
              <div className="inline-block w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 mt-2">搜索中...</p>
            </div>
          ) : allResults.length > 0 ? (
            <div className="space-y-0.5 px-2">
              {allResults.map((item, idx) => (
                <ResultItem
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onSelect={() => handleSelect(item)}
                  isSelected={idx === selectedIndex}
                  itemRef={setItemRef(idx)}
                />
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-0.5 px-2">
              {suggestions.map((s, idx) => {
                const config = TYPE_CONFIG[s.type] || TYPE_CONFIG.formula
                const Icon = config.icon
                const isSel = idx === selectedIndex
                return (
                  <button
                    key={`${s.type}-${s.id}`}
                    ref={setItemRef(idx)}
                    onClick={() => handleSelect(s)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-xl transition-colors',
                      isSel
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70',
                    )}
                  >
                    <Icon size={14} className={cn('shrink-0', config.color)} />
                    <span className={cn(
                      'text-sm',
                      isSel ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300',
                    )}>
                      {s.text}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">未找到相关结果</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">尝试不同的关键词</p>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        {(searchData || query.length > 0) && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              {searchData ? `共 ${searchData.total} 个结果` : '输入关键词搜索'}
            </span>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px]">↑↓</kbd>
                导航
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px]">↵</kbd>
                选择
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px]">esc</kbd>
                关闭
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
