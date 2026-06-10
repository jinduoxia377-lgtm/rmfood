import { create } from 'zustand'

export type ToastType = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message?: string
  duration?: number
  createdAt: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
  getCurrentToasts: () => Toast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const DEFAULT_DURATION = 5000

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const duration = toast.duration ?? DEFAULT_DURATION
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
    }

    set((state) => {
      // 最多显示 3 条 Toast，超出时移除最旧的
      const MAX_TOASTS = 3
      const updated = [...state.toasts, newToast]
      const trimmed = updated.length > MAX_TOASTS ? updated.slice(-MAX_TOASTS) : updated
      return { toasts: trimmed }
    })

    if (duration > 0) {
      const timeout = setTimeout(() => {
        get().removeToast(id)
      }, duration)
      toastTimeouts.set(id, timeout)
    }

    return id
  },

  removeToast: (id: string) => {
    const timeout = toastTimeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      toastTimeouts.delete(id)
    }

    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearAll: () => {
    toastTimeouts.forEach((timeout) => clearTimeout(timeout))
    toastTimeouts.clear()
    set({ toasts: [] })
  },

  getCurrentToasts: () => {
    return get().toasts
  },
}))
