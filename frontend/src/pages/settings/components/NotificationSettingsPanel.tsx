/**
 * 设置页「通知偏好」面板 — 直连真实后端通知偏好接口
 *
 * 数据链路：
 *   GET  /api/v1/notifications/preferences  → 初始化开关
 *   PUT  /api/v1/notifications/preferences  → 保存到 notification_preferences 表
 *   （不再是写 users.preferences 的“假同步”，也不再展示误导性提示）
 *
 * 字段映射（UI → 后端）：
 *   配方审核      → formula_review
 *   实验完成      → experiment_complete
 *   AI 任务完成   → ai_task_complete
 *   系统更新      → system_updates（后端落 settings.system_alert）
 *   浏览器推送    → browser_push / push_enabled（后端 webhook_enabled）
 *   邮件通知      → email_enabled
 *   发送频率      → notification_frequency
 *   消息优先级    → notification_priority
 *   免打扰时段    → quiet_hours.{start,end}
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, BellRing, Mail, Clock, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { notificationApi, type NotificationPreferences } from '@/api/notifications'

const NOTIF_PREFS_STORAGE_KEY = 'rmfood-notification-prefs'

type Frequency = 'realtime' | 'daily' | 'weekly'
type Priority = 'high' | 'medium' | 'low'

interface NotifPrefsUI {
  formula_review: boolean
  experiment_complete: boolean
  ai_task_done: boolean
  system_updates: boolean
  browser_push: boolean
  email_notifications: boolean
  notification_frequency: Frequency
  notification_priority: Priority
  quiet_hours_start: string
  quiet_hours_end: string
}

const DEFAULT_PREFS: NotifPrefsUI = {
  formula_review: true,
  experiment_complete: true,
  ai_task_done: true,
  system_updates: true,
  browser_push: true,
  email_notifications: false,
  notification_frequency: 'realtime',
  notification_priority: 'high',
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
}

function apiToUi(p: NotificationPreferences): NotifPrefsUI {
  return {
    formula_review: p.formula_review,
    experiment_complete: p.experiment_complete,
    ai_task_done: p.ai_task_complete,
    system_updates: p.system_updates ?? p.system_alert,
    browser_push: p.browser_push ?? p.push_enabled,
    email_notifications: p.email_enabled,
    notification_frequency: p.notification_frequency ?? 'realtime',
    notification_priority: p.notification_priority ?? 'high',
    quiet_hours_start: p.quiet_hours?.start ?? '22:00',
    quiet_hours_end: p.quiet_hours?.end ?? '08:00',
  }
}

function uiToApi(ui: NotifPrefsUI): Partial<NotificationPreferences> {
  return {
    formula_review: ui.formula_review,
    experiment_complete: ui.experiment_complete,
    ai_task_complete: ui.ai_task_done,
    system_updates: ui.system_updates,
    browser_push: ui.browser_push,
    push_enabled: ui.browser_push,
    email_enabled: ui.email_notifications,
    notification_frequency: ui.notification_frequency,
    notification_priority: ui.notification_priority,
    quiet_hours: { start: ui.quiet_hours_start, end: ui.quiet_hours_end },
  }
}

export default function NotificationSettingsPanel() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const qc = useQueryClient()

  const { data: serverPrefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationApi.getPreferences,
    staleTime: 30_000,
  })

  // 本地状态：先取 localStorage（首屏秒开），后端数据到达后合并覆盖
  const [prefs, setPrefs] = useState<NotifPrefsUI>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_PREFS_STORAGE_KEY)
      if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) }
    } catch { /* 忽略损坏数据 */ }
    return DEFAULT_PREFS
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (serverPrefs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 服务端偏好到达后合并到本地，属数据同步意图
      setPrefs(prev => ({ ...prev, ...apiToUi(serverPrefs) }))
    }
  }, [serverPrefs])

  const updateMutation = useMutation({
    mutationFn: (next: NotifPrefsUI) => notificationApi.updatePreferences(uiToApi(next)),
    onMutate: () => setSaveState('saving'),
    onSuccess: (_data, next) => {
      setSaveState('saved')
      // 本地缓存同步更新，避免下次打开闪默认值
      qc.setQueryData(['notification-preferences'], uiToApi(next))
      qc.invalidateQueries({ queryKey: ['notification-preferences'] })
      addToast({ type: 'success', message: '通知偏好已保存到服务器' })
      window.setTimeout(() => setSaveState('idle'), 2000)
    },
    onError: () => {
      setSaveState('error')
      addToast({ type: 'error', message: '通知偏好保存失败，请重试' })
    },
  })

  const savePrefs = (next: NotifPrefsUI) => {
    setPrefs(next)
    try {
      localStorage.setItem(NOTIF_PREFS_STORAGE_KEY, JSON.stringify(next))
    } catch { /* 忽略 */ }
    updateMutation.mutate(next)
  }

  const toggle = (key: keyof NotifPrefsUI) => {
    if (key === 'notification_frequency' || key === 'notification_priority') return
    savePrefs({ ...prefs, [key]: !prefs[key] })
  }

  const eventToggles: { key: 'formula_review' | 'experiment_complete' | 'ai_task_done' | 'system_updates'; label: string; desc: string }[] = [
    { key: 'formula_review', label: '配方审核', desc: '配方提交审核、审核通过或驳回时' },
    { key: 'experiment_complete', label: '实验完成', desc: '关联实验完成或失败时' },
    { key: 'ai_task_done', label: 'AI 任务完成', desc: '配方生成、分析任务结束时' },
    { key: 'system_updates', label: '系统更新', desc: '维护公告、版本发布等' },
  ]

  const channelToggles: { key: 'browser_push' | 'email_notifications'; label: string; desc: string; icon: typeof BellRing }[] = [
    { key: 'browser_push', label: '浏览器推送', desc: 'WebSocket 实时推送通知到当前浏览器', icon: BellRing },
    { key: 'email_notifications', label: '邮件通知', desc: '将重要消息发送到邮箱', icon: Mail },
  ]

  const saveStatusNode = useMemo(() => {
    if (saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> 保存中…
        </span>
      )
    }
    if (saveState === 'saved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-success-text)]">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 已保存到服务器
        </span>
      )
    }
    if (saveState === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-error-text)]">
          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> 保存失败，请检查网络后重试
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 设置自动同步到服务器
      </span>
    )
  }, [saveState])

  return (
    <div className="space-y-[var(--space-apple-lg)]">
      <Card>
        <CardHeader className="pb-[var(--space-apple-md)]">
          <div className="flex items-center gap-[var(--space-apple-sm)]">
            <div className="w-10 h-10 rounded-[var(--radius-Apple-md)] bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/10 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" aria-hidden="true" />
            </div>
            <div>
              <CardTitle as="h2" className="text-base font-semibold tracking-tight">通知偏好</CardTitle>
              <CardDescription>管理消息推送渠道与触发规则（保存到 notification_preferences 表）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-[var(--space-apple-lg)]">
          {isLoading && !serverPrefs ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> 正在加载通知偏好…
            </div>
          ) : (
            <>
              {/* 触发事件 */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">触发事件</p>
                <div className="space-y-[var(--space-apple-sm)]">
                  {eventToggles.map(item => (
                    <div key={item.key} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-[var(--space-apple-sm)]">
                        <Bell className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                        </div>
                      </div>
                      <Switch checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} disabled={updateMutation.isPending} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 推送渠道 */}
              <div className="border-t border-[var(--border-color)]/60 pt-6">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">推送渠道</p>
                <div className="space-y-[var(--space-apple-sm)]">
                  {channelToggles.map(item => (
                    <div key={item.key} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-[var(--space-apple-sm)]">
                        <item.icon className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                        </div>
                      </div>
                      <Switch checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} disabled={updateMutation.isPending} />
                    </div>
                  ))}
                </div>
              </div>

              {/* 频率与优先级 */}
              <div className="border-t border-[var(--border-color)]/60 pt-6">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-apple-md)]">频率与优先级</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-2">发送频率</p>
                    <Select
                      value={prefs.notification_frequency}
                      onValueChange={(v) => savePrefs({ ...prefs, notification_frequency: v as Frequency })}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">实时推送</SelectItem>
                        <SelectItem value="daily">每日摘要</SelectItem>
                        <SelectItem value="weekly">每周摘要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-2">消息优先级</p>
                    <Select
                      value={prefs.notification_priority}
                      onValueChange={(v) => savePrefs({ ...prefs, notification_priority: v as Priority })}
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高 — 全部显示</SelectItem>
                        <SelectItem value="medium">中 — 仅重要消息</SelectItem>
                        <SelectItem value="low">低 — 仅紧急消息</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 免打扰时段 */}
              <div className="border-t border-[var(--border-color)]/60 pt-6">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">免打扰时段</p>
                <p className="text-xs text-[var(--text-muted)] mb-[var(--space-apple-md)]">
                  免打扰期间新通知仍会进入通知中心，但不会触发浏览器实时推送。
                </p>
                <div className="flex items-center gap-[var(--space-apple-sm)]">
                  <Clock className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0" aria-hidden="true" />
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) => savePrefs({ ...prefs, quiet_hours_start: e.target.value })}
                    className="h-9 px-2 rounded-[var(--radius-Apple-sm)] border border-input bg-transparent text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="免打扰开始时间"
                  />
                  <span className="text-sm text-[var(--text-muted)]">至</span>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) => savePrefs({ ...prefs, quiet_hours_end: e.target.value })}
                    className="h-9 px-2 rounded-[var(--radius-Apple-sm)] border border-input bg-transparent text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="免打扰结束时间"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
        <div className="px-6 pb-5 pt-0 flex items-center justify-between border-t border-[var(--border-color)]/60 mt-2">
          <p className="text-xs text-[var(--text-muted)]">{t('pages.settings.notificationsDesc')}</p>
          {saveStatusNode}
        </div>
      </Card>
    </div>
  )
}