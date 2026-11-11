/**
 * 异步图谱分析 Hook（②b）。
 *
 * 封装「提交异步任务→轮询→缓存直返」通用流程，暴露与原同步 useQuery 兼容的
 * { data, isLoading, isError, error } 形状，便于替换 getCentrality/getCommunities/getKCore。
 */
import { useEffect, useRef, useState } from 'react'
import { runKgAnalysis, type KgAsyncKind } from './kgAsyncAnalysis'

export interface KgAsyncState<T> {
  data: T | null
  isLoading: boolean
  isError: boolean
  error: string | null
  /** 任务是否正在后台运行（用于显示进度） */
  running: boolean
}

/**
 * @param kind      分析类型 betweenness/communities/kcore
 * @param enabled   是否触发（类比 useQuery.enabled）
 * @param transform 把后端 result 映射为组件期望的数据形状
 */
export function useKgAsyncAnalysis<T = any>(
  kind: KgAsyncKind,
  enabled: boolean,
  transform?: (result: any) => T,
): KgAsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const myRun = ++runIdRef.current
    let disposed = false
    setIsLoading(true)
    setIsError(false)
    setError(null)
    setRunning(true)

    ;(async () => {
      try {
        const result = await runKgAnalysis(kind, (status) => {
          if (disposed || myRun !== runIdRef.current) return
          // running 状态已由 setRunning 表达，此处可扩展进度
          void status
        })
        if (disposed || myRun !== runIdRef.current) return
        setData(transform ? transform(result) : result)
      } catch (e: any) {
        if (disposed || myRun !== runIdRef.current) return
        setIsError(true)
        setError(e?.message || '分析失败')
      } finally {
        if (!disposed && myRun === runIdRef.current) {
          setIsLoading(false)
          setRunning(false)
        }
      }
    })()

    return () => {
      disposed = true
      // 注意：不中断后台任务，仅忽略过期结果（任务在服务端继续，结果会进缓存）
    }
  }, [kind, enabled])

  return { data, isLoading, isError, error, running }
}