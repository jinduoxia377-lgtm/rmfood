/**
 * 表格默认列配置与分页常量
 *
 * 提供配方表格的默认列配置、分页参数等常量定义。
 */

import type { ColumnConfig, PaginationConfig, TableConfig } from '@/types/ai.types'

// ==================== 默认列配置 ====================

/**
 * 配方表格默认列配置
 * 定义配方展示表格的所有可用列及其属性
 */
export const FORMULA_TABLE_COLUMNS: ColumnConfig[] = [
  {
    key: 'index',
    title: '序号',
    width: 60,
    fixed: 'left',
    sortable: false,
    align: 'center',
  },
  {
    key: 'name',
    title: '成分名称',
    width: 150,
    fixed: 'left',
    sortable: true,
    filterable: true,
    align: 'left',
  },
  {
    key: 'latinName',
    title: '拉丁学名',
    width: 160,
    sortable: false,
    visible: false,
    align: 'left',
  },
  {
    key: 'amount',
    title: '用量',
    width: 100,
    sortable: true,
    filterable: true,
    align: 'right',
  },
  {
    key: 'unit',
    title: '单位',
    width: 70,
    filterable: true,
    align: 'center',
  },
  {
    key: 'percentage',
    title: '占比(%)',
    width: 90,
    sortable: true,
    align: 'right',
    renderer: 'percentageBar',
  },
  {
    key: 'efficacyTags',
    title: '功效标签',
    width: 200,
    filterable: true,
    align: 'left',
    renderer: 'tagList',
  },
  {
    key: 'source',
    title: '来源',
    width: 100,
    filterable: true,
    align: 'center',
  },
  {
    key: 'qualityScore',
    title: '质量评分',
    width: 100,
    sortable: true,
    align: 'right',
    renderer: 'scoreBadge',
  },
  {
    key: 'sourceDatabase',
    title: '数据来源',
    width: 120,
    filterable: true,
    visible: false,
    align: 'left',
  },
  {
    key: 'precautions',
    title: '注意事项',
    width: 180,
    align: 'left',
    renderer: 'precautionList',
  },
  {
    key: 'actions',
    title: '操作',
    width: 120,
    fixed: 'right',
    align: 'center',
  },
]

/**
 * 导出专用列配置（精简版）
 * 用于导出Excel/PDF时的列选择
 */
export const EXPORT_COLUMNS: ColumnConfig[] = [
  { key: 'name', title: '成分名称', width: 150 },
  { key: 'latinName', title: '拉丁学名', width: 160 },
  { key: 'amount', title: '用量', width: 100 },
  { key: 'unit', title: '单位', width: 70 },
  { key: 'percentage', title: '占比(%)', width: 90 },
  { key: 'efficacyTags', title: '功效标签', width: 200 },
  { key: 'source', title: '来源', width: 100 },
  { key: 'precautions', title: '注意事项', width: 200 },
]

// ==================== 分页配置 ====================

/**
 * 默认分页配置
 */
export const DEFAULT_PAGINATION_CONFIG: PaginationConfig = {
  current: 1,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  showPagination: true,
  showTotal: true,
  showQuickJumper: true,
  showSizeChanger: true,
}

/**
 * 小型表格分页配置（用于弹窗/侧边栏中的表格）
 */
export const COMPACT_PAGINATION_CONFIG: PaginationConfig = {
  current: 1,
  pageSize: 10,
  pageSizeOptions: [10, 20, 50],
  showPagination: true,
  showTotal: false,
  showQuickJumper: false,
  showSizeChanger: false,
}

// ==================== 表格预设配置 ====================

/**
 * 主配方表格完整配置
 */
export const MAIN_TABLE_CONFIG: TableConfig = {
  id: 'formula-main-table',
  title: '配方成分表',
  columns: FORMULA_TABLE_COLUMNS,
  defaultSortKey: 'percentage',
  defaultSortOrder: 'desc',
  pagination: DEFAULT_PAGINATION_CONFIG,
  rowSelection: true,
  expandable: true,
  bordered: true,
  size: 'middle',
  scroll: { x: 1400 },
}

/**
 * 对比视图表格配置
 */
export const COMPARE_TABLE_CONFIG: TableConfig = {
  id: 'formula-compare-table',
  title: '配方对比表',
  columns: EXPORT_COLUMNS,
  pagination: {
    ...DEFAULT_PAGINATION_CONFIG,
    showPagination: false,
  },
  bordered: true,
  size: 'small',
}

/**
 * 导出预览表格配置
 */
export const EXPORT_PREVIEW_TABLE_CONFIG: TableConfig = {
  id: 'formula-export-preview-table',
  title: '导出预览',
  columns: EXPORT_COLUMNS,
  pagination: {
    ...DEFAULT_PAGINATION_CONFIG,
    showPagination: false,
  },
  bordered: false,
  size: 'small',
}

// ==================== 列可见性预设 ====================

/**
 * 列可见性预设配置
 * 提供不同场景下的列显隐组合
 */
export const COLUMN_VISIBILITY_PRESETS = {
  full: {
    label: '完整视图',
    hiddenColumns: [] as string[],
  },
  essential: {
    label: '核心视图',
    hiddenColumns: ['latinName', 'sourceDatabase'] as string[],
  },
  compact: {
    label: '精简视图',
    hiddenColumns: ['latinName', 'sourceDatabase', 'actions'] as string[],
  },
  analysis: {
    label: '分析视图',
    hiddenColumns: ['index', 'actions'] as string[],
  },
  export: {
    label: '导出视图',
    hiddenColumns: ['index', 'actions'] as string[],
  },
} as const

// ==================== 排序相关常量 ====================

/**
 * 可排序列配置
 */
export const SORTABLE_COLUMNS = ['name', 'amount', 'percentage', 'qualityScore'] as const

/**
 * 默认排序方向
 */
export const DEFAULT_SORT_ORDER = 'desc' as const

/**
 * 默认排序列
 */
export const DEFAULT_SORT_KEY = 'percentage' as const
