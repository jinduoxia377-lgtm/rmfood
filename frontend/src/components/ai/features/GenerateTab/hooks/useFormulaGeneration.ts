import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '@/api/ai'
import type { AICandidate } from '@/api/ai'
import { useGenerationProgress } from '@/hooks/useGenerationProgress'
import { useOperationFeedback } from '@/hooks/useOperationFeedback'
import { DEFAULTS, ERROR_MESSAGES } from '@/config'
import { logger } from '@/utils/safeLogger'
import { AppError, ErrorFactory } from '@/utils/errorHandler'
import { getUserMessage } from '@/constants/errorCodes'

type GeneratorType = 'rule_engine' | 'llm' | 'neural_network'

interface EffectOption {
  id: string
  label: string
  category: string
  popular: boolean
}

interface UseFormulaGenerationOptions {
  effectLabels: string[]
  selectedEffects: EffectOption[]
  onGenerateSuccess?: (candidates: AICandidate[]) => void
}

interface GenerationResult {
  candidates: AICandidate[]
  total: number
  generator: string
}

export function useFormulaGeneration({
  effectLabels,
  selectedEffects,
  onGenerateSuccess,
}: UseFormulaGenerationOptions) {
  const queryClient = useQueryClient()
  const feedback = useOperationFeedback()
  const {
    progress,
    startProgress,
    updateProgress,
    completeProgress,
    errorProgress,
    resetProgress,
  } = useGenerationProgress()

  const [generateResult, setGenerateResult] = useState<AICandidate[] | null>(null)
  const [generator, setGenerator] = useState<GeneratorType>('rule_engine')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const generateTimer = useRef<ReturnType<typeof logger.startTimer> | null>(null)

  const mutation = useMutation({
    mutationFn: async (effects: string[]): Promise<GenerationResult> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const startTime = performance.now()
      setErrorMessage(null)

      startProgress(DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_PREPARING)

      try {
        updateProgress('preparing', 10, DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_PARSING, 5)

        const result = await aiApi.generate(
          effects,
          undefined,
          false,
          abortControllerRef.current.signal,
        )

        updateProgress('generating', 30, DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_PROCESSING, 10)

        updateProgress('optimizing', 60, DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_OPTIMIZING, 8)

        updateProgress('validating', 80, DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_VALIDATING, 5)

        const endTime = performance.now()
        logger.info('配方生成API响应时间', {
          duration: endTime - startTime,
          unit: 'ms',
        })

        // 增强类型检查和数据验证
        if (!result) {
          logger.error('配方生成API返回空结果')
          throw ErrorFactory.ai.responseEmpty()
        }

        if (!result.candidates || !Array.isArray(result.candidates)) {
          logger.error('配方生成API返回无效的candidates数据', { result })
          throw ErrorFactory.ai.responseEmpty()
        }

        if (result.candidates.length === 0) {
          logger.warn('配方生成API返回空的候选列表')
        }

        // 验证每个候选对象的基本结构
        const validatedCandidates = result.candidates.map((candidate, index) => {
          if (!candidate.id) {
            logger.warn(`候选${index}缺少id，自动生成`, { candidate })
            candidate.id = `auto_${index}_${Date.now()}`
          }
          if (!candidate.name) {
            candidate.name = candidate.formula_name || `配方方案${index + 1}`
          }
          return candidate
        })

        return {
          candidates: validatedCandidates,
          total: validatedCandidates.length,
          generator: result.generator || 'rule_engine',
        }
      } catch (error) {
        const endTime = performance.now()
        logger.error('配方生成API错误', {
          duration: endTime - startTime,
          error: error instanceof Error ? error.message : String(error),
          errorType: Object.prototype.toString.call(error),
        })

        if (error instanceof Error && error.name === 'AbortError') {
          logger.info('配方生成请求已取消')
          throw error
        }

        let enhancedError: AppError

        if (error instanceof AppError) {
          enhancedError = error
        } else if (error instanceof Error) {
          const errorStr = error.message

          if (errorStr.includes('NetworkError') || errorStr.includes('Failed to fetch') || errorStr.includes('ECONNREFUSED')) {
            enhancedError = ErrorFactory.network()
          } else if (errorStr.includes('timeout') || errorStr.includes('Timeout') || errorStr.includes('ETIMEDOUT')) {
            enhancedError = ErrorFactory.timeout()
          } else if (errorStr.includes('401') || errorStr.includes('403') || errorStr.includes('Unauthorized') || errorStr.includes('认证')) {
            enhancedError = ErrorFactory.auth.permissionDenied()
          } else if (errorStr.includes('500') || errorStr.includes('Internal Server Error')) {
            enhancedError = ErrorFactory.serverError()
          } else {
            enhancedError = new AppError({ code: 'COMMON_UNKNOWN', message: errorStr, originalError: error })
          }
        } else if (typeof error === 'object' && error !== null) {
          const errorObj = error as Record<string, unknown>
          const message = String(errorObj.message || errorObj.detail || errorObj.error || getUserMessage('COMMON_UNKNOWN'))
          enhancedError = new AppError({ code: 'COMMON_UNKNOWN', message, originalError: error })
        } else {
          enhancedError = ErrorFactory.ai.generationFailed()
        }

        throw enhancedError
      }
    },

    onMutate: () => {
      generateTimer.current = logger.startTimer('配方生成总耗时')
    },

    onSuccess: (data) => {
      generateTimer.current?.end()
      completeProgress()

      if (!data?.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        const appError = ErrorFactory.ai.responseEmpty()
        errorProgress(appError.userMessage)
        setErrorMessage(appError.userMessage)
        feedback.showError(DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_ERROR_TITLE, appError.userMessage)
        return
      }

      setGenerateResult(data.candidates)
      setGenerator((data.generator as GeneratorType) || 'rule_engine')

      feedback.showSuccess(
        DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_SUCCESS_TITLE,
        `${DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_SUCCESS_MESSAGE_PREFIX} ${data.candidates.length} ${DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_SUCCESS_MESSAGE_SUFFIX}`,
      )

      onGenerateSuccess?.(data.candidates)
    },

    onError: (error: unknown) => {
      generateTimer.current?.end()

      let errorMsg: string = ERROR_MESSAGES.FORMULA_GENERATION_FAILED
      let recoverySuggestion = ''
      let errorCode: string | number | null = null

      const appError = error instanceof AppError ? error : ErrorFactory.ai.generationFailed()

      errorMsg = appError.userMessage
      recoverySuggestion = appError.retryable ? '请稍后重试' : ''
      errorCode = appError.code

      if (error instanceof AppError) {
        switch (error.category) {
          case 'COMMON':
            if (error.code === 'COMMON_NETWORK_ERROR') recoverySuggestion = '请检查网络后重试'
            else if (error.code === 'COMMON_TIMEOUT') recoverySuggestion = '请稍后重试'
            break
          case 'AUTH':
            recoverySuggestion = '请重新登录后再试'
            break
          case 'API':
            recoverySuggestion = '请稍后重试'
            break
          default:
            recoverySuggestion = appError.retryable ? '请稍后重试' : ''
        }
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>

        if ('response' in errorObj) {
          const response = errorObj.response as Record<string, unknown>
          errorCode = response.status as number

          if (response.data && typeof response.data === 'object') {
            const data = response.data as Record<string, unknown>
            if (data.detail && typeof data.detail === 'string') {
              errorMsg = data.detail
            } else if (data.message && typeof data.message === 'string') {
              errorMsg = data.message
            } else if (data.error && typeof data.error === 'string') {
              errorMsg = data.error
            }
          }

          if (errorCode === 401) {
            errorMsg = '认证已过期，请重新登录'
            recoverySuggestion = '请重新登录后再试'
          } else if (errorCode === 403) {
            errorMsg = '您没有权限执行此操作'
            recoverySuggestion = '请联系管理员获取权限'
          } else if (errorCode === 409) {
            errorMsg = '请求冲突，请等待当前操作完成'
            recoverySuggestion = '请等待当前请求完成后再试'
          } else if (errorCode >= 500) {
            errorMsg = '服务器错误，请稍后重试'
            recoverySuggestion = '请稍后重试或联系管理员'
          }
        } else if ('message' in errorObj && typeof errorObj.message === 'string') {
          errorMsg = errorObj.message
        }
      }

      const fullErrorMessage = recoverySuggestion
        ? `${errorMsg}\n\n${recoverySuggestion}`
        : errorMsg

      errorProgress(errorMsg)
      setErrorMessage(fullErrorMessage)

      feedback.showError(
        DEFAULTS.PLACEHOLDER_TEXTS.GENERATION_ERROR_TITLE,
        fullErrorMessage,
        8000,
      )

      logger.error('配方生成失败', {
        error: appError.toJSON(),
        suggestion: recoverySuggestion,
        errorCode,
        errorType: Object.prototype.toString.call(error),
      })
    },
  })

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    mutation.reset()
    resetProgress()
  }, [mutation, resetProgress])

  const handleReset = useCallback(() => {
    setGenerateResult(null)
    setErrorMessage(null)
    mutation.reset()
    resetProgress()
  }, [mutation, resetProgress])

  return {
    generateResult,
    generator,
    errorMessage,
    setErrorMessage,
    mutation,
    progress,
    handleCancelGeneration,
    handleReset,
    isGenerating: mutation.isPending,
  }
}
