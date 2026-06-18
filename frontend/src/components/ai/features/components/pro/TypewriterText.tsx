/**
 * TypewriterText — 打字机动画组件
 *
 * 逐字显示 AI 回复内容，模拟实时生成效果。
 * 支持：
 * - 可调速度
 * - 完成回调
 * - Markdown 兼容（逐块渲染）
 * - 跳跃完成（点击加速）
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

interface TypewriterTextProps {
  content: string
  speed?: number        // 每字毫秒数（默认 30）
  chunkSize?: number     // 每次显示字数（默认 3）
  onComplete?: () => void
  enabled?: boolean      // 是否启用动画（默认 true）
}

export default function TypewriterText({
  content,
  speed = 30,
  chunkSize = 3,
  onComplete,
  enabled = true,
}: TypewriterTextProps) {
  // 长内容自动跳过动画 — 避免不完整 Markdown 渲染导致内容丢失
  const isLongContent = content.length > 800
  const autoComplete = !enabled || isLongContent
  const [displayedLen, setDisplayedLen] = useState(autoComplete ? content.length : 0)
  const [isComplete, setIsComplete] = useState(autoComplete)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)

  // 点击跳过动画
  const skipToEnd = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setDisplayedLen(content.length)
    setIsComplete(true)
    if (!completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }, [content.length, onComplete])

  useEffect(() => {
    if (!enabled || !content || isLongContent) {
      setDisplayedLen(content.length)
      setIsComplete(true)
      return
    }

    // 重置
    setDisplayedLen(0)
    setIsComplete(false)
    completedRef.current = false

    // 动态速度: 内容越长速度越快
    const adaptiveChunkSize = content.length > 300 ? 8 : content.length > 100 ? 5 : chunkSize
    const adaptiveSpeed = content.length > 500 ? 10 : speed

    timerRef.current = setInterval(() => {
      setDisplayedLen(prev => {
        const next = prev + adaptiveChunkSize
        if (next >= content.length) {
          clearInterval(timerRef.current!)
          setIsComplete(true)
          // 延迟回调确保状态更新
          setTimeout(() => {
            if (!completedRef.current) {
              completedRef.current = true
              onComplete?.()
            }
          }, 50)
          return content.length
        }
        return next
      })
    }, speed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [content, enabled, speed, chunkSize, onComplete])

  // 不做动画时直接渲染
  if (!enabled || isComplete) {
    return (
      <div onClick={skipToEnd} className="cursor-default">
        <MarkdownRenderer content={content} />
      </div>
    )
  }

  // 逐字模式：渲染已显示的部分
  const visibleText = content.slice(0, displayedLen)

  // 计算百分比
  const progress = content.length > 0 ? (displayedLen / content.length) * 100 : 100

  return (
    <div onClick={skipToEnd} className="cursor-default group relative">
      <MarkdownRenderer content={visibleText} />

      {/* 闪烁光标 */}
      {displayedLen < content.length && (
        <span className="inline-block w-0.5 h-4 bg-primary-500 animate-pulse ml-0.5 align-text-bottom" />
      )}

      {/* 进度条（极简） */}
      {displayedLen < content.length && (
        <div className="h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="h-full bg-primary-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
