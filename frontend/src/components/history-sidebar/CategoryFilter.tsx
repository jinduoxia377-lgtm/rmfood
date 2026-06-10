/**
 * 分类筛选组件
 * 参考 VS Code Activity Bar 设计
 */

import React from 'react'
import { LayoutGrid, MessageSquare, FlaskConical, FileText, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from './types'

interface CategoryFilterProps {
  categories: Category[]
  selectedCategory: string | null
  onSelect: (categoryId: string | null) => void
}

const iconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  LayoutGrid,
  MessageSquare,
  FlaskConical,
  FileText,
  Search,
}

export function CategoryFilter({ categories, selectedCategory, onSelect }: CategoryFilterProps) {
  const handleClick = (categoryId: string) => {
    onSelect(selectedCategory === categoryId ? null : categoryId)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {categories.map((category) => {
        const Icon = iconMap[category.icon] || LayoutGrid
        const isSelected = selectedCategory === category.id

        return (
          <button
            key={category.id}
            onClick={() => handleClick(category.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap',
              'transition-all duration-200 hover:opacity-80',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isSelected
                ? 'bg-primary text-white shadow-md'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
            style={{
              background: isSelected ? category.color || 'var(--color-primary)' : undefined,
              color: isSelected ? 'white' : 'var(--text-secondary)',
            }}
            aria-label={`筛选 ${category.name}`}
            title={`${category.name} (${category.count})`}
          >
            <Icon size={14} strokeWidth={2} />
            <span className="text-sm font-medium">{category.name}</span>
            {category.count > 0 && (
              <span
                className={cn(
                  'flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold',
                  isSelected ? 'bg-white/20' : 'bg-neutral-200 dark:bg-neutral-700',
                )}
                style={{ color: isSelected ? 'white' : undefined }}
              >
                {category.count}
              </span>
            )}
          </button>
        )
      })}
      <button
        className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        aria-label="更多分类"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
