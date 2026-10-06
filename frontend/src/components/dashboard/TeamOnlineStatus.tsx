/**
 * 团队在线状态组件
 * - 显示当前活跃协作者
 * - R-06：WS 启用时通过真实 user_status 事件更新；未启用时显示「实时连接未启用」占位，
 *   不再伪造模拟用户列表
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, User, Activity, WifiOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { wsService, isWebSocketEnabled } from '@/services/websocket'

interface UserStatus {
  userId: string
  userName: string
  email: string
  avatar: string
  status: 'online' | 'away' | 'offline'
  lastActive: string
  currentAction: string
  cursorPosition?: { x: number; y: number }
}

interface TeamOnlineStatusProps {
  dashboardId: string
  className?: string
}

export function TeamOnlineStatus({ dashboardId, className }: TeamOnlineStatusProps) {
  const [users, setUsers] = useState<UserStatus[]>([])

  const onlineCount = users.filter(u => u.status === 'online').length

  // R-06：WS 启用时订阅真实 user_status 事件（P0-04 已实现真实 EventEmitter）；
  // 未启用时不伪造模拟用户，UI 展示「实时连接未启用」占位
  const upsertUser = useCallback((data: any) => {
    setUsers(prev => {
      const existing = prev.find(u => u.userId === data.userId)
      if (existing) {
        return prev.map(u => u.userId === data.userId
          ? { ...u, ...data, lastActive: new Date().toLocaleTimeString() }
          : u)
      }
      return [...prev, {
        userId: data.userId,
        userName: data.userName,
        email: data.email,
        avatar: data.avatar,
        status: data.status,
        lastActive: new Date().toLocaleTimeString(),
        currentAction: data.currentAction,
      }]
    })
  }, [])

  useEffect(() => {
    if (!isWebSocketEnabled) return
    const unsubscribe = wsService.on('user_status', upsertUser)
    return unsubscribe
  }, [dashboardId, upsertUser])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-success-500'
      case 'away':
        return 'bg-warning-500'
      case 'offline':
        return 'bg-neutral-400'
      default:
        return 'bg-neutral-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线'
      case 'away':
        return '离开'
      case 'offline':
        return '离线'
      default:
        return '离线'
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes('编辑')) return <Activity size={16} className="text-secondary-600" />
    if (action.includes('查看')) return <User size={16} className="text-neutral-600" />
    return <Activity size={16} className="text-neutral-500" />
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-secondary-600 dark:text-secondary-400" />
            <CardTitle as="h3" className="text-sm font-semibold">团队在线状态</CardTitle>
          </div>
          {isWebSocketEnabled
            ? <Badge size="sm">{onlineCount}</Badge>
            : <Badge variant="secondary" size="sm">实时连接未启用</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {/* R-06：WS 未启用或无真实用户数据时，展示占位而非伪造列表 */}
        {users.length === 0 ? (
          <div className="py-6 flex flex-col items-center gap-2 text-center">
            {isWebSocketEnabled ? (
              <>
                <Users size={28} className="text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无在线协作用户</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">当团队协作者打开此仪表盘时，将在此实时显示</p>
              </>
            ) : (
              <>
                <WifiOff size={28} className="text-neutral-300 dark:text-neutral-600" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">实时连接未启用</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  设置 VITE_WEBSOCKET_ENABLED=true 并启动后端 WebSocket 服务后可查看实时在线状态
                </p>
              </>
            )}
          </div>
        ) : (
          <>
          {/* 在线用户列表 */}
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.userId} className="py-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        {user.userName.charAt(0)}
                      </span>
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-800 ${getStatusColor(user.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{user.userName}</p>
                      <Badge className={`${getStatusColor(user.status)} text-white text-xs`}>
                        {getStatusText(user.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getActionIcon(user.currentAction)}
                      <p className="text-xs text-neutral-500 truncate">{user.currentAction}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {/* 统计信息 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-success-50 dark:bg-success-900/10 border border-green-100 dark:border-green-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-success-800 dark:text-success-400">{users.filter(u => u.status === 'online').length}</p>
              <p className="text-xs text-success-600 dark:text-success-500">在线</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-amber-100 dark:border-amber-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-warning-800 dark:text-warning-400">{users.filter(u => u.status === 'away').length}</p>
              <p className="text-xs text-warning-600 dark:text-warning-500">离开</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-400">{users.filter(u => u.status === 'offline').length}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-500">离线</p>
            </div>
          </div>
        </div>

        {/* 协作提示 */}
        <div className="mt-4 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-900/10 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-start gap-3">
            <Activity size={18} className="text-secondary-600 dark:text-secondary-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-300 mb-1">实时协作提示</h4>
              <ul className="text-xs text-secondary-600 dark:text-secondary-400 space-y-1">
                <li>• 绿色状态表示用户正在活跃</li>
                <li>• 黄色状态表示用户暂时离开</li>
                <li>• 灰色状态表示用户离线</li>
                <li>• 实时显示用户的当前操作</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
