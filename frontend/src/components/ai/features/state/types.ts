export interface AuthState {
  token: string | null
  user: {
    id: number
    username: string
    email: string
    full_name: string
    role: 'admin' | 'user' | 'guest'
    is_active: boolean
    avatar_url: string
  } | null
  role: 'admin' | 'user' | 'guest'
  isLoggedIn: boolean
}

export interface AIConfigState {
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey: string | null
  model: string
  temperature: number
  maxTokens: number
  streamingEnabled: boolean
  customEndpoint: string | null
}

export interface WorkspaceState {
  activeTab: string
  selectedItems: string[]
  clipboard: {
    type: 'formula' | 'text' | 'ingredient'
    data: unknown
  } | null
  history: {
    action: string
    timestamp: number
    data: unknown
  }[]
}

export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: number
  read: boolean
}

export interface NotificationState {
  queue: NotificationItem[]
  maxNotifications: number
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'system'
  primaryColor: string
  fontSize: 'small' | 'medium' | 'large'
  highContrast: boolean
  reducedMotion: boolean
}

export interface GlobalState {
  auth: AuthState
  aiConfig: AIConfigState
  workspace: WorkspaceState
  notifications: NotificationState
  theme: ThemeState
}

export type StateKey = keyof GlobalState

export type StateChangeListener<K extends StateKey> = (
  newValue: GlobalState[K],
  oldValue: GlobalState[K]
) => void

export interface StateUpdate<K extends StateKey> {
  key: K
  value: GlobalState[K]
}

export interface MiddlewareContext<K extends StateKey> {
  key: K
  newValue: GlobalState[K]
  oldValue: GlobalState[K]
  timestamp: number
}

export type MiddlewareFunction<K extends StateKey> = (
  context: MiddlewareContext<K>,
  next: () => void
) => void

export const DEFAULT_AUTH_STATE: AuthState = {
  token: null,
  user: null,
  role: 'guest',
  isLoggedIn: false,
}

export const DEFAULT_AI_CONFIG_STATE: AIConfigState = {
  provider: 'openai',
  apiKey: null,
  model: 'formula_gpt',
  temperature: 0.7,
  maxTokens: 2048,
  streamingEnabled: true,
  customEndpoint: null,
}

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  activeTab: 'chat',
  selectedItems: [],
  clipboard: null,
  history: [],
}

export const DEFAULT_NOTIFICATION_STATE: NotificationState = {
  queue: [],
  maxNotifications: 50,
}

export const DEFAULT_THEME_STATE: ThemeState = {
  mode: 'system',
  primaryColor: '#1976d2',
  fontSize: 'medium',
  highContrast: false,
  reducedMotion: false,
}

export const DEFAULT_GLOBAL_STATE: GlobalState = {
  auth: DEFAULT_AUTH_STATE,
  aiConfig: DEFAULT_AI_CONFIG_STATE,
  workspace: DEFAULT_WORKSPACE_STATE,
  notifications: DEFAULT_NOTIFICATION_STATE,
  theme: DEFAULT_THEME_STATE,
}
