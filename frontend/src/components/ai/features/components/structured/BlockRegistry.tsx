/**
 * BlockRegistry — 区块类型到渲染组件的注册表
 *
 * 职责：
 * - 将 BlockType 映射到对应的 React 组件
 * - 提供统一的渲染接口
 * - 支持未知类型的优雅降级
 */
import React from 'react'
import type { BlockType, ContentBlock } from './types'
import HeaderBlock from './blocks/HeaderBlock'
import DataTableBlock from './blocks/DataTableBlock'
import ChartBlock from './blocks/ChartBlock'
import ListBlock from './blocks/ListBlock'
import CalloutBlock from './blocks/CalloutBlock'
import MetricsBlock from './blocks/MetricsBlock'
import DividerBlock from './blocks/DividerBlock'

type BlockComponent = React.ComponentType<{ data: any }>

const REGISTRY: Record<BlockType, BlockComponent> = {
  'header': HeaderBlock,
  'data-table': DataTableBlock,
  'chart': ChartBlock,
  'list': ListBlock,
  'callout': CalloutBlock,
  'metrics': MetricsBlock,
  'divider': DividerBlock,
}

/**
 * 根据 block type 获取对应的渲染组件
 */
export function getBlockComponent(type: BlockType): BlockComponent | null {
  return REGISTRY[type] || null
}

/**
 * 渲染单个区块
 * 处理未知类型、组件缺失等情况
 */
export function renderBlock(block: ContentBlock, index: number): React.ReactNode {
  const Component = getBlockComponent(block.type)

  if (!Component) {
    return (
      <div key={index} className="py-2 text-center text-[10px] text-gray-300 dark:text-gray-600">
        不支持的区块类型: {block.type}
      </div>
    )
  }

  return <Component key={index} data={block.data} />
}

export default REGISTRY
