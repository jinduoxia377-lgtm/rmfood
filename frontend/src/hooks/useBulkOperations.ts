import { useReducer, useCallback, useRef } from 'react'
import api from '@/api/client'
import { logger } from '@/utils/safeLogger';


export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf'

export interface Permission {
  id: number
  name: string
  description?: string
  resource: string
  actions: string[]
}

export interface OperationResult {
  id: number
  success: boolean
  error?: string
  data?: Record<string, unknown>
  timestamp: number
}

interface BulkOperationState {
  isProcessing: boolean
  progress: number
  totalItems: number
  processedItems: number
  results: OperationResult[]
  currentOperation: string | null
  error: Error | null
  rollbackData: Map<number, unknown>
}

type BulkOperationAction =
  | { type: 'START_OPERATION'; payload: { operation: string; totalItems: number } }
  | { type: 'PROGRESS_UPDATE'; payload: { processed: number; result?: OperationResult } }
  | { type: 'COMPLETE_OPERATION' }
  | { type: 'SET_ERROR'; payload: Error }
  | { type: 'CLEAR_RESULTS' }
  | { type: 'STORE_ROLLBACK_DATA'; payload: { id: number; data: unknown } }
  | { type: 'CLEAR_ROLLBACK_DATA' }

const initialState: BulkOperationState = {
  isProcessing: false,
  progress: 0,
  totalItems: 0,
  processedItems: 0,
  results: [],
  currentOperation: null,
  error: null,
  rollbackData: new Map(),
}

function bulkOperationReducer(state: BulkOperationState, action: BulkOperationAction): BulkOperationState {
  switch (action.type) {
    case 'START_OPERATION':
      return {
        ...state,
        isProcessing: true,
        currentOperation: action.payload.operation,
        totalItems: action.payload.totalItems,
        processedItems: 0,
        progress: 0,
        results: [],
        error: null,
      }

    case 'PROGRESS_UPDATE': {
      const newProcessed = state.processedItems + 1
      const newProgress = Math.round((newProcessed / state.totalItems) * 100)
      const newResults = action.payload.result ? [...state.results, action.payload.result] : state.results

      return {
        ...state,
        processedItems: newProcessed,
        progress: newProgress,
        results: newResults,
      }
    }

    case 'COMPLETE_OPERATION':
      return {
        ...state,
        isProcessing: false,
        progress: 100,
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isProcessing: false,
      }

    case 'CLEAR_RESULTS':
      return {
        ...state,
        results: [],
        error: null,
        rollbackData: new Map(),
      }

    case 'STORE_ROLLBACK_DATA': {
      const newRollbackData = new Map(state.rollbackData)
      newRollbackData.set(action.payload.id, action.payload.data)
      return {
        ...state,
        rollbackData: newRollbackData,
      }
    }

    case 'CLEAR_ROLLBACK_DATA':
      return {
        ...state,
        rollbackData: new Map(),
      }

    default:
      return state
  }
}

interface UseBulkOperationsOptions {
  batchSize?: number
  enableRollback?: boolean
  onProgress?: (progress: number) => void
  onComplete?: (results: OperationResult[]) => void
  onError?: (error: Error) => void
}

export function useBulkOperations(options: UseBulkOperationsOptions = {}) {
  const {
    batchSize = 10,
    enableRollback = true,
    onProgress,
    onComplete,
    onError,
  } = options

  const [state, dispatch] = useReducer(bulkOperationReducer, initialState)
  const mountedRef = useRef(true)

  const processBatch = useCallback(
    async <T>(
      items: T[],
      processor: (item: T) => Promise<OperationResult>,
      operationName: string,
    ): Promise<OperationResult[]> => {
      if (!mountedRef.current || items.length === 0) return []

      dispatch({
        type: 'START_OPERATION',
        payload: { operation: operationName, totalItems: items.length },
      })

      const results: OperationResult[] = []
      let hasError = false

      for (let i = 0; i < items.length; i += batchSize) {
        if (!mountedRef.current) break

        const batch = items.slice(i, i + batchSize)
        const batchPromises = batch.map(async (item) => {
          try {
            const result = await processor(item)
            onProgress?.(state.progress)
            return result
          } catch (error: any) {
            return {
              id: typeof item === 'object' && item !== null && 'id' in item
                ? (item as any).id
                : i,
              success: false,
              error: error.message || 'Unknown error',
              timestamp: Date.now(),
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        for (const result of batchResults) {
          dispatch({ type: 'PROGRESS_UPDATE', payload: { result } })
        }

        if (batchResults.some((r) => !r.success)) {
          hasError = true
        }
      }

      if (hasError && enableRollback) {
        logger.warn('Some operations failed. Rollback data available for recovery.')
      }

      dispatch({ type: 'COMPLETE_OPERATION' })
      onComplete?.(results)

      return results
    },
    [batchSize, enableRollback, onProgress, onComplete, state.progress],
  )

  const bulkChangePermissions = useCallback(
    async (ids: number[], permissions: Partial<Permission>): Promise<void> => {
      await processBatch(
        ids,
        async (id): Promise<OperationResult> => {
          if (enableRollback) {
            try {
              const currentPerm = await api.get(`/organizations/permissions/${id}`)
              dispatch({
                type: 'STORE_ROLLBACK_DATA',
                payload: { id, data: currentPerm.data },
              })
            } catch {
            }
          }

          await api.patch(`/organizations/permissions/${id}`, permissions)

          return {
            id,
            success: true,
            data: permissions,
            timestamp: Date.now(),
          }
        },
        'bulk_change_permissions',
      )
    },
    [processBatch, enableRollback],
  )

  const bulkExport = useCallback(
    async (ids: number[], format: ExportFormat): Promise<void> => {
      await processBatch(
        ids,
        async (id): Promise<OperationResult> => {
          const response = await api.get(`/organizations/${id}/export`, {
            params: { format },
            responseType: format === 'csv' || format === 'excel' ? 'blob' : 'json',
          })

          if (format === 'csv' || format === 'excel') {
            const blob = new Blob([response.data], {
              type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `organizations_export_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
          }

          return {
            id,
            success: true,
            data: { format, exportedAt: Date.now() },
            timestamp: Date.now(),
          }
        },
        'bulk_export',
      )
    },
    [processBatch],
  )

  const bulkArchive = useCallback(
    async (ids: number[]): Promise<void> => {
      await processBatch(
        ids,
        async (id): Promise<OperationResult> => {
          if (enableRollback) {
            try {
              const currentOrg = await api.get(`/organizations/${id}`)
              dispatch({
                type: 'STORE_ROLLBACK_DATA',
                payload: { id, data: currentOrg.data },
              })
            } catch {
            }
          }

          await api.patch(`/organizations/${id}/archive`, { isActive: false })

          return {
            id,
            success: true,
            data: { archived: true },
            timestamp: Date.now(),
          }
        },
        'bulk_archive',
      )
    },
    [processBatch, enableRollback],
  )

  const bulkDelete = useCallback(
    async (ids: number[]): Promise<void> => {
      await processBatch(
        ids,
        async (id): Promise<OperationResult> => {
          if (enableRollback) {
            try {
              const currentOrg = await api.get(`/organizations/${id}`)
              dispatch({
                type: 'STORE_ROLLBACK_DATA',
                payload: { id, data: currentOrg.data },
              })
            } catch {
            }
          }

          await api.delete(`/organizations/${id}`)

          return {
            id,
            success: true,
            data: { deleted: true },
            timestamp: Date.now(),
          }
        },
        'bulk_delete',
      )
    },
    [processBatch, enableRollback],
  )

  const rollbackFailedOperations = useCallback(async (): Promise<boolean> => {
    if (!enableRollback || state.rollbackData.size === 0) return false

    const failedResults = state.results.filter((r) => !r.success)
    let allRolledBack = true

    for (const result of failedResults) {
      const rollbackInfo = state.rollbackData.get(result.id)
      if (rollbackInfo) {
        try {
          await api.put(`/organizations/${result.id}/restore`, rollbackInfo)
        } catch {
          allRolledBack = false
        }
      }
    }

    dispatch({ type: 'CLEAR_ROLLBACK_DATA' })
    return allRolledBack
  }, [enableRollback, state.rollbackData, state.results])

  const clearResults = useCallback(() => {
    dispatch({ type: 'CLEAR_RESULTS' })
  }, [])

  const successCount = state.results.filter((r) => r.success).length
  const failureCount = state.results.filter((r) => !r.success).length
  const isComplete = !state.isProcessing && state.results.length > 0

  return {
    isProcessing: state.isProcessing,
    progress: state.progress,
    results: state.results,
    error: state.error,
    currentOperation: state.currentOperation,

    bulkChangePermissions,
    bulkExport,
    bulkArchive,
    bulkDelete,

    rollbackFailedOperations,
    clearResults,

    successCount,
    failureCount,
    isComplete,
    totalItems: state.totalItems,
    processedItems: state.processedItems,
  }
}

export type UseBulkOperationsReturn = ReturnType<typeof useBulkOperations>
