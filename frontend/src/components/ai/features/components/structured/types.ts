/**
 * Structured Content Block Renderer — 类型系统
 *
 * 定义AI结构化回复的区块类型和数据合约
 * 每个Block对应一种专业排版区域
 */

/* ===== 区块类型枚举 ===== */

export type BlockType =
  | 'header'       // 标题区
  | 'data-table'   // 数据表格
  | 'chart'        // 可视化图表
  | 'list'         // 分析列表
  | 'callout'      // 提示框
  | 'metrics'      // KPI指标卡
  | 'divider'      // 分隔线

/* ===== 核心结构 ===== */

export interface ContentBlock<T = unknown> {
  type: BlockType
  data: T
}

export interface StructuredContent {
  responseType: 'analysis_report' | 'comparison' | 'recommendation' | 'general'
  title?: string
  blocks: ContentBlock[]
}

/* ===== Header 区块 ===== */

export interface HeaderData {
  title: string
  description?: string
  level?: 1 | 2 | 3
  metadata?: Array<{ label: string; value: string }>
}

/* ===== DataTable 区块 ===== */

export interface ColumnDef {
  key: string
  label: string
  type?: 'text' | 'number' | 'percentage' | 'tag'
  align?: 'left' | 'center' | 'right'
  width?: string
}

export interface DataTableData {
  title?: string
  columns: ColumnDef[]
  rows: Array<Record<string, unknown>>
  summary?: string
}

/* ===== Chart 区块 ===== */

export type ChartType = 'radar' | 'bar' | 'score-cards'

export interface ChartData {
  chartType: ChartType
  title?: string
  data: Record<string, unknown>
}

/* ===== List 区块 ===== */

export type ListVariant = 'bullet' | 'number' | 'analysis' | 'checklist'

export interface ListItem {
  label: string
  description?: string
  value?: string
  status?: 'positive' | 'negative' | 'neutral' | 'info'
}

export interface ListData {
  title?: string
  variant: ListVariant
  items: ListItem[]
}

/* ===== Callout 区块 ===== */

export type CalloutVariant = 'info' | 'success' | 'warning' | 'summary'

export interface CalloutData {
  variant: CalloutVariant
  title?: string
  content: string
  details?: string[]
}

/* ===== Metrics 区块 ===== */

export interface MetricItem {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  color?: string
}

export interface MetricsData {
  title?: string
  items: MetricItem[]
}

/* ===== Divider 区块 ===== */

export type DividerVariant = 'solid' | 'dashed' | 'dotted'

export interface DividerData {
  variant?: DividerVariant
  label?: string
}
