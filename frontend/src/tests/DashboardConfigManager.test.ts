import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import DashboardConfigManager from '../config/dashboard'

// 模拟localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('DashboardConfigManager 测试', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('getAllLayouts 应该返回默认布局', () => {
    const layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(1)
    expect(layouts[0].id).toBe('default')
    expect(layouts[0].name).toBe('默认视图')
    expect(layouts[0].isDefault).toBe(true)
  })

  test('getCurrentLayout 应该返回默认布局', () => {
    const layout = DashboardConfigManager.getCurrentLayout()
    expect(layout.id).toBe('default')
    expect(layout.name).toBe('默认视图')
  })

  test('saveLayout 应该保存布局', () => {
    const newLayout = DashboardConfigManager.createLayout('测试布局')
    expect(newLayout.name).toBe('测试布局')
    expect(newLayout.id).not.toBe('default')

    const layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(2)
  })

  test('switchLayout 应该切换当前布局', () => {
    const newLayout = DashboardConfigManager.createLayout('测试布局')
    DashboardConfigManager.switchLayout(newLayout.id)

    const currentLayout = DashboardConfigManager.getCurrentLayout()
    expect(currentLayout.id).toBe(newLayout.id)
  })

  test('deleteLayout 应该删除布局', () => {
    const newLayout = DashboardConfigManager.createLayout('测试布局')
    let layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(2)

    DashboardConfigManager.deleteLayout(newLayout.id)
    layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(1)
  })

  test('应该处理损坏的localStorage数据', () => {
    // 模拟损坏的数据
    localStorage.setItem('rmfood_dashboard_configs', 'invalid json')
    const layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(1)
    expect(layouts[0].id).toBe('default')
  })

  test('应该处理无效的布局数据', () => {
    // 模拟无效的布局数据
    const invalidLayouts = [
      { id: '1', name: '布局1', isDefault: true, cards: 'not an array' },
      { id: '2', name: '布局2', isDefault: false, cards: [{ id: '1', type: 'invalid-type', title: '测试卡片' }] }
    ]
    localStorage.setItem('rmfood_dashboard_configs', JSON.stringify(invalidLayouts))
    
    const layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(2)
    expect(layouts[0].cards).toBeInstanceOf(Array)
    expect(layouts[1].cards).toBeInstanceOf(Array)
  })

  test('应该处理无效的卡片数据', () => {
    const layoutWithInvalidCards = {
      id: 'test-layout',
      name: '测试布局',
      isDefault: false,
      cards: [
        { id: '1', type: 'stats-formulas', title: '配方总数' },
        'not a card',
        null,
        undefined
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isShared: false,
      ownerId: 'current-user',
      ownerName: '当前用户',
      shares: [],
      lastModifiedBy: 'current-user',
      lastModifiedAt: new Date().toISOString()
    }
    localStorage.setItem('rmfood_dashboard_configs', JSON.stringify([layoutWithInvalidCards]))
    
    const layouts = DashboardConfigManager.getAllLayouts()
    expect(layouts).toHaveLength(1)
    expect(layouts[0].cards).toBeInstanceOf(Array)
    expect(layouts[0].cards.length).toBe(4)
  })
})
