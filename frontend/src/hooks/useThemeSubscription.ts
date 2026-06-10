import { useEffect, useCallback } from 'react'
import { themeEventBus } from '@/utils/events'
import type { ThemeEventPayload, ThemeEventType } from '@/utils/events'

export function useThemeSubscription(
  eventType: ThemeEventType,
  callback: (payload: ThemeEventPayload) => void,
  deps: unknown[] = [],
) {
  const stableCallback = useCallback(callback, deps)

  useEffect(() => {
    const unsubscribe = themeEventBus.on(eventType, stableCallback)
    return unsubscribe
  }, [eventType, stableCallback])
}
