import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/safeLogger'

export interface FormulaTemplate {
  id: string
  name: string
  description: string
  targetEffects: string[]
  constraints?: Record<string, unknown>
  priorityValues?: Record<string, number>
  createdAt: number
  updatedAt: number
  usageCount: number
}

const STORAGE_KEY = 'rmfood_formula_templates'

export function useFormulaTemplates() {
  const [templates, setTemplates] = useState<FormulaTemplate[]>([])

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setTemplates(parsed)
          logger.info('配方模板加载成功', { count: parsed.length })
        }
      }
    } catch (error) {
      logger.error('加载配方模板失败', { error })
      setTemplates([])
    }
  }, [])

  const saveTemplates = useCallback((items: FormulaTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      setTemplates(items)
    } catch (error) {
      logger.error('保存配方模板失败', { error })
    }
  }, [])

  const createTemplate = useCallback((template: Omit<FormulaTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    const newTemplate: FormulaTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    }

    setTemplates((prev) => {
      const updated = [...prev, newTemplate]
      saveTemplates(updated)
      return updated
    })

    logger.info('配方模板创建成功', { name: template.name })
    return newTemplate
  }, [saveTemplates])

  const updateTemplate = useCallback((id: string, updates: Partial<Omit<FormulaTemplate, 'id' | 'createdAt'>>) => {
    setTemplates((prev) => {
      const updated = prev.map((template) =>
        template.id === id
          ? { ...template, ...updates, updatedAt: Date.now() }
          : template,
      )
      saveTemplates(updated)
      return updated
    })
    logger.info('配方模板更新成功', { id })
  }, [saveTemplates])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const updated = prev.filter((template) => template.id !== id)
      saveTemplates(updated)
      return updated
    })
    logger.info('配方模板删除成功', { id })
  }, [saveTemplates])

  const getTemplateById = useCallback((id: string) => {
    return templates.find((template) => template.id === id)
  }, [templates])

  const incrementUsage = useCallback((id: string) => {
    updateTemplate(id, { usageCount: (getTemplateById(id)?.usageCount || 0) + 1 })
  }, [getTemplateById, updateTemplate])

  const getDefaultTemplates = useCallback((): FormulaTemplate[] => [
    {
      id: 'template_default_1',
      name: '免疫调节配方',
      description: '增强免疫力的经典配方组合',
      targetEffects: ['免疫调节'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    },
    {
      id: 'template_default_2',
      name: '抗疲劳配方',
      description: '缓解疲劳、提升精力的配方',
      targetEffects: ['抗疲劳'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    },
    {
      id: 'template_default_3',
      name: '综合调理配方',
      description: '多效合一的综合调理配方',
      targetEffects: ['免疫调节', '抗疲劳', '抗氧化'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    },
  ], [])

  return {
    templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    incrementUsage,
    getDefaultTemplates,
    loadTemplates,
  }
}
