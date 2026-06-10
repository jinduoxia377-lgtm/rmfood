/**
 * Structured Content Block Renderer — 公共 API
 *
 * 导出所有类型定义和核心组件
 */

export { default as StructuredMessageRenderer } from './StructuredMessageRenderer'
export { detectStructuredContent } from './utils'
export { getBlockComponent, renderBlock } from './BlockRegistry'

export type {
  BlockType,
  ContentBlock,
  StructuredContent,
  HeaderData,
  ColumnDef,
  DataTableData,
  ChartType,
  ChartData,
  ListVariant,
  ListItem,
  ListData,
  CalloutVariant,
  CalloutData,
  MetricItem,
  MetricsData,
  DividerVariant,
  DividerData,
} from './types'

// 导出区块组件（供独立使用或测试）
export { default as HeaderBlock } from './blocks/HeaderBlock'
export { default as DataTableBlock } from './blocks/DataTableBlock'
export { default as ChartBlock } from './blocks/ChartBlock'
export { default as ListBlock } from './blocks/ListBlock'
export { default as CalloutBlock } from './blocks/CalloutBlock'
export { default as MetricsBlock } from './blocks/MetricsBlock'
export { default as DividerBlock } from './blocks/DividerBlock'
