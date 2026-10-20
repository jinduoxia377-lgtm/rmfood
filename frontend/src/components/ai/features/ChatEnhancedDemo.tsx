/**
 * ChatEnhancedDemo - AI 智能对话完整集成示例
 *
 * 展示 v7.0 深度完善后的所有新功能的集成使用：
 * - 性能监控 (usePerformanceMonitor)
 * - 离线支持 (useOfflineManager)
 * - 智能缓存 (SmartCache)
 * - Web Worker (useChatWorker)
 *
 * @version 7.1.0
 */

import { logger } from '@/utils/safeLogger'
import React, { useState, useCallback } from 'react'
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor'
import { useOfflineManager } from './hooks/useOfflineManager'
import { useChatWorker } from './utils/chatWorker'
import { chatMessageCache, formulaCache } from './utils/smartCache'

interface ChatEnhancedDemoProps {
  showPerformanceMonitor?: boolean
  showOfflineIndicator?: boolean
  enableWorker?: boolean
}

export function ChatEnhancedDemo({
  showPerformanceMonitor = true,
  showOfflineIndicator = true,
  enableWorker = false,
}: ChatEnhancedDemoProps) {

  // ===== 1. 性能监控 =====
  const {
    currentFPS,
    memoryUsageMB,
    isMonitoring,
    isHealthy,
    memoryStatus,
    fpsStatus,
    getReport,
    start: startMonitoring,
    stop: stopMonitoring,
  } = usePerformanceMonitor({
    autoStart: showPerformanceMonitor,
    samplingInterval: 3000,
    thresholds: {
      memoryWarningMB: 150,
      memoryCriticalMB: 250,
      fpsWarning: 30,
      renderTimeWarningMs: 100,
    },
  })

  // ===== 2. 离线管理 =====
  const {
    isOnline,
    queueSize,
    enqueueMessage,
    syncNow,
    statusText,
    statusColor,
    showSyncButton,
    syncButtonText,
  } = useOfflineManager({
    enabled: showOfflineIndicator,
    maxQueueSize: 50,
    maxRetries: 3,
    storageKey: 'rmfood_demo_offline_queue',
    onStatusChange: (status) => {
      logger.log(`[Demo] 离线状态变更: ${status}`)
    },
    onSyncComplete: (success, failed) => {
      logger.log(`[Demo] 同步完成: ${success} 成功, ${failed} 失败`)
    },
  })

  // ===== 3. Web Worker（可选）=====
  const {
    isReady: workerReady,
    isProcessing: workerProcessing,
    exportData: workerExportData,
    processText: workerProcessText,
  } = useChatWorker({
    autoInit: enableWorker,
  })

  // ===== 4. UI State =====
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<{ id: string; content: string; role: string }[]>([])
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 })
  const [showReportModal, setShowReportModal] = useState(false)

  // ===== 处理函数 =====

  /**
   * 发送消息（带离线支持和缓存）
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return

    const userMessage = {
      id: crypto.randomUUID(),
      content: inputValue,
      role: 'user' as const,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])

    try {
      if (!isOnline) {
        // 离线模式：加入队列
        await enqueueMessage(inputValue)

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          content: '📴 消息已保存到离线队列，将在联网后发送',
          role: 'system' as const,
        }])

        setInputValue('')
        return
      }

      // 在线模式：检查缓存
      const cacheKey = `msg_${inputValue.slice(0, 50)}`
      let response = chatMessageCache.get(cacheKey)

      if (response) {
        // 缓存命中
        logger.log('[Demo] 💾 命中消息缓存')
        setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }))
      } else {
        // 缓存未命中，模拟 API 调用
        logger.log('[Demo] ❌ 未命中缓存，调用 API')
        setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }))

        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

        // eslint-disable-next-line react-hooks/immutability
        response = generateMockResponse(inputValue)

        // 写入缓存（TTL: 5 分钟）
        chatMessageCache.set(cacheKey, response, 5 * 60 * 1000)
      }

      // 添加 AI 回复
      const aiMessage = {
        id: crypto.randomUUID(),
        content: response as string,
        role: 'assistant' as const,
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev, aiMessage])
      setInputValue('')

    } catch (error) {
      logger.error('[Demo] 发送失败:', error)

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: '❌ 发送失败，请重试',
        role: 'error' as const,
      }])
    }
  }, [inputValue, isOnline, enqueueMessage])

  /**
   * 使用 Worker 导出数据
   */
  const handleWorkerExport = useCallback(async () => {
    if (!workerReady || messages.length === 0) return

    try {
      const result = await workerExportData({
        data: messages,
        format: 'json',
        options: { prettyPrint: true },
      })

      // 触发下载
      const blob = new Blob([result], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chat-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      logger.log('[Demo] ✅ Worker 导出完成')

    } catch (error) {
      logger.error('[Demo] Worker 导出失败:', error)
    }
  }, [workerReady, messages, workerExportData])

  /**
   * 使用 Worker 处理文本
   */
  const handleWorkerProcess = useCallback(async () => {
    if (!workerReady) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== 'assistant') return

    try {
      const htmlResult = await workerProcessText({
        content: lastMessage.content,
        operation: 'markdown-to-html',
      })

      logger.log('[Demo] 📝 Markdown 转换完成:', htmlResult.slice(0, 100))

    } catch (error) {
      logger.error('[Demo] 文本处理失败:', error)
    }
  }, [workerReady, messages, workerProcessText])

  // ===== 辅助函数 =====

  function generateMockResponse(question: string): string {
    const responses = [
      `关于"${question}"的详细回答：\n\n这是一个包含技术细节、实验数据和行业案例的完整回复。活性肽的主要来源包括植物蛋白、动物蛋白和微生物发酵产物。`,
      `好的！让我为您解答关于${question}的问题...\n\n**关键要点**：\n1. 来源多样化\n2. 提取工艺成熟\n3. 应用前景广阔`,
      `收到您的问题："${question}"\n\n根据最新研究，功能性食品配方的开发趋势正朝着天然、健康、高效的方向发展。以下是详细分析...`,
    ]

    return responses[Math.floor(Math.random() * responses.length)]
  }

  // ===== 渲染 =====

  return (
    <div className="chat-enhanced-demo p-6 max-w-4xl mx-auto">
      {/* 标题 */}
      <h1 className="text-3xl font-bold mb-4 text-center">
        🚀 AI 智能对话 v7.0 完整集成示例
      </h1>
      <p className="text-center text-neutral-600 mb-8">
        展示性能监控 · 离线支持 · 智能缓存 · Web Worker
      </p>

      {/* 状态指示器栏 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* 性能状态 */}
        <div className={`p-4 rounded-lg border ${
          memoryStatus === 'critical' ? 'bg-error-50 border-error-200' :
          memoryStatus === 'warning' ? 'bg-warning-50 border-warning-200' :
          'bg-success-50 border-success-200'
        }`}>
          <h3 className="font-semibold mb-2">💾 内存</h3>
          <p className="text-sm">{memoryUsageMB.toFixed(1)} MB</p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">FPS: {currentFPS}</p>
          <p className={`text-xs font-medium ${
            fpsStatus === 'good' ? 'text-success-600' :
            fpsStatus === 'acceptable' ? 'text-warning-600' : 'text-error-600'
          }`}>
            {fpsStatus === 'good' ? '✅ 流畅' : fpsStatus === 'acceptable' ? '⚠️ 一般' : '❌ 卡顿'}
          </p>
        </div>

        {/* 离线状态 */}
        <div className={`p-4 rounded-lg border ${
          statusColor === 'green' ? 'bg-success-50 border-success-200' :
          statusColor === 'red' ? 'bg-error-50 border-error-200' :
          statusColor === 'blue' ? 'bg-secondary-50 border-secondary-200' :
          'bg-neutral-50 dark:bg-neutral-800 border-neutral-200'
        }`}>
          <h3 className="font-semibold mb-2">🌐 网络</h3>
          <p className="text-sm">{statusText}</p>
          {queueSize > 0 && (
            <p className="text-xs text-warning-600">
              待同步: {queueSize} 条
            </p>
          )}
          {showSyncButton && (
            <button
              onClick={syncNow}
              className="mt-2 px-3 py-1 bg-secondary-container text-secondary-main rounded text-xs hover:bg-secondary-container"
            >
              {syncButtonText}
            </button>
          )}
        </div>

        {/* 缓存统计 */}
        <div className="p-4 rounded-lg border bg-accent-50 border-accent-200">
          <h3 className="font-semibold mb-2">⚡ 缓存</h3>
          <p className="text-sm">
            命中: {cacheStats.hits} | 未命中: {cacheStats.misses}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            命中率: {((cacheStats.hits / Math.max(1, cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4 bg-white dark:bg-neutral-900">
        {messages.length === 0 ? (
          <div className="text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-20">
            发送一条消息开始对话...
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`mb-3 p-3 rounded-lg ${
                msg.role === 'user' ? 'bg-secondary-100 ml-12' :
                msg.role === 'assistant' ? 'bg-neutral-100 dark:bg-neutral-800 mr-12' :
                msg.role === 'system' ? 'bg-warning-50 mx-12' :
                'bg-error-50 mx-12'
              }`}
            >
              <div className="text-xs font-semibold mb-1 text-neutral-600">
                {msg.role === 'user' ? '👤 您' :
                 msg.role === 'assistant' ? '🤖 AI' :
                 msg.role === 'system' ? '💾 系统' : '❌ 错误'}
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
      </div>

      {/* 输入区域 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="输入问题... (按 Enter 发送)"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-400"
          disabled={!isOnline && queueSize >= 50}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim()}
          className="px-6 py-2 bg-secondary-container text-secondary-main rounded-lg hover:bg-secondary-container disabled:bg-neutral-300"
        >
          {isOnline ? '发送' : '保存到队列'}
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {/* 性能报告 */}
        <button
          onClick={() => setShowReportModal(true)}
          className="px-4 py-2 bg-accent-100 text-accent-700 rounded hover:bg-accent-200"
        >
          📊 性能报告
        </button>

        {/* Worker 导出 */}
        {enableWorker && (
          <>
            <button
              onClick={handleWorkerExport}
              disabled={!workerReady || workerProcessing || messages.length === 0}
              className="px-4 py-2 bg-success-100 text-success-700 rounded hover:bg-success-200 disabled:opacity-50"
            >
              ⬇️ Worker 导出 {workerProcessing ? '(处理中...)' : ''}
            </button>

            <button
              onClick={handleWorkerProcess}
              disabled={!workerReady || workerProcessing}
              className="px-4 py-2 bg-accent-100 text-accent-700 rounded hover:bg-accent-200 disabled:opacity-50"
            >
              🔧 Worker 文本处理
            </button>
          </>
        )}

        {/* 清空缓存 */}
        <button
          onClick={() => {
            chatMessageCache.clear()
            formulaCache.clear()
            setCacheStats({ hits: 0, misses: 0 })
          }}
          className="px-4 py-2 bg-error-100 text-error-700 rounded hover:bg-error-200"
        >
          🗑️ 清空缓存
        </button>

        {/* 切换监控 */}
        <button
          onClick={() => isMonitoring ? stopMonitoring() : startMonitoring()}
          className={`px-4 py-2 rounded ${
            isMonitoring
              ? 'bg-warning-100 text-warning-700 hover:bg-warning-200'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          {isMonitoring ? '⏸️ 停止监控' : '▶️ 启动监控'}
        </button>
      </div>

      {/* 性能报告 Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">📊 性能监控报告</h2>

            <pre className="bg-neutral-900 text-success-400 p-4 rounded text-sm overflow-x-auto">
              {getReport()}
            </pre>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>内存状态:</strong> {memoryStatus.toUpperCase()}
              </div>
              <div>
                <strong>FPS 状态:</strong> {fpsStatus.toUpperCase()}
              </div>
              <div>
                <strong>是否健康:</strong> {isHealthy ? '✅ 是' : '❌ 否'}
              </div>
              <div>
                <strong>当前 FPS:</strong> {currentFPS}
              </div>
            </div>

            <button
              onClick={() => setShowReportModal(false)}
              className="mt-4 w-full px-4 py-2 bg-neutral-200 rounded hover:bg-neutral-300"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 功能说明 */}
      <div className="mt-8 p-4 bg-gradient-to-r from-secondary-50 to-accent-50 rounded-lg">
        <h3 className="font-bold mb-2">✨ 已集成的 v7.0 新功能：</h3>
        <ul className="text-sm space-y-1 text-neutral-700">
          <li>✅ <strong>性能监控</strong>: 实时追踪内存/FPS/渲染时间，自动告警</li>
          <li>✅ <strong>离线支持</strong>: 断网时自动保存消息，恢复后智能同步</li>
          <li>✅ <strong>智能缓存</strong>: LRU/LFU 混合淘汰算法，减少重复请求</li>
          <li>✅ <strong>Web Worker</strong>: 大数据量导出不阻塞主线程</li>
          <li>✅ <strong>TypeScript</strong>: 完整类型安全，零 any 类型</li>
          <li>✅ <strong>Logger 统一</strong>: 零 console 泄露，生产环境安全</li>
        </ul>
      </div>
    </div>
  )
}

// ===== 默认导出 =====

export default ChatEnhancedDemo
