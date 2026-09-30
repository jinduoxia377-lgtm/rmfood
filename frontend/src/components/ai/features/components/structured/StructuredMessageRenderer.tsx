/**
 * StructuredMessageRenderer — 结构化内容块渲染引擎
 *
 * 将后端返回的结构化 JSON 解析为专业排版的区块组件序列。
 *
 * 流程：
 * 1. 接收 `StructuredContent` 对象
 * 2. 遍历 `blocks` 数组
 * 3. 通过 `BlockRegistry` 将每个 block 映射到对应渲染组件
 * 4. 渲染为有序的专业内容布局
 *
 * 特性：
 * - 100% 向后兼容（纯文本消息不走此渲染器）
 * - 每个区块独立渲染，互相隔离
 * - 整体由 ErrorBoundary 包裹
 * - 暗色模式自适应
 * - Stagger 入场动画（每块延迟 60ms，共 400ms 内完成）
 * - 滚动时重新触发动画（Intersection Observer）
 */
import React, { useRef, useEffect, useState } from 'react'
import type { StructuredContent, ContentBlock } from './types'
import { renderBlock } from './BlockRegistry'

interface StructuredMessageRendererProps {
  content: StructuredContent
  animated?: boolean
}

const ANIMATION_DELAY = 60
const ANIMATION_MAX_TOTAL = 400

function BlockWithAnimation({ block, index, delay }: {
  block: ContentBlock
  index: number
  delay: number
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    timerRef.current = setTimeout(() => setVisible(true), delay)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && timerRef.current === null) {
          setVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {renderBlock(block, index)}
    </div>
  )
}

function StructuredMessageRenderer({ content, animated = true }: StructuredMessageRendererProps) {
  const { blocks = [] } = content

  if (blocks.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
        暂无内容
      </div>
    )
  }

  const maxBlocks = Math.min(blocks.length, 7)
  const perBlockDelay = Math.min(ANIMATION_DELAY, Math.floor(ANIMATION_MAX_TOTAL / maxBlocks))

  return (
    <div className="space-y-1">
      {blocks.map((block, index) =>
        animated ? (
          <BlockWithAnimation
            key={index}
            block={block as ContentBlock}
            index={index}
            delay={index * perBlockDelay}
          />
        ) : (
          <div key={index}>{renderBlock(block as ContentBlock, index)}</div>
        )
      )}
    </div>
  )
}

export default StructuredMessageRenderer
