import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, Plus, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagApi } from '@/api/tag'
import { Input, Badge, Button } from '@/components/ui'
import type { Tag } from '@/types'

interface TagMultiSelectProps {
  value: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  maxHeight?: string
}

export function TagMultiSelect({
  value,
  onChange,
  placeholder = '选择标签',
  maxHeight = '320px',
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [creatingName, setCreatingName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 虚拟滚动相关状态
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const ITEM_HEIGHT = 40 // 每个标签的高度

  useEffect(() => {
    if (open && tags.length === 0) {
      loadTags()
    }
  }, [open, tags.length])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const loadTags = async () => {
    setLoading(true)
    try {
      const data = await tagApi.list({ search: search || undefined })
      setTags(data)
    } catch {
      setTags([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        loadTags()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, open])

  const selectedTags = tags.filter((tag) => value.includes(tag.id))

  // 虚拟滚动相关计算
  const visibleItemCount = useMemo(() => {
    const containerHeight = parseInt(maxHeight) || 320
    return Math.ceil(containerHeight / ITEM_HEIGHT) + 2 // 额外渲染2个项目以避免空白
  }, [maxHeight])

  const startIndex = useMemo(() => {
    return Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 1) // 额外渲染1个项目以避免空白
  }, [scrollTop])

  const endIndex = useMemo(() => {
    return Math.min(tags.length, startIndex + visibleItemCount)
  }, [tags.length, startIndex, visibleItemCount])

  const visibleTags = useMemo(() => {
    return tags.slice(startIndex, endIndex)
  }, [tags, startIndex, endIndex])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const toggleTag = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const removeTag = (id: number) => {
    onChange(value.filter((v) => v !== id))
  }

  const handleCreateTag = async () => {
    const name = creatingName.trim()
    if (!name) return

    setCreating(true)
    try {
      const newTag = await tagApi.create({ name })
      setTags((prev) => [newTag, ...prev])
      onChange([...value, newTag.id])
      setCreatingName('')
      setCreating(false)
    } catch {
      setCreating(false)
    }
  }

  const getTagColor = (tag: Tag) => {
    if (tag.color) return tag.color
    const colors = ['primary', 'success', 'warning', 'info', 'neutral']
    const index = tag.name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(!open)
          } else if (e.key === 'Escape' && open) {
            setOpen(false)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="tag-select-label"
        aria-describedby="tag-select-desc"
        className={cn(
          'w-full min-h-[44px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700',
          'bg-white dark:bg-neutral-900 text-sm text-left',
          'hover:border-primary-400 dark:hover:border-primary-600 transition-colors',
          'flex flex-wrap gap-1.5 items-center',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        )}
      >
        <span id="tag-select-label" className="sr-only">选择标签</span>
        <span id="tag-select-desc" className="sr-only">
          {open ? '已打开标签选择下拉菜单' : '点击打开标签选择下拉菜单'}
        </span>
        {/* A-35：占位文案原为 neutral-400(#94a3b8)，白底仅 2.56:1。
            占位符同样承载信息，WCAG 对比度要求对它一视同仁。 */}
        {selectedTags.length === 0 ? (
          <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>
        ) : (
          selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant={getTagColor(tag) as 'primary' | 'success' | 'warning' | 'info' | 'neutral'}
              size="sm"
              className="gap-1"
            >
              {tag.icon && <span className="text-xs">{tag.icon}</span>}
              {tag.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag.id)
                }}
                className="hover:text-error-500 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-1 rounded"
                aria-label={`移除标签 ${tag.name}`}
              >
                <X size={10} />
              </button>
            </Badge>
          ))
        )}
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden"
          role="listbox"
          aria-multiselectable="true"
          aria-label="标签选择列表"
          aria-activedescendant={selectedTags.length > 0 ? `tag-item-${selectedTags[0].id}` : undefined}
        >
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标签..."
              size="sm"
              prefix={<Search size={14} />}
              suffix={
                search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-error-500"
                    aria-label="清除搜索"
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
            ) : tags.length === 0 ? (
              <div className="p-4 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {search ? '未找到匹配标签' : '暂无标签数据'}
              </div>
            ) : (
              <div style={{ height: `${tags.length * ITEM_HEIGHT}px`, position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: `${startIndex * ITEM_HEIGHT}px`,
                  width: '100%',
                }}>
                  {visibleTags.map((tag) => {
                    const isSelected = value.includes(tag.id)
                    const tagVariant = getTagColor(tag) as 'primary' | 'success' | 'warning' | 'info' | 'neutral'

                    return (
                      <div
                        key={tag.id}
                        id={`tag-item-${tag.id}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={(tag.usageCount ?? 0) === 0}
                        onClick={() => toggleTag(tag.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleTag(tag.id)
                          } else if (e.key === 'Escape') {
                            setOpen(false)
                          }
                        }}
                        tabIndex={isSelected ? 0 : -1}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
                          'hover:bg-neutral-50 dark:hover:bg-neutral-800',
                          isSelected && 'bg-primary-50 dark:bg-primary-300/20',
                        )}
                        style={{ height: `${ITEM_HEIGHT}px` }}
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            tagVariant === 'primary' && 'bg-primary-500',
                            tagVariant === 'success' && 'bg-primary-500',
                            tagVariant === 'warning' && 'bg-warning-500',
                            tagVariant === 'info' && 'bg-info-500',
                            tagVariant === 'neutral' && 'bg-neutral-400',
                          )}
                        />
                        <TagIcon size={12} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
                        <span
                          className={cn(
                            'flex-1 truncate',
                            isSelected
                              ? 'text-primary-700 dark:text-primary-700 font-medium'
                              : 'text-neutral-700 dark:text-neutral-300',
                          )}
                        >
                          {tag.name}
                        </span>
                        {isSelected && (
                          <span className="text-xs text-primary-500" aria-label="已选中">
                            ✓
                          </span>
                        )}
                        {(tag.usageCount ?? 0) > 0 && (
                          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                            {(tag.usageCount ?? 0)}次
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {search && !tags.some((t) => t.name.toLowerCase() === search.toLowerCase()) && (
              <div className="p-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Input
                    value={creatingName || search}
                    onChange={(e) => setCreatingName(e.target.value)}
                    placeholder="创建新标签"
                    size="sm"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateTag()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    icon={<Plus size={14} />}
                    onClick={handleCreateTag}
                    loading={creating}
                  >
                    创建
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
