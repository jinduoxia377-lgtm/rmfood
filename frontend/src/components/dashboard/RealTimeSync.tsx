/**
 * 实时数据同步组件
 * - 展示实时数据更新
 * - R-06：WS 启用时订阅真实 data_update 频道；未启用时显式提示「实时连接未启用」，
 *   不再伪造模拟数据变更
 */
import { useState, useEffect, useRef } from 'react'
import { Activity, RefreshCw, Clock, Send, Database, WifiOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { subscribeToChannel, isWebSocketEnabled } from '@/services/websocket'

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
    // R-06：仅 WS 启用时订阅真实数据更新频道；未启用不伪造模拟变更
    if (!isWebSocketEnabled) return
    const unsubscribe = subscribeToChannel('data_update', (message) => {
      handleDataUpdate(message)
    })
    return () => {
      unsubscribe()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

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

  // R-06：手动同步仅在 WS 启用时有意义（触发一次真实同步请求占位，由后端推送后续事件）
  const handleManualSync = () => {
    if (!isWebSocketEnabled) return
    setIsSyncing(true)
    // WS 通道由后端推送，此处仅复位状态（后续收到 data_update 事件即完成）
    setTimeout(() => setIsSyncing(false), 1000)
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <Database size={16} className="text-success-700" />
      case 'update':
        return <RefreshCw size={16} className="text-secondary-600" />
      case 'delete':
        return <Database size={16} className="text-error-600" />
      default:
        return <Activity size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
    }
  }

  const getActionColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'text-success-700 dark:text-success-600'
      case 'update':
        return 'text-secondary-600 dark:text-secondary-700'
      case 'delete':
        return 'text-error-600 dark:text-error-600'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
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
            <Activity size={20} className="text-primary-700 dark:text-primary-700" />
            <CardTitle as="h2" className="text-sm font-semibold">实时数据同步</CardTitle>
          </div>
          {isWebSocketEnabled
            ? <Badge variant="primary" size="sm">{syncCount}</Badge>
            : <Badge variant="secondary" size="sm">实时连接未启用</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {/* 同步状态 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              最后同步: {lastUpdate || '从未'}
            </span>
          </div>
          {isWebSocketEnabled ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<Send size={16} />}
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              {isSyncing ? '同步中...' : '手动同步'}
            </Button>
          ) : (
            /* A-42：暗色画布最暗处是墨绿渐变，neutral-400(#94a3b8) 落在上面只有 3.79:1；
               提到 neutral-300(#cbd5e1) 后为 6.5:1。亮色侧由 A-38b 的全局下限兜底。
               注意这里必须是普通块注释，不能写成 JSX 注释 —— 三元分支的括号内是表达式
               位置，再包一层花括号会被当成第二个子节点，tsc 直接报 TS1005。 */
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-300" title="设置 VITE_WEBSOCKET_ENABLED=true 后可启用实时同步">
              <WifiOff size={14} />
              实时连接未启用
            </span>
          )}
        </div>

        {/* 同步历史 */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">同步历史</h4>
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            {syncHistory.length === 0 ? (
              <div className="py-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">暂无同步记录</p>
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
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{item.timestamp}</span>
                      </div>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 truncate">
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
        <div className="mt-4 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-100 dark:border-secondary-800/30">
          <div className="flex items-start gap-3">
            {isWebSocketEnabled ? (
              <RefreshCw size={18} className="text-secondary-600 dark:text-secondary-700 flex-shrink-0 mt-0.5" />
            ) : (
              <WifiOff size={18} className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-700 mb-1">实时同步说明</h4>
              <ul className="text-xs text-secondary-600 dark:text-secondary-700 space-y-1">
                {isWebSocketEnabled ? (
                  <>
                    <li>• 系统会自动同步数据变更</li>
                    <li>• 数据变更后 500ms 内推送更新</li>
                    <li>• 支持离线操作和自动重连</li>
                    <li>• 冲突解决基于时间戳和版本号</li>
                  </>
                ) : (
                  <li>• 实时同步未启用（设置 VITE_WEBSOCKET_ENABLED=true 并启动后端 WebSocket 后可用）；当前卡片仅展示历史同步记录</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
