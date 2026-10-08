/**
 * 团队活动卡 — 由原「即将上线」占位升级为真实数据聚合
 * 数据源：
 *   - 在线协作者：TeamOnlineStatus 的 user_status 事件（WS 启用时）
 *   - 最近动态：/dashboard/activity（已有 query）
 * 无数据时展示「暂无团队活动」而非虚假占位文案
 */
import type { FC } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { Users, Activity as ActivityIcon, WifiOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardSkeleton, Badge } from '@/components/ui'
import { wsService, isWebSocketEnabled } from '@/services/websocket'

interface TeamActivityProps {
  timeline: { type: string; id: number | string; event: string; title: string; created_at: string; status: string }[]
  timelineLoading?: boolean
}

export const TeamActivity: FC<TeamActivityProps> = ({ timeline, timelineLoading }) => {
  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; userName: string; status: string }[]>([])

  // R-06 风格：WS 启用时订阅 user_status（载荷为扁平用户对象，与 TeamOnlineStatus 一致）；未启用时不伪造
  const upsertUser = useCallback((data: any) => {
    if (!data?.userId) return
    setOnlineUsers(prev => {
      const next = prev.filter(u => u.userId !== data.userId)
      next.push({ userId: data.userId, userName: data.userName ?? data.userId, status: data.status ?? 'online' })
      return next.filter((u: { status: string }) => u.status !== 'offline')
    })
  }, [])

  useEffect(() => {
    if (!isWebSocketEnabled) return
    const unsubscribe = wsService.on('user_status', upsertUser)
    return unsubscribe
  }, [upsertUser])

  const onlineCount = onlineUsers.filter(u => u.status === 'online').length

  if (timelineLoading) {
    return <CardSkeleton count={1} className="h-full" />
  }

  const hasContent = onlineUsers.length > 0 || timeline.length > 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-secondary-600 dark:text-secondary-400" />
            <CardTitle as="h3" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>团队活动</CardTitle>
          </div>
          {isWebSocketEnabled ? (
            <Badge variant="primary" size="sm">{onlineCount} 人在线</Badge>
          ) : (
            <Badge variant="secondary" size="sm">实时连接未启用</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        {!hasContent ? (
          <div className="py-8 flex flex-col items-center gap-2 text-center">
            {isWebSocketEnabled ? (
              <>
                <Users size={28} className="text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无团队活动</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  当协作者加入仪表盘或产生新的动态时，将在此实时显示
                </p>
              </>
            ) : (
              <>
                <WifiOff size={28} className="text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">实时连接未启用</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  仅展示最近动态（静态数据）。设置 VITE_WEBSOCKET_ENABLED=true 后可查看实时协作
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 在线协作者 */}
            {onlineUsers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">当前在线</h4>
                <div className="flex flex-wrap gap-2">
                  {onlineUsers.map(u => (
                    <div key={u.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary-50 dark:bg-secondary-900/20 text-xs">
                      <span className={`w-2 h-2 rounded-full ${u.status === 'online' ? 'bg-success-500' : 'bg-warning-500'}`} />
                      <span className="text-neutral-700 dark:text-neutral-300">{u.userName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最近动态摘要 */}
            {timeline.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-1">
                  <ActivityIcon size={12} /> 最近动态
                </h4>
                <div className="space-y-2">
                  {timeline.slice(0, 5).map(e => (
                    <div key={`${e.type}-${e.id}`} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 dark:text-neutral-300 truncate flex-1">{e.title}</span>
                      <span className="text-neutral-400 dark:text-neutral-500 ml-2 shrink-0">
                        {new Date(e.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
