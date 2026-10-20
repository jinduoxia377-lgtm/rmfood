/**
 * 组织订阅与用量面板（真实功能）
 * - 展示当前计划、订阅状态、用量进度条
 * - 升级（模拟支付）/ 取消订阅
 * - 超限时显示升级引导
 */
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, Button, Badge, Progress, useToast } from '@/components/ui'
import { Crown, Zap, Building2, RefreshCw } from 'lucide-react'
import api from '@/api/client'

export interface SubscriptionInfo {
  organization_id: number
  plan: string
  plan_display_name: string
  status: string
  billing_cycle: string
  started_at?: string | null
  expires_at?: string | null
  usage: Record<string, { used: number; limit: number; over: boolean }>
}

const PLAN_META: Record<string, { label: string; monthly: string; yearly: string; color: string }> = {
  free: { label: '免费版', monthly: '¥0', yearly: '¥0', color: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' },
  pro: { label: '专业版', monthly: '¥199/月', yearly: '¥1999/年', color: 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]' },
  enterprise: { label: '企业版', monthly: '¥1999/月起', yearly: '定制', color: 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]' },
}

const USAGE_LABELS: Record<string, string> = {
  members: '成员',
  teams: '团队',
  formulas: '配方',
  storage: '存储',
  api_calls: 'API 调用/天',
  ai_generations: 'AI 生成/天',
}

function formatLimit(used: number, limit: number, key: string): string {
  if (key === 'storage') {
    return `${(used / 1024 / 1024).toFixed(1)}MB / ${(limit / 1024 / 1024).toFixed(0)}GB`
  }
  if (limit < 0) return `${used} / 无限`
  return `${used} / ${limit}`
}

export const SubscriptionPanel: React.FC<{ organizationId: number }> = ({ organizationId }) => {
  const toast = useToast()
  const qc = useQueryClient()
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')

  const { data, isLoading } = useQuery<SubscriptionInfo>({
    queryKey: ['org-subscription', organizationId],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${organizationId}/subscription`)
      return data
    },
  })

  const upgradeMutation = useMutation({
    mutationFn: async (plan: string) => {
      const { data } = await api.post(`/organizations/${organizationId}/subscription/upgrade`, { plan, billing_cycle: billingCycle })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-subscription', organizationId] })
      qc.invalidateQueries({ queryKey: ['organizations'] })
      setConfirmUpgrade(null)
      toast.success('升级成功（模拟支付完成）')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || '升级失败，请重试')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/organizations/${organizationId}/subscription/cancel`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-subscription', organizationId] })
      toast.success('订阅已取消')
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || '取消失败，请重试')
    },
  })

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-[var(--space-apple-lg)] space-y-[var(--space-apple-sm)]">
          <div className="h-5 w-1/3 bg-[var(--border-color)] animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-[var(--border-color)] animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  const planMeta = PLAN_META[data.plan] || PLAN_META.free
  const overItems = Object.values(data.usage || {}).filter((u) => u.over)

  return (
    <Card>
      <CardContent className="p-[var(--space-apple-lg)] space-y-5">
        {/* 头部：当前计划 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-gradient-to-br from-primary-100 to-accent-50 dark:from-primary-900/40 dark:to-accent-900/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-[var(--color-primary-text)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">订阅与用量</h3>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                组织 #{organizationId} · {data.status === 'canceled' ? '已取消续费' : '订阅中'} · {data.billing_cycle === 'yearly' ? '年付' : '月付'}
              </p>
            </div>
          </div>
          <Badge variant={data.plan === 'enterprise' ? 'warning' : data.plan === 'pro' ? 'success' : 'secondary'}>
            {planMeta.label} {data.plan !== 'free' && `· ${data.billing_cycle === 'yearly' ? '年付' : '月付'}`}
          </Badge>
          <Link
            to={`/billing?org=${organizationId}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-Apple-sm)] text-xs font-medium text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/10 transition-colors shrink-0"
          >
            账单页
          </Link>
        </div>

        {/* 超限提醒 */}
        {overItems.length > 0 && (
          <div className="rounded-[var(--radius-Apple-md)] border border-[var(--color-warning-border)] dark:border-[var(--color-warning)] bg-[var(--color-warning-container)] p-[var(--space-apple-md)] flex items-start gap-[var(--space-apple-sm)]">
            <Zap className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
              <p className="font-semibold">当前计划已超限（{overItems.length} 项）</p>
              <p className="text-xs mt-0.5">升级到更高计划可解除限制并继续使用完整功能。</p>
            </div>
          </div>
        )}

        {/* 用量进度条 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(data.usage || {}).map(([key, item]) => {
            const label = USAGE_LABELS[key] || key
            const pct = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className={`font-medium tabular-nums ${item.over ? 'text-[var(--color-error-text)]' : 'text-[var(--text-primary)]'}`}>
                    {formatLimit(item.used, item.limit, key)}
                    {item.over && <span className="ml-1 text-xs">超限</span>}
                  </span>
                </div>
                <Progress
                  value={pct}
                  max={100}
                  variant={item.over ? 'danger' : 'success'}
                  size="sm"
                />
              </div>
            )
          })}
        </div>

        {/* 升级/取消 */}
        <div className="pt-3 border-t border-[var(--border-color)] dark:border-neutral-700 space-y-[var(--space-apple-sm)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">计费周期：</span>
            <Button size="sm" variant={billingCycle === 'yearly' ? 'default' : 'ghost'} onClick={() => setBillingCycle('yearly')}>年付（省 17%）</Button>
            <Button size="sm" variant={billingCycle === 'monthly' ? 'default' : 'ghost'} onClick={() => setBillingCycle('monthly')}>月付</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.plan !== 'pro' && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => setConfirmUpgrade('pro')}
                disabled={upgradeMutation.isPending}
              >
                <Crown className="w-4 h-4 mr-1" />
                升级专业版 {billingCycle === 'yearly' ? '¥1999/年' : '¥199/月'}
              </Button>
            )}
            {data.plan !== 'enterprise' && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => setConfirmUpgrade('enterprise')}
                disabled={upgradeMutation.isPending}
              >
                <Building2 className="w-4 h-4 mr-1" />
                升级企业版（联系定制）
              </Button>
            )}
            {data.plan !== 'free' && (
              <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                取消订阅
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['org-subscription', organizationId] })}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> 刷新
            </Button>
          </div>

          {confirmUpgrade && (
            <div className="rounded-[var(--radius-Apple-md)] border border-[var(--color-primary-border)] dark:border-[var(--color-primary)]/50 bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/10 p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
              <p className="text-sm font-medium text-neutral-800 dark:text-[var(--text-primary)]">
                确认升级到「{PLAN_META[confirmUpgrade]?.label}」（{billingCycle === 'yearly' ? '年付' : '月付'}）？
              </p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                当前为模拟支付：将生成一笔已支付订单并立即生效，不产生真实扣款。
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => upgradeMutation.mutate(confirmUpgrade)} disabled={upgradeMutation.isPending}>
                  {upgradeMutation.isPending ? '处理中...' : '确认升级（模拟支付）'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmUpgrade(null)}>取消</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}