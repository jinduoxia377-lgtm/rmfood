import { memo } from 'react'
import type { EfficacyTag, TagCategory } from '@/types/ai.types'
import type { EfficacyTagMeta } from '@/types/efficacyTag.types'
import { efficacyTagService } from '@/services/efficacyTagService'

type ChipSize = 'small' | 'medium' | 'large'

interface EfficacyTagChipProps {
  tag: EfficacyTag
  meta?: EfficacyTagMeta
  size?: ChipSize
  onClick?: (tag: EfficacyTag) => void
  showTooltip?: boolean
}

const SIZE_CONFIG: Record<ChipSize, { padding: string; fontSize: string; maxWidth: string }> = {
  small: { padding: 'px-2 py-0.5', fontSize: 'text-xs', maxWidth: 'max-w-[100px]' },
  medium: { padding: 'px-2.5 py-1', fontSize: 'text-xs', maxWidth: 'max-w-[120px]' },
  large: { padding: 'px-3 py-1.5', fontSize: 'text-sm', maxWidth: 'max-w-[140px]' },
}

const CATEGORY_ICONS: Record<TagCategory, string> = {
  immune: '🛡️',
  antioxidant: '✨',
  cardiovascular: '❤️',
  metabolic: '🔥',
  digestive: '🌿',
  nervous: '🧠',
  beauty: '💎',
  anti_aging: '⏳',
  bone_joint: '🦴',
  liver_kidney: '🍃',
  respiratory: '💨',
  energy: '⚡',
  sleep: '🌙',
  other: '📋',
}

const EVIDENCE_STARS: Record<EfficacyTagMeta['evidenceLevel'], string> = {
  strong: '★★★★★',
  moderate: '★★★☆☆',
  weak: '★★☆☆☆',
  theoretical: '★☆☆☆☆',
}

const EvidencenLabel: Record<EfficacyTagMeta['evidenceLevel'], string> = {
  strong: '强证据',
  moderate: '中等证据',
  weak: '弱证据',
  theoretical: '理论推测',
}

function EfficacyTagChip({
  tag,
  meta: propMeta,
  size = 'medium',
  onClick,
  showTooltip = true,
}: EfficacyTagChipProps) {
  const meta = propMeta || efficacyTagService.getTagMeta(tag)
  const category = meta?.category || ('other')
  const color = efficacyTagService.getCategoryColor(category)
  const icon = CATEGORY_ICONS[category] || '🏷️'

  const sizeConfig = SIZE_CONFIG[size]

  const chipContent = (
    <span
      className={`
        inline-flex items-center gap-1 rounded-xl font-medium text-white
        transition-all duration-200 cursor-default select-none
        ${sizeConfig.padding} ${sizeConfig.fontSize} ${sizeConfig.maxWidth}
        ${onClick ? 'hover:opacity-90 hover:scale-105 cursor-pointer' : ''}
      `}
      style={{ backgroundColor: color }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(tag)
      }}
      title={showTooltip ? undefined : `${tag} - ${meta?.description || ''}`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{tag}</span>
    </span>
  )

  if (!showTooltip || !meta) {
    return chipContent
  }

  return (
    <div className="relative group inline-block">
      {chipContent}
      <div className="
        invisible group-hover:visible opacity-0 group-hover:opacity-100
        absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
        px-3 py-2 rounded-lg shadow-lg
        bg-neutral-900/95 dark:bg-neutral-800/95 backdrop-blur-sm
        text-white text-xs whitespace-normal
        transition-all duration-200 pointer-events-none
        w-64
      ">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between border-b border-neutral-600 pb-1.5">
            <span className="font-bold text-sm">{meta.name}</span>
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
              title={category}
            />
          </div>

          <div className="text-neutral-300 leading-relaxed">
            {meta.description}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-neutral-600/50">
            <div>
              <span className="text-neutral-400">分类：</span>
              <span className="text-neutral-200">
                {efficacyTagService.getTagCategories().find(c => c.category === category)?.name || category}
              </span>
            </div>
            <div>
              <span className="text-neutral-400">可信度：</span>
              <span className="text-yellow-400 ml-1">
                {EVIDENCE_STARS[meta.evidenceLevel]}
              </span>
              <span className="text-neutral-400 ml-1 text-[10px]">
                ({EvidencenLabel[meta.evidenceLevel]})
              </span>
            </div>
          </div>

          {meta.relatedIngredients.length > 0 && (
            <div className="pt-1 border-t border-neutral-600/50">
              <span className="text-neutral-400">相关成分：</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {meta.relatedIngredients.slice(0, 4).map((ing, idx) => (
                  <span key={idx} className="bg-neutral-700 px-1.5 py-0.5 rounded text-[10px]">
                    {ing}
                  </span>
                ))}
                {meta.relatedIngredients.length > 4 && (
                  <span className="text-neutral-500 text-[10px]">+{meta.relatedIngredients.length - 4}</span>
                )}
              </div>
            </div>
          )}

          {meta.contraindications && meta.contraindications.length > 0 && (
            <div className="pt-1 border-t border-red-900/50">
              <span className="text-error-400 text-[10px] font-medium">⚠️ 注意：</span>
              <span className="text-error-300/80 text-[10px] ml-1">
                {meta.contraindications.join('；')}
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="border-4 border-transparent border-t-slate-900/95" />
        </div>
      </div>
    </div>
  )
}

export default memo(EfficacyTagChip)

export { EfficacyTagChip }
export type { EfficacyTagChipProps, ChipSize }
