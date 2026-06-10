import { useState, useMemo, memo, useCallback } from 'react'
import {
  HardDrive,
  Zap,
  Users,
  ArrowUpRight,
  Copy,
  CheckCircle,
  TrendingUp,
  FileText,
  Image,
  FileArchive,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { Member, Team, Role } from '@/hooks/useOrganizationDetail'

interface ResourcesTabProps {
  organizationId: number
  members: Member[]
  teams: Team[]
  memberCount: number
  teamCount: number
  organization: any
  onInvite?: (email: string, role?: Role) => Promise<void>
  onRemoveMember?: (memberId: number) => Promise<void>
  onUpdateRole?: (memberId: number, role: Role) => Promise<void>
  onCreateTeam?: (data: Partial<Team>) => Promise<Team>
  onUpdateTeam?: (teamId: number, data: Partial<Team>) => Promise<void>
  onDeleteTeam?: (teamId: number) => Promise<void>
  onRefresh?: () => void
}

interface StorageFileItem {
  name: string
  size: string
  type: 'document' | 'image' | 'archive' | 'other'
  updatedAt: string
}

interface ApiEndpointStat {
  endpoint: string
  calls: number
  avgLatency: string
  trend: 'up' | 'down' | 'stable'
}

const MOCK_STORAGE_FILES: StorageFileItem[] = [
  { name: 'Q4季度报告.pdf', size: '12.5 MB', type: 'document', updatedAt: '2天前' },
  { name: '产品配方库.xlsx', size: '8.3 MB', type: 'document', updatedAt: '5天前' },
  { name: '实验数据_2026.csv', size: '45.2 MB', type: 'document', updatedAt: '1周前' },
  { name: '团队合照.jpg', size: '3.8 MB', type: 'image', updatedAt: '2周前' },
  { name: '产品渲染图.png', size: '18.7 MB', type: 'image', updatedAt: '3周前' },
  { name: '备份档案.zip', size: '156.0 MB', type: 'archive', updatedAt: '1个月前' },
  { name: '研发文档合集.pdf', size: '23.1 MB', type: 'document', updatedAt: '1个月前' },
  { name: 'logo设计稿.svg', size: '0.5 MB', type: 'other', updatedAt: '2个月前' },
  { name: '市场分析报告.pptx', size: '15.6 MB', type: 'document', updatedAt: '2个月前' },
  { name: '原料数据库.json', size: '67.4 MB', type: 'other', updatedAt: '3个月前' },
]

const MOCK_API_ENDPOINTS: ApiEndpointStat[] = [
  { endpoint: '/api/v1/formulas/search', calls: 45230, avgLatency: '120ms', trend: 'up' },
  { endpoint: '/api/v1/formulas/generate', calls: 28760, avgLatency: '2.3s', trend: 'up' },
  { endpoint: '/api/v1/experiments/run', calls: 15420, avgLatency: '8.5s', trend: 'stable' },
  { endpoint: '/api/v1/ai/chat', calls: 12890, avgLatency: '1.8s', trend: 'up' },
  { endpoint: '/api/v1/formulas/detail', calls: 9870, avgLatency: '45ms', trend: 'down' },
  { endpoint: '/api/v1/database/query', calls: 7650, avgLatency: '200ms', trend: 'stable' },
  { endpoint: '/api/v1/files/upload', calls: 5430, avgLatency: '1.2s', trend: 'stable' },
  { endpoint: '/api/v1/organizations/*', calls: 3210, avgLatency: '35ms', trend: 'down' },
  { endpoint: '/api/v1/analytics/report', calls: 2180, avgLatency: '500ms', trend: 'up' },
  { endpoint: '/api/v1/auth/*', calls: 1890, avgLatency: '20ms', trend: 'stable' },
]

const FILE_TYPE_CONFIG: Record<StorageFileItem['type'], { icon: typeof FileText; color: string; label: string }> = {
  document: { icon: FileText, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', label: '文档' },
  image: { icon: Image, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', label: '图片' },
  archive: { icon: FileArchive, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30', label: '压缩包' },
  other: { icon: Server, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800', label: '其他' },
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getStorageColor(percentage: number): { bar: string; text: string } {
  if (percentage < 60) return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400' }
  if (percentage < 90) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' }
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' }
}

function ProgressBar({
  value,
  max,
  showLabel = true,
  height = 8,
}: {
  value: number
  max: number
  showLabel?: boolean
  height?: number
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const colors = getStorageColor(percentage)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', colors.text)}>
          {formatBytes(value)} / {formatBytes(max)}
        </span>
        {showLabel && (
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', colors.bar.replace('bg-', 'bg-opacity-20 bg-').replace('500', '100') + ` ${colors.text}`)}>
            {percentage.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden" style={{ height }}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', colors.bar)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}

const ResourcesTab = memo(({ organization, memberCount }: ResourcesTabProps) => {
  const toast = useToast()
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const storageUsed = useMemo(() => organization?.storageUsed || 0, [organization])
  const storageLimit = useMemo(() => organization?.storageLimit || 10 * 1024 * 1024 * 1024, [organization])
  const storagePercent = useMemo(() => storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0, [storageUsed, storageLimit])

  const apiCallsUsed = useMemo(() => organization?.apiCalls || 2340, [organization])
  const apiCallsLimit = useMemo(() => 10000, [])
  const memberLimit = useMemo(() => organization?.plan === 'enterprise' ? -1 : organization?.plan === 'pro' ? 50 : 10, [organization])

  const handleCopyInviteLink = useCallback(async () => {
    const link = `${window.location.origin}/invite?org=${organization?.id}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedInviteLink(true)
      toast.success('邀请链接已复制到剪贴板')
      setTimeout(() => setCopiedInviteLink(false), 2000)
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }, [organization, toast])

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">资源配额</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">查看组织的存储空间、API 调用和成员席位使用情况</p>
      </div>

      {/* Storage Section */}
      <section aria-label="存储空间" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <HardDrive className="w-5.5 h-5.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">存储空间</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">文件和数据占用情况</p>
          </div>
        </div>

        <ProgressBar value={storageUsed} max={storageLimit} />

        {/* File Type Distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { type: 'document' as const, percent: 55, size: formatBytes(storageUsed * 0.55), count: 24 },
            { type: 'image' as const, percent: 25, size: formatBytes(storageUsed * 0.25), count: 12 },
            { type: 'archive' as const, percent: 15, size: formatBytes(storageUsed * 0.15), count: 3 },
            { type: 'other' as const, percent: 5, size: formatBytes(storageUsed * 0.05), count: 8 },
          ].map((item) => {
            const config = FILE_TYPE_CONFIG[item.type]
            const Icon = config.icon
            return (
              <div key={item.type} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{config.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{item.size}</p>
                <p className="text-xs text-slate-400">{item.percent}% · {item.count} 个文件</p>
              </div>
            )
          })}
        </div>

        {/* Large Files TOP 10 */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            大文件 TOP 10
          </h4>
          <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">文件名</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">大小</th>
                  <th className="hidden sm:table-cell px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {MOCK_STORAGE_FILES.map((file, index) => {
                  const config = FILE_TYPE_CONFIG[file.type]
                  const Icon = config.icon
                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={cn('w-4 h-4 shrink-0', config.color.split(' ')[0])} />
                          <span className="truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{file.size}</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right text-slate-400 dark:text-slate-500">{file.updatedAt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* API Calls Section */}
      <section aria-label="API调用配额" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Zap className="w-5.5 h-5.5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">API 调用配额</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">本月 API 使用量统计</p>
          </div>
        </div>

        <ProgressBar value={apiCallsUsed} max={apiCallsLimit} />

        {/* API Endpoint Ranking */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            端点使用排行 TOP 10
          </h4>
          <div className="space-y-2">
            {MOCK_API_ENDPOINTS.map((ep, index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
              >
                <span className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0',
                  index < 3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}>
                  {index + 1}
                </span>
                <code className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-400 truncate">{ep.endpoint}</code>
                <span className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
                  {ep.calls.toLocaleString()}
                </span>
                <span className="hidden md:block text-xs text-slate-400 w-14 text-right">{ep.avgLatency}</span>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  ep.trend === 'up' ? 'bg-red-500' : ep.trend === 'down' ? 'bg-green-500' : 'bg-slate-400',
                )} title={ep.trend === 'up' ? '上升' : ep.trend === 'down' ? '下降' : '稳定'} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Members Section */}
      <section aria-label="成员席位" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Users className="w-5.5 h-5.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">成员席位</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">组织成员数量与上限</p>
          </div>
        </div>

        <ProgressBar
          value={memberCount}
          max={memberLimit > 0 ? memberLimit : memberCount + 10}
          showLabel={memberLimit > 0}
        />

        {memberLimit <= 0 && (
          <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
            企业版计划无成员数量限制
          </p>
        )}

        {/* Invite Link & Upgrade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">邀请成员链接</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg truncate text-slate-500">
                {window.location.origin}/invite?org={organization?.id}
              </code>
              <button
                onClick={handleCopyInviteLink}
                className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="复制邀请链接"
              >
                {copiedInviteLink ? <CheckCircle className="w-4.5 h-4.5 text-green-500" /> : <Copy className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
              需要更多席位？
              <ArrowUpRight className="w-4 h-4" />
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">升级计划以解锁更多成员席位和高级功能</p>
            <button className="mt-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              升级计划
            </button>
          </div>
        </div>
      </section>
    </div>
  )
})

export default ResourcesTab
