/**
 * 集成与API管理页面 — v5.0 仪表盘风格重构版
 *
 * 设计改进：
 *   - 顶部主色横幅替代标题行，与 Dashboard 风格统一
 *   - 横排药丸 Tab 导航，桌面自动显示，移动端 overflow-x-auto
 *   - 宽卡片布局，去除紧凑限制，充分利用屏幕空间
 *   - 全页面间距宽松（space-y-6、card p-[var(--space-apple-lg)]、section gap-5）
 *   - 使用 Button/Card 组件统一样式
 *   - 对接真实后端 /api/v1/integrations/api-keys
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import {
  Plug, Webhook, Key, Plus, Copy, Trash2, ExternalLink,
  Slack, MessageCircle, Bell, RefreshCw, Check,
  CheckCircle2, Info,
} from 'lucide-react'
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { listAPIKeys, revokeAPIKey } from '@/api/integrations'
import ApiKeyCreateDialog from '@/components/integrations/ApiKeyCreateDialog'

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

const TABS: { id: 'api-keys' | 'webhooks' | 'third-party'; labelKey: string; icon: typeof Key }[] = [
  { id: 'api-keys',      labelKey: 'pages.integrations.tabApiKeys',   icon: Key   },
  { id: 'webhooks',      labelKey: 'pages.integrations.tabWebhooks',    icon: Webhook },
  { id: 'third-party',   labelKey: 'pages.integrations.tabThirdParty', icon: Plug  },
]

export default function IntegrationsPage() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks' | 'third-party'>('api-keys')
  const { addToast } = useToast()
  const qc = useQueryClient()

  // ─── Fetch API keys from backend ──────────────────────────────────
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ['integrations-api-keys'],
    queryFn: listAPIKeys,
    staleTime: 30_000,
  })

  const deleteKeyMutation = useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })
      addToast({ type: 'success', message: t('pages.integrations.keyDeleted') })
    },
  })

  // 创建密钥 Dialog（共享组件统一处理创建 + 一次性明文展示）
  const [createOpen, setCreateOpen] = useState(false)
  const refreshApiKeys = () => qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })

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
      name: t('pages.integrations.webhookNames.formulaPublished'),
      url: 'https://hooks.slack.com/services/T00...',
      events: ['formula.published'],
      successCount: 156,
      failureCount: 2,
    },
    {
      id: '2',
      name: t('pages.integrations.webhookNames.experimentCompleted'),
      url: 'https://api.example.com/webhook/experiment',
      events: ['experiment.completed'],
      successCount: 89,
      failureCount: 0,
    },
  ]

  const renderApiKeyRow = (key: APIKeyItem) => (
    <div key={key.id} className="p-5 rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-tertiary)]/30">
      <div className="flex items-start justify-between gap-4 mb-[var(--space-apple-sm)]">
        <div className="flex items-center gap-[var(--space-apple-sm)] min-w-0">
          <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]0/10 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{key.name}</span>
              <Badge variant="success" size="sm">{t('pages.integrations.active')}</Badge>
            </div>
            <code className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
              {key.prefix}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title={t('pages.integrations.copyKey')}
            onClick={() => { navigator.clipboard.writeText(key.prefix); addToast({ type: 'success', message: t('pages.integrations.keyCopied') }) }}>
            <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--text-muted)] hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-950/30" title={t('pages.integrations.deleteKey')}
            onClick={() => deleteKeyMutation.mutate(key.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] ml-13">
        <span>{t('pages.integrations.scopes', { scopes: key.scopes.join(', ') })}</span>
        <span>•</span>
        <span>{t('pages.integrations.created', { date: key.created })}</span>
        {key.lastUsed && (
          <>
            <span>•</span>
            <span>{t('pages.integrations.lastUsed', { time: new Date(key.lastUsed).toLocaleString(i18n.language) })}</span>
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
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-info-50 dark:bg-info-500/10 flex items-center justify-center shrink-0">
                <Webhook className="w-5 h-5 text-info-600 dark:text-info-700" />
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
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-apple-sm)]">
            <div className="flex flex-wrap gap-2">
              {wh.events.map(event => (
                <span key={event} className="px-2.5 py-1 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs text-[var(--text-secondary)] font-mono">
                  {event}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[var(--radius-pill)] bg-[var(--color-success-container)]0" />
                {t('pages.integrations.success', { count: wh.successCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-[var(--radius-pill)] bg-danger-500" />
                {t('pages.integrations.failed', { count: wh.failureCount })}
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
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className={cn('w-10 h-10 rounded-[var(--radius-Apple-md)] flex items-center justify-center shrink-0', service.color)}>
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
          <div className="flex items-center gap-2 p-[var(--space-apple-sm)] bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]0/10 rounded-[var(--radius-Apple-md)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]/20">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-success-text)] dark:text-[var(--color-success-text)] shrink-0" />
            <span className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">{t('pages.integrations.connected')}</span>
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
          {service.connected ? t('pages.integrations.connected') : t('pages.integrations.connectService')}
        </Button>
      </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] animate-page-enter">

      {/* 顶部横幅 */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-snug">{t('pages.integrations.title')}</h1>
            <p className="mt-1 text-white/90 text-sm">{t('pages.integrations.subtitle')}</p>
          </div>
          <div className="flex items-center gap-[var(--space-apple-sm)] w-full sm:w-auto">
            <Button
              variant="secondary" size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => qc.invalidateQueries({ queryKey: ['integrations-api-keys'] })}
              disabled={keysLoading}
            >
              {t('pages.integrations.refreshKeys')}
            </Button>
            <Button
              variant="glass" size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateOpen(true)}
              disabled={false}
            >
              {t('pages.integrations.newApiKey')}
            </Button>
          </div>
        </div>
      </div>

      {/* 横向药丸 Tab */}
      <div className="overflow-x-auto pb-1 -mx-4 px-[var(--space-apple-md)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="inline-flex items-center gap-1 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-md)] p-1 min-w-max">
          {TABS.map(({ id, labelKey, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 px-[var(--space-apple-md)] py-2 min-h-[44px] rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]/60 dark:hover:bg-[var(--bg-secondary)]/50',
                )}
                aria-current={active ? 'true' : undefined}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-[var(--color-primary-text)]' : 'text-[var(--text-muted)]')} />
                {t(labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* API 密钥 */}
      {activeTab === 'api-keys' && (
        <div className="space-y-[var(--space-apple-md)]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]0/10 flex items-center justify-center shrink-0">
                    <Key className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  </div>
                  <div>
                    <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.integrations.apiKeysTitle')}</CardTitle>
                    <CardDescription>{t('pages.integrations.apiKeysDesc')}</CardDescription>
                  </div>
                </div>
                <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}
                  onClick={() => setCreateOpen(true)}
                  disabled={false}
                >
                  {t('pages.integrations.createNewKey')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-[var(--space-apple-sm)]">
              {apiKeys.map(renderApiKeyRow)}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-[var(--text-muted)]">
                <Info className="w-3.5 h-3.5 inline mr-1.5" />
                {t('pages.integrations.keySecurityHint')}
              </p>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* 创建密钥 Dialog（共享组件统一处理创建 + 一次性明文展示） */}
      <ApiKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshApiKeys}
      />

      {/* Webhook */}
      {activeTab === 'webhooks' && (
        <div className="space-y-[var(--space-apple-md)]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-info-50 dark:bg-info-500/10 flex items-center justify-center shrink-0">
                    <Webhook className="w-5 h-5 text-info-600 dark:text-info-700" />
                  </div>
                  <div>
                    <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.integrations.webhookConfig')}</CardTitle>
                    <CardDescription>{t('pages.integrations.webhookDesc')}</CardDescription>
                  </div>
                </div>
                <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
                  {t('pages.integrations.createWebhook')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-[var(--space-apple-sm)]">
                {webhooks.map(renderWebhookCard)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 第三方集成 */}
      {activeTab === 'third-party' && (
        <div className="space-y-[var(--space-apple-md)]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-[var(--space-apple-sm)]">
                <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]0/10 flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                </div>
                <div>
                  <CardTitle as="h2" className="text-base font-semibold tracking-tight">{t('pages.integrations.thirdPartyTitle')}</CardTitle>
                  <CardDescription>{t('pages.integrations.thirdPartyDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: t('pages.integrations.thirdPartyNames.slack'),        icon: Slack,        desc: t('pages.integrations.thirdPartyDescs.slack'), color: 'bg-[var(--color-accent)]', connected: true  },
                  { name: t('pages.integrations.thirdPartyNames.dingtalk'),         icon: MessageCircle, desc: t('pages.integrations.thirdPartyDescs.dingtalk'),   color: 'bg-info-600', connected: false },
                  { name: t('pages.integrations.thirdPartyNames.feishu'),         icon: Bell,         desc: t('pages.integrations.thirdPartyDescs.feishu'),     color: 'bg-[var(--color-secondary)]', connected: false },
                  { name: t('pages.integrations.thirdPartyNames.wecom'),     icon: ExternalLink, desc: t('pages.integrations.thirdPartyDescs.wecom'),       color: 'bg-[var(--color-success)]', connected: false },
                ].map(service => renderThirdPartyCard(service))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
