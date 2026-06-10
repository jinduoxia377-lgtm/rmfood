import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '@/utils/safeLogger';


export interface UndoableAction<T = any> {
  id: string
  type: string
  previousState: T
  newState: T
  timestamp: number
  description: string
}

export interface UndoableState<T = any> {
  past: UndoableAction<T>[]
  present: T
  future: UndoableAction<T>[]
}

export interface UseUndoOptions<T> {
  maxHistory?: number
  onUndo?: (action: UndoableAction<T>) => void
  onRedo?: (action: UndoableAction<T>) => void
  onChange?: (state: T, action: UndoableAction<T>) => void
}

export function useUndoableState<T>(initialState: T, options: UseUndoOptions<T> = {}) {
  const { maxHistory = 50, onUndo, onRedo, onChange } = options

  const [history, setHistory] = useState<UndoableState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const lastActionRef = useRef<UndoableAction<T> | null>(null)

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const executeAction = useCallback(
    (type: string, description: string, reducer: (state: T) => T) => {
      setHistory((prev) => {
        const newPresent = reducer(prev.present)
        const action: UndoableAction<T> = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type,
          previousState: prev.present,
          newState: newPresent,
          timestamp: Date.now(),
          description,
        }

        lastActionRef.current = action

        const newPast = [...prev.past, action].slice(-maxHistory)

        onChange?.(newPresent, action)

        return {
          past: newPast,
          present: newPresent,
          future: [],
        }
      })
    },
    [maxHistory, onChange],
  )

  const undo = useCallback(() => {
    if (!canUndo) return

    setHistory((prev) => {
      const newFuture = [lastActionRef.current!, ...prev.future]
      const lastAction = prev.past[prev.past.length - 1]

      onUndo?.(lastAction)
      lastActionRef.current = lastAction

      return {
        past: prev.past.slice(0, -1),
        present: lastAction.previousState,
        future: newFuture,
      }
    })
  }, [canUndo, onUndo])

  const redo = useCallback(() => {
    if (!canRedo) return

    setHistory((prev) => {
      const lastFutureAction = prev.future[0]
      const newPast = [...prev.past, lastFutureAction]

      onRedo?.(lastFutureAction)
      lastActionRef.current = lastFutureAction

      return {
        past: newPast,
        present: lastFutureAction.newState,
        future: prev.future.slice(1),
      }
    })
  }, [canRedo, onRedo])

  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: [],
    })
  }, [history.present])

  return {
    state: history.present,
    past: history.past,
    future: history.future,
    canUndo,
    canRedo,
    executeAction,
    undo,
    redo,
    clear,
  }
}

export interface ErrorRecoveryState {
  error: Error | null
  errorInfo: string | null
  timestamp: number | null
  context: Record<string, any>
}

export interface UseErrorRecoveryOptions {
  maxErrors?: number
  onError?: (error: Error, context: Record<string, any>) => void
  onRecover?: (context: Record<string, any>) => void
}

export function useErrorRecovery(options: UseErrorRecoveryOptions = {}) {
  const { maxErrors = 10, onError, onRecover } = options

  const [errorHistory, setErrorHistory] = useState<ErrorRecoveryState[]>([])
  const [currentError, setCurrentError] = useState<Error | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)

  const captureError = useCallback(
    (error: Error, context: Record<string, any> = {}) => {
      const errorState: ErrorRecoveryState = {
        error,
        errorInfo: error.message,
        timestamp: Date.now(),
        context,
      }

      setErrorHistory((prev) => [errorState, ...prev].slice(0, maxErrors))
      setCurrentError(error)
      onError?.(error, context)
    },
    [maxErrors, onError],
  )

  const clearError = useCallback(() => {
    setCurrentError(null)
  }, [])

  const recover = useCallback(
    (context: Record<string, any> = {}) => {
      setIsRecovering(true)
      try {
        onRecover?.(context)
        clearError()
      } finally {
        setIsRecovering(false)
      }
    },
    [clearError, onRecover],
  )

  const retryLastOperation = useCallback(() => {
    if (errorHistory.length > 0) {
      const lastError = errorHistory[0]
      recover(lastError.context)
    }
  }, [errorHistory, recover])

  const clearErrorHistory = useCallback(() => {
    setErrorHistory([])
  }, [])

  return {
    currentError,
    errorHistory,
    isRecovering,
    hasError: currentError !== null,
    hasErrorHistory: errorHistory.length > 0,
    captureError,
    clearError,
    recover,
    retryLastOperation,
    clearErrorHistory,
  }
}

export interface ActionHistoryItem<T = any> {
  id: string
  type: string
  payload: T
  timestamp: number
  status: 'pending' | 'success' | 'error' | 'reverted'
  error?: string
  revertedBy?: string
}

export function useActionHistory<T = any>(maxItems = 100) {
  const [history, setHistory] = useState<ActionHistoryItem<T>[]>([])
  const [pendingActions, setPendingActions] = useState<Map<string, ActionHistoryItem<T>>>(new Map())

  const addAction = useCallback(
    (type: string, payload: T) => {
      const action: ActionHistoryItem<T> = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type,
        payload,
        timestamp: Date.now(),
        status: 'pending',
      }

      setPendingActions((prev) => {
        const newMap = new Map(prev)
        newMap.set(action.id, action)
        return newMap
      })

      return action.id
    },
    [],
  )

  const completeAction = useCallback(
    (actionId: string, status: 'success' | 'error', error?: string) => {
      setPendingActions((prev) => {
        const action = prev.get(actionId)
        if (!action) return prev

        const updatedAction: ActionHistoryItem<T> = {
          ...action,
          status,
          error,
        }

        setHistory((h) => [updatedAction, ...h].slice(0, maxItems))

        const newMap = new Map(prev)
        newMap.delete(actionId)
        return newMap
      })
    },
    [maxItems],
  )

  const revertAction = useCallback(
    (actionId: string) => {
      setHistory((prev) =>
        prev.map((action) =>
          action.id === actionId
            ? { ...action, status: 'reverted' as const, revertedBy: actionId }
            : action,
        ),
      )
    },
    [],
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    setPendingActions(new Map())
  }, [])

  return {
    history,
    pendingActions: Array.from(pendingActions.values()),
    hasPendingActions: pendingActions.size > 0,
    addAction,
    completeAction,
    revertAction,
    clearHistory,
  }
}

export interface SessionRecoveryData {
  version: number
  timestamp: number
  data: Record<string, any>
}

export function useSessionRecovery(storageKey = 'rmfood_recovery') {
  const [recoveryData, setRecoveryData] = useState<SessionRecoveryData | null>(null)
  const [canRecover, setCanRecover] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as SessionRecoveryData
        if (Date.now() - parsed.timestamp < 1000 * 60 * 30) {
          setRecoveryData(parsed)
          setCanRecover(true)
        } else {
          localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      logger.warn('Failed to load recovery data:', error)
    }
  }, [storageKey])

  const saveForRecovery = useCallback(
    (data: Record<string, any>) => {
      try {
        const recoveryData: SessionRecoveryData = {
          version: 1,
          timestamp: Date.now(),
          data,
        }
        localStorage.setItem(storageKey, JSON.stringify(recoveryData))
      } catch (error) {
        logger.warn('Failed to save recovery data:', error)
      }
    },
    [storageKey],
  )

  const clearRecovery = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
      setRecoveryData(null)
      setCanRecover(false)
    } catch (error) {
      logger.warn('Failed to clear recovery data:', error)
    }
  }, [storageKey])

  return {
    recoveryData,
    canRecover,
    saveForRecovery,
    clearRecovery,
  }
}
