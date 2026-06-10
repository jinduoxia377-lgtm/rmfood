import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/safeLogger';


export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options?: {
    storage?: 'localStorage' | 'sessionStorage'
    serializer?: (value: T) => string
    deserializer?: (value: string) => T
  },
) {
  const {
    storage = 'localStorage',
    serializer = JSON.stringify,
    deserializer = JSON.parse,
  } = options || {}

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window[storage].getItem(key)
      return item ? deserializer(item) : initialValue
    } catch (error) {
      logger.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window[storage].setItem(key, serializer(valueToStore))
    } catch (error) {
      logger.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue, storage, serializer])

  const removeValue = useCallback(() => {
    try {
      window[storage].removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      logger.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue, storage])

  return [storedValue, setValue, removeValue] as const
}
