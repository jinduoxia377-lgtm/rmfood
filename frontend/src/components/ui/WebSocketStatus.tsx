/**
 * WebSocket 状态监控组件
 * - 显示连接状态
 * - 显示同步延迟
 * - 显示数据传输统计
 * - 提供连接控制
 */
import { useState, useEffect } from'react'
import { Pocket, RefreshCw, X, CheckCircle, AlertCircle, BarChart3, Clock, ArrowUpDown, Wifi, Zap, AlertTriangle } from'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Progress } from'@/components/ui'
import { wsService } from'@/services/websocket'

interface WebSocketStatusProps {
 className?: string
}

export function WebSocketStatus({ className }: WebSocketStatusProps) {
 const [status, setStatus] = useState<'disconnected' |'connecting' |'connected' |'error' |'reconnecting'>('disconnected')
 const [stats, setStats] = useState({
 messagesSent: 0,
 messagesReceived: 0,
 bytesSent: 0,
 bytesReceived: 0,
 })
 const [lastActivity, setLastActivity] = useState<string>('')
 const [reconnectAttempts, setReconnectAttempts] = useState(0)
 const [connectionTime, setConnectionTime] = useState<string>('')
 const [networkStatus, setNetworkStatus] = useState<'online' |'offline'>('online')
 const [latency] = useState(0)

 useEffect(() => {
 // 监听连接状态
 const checkStatus = () => {
 setStatus(wsService.getIsConnected() ?'connected' :'disconnected')
 }

 // 定期检查连接状态
 const interval = setInterval(checkStatus, 2000)

 // 监听网络状态
 const handleNetworkChange = () => {
 setNetworkStatus(navigator.onLine ?'online' :'offline')
 }

 window.addEventListener('online', handleNetworkChange)
 window.addEventListener('offline', handleNetworkChange)

 // 监听WebSocket事件
 const unsubscribeConnected = wsService.on('connected', () => {
 setStatus('connected')
 setConnectionTime(new Date().toLocaleString())
 setReconnectAttempts(0)
 })

 const unsubscribeDisconnected = wsService.on('disconnected', () => {
 setStatus('disconnected')
 })

 const unsubscribeReconnectAttempt = wsService.on('reconnect_attempt', (data: any) => {
 setStatus('reconnecting')
 setReconnectAttempts(data.attempt)
 })

 const unsubscribeError = wsService.on('error', () => {
 setStatus('error')
 })

 const unsubscribeMessage = wsService.onMessage((message) => {
 setLastActivity(new Date().toLocaleTimeString())
 setStats(prev => ({
 ...prev,
 messagesReceived: prev.messagesReceived + 1,
 bytesReceived: prev.bytesReceived + JSON.stringify(message).length,
 }))
 })

 // 初始检查
 checkStatus()
 handleNetworkChange()

 return () => {
 clearInterval(interval)
 window.removeEventListener('online', handleNetworkChange)
 window.removeEventListener('offline', handleNetworkChange)
 unsubscribeConnected()
 unsubscribeDisconnected()
 unsubscribeReconnectAttempt()
 unsubscribeError()
 unsubscribeMessage()
 }
 }, [])

 const handleConnect = async () => {
 setStatus('connecting')
 const connected = await wsService.connect()
 setStatus(connected ?'connected' :'error')
 }

 const handleDisconnect = () => {
 wsService.disconnect()
 setStatus('disconnected')
 }

 const getStatusColor = () => {
 switch (status) {
 case'connected':
 return'text-success-600 dark:text-success-600'
 case'connecting':
 case'reconnecting':
 return'text-warning-600 dark:text-warning-700'
 case'error':
 return'text-error-600 dark:text-error-600'
 default:
 return'text-text-muted'
 }
 }

 const getStatusIcon = () => {
 switch (status) {
 case'connected':
 return <CheckCircle size={18} className="text-success-600" />
 case'connecting':
 case'reconnecting':
 return <RefreshCw size={18} className="text-warning-600 animate-spin" />
 case'error':
 return <AlertCircle size={18} className="text-error-600" />
 default:
 return <X size={18} className="text-text-muted" />
 }
 }

 const getStatusText = () => {
 switch (status) {
 case'connected':
 return'已连接'
 case'connecting':
 return'连接中'
 case'reconnecting':
 return `重连中 (${reconnectAttempts})`
 case'error':
 return'连接错误'
 default:
 return'未连接'
 }
 }

 const getNetworkIcon = () => {
 return networkStatus ==='online'
 ? <Wifi size={16} className="text-success-600" />
 : <Wifi size={16} className="text-error-600" />
 }

 return (
 <Card className={className}>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Pocket size={20} className="text-secondary-600 dark:text-secondary-700" />
 <CardTitle as="h3" className="text-sm font-semibold">WebSocket 状态监控</CardTitle>
 </div>
 <div className="flex items-center gap-1" title={networkStatus ==='online' ?'网络正常' :'网络离线'}>
 {getNetworkIcon()}
 <span className="text-xs font-medium">
 {networkStatus ==='online' ?'在线' :'离线'}
 </span>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {/* 连接状态 */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 {getStatusIcon()}
 <span className={`text-sm font-medium ${getStatusColor()}`}>
 {getStatusText()}
 </span>
 </div>
 <div className="flex items-center gap-2">
 {status !=='connected' && (
 <Button
 variant="primary"
 size="sm"
 onClick={handleConnect}
 disabled={status ==='connecting' || status ==='reconnecting'}
 >
 连接
 </Button>
 )}
 {status ==='connected' && (
 <Button
 variant="danger"
 size="sm"
 onClick={handleDisconnect}
 >
 断开
 </Button>
 )}
 </div>
 </div>

 {/* 延迟和活动 */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1">
 <Zap size={14} className="text-text-muted" />
 <span className="text-sm text-text-secondary">网络延迟</span>
 </div>
 <span className="text-sm font-medium">{latency}ms</span>
 </div>
 <Progress value={Math.min(100, (latency / 1000) * 100)} className="h-2" />
 </div>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1">
 <Clock size={14} className="text-text-muted" />
 <span className="text-sm text-text-secondary">最后活动</span>
 </div>
 <span className="text-sm font-medium">{lastActivity ||'无'}</span>
 </div>
 <div className="flex items-center gap-2">
 <ArrowUpDown size={16} className="text-text-disabled" />
 <span className="text-xs text-text-muted">实时数据同步</span>
 </div>
 </div>
 </div>

 {/* 数据统计 */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <div className="p-3 rounded-lg bg-neutral-700/50">
 <div className="flex items-center gap-2 mb-2">
 <BarChart3 size={16} className="text-text-muted" />
 <span className="text-xs font-medium text-text-secondary">消息统计</span>
 </div>
 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">发送</span>
 <span className="text-xs font-medium">{stats.messagesSent}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">接收</span>
 <span className="text-xs font-medium">{stats.messagesReceived}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">总计</span>
 <span className="text-xs font-medium">{stats.messagesSent + stats.messagesReceived}</span>
 </div>
 </div>
 </div>
 <div className="p-3 rounded-lg bg-neutral-700/50">
 <div className="flex items-center gap-2 mb-2">
 <Zap size={16} className="text-text-muted" />
 <span className="text-xs font-medium text-text-secondary">数据传输</span>
 </div>
 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">发送</span>
 <span className="text-xs font-medium">{Math.round(stats.bytesSent / 1024)} KB</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">接收</span>
 <span className="text-xs font-medium">{Math.round(stats.bytesReceived / 1024)} KB</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-text-secondary">总计</span>
 <span className="text-xs font-medium">{Math.round((stats.bytesSent + stats.bytesReceived) / 1024)} KB</span>
 </div>
 </div>
 </div>
 </div>

 {/* 连接信息 */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
 <div className="p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-100 dark:border-secondary-800/30">
 <div className="flex items-center gap-2 mb-2">
 <AlertTriangle size={16} className="text-secondary-600 dark:text-secondary-700" />
 <span className="text-xs font-medium text-secondary-800 dark:text-secondary-700">连接信息</span>
 </div>
 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-xs text-secondary-600 dark:text-secondary-700">连接时间</span>
 <span className="text-xs font-medium">{connectionTime ||'未连接'}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-secondary-600 dark:text-secondary-700">重连次数</span>
 <span className="text-xs font-medium">{reconnectAttempts}</span>
 </div>
 </div>
 </div>
 <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/70">
 <div className="flex items-center gap-2 mb-2">
 <Pocket size={16} className="text-text-muted" />
 <span className="text-xs font-medium text-text-secondary">连接ID</span>
 </div>
 <div className="text-xs font-mono surface-card px-2 py-1 rounded overflow-hidden">
 {wsService.getConnectionId().slice(0, 12)}...
 </div>
 </div>
 </div>

 {/* 状态说明 */}
 <div className="mt-4 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/50">
 <h4 className="text-xs font-semibold text-text-secondary mb-2">状态说明</h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <div className="flex items-center gap-2">
 <CheckCircle size={14} className="text-success-600" />
 <span className="text-xs text-text-secondary">已连接</span>
 </div>
 <div className="flex items-center gap-2">
 <RefreshCw size={14} className="text-warning-600" />
 <span className="text-xs text-text-secondary">连接中/重连中</span>
 </div>
 <div className="flex items-center gap-2">
 <AlertCircle size={14} className="text-error-600" />
 <span className="text-xs text-text-secondary">连接错误</span>
 </div>
 <div className="flex items-center gap-2">
 <X size={14} className="text-text-muted" />
 <span className="text-xs text-text-secondary">未连接</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )
}
