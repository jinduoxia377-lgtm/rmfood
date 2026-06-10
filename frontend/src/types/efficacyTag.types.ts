/**
 * 功效标签系统类型定义
 *
 * 提供功效标签的完整类型体系，包括标签分类、标签元数据、
 * 标签树形结构等，用于配方成分的功效标注和筛选。
 */

import type {
  EfficacyTag,
  TagCategory,
} from './ai.types'

// ==================== 标签元数据 ====================

/**
 * 标签元数据接口
 * 存储单个功效标签的详细属性信息
 */
export interface EfficacyTagMeta {
  /** 标签名称 */
  name: EfficacyTag
  /** 所属分类 */
  category: TagCategory
  /** 标签描述 */
  description: string
  /** 关键词列表（用于搜索匹配） */
  keywords: string[]
  /** 相关成分列表 */
  relatedIngredients: string[]
  /** 科学依据等级 */
  evidenceLevel: 'strong' | 'moderate' | 'weak' | 'theoretical'
  /** 适用人群 */
  targetAudience?: string[]
  /** 禁忌情况 */
  contraindications?: string[]
}

// ==================== 标签分类节点 ====================

/**
 * 标签分类树节点接口
 * 用于构建层级化的标签分类结构
 */
export interface TagCategoryNode {
  /** 分类ID */
  id: string
  /** 分类名称 */
  name: string
  /** 分类标识 */
  category: TagCategory
  /** 图标名称（可选） */
  icon?: string
  /** 颜色标识（可选） */
  color?: string
  /** 该分类下的标签列表 */
  tags: EfficacyTag[]
  /** 子分类（支持多级嵌套） */
  children?: TagCategoryNode[]
  /** 排序权重 */
  order: number
}

// ==================== 标签筛选条件 ====================

/**
 * 标签筛选条件接口
 * 用于构建复杂的标签查询条件
 */
export interface EfficacyTagFilter {
  /** 按分类筛选 */
  categories?: TagCategory[]
  /** 按关键词搜索 */
  keyword?: string
  /** 按证据等级筛选 */
  evidenceLevels?: EfficacyTagMeta['evidenceLevel'][]
  /** 按适用人群筛选 */
  targetAudience?: string[]
  /** 是否包含子分类 */
  includeChildren?: boolean
}

// ==================== 标签统计信息 ====================

/**
 * 标签使用统计接口
 * 记录标签在配方中的使用频率统计
 */
export interface EfficacyTagStats {
  /** 标签名称 */
  tag: EfficacyTag
  /** 使用次数 */
  usageCount: number
  /** 关联的配方数量 */
  formulaCount: number
  /** 关联的成分数量 */
  ingredientCount: number
  /** 最近使用时间 */
  lastUsedAt?: Date
  /** 趋势方向 */
  trend: 'up' | 'down' | 'stable'
}

// ==================== 导出汇总 ====================

export type {
  EfficacyTag,
  TagCategory,
}
