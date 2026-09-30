/**
 * 集成与API管理页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard 风格统一
 *   - 横排药丸 Tab 导航，桌面自动显示，移动端 overflow-x-auto
 *   - 宽卡片布局，去除紧凑限制，充分利用屏幕空间
 *   - 全页面间距宽松（space-y-6、card p-6、section gap-5）
 *   - 使用 Button/Card 组件统一样式
 *   - 对接真实后端 /api/v1/integrations/api-keys
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  Plug, Webhook, Key, Plus, Copy, Trash2, ExternalLink,
  Slack, MessageCircle, Bell, RefreshCw, Check, AlertCircle,
  CheckCircle2, Info,
} from 'lucide-react'
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { listAPIKeys, createAPIKey, revokeAPIKey } from '@/api/integrations'

interface APIKeyItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsed: string | null
  created: string
}

interface WebhookItem {
  id: string
  name: string
  url: string
  events: string[]
  successCount: number
  failureCount: number
}

const TABS: { id: 'api-keys' | 'webhooks' | 'third-party'; label: string; icon: typeof Key }[] = [
  { id: 'api-keys',      label: 'API 密钥',   icon: Key   },
  { id: 'webhooks',      label: 'Webhook',    icon: Webhook },
  { id: 'third-party',   label: '第三方集成', icon: Plug  },
]

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks' | 'third-party'>('api-keys')
  const { addToast } = useToast()
  const qc = useQueryClient()

  // ─── Fetch API keys from backend ──────────────────────────────────
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ['integrations-api-keys'],
    queryFn: listAPIKeys,
    staleTime: 30_000,
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => createAPIKey({ name, scopes: ['read'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })
      addToast({ type: 'success', message: 'API 密钥已创建' })
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })
      addToast({ type: 'success', message: 'API 密钥已删除' })
    },
  })

  // Normalize backend data to UI model
  const apiKeys: APIKeyItem[] = (apiKeysData?.keys ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
    scopes: k.scopes,
    lastUsed: k.last_used_at,
    created: k.created_at ? new Date(k.created_at).toISOString().slice(0, 10) : '—',
  }))

  const webhooks: WebhookItem[] = [
    {
      id: '1',
      name: '配方发布通知',
      url: 'https://hooks.slack.com/services/T00...',
      events: ['formula.published'],
      successCount: 156,
      failureCount: 2,
    },
    {
      id: '2',
      name: '实验完成回调',
      url: 'https://api.example.com/webhook/experiment',
      events: ['experiment.completed'],
      successCount: 89,
      failureCount: 0,
    },
  ]

  const renderApiKeyRow = (key: APIKeyItem) => (
    <div key={key.id} className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/30">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{key.name}</span>
              <Badge variant="success" size="sm">活跃</Badge>
            </div>
            <code className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
              {key.prefix}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="复制密钥"
            onClick={() => { navigator.clipboard.writeText(key.prefix); addToast({ type: 'success', message: '密钥已复制到剪贴板' }) }}>
            <Copy className="w-4 h-4 text-neutral-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="删除密钥"
            onClick={() => deleteKeyMutation.mutate(key.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 ml-13">
        <span>权限: <span className="text-neutral-700 dark:text-neutral-300">{key.scopes.join(', ')}</span></span>
        <span>•</span>
        <span>创建: {key.created}</span>
        {key.lastUsed && (
          <>
            <span>•</span>
            <span>最后使用: {new Date(key.lastUsed).toLocaleString('zh-CN')}</span>
          </>
        )}
      </div>
    </div>
  )

  const renderWebhookCard = (wh: WebhookItem) => {
    const rate = wh.successCount + wh.failureCount > 0
      ? Math.round(wh.successCount / (wh.successCount + wh.failureCount) * 100)
      : 100
    return (
      <Card key={wh.id}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
                <Webhook className="w-5 h-5 text-sky-600 dark:text-sky-500" />
              </div>
              <div>
                <CardTitle as="h3" className="text-sm font-semibold tracking-tight">{wh.name}</CardTitle>
                <CardDescription className="font-mono text-xs mt-0.5 truncate max-w-xs">{wh.url}</CardDescription>
              </div>
            </div>
            <Badge variant={wh.failureCount === 0 ? 'success' : 'warning'} size="sm">
              <Check className="w-3 h-3 mr-1" />{rate}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {wh.events.map(event => (
                <span key={event} className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 font-mono">
                  {event}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                成功 {wh.successCount}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                失败 {wh.failureCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderThirdPartyCard = (service: { name: string; icon: typeof Slack; desc: string; color: string; connected: boolean }) => (
    <Card key={service.name} className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', service.color)}>
            <service.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle as="h3" className="text-sm font-semibold tracking-tight">{service.name}</CardTitle>
            <CardDescription>{service.desc}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {service.connected && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-400">已连接</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant={service.connected ? 'outline' : 'primary'}
          size="sm"
          fullWidth
          icon={service.connected ? undefined : <Plug className="w-4 h-4" />}
          onClick={() => { /* connect handler */ }}
        >
          {service.connected ? '已连接' : '连接服务'}
        </Button>
      </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-page-enter">

      {/* 顶部横幅 */}
      <div className="surface-primary rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">集成与 API</h1>
            <p className="mt-1 text-white/90 text-sm">管理 API 密钥、Webhook 和第三方服务集成</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary" size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })}
              disabled={keysLoading}
            >
              刷新密钥列表
            </Button>
            <Button
              variant="glass" size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                const name = prompt('请输入密钥名称：')
                if (name?.trim()) createKeyMutation.mutate(name.trim())
              }}
              disabled={createKeyMutation.isPending}
            >
              新建 API 密钥
            </Button>
          </div>
        </div>
      </div>

      {/* 横向药丸 Tab */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl p-1 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/50',
                )}
                aria-current={active ? 'true' : undefined}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500')} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* API 密钥 */}
      {activeTab === 'api-keys' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Key className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div>
                    <CardTitle as="h2" className="text-base font-semibold tracking-tight">API 密钥</CardTitle>
                    <CardDescription>管理用于程序化访问系统的凭证</CardDescription>
                  </div>
                </div>
                <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    const name = prompt('请输入密钥名称：')
                    if (name?.trim()) createKeyMutation.mutate(name.trim())
                  }}
                  disabled={createKeyMutation.isPending}
                >
                  创建新密钥
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {apiKeys.map(renderApiKeyRow)}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                <Info className="w-3.5 h-3.5 inline mr-1.5" />
                密钥仅在创建时完整展示一次，请妥善保存。建议定期轮换密钥以提升安全性。
              </p>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Webhook */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Webhook className="w-5 h-5 text-sky-600 dark:text-sky-500" />
                  </div>
                  <div>
                    <CardTitle as="h2" className="text-base font-semibold tracking-tight">Webhook 配置</CardTitle>
                    <CardDescription>接收系统事件推送的回调地址管理</CardDescription>
                  </div>
                </div>
                <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
                  创建 Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {webhooks.map(renderWebhookCard)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 第三方集成 */}
      {activeTab === 'third-party' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-violet-600 dark:text-violet-500" />
                </div>
                <div>
                  <CardTitle as="h2" className="text-base font-semibold tracking-tight">第三方服务集成</CardTitle>
                  <CardDescription>连接常用协作工具与通讯平台</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Slack',        icon: Slack,        desc: '消息通知与团队协作', color: 'bg-violet-600', connected: true  },
                  { name: '钉钉',         icon: MessageCircle, desc: '阿里工作通知推送',   color: 'bg-cyan-600', connected: false },
                  { name: '飞书',         icon: Bell,         desc: '文档与通讯集成',     color: 'bg-blue-600', connected: false },
                  { name: '企业微信',     icon: ExternalLink, desc: '企业通讯工具',       color: 'bg-emerald-600', connected: false },
                ].map(service => renderThirdPartyCard(service))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
