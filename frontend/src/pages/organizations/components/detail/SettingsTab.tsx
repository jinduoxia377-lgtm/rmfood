import { useState, useMemo, useCallback, memo, useRef } from 'react'
import {
  Save,
  Loader2,
  Camera,
  AlertTriangle,
  Archive,
  Trash2,
  CheckCircle,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { LazyImage } from '@/components/ui/LazyImage'
import api from '@/api/client'

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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">组织设置</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">管理组织的基本信息和配置</p>
      </div>

      {/* Basic Information */}
      <section aria-label="基本信息" className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 space-y-6">
        <h3 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Info className="w-5 h-5 text-secondary-500" />
          基本信息
        </h3>

        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            组织头像
          </label>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-blue-500/20 overflow-hidden">
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
                }}
              />
              <button
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center cursor-pointer"
                aria-label="上传头像"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                点击头像上传新的组织 Logo
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                支持 JPG、PNG 格式，建议尺寸 200×200px，最大 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Organization Name */}
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            组织名称 <span className="text-error-500">*</span>
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="输入组织名称"
            maxLength={50}
            className="w-full max-w-md px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          <p className="mt-1 text-xs text-neutral-400">{name.length}/50</p>
        </div>

        {/* Slug / URL Identifier */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label htmlFor="org-slug" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              URL 标识符（Slug）
            </label>
            <button
              onClick={() => setAutoSlug(!autoSlug)}
              className={cn(
                'text-xs px-2 py-0.5 rounded-full transition-colors',
                autoSlug
                  ? 'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-400'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400',
              )}
            >
              {autoSlug ? '自动生成' : '自定义'}
            </button>
          </div>
          <div className="flex items-center max-w-md">
            <span className="px-3 py-2.5 border border-r-0 border-neutral-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 text-neutral-500 text-sm rounded-l-lg select-none">
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
                'flex-1 px-3 py-2.5 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors',
                autoSlug && 'opacity-60 cursor-not-allowed',
              )}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            用于 URL 和 API 引用，仅支持小写字母、数字和连字符
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="org-desc" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            描述
          </label>
          <textarea
            id="org-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述组织的用途和目标..."
            rows={4}
            maxLength={500}
            className="w-full max-w-lg px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
          <p className="mt-1 text-xs text-neutral-400">{description.length}/500</p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !isModified}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
              saving || !isModified
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
                : 'bg-secondary-600 text-white hover:bg-secondary-700 shadow-sm shadow-blue-500/25 hover:shadow-md',
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
            <span className="flex items-center gap-1.5 text-sm text-success-600 dark:text-success-400">
              <CheckCircle className="w-4 h-4" />
              已保存
            </span>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section aria-label="危险操作" className="rounded-xl border-2 border-red-200 dark:border-red-900/50 p-6 space-y-5 bg-error-50/30 dark:bg-error-900/10">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-error-500" />
          <h3 className="font-semibold text-error-800 dark:text-error-300">危险操作</h3>
        </div>
        <p className="text-sm text-error-700/80 dark:text-error-400/80">
          以下操作不可逆或需要谨慎处理，请确认后再操作。
        </p>

        <div className="space-y-3">
          {/* Archive */}
          <div className="flex items-start justify-between gap-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-red-100 dark:border-red-900/30">
            <div className="space-y-1 min-w-0">
              <h4 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                <Archive className="w-4 h-4 text-yellow-500" />
                归档此组织
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                归档后所有数据保留但无法访问，可随时恢复。
              </p>
            </div>
            <button
              onClick={onArchive}
              className="shrink-0 px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              归档
            </button>
          </div>

          {/* Delete */}
          <div className="flex items-start justify-between gap-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-red-200 dark:border-red-900/40">
            <div className="space-y-1 min-w-0">
              <h4 className="font-medium text-error-700 dark:text-error-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                删除此组织
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                此操作不可逆！删除后所有数据将永久丢失。
              </p>
            </div>
            <button
              onClick={onDelete}
              className="shrink-0 px-4 py-2 text-sm font-medium bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors shadow-sm shadow-red-500/25"
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
