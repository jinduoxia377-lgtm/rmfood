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
 * - 动画入场效果
 */
import React from 'react'
import type { StructuredContent } from './types'
import { renderBlock } from './BlockRegistry'

interface StructuredMessageRendererProps {
  content: StructuredContent
}

function StructuredMessageRenderer({ content }: StructuredMessageRendererProps) {
  const { blocks = [] } = content

  if (blocks.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
        暂无内容
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}

export default StructuredMessageRenderer
