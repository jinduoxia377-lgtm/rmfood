import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronRight, ChevronDown, Search, X, FolderOpen, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import { categoryApi } from '@/api/category'
import { Input, Badge } from '@/components/ui'
import type { Category } from '@/types'

interface CategoryTreeProps {
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  maxHeight?: string
}

interface TreeNode extends Category {
  expanded?: boolean
  children?: TreeNode[]
  formulaCount?: number
}

function buildTree(categories: Category[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, expanded: false, children: [] })
  })

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

function flattenTree(
  nodes: TreeNode[],
  expandedIds: Set<number>,
  searchTerm: string,
  selectedIds: number[],
): TreeNode[] {
  const result: TreeNode[] = []

  nodes.forEach((node) => {
    const matchesSearch = searchTerm
      ? node.name.toLowerCase().includes(searchTerm.toLowerCase())
      : true

    const childMatches = node.children?.some(
      (child) =>
        flattenTree([child], expandedIds, searchTerm, selectedIds).length > 0,
    ) ?? false

    if (matchesSearch || childMatches) {
      result.push(node)
    }

    if (expandedIds.has(node.id) && node.children) {
      result.push(...flattenTree(node.children, expandedIds, searchTerm, selectedIds))
    }
  })

  return result
}

export function CategoryTree({
  value,
  onChange,
  placeholder = '选择分类',
  maxHeight = '320px',
}: CategoryTreeProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  // 虚拟滚动相关状态
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const ITEM_HEIGHT = 36 // 每个节点的高度


  useEffect(() => {
    if (open && categories.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true)
      categoryApi.getTree().then((data) => {
        setCategories(data)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [open, categories.length])

  const selectedCategories = useMemo(() => {
    const selected: Category[] = []
    const ids = new Set(value)

    const traverse = (cats: Category[]) => {
      cats.forEach((cat) => {
        if (ids.has(cat.id)) selected.push(cat)
        if (cat.children) traverse(cat.children)
      })
    }
    traverse(categories)

    return selected
  }, [value, categories])

  const treeData = useMemo(() => buildTree(categories), [categories])

  const flatData = useMemo(
    () => flattenTree(treeData, expandedIds, search, value),
    [treeData, expandedIds, search, value],
  )

  // 虚拟滚动相关计算
  const visibleItemCount = useMemo(() => {
    const containerHeight = parseInt(maxHeight) || 320
    return Math.ceil(containerHeight / ITEM_HEIGHT) + 2 // 额外渲染2个项目以避免空白
  }, [maxHeight])

  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 1) // 额外渲染1个项目以避免空白
  }, [scrollTop])

  const endIndex = useMemo(() => {
    return Math.min(flatData.length, startIndex + visibleItemCount)
  }, [flatData.length, startIndex, visibleItemCount])

  const visibleItems = useMemo(() => {
    return flatData.slice(startIndex, endIndex)
  }, [flatData, startIndex, endIndex])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelect = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const removeSelected = (id: number) => {
    onChange(value.filter((v) => v !== id))
  }

  const getIndent = (node: TreeNode): number => {
    let depth = 0
    let current = node
    while (current.parentId) {
      depth++
      current = categories.find((c) => c.id === current.parentId) || current
    }
    return depth
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full min-h-[44px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700',
          'bg-white dark:bg-neutral-900 text-sm text-left',
          'hover:border-primary-400 dark:hover:border-primary-600 transition-colors',
          'flex flex-wrap gap-1.5 items-center',
        )}
      >
        {/* A-35：占位文案原为 neutral-400，白底 2.56:1 不达标 */}
        {selectedCategories.length === 0 ? (
          <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>
        ) : (
          selectedCategories.map((cat) => (
            <Badge key={cat.id} variant="primary" size="sm" className="gap-1">
              {cat.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSelected(cat.id)
                }}
                className="hover:text-error-500"
              >
                <X size={10} />
              </button>
            </Badge>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索分类..."
              size="sm"
              prefix={<Search size={14} />}
              suffix={
                search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-error-500"
                  >
                    <X size={14} />
                  </button>
                )
              }
              className="w-full"
            />
          </div>

          <div
            ref={containerRef}
            className="overflow-y-auto"
            style={{ maxHeight }}
            onScroll={handleScroll}
          >
            {loading ? (
              <div className="p-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto" />
              </div>
            ) : flatData.length === 0 ? (
              <div className="p-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {search ? '未找到匹配分类' : '暂无分类数据'}
              </div>
            ) : (
              <div style={{ height: `${flatData.length * ITEM_HEIGHT}px`, position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: `${startIndex * ITEM_HEIGHT}px`,
                  width: '100%',
                }}>
                  {visibleItems.map((node, index) => {
                    const indent = getIndent(node)
                    const hasChildren = (node.children?.length ?? 0) > 0
                    const isSelected = value.includes(node.id)
                    const isExpanded = expandedIds.has(node.id)

                    return (
                      <div
                        key={node.id ?? `cat-${index}-${node.name ?? ''}`}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer',
                          'hover:bg-neutral-50 dark:hover:bg-neutral-800',
                          isSelected && 'bg-primary-50 dark:bg-primary-300/20',
                        )}
                        style={{ paddingLeft: `${12 + indent * 16}px`, height: `${ITEM_HEIGHT}px` }}
                         role="button" tabIndex={0} onClick={() => hasChildren ? toggleExpand(node.id) : toggleSelect(node.id)}
                      >
                        {hasChildren ? (
                          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        ) : (
                          <span className="w-[14px]" />
                        )}
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                        </span>
                        <span
                          className={cn(
                            'flex-1 truncate',
                            isSelected
                              ? 'text-primary-700 dark:text-primary-700 font-medium'
                              : 'text-neutral-700 dark:text-neutral-300',
                          )}
                        >
                          {node.name}
                        </span>
                        {node.formulaCount !== undefined && node.formulaCount > 0 && (
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{node.formulaCount}</span>
                        )}
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-primary-500" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-20"
           role="button" tabIndex={0} onClick={() => setOpen(false)}
        />
      )}
    </div>
  )
}
