import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { PluginManager } from '../PluginManager'
import type { AIPlugin, PluginContext } from '../pluginTypes'

const createMockPlugin = (overrides: Partial<AIPlugin> = {}): AIPlugin => ({
  id: 'test-plugin-' + Math.random().toString(36).substring(2, 11),
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit testing',
  capabilities: ['chat-enhancement'],
  ...overrides
})

describe('PluginManager', () => {
  let manager: PluginManager

  beforeEach(() => {
    manager = new PluginManager()
    localStorage.clear()
  })

  afterEach(() => {
    manager.clearAll()
  })

  describe('插件注册与注销', () => {
    it('应成功注册有效插件', () => {
      const plugin = createMockPlugin({ id: 'plugin-1' })

      const result = manager.registerPlugin(plugin)

      expect(result).toBe(true)
      expect(manager.getPlugin('plugin-1')).toBe(plugin)
      expect(manager.listPlugins()).toHaveLength(1)
      expect(manager.isPluginActive('plugin-1')).toBe(false)
    })

    it('应拒绝重复注册相同 ID 的插件', () => {
      const plugin1 = createMockPlugin({ id: 'duplicate-plugin' })
      const plugin2 = createMockPlugin({
        id: 'duplicate-plugin',
        name: 'Different Name'
      })

      const result1 = manager.registerPlugin(plugin1)
      const result2 = manager.registerPlugin(plugin2)

      expect(result1).toBe(true)
      expect(result2).toBe(false)
      expect(manager.listPlugins()).toHaveLength(1)
      expect(manager.getPlugin('duplicate-plugin')?.name).toBe('Test Plugin')
    })

    it('应拒绝无效的插件对象', () => {
      const result1 = manager.registerPlugin(null as unknown as AIPlugin)
      const result2 = manager.registerPlugin({} as AIPlugin)

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(manager.listPlugins()).toHaveLength(0)
    })

    it('应成功卸载已注册的插件', () => {
      const plugin = createMockPlugin({ id: 'uninstall-plugin' })
      manager.registerPlugin(plugin)

      const result = manager.unregisterPlugin('uninstall-plugin')

      expect(result).toBe(true)
      expect(manager.getPlugin('uninstall-plugin')).toBeUndefined()
      expect(manager.listPlugins()).toHaveLength(0)
    })

    it('应拒绝卸载不存在的插件', () => {
      const result = manager.unregisterPlugin('non-existent')

      expect(result).toBe(false)
    })

    it('卸载活跃插件时应自动停用', () => {
      const onDeactivate = jest.fn()
      const plugin = createMockPlugin({
        id: 'active-uninstall',
        onDeactivate
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('active-uninstall')

      expect(manager.isPluginActive('active-uninstall')).toBe(true)

      const result = manager.unregisterPlugin('active-uninstall')

      expect(result).toBe(true)
      expect(onDeactivate).toHaveBeenCalled()
      expect(manager.getActivePlugins()).not.toContain('active-uninstall')
    })
  })

  describe('插件激活与停用', () => {
    it('应成功激活已注册的插件', () => {
      const onActivate = jest.fn()
      const plugin = createMockPlugin({
        id: 'activate-test',
        onActivate
      })

      manager.registerPlugin(plugin)
      const result = manager.activatePlugin('activate-test')

      expect(result).toBe(true)
      expect(manager.isPluginActive('activate-test')).toBe(true)
      expect(onActivate).toHaveBeenCalledTimes(1)
      expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({
        pluginId: 'activate-test'
      }))
    })

    it('应拒绝激活未注册的插件', () => {
      const result = manager.activatePlugin('non-existent')

      expect(result).toBe(false)
    })

    it('应允许重复激活已激活的插件（幂等性）', () => {
      const onActivate = jest.fn()
      const plugin = createMockPlugin({
        id: 'reactivate-test',
        onActivate
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('reactivate-test')
      const result = manager.activatePlugin('reactivate-test')

      expect(result).toBe(true)
      expect(onActivate).toHaveBeenCalledTimes(1)
    })

    it('应成功停用活跃插件', () => {
      const onDeactivate = jest.fn()
      const plugin = createMockPlugin({
        id: 'deactivate-test',
        onDeactivate
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('deactivate-test')
      const result = manager.deactivatePlugin('deactivate-test')

      expect(result).toBe(true)
      expect(manager.isPluginActive('deactivate-test')).toBe(false)
      expect(onDeactivate).toHaveBeenCalledTimes(1)
    })

    it('应拒绝停用未激活的插件（但返回 true 表示状态正确）', () => {
      const plugin = createMockPlugin({ id: 'inactive-test' })
      manager.registerPlugin(plugin)

      const result = manager.deactivatePlugin('inactive-test')

      expect(result).toBe(true)
    })

    it('应拒绝停用不存在的插件', () => {
      const result = manager.deactivatePlugin('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('生命周期钩子调用顺序', () => {
    it('注册时应调用 onInstall 钩子', () => {
      const onInstall = jest.fn()
      const plugin = createMockPlugin({
        id: 'lifecycle-install',
        onInstall
      })

      manager.registerPlugin(plugin)

      expect(onInstall).toHaveBeenCalledTimes(1)
      expect(onInstall).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'lifecycle-install' })
      )
    })

    it('完整生命周期顺序应为 install -> activate -> deactivate -> uninstall', () => {
      const callOrder: string[] = []

      const plugin = createMockPlugin({
        id: 'full-lifecycle',
        onInstall: jest.fn((_context: PluginContext): void => { callOrder.push('install') }),
        onActivate: jest.fn((_context: PluginContext): void => { callOrder.push('activate') }),
        onDeactivate: jest.fn((_context: PluginContext): void => { callOrder.push('deactivate') }),
        onUninstall: jest.fn((_context: PluginContext): void => { callOrder.push('uninstall') })
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('full-lifecycle')
      manager.deactivatePlugin('full-lifecycle')
      manager.unregisterPlugin('full-lifecycle')

      expect(callOrder).toEqual(['install', 'activate', 'deactivate', 'uninstall'])
    })

    it('异步生命周期钩子应正确处理', async () => {
      let _resolveActivate: (value: void) => void = () => {}
      const activatePromise = new Promise<void>((resolve) => {
        _resolveActivate = resolve
      })

      const onActivate = jest.fn(() => activatePromise)
      const plugin = createMockPlugin({
        id: 'async-hook',
        onActivate
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('async-hook')

      expect(onActivate).toHaveBeenCalled()

      // 需要手动 resolve 以完成异步测试
      _resolveActivate()
      await activatePromise
    })
  })

  describe('依赖关系管理', () => {
    it('应在依赖满足时允许激活插件', () => {
      const dependency = createMockPlugin({ id: 'dependency-1' })
      const dependent = createMockPlugin({
        id: 'dependent-1',
        dependencies: ['dependency-1']
      })

      manager.registerPlugin(dependency)
      manager.registerPlugin(dependent)
      manager.activatePlugin('dependency-1')

      const result = manager.activatePlugin('dependent-1')

      expect(result).toBe(true)
      expect(manager.isPluginActive('dependent-1')).toBe(true)
    })

    it('应在依赖未满足时拒绝激活插件', () => {
      const dependent = createMockPlugin({
        id: 'dependent-2',
        dependencies: ['missing-dep']
      })

      manager.registerPlugin(dependent)
      const result = manager.activatePlugin('dependent-2')

      expect(result).toBe(false)
      expect(manager.isPluginActive('dependent-2')).toBe(false)
    })

    it('应在存在依赖者时拒绝停用被依赖插件', () => {
      const dependency = createMockPlugin({ id: 'dep-base' })
      const dependent = createMockPlugin({
        id: 'dep-dependent',
        dependencies: ['dep-base']
      })

      manager.registerPlugin(dependency)
      manager.registerPlugin(dependent)
      manager.activatePlugin('dep-base')
      manager.activatePlugin('dep-dependent')

      const result = manager.deactivatePlugin('dep-base')

      expect(result).toBe(false)
      expect(manager.isPluginActive('dep-base')).toBe(true)
    })
  })

  describe('并发操作安全性', () => {
    it('应安全处理并发注册多个插件', () => {
      const plugins = Array.from({ length: 100 }, (_, i) =>
        createMockPlugin({ id: 'concurrent-' + i })
      )

      plugins.forEach((plugin) => manager.registerPlugin(plugin))

      expect(manager.listPlugins()).toHaveLength(100)
    })

    it('应安全处理并发激活/停用操作', () => {
      const plugins = Array.from({ length: 50 }, (_, i) =>
        createMockPlugin({ id: 'concurrent-op-' + i })
      )

      plugins.forEach((plugin) => {
        manager.registerPlugin(plugin)
        manager.activatePlugin(plugin.id)
      })

      expect(manager.getActivePlugins()).toHaveLength(50)

      plugins.forEach((plugin) => {
        manager.deactivatePlugin(plugin.id)
      })

      expect(manager.getActivePlugins()).toHaveLength(0)
    })

    it('应保持操作原子性，部分失败不影响其他插件', () => {
      const validPlugin = createMockPlugin({ id: 'valid-in-batch' })
      const invalidPlugin = {} as AIPlugin

      const result1 = manager.registerPlugin(validPlugin)
      const result2 = manager.registerPlugin(invalidPlugin)

      expect(result1).toBe(true)
      expect(result2).toBe(false)
      expect(manager.listPlugins()).toHaveLength(1)
      expect(manager.getPlugin('valid-in-batch')).toBeDefined()
    })
  })

  describe('错误恢复机制', () => {
    it('应捕获并处理 onInstall 中的异常', () => {
      const plugin = createMockPlugin({
        id: 'error-install',
        onInstall: jest.fn(() => {
          throw new Error('Install error')
        })
      })

      const result = manager.registerPlugin(plugin)

      expect(result).toBe(true)
      expect(manager.getPlugin('error-install')).toBeDefined()
    })

    it('应捕获并处理 onActivate 中的异常', () => {
      const plugin = createMockPlugin({
        id: 'error-activate',
        onActivate: jest.fn(() => {
          throw new Error('Activate error')
        })
      })

      manager.registerPlugin(plugin)
      const result = manager.activatePlugin('error-activate')

      expect(result).toBe(false)
      expect(manager.isPluginActive('error-activate')).toBe(false)
    })

    it('应捕获并处理 onDeactivate 中的异常', () => {
      const plugin = createMockPlugin({
        id: 'error-deactivate',
        onDeactivate: jest.fn(() => {
          throw new Error('Deactivate error')
        })
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('error-deactivate')
      const result = manager.deactivatePlugin('error-deactivate')

      expect(result).toBe(true)
      expect(manager.isPluginActive('error-deactivate')).toBe(false)
    })

    it('应捕获并处理 onUninstall 中的异常', () => {
      const plugin = createMockPlugin({
        id: 'error-uninstall',
        onUninstall: jest.fn(() => {
          throw new Error('Uninstall error')
        })
      })

      manager.registerPlugin(plugin)
      const result = manager.unregisterPlugin('error-uninstall')

      expect(result).toBe(true)
      expect(manager.getPlugin('error-uninstall')).toBeUndefined()
    })

    it('一个插件的错误不应影响其他插件的操作', () => {
      const normalPlugin = createMockPlugin({ id: 'normal-neighbor' })
      const errorPlugin = createMockPlugin({
        id: 'error-neighbor',
        onActivate: jest.fn(() => {
          throw new Error('Error in neighbor')
        })
      })

      manager.registerPlugin(normalPlugin)
      manager.registerPlugin(errorPlugin)

      manager.activatePlugin('normal-neighbor')
      manager.activatePlugin('error-neighbor')

      expect(manager.isPluginActive('normal-neighbor')).toBe(true)
      expect(manager.isPluginActive('error-neighbor')).toBe(false)
    })
  })

  describe('查询功能', () => {
    it('listPlugins 应返回所有已注册插件', () => {
      const plugins = [
        createMockPlugin({ id: 'list-1' }),
        createMockPlugin({ id: 'list-2' }),
        createMockPlugin({ id: 'list-3' })
      ]

      plugins.forEach((p) => manager.registerPlugin(p))

      const listed = manager.listPlugins()

      expect(listed).toHaveLength(3)
      expect(listed.map((p: AIPlugin) => p.id)).toEqual(['list-1', 'list-2', 'list-3'])
    })

    it('getActivePlugins 应返回所有活跃插件 ID', () => {
      ;['active-a', 'active-b', 'active-c'].forEach((id) => {
        manager.registerPlugin(createMockPlugin({ id }))
        manager.activatePlugin(id)
      })

      const activeIds = manager.getActivePlugins()

      expect(activeIds).toHaveLength(3)
      expect(activeIds).toContain('active-a')
      expect(activeIds).toContain('active-b')
      expect(activeIds).toContain('active-c')
    })

    it('isPluginActive 应准确反映插件状态', () => {
      const plugin = createMockPlugin({ id: 'state-check' })
      manager.registerPlugin(plugin)

      expect(manager.isPluginActive('state-check')).toBe(false)

      manager.activatePlugin('state-check')
      expect(manager.isPluginActive('state-check')).toBe(true)

      manager.deactivatePlugin('state-check')
      expect(manager.isPluginActive('state-check')).toBe(false)
    })

    it('clearAll 应清理所有插件和状态', () => {
      Array.from({ length: 10 }, (_, i) => ({
        plugin: createMockPlugin({ id: 'cleanup-' + i }),
        index: i,
      })).forEach(({ plugin, index }) => {
        manager.registerPlugin(plugin)
        if (index % 2 === 0) manager.activatePlugin(plugin.id)
      })

      manager.clearAll()

      expect(manager.listPlugins()).toHaveLength(0)
      expect(manager.getActivePlugins()).toHaveLength(0)
    })
  })

  describe('PluginContext 功能验证', () => {
    it('context 应提供正确的 pluginId', () => {
      let capturedContext: PluginContext | undefined

      const plugin = createMockPlugin({
        id: 'context-test',
        onActivate: jest.fn((ctx) => {
          capturedContext = ctx
        })
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('context-test')

      expect(capturedContext?.pluginId).toBe('context-test')
    })

    it('context.storage 应支持数据持久化', async () => {
      let contextRef: PluginContext | undefined

      const plugin = createMockPlugin({
        id: 'storage-test',
        onActivate: jest.fn((ctx) => {
          contextRef = ctx
          ctx.storage.set('testKey', { data: 'value' })
        })
      })

      manager.registerPlugin(plugin)
      manager.activatePlugin('storage-test')

      const stored = contextRef?.storage.get('testKey')
      expect(stored).toEqual({ data: 'value' })
    })

    it('context 应能访问其他插件信息', () => {
      const otherPlugin = createMockPlugin({ id: 'other-visible' })
      let contextRef: PluginContext | undefined

      const mainPlugin = createMockPlugin({
        id: 'main-context',
        onActivate: jest.fn((ctx) => {
          contextRef = ctx
        })
      })

      manager.registerPlugin(otherPlugin)
      manager.registerPlugin(mainPlugin)
      manager.activatePlugin('main-context')

      const found = contextRef?.getPlugin('other-visible')
      expect(found)?.toBeDefined()
      expect(found?.id).toBe('other-visible')
    })
  })
})
