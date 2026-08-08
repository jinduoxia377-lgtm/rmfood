/**
 * 集成与API管理页面 - SSS企业级
 */
import { useState } from 'react'
import {
  Plug, Webhook, Key, Plus, Copy, Trash2, ExternalLink,
  Slack, MessageCircle, Bell, RefreshCw, Check, AlertCircle,
} from 'lucide-react'

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

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks' | 'third-party'>('api-keys')

  const apiKeys: APIKeyItem[] = [
    {
      id: '1',
      name: '生产环境密钥',
      prefix: 'rmf_a1b2c3...',
      scopes: ['read', 'write', 'ai:generate'],
      lastUsed: '2026-05-02T08:30:00Z',
      created: '2026-03-15',
    },
    {
      id: '2',
      name: '测试环境密钥',
      prefix: 'rmf_d4e5f6...',
      scopes: ['read'],
      lastUsed: null,
      created: '2026-04-20',
    },
  ]

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h1 text-neutral-900 dark:text-white flex items-center gap-2">
            <Plug className="w-7 h-7 text-success-500" />
            集成与API
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            管理API密钥、Webhook和第三方服务集成
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 w-fit">
        {[
          { key: 'api-keys' as const, label: 'API 密钥', icon: Key },
          { key: 'webhooks' as const, label: 'Webhook', icon: Webhook },
          { key: 'third-party' as const, label: '第三方集成', icon: Plug },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-neutral-700 shadow-sm font-medium'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'api-keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">API 密钥</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors text-sm">
              <Plus className="w-4 h-4" />
              创建新密钥
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Key className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-medium text-neutral-900 dark:text-white">{key.name}</h3>
                    <code className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">
                      {key.prefix}
                    </code>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 ml-8">
                    <span>权限: {key.scopes.join(', ')}</span>
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

                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                    <Copy className="w-4 h-4 text-neutral-500" />
                  </button>
                  <button className="p-2 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-error-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Webhook 配置</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors text-sm">
              <Plus className="w-4 h-4" />
              创建 Webhook
            </button>
          </div>

          <div className="grid gap-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="bg-white dark:bg-neutral-900 rounded-xl p-5 border border-neutral-200 dark:border-neutral-800"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Webhook className="w-5 h-5 text-secondary-500" />
                    <h3 className="font-medium text-neutral-900 dark:text-white">{wh.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      wh.failureCount === 0 ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'
                    }`}>
                      {wh.failureCount === 0 ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      成功率: {Math.round(wh.successCount / (wh.successCount + wh.failureCount) * 100)}%
                    </span>
                  </div>
                </div>

                <p className="text-sm text-neutral-500 font-mono mb-3 truncate">{wh.url}</p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {wh.events.map((event) => (
                      <span key={event} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">
                        {event}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>✓ {wh.successCount}</span>
                    <span>✗ {wh.failureCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'third-party' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">第三方服务集成</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Slack', icon: Slack, desc: '消息通知与协作', color: 'bg-accent-500', connected: true },
              { name: '钉钉', icon: MessageCircle, desc: '工作通知推送', color: 'bg-secondary-500', connected: false },
              { name: '飞书', icon: Bell, desc: '文档与通讯集成', color: 'bg-cyan-500', connected: false },
              { name: '企业微信', icon: ExternalLink, desc: '企业通讯工具', color: 'bg-success-500', connected: false },
            ].map((service) => (
              <div
                key={service.name}
                className="bg-white dark:bg-neutral-900 rounded-xl p-5 border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center`}>
                    <service.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-neutral-900 dark:text-white">{service.name}</h3>
                    <p className="text-xs text-neutral-500">{service.desc}</p>
                  </div>
                </div>

                <button
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    service.connected
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      : 'bg-secondary-600 text-white hover:bg-secondary-700'
                  }`}
                >
                  {service.connected ? '已连接' : '连接'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
