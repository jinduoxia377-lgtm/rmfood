/**
 * 团队在线状态组件
 * - 显示当前活跃协作者
 * - 实时更新在线状态
 * - 显示用户操作状态
 */
import { useState, useEffect } from 'react'
import { Users, User, Activity, CheckCircle2, Clock, Zap } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { wsService } from '@/services/websocket'

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
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    // 模拟初始用户数据
    const initialUsers: UserStatus[] = [
      {
        userId: 'user1',
        userName: '张三',
        email: 'zhangsan@example.com',
        avatar: 'https://ui-avatars.com/api/?name=张三&background=random',
        status: 'online',
        lastActive: new Date().toLocaleTimeString(),
        currentAction: '编辑仪表板布局',
      },
      {
        userId: 'user2',
        userName: '李四',
        email: 'lisi@example.com',
        avatar: 'https://ui-avatars.com/api/?name=李四&background=random',
        status: 'away',
        lastActive: new Date(Date.now() - 5 * 60000).toLocaleTimeString(),
        currentAction: '查看数据',
      },
      {
        userId: 'user3',
        userName: '王五',
        email: 'wangwu@example.com',
        avatar: 'https://ui-avatars.com/api/?name=王五&background=random',
        status: 'offline',
        lastActive: new Date(Date.now() - 30 * 60000).toLocaleTimeString(),
        currentAction: '离线',
      },
    ]
    setUsers(initialUsers)
    setOnlineCount(initialUsers.filter(u => u.status === 'online').length)

    // 监听WebSocket消息
    const unsubscribe = wsService.on('user_status', (data: any) => {
      handleUserStatusUpdate(data)
    })

    // 模拟用户状态更新
    const interval = setInterval(() => {
      simulateUserStatusUpdate()
    }, 15000) // 每15秒模拟一次状态更新

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [dashboardId])

  const handleUserStatusUpdate = (data: any) => {
    setUsers(prev => {
      const updated = prev.map(user =>
        user.userId === data.userId
          ? { ...user, ...data, lastActive: new Date().toLocaleTimeString() }
          : user,
      )
      // 如果是新用户，添加到列表
      if (!updated.some(u => u.userId === data.userId)) {
        updated.push({
          userId: data.userId,
          userName: data.userName,
          email: data.email,
          avatar: data.avatar,
          status: data.status,
          lastActive: new Date().toLocaleTimeString(),
          currentAction: data.currentAction,
        })
      }
      return updated
    })

    // 更新在线计数
    setOnlineCount(users.filter(u => u.status === 'online').length)
  }

  const simulateUserStatusUpdate = () => {
    const randomUserIndex = Math.floor(Math.random() * users.length)
    const randomStatus: ('online' | 'away' | 'offline')[] = ['online', 'away', 'offline']
    const randomAction = [
      '编辑仪表板布局',
      '查看数据',
      '添加卡片',
      '调整布局',
      '导出数据',
      '设置共享权限',
    ]

    const updatedUsers = [...users]
    updatedUsers[randomUserIndex] = {
      ...updatedUsers[randomUserIndex],
      status: randomStatus[Math.floor(Math.random() * randomStatus.length)],
      currentAction: randomAction[Math.floor(Math.random() * randomAction.length)],
      lastActive: new Date().toLocaleTimeString(),
    }

    setUsers(updatedUsers)
    setOnlineCount(updatedUsers.filter(u => u.status === 'online').length)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-amber-500'
      case 'offline':
        return 'bg-slate-400'
      default:
        return 'bg-slate-400'
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
    if (action.includes('编辑')) return <Zap size={16} className="text-blue-600" />
    if (action.includes('查看')) return <Activity size={16} className="text-slate-600" />
    if (action.includes('添加')) return <CheckCircle2 size={16} className="text-green-600" />
    if (action.includes('导出')) return <Clock size={16} className="text-amber-600" />
    return <User size={16} className="text-slate-500" />
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-blue-600 dark:text-blue-400" />
            <CardTitle as="h3" className="text-sm font-bold">团队在线状态</CardTitle>
          </div>
          <Badge size="sm">{onlineCount}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 在线用户列表 */}
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.userId} className="py-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {user.userName.charAt(0)}
                    </span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${getStatusColor(user.status)}`} />
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
                    <p className="text-xs text-slate-500 truncate">{user.currentAction}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 统计信息 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
            <div className="text-center">
              <p className="text-sm font-bold text-green-800 dark:text-green-400">{users.filter(u => u.status === 'online').length}</p>
              <p className="text-xs text-green-600 dark:text-green-500">在线</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
            <div className="text-center">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">{users.filter(u => u.status === 'away').length}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">离开</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/30">
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-400">{users.filter(u => u.status === 'offline').length}</p>
              <p className="text-xs text-slate-600 dark:text-slate-500">离线</p>
            </div>
          </div>
        </div>

        {/* 协作提示 */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-start gap-3">
            <Activity size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">实时协作提示</h4>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
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
