/**
 * 实时数据同步组件
 * - 展示实时数据更新
 * - 模拟数据变更和同步
 * - 演示WebSocket消息处理
 */
import { useState, useEffect, useRef } from 'react'
import { Activity, RefreshCw, Clock, Send, Database } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { wsService, subscribeToChannel } from '@/services/websocket'

interface RealTimeSyncProps {
  className?: string
}

export function RealTimeSync({ className }: RealTimeSyncProps) {
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [syncHistory, setSyncHistory] = useState<{
    id: string
    type: 'create' | 'update' | 'delete'
    entity: 'formula' | 'experiment' | 'user'
    timestamp: string
    data: any
  }[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncCount, setSyncCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // 订阅数据更新频道
    const unsubscribe = subscribeToChannel('data_update', (message) => {
      handleDataUpdate(message)
    })

    // 模拟数据同步
    startSimulation()

    return () => {
      unsubscribe()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const startSimulation = () => {
    intervalRef.current = setInterval(() => {
      simulateDataChange()
    }, 5000) // 每5秒模拟一次数据变更
  }

  const simulateDataChange = () => {
    const types = ['create', 'update', 'delete'] as const
    const entities = ['formula', 'experiment', 'user'] as const

    const type = types[Math.floor(Math.random() * types.length)]
    const entity = entities[Math.floor(Math.random() * entities.length)]

    const mockData = {
      formula: {
        id: `formula_${Date.now()}`,
        name: `测试配方 ${Date.now()}`,
        status: 'draft',
      },
      experiment: {
        id: `exp_${Date.now()}`,
        title: `实验 ${Date.now()}`,
        status: 'in_progress',
      },
      user: {
        id: `user_${Date.now()}`,
        name: `用户 ${Date.now()}`,
        role: 'user',
      },
    }

    const data = mockData[entity]

    // 模拟接收WebSocket消息
    handleDataUpdate({
      type: 'data_update',
      data: {
        entity_type: entity,
        entity_id: data.id,
        action: type,
        data,
      },
      timestamp: new Date().toISOString(),
    })
  }

  const handleDataUpdate = (message: any) => {
    const { entity_type, action, data } = message.data
    const newSync = {
      id: Date.now().toString(),
      type: action,
      entity: entity_type,
      timestamp: new Date().toLocaleTimeString(),
      data,
    }

    setSyncHistory(prev => [newSync, ...prev].slice(0, 10)) // 只保留最近10条
    setLastUpdate(new Date().toLocaleString())
    setSyncCount(prev => prev + 1)
  }

  const handleManualSync = () => {
    setIsSyncing(true)

    // 模拟手动同步
    setTimeout(() => {
      simulateDataChange()
      setIsSyncing(false)
    }, 1000)
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <Database size={16} className="text-green-600" />
      case 'update':
        return <RefreshCw size={16} className="text-blue-600" />
      case 'delete':
        return <Database size={16} className="text-red-600" />
      default:
        return <Activity size={16} className="text-slate-500" />
    }
  }

  const getActionColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'text-green-600 dark:text-green-400'
      case 'update':
        return 'text-blue-600 dark:text-blue-400'
      case 'delete':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-slate-600 dark:text-slate-400'
    }
  }

  const getActionText = (type: string) => {
    switch (type) {
      case 'create':
        return '创建'
      case 'update':
        return '更新'
      case 'delete':
        return '删除'
      default:
        return '操作'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-primary-600 dark:text-primary-400" />
            <CardTitle as="h3" className="text-sm font-bold">实时数据同步</CardTitle>
          </div>
          <Badge variant="primary" size="sm">{syncCount}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 同步状态 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              最后同步: {lastUpdate || '从未'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Send size={16} />}
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? '同步中...' : '手动同步'}
          </Button>
        </div>

        {/* 同步历史 */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">同步历史</h4>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            {syncHistory.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">暂无同步记录</p>
              </div>
            ) : (
              syncHistory.map((item) => (
                <div key={item.id} className="py-3 px-4 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getActionIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${getActionColor(item.type)}`}>
                          {getActionText(item.type)} {item.entity}
                        </span>
                        <span className="text-xs text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {item.entity === 'formula' && item.data.name}
                        {item.entity === 'experiment' && item.data.title}
                        {item.entity === 'user' && item.data.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 同步说明 */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-start gap-3">
            <RefreshCw size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">实时同步说明</h4>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>• 系统会自动同步数据变更</li>
                <li>• 数据变更后500ms内推送更新</li>
                <li>• 支持离线操作和自动重连</li>
                <li>• 冲突解决基于时间戳和版本号</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
