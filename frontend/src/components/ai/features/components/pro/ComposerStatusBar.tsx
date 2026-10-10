/**
 * ComposerStatusBar — DSH StatsLine 风格会话状态条 (v2.0)
 *
 * 设计原则（对标 DSH StatsLine）：
 * - 紧凑单行，极低视觉权重
 * - 关键指标：轮次、TTFT（首 token 延迟）、吞吐量、模型
 * - 仅在对话有内容时显示
 *
 * @version 2.0.0
 */
import React from 'react'
import { Cpu, Clock, Zap, Activity } from 'lucide-react'

interface ComposerStatusBarProps {
  messageCount: number
  assistantCount: number
  elapsedSeconds?: number
  modelName?: string
  ragStatus?: string | null
  /** TTFT（毫秒），对应 DSH 的 ttftMs */
  ttftMs?: number
  /** 生成速度（tokens/秒），对应 DSH 的 tokensPerSecond */
  tokensPerSecond?: number
  /** 上下文使用量（tokens） */
  contextTokens?: number
  /** 上下文上限（tokens） */
  contextLimit?: number
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1000000).toFixed(1)}M`
}

export default function ComposerStatusBar({
  messageCount,
  assistantCount,
  elapsedSeconds,
  modelName,
  ragStatus,
  ttftMs,
  tokensPerSecond,
  contextTokens,
  contextLimit,
}: ComposerStatusBarProps) {
  // 仅在有实质性内容时显示
  if (messageCount === 0 && !elapsedSeconds && !ttftMs) return null

  const contextPercent = contextTokens && contextLimit
    ? Math.round((contextTokens / contextLimit) * 100)
    : null

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] select-none flex-wrap">
      {/* 对话轮次 */}
      {assistantCount > 0 && (
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          <span>{assistantCount} 轮</span>
        </span>
      )}

      {/* TTFT */}
      {ttftMs !== undefined && ttftMs > 0 && (
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>TTFT {ttftMs < 1000 ? `${ttftMs}ms` : `${(ttftMs / 1000).toFixed(1)}s`}</span>
        </span>
      )}

      {/* 吞吐量 */}
      {tokensPerSecond !== undefined && tokensPerSecond > 0 && (
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>{tokensPerSecond.toFixed(1)} tok/s</span>
        </span>
      )}

      {/* 对话时长 */}
      {elapsedSeconds !== undefined && elapsedSeconds > 0 && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m${elapsedSeconds % 60 > 0 ? `${elapsedSeconds % 60}s` : ''}`}</span>
        </span>
      )}

      {/* 消息总数 */}
      {messageCount > 0 && (
        <span className="flex items-center gap-1">
          <span>·</span>
          <span>{messageCount} 条</span>
        </span>
      )}

      {/* 上下文占用 */}
      {contextPercent !== null && (
        <>
          <span className="flex items-center gap-1">
            <span>·</span>
            <span className={contextPercent > 80 ? 'text-warning-500' : contextPercent > 60 ? 'text-warning-600 dark:text-warning-700' : ''}>
              {formatTokens(contextTokens!)} / {formatTokens(contextLimit!)}
            </span>
          </span>
        </>
      )}

      {/* 模型标签 */}
      {modelName && (
        <>
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
          <span className="hidden sm:inline text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{modelName}</span>
        </>
      )}

      {/* RAG 状态 */}
      {ragStatus && (
        <>
          <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">·</span>
          <span className={ragStatus === '知识库就绪' ? 'text-success-500/70' : 'text-warning-500/70'}>
            {ragStatus}
          </span>
        </>
      )}
    </div>
  )
}
