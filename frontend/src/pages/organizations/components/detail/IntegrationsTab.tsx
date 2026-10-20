import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plug,
  ShieldCheck,
  Webhook,
  KeyRound,
  Puzzle,
  Bell,
  MessageSquare,
  Layers,
  ArrowRight,
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
    status: 'available',
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
  'coming-soon': { label: '即将推出', className: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-muted)]' },
  available: { label: '可用', className: 'bg-[var(--color-success-container)] text-[var(--color-success-text)] dark:bg-[var(--color-success-container)]/25 dark:text-[var(--color-success-text)]' },
  beta: { label: 'Beta', className: 'bg-[var(--color-accent-container)] text-[var(--color-accent-text)] dark:bg-[var(--color-accent-container)]/25 dark:text-[var(--color-accent-text)]' },
}

const IntegrationsTab = memo(({ organizationId }: IntegrationsTabProps) => {
  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))]
  const navigate = useNavigate()

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">集成配置</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          连接第三方服务以扩展组织功能
        </p>
      </div>

      {/* Info Banner */}
      <div className="rounded-[var(--radius-Apple-md)] bg-gradient-to-r from-secondary-50 to-accent-50 dark:from-secondary-900/20 dark:to-accent-900/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/30 flex items-center justify-center shrink-0">
            <Plug className="w-5 h-5 text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] mb-1">集成中心</h3>
            <p className="text-sm text-[var(--color-secondary-text)]/80 dark:text-[var(--color-secondary-text)]/80 leading-relaxed">
              通过集成外部服务，您可以将 RMFOOD 配方平台与现有工作流无缝连接。
              API 密钥管理等集成已可用，更多企业级集成（SSO / Webhook / 协作平台）即将推出，升级企业版可优先体验。
            </p>
          </div>
        </div>
      </div>

      {/* Integration Cards by Category */}
      {categories.map((category) => (
        <section key={category} aria-label={category}>
          <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-sm)] flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {INTEGRATIONS
              .filter((integration) => integration.category === category)
              .map((integration) => {
                const Icon = integration.icon
                const badge = STATUS_BADGE[integration.status]
                const isDisabled = integration.status === 'coming-soon'

                return (
                  <div
                    key={integration.id}
                    onClick={isDisabled ? () => navigate(`/organizations?org=${organizationId}`) : undefined}
                    className={cn(
                      'group relative rounded-[var(--radius-Apple-md)] border p-5 transition-all',
                      isDisabled
                        ? 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 dark:bg-[var(--bg-tertiary)]/50 opacity-80 cursor-pointer hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)] hover:shadow-md'
                        : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--color-secondary-border)] dark:hover:border-[var(--color-secondary)] hover:shadow-md cursor-pointer',
                    )}
                  >
                    {/* Status Badge */}
                    <span className={cn('absolute top-[var(--space-apple-md)] right-4 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium', badge.className)}>
                      {badge.label}
                    </span>

                    {/* Icon */}
                    <div
                      className={cn(
                        'w-11 h-11 rounded-[var(--radius-Apple-md)] flex items-center justify-center mb-[var(--space-apple-md)] transition-colors',
                        isDisabled
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                          : 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/25 text-[var(--color-secondary-text)]0 group-hover:bg-[var(--color-secondary-container)] dark:group-hover:bg-[var(--color-secondary-container)]/50',
                      )}
                    >
                      <Icon className="w-5.5 h-5.5" />
                    </div>

                    {/* Content */}
                    <h4 className={cn(
                      'font-semibold pr-16',
                      isDisabled ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]',
                    )}>
                      {integration.title}
                    </h4>
                    <p className="text-sm text-[var(--text-muted)] mt-1.5 leading-relaxed line-clamp-2">
                      {integration.description}
                    </p>

                    {/* Action */}
                    {!isDisabled && (
                      <button
                        onClick={() => navigate('/settings?tab=api')}
                        className="mt-[var(--space-apple-md)] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] group-hover:text-[var(--color-secondary-text)] dark:group-hover:text-[var(--color-secondary-text)] transition-colors"
                      >
                        {integration.status === 'available' ? '配置' : '申请体验'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isDisabled && (
                      <div className="mt-[var(--space-apple-md)] flex items-center gap-1.5 text-sm text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">
                        <ArrowRight className="w-3.5 h-3.5" />
                        企业版可用 · 点击升级
                      </div>
                    )}

                    {/* Disabled Overlay */}
                    {isDisabled && (
                      <div className="absolute inset-0 rounded-[var(--radius-Apple-md)] pointer-events-none" aria-hidden="true" />
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      ))}

      {/* Footer CTA */}
      <div className="text-center pt-[var(--space-apple-md)] pb-2">
        <p className="text-sm text-[var(--text-muted)]">
          需要特定的集成方案？{' '}
          <a href="mailto:support@rmfood.cn" className="text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] font-medium hover:underline">
            联系我们
          </a>{' '}
          定制开发
        </p>
      </div>
    </div>
  )
})

export default IntegrationsTab
