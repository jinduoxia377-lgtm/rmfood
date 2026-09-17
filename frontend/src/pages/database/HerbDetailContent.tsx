/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 药材详情内容组件（增强版）
 * 包含雷达图、化合物/靶点/疾病详情
 */
import { useState } from 'react'
import { Badge } from '@/components/ui'
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'

const CHART_COLORS = { primary: 'var(--color-primary, #34C759)', blue: 'var(--color-secondary, #0A84FF)', amber: 'var(--color-warning, #FF9F0A)', accent: 'var(--color-tertiary, #AF52DE)' }

export function HerbDetailContent({ herb }: { herb: any }) {
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

  return (
    <div className="space-y-4">
      {/* 头部信息 */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] italic font-mono">{herb.name_latin}</p>
            {herb.is_food_homology && <Badge variant="success" size="sm">药食同源</Badge>}
            {herb.tcmsp_id && <Badge variant="neutral" size="sm" className="font-mono text-[10px]">TCMSP:{herb.tcmsp_id}</Badge>}
          </div>
          <p className="text-sm text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)] leading-relaxed">{herb.effects}</p>
        </div>
      </div>

      {/* 雷达图 + 属性卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50/60 dark:bg-neutral-800/40 rounded-xl p-4 border border-[var(--border-subtle,rgba(0,0,0,0.06))]">
          <h4 className="text-xs font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider mb-3">属性雷达图</h4>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="rgba(148,163,184,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--text-muted, #9A9A9F)' }} />
              <Radar name="药材属性" dataKey="A" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: herb.ob_percent != null ? `${Number(herb.ob_percent).toFixed(1)}%` : '-', label: '口服生物利用度', color: 'text-primary-600', bg: 'bg-primary-50' },
            { value: herb.dl_value != null ? Number(herb.dl_value).toFixed(3) : '-', label: '类药性 (DL)', color: 'text-secondary-600', bg: 'bg-secondary-50' },
            { value: compounds.length, label: '活性化合物', color: 'text-accent-600', bg: 'bg-accent-50' },
            { value: targets.length, label: '作用靶点', color: 'text-warning-600', bg: 'bg-warning-50' },
          ].map(({ value, label, color, bg }) => (
            <div key={label} className={`p-3 rounded-xl text-center ${bg} dark:bg-opacity-20`}>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
        {[
          { key: 'overview', label: '概览' },
          { key: 'compounds', label: `化合物 (${compounds.length})` },
          { key: 'targets', label: `靶点 (${targets.length})` },
          { key: 'diseases', label: `疾病 (${diseases.length})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key as "diseases" | "overview" | "compounds" | "targets")}
            className={`px-4 py-2.5 text-sm font-medium transition-all relative ${activeTab === key ? 'text-primary-600' : 'text-[var(--text-muted,#9A9A9F)] hover:text-[var(--text-secondary,#6E6E73)]'}`}>
            {label}
            {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'overview' && (
        <div className="space-y-3 animate-micro-in">
          {compounds.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider mb-2">代表性化合物</h4>
              <div className="flex flex-wrap gap-2">
                {compounds.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="bg-secondary-50/60 dark:bg-blue-950/20 px-3 py-1.5 rounded-lg text-xs">
                    <div className="font-medium text-secondary-700 dark:text-secondary-400">{c.name}</div>
                    <div className="text-[10px] text-[var(--text-muted,#9A9A9F)] font-mono">OB {Number(c.ob).toFixed(1)} | DL {Number(c.dl).toFixed(2)}</div>
                  </div>
                ))}
                {compounds.length > 8 && <Badge variant="info" size="sm">+{compounds.length - 8} 更多</Badge>}
              </div>
            </div>
          )}
          {targets.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider mb-2">作用靶点</h4>
              <div className="flex flex-wrap gap-1.5">
                {targets.slice(0, 15).map((t: string, i: number) => (
                  <Badge key={i} variant="warning" size="sm">{t}</Badge>
                ))}
                {targets.length > 15 && <Badge variant="neutral" size="sm">+{targets.length - 15}</Badge>}
              </div>
            </div>
          )}
          {diseases.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider mb-2">相关疾病</h4>
              <div className="flex flex-wrap gap-1.5">
                {diseases.slice(0, 12).map((d: string, i: number) => (
                  <Badge key={i} variant="danger" size="sm">{d}</Badge>
                ))}
                {diseases.length > 12 && <Badge variant="neutral" size="sm">+{diseases.length - 12}</Badge>}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'compounds' && compounds.length > 0 && (
        <div className="overflow-x-auto animate-micro-in">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--text-muted,#9A9A9F)] uppercase tracking-wider">化合物</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-[var(--text-muted,#9A9A9F)]">OB%</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-[var(--text-muted,#9A9A9F)]">DL</th>
                <th className="px-3 py-2 text-center text-[10px] font-semibold text-[var(--text-muted,#9A9A9F)]">靶点</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(148,163,184,0.08)]">
              {compounds.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-secondary-50/40 dark:hover:bg-blue-950/10 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">{c.name}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[var(--text-secondary,#6E6E73)]">{c.ob != null ? Number(c.ob).toFixed(1) : '-'}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-[var(--text-secondary,#6E6E73)]">{c.dl != null ? Number(c.dl).toFixed(3) : '-'}</td>
                  <td className="px-3 py-2.5 text-center text-[var(--text-secondary,#6E6E73)]">{c.target_count ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'targets' && targets.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-micro-in">
          {targets.map((t: string, i: number) => (
            <div key={i} className="bg-warning-50/60 dark:bg-amber-950/20 px-3 py-2 rounded-xl text-xs">
              <Badge variant="warning" size="sm" className="mb-1">{t}</Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'diseases' && diseases.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-micro-in">
          {diseases.map((d: string, i: number) => (
            <div key={i} className="bg-rose-50/60 dark:bg-rose-950/20 px-3 py-2 rounded-xl text-xs">
              <Badge variant="danger" size="sm" className="mb-1">{d}</Badge>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'diseases' && diseases.length === 0 && (
        <div className="text-center py-8 text-[var(--text-muted,#9A9A9F)] text-sm">暂无疾病关联数据</div>
      )}
    </div>
  )
}
