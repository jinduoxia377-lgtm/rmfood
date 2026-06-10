import type { ComponentType } from 'react'

export type PluginCapability =
  | 'chat-enhancement'
  | 'formula-analysis'
  | 'export-formats'
  | 'ui-components'
  | 'data-processing'
  | 'ai-integration'
  | 'custom-commands'
  | 'notification'

export interface PluginSettingItem {
  key: string
  label: string
  description?: string
  type: 'string' | 'number' | 'boolean' | 'select'
  defaultValue: string | number | boolean
  options?: { label: string; value: string | number }[]
  validation?: {
    required?: boolean
    min?: number
    max?: number
    pattern?: string
  }
}

export type PluginSettingsSchema = Record<string, PluginSettingItem>;

export interface PluginLifecycleHooks {
  onInstall?(context: PluginContext): void | Promise<void>
  onActivate?(context: PluginContext): void | Promise<void>
  onDeactivate?(context: PluginContext): void | Promise<void>
  onUninstall?(context: PluginContext): void | Promise<void>
}

export interface AIPlugin extends PluginLifecycleHooks {
  id: string
  name: string
  version: string
  description: string
  author?: string
  capabilities: PluginCapability[]
  dependencies?: string[]
  component?: ComponentType<Record<string, unknown>>
  settingsPanel?: ComponentType<{ pluginId: string; settings: Record<string, unknown> }>
  settingsSchema?: PluginSettingsSchema
  defaultSettings?: Record<string, unknown>
}

export interface PluginContext {
  pluginId: string
  eventBus: {
    emit<T = unknown>(event: string, payload: T): void
    subscribe<T = unknown>(event: string, handler: (payload: T) => void): UnsubscribeFn
  }
  storage: {
    get<T = unknown>(key: string): T | null
    set(key: string, value: unknown): void
    remove(key: string): void
  }
  getPlugin(pluginId: string): AIPlugin | undefined
  getActivePlugins(): string[]
}

export interface IPluginManager {
  registerPlugin(plugin: AIPlugin): boolean
  unregisterPlugin(pluginId: string): boolean
  getPlugin(pluginId: string): AIPlugin | undefined
  listPlugins(): AIPlugin[]
  activatePlugin(pluginId: string): boolean
  deactivatePlugin(pluginId: string): boolean
  isPluginActive(pluginId: string): boolean
  getActivePlugins(): string[]
  clearAll(): void
}

export type UnsubscribeFn = () => void

export interface PluginLoadResult {
  success: boolean
  plugin?: AIPlugin
  error?: Error
  loadTime?: number
}

export interface PluginState {
  registered: boolean
  active: boolean
  error: Error | null
  loadTime?: number
}
