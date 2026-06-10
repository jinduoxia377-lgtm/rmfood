import { memo } from 'react'
import {
  Plug,
  ShieldCheck,
  Webhook,
  KeyRound,
  Puzzle,
  Clock,
  Bell,
  MessageSquare,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrationsTabProps {
  organizationId: number
}

interface IntegrationCard {
  id: string
  title: string
  description: string
  icon: typeof Plug
  status: 'coming-soon' | 'available' | 'beta'
  category: string
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'sso',
    title: 'SSO 单点登录',
    description: '配置 OIDC / SAML 企业级身份认证，统一管理组织成员登录',
    icon: ShieldCheck,
    status: 'coming-soon',
    category: '安全认证',
  },
  {
    id: 'webhook',
    title: 'Webhook 管理',
    description: '设置事件驱动的回调通知，与外部系统实时同步数据',
    icon: Webhook,
    status: 'coming-soon',
    category: '自动化',
  },
  {
    id: 'api-keys',
    title: 'API 密钥管理',
    description: '生成、撤销和管理 API 访问密钥，控制权限范围和使用配额',
    icon: KeyRound,
    status: 'beta',
    category: '开发者工具',
  },
  {
    id: 'slack',
    title: 'Slack 集成',
    description: '将配方更新和团队活动推送到 Slack 频道，保持团队协作同步',
    icon: MessageSquare,
    status: 'coming-soon',
    category: '团队协作',
  },
  {
    id: 'teams',
    title: 'Microsoft Teams',
    description: '在 Teams 中接收通知并快速访问配方数据和实验结果',
    icon: Layers,
    status: 'coming-soon',
    category: '团队协作',
  },
  {
    id: 'jira',
    title: 'Jira 连接',
    description: '将配方开发任务与 Jira 项目关联，实现研发流程一体化管理',
    icon: Puzzle,
    status: 'coming-soon',
    category: '项目管理',
  },
]

const STATUS_BADGE: Record<IntegrationCard['status'], { label: string; className: string }> = {
  'coming-soon': { label: '即将推出', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  available: { label: '可用', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  beta: { label: 'Beta', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

const IntegrationsTab = memo(({ organizationId }: IntegrationsTabProps) => {
  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))]

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">集成配置</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          连接第三方服务以扩展组织功能
        </p>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Plug className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">集成中心</h3>
            <p className="text-sm text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
              通过集成外部服务，您可以将 RMFOOD 配方平台与现有工作流无缝连接。
              目前部分集成正在开发中，敬请期待。
            </p>
          </div>
        </div>
      </div>

      {/* Integration Cards by Category */}
      {categories.map((category) => (
        <section key={category} aria-label={category}>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATIONS
              .filter((integration) => integration.category === category)
              .map((integration) => {
                const Icon = integration.icon
                const badge = STATUS_BADGE[integration.status]
                const isDisabled = integration.status === 'coming-soon'

                return (
                  <div
                    key={integration.id}
                    className={cn(
                      'group relative rounded-xl border p-5 transition-all',
                      isDisabled
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-80'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md cursor-pointer',
                    )}
                  >
                    {/* Status Badge */}
                    <span className={cn('absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-medium', badge.className)}>
                      {badge.label}
                    </span>

                    {/* Icon */}
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors',
                        isDisabled
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                          : 'bg-blue-50 dark:bg-blue-900/30 text-blue-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50',
                      )}
                    >
                      <Icon className="w-5.5 h-5.5" />
                    </div>

                    {/* Content */}
                    <h4 className={cn(
                      'font-semibold pr-16',
                      isDisabled ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white',
                    )}>
                      {integration.title}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                      {integration.description}
                    </p>

                    {/* Action */}
                    {!isDisabled && (
                      <button className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        {integration.status === 'available' ? '配置' : '申请体验'}
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isDisabled && (
                      <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        开发中...
                      </div>
                    )}

                    {/* Disabled Overlay */}
                    {isDisabled && (
                      <div className="absolute inset-0 rounded-xl pointer-events-none" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      ))}

      {/* Footer CTA */}
      <div className="text-center pt-4 pb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          需要特定的集成方案？{' '}
          <a href="#" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            联系我们
          </a>{' '}
          定制开发
        </p>
      </div>
    </div>
  )
})

export default IntegrationsTab
