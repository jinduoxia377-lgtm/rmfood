/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 活性肽 Tab — Phase 3 深度完善版
 * - 序列长度范围筛选
 * - 活性值排序（支持升序/降序）
 * - 氨基酸组成统计可视化
 * - 搜索高亮
 * - 骨架屏加载
 * - 导出 CSV
 */
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import type { BioactivePeptide } from '@/types'
import {
  Input, Button, Badge, Modal, Pagination,
  Card,
} from '@/components/ui'
import {
  Download, ChevronUp, ChevronDown, Filter, Dna,
} from 'lucide-react'
import { PeptideDetailContent } from '../PeptideDetailContent'

// ─── 活性类型颜色映射 ───
const ACTIVITY_COLORS: Record<string, 'primary' | 'info' | 'danger' | 'warning' | 'neutral' | 'success'> = {
  'ACE inhibitory': 'info', 'Antioxidant': 'warning', 'Antimicrobial': 'danger',
  'DPP-IV inhibitory': 'primary', 'Immunomodulatory': 'success', 'Bone-stimulating': 'info',
}

// ─── 搜索高亮 ───
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <>{text}</>
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

// ─── 骨架屏 ───
function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  )
}

type SortField = 'activity_value' | 'molecular_weight' | 'sequence'
type SortDir = 'asc' | 'desc'

interface PeptidesTabProps {
  initKeyword?: string;
  initialSelectedSequence?: string | null;
  onSequenceConsumed?: () => void;
}

export default function PeptidesTab({ initKeyword = '', initialSelectedSequence, onSequenceConsumed }: PeptidesTabProps) {
  const [keyword, setKeyword] = useState(initKeyword)
  const [activityType, setActivityType] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedPeptide, setSelectedPeptide] = useState<BioactivePeptide | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  // 排序
  const [sortField, setSortField] = useState<SortField>('activity_value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 序列长度筛选
  const [lenMin, setLenMin] = useState('')
  const [lenMax, setLenMax] = useState('')

  const activityTypesQuery = useQuery({
    queryKey: ['db-peptide-types'],
    queryFn: () => databaseApi.getActivityTypes(),
  })

  const peptideQuery = useQuery({
    queryKey: ['db-peptides', keyword, activityType, page],
    queryFn: () => databaseApi.searchPeptides({ keyword, activity_type: activityType || undefined, page, page_size: 20 }),
  })

  const doSearch = () => { setPage(1); setSelectedPeptide(null) }

  // 处理初始选中的肽序列（从热门排行点击过来时）
  useEffect(() => {
    if (initialSelectedSequence && peptideQuery.data?.items && !selectedPeptide) {
      const target = peptideQuery.data.items.find(p => p.sequence === initialSelectedSequence)
      if (target) {
        setSelectedPeptide(target)
        onSequenceConsumed?.()
      }
    }
  }, [initialSelectedSequence, peptideQuery.data?.items, selectedPeptide, onSequenceConsumed])

  // 排序后的数据
  const items = useMemo(() => {
    const raw = peptideQuery.data?.items ?? []
    let arr = [...raw] as any[]

    // 长度筛选
    if (lenMin) arr = arr.filter(p => (p.sequence?.length ?? 0) >= Number(lenMin))
    if (lenMax) arr = arr.filter(p => (p.sequence?.length ?? 0) <= Number(lenMax))

    // 排序
    arr.sort((a: any, b: any) => {
      let va: any, vb: any
      if (sortField === 'activity_value') {
        va = a.activity_value ?? -1; vb = b.activity_value ?? -1
      } else if (sortField === 'molecular_weight') {
        va = a.molecular_weight ?? 0; vb = b.molecular_weight ?? 0
      } else {
        va = a.sequence?.length ?? 0; vb = b.sequence?.length ?? 0
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [peptideQuery.data?.items, sortField, sortDir, lenMin, lenMax])

  const total = peptideQuery.data?.total ?? 0

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field); setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  // 导出 CSV
  const exportCSV = () => {
    setExportLoading(true)
    const headers = ['序列', '长度', '来源蛋白', '来源生物', '活性类型', '活性值', '单位', '分子量(Da)', '水解酶']
    const rows = items.map((p: any) => [
      p.sequence, p.sequence?.length ?? '', p.source_protein || '', p.source_organism || '',
      p.activity_type || '', p.activity_value ?? '', p.activity_unit || '', p.molecular_weight ?? '', p.hydrolysis_enzyme || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `peptides_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url); setExportLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* 搜索 + 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="搜索肽序列、来源蛋白、活性类型..."
            aria-label="搜索活性肽"
          />
        </div>
        <select value={activityType || ''} onChange={(e) => { setActivityType(e.target.value || null); setPage(1) }}
          className="input w-auto min-w-[160px]">
          <option value="">全部活性类型</option>
          {activityTypesQuery.data?.activity_types.map((t) => (
            <option key={t.type_en} value={t.type_en}>{t.type_cn} ({t.count})</option>
          ))}
        </select>
        {/* 长度筛选 */}
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-[#94A3B8]" />
          <input
            type="number" value={lenMin} onChange={e => setLenMin(e.target.value)} min={1}
            placeholder="最小" className="input w-16 text-center text-xs py-1.5"
          />
          <span className="text-[#94A3B8] text-xs">-</span>
          <input
            type="number" value={lenMax} onChange={e => setLenMax(e.target.value)} min={1}
            placeholder="最大" className="input w-16 text-center text-xs py-1.5"
          />
          <span className="text-xs text-[#94A3B8]">aa</span>
        </div>
        <Button variant="primary" onClick={doSearch}>搜索</Button>
        <Button variant="secondary" onClick={exportCSV} disabled={exportLoading || items.length === 0} className="gap-1.5">
          <Download className="w-4 h-4" />导出
        </Button>
      </div>

      {/* 活性类型快速筛选标签 */}
      <div className="flex flex-wrap gap-1.5">
        {activityTypesQuery.data?.activity_types?.slice(0, 8).map((t) => (
          <button
            key={t.type_en}
            onClick={() => { setActivityType(activityType === t.type_en ? null : t.type_en); setPage(1) }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
              activityType === t.type_en
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white dark:bg-slate-800 text-[#64748B] dark:text-[#94A3B8] border-[rgba(148,163,184,0.18)] hover:border-blue-300 dark:hover:border-blue-700'
            }`}
          >
            {t.type_cn} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {peptideQuery.isError ? (
          <div className="p-16 text-center"><div className="text-red-500 text-sm">❌ 数据加载失败，请刷新页面重试</div></div>
        ) : peptideQuery.isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(148,163,184,0.18)]">
                  {[
                    { label: '序列', field: null as SortField | null },
                    { label: '来源蛋白', field: null },
                    { label: '活性类型', field: null },
                    { label: '活性值', field: 'activity_value' as SortField },
                    { label: '分子量(Da)', field: 'molecular_weight' as SortField },
                    { label: '长度(aa)', field: 'sequence' as SortField },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider ${field ? 'cursor-pointer hover:text-[#0f172a] dark:hover:text-white select-none' : ''}`}
                      onClick={() => field && toggleSort(field)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {field && <SortIcon field={field} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {items.map((item: any) => (
                  <tr key={item.id} onClick={() => setSelectedPeptide(item)}
                    className="cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors duration-150 group">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 transition-colors">
                        <Highlight text={item.sequence} keyword={keyword} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#0f172a] dark:text-[#f1f5f9]">
                      <Highlight text={item.source_protein || '-'} keyword={keyword} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ACTIVITY_COLORS[item.activity_type || ''] || 'neutral'} size="sm">
                        {item.activity_type || '-'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs">
                        {item.activity_value != null ? `${item.activity_value} ${item.activity_unit || ''}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">
                        {item.molecular_weight?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">
                        {item.sequence?.length ?? '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length === 0 && !peptideQuery.isLoading && (
          <div className="p-16 text-center">
            <Dna className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="text-[#94A3B8] text-sm">
              {keyword || activityType || lenMin || lenMax ? '未找到匹配结果' : '请输入关键词搜索活性肽数据'}
            </div>
          </div>
        )}
      </Card>

      {Math.ceil(total / 20) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />
      )}

      <Modal open={!!selectedPeptide} onClose={() => setSelectedPeptide(null)}
        title={selectedPeptide?.sequence ?? ''} size="lg">
        {selectedPeptide && <PeptideDetailContent peptide={selectedPeptide} />}
      </Modal>
    </div>
  )
}
