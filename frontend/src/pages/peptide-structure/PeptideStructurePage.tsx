/**
 * 肽链结构分析页面
 * 参照 Dashboard 设计规范：Apple 风格卡片系统 + 品牌色横幅 + 统一排版
 * 每个快捷功能卡片点击后，通过 useNavigate 跳转到对应 tab
 */
import { useState, useEffect } from 'react'
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Dna, FlaskConical, Database, Activity,
  Zap, ShieldCheck, TrendingUp, ArrowRight,
} from 'lucide-react'
import { peptideStructureService } from '@/services/professional/peptideStructureService'
import { Button } from '@/components/ui'

// 懒加载核心分析器组件
const PeptideStructureAnalyzer = lazy(() => import('@/pages/database/tabs/PeptideStructureAnalyzer'))

// ─── Tab 类型定义 ──────────────────────────────────────────
type FeatureTab = 'analyze' | 'convert' | 'database' | 'compare' | 'history' | 'batch' | 'deep' | 'optimize' | 'synergy'

// ─── 统计数据类型 ──────────────────────────────────────────
interface DatabaseStats {
  total_peptides: number
  activities: Record<string, number>
  food_sources: Record<string, number>
}

// ─── 统计概览卡片 ──────────────────────────────────────────
interface StatsCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}

function StatsCard({ icon, label, value, color }: StatsCardProps) {
  return (
    <div className="card card-hover">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{value}</p>
            <p className="text-sm text-[var(--text-muted,#6B7280)] dark:text-[var(--text-muted-dark,#9CA3AF)] mt-0.5">{label}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 功能入口卡片 ──────────────────────────────────────────
interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  tab: FeatureTab
  color: string
  onClick: () => void
}

function FeatureCard({ icon, title, description, onClick, color }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-hover flex items-start gap-4 p-5 group w-full text-left"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color} group-hover:scale-105 transition-transform duration-200`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-muted,#6B7280)] dark:text-[var(--text-muted-dark,#9CA3AF)] mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight size={16} className="text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
    </button>
  )
}

// ─── 主页面组件 ────────────────────────────────────────────
export default function PeptideStructurePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialTab, setInitialTab] = useState<FeatureTab>('analyze')

  // 从 URL 读取初始 tab
  useEffect(() => {
    const tab = searchParams.get('tab') as FeatureTab | null
    if (tab && ['analyze', 'convert', 'database', 'compare', 'history', 'batch', 'deep', 'optimize', 'synergy'].includes(tab)) {
      setInitialTab(tab)
    }
  }, [searchParams])

  // 加载数据库统计
  useEffect(() => {
    peptideStructureService.getDatabaseStatistics()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const scrollToAnalyzer = () => {
    document.getElementById('peptide-analyzer')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleNavigateToTab = (tab: FeatureTab) => {
    setSearchParams({ tab })
    setTimeout(scrollToAnalyzer, 100)
  }

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* 欢迎横幅 — 参照 Dashboard 设计 */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900/20 flex items-center justify-center">
                  <Dna size={18} className="text-white" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/70">肽链结构分析工具</span>
              </div>
              <h2 className="text-xl font-semibold leading-snug tracking-tight">
                肽序列结构与活性预测分析
              </h2>
              <p className="mt-1 text-white/80 text-sm">
                基于 PepLink 的完整肽链分析平台 — 结构预测、活性评估、安全分析一体化
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                icon={<FlaskConical size={16} />}
                onClick={() => handleNavigateToTab('analyze')}
              >
                开始分析
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Database size={16} />}
                onClick={() => handleNavigateToTab('database')}
              >
                数据库查询
              </Button>
            </div>
          </div>
        </div>

        {/* 统计概览 — 参照 Dashboard 卡片样式 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              icon={<Database size={20} className="text-primary-600 dark:text-primary-400" />}
              label="数据库肽数"
              value={stats.total_peptides}
              color="bg-primary-50 dark:bg-primary-900/20"
            />
            <StatsCard
              icon={<Activity size={20} className="text-success-600 dark:text-success-400" />}
              label="活性类型"
              value={Object.keys(stats.activities).length}
              color="bg-success-50 dark:bg-success-900/20"
            />
            <StatsCard
              icon={<FlaskConical size={20} className="text-warning-600 dark:text-warning-400" />}
              label="食物来源"
              value={Object.keys(stats.food_sources).length}
              color="bg-warning-50 dark:bg-warning-900/20"
            />
            <StatsCard
              icon={<ShieldCheck size={20} className="text-purple-600 dark:text-purple-400" />}
              label="活跃序列"
              value={`${Object.keys(stats.activities).length}+`}
              color="bg-purple-50 dark:bg-purple-900/20"
            />
          </div>
        )}

        {/* 功能入口网格 — 快捷导航，每个卡片绑定独立的 tab */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">快捷功能</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<FlaskConical size={22} className="text-primary-600 dark:text-primary-400" />}
              title="序列分析"
              description="输入肽序列，分析分子量、等电点、疏水性及 ACE 抑制/抗氧化/抗菌活性评分"
              tab="analyze"
              color="bg-primary-50 dark:bg-primary-900/20"
              onClick={() => handleNavigateToTab('analyze')}
            />
            <FeatureCard
              icon={<Dna size={22} className="text-success-600 dark:text-success-400" />}
              title="序列转换"
              description="FASTA → SMILES → SELFIES 格式互转，支持 N/C 端修饰"
              tab="convert"
              color="bg-success-50 dark:bg-success-900/20"
              onClick={() => handleNavigateToTab('convert')}
            />
            <FeatureCard
              icon={<Database size={22} className="text-warning-600 dark:text-warning-400" />}
              title="数据库查询"
              description="搜索药食同源数据库中的活性肽，按来源、活性类型筛选"
              tab="database"
              color="bg-warning-50 dark:bg-warning-900/20"
              onClick={() => handleNavigateToTab('database')}
            />
            <FeatureCard
              icon={<Zap size={22} className="text-purple-600 dark:text-purple-400" />}
              title="协同效应分析"
              description="预测肽-药材协同作用，推荐最佳配伍组合，输出协同评分与机制"
              tab="synergy"
              color="bg-purple-50 dark:bg-purple-900/20"
              onClick={() => handleNavigateToTab('synergy')}
            />
            <FeatureCard
              icon={<TrendingUp size={22} className="text-cyan-600 dark:text-cyan-400" />}
              title="Pareto 优化"
              description="多目标优化候选序列，计算 Pareto 最优前沿，筛选综合评分最高的序列"
              tab="optimize"
              color="bg-cyan-50 dark:bg-cyan-900/20"
              onClick={() => handleNavigateToTab('optimize')}
            />
            <FeatureCard
              icon={<ShieldCheck size={22} className="text-rose-600 dark:text-rose-400" />}
              title="深度分析"
              description="二级结构预测（Chou-Fasman）、理化性质分析、食品安全评估、毒性预测"
              tab="deep"
              color="bg-rose-50 dark:bg-rose-900/20"
              onClick={() => handleNavigateToTab('deep')}
            />
          </div>
        </div>

        {/* 主分析器 — 懒加载，支持通过 URL 参数跳转到指定 tab */}
        <div id="peptide-analyzer" className="pt-2">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div className="text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                <p className="text-sm text-[var(--text-muted,#6B7280)] dark:text-[var(--text-muted-dark,#9CA3AF)]">加载分析工具...</p>
              </div>
            </div>
          }>
            <PeptideStructureAnalyzer initialTab={initialTab} />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
