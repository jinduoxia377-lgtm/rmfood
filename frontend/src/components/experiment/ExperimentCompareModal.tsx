/**
 * 实验数据对比弹窗
 */
import { useState } from 'react'
import { X, FlaskConical, BarChart3, TrendingUp } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { StatusBadge } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Experiment } from '@/types'

interface Props {
  experiments: Experiment[]
  onClose: () => void
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899']

export default function ExperimentCompareModal({ experiments, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'params' | 'data'>('params')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"  role="button" tabIndex={0} onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <BarChart3 size={16} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">实验数据对比</h2>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{experiments.length} 个实验</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onClose}>关闭</Button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('params')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'params'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            )}
          >
            参数对比
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'data'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
            )}
          >
            数据趋势
          </button>
        </div>

        <CardContent className="p-6">
          {activeTab === 'params' ? (
            <ParamComparison experiments={experiments} />
          ) : (
            <DataComparison experiments={experiments} />
          )}
        </CardContent>
      </div>
    </div>
  )
}

function ParamComparison({ experiments }: { experiments: Experiment[] }) {
  // Collect all unique parameter keys
  const allParams = new Set<string>()
  for (const exp of experiments) {
    const params = exp.parameters || {}
    if (typeof params === 'object') {
      Object.keys(params).forEach(k => allParams.add(k))
    }
  }

  if (allParams.size === 0) {
    return <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无参数数据可对比</div>
  }

  const paramLabels: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    ph: 'pH值',
    time: '时间',
    concentration: '浓度',
    sample_size: '样本量',
    duration: '周期',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            <th className="text-left py-3 px-4 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-32">参数</th>
            {experiments.map((exp, i) => (
              <th key={exp.id} className="text-left py-3 px-4 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="max-w-[150px] truncate">{exp.title}</span>
                </div>
                <StatusBadge status={exp.status} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(allParams).map((param) => (
            <tr key={param} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
              <td className="py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                {paramLabels[param] || param}
              </td>
              {experiments.map((exp, i) => {
                const params = exp.parameters || {}
                const value = (params as Record<string, unknown>)[param] as string | number | undefined
                return (
                  <td key={exp.id} className="py-3 px-4 text-neutral-600 dark:text-neutral-400 font-mono">
                    {value ?? '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataComparison({ experiments }: { experiments: Experiment[] }) {
  // Collect all data points
  const allDataPoints: Record<number, any[]> = {}
  const allParams = new Set<string>()

  for (const exp of experiments) {
    const data = (exp as { data_points?: unknown[] }).data_points || []
    allDataPoints[exp.id] = data
    data.forEach((d: any) => {
      if (d.parameter) allParams.add(d.parameter)
    })
  }

  if (allParams.size === 0) {
    return <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无数据点可对比</div>
  }

  return (
    <div className="space-y-6">
      {/* Parameter selector */}
      <div className="flex flex-wrap gap-2">
        {Array.from(allParams).map((param) => (
          <span key={param} className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            {param}
          </span>
        ))}
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">参数</th>
              {experiments.map((exp, i) => (
                <th key={exp.id} className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {exp.code}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(allParams).map((param) => (
              <tr key={param} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-2 px-3 font-medium text-neutral-700 dark:text-neutral-300">{param}</td>
                {experiments.map((exp) => {
                  const dps = allDataPoints[exp.id] || []
                  const matching = dps.filter((d: any) => d.parameter === param)
                  return (
                    <td key={exp.id} className="py-2 px-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-mono text-xs">
                      {matching.map((d: any, idx: number) => (
                        <div key={idx}>{d.value ?? '-'} {d.unit ?? ''}</div>
                      )) || '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
