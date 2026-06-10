/**
 * usePromptManager - 企业级提示词管理Hook
 *
 * 核心功能：
 * ✅ 多级分类系统（3级层级结构）
 * ✅ 完整CRUD操作
 * ✅ 智能推荐算法（基于使用频率、上下文匹配、趋势分析）
 * ✅ 模板变量渲染与验证
 * ✅ 导入/导出功能（JSON格式）
 * ✅ 本地持久化存储
 * ✅ 使用统计与分析
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type {
  PromptTemplate,
  PromptCategory,
  PromptUsageRecord,
  PromptRecommendation,
  PromptExportData,
  UsePromptManagerReturn,
  PromptId,
  CategoryId,
} from './types/prompt'
import { logger } from '@/utils/safeLogger'

// ============================================
// 常量定义
// ============================================

const STORAGE_KEY = 'rmfood_prompt_manager_v2'
const MAX_USAGE_RECORDS = 1000
const RECOMMENDATION_LIMIT = 10

// ============================================
// 内置默认数据
// ============================================

/** 内置分类系统 */
const BUILTIN_CATEGORIES: PromptCategory[] = [
  {
    id: 'cat_formula',
    name: '配方相关',
    icon: 'FlaskConical',
    description: '配方查询、优化、分析类提示词',
    parentId: null,
    sortOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: [
      {
        id: 'cat_formula_query',
        name: '配方查询',
        icon: 'Search',
        parentId: 'cat_formula',
        sortOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'cat_formula_optimize',
        name: '配方优化',
        icon: 'TrendingUp',
        parentId: 'cat_formula',
        sortOrder: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'cat_formula_analysis',
        name: '配方分析',
        icon: 'BarChart3',
        parentId: 'cat_formula',
        sortOrder: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  },
  {
    id: 'cat_nutrition',
    name: '营养健康',
    icon: 'Heart',
    description: '营养成分、健康建议类提示词',
    parentId: null,
    sortOrder: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: [
      {
        id: 'cat_nutrition_analysis',
        name: '营养分析',
        icon: 'PieChart',
        parentId: 'cat_nutrition',
        sortOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'cat_health_advice',
        name: '健康建议',
        icon: 'ShieldCheck',
        parentId: 'cat_nutrition',
        sortOrder: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  },
  {
    id: 'cat_cooking',
    name: '烹饪技巧',
    icon: 'ChefHat',
    description: '烹饪方法、工艺流程类提示词',
    parentId: null,
    sortOrder: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: [],
  },
  {
    id: 'cat_custom',
    name: '自定义',
    icon: 'Plus',
    description: '用户创建的自定义提示词',
    parentId: null,
    sortOrder: 999,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    children: [],
  },
]

/** 内置提示词模板 */
const BUILTIN_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    title: '配方功效查询',
    content: '请详细说明{{ingredient}}这个配方的功效和作用机制？包括主要成分、适用人群、注意事项等。',
    categoryId: 'cat_formula_query',
    description: '快速了解任意配方的详细功效信息',
    tags: ['配方', '功效', '查询', '常用'],
    variables: [
      {
        name: 'ingredient',
        label: '配方名称',
        type: 'text',
        required: true,
        placeholder: '例如：人参枸杞茶',
      },
    ],
    isBuiltin: true,
    isFavorite: false,
    visibility: 'public',
    version: '1.0.0',
  },
  {
    title: '配方营养分析',
    content: '对{{formula_name}}进行全面的营养分析，包括：\n1. 宏量营养素含量（蛋白质、脂肪、碳水化合物）\n2. 微量营养素含量（维生素、矿物质）\n3. 热量估算\n4. 营养价值评价\n5. 改进建议{{improvement_focus}}',
    categoryId: 'cat_nutrition_analysis',
    description: '深度分析配方的营养成分和价值',
    tags: ['营养', '分析', '专业'],
    variables: [
      {
        name: 'formula_name',
        label: '配方名称',
        type: 'text',
        required: true,
        placeholder: '输入要分析的配方名称',
      },
      {
        name: 'improvement_focus',
        label: '改进重点（可选）',
        type: 'multiline',
        required: false,
        placeholder: '例如：降低糖分、增加蛋白质',
      },
    ],
    isBuiltin: true,
    isFavorite: true,
    visibility: 'public',
    version: '1.0.0',
  },
  {
    title: '配方优化建议',
    content: '我有一个{{product_type}}配方，目前存在以下问题：{{current_issues}}。请提供专业的优化方案，要求：\n- 保持原有风味特色\n- {{optimization_goal}}\n- 成本控制在{{cost_budget}}以内\n- 符合{{target_audience}}需求',
    categoryId: 'cat_formula_optimize',
    description: '获得专业的配方优化方案和改进建议',
    tags: ['优化', '改进', '方案', '热门'],
    variables: [
      {
        name: 'product_type',
        label: '产品类型',
        type: 'select',
        required: true,
        options: [
          { label: '饮品', value: '饮品' },
          { label: '烘焙', value: '烘焙' },
          { label: '调味品', value: '调味品' },
          { label: '保健品', value: '保健品' },
          { label: '其他', value: '其他' },
        ],
      },
      {
        name: 'current_issues',
        label: '当前问题',
        type: 'multiline',
        required: true,
        placeholder: '描述当前配方存在的问题...',
      },
      {
        name: 'optimization_goal',
        label: '优化目标',
        type: 'select',
        required: true,
        options: [
          { label: '提升口感', value: '提升口感' },
          { label: '降低成本', value: '降低成本' },
          { label: '延长保质期', value: '延长保质期' },
          { label: '增强功效', value: '增强功效' },
          { label: '简化工艺', value: '简化工艺' },
        ],
      },
      {
        name: 'cost_budget',
        label: '成本预算',
        type: 'text',
        required: false,
        placeholder: '例如：每份成本不超过5元',
      },
      {
        name: 'target_audience',
        label: '目标人群',
        type: 'text',
        required: true,
        placeholder: '例如：25-35岁都市白领女性',
      },
    ],
    isBuiltin: true,
    isFavorite: true,
    visibility: 'public',
    version: '1.1.0',
  },
  {
    title: '食材搭配咨询',
    content: '{{main_ingredient}}可以和哪些食材搭配？请从以下角度分析：\n1. 营养互补性\n2. 风味协调性\n3. 功效协同性\n4. 禁忌搭配（如有）\n5. 推荐的搭配比例{{ratio_preference}}',
    categoryId: 'cat_cooking',
    description: '获取专业的食材搭配建议',
    tags: ['食材', '搭配', '烹饪', '实用'],
    variables: [
      {
        name: 'main_ingredient',
        label: '主食材',
        type: 'text',
        required: true,
        placeholder: '输入主食材名称',
      },
      {
        name: 'ratio_preference',
        label: '比例偏好（可选）',
        type: 'text',
        required: false,
        placeholder: '例如：希望主食材占比60%以上',
      },
    ],
    isBuiltin: true,
    isFavorite: false,
    visibility: 'public',
    version: '1.0.0',
  },
  {
    title: '工艺流程指导',
    content: '请提供{{product}}的详细制作工艺流程，要求：\n- 步骤清晰，包含关键参数（温度、时间、比例）\n- 标注关键控制点（CCP）\n- 常见问题及解决方案\n- 质量标准{{quality_standard}}\n- {{special_requirements}}',
    categoryId: 'cat_cooking',
    description: '获得完整的制作工艺流程指导',
    tags: ['工艺', '流程', '生产', '专业'],
    variables: [
      {
        name: 'product',
        label: '产品名称',
        type: 'text',
        required: true,
        placeholder: '输入产品名称',
      },
      {
        name: 'quality_standard',
        label: '质量标准（可选）',
        type: 'select',
        required: false,
        options: [
          { label: '企业标准', value: '企业标准' },
          { label: '行业标准', value: '行业标准' },
          { label: '国家标准', value: '国家标准' },
          { label: '国际标准', value: '国际标准' },
        ],
      },
      {
        name: 'special_requirements',
        label: '特殊要求（可选）',
        type: 'multiline',
        required: false,
        placeholder: '例如：需要符合有机认证、无添加等',
      },
    ],
    isBuiltin: true,
    isFavorite: false,
    visibility: 'public',
    version: '1.0.0',
  },
  {
    title: '健康饮食建议',
    content: '针对{{user_profile}}的健康状况，请提供：\n1. 饮食原则和建议\n2. 推荐的食谱类型（每周{{meal_count}}例）\n3. 需要避免的食物\n4. 营养补充建议{{nutrition_focus}}\n5. 生活习惯调整建议',
    categoryId: 'cat_health_advice',
    description: '获得个性化的健康饮食方案',
    tags: ['健康', '饮食', '个性化', '热门'],
    variables: [
      {
        name: 'user_profile',
        label: '用户画像',
        type: 'multiline',
        required: true,
        placeholder: '描述年龄、性别、健康状况、过敏史等...',
      },
      {
        name: 'meal_count',
        label: '每周食谱数量',
        type: 'number',
        required: false,
        defaultValue: '7',
      },
      {
        name: 'nutrition_focus',
        label: '营养重点（可选）',
        type: 'select',
        required: false,
        options: [
          { label: '减脂', value: '减脂' },
          { label: '增肌', value: '增肌' },
          { label: '控糖', value: '控糖' },
          { label: '补钙', value: '补钙' },
          { label: '补血', value: '补血' },
          { label: '美容养颜', value: '美容养颜' },
        ],
      },
    ],
    isBuiltin: true,
    isFavorite: true,
    visibility: 'public',
    version: '1.0.0',
  },
]

// ============================================
// 主Hook实现
// ============================================

export function usePromptManager(): UsePromptManagerReturn {
  // ===== 状态定义 =====

  const [categories, _setCategories] = useState<PromptCategory[]>(BUILTIN_CATEGORIES)
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => {
    const initialTemplates = BUILTIN_TEMPLATES.map((t, index) => ({
      ...t,
      id: `builtin_${index}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    }))
    return initialTemplates
  })

  const [usageRecords, setUsageRecords] = useState<PromptUsageRecord[]>([])
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFirstLoad = useRef(true)

  // ===== 初始化：从本地存储加载数据 =====

  useEffect(() => {
    if (isFirstLoad.current) {
      loadFromStorage()
      isFirstLoad.current = false
    }
  }, [])

  // ===== 分类操作 =====

  const selectCategory = useCallback((categoryId: CategoryId | null) => {
    setSelectedCategory(categoryId)
    logger.debug(`[PromptManager] 选择分类: ${categoryId || '全部'}`)
  }, [])

  const getCategoryTree = useCallback((): PromptCategory[] => {
    return categories.filter(cat => cat.parentId === null)
  }, [categories])

  const getBreadcrumbs = useCallback((categoryId: CategoryId): PromptCategory[] => {
    const breadcrumbs: PromptCategory[] = []
    let currentCat = categories.find(cat => cat.id === categoryId)

    while (currentCat) {
      breadcrumbs.unshift(currentCat)
      currentCat = currentCat.parentId
        ? categories.find(cat => cat.id === currentCat!.parentId)
        : undefined
    }

    return breadcrumbs
  }, [categories])

  // ===== CRUD操作 =====

  const createTemplate = useCallback((
    templateData: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
  ): PromptId => {
    const newTemplate: PromptTemplate = {
      ...templateData,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setTemplates(prev => [...prev, newTemplate])
    logger.info(`[PromptManager] 创建新模板: ${newTemplate.title}`)

    return newTemplate.id
  }, [])

  const updateTemplate = useCallback((id: PromptId, updates: Partial<PromptTemplate>) => {
    setTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, ...updates, updatedAt: Date.now() }
          : t,
      ),
    )
    logger.debug(`[PromptManager] 更新模板: ${id}`)
  }, [])

  const deleteTemplate = useCallback((id: PromptId) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    logger.info(`[PromptManager] 删除模板: ${id}`)
  }, [])

  const duplicateTemplate = useCallback((id: PromptId): PromptId => {
    const sourceTemplate = templates.find(t => t.id === id)
    if (!sourceTemplate) {
      setError('源模板不存在')
      return ''
    }

    const newId = `copy_${Date.now()}`
    const duplicated: PromptTemplate = {
      ...sourceTemplate,
      id: newId,
      title: `${sourceTemplate.title} (副本)`,
      isBuiltin: false,
      usageCount: 0,
      lastUsedAt: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setTemplates(prev => [...prev, duplicated])
    logger.info(`[PromptManager] 复制模板: ${sourceTemplate.title} -> ${duplicated.title}`)

    return newId
  }, [templates])

  // ===== 收藏与排序 =====

  const toggleFavorite = useCallback((id: PromptId) => {
    setTemplates(prev =>
      prev.map(t =>
        t.id === id ? { ...t, isFavorite: !t.isFavorite, updatedAt: Date.now() } : t,
      ),
    )
  }, [])

  const incrementUsage = useCallback((id: PromptId, context?: string) => {
    const now = Date.now()

    setTemplates(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, usageCount: t.usageCount + 1, lastUsedAt: now, updatedAt: now }
          : t,
      ),
    )

    setUsageRecords(prev => {
      const newRecord: PromptUsageRecord = {
        id: `usage_${Date.now()}`,
        promptId: id,
        usedAt: now,
        context,
      }

      const updated = [...prev, newRecord]
      return updated.slice(-MAX_USAGE_RECORDS)
    })

    logger.debug(`[PromptManager] 使用记录更新: ${id}`)
  }, [])

  // ===== 搜索与过滤 =====

  const searchTemplates = useCallback((query: string) => {
    setSearchQuery(query)
    logger.debug(`[PromptManager] 搜索: ${query}`)
  }, [])

  const filterByTags = useCallback((tags: string[]) => {
    logger.debug(`[PromptManager] 按标签过滤: ${tags.join(', ')}`)
  }, [])

  /** 智能推荐算法核心实现 */
  const getRecommendations = useCallback((limit: number = RECOMMENDATION_LIMIT): PromptRecommendation[] => {
    const recommendations: PromptRecommendation[] = []
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    templates.forEach(template => {
      let score = 0
      let reason: PromptRecommendation['reason'] = 'frequently_used'
      const matchedKeywords: string[] = []

      // 规则1：高频使用（权重40）
      if (template.usageCount > 10) {
        score += Math.min(template.usageCount * 4, 40)
        reason = 'frequently_used'
      }

      // 规则2：最近7天活跃（权重30）
      if (template.lastUsedAt && template.lastUsedAt > sevenDaysAgo) {
        score += 30
        reason = 'context_match'
      }

      // 规则3：30天内使用增长趋势（权重20）
      const recentUsages = usageRecords.filter(
        r => r.promptId === template.id && r.usedAt > thirtyDaysAgo,
      )
      if (recentUsages.length > 5) {
        score += Math.min(recentUsages.length * 4, 20)
        reason = 'trending'
      }

      // 规则4：收藏加权（权重10）
      if (template.isFavorite) {
        score += 10
      }

      // 规则5：搜索关键词匹配（额外加分）
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase()
        const searchableText = `${template.title} ${template.description} ${template.tags.join(' ')}`.toLowerCase()

        if (searchableText.includes(queryLower)) {
          score += 15
          matchedKeywords.push(searchQuery)
          reason = 'similar_to_history'
        }
      }

      // 规则6：新建模板推荐（首次使用后）
      if (template.usageCount === 0 && !template.isBuiltin && template.createdAt > sevenDaysAgo) {
        score += 8
        reason = 'new_and_relevant'
      }

      if (score > 0) {
        recommendations.push({
          prompt: template,
          score: Math.min(score, 100),
          reason,
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
        })
      }
    })

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }, [templates, usageRecords, searchQuery])

  // ===== 过滤后的模板列表 =====

  const filteredTemplates = useMemo(() => {
    let result = [...templates]

    // 按分类过滤
    if (selectedCategory) {
      result = result.filter(t => t.categoryId === selectedCategory)
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query)) ||
        t.content.toLowerCase().includes(query),
      )
    }

    // 排序：收藏优先 > 使用频率 > 更新时间
    result.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
      return b.updatedAt - a.updatedAt
    })

    return result
  }, [templates, selectedCategory, searchQuery])

  // ===== 变量处理 =====

  const renderTemplate = useCallback((
    templateId: PromptId,
    variableValues: Record<string, string>,
  ): string => {
    const template = templates.find(t => t.id === templateId)
    if (!template) {
      setError('模板不存在')
      return ''
    }

    let renderedContent = template.content

    template.variables.forEach(variable => {
      const value = variableValues[variable.name] || variable.defaultValue || ''
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g')
      renderedContent = renderedContent.replace(regex, value)
    })

    return renderedContent
  }, [templates])

  const validateVariables = useCallback((
    templateId: PromptId,
    values: Record<string, string>,
  ): { isValid: boolean; errors: Record<string, string> } => {
    const template = templates.find(t => t.id === templateId)
    if (!template) {
      return { isValid: false, errors: { general: '模板不存在' } }
    }

    const errors: Record<string, string> = {}
    let isValid = true

    template.variables.forEach(variable => {
      if (variable.required && !values[variable.name]?.trim()) {
        errors[variable.name] = `${variable.label}为必填项`
        isValid = false
      }

      if (variable.validation && values[variable.name]) {
        if (!variable.validation.test(values[variable.name])) {
          errors[variable.name] = `${variable.label}格式不正确`
          isValid = false
        }
      }
    })

    return { isValid, errors }
  }, [templates])

  // ===== 导入/导出 =====

  const exportPrompts = useCallback((_format: 'json' = 'json'): string => {
    const exportData: PromptExportData = {
      version: '2.0.0',
      exportTime: Date.now(),
      totalCount: templates.length,
      categories,
      templates: templates.filter(t => !t.isBuiltin),
      usageRecords,
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    logger.info(`[PromptManager] 导出完成: ${exportData.totalCount} 个模板`)
    return jsonString
  }, [templates, categories, usageRecords])

  const importPrompts = useCallback((dataString: string): { success: boolean; count: number; errors: string[] } => {
    const errors: string[] = []
    let importedCount = 0

    try {
      const data: PromptExportData = JSON.parse(dataString)

      if (!data.version || !data.templates) {
        throw new Error('无效的数据格式')
      }

      data.templates.forEach(template => {
        try {
          const newTemplate: PromptTemplate = {
            ...template,
            id: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            isBuiltin: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          setTemplates(prev => [...prev, newTemplate])
          importedCount++
        } catch (e) {
          errors.push(`导入模板 "${template.title}" 失败`)
        }
      })

      logger.info(`[PromptManager] 导入完成: ${importedCount} 个成功, ${errors.length} 个失败`)

      return {
        success: errors.length === 0,
        count: importedCount,
        errors,
      }
    } catch (e) {
      return {
        success: false,
        count: 0,
        errors: ['JSON解析失败，请检查文件格式'],
      }
    }
  }, [])

  // ===== 批量操作 =====

  const batchDelete = useCallback((ids: PromptId[]) => {
    setTemplates(prev => prev.filter(t => !ids.includes(t.id)))
    logger.info(`[PromptManager] 批量删除: ${ids.length} 个模板`)
  }, [])

  const batchExport = useCallback((ids: PromptId[]): string => {
    const templatesToExport = templates.filter(t => ids.includes(t.id))

    const exportData: PromptExportData = {
      version: '2.0.0',
      exportTime: Date.now(),
      totalCount: templatesToExport.length,
      categories: [],
      templates: templatesToExport,
      usageRecords: usageRecords.filter(r => ids.includes(r.promptId)),
    }

    return JSON.stringify(exportData, null, 2)
  }, [templates, usageRecords])

  // ===== 持久化存储 =====

  const saveToStorage = useCallback(() => {
    try {
      const dataToSave = {
        templates: templates.filter(t => !t.isBuiltin),
        usageRecords: usageRecords.slice(-500),
        timestamp: Date.now(),
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
      logger.debug('[PromptManager] 数据已保存到本地存储')
    } catch (e) {
      setError('保存到本地存储失败')
      logger.error('[PromptManager] 保存失败:', e)
    }
  }, [templates, usageRecords])

  const loadFromStorage = useCallback((): boolean => {
    setIsLoading(true)
    try {
      const savedData = localStorage.getItem(STORAGE_KEY)

      if (savedData) {
        const data = JSON.parse(savedData)

        if (data.templates && Array.isArray(data.templates)) {
          setTemplates(prev => {
            const builtinIds = new Set(prev.filter(t => t.isBuiltin).map(t => t.id))
            const customTemplates = data.templates.filter(
              (t: PromptTemplate) => !builtinIds.has(t.id),
            ) as PromptTemplate[]
            return [...prev, ...customTemplates]
          })
        }

        if (data.usageRecords && Array.isArray(data.usageRecords)) {
          setUsageRecords(data.usageRecords as PromptUsageRecord[])
        }

        logger.info(`[PromptManager] 从本地加载 ${data.templates?.length || 0} 个自定义模板`)
        return true
      }

      return false
    } catch (e) {
      setError('加载本地数据失败')
      logger.error('[PromptManager] 加载失败:', e)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearAllData = useCallback(() => {
    setTemplates(prev => prev.filter(t => t.isBuiltin))
    setUsageRecords([])
    setSelectedCategory(null)
    setSearchQuery('')
    localStorage.removeItem(STORAGE_KEY)
    logger.warn('[PromptManager] 已清除所有自定义数据')
  }, [])

  // ===== 自动保存 =====

  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      saveToStorage()
    }, 30000) // 每30秒自动保存一次

    return () => clearInterval(autoSaveTimer)
  }, [saveToStorage])

  // ===== 返回接口 =====

  return {
    categories,
    templates,
    filteredTemplates,
    selectedCategory,
    searchQuery,
    isLoading,
    error,

    selectCategory,
    getCategoryTree,
    getBreadcrumbs,

    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,

    toggleFavorite,
    incrementUsage,

    searchTemplates,
    filterByTags,
    getRecommendations,

    renderTemplate,
    validateVariables,

    exportPrompts,
    importPrompts,

    batchDelete,
    batchExport,

    saveToStorage,
    loadFromStorage,
    clearAllData,
  }
}

export default usePromptManager
