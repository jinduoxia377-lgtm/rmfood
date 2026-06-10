import { useState, useCallback, memo } from 'react'
import type { EfficacyTag } from '@/types/ai.types'
import type { EfficacyTagMeta } from '@/types/efficacyTag.types'
import EfficacyTagChip, { type ChipSize } from './EfficacyTagChip'

interface EfficacyTagListProps {
  tags: EfficacyTag[]
  metas?: Map<EfficacyTag, EfficacyTagMeta>
  maxVisible?: number
  size?: ChipSize
  onTagClick?: (tag: EfficacyTag) => void
  className?: string
}

function EfficacyTagList({
  tags,
  metas,
  maxVisible = 3,
  size = 'small',
  onTagClick,
  className = '',
}: EfficacyTagListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const visibleTags = isExpanded ? tags : tags.slice(0, maxVisible)
  const hiddenCount = Math.max(0, tags.length - maxVisible)
  const hasOverflow = tags.length > maxVisible

  const handleExpandToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded((prev) => !prev)
  }, [])

  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <div
        className={`
          flex flex-wrap gap-1 transition-all duration-300 ease-in-out
          ${isExpanded ? 'animate-in fade-in duration-200' : ''}
        `}
      >
        {visibleTags.map((tag) => (
          <EfficacyTagChip
            key={tag}
            tag={tag}
            meta={metas?.get(tag)}
            size={size}
            onClick={onTagClick}
            showTooltip={true}
          />
        ))}
      </div>

      {hasOverflow && (
        <button
          onClick={handleExpandToggle}
          className="
            inline-flex items-center justify-center
            px-2 py-0.5 rounded-full text-xs font-medium
            bg-gray-100 dark:bg-gray-700
            text-gray-600 dark:text-gray-400
            hover:bg-gray-200 dark:hover:bg-gray-600
            border border-gray-200 dark:border-gray-600
            transition-all duration-200
            hover:scale-105 active:scale-95
            min-w-[28px] h-[22px]
          "
          title={isExpanded ? '收起标签' : `展开全部 ${tags.length} 个标签`}
          aria-label={isExpanded ? '收起' : `展开更多 (${hiddenCount})`}
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <span className="mr-0.5">▲</span>
              <span>收起</span>
            </>
          ) : (
            <>
              <span className="mr-0.5">+</span>
              <span>{hiddenCount}</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default memo(EfficacyTagList)

export { EfficacyTagList }
export type { EfficacyTagListProps }
