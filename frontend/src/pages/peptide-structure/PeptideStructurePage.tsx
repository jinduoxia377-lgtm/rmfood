/**
 * 肽链结构分析页面
 * 参照 Dashboard 设计规范：Apple 风格卡片系统 + 品牌色横幅 + 统一排版
 * 每个快捷功能卡片点击后，通过 useNavigate 跳转到对应 tab
 */
import { useState, useEffect } from 'react'
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
          <div className={`w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{value}</p>
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
      <div className={`w-12 h-12 rounded-[var(--radius-Apple-md)] flex items-center justify-center shrink-0 ${color} group-hover:scale-105 transition-transform duration-200`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors">
          {title}
        </h2>
        <p className="text-xs text-[var(--text-muted,#6B7280)] dark:text-[var(--text-muted-dark,#9CA3AF)] mt-1 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
    </button>
  )
}

// ─── 主页面组件 ────────────────────────────────────────────
export default function PeptideStructurePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [, setLoading] = useState(true)
  const [initialTab, setInitialTab] = useState<FeatureTab>('analyze')

  // 从 URL 读取初始 tab
  useEffect(() => {
    const tab = searchParams.get('tab') as FeatureTab | null
    if (tab && ['analyze', 'convert', 'database', 'compare', 'history', 'batch', 'deep', 'optimize', 'synergy'].includes(tab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="min-h-screen">
      <div className="space-y-6 max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)]">

        {/* 欢迎横幅 — 参照 Dashboard 设计 */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-[var(--radius-Apple-sm)] bg-[var(--bg-secondary)]/20 flex items-center justify-center">
                  <Dna size={18} className="text-white" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/70">{t('pages.peptide.toolBadge')}</span>
              </div>
              <h1 className="text-xl font-semibold leading-snug tracking-tight">
                {t('pages.peptide.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm">
                {t('pages.peptide.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                icon={<FlaskConical size={16} />}
                onClick={() => handleNavigateToTab('analyze')}
              >
                {t('pages.peptide.startAnalyze')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Database size={16} />}
                onClick={() => handleNavigateToTab('database')}
              >
                {t('pages.peptide.databaseQuery')}
              </Button>
            </div>
          </div>
        </div>

        {/* 统计概览 — 参照 Dashboard 卡片样式 */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              icon={<Database size={20} className="text-[var(--color-primary-text)]" />}
              label={t('pages.peptide.statsPeptides')}
              value={stats.total_peptides}
              color="bg-[var(--color-primary-container)]"
            />
            <StatsCard
              icon={<Activity size={20} className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />}
              label={t('pages.peptide.statsActivities')}
              value={Object.keys(stats.activities).length}
              color="bg-[var(--color-success-container)]"
            />
            <StatsCard
              icon={<FlaskConical size={20} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />}
              label={t('pages.peptide.statsFoodSources')}
              value={Object.keys(stats.food_sources).length}
              color="bg-[var(--color-warning-container)]"
            />
            <StatsCard
              icon={<ShieldCheck size={20} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />}
              label={t('pages.peptide.statsActiveSequences')}
              value={`${Object.keys(stats.activities).length}+`}
              color="bg-[var(--color-accent-container)]"
            />
          </div>
        )}

        {/* 功能入口网格 — 快捷导航，每个卡片绑定独立的 tab */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-[var(--space-apple-sm)]">{t('pages.peptide.quickFunctions')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<FlaskConical size={22} className="text-[var(--color-primary-text)]" />}
              title={t('pages.peptide.featureAnalyze')}
              description={t('pages.peptide.featureAnalyzeDesc')}
              tab="analyze"
              color="bg-[var(--color-primary-container)]"
              onClick={() => handleNavigateToTab('analyze')}
            />
            <FeatureCard
              icon={<Dna size={22} className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />}
              title={t('pages.peptide.featureConvert')}
              description={t('pages.peptide.featureConvertDesc')}
              tab="convert"
              color="bg-[var(--color-success-container)]"
              onClick={() => handleNavigateToTab('convert')}
            />
            <FeatureCard
              icon={<Database size={22} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />}
              title={t('pages.peptide.featureDatabase')}
              description={t('pages.peptide.featureDatabaseDesc')}
              tab="database"
              color="bg-[var(--color-warning-container)]"
              onClick={() => handleNavigateToTab('database')}
            />
            <FeatureCard
              icon={<Zap size={22} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />}
              title={t('pages.peptide.featureSynergy')}
              description={t('pages.peptide.featureSynergyDesc')}
              tab="synergy"
              color="bg-[var(--color-accent-container)]"
              onClick={() => handleNavigateToTab('synergy')}
            />
            <FeatureCard
              icon={<TrendingUp size={22} className="text-info-600 dark:text-info-700" />}
              title={t('pages.peptide.featureOptimize')}
              description={t('pages.peptide.featureOptimizeDesc')}
              tab="optimize"
              color="bg-info-50 dark:bg-info-300/20"
              onClick={() => handleNavigateToTab('optimize')}
            />
            <FeatureCard
              icon={<ShieldCheck size={22} className="text-danger-600 dark:text-danger-700" />}
              title={t('pages.peptide.featureDeep')}
              description={t('pages.peptide.featureDeepDesc')}
              tab="deep"
              color="bg-danger-50 dark:bg-danger-300/20"
              onClick={() => handleNavigateToTab('deep')}
            />
          </div>
        </div>

        {/* 主分析器 — 懒加载，支持通过 URL 参数跳转到指定 tab */}
        <div id="peptide-analyzer" className="pt-2">
          <Suspense fallback={
            <div className="flex items-center justify-center py-20 rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <div className="text-center space-y-[var(--space-apple-sm)]">
                <div className="inline-block animate-spin rounded-[var(--radius-pill)] h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent" />
                <p className="text-sm text-[var(--text-muted,#6B7280)] dark:text-[var(--text-muted-dark,#9CA3AF)]">{t('pages.peptide.loadingTool')}</p>
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
