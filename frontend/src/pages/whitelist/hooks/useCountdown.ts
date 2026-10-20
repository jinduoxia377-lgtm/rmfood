/**
 * useCountdown — 服务端时间锚点驱动的倒计时 hook
 *
 * 特性:
 * - 接收服务端 UTC deadline（ISO 字符串），每秒按差值重算，防本地改时钟
 * - 通过 serverTimeIso（响应中的 server_time）计算稳定的时钟偏移
 * - visibilitychange 时立即校正；document.hidden 时暂停 interval（省电）
 * - 返回天/时/分/秒与 expired，供页面渲染
 */
import { useEffect, useRef, useState } from 'react'

export interface CountdownValue {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
  expired: boolean
}

const EMPTY: CountdownValue = { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: false }

function compute(deadlineMs: number, serverNowMs: number): CountdownValue {
  const remaining = deadlineMs - serverNowMs
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true }
  }
  const totalSec = Math.floor(remaining / 1000)
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs: remaining,
    expired: false,
  }
}

/**
 * @param deadlineIso  服务端下发的截止时间（UTC ISO），为空时不启动
 * @param serverTimeIso 服务端下发响应时的 server_time（UTC ISO），用于校正本地时钟偏移
 */
export function useCountdown(deadlineIso?: string | null, serverTimeIso?: string | null): CountdownValue {
  const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : NaN
  const [tick, setTick] = useState(0)

  // 稳定时钟偏移：serverRef + (Date.now() - clientRef) = 服务端当前时间
  const offsetRef = useRef<{ serverRef: number; clientRef: number } | null>(null)
  useEffect(() => {
    if (serverTimeIso) {
      const serverRef = new Date(serverTimeIso).getTime()
      if (!Number.isNaN(serverRef)) {
        offsetRef.current = { serverRef, clientRef: Date.now() }
      }
    }
  }, [serverTimeIso])

  useEffect(() => {
    if (!deadlineIso || Number.isNaN(deadlineMs)) return

    const tickNow = () => setTick((t) => t + 1)
    const onVisible = () => {
      // 从后台切回时立即校正，避免 interval 被浏览器节流导致漂移
      tickNow()
    }

    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => {
      if (!document.hidden) tickNow()
    }, 1000)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deadlineIso, deadlineMs])

  if (!deadlineIso || Number.isNaN(deadlineMs)) return EMPTY

  const serverNowMs = offsetRef.current
    ? offsetRef.current.serverRef + (Date.now() - offsetRef.current.clientRef)
    : Date.now()

  // 每秒 tick 一次，重新计算
  void tick
  return compute(deadlineMs, serverNowMs)
}

/** 将倒计时格式化为 时:分:秒（用于视觉文本） */
export function formatCountdown(value: CountdownValue): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(value.hours)}:${pad(value.minutes)}:${pad(value.seconds)}`
}

/** 生成供屏幕阅读器每分钟播报一次的「预计剩余 N 分钟」摘要 */
export function getAnnouncedRemaining(value: CountdownValue): string {
  if (value.expired) return ''
  return String(Math.max(1, Math.ceil(value.totalMs / 60000)))
}