/**
 * Structured Content Block Renderer — 类型系统
 *
 * 定义AI结构化回复的区块类型和数据合约
 * 每个Block对应一种专业排版区域
 */

/* ===== 区块类型枚举 ===== */

export type BlockType =
  | 'header'            // 标题区
  | 'data-table'        // 数据表格
  | 'chart'             // 可视化图表
  | 'list'              // 分析列表
  | 'callout'           // 提示框
  | 'metrics'           // KPI指标卡
  | 'divider'           // 分隔线
  | 'ingredient-detail' // 药材详情卡片
  | 'synergy-chart'     // 配伍关系图
  | 'timeline'          // 服用周期时间线

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

/* ===== IngredientDetail 区块 ===== */

export interface IngredientDetailData {
  name: string
  latin?: string
  source?: string
  properties?: string
  efficacy?: string
  active_compounds?: string[]
  dosage_range?: string
  safety_level?: string
  notes?: string
}

/* ===== SynergyChart 区块 ===== */

export type SynergyChartType = 'hierarchy' | 'network'

export interface SynergyNode {
  id: string
  label: string
  role: '君' | '臣' | '佐' | '使' | '其他'
  level?: number
}

export interface SynergyEdge {
  from: string
  to: string
  weight?: number
  type?: '协同' | '相须' | '相使' | '相畏' | '相杀'
}

export interface SynergyChartData {
  type: SynergyChartType
  title?: string
  nodes: SynergyNode[]
  edges: SynergyEdge[]
}

/* ===== Timeline 区块 ===== */

export type TimelinePhase = '初期' | '中期' | '后期' | '巩固'

export interface TimelineItem {
  day: number
  phase: TimelinePhase
  title: string
  description: string
  dosage?: string
  notes?: string
  icon?: string
}

export interface TimelineData {
  title?: string
  duration_days: number
  phases: Array<{
    key: TimelinePhase
    label: string
    days: number[]
  }>
  items: TimelineItem[]
}
