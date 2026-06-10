import { logger } from '@/utils/safeLogger'
import type { AIPlugin, PluginLoadResult } from './pluginTypes'
import { pluginManager } from './PluginManager'

interface PreloadedPlugin {
  promise: Promise<AIPlugin>
  loaded: boolean
  error: Error | null
}

class PluginLoader {
  private preloadedPlugins = new Map<string, PreloadedPlugin>()
  private loadingPlugins = new Set<string>()
  private maxConcurrentLoads = 3
  private loadQueue: {
    path: string
    resolve: (result: PluginLoadResult) => void
    reject: (error: Error) => void
  }[] = []

  async loadPlugin(modulePath: string): Promise<PluginLoadResult> {
    if (!modulePath || typeof modulePath !== 'string') {
      const error = new Error('无效的模块路径')
      return { success: false, error }
    }

    if (this.loadingPlugins.has(modulePath)) {
      logger.debug('[PluginLoader] 模块正在加载中，等待完成 [path: ' + modulePath + ']')
      return this.waitForLoadCompletion(modulePath)
    }

    if (this.loadQueue.length >= this.maxConcurrentLoads && !this.loadingPlugins.has(modulePath)) {
      logger.debug(
        '[PluginLoader] 达到最大并发限制，加入队列 [path: ' +
          modulePath +
          ', queueSize: ' +
          this.loadQueue.length +
          ']',
      )
      return this.enqueueLoad(modulePath)
    }

    this.loadingPlugins.add(modulePath)

    const startTime = performance.now()

    try {
      logger.info('[PluginLoader] 开始加载插件 [path: ' + modulePath + ']')

      const module = await import(/* webpackIgnore: true */ modulePath)

      let pluginModule: AIPlugin | undefined

      if (module.default) {
        pluginModule = module.default as AIPlugin
      } else if (module.plugin || module.AIPlugin) {
        pluginModule = (module.plugin || module.AIPlugin) as AIPlugin
      }

      if (!pluginModule?.id) {
        throw new Error('插件模块格式无效：缺少必要的导出或 id 字段')
      }

      this.validatePluginStructure(pluginModule)

      const registered = pluginManager.registerPlugin(pluginModule)

      if (!registered) {
        throw new Error('插件注册失败：可能已存在相同 ID 的插件')
      }

      const endTime = performance.now()
      const loadTime = endTime - startTime

      logger.info(
        '[PluginLoader] 插件加载成功 [id: ' +
          pluginModule.id +
          ', loadTime: ' +
          loadTime.toFixed(2) +
          'ms]',
      )

      return {
        success: true,
        plugin: pluginModule,
        loadTime,
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      logger.error('[PluginLoader] 插件加载失败 [path: ' + modulePath + ']:', { error: err })

      return {
        success: false,
        error: err,
        loadTime: performance.now() - startTime,
      }
    } finally {
      this.loadingPlugins.delete(modulePath)
      this.processQueue()
    }
  }

  async loadPluginFromURL(url: string): Promise<PluginLoadResult> {
    if (!url || typeof url !== 'string') {
      return { success: false, error: new Error('无效的 URL') }
    }

    try {
      logger.warn('[PluginLoader] 从远程 URL 加载功能尚在开发中 [url: ' + url + ']')

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/javascript' },
        cache: 'default',
      })

      if (!response.ok) {
        throw new Error('HTTP 请求失败: ' + response.status + ' ' + response.statusText)
      }

      const code = await response.text()

      logger.warn('[PluginLoader] 远程代码已获取，动态执行存在安全风险')

      const blob = new Blob([code], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)

      try {
        const result = await this.loadPlugin(blobUrl)
        return result
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[PluginLoader] 远程插件加载失败 [url: ' + url + ']:', { error: err })
      return { success: false, error: err }
    }
  }

  async preloadPlugin(pluginIdOrPath: string): Promise<boolean> {
    if (!pluginIdOrPath || typeof pluginIdOrPath !== 'string') {
      logger.error('[PluginLoader] 无效的插件标识符')
      return false
    }

    if (this.preloadedPlugins.has(pluginIdOrPath)) {
      logger.debug('[PluginLoader] 插件已预加载 [id: ' + pluginIdOrPath + ']')
      return true
    }

    logger.info('[PluginLoader] 开始预加载插件 [path: ' + pluginIdOrPath + ']')

    const preloadEntry: PreloadedPlugin = {
      promise: this.loadPlugin(pluginIdOrPath).then((result) => {
        if (result.success && result.plugin) {
          preloadEntry.loaded = true
          preloadEntry.error = null
          return result.plugin
        } else {
          preloadEntry.loaded = false
          preloadEntry.error = result.error || new Error('预加载失败')
          throw result.error
        }
      }),
      loaded: false,
      error: null,
    }

    this.preloadedPlugins.set(pluginIdOrPath, preloadEntry)

    try {
      await preloadEntry.promise
      logger.info('[PluginLoader] 插件预加载完成 [path: ' + pluginIdOrPath + ']')
      return true
    } catch (error) {
      logger.error('[PluginLoader] 插件预加载失败 [path: ' + pluginIdOrPath + ']:', { error })
      return false
    }
  }

  getPreloadedPlugin(pluginId: string): AIPlugin | null {
    const entry = this.preloadedPlugins.get(pluginId)
    if (!entry?.loaded) {
      return null
    }

    let plugin: AIPlugin | undefined
    entry.promise.then((p) => {
      plugin = p
    })

    return plugin || null
  }

  isPreloading(pluginId: string): boolean {
    const entry = this.preloadedPlugins.get(pluginId)
    return !!entry && !entry.loaded && !entry.error
  }

  clearPreloaded(): void {
    this.preloadedPlugins.clear()
    logger.info('[PluginLoader] 已清理所有预加载缓存')
  }

  setMaxConcurrentLoads(max: number): void {
    if (max > 0 && max <= 10) {
      this.maxConcurrentLoads = max
      logger.info('[PluginLoader] 最大并发加载数更新为: ' + max)
    } else {
      logger.warn('[PluginLoader] 无效的并发数设置，有效范围: 1-10')
    }
  }

  private validatePluginStructure(plugin: AIPlugin): void {
    const requiredFields: (keyof AIPlugin)[] = ['id', 'name', 'version', 'capabilities']

    for (const field of requiredFields) {
      if (!plugin[field]) {
        throw new Error('插件缺少必要字段: ' + field)
      }
    }

    if (typeof plugin.id !== 'string' || plugin.id.length === 0) {
      throw new Error('插件 ID 必须是非空字符串')
    }

    if (!Array.isArray(plugin.capabilities) || plugin.capabilities.length === 0) {
      throw new Error('插件必须至少声明一个能力')
    }

    if (
      plugin.dependencies &&
      (!Array.isArray(plugin.dependencies) || plugin.dependencies.some((d) => typeof d !== 'string'))
    ) {
      throw new Error('依赖项必须为字符串数组')
    }

    logger.debug('[PluginLoader] 插件结构验证通过 [id: ' + plugin.id + ']')
  }

  private enqueueLoad(modulePath: string): Promise<PluginLoadResult> {
    return new Promise((resolve, reject) => {
      this.loadQueue.push({
        path: modulePath,
        resolve,
        reject,
      })
    })
  }

  private processQueue(): void {
    while (this.loadQueue.length > 0 && this.loadingPlugins.size < this.maxConcurrentLoads) {
      const next = this.loadQueue.shift()
      if (next) {
        this.loadPlugin(next.path).then(next.resolve).catch(next.reject)
      }
    }
  }

  private waitForLoadCompletion(modulePath: string): Promise<PluginLoadResult> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.loadingPlugins.has(modulePath)) {
          clearInterval(checkInterval)
          const plugin = pluginManager.getPlugin(this.extractPluginIdFromPath(modulePath))
          resolve({
            success: !!plugin,
            plugin: plugin || undefined,
            loadTime: 0,
          })
        }
      }, 50)
    })
  }

  private extractPluginIdFromPath(path: string): string {
    const parts = path.split(/[/\\]/)
    const fileName = parts[parts.length - 1]
    return fileName.replace(/\.[^.]+$/, '')
  }
}

export const pluginLoader = new PluginLoader()
export default pluginLoader
