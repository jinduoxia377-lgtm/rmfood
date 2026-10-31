import { useState, useMemo, useCallback, memo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Save,
  Loader2,
  Camera,
  AlertTriangle,
  Archive,
  Trash2,
  CheckCircle,
  Info,
  ShieldCheck,
  Users,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { LazyImage } from '@/components/ui/LazyImage'
import api from '@/api/client'
import { PermissionMatrix } from '../PermissionMatrix'
import { CustomRoleManager } from '../CustomRoleManager'

interface SettingsTabProps {
  organizationId: number
  organization?: {
    name: string
    slug: string
    description?: string
    logo_url?: string
    plan: string
    is_active: boolean
    storageUsed: number
    storageLimit: number
    apiUsage?: number
    apiCalls?: number
  }
  onArchive?: () => Promise<void>
  onDelete?: () => void
  onRefresh?: () => void
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const ACTION_LABELS: Record<string, string> = {
  'members.invite': '邀请成员',
  'members.invite_sent': '发送邀请',
  'members.invite_accepted': '接受邀请',
  'members.role_change': '修改成员角色',
  'members.batch_role': '批量修改角色',
  'members.batch_suspend': '批量停用成员',
  'members.batch_resume': '批量恢复成员',
  'members.batch_remove': '批量移除成员',
  'teams.create': '创建团队',
  'roles.create': '创建角色',
  'roles.update': '更新角色',
  'roles.delete': '删除角色',
  'plan.upgrade': '升级计划',
  'plan.cancel': '取消订阅',
  'organization.clone': '克隆组织',
}

const PAGE_SIZE = 10

function AuditLogList({ organizationId }: { organizationId: number }) {
  const [actionFilter, setActionFilter] = useState('all')
  const [offset, setOffset] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['org-audit-log', organizationId, actionFilter, offset],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: PAGE_SIZE, offset }
      if (actionFilter !== 'all') params.action_type = actionFilter
      const { data } = await api.get(`/organizations/${organizationId}/audit-log`, { params })
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-[var(--bg-tertiary)] animate-pulse rounded" />
        <div className="h-8 bg-[var(--bg-tertiary)] animate-pulse rounded" />
        <div className="h-8 bg-[var(--bg-tertiary)] animate-pulse rounded" />
      </div>
    )
  }

  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-[var(--space-apple-sm)]">
      {/* 筛选与分页 */}
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-apple-sm)]">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0) }}
          className="min-h-[40px] rounded-[var(--radius-Apple-sm)] border border-input bg-transparent px-[var(--space-apple-sm)] py-2 text-sm"
          aria-label="按动作类型筛选"
        >
          <option value="all">全部动作</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          共 {total} 条 · 第 {offset / PAGE_SIZE + 1}/{Math.max(1, Math.ceil(total / PAGE_SIZE))} 页
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          暂无审计记录
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: Record<string, any>) => (
            <div
              key={log.id}
              className="flex items-start justify-between gap-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-[var(--bg-tertiary)]/60 border border-[var(--border-color)] dark:border-neutral-700/50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-[var(--text-primary)]">
                  {ACTION_LABELS[log.action_type] || log.action_type}
                </p>
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                  {log.username || '系统'} ·{' '}
                  {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : '-'}
                </p>
              </div>
              {log.metadata && typeof log.metadata === 'object' && (
                <span className="shrink-0 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  {JSON.stringify(log.metadata).slice(0, 60)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 分页按钮 */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          disabled={offset === 0}
          className="px-[var(--space-apple-sm)] py-1.5 text-xs rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]"
        >
          上一页
        </button>
        <button
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= total}
          className="px-[var(--space-apple-sm)] py-1.5 text-xs rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]"
        >
          下一页
        </button>
      </div>
    </div>
  )
}

const SettingsTab = memo(({ organizationId, organization, onArchive, onDelete, onRefresh }: SettingsTabProps) => {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(organization?.name || '')
  const [slug, setSlug] = useState(organization?.slug || '')
  const [description, setDescription] = useState(organization?.description || '')
  const [autoSlug, setAutoSlug] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(organization?.logo_url)

  const handleNameChange = useCallback(
    (value: string) => {
      setName(value)
      if (autoSlug) {
        setSlug(generateSlug(value))
      }
    },
    [autoSlug],
  )

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.warning('组织名称不能为空')
      return
    }
    setSaving(true)
    try {
      await api.put(`/organizations/${organizationId}`, {
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
        logo_url: logoUrl,
      })
      toast.success('组织信息已更新')
      onRefresh?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }, [name, slug, description, logoUrl, organizationId, toast])

  const isModified = useMemo(
    () =>
      name !== (organization?.name || '') ||
      slug !== (organization?.slug || '') ||
      description !== (organization?.description || '') ||
      logoUrl !== (organization?.logo_url || ''),
    [name, slug, description, logoUrl, organization],
  )

  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">组织设置</h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">管理组织的基本信息和配置</p>
      </div>

      {/* Basic Information */}
      <section aria-label="基本信息" className="bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] p-8 space-y-6">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Info className="w-5 h-5 text-[var(--color-secondary-text)]0" />
          基本信息
        </h3>

        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            组织头像
          </label>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 bg-gradient-to-br from-[var(--color-secondary-surface)] to-[var(--color-accent-surface-deep)] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-secondary-500/20 overflow-hidden">
                {organization?.logo_url ? (
                  <LazyImage src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                ) : (
                  organization?.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onloadend = () => setLogoUrl(reader.result as string)
                    reader.readAsDataURL(file)
                  }
                }} aria-hidden="true" tabIndex={-1} />
              <button
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center cursor-pointer"
                aria-label="上传头像"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                点击头像上传新的组织 Logo
              </p>
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                支持 JPG、PNG 格式，建议尺寸 200×200px，最大 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Organization Name */}
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            组织名称 <span className="text-[var(--color-error-text)]0">*</span>
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="输入组织名称"
            maxLength={50}
            className="w-full max-w-md px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent transition-colors"
          />
          <p className="mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{name.length}/50</p>
        </div>

        {/* Slug / URL Identifier */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label htmlFor="org-slug" className="block text-sm font-medium text-[var(--text-primary)]">
              URL 标识符（Slug）
            </label>
            <button
              onClick={() => setAutoSlug(!autoSlug)}
              className={cn(
                'text-xs px-2 py-0.5 rounded-[var(--radius-pill)] transition-colors',
                autoSlug
                  ? 'bg-[var(--color-secondary-container)] text-[var(--color-secondary-text)] dark:bg-[var(--color-secondary-container)]/25 dark:text-[var(--color-secondary-text)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-muted)]',
              )}
            >
              {autoSlug ? '自动生成' : '自定义'}
            </button>
          </div>
          <div className="flex items-center max-w-md">
            <span className="px-[var(--space-apple-sm)] py-2.5 border border-r-0 border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-sm rounded-l-lg select-none">
              @
            </span>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                if (autoSlug && e.target.value !== generateSlug(name)) setAutoSlug(false)
              }}
              placeholder="URL 友好标识（如 rmfood-lab）"
              disabled={autoSlug}
              className={cn(
                'flex-1 px-[var(--space-apple-sm)] py-2.5 border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent transition-colors',
                autoSlug && 'opacity-60 cursor-not-allowed',
              )}
            />
          </div>
          <p className="mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            用于 URL 和 API 引用，仅支持小写字母、数字和连字符
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="org-desc" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            描述
          </label>
          <textarea
            id="org-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述组织的用途和目标..."
            rows={4}
            maxLength={500}
            className="w-full max-w-lg px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] focus:border-transparent transition-colors"
          />
          <p className="mt-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{description.length}/500</p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-[var(--space-apple-sm)] pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !isModified}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all',
              saving || !isModified
                ? 'bg-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed'
                : 'bg-secondary-container text-secondary-main hover:bg-secondary-container shadow-sm shadow-secondary-500/25 hover:shadow-md',
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存更改
              </>
            )}
          </button>
          {!isModified && !saving && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">
              <CheckCircle className="w-4 h-4" />
              已保存
            </span>
          )}
        </div>
      </section>

      {/* 权限矩阵（真实读写 /permissions） */}
      <section aria-label="权限矩阵" className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-[var(--color-primary-text)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">权限矩阵</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            配置组织内不同角色的访问权限（保存后立即生效）
          </span>
        </div>
        <PermissionMatrix organizationId={organizationId} />
      </section>

      {/* 自定义角色编辑器（真实读写 /roles） */}
      <section aria-label="自定义角色" className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[var(--color-primary-text)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">自定义角色</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            创建组织专属角色与权限集（保存后立即生效）
          </span>
        </div>
        <CustomRoleManager organizationId={organizationId} />
      </section>

      {/* 审计日志（含成员批量操作等组织操作记录） */}
      <section aria-label="审计日志" className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)]/60 p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-[var(--color-primary-text)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">审计日志</h3>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            最近 20 条组织操作记录（成员批量操作/角色/权限/计划变更等）
          </span>
        </div>
        <AuditLogList organizationId={organizationId} />
      </section>

      {/* Danger Zone */}
      <section aria-label="危险操作" className="rounded-[var(--radius-Apple-md)] border-2 border-[var(--color-error-border)] dark:border-error-900/50 p-[var(--space-apple-lg)] space-y-5 bg-[var(--color-error-container)]/30 dark:bg-[var(--color-error-container)]/15">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[var(--color-error-text)]0" />
          <h3 className="font-semibold text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">危险操作</h3>
        </div>
        <p className="text-sm text-[var(--color-error-text)]/80 dark:text-[var(--color-error-text)]/80">
          以下操作不可逆或需要谨慎处理，请确认后再操作。
        </p>

        <div className="space-y-[var(--space-apple-sm)]">
          {/* Archive */}
          <div className="flex items-start justify-between gap-4 p-[var(--space-apple-md)] bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--color-error-border)] dark:border-error-900/30">
            <div className="space-y-1 min-w-0">
              <h4 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Archive className="w-4 h-4 text-[var(--color-warning-text)]0" />
                归档此组织
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                归档后所有数据保留但无法访问，可随时恢复。
              </p>
            </div>
            <button
              onClick={onArchive}
              className="shrink-0 px-[var(--space-apple-md)] py-2 text-sm font-medium bg-[var(--color-warning-container)]0 text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-warning)] transition-colors"
            >
              归档
            </button>
          </div>

          {/* Delete */}
          <div className="flex items-start justify-between gap-4 p-[var(--space-apple-md)] bg-[var(--bg-secondary)] rounded-[var(--radius-Apple-md)] border border-[var(--color-error-border)] dark:border-error-900/40">
            <div className="space-y-1 min-w-0">
              <h4 className="font-medium text-[var(--color-error-text)] dark:text-[var(--color-error-text)] flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                删除此组织
              </h4>
              <p className="text-sm text-[var(--text-muted)]">
                此操作不可逆！删除后所有数据将永久丢失。
              </p>
            </div>
            <button
              onClick={onDelete}
              className="shrink-0 px-[var(--space-apple-md)] py-2 text-sm font-medium bg-[var(--color-error)] text-white rounded-[var(--radius-Apple-sm)] hover:bg-[var(--color-error)] transition-colors shadow-sm shadow-error-500/25"
            >
              确认删除
            </button>
          </div>
        </div>
      </section>
    </div>
  )
})

export default SettingsTab

