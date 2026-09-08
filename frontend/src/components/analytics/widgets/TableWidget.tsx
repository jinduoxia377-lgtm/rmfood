/**
 * TableWidget — 数据表格渲染器
 *
 * 接收 activities prop，渲染活动列表为表格。
 */
import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Props {
  title: string
  limit?: number
  columns?: string[]
  activities?: Array<{ type: string; title: string; timestamp?: string | null; author?: string | null }>
}

type SortDirection = 'asc' | 'desc' | null

export const TableWidget: React.FC<Props> = ({
  title,
  limit = 10,
  columns: explicitColumns,
  activities = [],
}) => {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  // 将 activities 转为表格行
  const rows = useMemo(() => {
    if (!activities.length) return []
    return activities.slice(0, limit).map(a => ({
      type: a.type,
      title: a.title,
      author: a.author ?? '未知',
      time: a.timestamp ? new Date(a.timestamp).toLocaleString('zh-CN') : '',
    }))
  }, [activities, limit])

  const colKeys = explicitColumns ?? ['type', 'title', 'author', 'time']
  const colLabels = explicitColumns
    ? explicitColumns.map(c => c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()))
    : ['类型', '标题', '负责人', '时间']

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-text-muted" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary-600" />
      : <ChevronDown className="w-3 h-3 text-primary-600" />
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-border p-5 flex items-center justify-center min-h-[160px]">
        <span className="text-text-muted text-sm">加载中…</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <h4 className="font-semibold text-sm text-text-primary mb-4">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {colLabels.map((label, i) => (
                <th
                  key={label}
                  className="px-3 py-2 text-left font-medium text-text-muted cursor-pointer hover:text-text-primary whitespace-nowrap select-none"
                  onClick={() => handleSort(colKeys[i])}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    <SortIcon col={colKeys[i]} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((row, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                {colKeys.map(key => (
                  <td key={key} className="px-3 py-2 text-text-primary whitespace-nowrap">
                    {String(row[key as keyof typeof row] ?? '')}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={colKeys.length} className="px-3 py-8 text-center text-text-muted text-xs">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 text-xs text-text-muted text-right">
          共 {rows.length} 条
        </div>
      )}
    </div>
  )
}

export default TableWidget
