import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormulaTemplates, type FormulaTemplate } from '../useFormulaTemplates'

describe('useFormulaTemplates', () => {
  const mockTemplate = {
    name: '测试模板',
    description: '测试描述',
    targetEffects: ['免疫调节', '抗疲劳'],
    constraints: { maxIngredients: 5 },
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should initialize with empty templates when no storage', () => {
    const { result } = renderHook(() => useFormulaTemplates())
    expect(result.current.templates).toEqual([])
  })

  it('should load templates from localStorage', () => {
    const storedTemplates: FormulaTemplate[] = [
      {
        id: 'test_id',
        name: '存储的模板',
        description: '描述',
        targetEffects: ['免疫调节'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
      },
    ]
    localStorage.setItem('rmfood_formula_templates', JSON.stringify(storedTemplates))

    const { result } = renderHook(() => useFormulaTemplates())
    expect(result.current.templates).toEqual(storedTemplates)
  })

  it('should create a new template', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    expect(result.current.templates.length).toBe(1)
    expect(result.current.templates[0].name).toBe(mockTemplate.name)
    expect(result.current.templates[0].id).toBeDefined()
    expect(result.current.templates[0].createdAt).toBeDefined()
    expect(result.current.templates[0].usageCount).toBe(0)
  })

  it('should persist templates to localStorage', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    const stored = localStorage.getItem('rmfood_formula_templates')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe(mockTemplate.name)
  })

  it('should update a template', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    const templateId = result.current.templates[0].id

    act(() => {
      result.current.updateTemplate(templateId, {
        name: '更新后的名称',
        description: '更新后的描述',
      })
    })

    const updated = result.current.getTemplateById(templateId)
    expect(updated?.name).toBe('更新后的名称')
    expect(updated?.description).toBe('更新后的描述')
    expect(updated?.updatedAt).toBeGreaterThan(updated?.createdAt ?? 0)
  })

  it('should delete a template', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    const templateId = result.current.templates[0].id
    expect(result.current.templates.length).toBe(1)

    act(() => {
      result.current.deleteTemplate(templateId)
    })

    expect(result.current.templates.length).toBe(0)
  })

  it('should get template by id', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    const templateId = result.current.templates[0].id
    const found = result.current.getTemplateById(templateId)

    expect(found).toBeDefined()
    expect(found?.id).toBe(templateId)
    expect(found?.name).toBe(mockTemplate.name)
  })

  it('should increment usage count', () => {
    const { result } = renderHook(() => useFormulaTemplates())

    act(() => {
      result.current.createTemplate(mockTemplate)
    })

    const templateId = result.current.templates[0].id
    expect(result.current.templates[0].usageCount).toBe(0)

    act(() => {
      result.current.incrementUsage(templateId)
    })

    expect(result.current.templates[0].usageCount).toBe(1)

    act(() => {
      result.current.incrementUsage(templateId)
    })

    expect(result.current.templates[0].usageCount).toBe(2)
  })

  it('should return default templates', () => {
    const { result } = renderHook(() => useFormulaTemplates())
    const defaults = result.current.getDefaultTemplates()

    expect(defaults.length).toBe(3)
    expect(defaults[0].name).toBe('免疫调节配方')
    expect(defaults[1].name).toBe('抗疲劳配方')
    expect(defaults[2].name).toBe('综合调理配方')
  })
})