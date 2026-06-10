import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  GlobalState,
  AuthState,
  AIConfigState,
  WorkspaceState,
  NotificationState,
  ThemeState,
  NotificationItem,
} from './types'

interface GlobalStoreActions {
  setAuth: (auth: Partial<AuthState>) => void
  resetAuth: () => void
  setAIConfig: (config: Partial<AIConfigState>) => void
  resetAIConfig: () => void
  setActiveTab: (tab: string) => void
  setSelectedItems: (items: string[]) => void
  setClipboard: (clipboard: WorkspaceState['clipboard']) => void
  addToHistory: (action: string, data: unknown) => void
  clearHistory: () => void
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  setTheme: (theme: Partial<ThemeState>) => void
  resetTheme: () => void
}

interface GlobalStoreSelectors {
  getAuth: () => AuthState
  getAIConfig: () => AIConfigState
  getWorkspace: () => WorkspaceState
  getNotifications: () => NotificationState
  getTheme: () => ThemeState
  isLoggedIn: () => boolean
  hasUnreadNotifications: () => boolean
}

type GlobalStore = GlobalState & GlobalStoreActions & GlobalStoreSelectors

const selectorCache = new Map<string, { data: unknown; timestamp: number }>()

export const useGlobalStore = create<GlobalStore>()(
  devtools(
    persist(
      (set, get) => ({
        auth: {
          token: null,
          user: null,
          role: 'guest',
          isLoggedIn: false,
        },
        aiConfig: {
          provider: 'openai',
          apiKey: null,
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2048,
          streamingEnabled: true,
          customEndpoint: null,
        },
        workspace: {
          activeTab: 'chat',
          selectedItems: [],
          clipboard: null,
          history: [],
        },
        notifications: {
          queue: [],
          maxNotifications: 50,
        },
        theme: {
          mode: 'system',
          primaryColor: '#1976d2',
          fontSize: 'medium',
          highContrast: false,
          reducedMotion: false,
        },

        setAuth: (auth) =>
          set(
            (state) => ({
              auth: { ...state.auth, ...auth },
            }),
            false,
            'setAuth',
          ),

        resetAuth: () =>
          set(
            {
              auth: {
                token: null,
                user: null,
                role: 'guest',
                isLoggedIn: false,
              },
            },
            false,
            'resetAuth',
          ),

        setAIConfig: (config) =>
          set(
            (state) => ({
              aiConfig: { ...state.aiConfig, ...config },
            }),
            false,
            'setAIConfig',
          ),

        resetAIConfig: () =>
          set(
            {
              aiConfig: {
                provider: 'openai',
                apiKey: null,
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2048,
                streamingEnabled: true,
                customEndpoint: null,
              },
            },
            false,
            'resetAIConfig',
          ),

        setActiveTab: (tab) =>
          set(
            (state) => ({
              workspace: { ...state.workspace, activeTab: tab },
            }),
            false,
            'setActiveTab',
          ),

        setSelectedItems: (items) =>
          set(
            (state) => ({
              workspace: { ...state.workspace, selectedItems: items },
            }),
            false,
            'setSelectedItems',
          ),

        setClipboard: (clipboard) =>
          set(
            (state) => ({
              workspace: { ...state.workspace, clipboard },
            }),
            false,
            'setClipboard',
          ),

        addToHistory: (action, data) =>
          set(
            (state) => ({
              workspace: {
                ...state.workspace,
                history: [
                  ...state.workspace.history.slice(-49),
                  { action, timestamp: Date.now(), data },
                ],
              },
            }),
            false,
            'addToHistory',
          ),

        clearHistory: () =>
          set(
            (state) => ({
              workspace: { ...state.workspace, history: [] },
            }),
            false,
            'clearHistory',
          ),

        addNotification: (notification) =>
          set(
            (state) => {
              const newNotification: NotificationItem = {
                ...notification,
                id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                timestamp: Date.now(),
                read: false,
              }
              const queue = [...state.notifications.queue, newNotification].slice(
                -state.notifications.maxNotifications,
              )
              return {
                notifications: { ...state.notifications, queue },
              }
            },
            false,
            'addNotification',
          ),

        markNotificationRead: (id) =>
          set(
            (state) => ({
              notifications: {
                ...state.notifications,
                queue: state.notifications.queue.map((n) =>
                  n.id === id ? { ...n, read: true } : n,
                ),
              },
            }),
            false,
            'markNotificationRead',
          ),

        clearNotifications: () =>
          set(
            (state) => ({
              notifications: { ...state.notifications, queue: [] },
            }),
            false,
            'clearNotifications',
          ),

        setTheme: (theme) =>
          set(
            (state) => ({
              theme: { ...state.theme, ...theme },
            }),
            false,
            'setTheme',
          ),

        resetTheme: () =>
          set(
            {
              theme: {
                mode: 'system',
                primaryColor: '#1976d2',
                fontSize: 'medium',
                highContrast: false,
                reducedMotion: false,
              },
            },
            false,
            'resetTheme',
          ),

        getAuth: () => get().auth,

        getAIConfig: () => get().aiConfig,

        getWorkspace: () => get().workspace,

        getNotifications: () => get().notifications,

        getTheme: () => get().theme,

        isLoggedIn: () => get().auth.isLoggedIn,

        hasUnreadNotifications: () =>
          get().notifications.queue.some((n) => !n.read),
      }),
      {
        name: 'global-state-storage',
        partialize: (state) => ({
          auth: {
            token: state.auth.token,
            user: state.auth.user,
            role: state.auth.role,
            isLoggedIn: state.auth.isLoggedIn,
          },
          aiConfig: {
            provider: state.aiConfig.provider,
            model: state.aiConfig.model,
            temperature: state.aiConfig.temperature,
            maxTokens: state.aiConfig.maxTokens,
            streamingEnabled: state.aiConfig.streamingEnabled,
          },
          theme: {
            mode: state.theme.mode,
            primaryColor: state.theme.primaryColor,
            fontSize: state.theme.fontSize,
            highContrast: state.theme.highContrast,
            reducedMotion: state.theme.reducedMotion,
          },
        }),
      },
    ),
    { name: 'GlobalStore' },
  ),
)

export function clearSelectorCache(): void {
  selectorCache.clear()
}
