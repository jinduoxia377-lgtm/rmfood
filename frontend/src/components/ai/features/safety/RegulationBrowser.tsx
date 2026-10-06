import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import Fuse from 'fuse.js'
import foodRegulationService from '@/services/professional/foodRegulationService'
import type { FoodStandard, InternationalStandard } from '@/services/professional/foodRegulationService'

interface RegionDef {
  id: string
  name: string
  standards: string[]
}

const REGIONS: RegionDef[] = [
  { id: 'cn', name: '中国', standards: ['GB 标准', 'GB/T 标准', 'NY/T 标准'] },
  { id: 'us', name: '美国', standards: ['FDA GRAS', 'CFR 21', 'FDA Guidance'] },
  { id: 'eu', name: '欧盟', standards: ['EFSA', 'REACH', 'EC No'] },
  { id: 'jp', name: '日本', standards: ['厚生省告示', 'JIS 标准', '食品卫生法'] },
  { id: 'kr', name: '韩国', standards: ['KFDA', '食品公典', 'KFDA 告示'] },
  { id: 'international', name: '国际标准', standards: ['ISO', 'Codex Alimentarius', 'WHO/FAO'] },
]

interface RegulationCategory {
  id: string
  name: string
  description: string
}

const GB_CATEGORIES: RegulationCategory[] = [
  { id: 'all', name: '全部类别', description: '' },
  { id: '食品添加剂', name: '食品添加剂', description: '添加剂使用原则与限量' },
  { id: '污染物限量', name: '污染物限量', description: '重金属、真菌毒素限量' },
  { id: '农药残留', name: '农药残留', description: '农药最大残留限量' },
  { id: '标签标识', name: '标签标识', description: '预包装食品标签规范' },
  { id: '生产规范', name: '生产规范', description: 'GMP/HACCP卫生规范' },
  { id: '微生物控制', name: '微生物控制', description: '致病菌限量要求' },
  { id: '兽药残留', name: '兽药残留', description: '动物性食品兽药限量' },
  { id: '乳制品', name: '乳制品', description: '乳及乳制品安全标准' },
  { id: '饮料', name: '饮料', description: '各类饮料标准' },
  { id: '婴幼儿食品', name: '婴幼儿食品', description: '婴配粉及辅食标准' },
  { id: '酒类', name: '酒类', description: '发酵酒及蒸馏酒标准' },
  { id: '油脂', name: '油脂', description: '植物油及动物油脂标准' },
  { id: '调味品', name: '调味品', description: '酱油、醋、味精等标准' },
  { id: '粮食及制品', name: '粮食及制品', description: '谷物、面粉、淀粉标准' },
  { id: '保健食品', name: '保健食品', description: '保健食品注册标准' },
  { id: '豆制品', name: '豆制品', description: '豆制品安全标准' },
  { id: '肉禽制品', name: '肉禽制品', description: '畜禽肉产品标准' },
  { id: '冷冻食品', name: '冷冻食品', description: '速冻面米及冷冻饮品' },
  { id: '食品接触材料', name: '食品接触材料', description: '包装材料卫生规范' },
  { id: '流通卫生', name: '流通卫生', description: '食品流通环节卫生规范' },
  { id: '餐饮卫生', name: '餐饮卫生', description: '餐饮服务卫生规范' },
  { id: '其他', name: '其他', description: '' },
]

const INTL_CATEGORIES: RegulationCategory[] = [
  { id: 'all', name: '全部类型', description: '' },
  { id: '管理体系', name: '管理体系', description: 'ISO/FSSC/BRCGS认证' },
  { id: '基础规范', name: '基础规范', description: 'CAC通用卫生规范' },
  { id: '食品添加剂', name: '食品添加剂', description: '国际添加剂使用标准' },
  { id: '农药残留', name: '农药残留', description: 'CAC MRL标准' },
  { id: '污染物限量', name: '污染物限量', description: '国际污染物限量' },
  { id: '标签标识', name: '标签标识', description: '国际食品标签法规' },
  { id: '国别法规', name: '国别法规', description: 'FDA/EU/日本法规' },
  { id: '认证标准', name: '认证标准', description: 'BRCGS/FSSC/SQF/IFS' },
  { id: '追溯管理', name: '追溯管理', description: '食品追溯体系准则' },
  { id: '进出口管理', name: '进出口管理', description: '进出口检验检疫准则' },
]

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' }> = {
    '现行':          { label: '现行有效', variant: 'success' },
    '已废止':        { label: '已废止',   variant: 'neutral' },
    'active':        { label: '有效',     variant: 'success' },
    'pending_update': { label: '待更新',  variant: 'warning' },
    'deprecated':    { label: '已废止',   variant: 'neutral' },
    'new':           { label: '新增',     variant: 'info' },
  }
  const c = config[status] ?? { label: status, variant: 'neutral' }
  return <Badge variant={c.variant}>{c.label}</Badge>
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null
  const p = priority.includes('P0') ? 'warning' as const : priority.includes('P1') ? 'info' as const : 'neutral' as const
  return <Badge variant={p}>{priority}</Badge>
}

interface GBViewProps {
  standards: FoodStandard[]
  onSelect: (st: FoodStandard) => void
}

function GBStandardsView({ standards, onSelect }: GBViewProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'code'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<FoodStandard | null>(null)

  const fuse = useMemo(() => new Fuse(standards, {
    keys: ['standard_code', 'title', 'summary', 'category'],
    threshold: 0.3,
  }), [standards])

  const filtered = useMemo(() => {
    let result = standards
    if (category !== 'all') result = result.filter(st => st.category === category)
    if (search.trim()) {
      const hits = fuse.search(search.trim())
      result = hits.map(h => h.item)
    }
    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') cmp = (a.publish_date ?? '').localeCompare(b.publish_date ?? '')
      else cmp = a.standard_code.localeCompare(b.standard_code)
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return result
  }, [standards, category, search, sortBy, sortOrder, fuse])

  const activeCount = useMemo(() => standards.filter(st => st.status === '现行').length, [standards])
  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {}
    standards.forEach(st => { c[st.category] = (c[st.category] || 0) + 1 })
    return c
  }, [standards])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">标准总数</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{standards.length}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">现行有效</p>
          <p className="text-2xl font-bold text-success-600">{activeCount}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">已废止</p>
          <p className="text-2xl font-bold text-neutral-400">{standards.length - activeCount}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">已筛选</p>
          <p className="text-2xl font-bold text-secondary-600">{filtered.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索标准编号、名称、关键词..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm min-w-[160px]"
        >
          {GB_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'date' | 'code')}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
        >
          <option value="date">按发布日期</option>
          <option value="code">按标准编号</option>
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '升序' : '降序'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryCounts)
          .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
          .slice(0, 12)
          .map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? 'all' : cat)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                category === cat
                  ? 'bg-secondary-container text-secondary-main border-secondary-600'
                  : 'border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-secondary-400'
              }`}
            >
              {cat} <span className="ml-1 opacity-70">{count}</span>
            </button>
          ))}
      </div>

      {!selected ? (
        <>
          <p className="text-sm text-neutral-500">共 {filtered.length} 条标准</p>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-36">标准编号</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">标准名称</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-28">类别</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-28">发布日期</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-24">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.slice(0, 50).map((st, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() => { setSelected(st); onSelect(st) }}
                  >
                    <td className="px-4 py-3 font-mono text-secondary-600 dark:text-secondary-400 text-xs">{st.standard_code}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-neutral-800 dark:text-neutral-200">{st.title}</td>
                    <td className="px-4 py-3"><Badge variant="neutral" className="text-xs">{st.category}</Badge></td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{st.publish_date}</td>
                    <td className="px-4 py-3"><StatusBadge status={st.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-neutral-400">未找到匹配的标准，请调整筛选条件</div>
            )}
            {filtered.length > 50 && (
              <div className="p-3 text-center text-xs text-neutral-500 bg-slate-50 dark:bg-neutral-800">
                显示前 50 条，请使用搜索框进一步筛选（共 {filtered.length} 条）
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            返回标准列表
          </Button>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{selected.title}</h3>
                <p className="font-mono text-secondary-600 dark:text-secondary-400 mt-1 text-sm">{selected.standard_code}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg text-sm">
              <div>
                <p className="text-xs text-neutral-500 mb-1">发布日期</p>
                <p className="font-medium">{selected.publish_date || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">实施日期</p>
                <p className="font-medium">{selected.implementation_date || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">类别</p>
                <p className="font-medium">{selected.category}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">英文名称</p>
                <p className="font-medium text-xs text-neutral-500">{selected.title_en || '-'}</p>
              </div>
            </div>

            {selected.summary && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">标准摘要</h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{selected.summary}</p>
              </div>
            )}

            {selected.scope && selected.scope.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">适用范围</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.scope.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selected.related_topics && selected.related_topics.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">相关主题</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.related_topics.map((tag: string, i: number) => (
                    <Badge key={i} variant="neutral" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selected.source_url && (
              <div>
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary-600 hover:underline inline-flex items-center gap-1"
                >
                  查看原文来源
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface IntlViewProps {
  standards: InternationalStandard[]
  onSelect: (st: InternationalStandard) => void
}

function InternationalStandardsView({ standards, onSelect }: IntlViewProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [selected, setSelected] = useState<InternationalStandard | null>(null)

  const fuse = useMemo(() => new Fuse(standards, {
    keys: ['standard_code', 'title', 'title_en', 'summary'],
    threshold: 0.3,
  }), [standards])

  const orgs = useMemo(() => {
    const s = new Set<string>()
    standards.forEach(st => { if (st.organization) s.add(st.organization) })
    return Array.from(s).sort()
  }, [standards])

  const filtered = useMemo(() => {
    let result = standards
    if (category !== 'all') result = result.filter(st => st.category === category)
    if (orgFilter !== 'all') result = result.filter(st => st.organization === orgFilter)
    if (search.trim()) {
      const hits = fuse.search(search.trim())
      result = hits.map(h => h.item)
    }
    return result
  }, [standards, category, orgFilter, search, fuse])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">国际标准总数</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{standards.length}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">来源机构</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{orgs.length}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">核心参考</p>
          <p className="text-2xl font-bold text-warning-600">
            {standards.filter(st => st.priority?.includes('P0')).length}
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500 mb-1">已筛选</p>
          <p className="text-2xl font-bold text-secondary-600">{filtered.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索标准编号、名称、关键词..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm min-w-[140px]"
        >
          {INTL_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={orgFilter}
          onChange={e => setOrgFilter(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm min-w-[120px]"
        >
          <option value="all">全部机构</option>
          {orgs.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {!selected ? (
        <>
          <p className="text-sm text-neutral-500">共 {filtered.length} 条国际标准</p>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-40">标准编号</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300">标准名称</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-28">类型</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-24">机构</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-700 dark:text-neutral-300 w-24">优先级</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((st, i) => (
                  <tr
                    key={i}
                    className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() => { setSelected(st); onSelect(st) }}
                  >
                    <td className="px-4 py-3 font-mono text-secondary-600 dark:text-secondary-400 text-xs">{st.standard_code}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-neutral-800 dark:text-neutral-200">{st.title}</td>
                    <td className="px-4 py-3"><Badge variant="neutral" className="text-xs">{st.category}</Badge></td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{st.organization || '-'}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={st.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-neutral-400">未找到匹配的国际标准</div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            返回标准列表
          </Button>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{selected.title}</h3>
                <p className="font-mono text-secondary-600 dark:text-secondary-400 mt-1 text-sm">{selected.standard_code}</p>
                {selected.title_en && (
                  <p className="text-xs text-neutral-500 mt-1 italic">{selected.title_en}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <StatusBadge status={selected.status} />
                {selected.priority && <PriorityBadge priority={selected.priority} />}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg text-sm">
              <div>
                <p className="text-xs text-neutral-500 mb-1">发布机构</p>
                <p className="font-medium">{selected.organization || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">发布日期</p>
                <p className="font-medium">{selected.publish_date || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">实施日期</p>
                <p className="font-medium">{selected.implementation_date || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">标准类型</p>
                <p className="font-medium">{selected.category}</p>
              </div>
            </div>

            {selected.summary && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">标准说明</h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{selected.summary}</p>
              </div>
            )}

            {selected.scope && selected.scope.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">适用范围</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.scope.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selected.related_topics && selected.related_topics.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">相关标准</h4>
                <div className="flex flex-wrap gap-2">
                  {selected.related_topics.map((tag: string, i: number) => (
                    <Badge key={i} variant="neutral" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selected.source_url && (
              <div>
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-secondary-600 hover:underline inline-flex items-center gap-1"
                >
                  访问官方链接
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface RegulationBrowserProps {
  onStandardSelect?: (standard: FoodStandard | InternationalStandard) => void
  className?: string
}

export function RegulationBrowser({ onStandardSelect, className = '' }: RegulationBrowserProps) {
  const [gbStandards, setGbStandards] = useState<FoodStandard[]>([])
  const [intlStandards, setIntlStandards] = useState<InternationalStandard[]>([])
  const [gbLoading, setGbLoading] = useState(true)
  const [intlLoading, setIntlLoading] = useState(true)
  const [gbError, setGbError] = useState<string | null>(null)
  const [intlError, setIntlError] = useState<string | null>(null)
  const feedback = useOperationFeedback()

  useEffect(() => {
    foodRegulationService.getStandards().then((data: { standards: FoodStandard[] }) => {
      setGbStandards(data.standards)
      setGbLoading(false)
    }).catch((err: unknown) => {
      setGbError(err instanceof Error ? err.message : '加载失败')
      setGbLoading(false)
    })
  }, [])

  useEffect(() => {
    foodRegulationService.getInternationalStandards().then((data: { standards: InternationalStandard[] }) => {
      setIntlStandards(data.standards)
      setIntlLoading(false)
    }).catch((err: unknown) => {
      setIntlError(err instanceof Error ? err.message : '加载失败')
      setIntlLoading(false)
    })
  }, [])

  const handleGbSelect = useCallback((st: FoodStandard) => {
    onStandardSelect?.(st)
  }, [onStandardSelect])

  const handleIntlSelect = useCallback((st: InternationalStandard) => {
    onStandardSelect?.(st)
  }, [onStandardSelect])

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">合规标准检索中心</CardTitle>
          <p className="text-sm text-neutral-500 mt-1">
            收录 {gbStandards.length} 项 GB 国家标准 + {intlStandards.length} 项国际食品安全标准
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="gb" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="gb">
                GB 国家标准
                {gbStandards.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400 rounded-full">
                    {gbStandards.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="intl">
                国际食品安全标准
                {intlStandards.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded-full">
                    {intlStandards.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gb">
              {gbLoading && (
                <div className="p-12 text-center text-neutral-400 text-sm">正在加载 GB 国家标准数据...</div>
              )}
              {gbError && (
                <div className="p-6 text-center text-error-600 text-sm bg-error-50 dark:bg-error-900/10 rounded-lg">
                  加载失败: {gbError}
                </div>
              )}
              {!gbLoading && !gbError && (
                <GBStandardsView standards={gbStandards} onSelect={handleGbSelect} />
              )}
            </TabsContent>

            <TabsContent value="intl">
              {intlLoading && (
                <div className="p-12 text-center text-neutral-400 text-sm">正在加载国际标准数据...</div>
              )}
              {intlError && (
                <div className="p-6 text-center text-error-600 text-sm bg-error-50 dark:bg-error-900/10 rounded-lg">
                  加载失败: {intlError}
                </div>
              )}
              {!intlLoading && !intlError && (
                <InternationalStandardsView standards={intlStandards} onSelect={handleIntlSelect} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export type { RegulationBrowserProps }
