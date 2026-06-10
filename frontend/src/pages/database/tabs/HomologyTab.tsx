/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 药食同源 Tab — Phase 3 深度完善版
 * - 卡片网格视图（可切换表格）
 * - 功效分类标签快速过滤
 * - 随机推荐功能
 * - 查询历史（localStorage）
 * - 搜索高亮
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import {
  Input, Button, Badge, Pagination,
  Card,
} from '@/components/ui'
import {
  Search, Grid3X3, List, Shuffle, Clock, CheckCircle2,
  XCircle,
} from 'lucide-react'

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
function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 功效分类颜色 ───
const EFFECT_COLORS: Record<string, string> = {
  '补益类': 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  '清热类': 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  '活血类': 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  '理气类': 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  '解表类': 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  '利水渗湿': 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800',
  '安神类': 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
}

export default function HomologyTab() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [checkName, setCheckName] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [effectFilter, setEffectFilter] = useState<string | null>(null)
  const [queryHistory, setQueryHistory] = useState<string[]>([])

  const listQuery = useQuery({
    queryKey: ['db-homology-list', keyword, page, effectFilter],
    queryFn: () => databaseApi.getFoodHomologyHerbs({ keyword, page, page_size: 24, effects: effectFilter || undefined }),
  })

  const checkQuery = useQuery({
    queryKey: ['db-homology-check', checkName],
    queryFn: () => databaseApi.checkFoodHomology(checkName),
    enabled: checkName.length >= 1,
  })

  // 加载历史记录
  useEffect(() => {
    const loadHistory = () => {
      try {
        const saved = localStorage.getItem('rmfood_homology_history')
        if (saved) {
          try {
            const history = JSON.parse(saved)
            if (Array.isArray(history)) {
              setQueryHistory(history)
            }
          } catch { /* empty */ }
        }
      } catch { /* empty */ }
    }

    loadHistory()
  }, [])

  // 保存查询历史
  const handleCheck = () => {
    if (!checkName.trim()) return
    const trimmed = checkName.trim()
    setQueryHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 10)
      try { localStorage.setItem('rmfood_homology_history', JSON.stringify(next)) } catch { /* empty */ }
      return next
    })
  }

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0

  // 提取所有功效分类（用于过滤）
  const allEffects = useMemo(() => {
    const set = new Set<string>()
    items.forEach((h: any) => {
      if (h.effects) {
        h.effects.split(/[；;,，]/).forEach((e: string) => {
          const trimmed = e.trim()
          if (trimmed) set.add(trimmed)
        })
      }
    })
    return Array.from(set).slice(0, 12)
  }, [items])

  const randomRecommend = () => {
    if (items.length === 0) return
    const random = items[Math.floor(Math.random() * items.length)]
    setKeyword(random.name_cn)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* 查询工具 */}
      <Card className="p-5">
        <h3 className="font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-primary-600" />药食同源快速查询
        </h3>
        <p className="text-xs text-[#94A3B8] mb-3">输入药材名称，查询是否在药食同源目录中</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={checkName} onChange={(e) => setCheckName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="输入药材名称，如：人参、黄芪、枸杞子..."
            />
          </div>
          <Button variant="primary" onClick={handleCheck}>查询</Button>
          <Button variant="ghost" size="sm" onClick={randomRecommend} title="随机推荐" className="gap-1">
            <Shuffle className="w-4 h-4" />推荐
          </Button>
        </div>

        {/* 查询结果 */}
        {checkQuery.data && (
          <div className={`mt-4 p-4 rounded-xl transition-all duration-300 ${checkQuery.data.is_food_homology ? 'bg-primary-50/60 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800' : 'bg-gray-50/60 dark:bg-gray-800/40 border border-[rgba(148,163,184,0.18)]'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${checkQuery.data.is_food_homology ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-200 dark:bg-gray-700'}`}>
                {checkQuery.data.is_food_homology ? <CheckCircle2 className="w-5 h-5 text-primary-600" /> : <XCircle className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0f172a] dark:text-[#f1f5f9] text-lg">{checkQuery.data.herb_name}</span>
                  <Badge variant={checkQuery.data.is_food_homology ? 'success' : 'neutral'} size="md">
                    {checkQuery.data.is_food_homology ? '药食同源' : '非药食同源'}
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{checkQuery.data.regulatory_basis}</p>
              </div>
            </div>
            {checkQuery.data.matched_catalog_entries?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {checkQuery.data.matched_catalog_entries.map((entry: string, i: number) => (
                  <Badge key={i} variant="primary" size="sm" className="font-mono">{entry}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 查询历史 */}
        {queryHistory.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#94A3B8] flex items-center gap-1">
              <Clock className="w-3 h-3" />历史
            </span>
            {queryHistory.map((h, i) => (
              <button key={i} onClick={() => setCheckName(h)}
                className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                {h}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* 目录浏览 */}
      <div className="flex gap-3 items-center">
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
          placeholder="在药食同源目录中搜索..." className="flex-1" />
        <Button variant="primary" onClick={() => setPage(1)}>搜索</Button>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            <Grid3X3 className="w-4 h-4 text-[#64748B]" />
          </button>
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            <List className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* 功效分类快速过滤 */}
      {allEffects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setEffectFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${!effectFilter ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-slate-800 text-[#64748B] border-[rgba(148,163,184,0.18)] hover:border-primary-300'}`}>
            全部
          </button>
          {allEffects.map(effect => (
            <button key={effect} onClick={() => setEffectFilter(effectFilter === effect ? null : effect)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${effectFilter === effect ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-slate-800 text-[#64748B] border-[rgba(148,163,184,0.18)] hover:border-primary-300'}`}>
              {effect}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      {listQuery.isLoading ? (
        <CardSkeleton />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => {
            const effectClass = EFFECT_COLORS[Object.keys(EFFECT_COLORS).find(k => item.effects?.includes(k)) || ''] || ''
            return (
              <Card key={item.id} className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${effectClass}`}
                onClick={() => {/* 后续可打开详情 */}}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 dark:text-emerald-400 text-lg">🌿</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                        <Highlight text={item.name_cn} keyword={keyword} />
                      </span>
                      <Badge variant="success" size="sm">药食同源</Badge>
                    </div>
                    <div className="text-xs text-[#94A3B8] italic font-mono mb-1">{item.name_latin || '-'}</div>
                    {item.category && (
                      <Badge variant="info" size="sm" className="mb-1">{item.category}</Badge>
                    )}
                    {item.effects && (
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed line-clamp-2">
                        <Highlight text={item.effects} keyword={keyword} />
                      </p>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-[#94A3B8]">
                      <span>OB {item.ob_percent != null ? Number(item.ob_percent).toFixed(1) : '-'}</span>
                      <span>·</span>
                      <span>{item.compound_count} 化合物</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(148,163,184,0.18)]">
                  {['药材名称', '拉丁名', '分类', '功效', 'OB%', '化合物'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
                {items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-primary-50/60 dark:hover:bg-primary-950/20 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      <Highlight text={item.name_cn} keyword={keyword} />
                      <Badge variant="success" size="sm" className="ml-1.5">药食同源</Badge>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] text-xs italic font-mono">{item.name_latin || '-'}</td>
                    <td className="px-4 py-3"><Badge variant="info" size="sm">{item.category || '-'}</Badge></td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate text-[#475569] dark:text-[#cbd5e1]">
                      <Highlight text={item.effects || '-'} keyword={keyword} />
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">
                      {item.ob_percent != null ? Number(item.ob_percent).toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[#475569] dark:text-[#cbd5e1]">
                      {item.compound_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {listQuery.isError && (
        <div className="text-center py-12"><div className="text-red-500 text-sm">❌ 数据加载失败，请刷新页面重试</div></div>
      )}
      {!listQuery.isError && items.length === 0 && !listQuery.isLoading && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="text-[#94A3B8] text-sm">
            {keyword || effectFilter ? '未找到匹配结果' : '请先同步数据后浏览'}
          </div>
        </div>
      )}

      {Math.ceil(total / 24) > 1 && (
        <Pagination currentPage={page} totalPages={Math.ceil(total / 24)} onPageChange={setPage} />
      )}
    </div>
  )
}
