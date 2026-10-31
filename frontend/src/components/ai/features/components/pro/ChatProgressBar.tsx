/**
 * ChatProgressBar — 对话实时进度条（真实事件驱动）
 *
 * 由后端 SSE `progress` 事件 + 前端本地阶段共同驱动：
 * - 展示 2px 渐变进度线 + 当前阶段文字 + 已生成字数 + 步骤指示器（检索/辨证/生成/校验）
 * - 状态：active（确定进度）/ indeterminate（非流式降级）/ done（淡出）/ error（变红淡出）
 * - 位置：输入框上方（由 ChatTab 挂载）
 */
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Check, CircleAlert } from 'lucide-react'
import { useChatState } from '../../ChatStateContext'

const STEP_KEYS = [
  { key: 'retrieval', labelKey: 'ai.chat.progress.stepRetrieval' },
  { key: 'dialectics', labelKey: 'ai.chat.progress.stepDialectics' },
  { key: 'generating', labelKey: 'ai.chat.progress.stepGenerating' },
  { key: 'safety', labelKey: 'ai.chat.progress.stepSafety' },
]

export function ChatProgressBar() {
  const { t } = useTranslation()
  const { streamProgress, streamStageKey, streamChars, streamStatus, streamSteps } = useChatState()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)

  // 根据 streamStatus 控制可见性与淡出。
  // 所有 setState 均放入 setTimeout 回调（React hooks 规则禁止在 effect 体内同步 setState）。
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    if (streamStatus === 'active' || streamStatus === 'indeterminate') {
      timers.push(setTimeout(() => {
        setFading(false)
        setVisible(true)
      }, 0))
    } else if (streamStatus === 'done') {
      timers.push(setTimeout(() => {
        setFading(true)
        timers.push(setTimeout(() => setVisible(false), 600))
      }, 600))
    } else if (streamStatus === 'error') {
      timers.push(setTimeout(() => {
        setFading(true)
        timers.push(setTimeout(() => setVisible(false), 600))
      }, 2000))
    } else {
      // idle：立即隐藏
      timers.push(setTimeout(() => setVisible(false), 0))
    }
    return () => timers.forEach(clearTimeout)
  }, [streamStatus])

  if (!visible) return null

  const isIndeterminate = streamStatus === 'indeterminate'
  const isError = streamStatus === 'error'
  const width = isIndeterminate ? 100 : Math.max(0, Math.min(100, streamProgress))

  return (
    <div
      className={`px-4 pt-2 pb-1 flex items-center gap-2 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-live="polite"
      aria-label={t('ai.chat.progress.progressBarAria')}
    >
      {/* 阶段文字 + 已生成字数 */}
      <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0">
        <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isError ? 'text-error-500' : 'text-primary-500'}`} />
        <span className={`text-xs truncate ${isError ? 'text-error-600' : 'text-neutral-600 dark:text-neutral-400'}`}>
          {isError
            ? t('ai.chat.progress.failed')
            : streamStageKey
              ? t(streamStageKey)
              : t('ai.chat.progress.preparing')}
        </span>
        {!isError && !isIndeterminate && streamStageKey.includes('generating') && streamChars > 0 && (
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex-shrink-0">
            {t('ai.chat.progress.generatedChars', { count: streamChars })}
          </span>
        )}
      </div>

      {/* 2px 渐变进度线 */}
      <div className="flex-1 h-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
            isError
              ? 'bg-error-500'
              : 'bg-gradient-to-r from-primary-500 to-success-500'
          } ${isIndeterminate ? 'animate-pulse' : ''}`}
          style={{ width: isIndeterminate ? '100%' : `${width}%` }}
        />
      </div>

      {/* 百分比数字（indeterminate / error 时不显示） */}
      {!isIndeterminate && !isError && (
        <span className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400 flex-shrink-0 w-8 text-right">
          {Math.round(width)}%
        </span>
      )}

      {/* 步骤指示器（圆点 + 连接线，完成/当前/待处理三种状态） */}
      {!isError && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {STEP_KEYS.map((step, idx) => {
            const state = streamSteps.find(s => s.key === step.key)?.status || 'pending'
            const prevState = idx > 0 ? streamSteps.find(s => s.key === STEP_KEYS[idx - 1].key)?.status || 'pending' : 'done'
            return (
              <React.Fragment key={step.key}>
                {/* 步骤间连接线：前一步完成则高亮 */}
                {idx > 0 && (
                  <div className={`w-2 h-px flex-shrink-0 ${prevState === 'done' ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
                )}
                <span
                  className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${
                    state === 'done'
                      ? 'bg-success-50 dark:bg-success-300/10 border-success-300 dark:border-success-700 text-success-700 dark:text-success-600'
                      : state === 'active'
                        ? 'bg-primary-50 dark:bg-primary-300/10 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-600 animate-pulse'
                        : 'bg-transparent border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {state === 'done' ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : state === 'active' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full border border-current" />
                  )}
                  {t(step.labelKey)}
                </span>
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* 错误图标（error 态右侧） */}
      {isError && <CircleAlert className="w-3.5 h-3.5 text-error-500 flex-shrink-0" />}
    </div>
  )
}

export default ChatProgressBar