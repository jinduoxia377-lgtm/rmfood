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
import React, { useState, useMemo, useCallback } from 'react'
import {
  Table, ChevronDown, ChevronUp, ArrowUpDown,
  Download, Copy, Check,
} from 'lucide-react'
import type { DataTableData } from '../types'

interface DataTableBlockProps {
  data: DataTableData
}

function DataTableBlock({ data }: DataTableBlockProps) {
  const { title, columns = [], rows = [], summary } = data
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const handleExportCSV = useCallback(() => {
    const headers = columns.map(c => c.label).join(',')
    const dataRows = sortedRows.map(row =>
      columns.map(col => {
        const val = row[col.key]
        return val == null ? '' : String(val).replace(/"/g, '""')
      }).join(',')
    )
    const csv = [headers, ...dataRows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [columns, sortedRows, title])

  const handleCopy = useCallback(() => {
    const text = [
      columns.map(c => c.label).join('\t'),
      ...sortedRows.map(row =>
        columns.map(col => String(row[col.key] ?? '')).join('\t')
      ),
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [columns, sortedRows])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const renderCell = (value: unknown, type?: string): React.ReactNode => {
    if (value == null) return <span className="text-neutral-300 dark:text-neutral-400">—</span>

    switch (type) {
      case 'number':
        return (
          <span className="font-mono text-xs tabular-nums text-neutral-800 dark:text-neutral-200">
            {typeof value === 'number' ? value.toLocaleString() : String(value)}
          </span>
        )
      case 'percentage': {
        const num = typeof value === 'number' ? value : parseFloat(String(value))
        if (isNaN(num)) return <span className='text-neutral-300 dark:text-neutral-400'>{String(value)}</span>
        const pct = (num * 100).toFixed(1)
        const color = num >= 0.8 ? 'text-primary-700 dark:text-primary-700'
          : num >= 0.5 ? 'text-warning-600 dark:text-warning-700'
          : 'text-error-600 dark:text-error-600'
        return (
          <span className={`font-mono text-xs tabular-nums ${color}`}>
            {pct}%
          </span>
        )
      }
      case 'tag':
        return (
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full
            bg-primary-50 dark:bg-primary-300/25 text-primary-700 dark:text-primary-700">
            {String(value)}
          </span>
        )
      default:
        return (
          <span className="text-xs text-neutral-700 dark:text-neutral-300">
            {String(value)}
          </span>
        )
    }
  }

  // 空状态
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-neutral-300 dark:text-neutral-400">
        <Table className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">无表格数据</p>
      </div>
    )
  }

  return (
    <div className="mb-3 last:mb-0">
      {/* 标题栏 */}
      {title && (
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold
              text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100
              transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <Table className="w-3 h-3 text-primary-500" />
            <span>{title}</span>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-400 ml-1">
              ({rows.length} 行)
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportCSV}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              title="导出CSV"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              title="复制表格"
            >
              {copied ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          {/* 表格容器 — 响应式滚动 */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full border-collapse text-xs">
              {/* 表头 */}
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60">
                  {columns.map((col, i) => (
                    <th
                      key={col.key || i}
                      onClick={() => handleSort(col.key)}
                      className={`
                        px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400
                        border-b border-neutral-200 dark:border-neutral-700
                        whitespace-nowrap select-none
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        ${col.width ? `w-[${col.width}]` : ''}
                        cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700/40 transition-colors
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
                      className="px-3 py-8 text-center text-neutral-300 dark:text-neutral-400"
                    >
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, ri) => (
                    <tr
                      key={ri}
                      className={`
                        border-b border-neutral-100 dark:border-neutral-700/50
                        ${ri % 2 === 1 ? 'bg-neutral-50/50 dark:bg-neutral-800/20' : 'bg-white dark:bg-transparent'}
                        hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors
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
            <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-400 italic leading-relaxed">
              {summary}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default DataTableBlock
