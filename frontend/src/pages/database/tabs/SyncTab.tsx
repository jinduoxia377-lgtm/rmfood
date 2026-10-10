/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 数据管理 Tab — Phase 3 深度完善版
 * - 分类进度条兼容字典格式（与categoryData同样修复）
 * - 快照历史记录（带时间线）
 * - 知识图谱概览统计
 * - 同步进度动画
 */
import { useQuery } from '@tanstack/react-query'
import { databaseApi } from '@/api/database'
import {
  Button, Badge, Card,
} from '@/components/ui'
import {
  RefreshCw, Database, Activity, Layers, Clock, TrendingUp,
  BarChart2,
} from 'lucide-react'

// ─── 兼容字典/数组格式的进度条渲染 ───
function CategoryProgressBar({
  raw,
  total,
  color = 'bg-primary-500',
}: {
  raw: any
  total: number
  color?: string
}) {
  if (!raw) return null
  let entries: [string, number][] = []
  if (Array.isArray(raw)) {
    entries = raw.map((c: any) => [c.category || c.name, typeof c.count === 'number' ? c.count : 0])
  } else if (typeof raw === 'object') {
    entries = Object.entries(raw as Record<string, number>)
  }
  return (
    <div className="mt-3 space-y-1.5">
      {entries.slice(0, 6).map(([name, count]: [string, any]) => (
        <div key={name} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] truncate">{name}</span>
          <div className="flex-1 h-1.5 bg-[rgba(148,163,184,0.12)] rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all duration-700`}
              style={{ width: `${total > 0 ? (Number(count) / total) * 100 : 0}%` }} />
          </div>
          <span className="w-6 text-right font-mono text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function SyncTab({
  stats,
  isSyncing,
  onSyncHerbs,
  onSyncPeptides,
  lastHerbSync,
  lastPeptideSync,
}: {
  stats: any
  isSyncing: boolean
  onSyncHerbs: () => void
  onSyncPeptides: () => void
  lastHerbSync: any
  lastPeptideSync: any
}) {
  const snapshotsQuery = useQuery({
    queryKey: ['db-snapshots'],
    queryFn: () => databaseApi.listSnapshots(),
  })

  const isSyncingHerbs = isSyncing
  const isSyncingPeptides = isSyncing

  const tcmspTotal = stats?.tcmsp?.total_herbs ?? 0
  const dfbpTotal = stats?.dfbp?.total_peptides ?? 0

  return (
    <div className="space-y-6">
      {/* 同步进度条 */}
      {isSyncing && (
        <div className="card p-4 border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-950/20 animate-pulse">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-primary-700 animate-spin" />
            <span className="text-sm text-primary-700 dark:text-primary-700 font-medium">
              {isSyncingHerbs ? '正在同步药材数据...' : '正在同步肽数据...'}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-primary-100 dark:bg-primary-300/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* 数据源状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TCMSP */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-300/30 flex items-center justify-center">
                <Database className="w-4 h-4 text-primary-700" />
              </div>
              <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">TCMSP 中药材</h3>
            </div>
            <Badge variant="primary" size="sm">{stats?.tcmsp?.kb_total ?? 0} 知识库</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">本地数据库</span>
              <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] font-mono">{tcmspTotal} 条</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">药食同源</span>
              <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] font-mono">{stats?.tcmsp?.food_homology_count ?? 0} 种</strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">最后同步</span>
              <span className="text-xs font-mono text-[var(--text-muted,#9A9A9F)]">
                {stats?.tcmsp?.last_sync
                  ? new Date(stats.tcmsp.last_sync).toLocaleString('zh-CN')
                  : '未同步'}
              </span>
            </div>
          </div>
          <CategoryProgressBar raw={stats?.tcmsp?.categories} total={tcmspTotal} color="bg-primary-500" />
          <Button variant="primary" className="mt-4 w-full gap-1.5" onClick={onSyncHerbs} disabled={isSyncingHerbs}>
            <RefreshCw className={`w-4 h-4 ${isSyncingHerbs ? 'animate-spin' : ''}`} />
            {isSyncingHerbs ? '同步中...' : '同步药材数据'}
          </Button>
          {lastHerbSync && (
            <div className="mt-2 p-3 bg-primary-50/60 dark:bg-primary-950/20 rounded-lg text-xs text-primary-700 dark:text-primary-700 border border-primary-100 dark:border-primary-900/30">
              <div className="font-semibold mb-1">同步完成</div>
              <div className="flex gap-4">
                <span>新增 <strong>{lastHerbSync.inserted}</strong></span>
                <span>更新 <strong>{lastHerbSync.updated}</strong></span>
                <span>知识库 <strong>{lastHerbSync.total_kb}</strong></span>
              </div>
            </div>
          )}
        </Card>

        {/* DFBP */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-300/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-secondary-600" />
              </div>
              <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">DFBP 活性肽</h3>
            </div>
            <Badge variant="info" size="sm">{stats?.dfbp?.kb_total ?? 0} 知识库</Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">本地数据库</span>
              <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] font-mono">{dfbpTotal} 条</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle,rgba(0,0,0,0.06))]">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">活性类型</span>
              <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] font-mono">
                {Object.keys(stats?.dfbp?.activity_types ?? {}).length} 种
              </strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]">最后同步</span>
              <span className="text-xs font-mono text-[var(--text-muted,#9A9A9F)]">
                {stats?.dfbp?.last_sync
                  ? new Date(stats.dfbp.last_sync).toLocaleString('zh-CN')
                  : '未同步'}
              </span>
            </div>
          </div>
          <CategoryProgressBar raw={stats?.dfbp?.activity_types} total={dfbpTotal} color="bg-secondary-500" />
          <Button variant="secondary" className="mt-4 w-full gap-1.5" onClick={onSyncPeptides} disabled={isSyncingPeptides}>
            <RefreshCw className={`w-4 h-4 ${isSyncingPeptides ? 'animate-spin' : ''}`} />
            {isSyncingPeptides ? '同步中...' : '同步肽数据'}
          </Button>
          {lastPeptideSync && (
            <div className="mt-2 p-3 bg-secondary-50/60 dark:bg-secondary-950/20 rounded-lg text-xs text-secondary-700 dark:text-secondary-700 border border-secondary-100 dark:border-secondary-900/30">
              <div className="font-semibold mb-1">同步完成</div>
              <div className="flex gap-4">
                <span>新增 <strong>{lastPeptideSync.inserted}</strong></span>
                <span>更新 <strong>{lastPeptideSync.updated}</strong></span>
                <span>知识库 <strong>{lastPeptideSync.total_kb}</strong></span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 知识图谱统计 */}
      {stats?.knowledge_graph && (
        <Card className="p-5">
          <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-700" />知识图谱概览
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '药材节点', value: stats.knowledge_graph.total_herbs, icon: Database, bg: 'bg-primary-50 dark:bg-primary-950/40' },
              { label: '化合物节点', value: stats.knowledge_graph.total_compounds, icon: BarChart2, bg: 'bg-secondary-50 dark:bg-secondary-950/40' },
              { label: '靶点节点', value: stats.knowledge_graph.total_targets, icon: TrendingUp, bg: 'bg-warning-50 dark:bg-warning-950/40' },
              { label: '疾病节点', value: stats.knowledge_graph.total_diseases, icon: Layers, bg: 'bg-danger-50 dark:bg-danger-950/40' },
              { label: '活性肽数据', value: stats.knowledge_graph.total_peptides, icon: Activity, bg: 'bg-accent-50 dark:bg-accent-950/40' },
              { label: '配伍关系', value: stats.knowledge_graph.herb_interactions, icon: TrendingUp, bg: 'bg-info-50 dark:bg-info-950/40' },
              { label: '化合物-靶点路径', value: stats.knowledge_graph.compound_target_paths, icon: Layers, bg: 'bg-primary-50 dark:bg-success-950/40' },
              { label: '药食同源药材', value: stats.knowledge_graph.food_homology_herbs, icon: Database, bg: 'bg-warning-50 dark:bg-warning-950/40' },
            ].map(({ label, value, icon: Icon, bg }) => (
              <div key={label} className={`p-3 rounded-xl text-center ${bg}`}>
                <Icon className="w-4 h-4 mx-auto mb-1 text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)]" />
                <div className="text-xl font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">{value}</div>
                <div className="text-xs text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-muted,#9A9A9F)] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 数据快照时间线 */}
      {snapshotsQuery.data?.snapshots && Array.isArray(snapshotsQuery.data.snapshots) && snapshotsQuery.data.snapshots.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))] mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary-600" />同步快照记录
          </h3>
          <div className="relative">
            {/* 时间线 */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[rgba(148,163,184,0.18)]" />
            <div className="space-y-3">
              {snapshotsQuery.data?.snapshots?.slice(0, 8).map((s: any) => (
                <div key={s.snapshot_id} className="flex items-start gap-4 pl-8 relative">
                  {/* 时间线节点 */}
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 bg-white dark:bg-neutral-900 z-10 ${
                    s.is_active ? 'border-primary-500' : 'border-[var(--border-subtle,rgba(0,0,0,0.06))]'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,var(--bg-canvas))]">{s.source_db}</span>
                      {s.is_active && <Badge variant="success" size="sm">当前</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted,#9A9A9F)]">
                      <span className="font-mono">{s.total_records} 条记录</span>
                      <span>·</span>
                      <span className="font-mono">{new Date(s.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                    {s.metadata && (
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-primary-700 dark:text-primary-700">
                          +{s.metadata?.inserted ?? 0} 新增
                        </span>
                        <span className="text-secondary-600 dark:text-secondary-700">
                          ~{s.metadata?.updated ?? 0} 更新
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
