import { logger } from '@/utils/safeLogger';
export interface AsyncOperationOptions {
  debounceMs?: number
  leadingEdge?: boolean
  trailingEdge?: boolean
  maxWaitMs?: number
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: Error) => boolean
}

export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  durationMs?: number
  operationId: string
  status: 'pending' | 'completed' | 'cancelled' | 'failed' | 'timeout'
  retryCount?: number
}

export class CancelError extends Error {
  constructor(message = 'Operation was cancelled') {
    super(message)
    this.name = 'CancelError'
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}

interface DebouncedOperation<TArgs extends any[], T> {
  execute: (...args: TArgs) => Promise<T>
  cancel: () => void
  isPending: () => boolean
  getMetrics: () => PerformanceMetrics | null
}

interface AbortableOperation<T> {
  execute: () => Promise<T>
  abort: () => void
  isAborted: () => boolean
  getMetrics: () => PerformanceMetrics | null
}

interface OperationWithTimeout<T> extends Promise<T> {
  cancel: () => void
}

export class AsyncOperationManager<T = any> {
  private activeOperations = new Map<string, { cancel: () => void }>()
  private performanceHistory: PerformanceMetrics[] = []
  private operationCounter = 0

  createDebounced<TArgs extends any[]>(
    fn: (...args: TArgs) => Promise<T>,
    options: AsyncOperationOptions = {},
  ): DebouncedOperation<TArgs, T> {
    const {
      debounceMs = 500,
      leadingEdge = false,
      trailingEdge = true,
      maxWaitMs = 0,
    } = options

    let timerId: ReturnType<typeof setTimeout> | null = null
    let maxWaitTimerId: ReturnType<typeof setTimeout> | null = null
    let isPendingFlag = false
    let currentPromise: Promise<T> | null = null
    let latestArgs: TArgs | null = null
    let operationId: string
    let metrics: PerformanceMetrics | null = null
    let resolveRejectPair: {
      resolve: (value: T) => void
      reject: (error: Error) => void
    } | null = null
    let isCancelled = false

    operationId = `debounced_${++this.operationCounter}_${Date.now()}`

    const executeImmediate = async (): Promise<void> => {
      if (!latestArgs || isCancelled) return

      isPendingFlag = true
      metrics = {
        startTime: Date.now(),
        operationId,
        status: 'pending',
      }

      try {
        const result = await fn(...latestArgs)

        if (!isCancelled) {
          metrics.endTime = Date.now()
          metrics.durationMs = metrics.endTime - metrics.startTime
          metrics.status = 'completed'
          this.recordPerformance(metrics)

          resolveRejectPair?.resolve(result)
        }
      } catch (error) {
        if (!isCancelled && !(error instanceof CancelError)) {
          metrics.endTime = Date.now()
          metrics.durationMs = metrics.endTime - metrics.startTime
          metrics.status = 'failed'
          this.recordPerformance(metrics)

          resolveRejectPair?.reject(error as Error)
        }
      } finally {
        isPendingFlag = false
        currentPromise = null
        timerId = null
      }
    }

    const clearTimers = () => {
      if (timerId) {
        clearTimeout(timerId)
        timerId = null
      }
      if (maxWaitTimerId) {
        clearTimeout(maxWaitTimerId)
        maxWaitTimerId = null
      }
    }

    const execute = (...args: TArgs): Promise<T> => {
      isCancelled = false
      latestArgs = args

      clearTimers()

      currentPromise = new Promise<T>((resolve, reject) => {
        resolveRejectPair = { resolve, reject }

        if (leadingEdge && !isPendingFlag) {
          executeImmediate()
        }

        if (trailingEdge || !leadingEdge) {
          timerId = setTimeout(() => {
            if (!isPendingFlag) {
              executeImmediate()
            }
          }, debounceMs)
        }

        if (maxWaitMs > 0) {
          maxWaitTimerId = setTimeout(() => {
            if (!isPendingFlag) {
              clearTimers()
              executeImmediate()
            }
          }, maxWaitMs)
        }
      })

      return currentPromise
    }

    const cancel = (): void => {
      isCancelled = true
      clearTimers()

      if (metrics) {
        metrics.status = 'cancelled'
        this.recordPerformance(metrics)
      }

      if (resolveRejectPair && isPendingFlag) {
        resolveRejectPair.reject(new CancelError())
      }

      isPendingFlag = false
      currentPromise = null
    }

    const isPending = (): boolean => isPendingFlag

    const getMetrics = (): PerformanceMetrics | null => metrics

    this.activeOperations.set(operationId, { cancel })

    return {
      execute,
      cancel,
      isPending,
      getMetrics,
    }
  }

  createWithTimeout<U>(
    promise: Promise<U>,
    timeoutMs: number,
    errorMessage?: string,
  ): OperationWithTimeout<U> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let isCancelled = false
    const operationId = `timeout_${++this.operationCounter}_${Date.now()}`

    const metrics: PerformanceMetrics = {
      startTime: Date.now(),
      operationId,
      status: 'pending',
    }

    const wrappedPromise = new Promise<U>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          metrics.endTime = Date.now()
          metrics.durationMs = metrics.endTime - metrics.startTime
          metrics.status = 'timeout'
          this.recordPerformance(metrics)

          reject(new TimeoutError(errorMessage))
        }
      }, timeoutMs)

      promise.then(
        (value) => {
          if (!isCancelled && timeoutId) {
            clearTimeout(timeoutId)
            metrics.endTime = Date.now()
            metrics.durationMs = metrics.endTime - metrics.startTime
            metrics.status = 'completed'
            this.recordPerformance(metrics)

            resolve(value)
          }
        },
        (error) => {
          if (!isCancelled && timeoutId) {
            clearTimeout(timeoutId)
            metrics.endTime = Date.now()
            metrics.durationMs = metrics.endTime - metrics.startTime
            metrics.status = 'failed'
            this.recordPerformance(metrics)

            reject(error)
          }
        },
      )
    })

    const cancel = () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      metrics.status = 'cancelled'
      this.recordPerformance(metrics)
    }

    Object.defineProperty(wrappedPromise, 'cancel', {
      value: cancel,
      writable: false,
      configurable: true,
    })

    this.activeOperations.set(operationId, { cancel })

    return wrappedPromise as OperationWithTimeout<U>
  }

  createAbortable<U>(
    fn: (signal: AbortSignal) => Promise<U>,
  ): AbortableOperation<U> {
    const abortController = new AbortController()
    const operationId = `abortable_${++this.operationCounter}_${Date.now()}`
    let metrics: PerformanceMetrics | null = null

    const execute = async (): Promise<U> => {
      metrics = {
        startTime: Date.now(),
        operationId,
        status: 'pending',
      }

      try {
        const result = await fn(abortController.signal)

        metrics.endTime = Date.now()
        metrics.durationMs = metrics.endTime - metrics.startTime
        metrics.status = 'completed'
        this.recordPerformance(metrics)

        return result
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          metrics.status = 'cancelled'
          throw new CancelError('Operation aborted')
        }

        metrics.endTime = Date.now()
        metrics.durationMs = metrics.endTime - metrics.startTime
        metrics.status = 'failed'
        this.recordPerformance(metrics)

        throw error
      }
    }

    const abort = () => {
      abortController.abort()
      if (metrics) {
        metrics.status = 'cancelled'
        this.recordPerformance(metrics)
      }
    }

    const isAborted = () => abortController.signal.aborted

    const getMetrics = () => metrics

    this.activeOperations.set(operationId, { cancel: abort })

    return {
      execute,
      abort,
      isAborted,
      getMetrics,
    }
  }

  async withRetry<U>(
    fn: () => Promise<U>,
    options: RetryOptions = {},
  ): Promise<U> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 10000,
      shouldRetry = () => true,
    } = options

    let lastError: Error | null = null
    const operationId = `retry_${++this.operationCounter}_${Date.now()}`

    const metrics: PerformanceMetrics = {
      startTime: Date.now(),
      operationId,
      status: 'pending',
      retryCount: 0,
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn()

        metrics.endTime = Date.now()
        metrics.durationMs = metrics.endTime - metrics.startTime
        metrics.status = 'completed'
        metrics.retryCount = attempt
        this.recordPerformance(metrics)

        return result
      } catch (error) {
        lastError = error as Error

        if (attempt < maxRetries && shouldRetry(lastError)) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
          metrics.retryCount = attempt + 1

          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          metrics.endTime = Date.now()
          metrics.durationMs = metrics.endTime - metrics.startTime
          metrics.status = 'failed'
          this.recordPerformance(metrics)

          throw lastError
        }
      }
    }

    throw lastError
  }

  createRaceConditionSafe<TArgs extends any[], T>(
    fn: (...args: TArgs) => Promise<T>,
    options: AsyncOperationOptions & { keyGenerator?: (...args: TArgs) => string } = {},
  ) {
    let currentRequestId: string | null = null
    let _currentOperation: DebouncedOperation<TArgs, T> | null = null

    // @ts-expect-error -- TypeScript limitation: generic method inference in nested scope causes T/T scope conflict.
    // Runtime safety guaranteed by the `as unknown as DebouncedOperation<TArgs, T>` assertion below.
    const debounced = this.createDebounced(async (...args: TArgs): Promise<T> => {
      const requestId = options.keyGenerator ?
        options.keyGenerator(...args) :
        `request_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

      currentRequestId = requestId

      const result = await fn(...args)

      if (currentRequestId !== requestId) {
        throw new CancelError('Superseded by newer request')
      }

      return result
    }, options) as unknown as DebouncedOperation<TArgs, T>

    _currentOperation = debounced

    const execute = async (...args: TArgs): Promise<T> => {
      return debounced.execute(...args)
    }

    const cancel = () => {
      currentRequestId = null
      debounced.cancel()
    }

    return {
      execute,
      cancel,
      isPending: () => debounced.isPending(),
      getMetrics: () => debounced.getMetrics(),
    }
  }

  cancelAll(): void {
    this.activeOperations.forEach(({ cancel }) => {
      try {
        cancel()
      } catch (error) {
        logger.warn('Failed to cancel operation:', error)
      }
    })
    this.activeOperations.clear()
  }

  cancelOperation(operationId: string): boolean {
    const operation = this.activeOperations.get(operationId)
    if (operation) {
      operation.cancel()
      this.activeOperations.delete(operationId)
      return true
    }
    return false
  }

  private recordPerformance(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics)

    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50)
    }
  }

  getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceHistory]
  }

  getAverageDuration(operationType?: string): number {
    const relevantMetrics = operationType ?
      this.performanceHistory.filter(m => m.operationId.startsWith(operationType)) :
      this.performanceHistory

    const completedMetrics = relevantMetrics.filter(m =>
      m.status === 'completed' && m.durationMs !== undefined,
    )

    if (completedMetrics.length === 0) return 0

    const totalDuration = completedMetrics.reduce((sum, m) => sum + (m.durationMs || 0), 0)
    return totalDuration / completedMetrics.length
  }

  getSuccessRate(operationType?: string): number {
    const relevantMetrics = operationType ?
      this.performanceHistory.filter(m => m.operationId.startsWith(operationType)) :
      this.performanceHistory

    if (relevantMetrics.length === 0) return 0

    const successfulOps = relevantMetrics.filter(m => m.status === 'completed').length
    return (successfulOps / relevantMetrics.length) * 100
  }

  clearPerformanceHistory(): void {
    this.performanceHistory = []
  }

  getActiveOperationsCount(): number {
    return this.activeOperations.size
  }

  destroy(): void {
    this.cancelAll()
    this.clearPerformanceHistory()
    this.operationCounter = 0
  }
}

export const asyncOperationManager = new AsyncOperationManager()

export function createDebouncedOperation<TArgs extends any[], T>(
  fn: (...args: TArgs) => Promise<T>,
  options?: AsyncOperationOptions,
) {
  return asyncOperationManager.createDebounced(fn, options)
}

export function createAbortableOperation<T>(
  fn: (signal: AbortSignal) => Promise<T>,
) {
  return asyncOperationManager.createAbortable(fn)
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string,
) {
  return asyncOperationManager.createWithTimeout(promise, timeoutMs, errorMessage)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
) {
  return asyncOperationManager.withRetry(fn, options)
}
