import { logger } from '@/utils/safeLogger'
import type {
  AIPlugin,
  IPluginManager,
  PluginContext,
  PluginState,
} from './pluginTypes'

export class PluginManager implements IPluginManager {
  private plugins = new Map<string, AIPlugin>()
  private activePlugins = new Set<string>()
  private pluginStates = new Map<string, PluginState>()

  registerPlugin(plugin: AIPlugin): boolean {
    if (!plugin?.id) {
      logger.error('[PluginManager] 无效的插件对象: 缺少 id')
      return false
    }

    if (this.plugins.has(plugin.id)) {
      logger.warn('[PluginManager] 插件已存在，无法重复注册 [id: ' + plugin.id + ']')
      return false
    }

    this.plugins.set(plugin.id, plugin)
    this.pluginStates.set(plugin.id, {
      registered: true,
      active: false,
      error: null,
    })

    const context = this.createPluginContext(plugin.id)

    try {
      if (plugin.onInstall) {
        const result = plugin.onInstall(context)
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error('[PluginManager] 插件安装钩子执行失败 [id: ' + plugin.id + ']:', { error })
          })
        }
      }
    } catch (error) {
      logger.error('[PluginManager] 插件安装钩子异常 [id: ' + plugin.id + ']:', { error })
    }

    logger.info('[PluginManager] 插件注册成功 [id: ' + plugin.id + ', name: ' + plugin.name + ']')

    return true
  }

  unregisterPlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      logger.warn('[PluginManager] 插件未找到，无法卸载 [id: ' + pluginId + ']')
      return false
    }

    if (this.activePlugins.has(pluginId)) {
      this.deactivatePlugin(pluginId)
    }

    const context = this.createPluginContext(pluginId)

    try {
      if (plugin.onUninstall) {
        const result = plugin.onUninstall(context)
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error('[PluginManager] 插件卸载钩子执行失败 [id: ' + pluginId + ']:', { error })
          })
        }
      }
    } catch (error) {
      logger.error('[PluginManager] 插件卸载钩子异常 [id: ' + pluginId + ']:', { error })
    }

    this.plugins.delete(pluginId)
    this.activePlugins.delete(pluginId)
    this.pluginStates.delete(pluginId)

    logger.info('[PluginManager] 插件卸载成功 [id: ' + pluginId + ']')

    return true
  }

  getPlugin(pluginId: string): AIPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  listPlugins(): AIPlugin[] {
    return Array.from(this.plugins.values())
  }

  activatePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      logger.warn('[PluginManager] 无法激活未注册的插件 [id: ' + pluginId + ']')
      return false
    }

    if (this.activePlugins.has(pluginId)) {
      logger.debug('[PluginManager] 插件已经处于激活状态 [id: ' + pluginId + ']')
      return true
    }

    if (plugin.dependencies && plugin.dependencies.length > 0) {
      for (const dep of plugin.dependencies) {
        if (!this.activePlugins.has(dep)) {
          logger.warn(
            '[PluginManager] 插件依赖未满足 [id: ' +
              pluginId +
              ', missingDependency: ' +
              dep +
              ']',
          )
          return false
        }
      }
    }

    const context = this.createPluginContext(pluginId)

    try {
      if (plugin.onActivate) {
        const result = plugin.onActivate(context)
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error('[PluginManager] 插件激活钩子执行失败 [id: ' + pluginId + ']:', { error })
            this.activePlugins.delete(pluginId)
            this.updatePluginState(pluginId, false, error as Error)
          })
        }
      }
    } catch (error) {
      logger.error('[PluginManager] 插件激活钩子异常 [id: ' + pluginId + ']:', { error })
      this.updatePluginState(pluginId, false, error as Error)
      return false
    }

    this.activePlugins.add(pluginId)
    this.updatePluginState(pluginId, true, null)

    logger.info('[PluginManager] 插件激活成功 [id: ' + pluginId + ']')

    return true
  }

  deactivatePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      logger.warn('[PluginManager] 无法停用未注册的插件 [id: ' + pluginId + ']')
      return false
    }

    if (!this.activePlugins.has(pluginId)) {
      logger.debug('[PluginManager] 插件已经处于停用状态 [id: ' + pluginId + ']')
      return true
    }

    const dependentPlugins = this.findDependentPlugins(pluginId)
    if (dependentPlugins.length > 0) {
      logger.warn(
        '[PluginManager] 存在依赖此插件的活跃插件，请先停用它们 [id: ' +
          pluginId +
          ', dependents: ' +
          dependentPlugins.join(', ') +
          ']',
      )
      return false
    }

    const context = this.createPluginContext(pluginId)

    try {
      if (plugin.onDeactivate) {
        const result = plugin.onDeactivate(context)
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error('[PluginManager] 插件停用钩子执行失败 [id: ' + pluginId + ']:', { error })
          })
        }
      }
    } catch (error) {
      logger.error('[PluginManager] 插件停用钩子异常 [id: ' + pluginId + ']:', { error })
    }

    this.activePlugins.delete(pluginId)
    this.updatePluginState(pluginId, false, null)

    logger.info('[PluginManager] 插件停用成功 [id: ' + pluginId + ']')

    return true
  }

  isPluginActive(pluginId: string): boolean {
    return this.activePlugins.has(pluginId)
  }

  getActivePlugins(): string[] {
    return Array.from(this.activePlugins)
  }

  getPluginState(pluginId: string): PluginState | undefined {
    return this.pluginStates.get(pluginId)
  }

  clearAll(): void {
    const activePluginIds = Array.from(this.activePlugins)

    activePluginIds.forEach((pluginId) => {
      this.deactivatePlugin(pluginId)
    })

    const allPluginIds = Array.from(this.plugins.keys())
    allPluginIds.forEach((pluginId) => {
      this.unregisterPlugin(pluginId)
    })

    logger.info('[PluginManager] 已清理所有插件')
  }

  private createPluginContext(pluginId: string): PluginContext {
    const self = this

    return {
      pluginId,
      eventBus: {
        emit<T = unknown>(event: string, _payload: T): void {
          logger.debug(
            '[PluginContext] 插件发布事件 [pluginId: ' + pluginId + ', event: ' + event + ']',
          )
        },
        subscribe<T = unknown>(event: string, _handler: (payload: T) => void): () => void {
          logger.debug(
            '[PluginContext] 插件订阅事件 [pluginId: ' + pluginId + ', event: ' + event + ']',
          )
          return () => {}
        },
      },
      storage: {
        get<T = unknown>(key: string): T | null {
          const fullKey = 'plugin_' + pluginId + '_' + key
          try {
            const value = localStorage.getItem(fullKey)
            return value ? (JSON.parse(value) as T) : null
          } catch (error) {
            logger.error('[PluginContext] 存储读取失败 [key: ' + fullKey + ']:', { error })
            return null
          }
        },
        set(key: string, value: unknown): void {
          const fullKey = 'plugin_' + pluginId + '_' + key
          try {
            localStorage.setItem(fullKey, JSON.stringify(value))
          } catch (error) {
            logger.error('[PluginContext] 存储写入失败 [key: ' + fullKey + ']:', { error })
          }
        },
        remove(key: string): void {
          const fullKey = 'plugin_' + pluginId + '_' + key
          try {
            localStorage.removeItem(fullKey)
          } catch (error) {
            logger.error('[PluginContext] 存储删除失败 [key: ' + fullKey + ']:', { error })
          }
        },
      },
      getPlugin(id: string): AIPlugin | undefined {
        return self.plugins.get(id)
      },
      getActivePlugins(): string[] {
        return self.getActivePlugins()
      },
    }
  }

  private updatePluginState(pluginId: string, active: boolean, error: Error | null): void {
    const currentState = this.pluginStates.get(pluginId)
    if (currentState) {
      this.pluginStates.set(pluginId, {
        ...currentState,
        active,
        error,
      })
    }
  }

  private findDependentPlugins(pluginId: string): string[] {
    const dependents: string[] = []

    this.plugins.forEach((plugin, id) => {
      if (
        plugin.dependencies &&
        plugin.dependencies.includes(pluginId) &&
        this.activePlugins.has(id)
      ) {
        dependents.push(id)
      }
    })

    return dependents
  }
}

export const pluginManager: IPluginManager = new PluginManager()
export default pluginManager
