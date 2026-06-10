import { logger } from '@/utils/safeLogger';

export type ThemeEventType = 'theme-change' | 'mode-switch' | 'custom-theme-update'

export interface ThemeEventPayload {
  type: ThemeEventType
  timestamp: number
  changes?: { key: string; oldValue: unknown; newValue: unknown }[]
  data?: Record<string, unknown>
}

type EventCallback<T = ThemeEventPayload> = (payload: T) => void | Promise<void>

const MAX_LISTENERS_PER_EVENT = 50

export class ThemeEventBus {
  private static instance: ThemeEventBus
  private listeners: Map<string, Set<EventCallback>>

  private constructor() {
    this.listeners = new Map()
  }

  static getInstance(): ThemeEventBus {
    if (!ThemeEventBus.instance) {
      ThemeEventBus.instance = new ThemeEventBus()
    }
    return ThemeEventBus.instance
  }

  on(event: ThemeEventType | string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    const eventListeners = this.listeners.get(event)!
    if (eventListeners.size >= MAX_LISTENERS_PER_EVENT) {
      logger.warn(`[ThemeEventBus] Max listeners (${MAX_LISTENERS_PER_EVENT}) reached for event: ${event}`)
    }

    eventListeners.add(callback)

    return () => this.off(event, callback)
  }

  once(event: ThemeEventType | string, callback: EventCallback): () => void {
    const wrapper: EventCallback = (payload) => {
      this.off(event, wrapper)
      callback(payload)
    }
    return this.on(event, wrapper)
  }

  off(event: ThemeEventType | string, callback: EventCallback): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(callback)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  async emit(event: ThemeEventType | string, payload?: Partial<ThemeEventPayload>): Promise<void> {
    const fullPayload: ThemeEventPayload = {
      type: event as ThemeEventType,
      timestamp: Date.now(),
      ...payload,
    }

    const eventListeners = this.listeners.get(event)
    if (!eventListeners || eventListeners.size === 0) return

    const promises = Array.from(eventListeners).map(async (callback) => {
      try {
        await callback(fullPayload)
      } catch (error) {
        logger.error(`[ThemeEventBus] Error in listener for ${event}:`, error)
      }
    })

    await Promise.allSettled(promises)
  }

  clearListener(event?: ThemeEventType | string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  getListenerCount(event?: ThemeEventType | string): number {
    if (event) {
      return this.listeners.get(event)?.size ?? 0
    }
    let total = 0
    this.listeners.forEach((listeners) => { total += listeners.size })
    return total
  }
}

export const themeEventBus = ThemeEventBus.getInstance()
