/**
 * 标签筛选组件
 * 支持多选和搜索
 */

import React, { useState } from 'react'
import { Tag, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tag as TagType } from './types'

interface TagFilterProps {
  tags: TagType[]
  selectedTags: string[]
  onToggle: (tagId: string) => void
  onClearAll: () => void
}

export function TagFilter({ tags, selectedTags, onToggle, onClearAll }: TagFilterProps) {
  const [filterText, setFilterText] = useState('')

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(filterText.toLowerCase()),
  )

  const handleToggle = (tagId: string) => {
    onToggle(tagId)
  }

  return (
    <div className="space-y-2">
      {/* 标签搜索框 */}
      {tags.length > 5 && (
        <div className="relative">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2"
            size={12}
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="筛选标签..."
            className="w-full bg-transparent pl-7 pr-3 py-1.5 text-xs outline-none rounded-md"
            style={{
              background: 'var(--bg-surface-container-low)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-caption)',
            }}
            aria-label="筛选标签"
          />
        </div>
      )}

      {/* 标签列表 */}
      <div className="flex flex-wrap gap-1.5">
        {filteredTags.map((tag) => {
          const isSelected = selectedTags.includes(tag.id)

          return (
            <button
              key={tag.id}
              onClick={() => handleToggle(tag.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                'transition-all duration-200 hover:scale-105',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected && 'shadow-sm',
              )}
              style={{
                background: isSelected
                  ? tag.color
                  : `${tag.color}20`,
                color: isSelected ? 'white' : tag.color,
                border: isSelected ? 'none' : `1px solid ${tag.color}40`,
              }}
              aria-label={`${isSelected ? '取消选择' : '选择'}标签 ${tag.name}`}
              title={`${tag.name} (${tag.count})`}
            >
              {isSelected && <X size={10} />}
              <Tag size={10} />
              <span>{tag.name}</span>
              <span
                className={cn(
                  'opacity-70',
                  isSelected ? 'text-white/70' : undefined,
                )}
              >
                {tag.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 清除按钮 */}
      {selectedTags.length > 0 && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
          清除所有标签筛选 ({selectedTags.length})
        </button>
      )}
    </div>
  )
}
