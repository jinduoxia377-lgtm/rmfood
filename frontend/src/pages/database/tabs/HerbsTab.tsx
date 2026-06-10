/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 中药材 Tab — Phase 3 深度完善版
 * - OB%/DL/化合物数 列排序
 * - 药食同源快速过滤开关
 * - 收藏功能（本地 Set，支持仅看收藏）
 * - 卡片/表格 双视图切换
 * - 搜索高亮
 * - 骨架屏加载
 * - 导出 CSV（含收藏标记）
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import type { TCMHerb } from '@/types'
import { Input, Button, Badge, Modal, Pagination,
  Card,
} from '@/components/ui'
import CrossSearchPanel from '../CrossSearchPanel'
import {
  Search, Download, ChevronUp, ChevronDown, Zap, Star, StarOff,
  Grid3X3, List,
} from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

// ─── 搜索高亮 ───
export function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <>{text}</>
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200/80 dark:bg-yellow-700/50 text-inherit rounded px-0.5">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  )
}

type SortField = 'name_cn' | 'ob_percent' | 'dl_value' | 'compound_count'
type SortDir = 'asc' | 'desc'
type ViewMode = 'table' | 'card'

const CHART_PRIMARY = '#059669'

// 排序图标组件
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  return sortField === field
    ? (sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 ml-0.5 inline text-primary-500" />
      : <ChevronDown className="w-3.5 h-3.5 ml-0.5 inline text-primary-500" />)
    : <ChevronUp className="w-3.5 h-3.5 ml-0.5 inline opacity-20" />
}

export default function HerbsTab({
  initKeyword = '',
  onInitKwConsumed,
  initialSelectedHerbName,
  onHerbSelectionConsumed,
}: {
  initKeyword?: string
  onInitKwConsumed?: () => void
  initialSelectedHerbName?: string | null
  onHerbSelectionConsumed?: () => void
}) {
  const [keyword, setKeyword] = useState(initKeyword || '')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name_cn')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedHerb, setSelectedHerb] = useState<TCMHerb | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [foodOnly, setFoodOnly] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // 处理初始关键词消耗
  useEffect(() => {
    if (initKeyword) {
      onInitKwConsumed?.()
    }
  }, [initKeyword, onInitKwConsumed])

  const categoriesQuery = useQuery({
    queryKey: ['db-herb-categories'],
    queryFn: () => databaseApi.getCategories(),
  })

  const pageSize = viewMode === 'card' ? 12 : 15
  const herbQuery = useQuery({
    queryKey: ['db-herbs', keyword, category, foodOnly, page, pageSize],
    queryFn: () => databaseApi.searchHerbs({
      keyword,
      category: category || undefined,
      food_homology_only: foodOnly,
      page,
      page_size: pageSize,
    }),
  })

  // 当从排行组件点击药材名称时，自动选中并打开详情 Modal
  useEffect(() => {
    if (initialSelectedHerbName && herbQuery.data?.items?.length) {
      const match = herbQuery.data.items.find(
        (h: TCMHerb) => h.name_cn === initialSelectedHerbName,
      )
      if (match) {
        setSelectedHerb(match)
        onHerbSelectionConsumed?.()
      }
    }
  }, [initialSelectedHerbName, herbQuery.data?.items, onHerbSelectionConsumed])

  const herbDetailQuery = useQuery({
    queryKey: ['db-herb-detail', selectedHerb?.id],
    queryFn: () => databaseApi.getHerb(selectedHerb!.id),
    enabled: !!selectedHerb,
  })

  const doSearch = () => { setPage(1); setSelectedHerb(null) }

  const total = herbQuery.data?.total ?? 0

  const items = useMemo(() => {
    const rawItems = herbQuery.data?.items ?? []
    let arr = [...rawItems]
    if (showFavOnly) arr = arr.filter(h => favorites.has(h.id))
    arr.sort((a: any, b: any) => {
      const va = a[sortField] ?? (typeof a[sortField] === 'string' ? '' : 0)
      const vb = b[sortField] ?? (typeof b[sortField] === 'string' ? '' : 0)
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va)
    })
    return arr
  }, [herbQuery.data, sortField, sortDir, showFavOnly, favorites])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleFav = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }



  const exportCSV = () => {
    setExportLoading(true)
    const headers = ['药材名称', '拉丁名', '拼音', '分类', '功效', '生物利用度(%)', '类药性(DL)', '药食同源', '化合物数', '靶点数', '收藏']
    const rows = items.map((h: any) => [
      h.name_cn, h.name_latin || '', h.name_pinyin || '', h.category || '',
      h.effects || '', h.ob_percent ?? '', h.dl_value ?? '',
      h.is_food_homology ? '是' : '否', h.compound_count, h.target_count,
      favorites.has(h.id) ? '★' : '',
    ])
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `herbs_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    setExportLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="药材名称、拉丁名、拼音、功效..." className="pl-9" />
        </div>
        <select value={category || ''} onChange={e => { setCategory(e.target.value || null); setPage(1) }}
          className="input w-auto min-w-[140px]">
          <option value="">全部分类</option>
          {categoriesQuery.data?.categories.map(c => (
            <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
          ))}
        </select>
        <Button variant="primary" onClick={doSearch}>搜索</Button>
        {/* 视图切换 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {([['table', List], ['card', Grid3X3]] as const).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600' : 'text-[#94A3B8] hover:text-[#64748B]'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* 过滤标签 */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={() => { setFoodOnly(!foodOnly); setPage(1) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${foodOnly ? 'bg-emerald-500 text-white border-emerald-500' : 'border-[rgba(148,163,184,0.3)] text-[#64748B] dark:text-[#94A3B8] hover:border-emerald-400 hover:text-emerald-600'}`}>
          <Zap className="w-3.5 h-3.5" />仅药食同源
        </button>
        <button onClick={() => setShowFavOnly(!showFavOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${showFavOnly ? 'bg-amber-500 text-white border-amber-500' : 'border-[rgba(148,163,184,0.3)] text-[#64748B] dark:text-[#94A3B8] hover:border-amber-400 hover:text-amber-600'}`}>
          <Star className="w-3.5 h-3.5" />收藏{favorites.size > 0 ? ` (${favorites.size})` : ''}
        </button>
        <div className="flex-1" />
        <span className="text-xs text-[#94A3B8]">共 {total} 条</span>
        <Button variant="secondary" size="sm" onClick={exportCSV} disabled={exportLoading || items.length === 0} className="gap-1">
          <Download className="w-3.5 h-3.5" />导出 CSV
        </Button>
      </div>

      {/* 表格视图 */}
      {viewMode === 'table' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(148,163,184,0.18)] bg-slate-50/60 dark:bg-slate-800/40">
                  <th className="px-3 py-3 w-8" />
                  {[
                    { key: 'name_cn' as SortField, label: '药材名称' },
                  ].map(({ key, label }) => (
                    <th key={key} onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors">
                      {label}<SortIcon field={key} sortField={sortField} sortDir={sortDir} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">拉丁名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">分类</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider hidden md:table-cell">功效</th>
                  {[
                    { key: 'ob_percent' as SortField, label: '生物利用度', title: '口服生物利用度 (OB%)' },
                    { key: 'dl_value' as SortField, label: '类药性', title: '类药性指数 (DL)' },
                  ].map(({ key, label, title }) => (
                    <th key={key} onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-center text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors"
                      title={title}>
                      {label}<SortIcon field={key} sortField={sortField} sortDir={sortDir} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">药食同源</th>
                  <th onClick={() => toggleSort('compound_count')}
                    className="px-4 py-3 text-center text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-primary-600 transition-colors">
                    化合物<SortIcon field="compound_count" sortField={sortField} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {herbQuery.isError
                  ? <tr><td colSpan={9} className="px-4 py-12 text-center"><div className="text-red-500 text-sm">❌ 数据加载失败，请刷新页面重试</div></td></tr>
                  : herbQuery.isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}</tr>
                  ))
                  : items.map((item: any) => (
                    <tr key={item.id} onClick={() => setSelectedHerb(item)}
                      className="cursor-pointer hover:bg-primary-50/60 dark:hover:bg-primary-950/20 transition-colors duration-150 group">
                      <td className="px-3 py-3" onClick={e => toggleFav(item.id, e)}>
                        {favorites.has(item.id)
                          ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          : <StarOff className="w-4 h-4 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                        <span className="group-hover:text-primary-600 transition-colors">
                          <Highlight text={item.name_cn} keyword={keyword} />
                        </span>
                        {item.name_pinyin && <div className="text-[10px] text-[#94A3B8] font-mono">{item.name_pinyin}</div>}
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-xs italic font-mono">{item.name_latin || '-'}</td>
                      <td className="px-4 py-3"><Badge variant="info" size="sm">{item.category || '-'}</Badge></td>
                      <td className="px-4 py-3 text-xs max-w-[180px] truncate text-[#475569] dark:text-[#cbd5e1] hidden md:table-cell" title={item.effects}>
                        <Highlight text={item.effects || '-'} keyword={keyword} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.ob_percent != null
                          ? <span className={`font-mono text-sm font-semibold ${Number(item.ob_percent) >= 30 ? 'text-primary-600' : 'text-[#475569] dark:text-[#cbd5e1]'}`}>{Number(item.ob_percent).toFixed(1)}</span>
                          : <span className="text-[#94A3B8]">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">{item.dl_value != null ? Number(item.dl_value).toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {item.is_food_homology ? <Badge variant="success" size="sm">是</Badge> : <span className="text-[#94A3B8] text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono text-sm font-semibold ${(item.compound_count || 0) > 20 ? 'text-blue-600' : 'text-[#475569] dark:text-[#cbd5e1]'}`}>
                          {item.compound_count}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!herbQuery.isLoading && items.length === 0 && (
            <div className="p-16 text-center">
              <div className="text-5xl mb-3 opacity-20">🌿</div>
              <div className="text-[#94A3B8] text-sm mb-2">{keyword ? `未找到「${keyword}」的结果` : '请输入关键词搜索'}</div>
              {keyword && <button onClick={() => { setKeyword(''); doSearch() }} className="text-xs text-primary-600 hover:underline">清除搜索</button>}
            </div>
          )}
        </Card>
      )}

      {/* 卡片视图 */}
      {viewMode === 'card' && (
        <>
          {herbQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item: any) => (
                <div key={item.id} onClick={() => setSelectedHerb(item)}
                  className="card p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group border border-transparent hover:border-primary-200 dark:hover:border-primary-800">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] group-hover:text-primary-600 transition-colors truncate">
                        <Highlight text={item.name_cn} keyword={keyword} />
                      </h3>
                      <p className="text-xs text-[#94A3B8] font-mono italic truncate">{item.name_latin || '-'}</p>
                    </div>
                    <button onClick={e => toggleFav(item.id, e)} className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors flex-shrink-0">
                      {favorites.has(item.id)
                        ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        : <StarOff className="w-4 h-4 text-[#94A3B8]" />}
                    </button>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2 mb-3">{item.effects || '暂无功效描述'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="info" size="sm">{item.category || '-'}</Badge>
                    {item.is_food_homology && <Badge variant="success" size="sm">药食同源</Badge>}
                    {item.ob_percent != null && <span className="text-[10px] font-mono text-[#94A3B8]">OB {Number(item.ob_percent).toFixed(1)}%</span>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[rgba(148,163,184,0.1)] flex justify-between text-xs text-[#94A3B8]">
                    <span>化合物 <strong className="text-[#475569] dark:text-[#cbd5e1]">{item.compound_count}</strong></span>
                    <span>靶点 <strong className="text-[#475569] dark:text-[#cbd5e1]">{item.target_count}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!herbQuery.isLoading && items.length === 0 && (
            <div className="card p-16 text-center">
              <div className="text-5xl mb-3 opacity-20">🌿</div>
              <div className="text-[#94A3B8] text-sm">{keyword ? `未找到「${keyword}」的结果` : '请输入关键词搜索'}</div>
            </div>
          )}
        </>
      )}

      {Math.ceil(total / pageSize) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} />
      )}

      <Modal open={!!selectedHerb} onClose={() => setSelectedHerb(null)} title={selectedHerb?.name_cn ?? ''} maxWidth="max-w-3xl lg:max-w-5xl xl:max-w-6xl" className="max-h-[90vh] lg:max-h-[85vh] overflow-hidden">
        {herbDetailQuery.isLoading && (
          <div className="space-y-4 animate-pulse p-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        )}
        {herbDetailQuery.data && (
          <div className="overflow-y-auto max-h-[calc(90vh-11rem)] lg:max-h-[calc(85vh-10rem)]">
            <HerbsTabHerbDetailContent herb={herbDetailQuery.data} chartColor={CHART_PRIMARY} />
            {/* 交叉检索面板 — Phase 4 新增 */}
            <div className="mt-5 pt-4 border-t border-[rgba(148,163,184,0.12)] flex-shrink-0">
              <CrossSearchPanel initialHerbName={selectedHerb?.name_cn} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── 药材详情内容 ───
function HerbsTabHerbDetailContent({ herb, chartColor }: { herb: any; chartColor: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'compounds' | 'targets' | 'diseases'>('overview')
  const radarData = [
    { subject: '口服生物利用度', A: Math.min((herb.ob_percent ?? 0) / 80 * 100, 100), fullMark: 100 },
    { subject: '类药性', A: Math.min((herb.dl_value ?? 0) / 0.5 * 100, 100), fullMark: 100 },
    { subject: '化合物丰富度', A: Math.min(((herb.compounds?.length || 0) / 30) * 100, 100), fullMark: 100 },
    { subject: '靶点覆盖', A: Math.min(((herb.targets?.length || 0) / 20) * 100, 100), fullMark: 100 },
  ]
  const compounds = herb.compounds || []
  const targets = herb.targets || []
  const diseases = herb.diseases || []

  // Safely extract display name from target/disease (supports both string and {id, name} object)
  const tgtName = (t: any) => typeof t === 'string' ? t : (t?.name || '')
  const disName = (d: any) => typeof d === 'string' ? d : (d?.name || '')

  function renderTabContent() {
    if (activeTab === 'overview') {
      return (
        <div className="space-y-4">
          {/* ── 药材基本信息 ── */}
          <div className="rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-blue-950/10 p-3 border border-[rgba(148,163,184,0.1)]">
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">{herb.effects}</p>
            <p className="text-[10px] text-[#94A3B8] mt-1">分类：{herb.category}</p>
          </div>

          {/* ── 核心化学成分 ── */}
          {compounds.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-primary-700 dark:text-primary-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                核心化学成分
                <span className="font-normal text-[10px] text-[#94A3B8] font-mono">共 {compounds.length} 种</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {compounds.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="bg-white dark:bg-slate-800/80 px-3 py-1.5 rounded-lg text-xs border border-blue-100 dark:border-blue-900/20 shadow-sm hover:shadow-md transition-shadow">
                    <div className="font-medium text-[#0f172a] dark:text-[#f1f5f9] truncate max-w-[140px]" title={c.name}>{c.name}</div>
                    <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5 space-x-2">
                      <span className="text-emerald-600 dark:text-emerald-400" title="口服生物利用度">OB {Number(c.ob).toFixed(1)}</span>
                      <span className="text-blue-600 dark:text-blue-400" title="类药性">DL {Number(c.dl).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {compounds.length > 8 && (
                  <button onClick={() => setActiveTab('compounds')} className="self-center px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/30 dark:hover:bg-primary-900/40 transition-colors">
                    查看全部 {compounds.length} 种成分 →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 作用靶点预测 ── */}
          {targets.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                作用靶点预测
                <span className="font-normal text-[10px] text-[#94A3B8] font-mono">{targets.length} 个唯一靶点</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {targets.slice(0, 15).map((t: any, i: number) => (
                  <Badge key={i} variant="warning" size="sm" className="cursor-default" title={`靶点ID: ${t?.id || '-'}`}>{tgtName(t)}</Badge>
                ))}
                {targets.length > 15 && (
                  <button onClick={() => setActiveTab('targets')} className="px-2 py-0.5 rounded text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 transition-colors font-medium">
                    +{targets.length - 15} 更多
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 关联疾病谱 ── */}
          {diseases.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                关联疾病谱
                <span className="font-normal text-[10px] text-[#94A3B8] font-mono">{diseases.length} 种相关疾病</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {diseases.slice(0, 12).map((d: any, i: number) => (
                  <Badge key={i} variant="danger" size="sm" className="cursor-default" title={`疾病ID: ${d?.id || '-'}`}>{disName(d)}</Badge>
                ))}
                {diseases.length > 12 && (
                  <button onClick={() => setActiveTab('diseases')} className="px-2 py-0.5 rounded text-xs text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 transition-colors font-medium">
                    +{diseases.length - 12} 更多
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'compounds' && compounds.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-[rgba(148,163,184,0.18)]">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] rounded-tl-lg">化合物名称</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#475569] dark:text-[#cbd5e1]" title="口服生物利用度 (Oral Bioavailability)">生物利用度 (%)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#475569] dark:text-[#cbd5e1]" title="类药性 (Drug-Likeness)">类药性</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] rounded-tr-lg">关联靶点</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
              {compounds.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[#0f172a] dark:text-[#f1f5f9]">{c.name}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[#475569]">{c.ob != null ? Number(c.ob).toFixed(1) : '-'}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[#475569]">{c.dl != null ? Number(c.dl).toFixed(3) : '-'}</td>
                  <td className="px-3 py-2.5 text-center text-[#475569]">{c.target_count ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (activeTab === 'targets') {
      return (
        <div className="flex flex-wrap gap-2">
          {targets.map((t: any, i: number) => <Badge key={i} variant="warning" size="sm">{tgtName(t)}</Badge>)}
          {targets.length === 0 && <div className="text-sm text-[#94A3B8]">暂无靶点数据</div>}
        </div>
      )
    }

    if (activeTab === 'diseases') {
      return (
        <div className="flex flex-wrap gap-2">
          {diseases.map((d: any, i: number) => <Badge key={i} variant="danger" size="sm">{disName(d)}</Badge>)}
          {diseases.length === 0 && <div className="text-sm text-[#94A3B8]">暂无疾病关联数据</div>}
        </div>
      )
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {/* 左侧栏 - 核心信息区（横屏） / 顶部信息（竖屏） */}
      <div className="space-y-3 lg:space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8] italic font-mono">{herb.name_latin}</p>
              {herb.is_food_homology && <Badge variant="success" size="sm">药食同源</Badge>}
              {herb.tcmsp_id && <Badge variant="neutral" size="sm" className="font-mono text-[10px]">TCMSP:{herb.tcmsp_id}</Badge>}
            </div>
            <p className="text-sm text-[#475569] dark:text-[#cbd5e1] leading-relaxed">{herb.effects}</p>
            <p className="text-xs text-[#94A3B8] mt-1">{herb.category}</p>
          </div>
        </div>

        <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-xl p-4 border border-[rgba(148,163,184,0.12)]">
          <h4 className="text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-3 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-primary-400 to-primary-600"></span>
            药理属性雷达图
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="rgba(148,163,184,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94A3B8' }} />
              <Radar dataKey="A" stroke={chartColor} fill={chartColor} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: herb.ob_percent != null ? `${Number(herb.ob_percent).toFixed(1)}%` : '-', label: '口服生物利用度', sub: 'OB', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/80 dark:bg-emerald-950/20', border: 'border-emerald-200/50 dark:border-emerald-800/20' },
            { value: herb.dl_value != null ? Number(herb.dl_value).toFixed(3) : '-', label: '类药性', sub: 'DL', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50/80 dark:bg-blue-950/20', border: 'border-blue-200/50 dark:border-blue-800/20' },
            { value: compounds.length, label: '活性化合物', sub: 'Compounds', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50/80 dark:bg-primary-950/20', border: 'border-primary-200/50 dark:border-primary-800/20' },
            { value: targets.length, label: '作用靶点', sub: 'Targets', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/80 dark:bg-amber-950/20', border: 'border-amber-200/50 dark:border-amber-800/20' },
          ].map(({ value, label, sub, color, bg, border }) => (
            <div key={label} className={`p-3 rounded-xl text-center ${bg} border ${border} transition-all hover:shadow-sm`}>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-[#475569] dark:text-[#94A3B8] mt-0.5 font-medium">{label}</div>
              <div className="text-[8px] text-[#94A3B8]/60 font-mono">{sub}</div>
            </div>
          ))}
        </div>

        {/* 竖屏模式下的完整内容 */}
        <div className="lg:hidden">
          <div className="flex gap-1 border-b border-[rgba(148,163,184,0.18)] overflow-x-auto">
            {[
              { key: 'overview', label: '概览' },
              { key: 'compounds', label: `化学成分 (${compounds.length})` },
              { key: 'targets', label: `作用靶点 (${targets.length})` },
              { key: 'diseases', label: `关联疾病 (${diseases.length})` },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`px-4 py-2.5 text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === key ? 'text-primary-600' : 'text-[#94A3B8] hover:text-[#64748B]'}`}>
                {label}
                {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
              </button>
            ))}
          </div>
          {renderTabContent()}
        </div>
      </div>

      {/* 右侧栏 - 详细数据区（仅横屏显示） */}
      <div className="hidden lg:flex flex-col space-y-4">
        <div className="flex gap-1 border-b border-[rgba(148,163,184,0.18)]">
          {[
              { key: 'overview', label: '概览总览' },
              { key: 'compounds', label: `化学成分 (${compounds.length})` },
              { key: 'targets', label: `作用靶点 (${targets.length})` },
              { key: 'diseases', label: `关联疾病 (${diseases.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${activeTab === key ? 'text-primary-600' : 'text-[#94A3B8] hover:text-[#64748B]'}`}>
              {label}
              {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}
