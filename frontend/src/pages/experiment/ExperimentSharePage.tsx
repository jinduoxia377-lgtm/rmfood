/**
 * 实验分享页 - 公开只读
 */
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft, FlaskConical, Calendar, Target, FileText,
  BarChart3, Table, CheckCircle2, XCircle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/Common'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchSharedExperiment(shareId: string) {
  const res = await fetch(`${API_BASE}/experiments/share/${shareId}`)
  if (!res.ok) throw new Error('Not found')
  return res.json()
}

export default function ExperimentSharePage() {
  const { share_id } = useParams<{ share_id: string }>()
  const [dataView, setDataView] = useState<'table' | 'chart'>('table')

  const { data: exp, isLoading, error } = useQuery({
    queryKey: ['shared-experiment', share_id],
    queryFn: () => fetchSharedExperiment(share_id!),
    enabled: !!share_id,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !exp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <XCircle size={48} className="mx-auto text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3" />
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">实验不存在</h1>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-4">该实验可能已被删除或分享已取消。</p>
          <Link to="/experiments">
            <Button variant="secondary" size="sm">返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  const dataPoints = (exp.data_points || [])
  const hasNumericData = dataPoints.some((d: any) => d.value !== null && !isNaN(Number(d.value)))

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/experiments" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
            <ArrowLeft size={16} />
            返回首页
          </Link>
          <Badge variant="info" size="sm">公开分享</Badge>
        </div>

        {/* 基本信息 */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">{exp.title}</h1>
              {exp.status && <StatusBadge status={exp.status} />}
            </div>
            <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-3">{exp.code} · 创建于 {exp.created_at ? format(new Date(exp.created_at), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</p>
            {exp.description && <p className="text-sm text-neutral-600 leading-relaxed">{exp.description}</p>}
          </CardContent>
        </Card>

        {/* 目标和内容 */}
        {(exp.objectives?.length || exp.methodology) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exp.objectives && exp.objectives.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <Target size={16} className="text-primary-500" />
                    </div>
                    <CardTitle as="h2">实验目标</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {exp.objectives.map((obj: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {exp.methodology && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <FileText size={16} className="text-primary-500" />
                    </div>
                    <CardTitle as="h2">实验方法</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">{exp.methodology}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 数据 */}
        {dataPoints.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <BarChart3 size={16} className="text-primary-500" />
                  </div>
                  <div>
                    <CardTitle as="h2">实验数据</CardTitle>
                    <CardDescription>{dataPoints.length} 条数据</CardDescription>
                  </div>
                </div>
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                  <button onClick={() => setDataView('table')} className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', dataView === 'table' ? 'surface-card text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500')}>数据表</button>
                  <button onClick={() => setDataView('chart')} className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', dataView === 'chart' ? 'surface-card text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500')}>图表</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dataView === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">参数</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">数值</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">单位</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">备注</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataPoints.map((d: any) => (
                        <tr key={d.id} className="border-b border-neutral-100 hover:bg-neutral-50 dark:bg-neutral-800/50 transition-colors">
                          <td className="py-2 px-3 font-medium text-neutral-900 dark:text-white">{d.parameter}</td>
                          <td className="py-2 px-3 text-neutral-700 font-mono">{d.value ?? '-'}</td>
                          <td className="py-2 px-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{d.unit ?? '-'}</td>
                          <td className="py-2 px-3 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] max-w-[200px] truncate">{d.notes ?? '-'}</td>
                          <td className="py-2 px-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{d.recorded_at ? format(new Date(d.recorded_at), 'MM-dd HH:mm', { locale: zhCN }) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasNumericData ? (
                <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">图表功能即将推出</div>
              ) : (
                <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无数值型数据</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 结论 */}
        {(exp.conclusions || exp.recommendations) && (
          <Card>
            <CardHeader>
              <CardTitle as="h2">结论与建议</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exp.conclusions && (
                <div>
                  <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">实验结论</h4>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">{exp.conclusions}</p>
                </div>
              )}
              {exp.recommendations && (
                <div>
                  <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">改进建议</h4>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">{exp.recommendations}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] py-4">
          通过 RMFOOD 实验平台分享 · {exp.code}
        </div>
      </div>
    </div>
  )
}
