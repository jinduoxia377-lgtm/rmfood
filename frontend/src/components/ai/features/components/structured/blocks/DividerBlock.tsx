/**
 * DividerBlock — 分隔线区块
 *
 * 三种样式：solid / dashed / dotted
 * 可选居中标签文字
 */
import React from 'react'
import type { DividerData } from '../types'

interface DividerBlockProps {
  data: DividerData
}

const BORDER_STYLES: Record<string, string> = {
  solid: 'border-t border-neutral-200 dark:border-neutral-700',
  dashed: 'border-t border-dashed border-neutral-200 dark:border-neutral-700',
  dotted: 'border-t border-dotted border-neutral-200 dark:border-neutral-700',
}

function DividerBlock({ data }: DividerBlockProps) {
  const { variant = 'solid', label } = data

  if (label) {
    return (
      <div className="flex items-center gap-3 my-3">
        <div className={`flex-1 ${BORDER_STYLES[variant] || BORDER_STYLES.solid}`} />
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap uppercase tracking-wider font-medium">
          {label}
        </span>
        <div className={`flex-1 ${BORDER_STYLES[variant] || BORDER_STYLES.solid}`} />
      </div>
    )
  }

  return (
    <div className={`my-3 ${BORDER_STYLES[variant] || BORDER_STYLES.solid}`} />
  )
}

export default DividerBlock
