/**
 * Command Palette / 全局搜索组件
 * Ctrl+K 快捷键唤起，跨模块搜索配方/实验/药材/肽
 *
 * v2.0: 增加真实键盘导航（上下箭头选中 + Enter 确认 + 自动滚动）
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, FlaskConical, TestTubes, Leaf, Dna, ArrowRight, Command, Plus, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchApi, type SearchResult, type SearchSuggestion } from '@/api/search'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<string, { icon: typeof FlaskConical; color: string }> = {
  formula: { icon: FlaskConical, color: 'text-primary-700 dark:text-primary-700' },
  experiment: { icon: TestTubes, color: 'text-secondary-600 dark:text-secondary-700' },
  herb: { icon: Leaf, color: 'text-primary-700 dark:text-primary-700' },
  peptide: { icon: Dna, color: 'text-accent-600 dark:text-accent-700' },
}

/** 状态 → i18n 键（通用状态复用 common.statusLabels，命令面板特有状态挂在 commandPalette 下） */
const STATUS_I18N_KEYS: Record<string, string> = {
  draft: 'common.statusLabels.draft',
  pending_review: 'common.statusLabels.pending_review',
  approved: 'common.statusLabels.approved',
  rejected: 'common.statusLabels.rejected',
  archived: 'common.statusLabels.archived',
  planned: 'common.statusLabels.planned',
  in_progress: 'common.statusLabels.in_progress',
  completed: 'common.statusLabels.completed',
  failed: 'common.statusLabels.failed',
  cancelled: 'common.statusLabels.cancelled',
  food_homology: 'common.commandPalette.statusFoodHomology',
  tcm: 'common.commandPalette.statusTcm',
}

/** 可选择项的通用接口 */
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
  const { t } = useTranslation()
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
          ? 'bg-primary-50 dark:bg-primary-300/20'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70',
      )}
    >
      <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-800', config.color)}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected
            ? 'text-primary-700 dark:text-primary-700'
            : 'text-neutral-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300',
        )}>
          {item.title}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{item.subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.status && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {STATUS_I18N_KEYS[item.status] ? t(STATUS_I18N_KEYS[item.status]) : item.status}
          </span>
        )}
        {isSelected ? (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-300/30 text-primary-700 dark:text-primary-700">
            {t('common.commandPalette.navigate')}
          </span>
        ) : (
          <ArrowRight size={14} className="text-neutral-600 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
  const { t } = useTranslation()

  // ── 快捷键 Ctrl+K / Cmd+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    // 自定义事件：顶栏搜索按钮直接触发（避免伪造 KeyboardEvent 修饰键在 macOS 失效）
    const customHandler = () => setOpen(true)
    document.addEventListener('keydown', handler)
    document.addEventListener('rmfood:open-command-palette', customHandler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('rmfood:open-command-palette', customHandler)
    }
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    return
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
           role="button" tabIndex={0} onClick={() => setOpen(false)}
        />
      )}

      {/* 命令面板 */}
      <div
        className={cn(
          'fixed left-1/2 top-[15%] z-[70] w-full max-w-xl -translate-x-1/2',
          'bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700',
          'overflow-hidden flex flex-col',
          'transition-all duration-200 origin-top',
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none',
        )}
        style={{ maxHeight: '70vh' }}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <Search size={18} className="text-neutral-600 dark:text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-search"
            name="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('common.commandPalette.searchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white placeholder:text-neutral-600 focus:outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-600 transition-colors"
            >
              {t('common.commandPalette.clear')}
            </button>
          )}
          <kbd className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            ESC
          </kbd>
        </div>

        {/* 结果列表 */}
        <div className="overflow-y-auto flex-1 py-2">
          {query.length === 0 ? (
            /* 空状态 - 显示快捷入口 */
            <div className="px-4 py-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Command size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.commandPalette.emptyTitle')}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t('common.commandPalette.emptySubtitle')}</p>

              {/* 快捷入口 */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xs mx-auto">
                {/* D-68：四个快捷入口 chip 在暗色下用 *-900/20 浅色蒙版 + 600 档文字，
                    实测 accent #a78bfa 3.72:1、secondary #60a5fa 4.02:1 —— 均未达 AA。
                    暗色色阶是反转的（号大越亮），统一提到 700 档后为 5.49 / 5.67。 */}
                <button
                  onClick={() => { navigate('/formulas/new'); setOpen(false) }}
                  className="flex min-h-[44px] items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-medium"
                >
                  <Plus size={14} /> {t('common.commandPalette.quickNewFormula')}
                </button>
                <button
                  onClick={() => { navigate('/experiments/new'); setOpen(false) }}
                  className="flex min-h-[44px] items-center gap-2 px-3 py-2.5 rounded-xl bg-accent-50 dark:bg-accent-300/20 text-accent-700 dark:text-accent-700 hover:bg-accent-100 dark:hover:bg-accent-900/30 transition-colors text-sm font-medium"
                >
                  <Plus size={14} /> {t('common.commandPalette.quickNewExperiment')}
                </button>
                <button
                  onClick={() => { navigate('/ai'); setOpen(false) }}
                  className="flex min-h-[44px] items-center gap-2 px-3 py-2.5 rounded-xl bg-warning-50 dark:bg-warning-300/20 text-warning-700 dark:text-warning-700 hover:bg-warning-100 dark:hover:bg-warning-900/30 transition-colors text-sm font-medium"
                >
                  <Sparkles size={14} /> {t('common.commandPalette.quickAiAssistant')}
                </button>
                <button
                  onClick={() => { navigate('/databases'); setOpen(false) }}
                  className="flex min-h-[44px] items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-300/20 text-secondary-700 dark:text-secondary-700 hover:bg-secondary-100 dark:hover:bg-secondary-900/30 transition-colors text-sm font-medium"
                >
                  <Dna size={14} /> {t('common.commandPalette.quickDatabase')}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
                <span className="flex items-center gap-1"><Leaf size={12} /> {t('common.commandPalette.typeHerb')}</span>
                <span className="flex items-center gap-1"><FlaskConical size={12} /> {t('common.commandPalette.typeFormula')}</span>
                <span className="flex items-center gap-1"><TestTubes size={12} /> {t('common.commandPalette.typeExperiment')}</span>
                <span className="flex items-center gap-1"><Dna size={12} /> {t('common.commandPalette.typePeptide')}</span>
              </div>
            </div>
          ) : searching ? (
            <div className="px-4 py-6 text-center">
              <div className="inline-block w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">{t('common.commandPalette.searching')}</p>
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
                        ? 'bg-primary-50 dark:bg-primary-300/20'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70',
                    )}
                  >
                    <Icon size={14} className={cn('shrink-0', config.color)} />
                    <span className={cn(
                      'text-sm',
                      isSel ? 'text-primary-700 dark:text-primary-700' : 'text-neutral-700 dark:text-neutral-400',
                    )}>
                      {s.text}
                    </span>
                    <span className="text-xs text-neutral-600 ml-auto">{s.hint}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.commandPalette.noResults')}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t('common.commandPalette.noResultsHint')}</p>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        {(searchData || query.length > 0) && (
          <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-600">
              {searchData ? t('common.commandPalette.resultCount', { count: searchData.total }) : t('common.commandPalette.footerSearchHint')}
            </span>
            <div className="flex items-center gap-3 text-xs text-neutral-600">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">↑↓</kbd>
                {t('common.commandPalette.footerNavigate')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">↵</kbd>
                {t('common.commandPalette.footerSelect')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">esc</kbd>
                {t('common.commandPalette.footerClose')}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
