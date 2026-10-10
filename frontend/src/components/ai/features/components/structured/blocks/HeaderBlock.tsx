/**
 * HeaderBlock — 专业标题区块
 *
 * 特点：
 * - 三级标题层级 (h1/h2/h3)
 * - 左色带装饰
 * - 副标题描述
 * - 元数据标签行
 */
import React from 'react'
import { Info } from 'lucide-react'
import type { HeaderData } from '../types'

interface HeaderBlockProps {
  data: HeaderData
}

function HeaderBlock({ data }: HeaderBlockProps) {
  const { title, description, level = 1, metadata } = data

  const levelStyles = {
    1: 'text-lg font-bold border-l-[4px] pl-3',
    2: 'text-base font-semibold border-l-[3px] pl-2.5',
    3: 'text-sm font-semibold border-l-[3px] pl-2',
  }

  const sizeClass = levelStyles[level] || levelStyles[1]

  return (
    <div className="mb-3 last:mb-0">
      <div
        className={`${sizeClass} text-neutral-900 dark:text-neutral-100 border-primary-500 dark:border-primary-400 leading-relaxed`}
      >
        {title}
      </div>

      {description && (
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}

      {metadata && metadata.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {metadata.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-400"
            >
              <Info className="w-2.5 h-2.5" />
              <span className="font-medium">{item.label}:</span>
              <span>{item.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default HeaderBlock
