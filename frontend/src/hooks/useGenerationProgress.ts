import { useState, useCallback } from 'react'

export interface GenerationProgress {
  stage: 'idle' | 'preparing' | 'generating' | 'optimizing' | 'validating' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTimeRemaining?: number
  canCancel: boolean
  /** 不确定进度：为 true 时 UI 显示滑动动画而不是伪百分比（用于请求等待期，避免假进度） */
  indeterminate?: boolean
}

export function useGenerationProgress() {
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: '',
    canCancel: false,
    indeterminate: false,
  })

  const startProgress = useCallback((message: string) => {
    setProgress({
      stage: 'preparing',
      progress: 10,
      message,
      canCancel: true,
      // P1-1：请求等待期使用不确定进度，不展示伪造百分比
      indeterminate: true,
    })
  }, [])

  const updateProgress = useCallback((stage: GenerationProgress['stage'], progressValue: number, message: string, estimatedTime?: number) => {
    setProgress(prev => ({
      ...prev,
      stage,
      progress: progressValue,
      message,
      estimatedTimeRemaining: estimatedTime,
      canCancel: stage !== 'complete' && stage !== 'error',
      indeterminate: false,
    }))
  }, [])

  const completeProgress = useCallback(() => {
    setProgress({
      stage: 'complete',
      progress: 100,
      message: '生成完成',
      canCancel: false,
      indeterminate: false,
    })
  }, [])

  const errorProgress = useCallback((message: string) => {
    setProgress({
      stage: 'error',
      progress: 0,
      message,
      canCancel: false,
      indeterminate: false,
    })
  }, [])

  const resetProgress = useCallback(() => {
    setProgress({
      stage: 'idle',
      progress: 0,
      message: '',
      canCancel: false,
      indeterminate: false,
    })
  }, [])

  return {
    progress,
    startProgress,
    updateProgress,
    completeProgress,
    errorProgress,
    resetProgress,
  }
}
