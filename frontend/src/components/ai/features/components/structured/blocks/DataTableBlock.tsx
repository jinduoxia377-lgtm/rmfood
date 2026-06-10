/**
 * DataTableBlock — 专业数据表格区块
 *
 * 特点：
 * - Sticky 表头 + 斑马纹
 * - 列对齐支持
 * - 四种数据类型渲染 (text/number/percentage/tag)
 * - 表格标题和摘要
 * - 空状态优雅降级
 * - 响应式水平滚动
 */
import React, { useState, useMemo } from 'react'
import { Table, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'
import type { DataTableData } from '../types'

interface DataTableBlockProps {
  data: DataTableData
}

function DataTableBlock({ data }: DataTableBlockProps) {
  const { title, columns = [], rows = [], summary } = data
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [collapsed, setCollapsed] = useState(false)

  const sortedRows = useMemo(() => {
    if (!sortKey || rows.length === 0) return rows
    return [...rows].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const renderCell = (value: unknown, type?: string): React.ReactNode => {
    if (value == null) return <span className="text-gray-300 dark:text-gray-600">—</span>

    switch (type) {
      case 'number':
        return (
          <span className="font-mono text-xs tabular-nums text-gray-800 dark:text-gray-200">
            {typeof value === 'number' ? value.toLocaleString() : String(value)}
          </span>
        )
      case 'percentage': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num)) return <span className='text-gray-300 dark:text-gray-600'>{String(value)}</span>
        const pct = (num * 100).toFixed(1)
        const color = num >= 0.8 ? 'text-emerald-600 dark:text-emerald-400'
          : num >= 0.5 ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400'
        return (
          <span className={`font-mono text-xs tabular-nums ${color}`}>
            {pct}%
          </span>
        )
      }
      case 'tag':
        return (
          <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full
            bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {String(value)}
          </span>
        )
      default:
        return (
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {String(value)}
          </span>
        )
    }
  }

  // 空状态
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-300 dark:text-gray-600">
        <Table className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">无表格数据</p>
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题栏 */}
      {title && (
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className="flex items-center gap-1.5 mb-2 text-xs font-semibold
            text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100
            transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <Table className="w-3 h-3 text-primary-500" />
          <span>{title}</span>
          <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 ml-1">
            ({rows.length} 行)
          </span>
        </button>
      )}

      {!collapsed && (
        <>
          {/* 表格容器 — 响应式滚动 */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full border-collapse text-xs">
              {/* 表头 */}
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60">
                  {columns.map((col, i) => (
                    <th
                      key={col.key || i}
                      onClick={() => handleSort(col.key)}
                      className={`
                        px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400
                        border-b border-gray-200 dark:border-gray-700
                        whitespace-nowrap select-none
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        ${col.width ? `w-[${col.width}]` : ''}
                        cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors
                      `}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          <ArrowUpDown className={`w-2.5 h-2.5 ${sortDir === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* 表体 */}
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-gray-300 dark:text-gray-600"
                    >
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, ri) => (
                    <tr
                      key={ri}
                      className={`
                        border-b border-gray-100 dark:border-gray-700/50
                        ${ri % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'}
                        hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors
                      `}
                    >
                      {columns.map((col, ci) => (
                        <td
                          key={col.key || ci}
                          className={`
                            px-3 py-2
                            ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                          `}
                        >
                          {renderCell(row[col.key], col.type)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 摘要 */}
          {summary && (
            <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 italic leading-relaxed">
              {summary}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default DataTableBlock
