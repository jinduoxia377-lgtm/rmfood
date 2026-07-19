import { useState, useMemo, useCallback } from 'react'
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { EnhancedIngredient, EfficacyTag, Precaution } from '@/types/ai.types'
import { ExportFormat } from '@/types/ai.types'

import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Table,
  X,
} from 'lucide-react'

import DosagePercentageBar from './DosagePercentageBar'
import EfficacyTagList from './EfficacyTagList'
import PrecautionBadge from './PrecautionBadge'
import { exportToCSV, exportToExcel, exportToJSON } from '@/services/exportService'

interface EnhancedDataTableProps {
  data: EnhancedIngredient[]
  title?: string
  visible: boolean
  onClose: () => void
  onExport?: (format: ExportFormat) => void
  loading?: boolean
}

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function DefaultEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <AlertCircle className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-4" />
      <p className="text-neutral-500 dark:text-neutral-400 text-base font-medium">暂无数据</p>
      <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-2">当前表格没有可显示的数据</p>
    </div>
  )
}

function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50 animate-pulse">
          <td className="px-4 py-3"><div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-8" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mb-1" /><div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-16" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-20" /></td>
          <td className="px-4 py-3"><div className="flex gap-1"><div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-14" /><div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-16" /></div></td>
          <td className="px-4 py-3"><div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-20" /></td>
          <td className="px-4 py-3"><div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-16" /></td>
          <td className="px-4 py-3"><div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-8" /></td>
        </tr>
      ))}
    </tbody>
  )
}

export function EnhancedDataTable({
  data = [],
  title = '配方详细数据',
  visible,
  onClose,
  onExport,
  loading = false,
}: EnhancedDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const columns = useMemo<ColumnDef<EnhancedIngredient>[]>(
    () => [
      {
        accessorFn: (_row, index) => index + 1 + pagination.pageIndex * pagination.pageSize,
        id: 'index',
        header: '序号',
        cell: (info) => <span className="text-neutral-500 dark:text-neutral-400 text-sm">{String(info.getValue())}</span>,
        size: 60,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={column.getToggleSortingHandler()}>
            <span>成分名称</span>
            <SortIcon column={column} />
          </div>
        ),
        cell: (info) => (
          <div className="flex flex-col">
            <span className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">{String(info.getValue())}</span>
            {info.row.original.latinName && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 italic">{info.row.original.latinName}</span>
            )}
          </div>
        ),
        size: 150,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={column.getToggleSortingHandler()}>
            <span>用量</span>
            <SortIcon column={column} />
          </div>
        ),
        cell: (info) => {
          const ingredient = info.row.original
          return (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm text-neutral-700 dark:text-neutral-300">
                {ingredient.amount}{ingredient.unit}
              </span>
              {typeof ingredient.percentage === 'number' && ingredient.percentage > 0 && (
                <DosagePercentageBar percentage={ingredient.percentage} size="small" showLabel />
              )}
            </div>
          )
        },
        size: 120,
      },
      {
        accessorFn: (row) => row.efficacyTags ?? [],
        id: 'efficacyTags',
        header: '功效标签',
        cell: (info) => {
          const tags = info.getValue<EfficacyTag[]>()
          if (!tags || tags.length === 0) return <span className="text-xs text-neutral-400">—</span>
          return (
            <EfficacyTagList tags={tags} maxVisible={3} size="small" />
          )
        },
        size: 200,
      },
      {
        accessorFn: (row) => row.precautions ?? [],
        id: 'precautions',
        header: '注意事项',
        cell: (info) => {
          const precautions = info.getValue<Precaution[]>()
          if (!precautions || precautions.length === 0) return <span className="text-xs text-neutral-300">—</span>
          return <PrecautionBadge precautions={precautions} size="sm" />
        },
        size: 100,
      },
      {
        accessorFn: (row) => row.source || 'TCM',
        id: 'source',
        header: ({ column }) => (
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={column.getToggleSortingHandler()}>
            <span>来源分类</span>
            <SortIcon column={column} />
          </div>
        ),
        cell: (info) => {
          const source = info.getValue() as string
          const sourceConfig: Record<string, { label: string; color: string; bgColor: string }> = {
            TCM: { label: '药食同源', color: 'text-success-700 dark:text-success-400', bgColor: 'bg-success-50 dark:bg-success-900/20' },
            PEPTIDE: { label: '食源性多肽', color: 'text-secondary-700 dark:text-secondary-400', bgColor: 'bg-secondary-50 dark:bg-secondary-900/20' },
            EXCIPIENT: { label: '辅料', color: 'text-neutral-700 dark:text-neutral-400', bgColor: 'bg-slate-50 dark:bg-neutral-800/50' },
          }
          const config = sourceConfig[source] ?? sourceConfig.TCM
          if (!config) return null
          return (
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium ${config.color} ${config.bgColor}`}>
              {config.label}
            </span>
          )
        },
        size: 120,
      },
      {
        id: 'actions',
        header: '',
        cell: () => (
          <button
            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            title="查看详情"
          >
            <Table className="w-4 h-4 text-neutral-400" />
          </button>
        ),
        size: 60,
      },
    ],
    [pagination.pageIndex, pagination.pageSize],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (onExport) {
        onExport(format)
        return
      }

      const exportData = table.getFilteredRowModel().rows.map((row) => row.original)
      switch (format) {
        case ExportFormat.CSV:
          exportToCSV(exportData, '配方明细')
          break
        case ExportFormat.EXCEL:
          exportToExcel(exportData, '配方明细')
          break
        case ExportFormat.JSON:
          exportToJSON(exportData, '配方明细')
          break
        default:
          console.warn('[EnhancedDataTable] Unsupported export format:', format)
      }
    },
    [table, onExport],
  )

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-7xl max-h-[90vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              共 <strong className="text-neutral-700 dark:text-neutral-300">{table.getFilteredRowModel().rows.length}</strong> 条记录
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="search"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="搜索成分名称..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <div className="relative group">
              <button className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors">
                <Download className="w-4 h-4" />
                导出
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                {[ExportFormat.CSV, ExportFormat.EXCEL, ExportFormat.JSON].map((format) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="block w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg capitalize"
                  >
                    导出为 {format.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[900px]" role="table">
            <thead className="bg-slate-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {loading ? (
              <TableSkeleton rows={pagination.pageSize} />
            ) : table.getRowModel().rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12">
                    <DefaultEmptyState />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group hover:bg-secondary-50/50 dark:hover:bg-secondary-900/10 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/30">
          <div className="text-sm text-neutral-500 dark:text-neutral-400 order-2 sm:order-1">
            显示{' '}
            <strong className="text-neutral-700 dark:text-neutral-300">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </strong>
            {' '}—{' '}
            <strong className="text-neutral-700 dark:text-neutral-300">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length,
              )}
            </strong>
            {' '}条，共{' '}
            <strong className="text-neutral-700 dark:text-neutral-300">{table.getFilteredRowModel().rows.length}</strong>{' '}
            条
          </div>

          <div className="flex items-center gap-3 order-1 sm:order-2">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} 条/页</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="首页"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, table.getPageCount()) }).map((_, i) => {
                  let pageNum: number
                  const pageCount = table.getPageCount()
                  const currentPage = table.getState().pagination.pageIndex

                  if (pageCount <= 7) {
                    pageNum = i
                  } else if (currentPage < 4) {
                    pageNum = i
                  } else if (currentPage > pageCount - 4) {
                    pageNum = pageCount - 6 + i
                  } else {
                    pageNum = currentPage - 3 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => table.setPageIndex(pageNum)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        table.getState().pagination.pageIndex === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="末页"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortIcon({ column }: { column: any }) {
  const sorted = column.getIsSorted()
  if (!sorted) return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
  return sorted === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 text-primary-500" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-primary-500" />
  )
}

export default EnhancedDataTable
