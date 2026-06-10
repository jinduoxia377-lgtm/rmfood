import { logger } from '@/utils/safeLogger'
import { storageService } from './storageService'

export type HotkeyAction =
  | 'sendMessage'
  | 'newLine'
  | 'toggleDeepThinking'
  | 'toggleSmartSearch'
  | 'clearInput'

export interface HotkeyConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export interface InputBehaviorConfig {
  autoFocus: boolean
  autoResize: boolean
  minHeight: number
  maxHeight: number
  enterToSend: boolean
  showCharCount: boolean
  showSuggestions: boolean
}

export interface UserPreferences {
  hotkeys: Partial<Record<HotkeyAction, HotkeyConfig>>
  inputBehavior: InputBehaviorConfig
  theme?: 'light' | 'dark' | 'system'
}

const STORAGE_KEY = 'user-preferences'
const CURRENT_VERSION = 1

const DEFAULT_HOTKEYS: Partial<Record<HotkeyAction, HotkeyConfig>> = {
  sendMessage: { key: 'Enter' },
  newLine: { key: 'Enter', shift: true },
  toggleDeepThinking: { key: 'D', ctrl: true },
  toggleSmartSearch: { key: 'S', ctrl: true },
  clearInput: { key: 'Escape' },
}

const DEFAULT_INPUT_BEHAVIOR: InputBehaviorConfig = {
  autoFocus: true,
  autoResize: true,
  minHeight: 40,
  maxHeight: 160,
  enterToSend: true,
  showCharCount: true,
  showSuggestions: true,
}

const DEFAULT_PREFERENCES: UserPreferences = {
  hotkeys: DEFAULT_HOTKEYS,
  inputBehavior: DEFAULT_INPUT_BEHAVIOR,
  theme: 'system',
}

export class UserPreferencesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserPreferencesError'
  }
}

export class UserPreferencesService {
  private preferences: UserPreferences | null = null
  private listeners: ((preferences: UserPreferences) => void)[] = []

  constructor() {
    this.loadPreferences()
  }

  private loadPreferences(): void {
    try {
      const stored = storageService.get<UserPreferences>(STORAGE_KEY)
      if (stored) {
        this.preferences = this.mergeWithDefaults(stored)
        logger.info('[UserPreferencesService] 从存储加载偏好设置成功')
      } else {
        this.preferences = { ...DEFAULT_PREFERENCES }
        logger.info('[UserPreferencesService] 使用默认偏好设置')
      }
    } catch (error) {
      logger.error('[UserPreferencesService] 加载偏好设置失败，使用默认值:', error)
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
  }

  private mergeWithDefaults(partial: Partial<UserPreferences>): UserPreferences {
    return {
      ...DEFAULT_PREFERENCES,
      ...partial,
      hotkeys: { ...DEFAULT_PREFERENCES.hotkeys, ...partial.hotkeys },
      inputBehavior: { ...DEFAULT_PREFERENCES.inputBehavior, ...partial.inputBehavior },
    }
  }

  private savePreferences(): void {
    if (!this.preferences) {
      throw new UserPreferencesError('偏好设置未初始化')
    }

    try {
      storageService.set(STORAGE_KEY, this.preferences)
      logger.info('[UserPreferencesService] 偏好设置保存成功')
      this.notifyListeners()
    } catch (error) {
      logger.error('[UserPreferencesService] 保存偏好设置失败:', error)
      throw new UserPreferencesError('保存偏好设置失败')
    }
  }

  private notifyListeners(): void {
    if (!this.preferences) return
    this.listeners.forEach(listener => {
      try {
        listener(this.preferences!)
      } catch (error) {
        logger.error('[UserPreferencesService] 通知监听器失败:', error)
      }
    })
  }

  getPreferences(): UserPreferences {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return { ...this.preferences }
  }

  setHotkey(action: HotkeyAction, config: HotkeyConfig): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys[action] = { ...config }
    this.savePreferences()
  }

  getHotkey(action: HotkeyAction): HotkeyConfig | undefined {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    const config = this.preferences.hotkeys[action]
    return config ? { ...config } : undefined
  }

  resetHotkey(action: HotkeyAction): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys[action] = DEFAULT_PREFERENCES.hotkeys[action]
    this.savePreferences()
  }

  resetAllHotkeys(): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys = { ...DEFAULT_HOTKEYS }
    this.savePreferences()
  }

  setInputBehavior(config: Partial<InputBehaviorConfig>): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.inputBehavior = { ...this.preferences.inputBehavior, ...config }
    this.savePreferences()
  }

  getInputBehavior(): InputBehaviorConfig {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return { ...this.preferences.inputBehavior }
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.theme = theme
    this.savePreferences()
  }

  getTheme(): 'light' | 'dark' | 'system' {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return this.preferences.theme || 'system'
  }

  resetAll(): void {
    this.preferences = { ...DEFAULT_PREFERENCES }
    this.savePreferences()
    logger.info('[UserPreferencesService] 所有偏好设置已重置为默认值')
  }

  subscribe(listener: (preferences: UserPreferences) => void): () => void {
    this.listeners.push(listener)
    if (this.preferences) {
      try {
        listener(this.preferences)
      } catch (error) {
        logger.error('[UserPreferencesService] 初始通知监听器失败:', error)
      }
    }

    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  exportPreferences(): string {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return JSON.stringify(this.preferences, null, 2)
  }

  importPreferences(jsonString: string): void {
    try {
      const imported = JSON.parse(jsonString)
      this.preferences = this.mergeWithDefaults(imported)
      this.savePreferences()
      logger.info('[UserPreferencesService] 偏好设置导入成功')
    } catch (error) {
      logger.error('[UserPreferencesService] 导入偏好设置失败:', error)
      throw new UserPreferencesError('导入的偏好设置格式无效')
    }
  }

  validateHotkey(config: HotkeyConfig): boolean {
    if (!config.key || config.key.trim().length === 0) {
      return false
    }
    return true
  }
}

export const userPreferencesService = new UserPreferencesService()
export default userPreferencesService
