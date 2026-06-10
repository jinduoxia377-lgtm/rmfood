import { useState, useCallback } from 'react'

export interface GenerationProgress {
  stage: 'idle' | 'preparing' | 'generating' | 'optimizing' | 'validating' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTimeRemaining?: number
  canCancel: boolean
}

export function useGenerationProgress() {
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: '',
    canCancel: false,
  })

  const startProgress = useCallback((message: string) => {
    setProgress({
      stage: 'preparing',
      progress: 10,
      message,
      canCancel: true,
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
    }))
  }, [])

  const completeProgress = useCallback(() => {
    setProgress({
      stage: 'complete',
      progress: 100,
      message: '生成完成',
      canCancel: false,
    })
  }, [])

  const errorProgress = useCallback((message: string) => {
    setProgress({
      stage: 'error',
      progress: 0,
      message,
      canCancel: false,
    })
  }, [])

  const resetProgress = useCallback(() => {
    setProgress({
      stage: 'idle',
      progress: 0,
      message: '',
      canCancel: false,
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
