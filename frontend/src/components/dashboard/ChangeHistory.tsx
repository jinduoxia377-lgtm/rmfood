/**
 * 变更历史日志组件
 * - 记录所有修改操作
 * - 显示用户归属、时间戳和具体变更内容
 * - 支持按时间和用户筛选
 */
import { useState, useEffect } from 'react'
import { History, Clock, User, Edit, Plus, Trash2, Share2, Filter, Search } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Input, Select, Button } from '@/components/ui'

interface ChangeEvent {
  id: string
  userId: string
  userName: string
  timestamp: string
  action: 'create' | 'update' | 'delete' | 'share' | 'permission'
  entityType: 'dashboard' | 'card' | 'layout'
  entityId: string
  entityName: string
  description: string
  details: Record<string, any>
}

interface ChangeHistoryProps {
  dashboardId: string
  className?: string
}

export function ChangeHistory({ dashboardId, className }: ChangeHistoryProps) {
  const [events, setEvents] = useState<ChangeEvent[]>([])
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // 模拟变更历史数据
    const mockEvents: ChangeEvent[] = [
      {
        id: '1',
        userId: 'user1',
        userName: '张三',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5分钟前
        action: 'update',
        entityType: 'layout',
        entityId: 'layout1',
        entityName: '默认视图',
        description: '调整了仪表板布局',
        details: {
          changes: ['移动了配方总数卡片', '调整了研发趋势图表大小'],
        },
      },
      {
        id: '2',
        userId: 'user2',
        userName: '李四',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15分钟前
        action: 'share',
        entityType: 'dashboard',
        entityId: 'dashboard1',
        entityName: '默认仪表板',
        description: '邀请王五加入仪表板',
        details: {
          userId: 'user3',
          userName: '王五',
          accessLevel: 'edit',
        },
      },
      {
        id: '3',
        userId: 'user1',
        userName: '张三',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
        action: 'create',
        entityType: 'card',
        entityId: 'card14',
        entityName: 'WebSocket状态',
        description: '添加了WebSocket状态卡片',
        details: {
          cardType: 'websocket-status',
          position: { x: 2, y: 1 },
          size: { w: 1, h: 1 },
        },
      },
      {
        id: '4',
        userId: 'user1',
        userName: '张三',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1小时前
        action: 'update',
        entityType: 'card',
        entityId: 'card5',
        entityName: '研发趋势',
        description: '更新了研发趋势图表设置',
        details: {
          changes: ['修改了时间范围为30天', '添加了数据标签'],
        },
      },
      {
        id: '5',
        userId: 'user1',
        userName: '张三',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2小时前
        action: 'create',
        entityType: 'dashboard',
        entityId: 'dashboard1',
        entityName: '默认仪表板',
        description: '创建了新仪表板',
        details: {
          template: 'default',
          initialCards: 13,
        },
      },
    ]
    setEvents(mockEvents)
  }, [dashboardId])

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <Plus size={16} className="text-success-700" />
      case 'update':
        return <Edit size={16} className="text-secondary-600" />
      case 'delete':
        return <Trash2 size={16} className="text-error-600" />
      case 'share':
        return <Share2 size={16} className="text-accent-600" />
      case 'permission':
        return <User size={16} className="text-warning-600" />
      default:
        return <Edit size={16} className="text-neutral-600" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'text-success-700 dark:text-success-600'
      case 'update':
        return 'text-secondary-600 dark:text-secondary-700'
      case 'delete':
        return 'text-error-600 dark:text-error-600'
      case 'share':
        return 'text-accent-600 dark:text-accent-700'
      case 'permission':
        return 'text-warning-600 dark:text-warning-700'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'create':
        return '创建'
      case 'update':
        return '更新'
      case 'delete':
        return '删除'
      case 'share':
        return '共享'
      case 'permission':
        return '权限'
      default:
        return '操作'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return '刚刚'
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}小时前`
    return date.toLocaleDateString()
  }

  // 过滤事件
  const filteredEvents = events.filter(event => {
    const matchesAction = filterAction === 'all' || event.action === filterAction
    const matchesUser = filterUser === 'all' || event.userId === filterUser
    const matchesSearch = searchTerm === '' ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.entityName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesAction && matchesUser && matchesSearch
  })

  // 获取所有用户
  const users = Array.from(new Set(events.map(event => event.userId)))
  const userMap = new Map(events.map(event => [event.userId, event.userName]))

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History size={20} className="text-secondary-600 dark:text-secondary-700" />
            <CardTitle as="h2" className="text-sm font-semibold">变更历史</CardTitle>
          </div>
          <Badge size="sm">{events.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 筛选器 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex-1 min-w-[120px]">
            <Input
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="w-[120px]">
            <Select
              value={filterAction}
              onChange={(v) => setFilterAction(v)}
              className="w-full"
            >
              <option value="all">所有操作</option>
              <option value="create">创建</option>
              <option value="update">更新</option>
              <option value="delete">删除</option>
              <option value="share">共享</option>
              <option value="permission">权限</option>
            </Select>
          </div>
          <div className="w-[120px]">
            <Select
              value={filterUser}
              onChange={(v) => setFilterUser(v)}
              className="w-full"
            >
              <option value="all">所有用户</option>
              {users.map(userId => (
                <option key={userId} value={userId}>{userMap.get(userId)}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* 变更历史列表 */}
        <div className="max-h-80 overflow-y-auto border rounded-lg">
          {filteredEvents.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                暂无变更记录
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.id} className="py-3 px-4 border-b last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getActionIcon(event.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getActionColor(event.action)}`}>
                        {event.userName}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formatTimestamp(event.timestamp)}</span>
                      <Badge className={`${getActionColor(event.action)} bg-opacity-10`} size="sm">
                        {getActionText(event.action)}
                      </Badge>
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                      {event.description}
                    </p>
                    <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{event.entityName}</span>
                    </div>
                    {Object.keys(event.details).length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-600 dark:text-neutral-400">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 统计信息 */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          <div className="p-2 rounded-lg bg-success-50 dark:bg-success-300/15 border border-success-100 dark:border-success-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-success-800 dark:text-success-600">{events.filter(e => e.action === 'create').length}</p>
              <p className="text-xs text-success-700 dark:text-success-700">创建</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-100 dark:border-secondary-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-secondary-800 dark:text-secondary-700">{events.filter(e => e.action === 'update').length}</p>
              <p className="text-xs text-secondary-600 dark:text-secondary-700">更新</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-error-50 dark:bg-error-300/15 border border-error-100 dark:border-error-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-error-800 dark:text-error-600">{events.filter(e => e.action === 'delete').length}</p>
              <p className="text-xs text-error-600 dark:text-error-700">删除</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-accent-50 dark:bg-accent-300/15 border border-accent-100 dark:border-accent-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-accent-800 dark:text-accent-700">{events.filter(e => e.action === 'share').length}</p>
              <p className="text-xs text-accent-600 dark:text-accent-700">共享</p>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-warning-50 dark:bg-warning-300/15 border border-warning-100 dark:border-warning-800/30">
            <div className="text-center">
              <p className="text-sm font-semibold text-warning-800 dark:text-warning-700">{events.filter(e => e.action === 'permission').length}</p>
              <p className="text-xs text-warning-600 dark:text-warning-700">权限</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
