/**
 * 知识图谱节点配色系统 (Knowledge Graph Node Colors)
 * 设计系统文档 v1.0 指定值
 * 用于配方成分可视化、关系图谱、数据图表等场景
 */

/**
 * 7种知识图谱节点专用颜色
 * 每种颜色代表一类实体，确保视觉区分度
 */
export const KNOWLEDGE_GRAPH_COLORS = {
  /**
   * 中药材节点 (Herb)
   * 颜色：绿色系 - 代表天然、草本、植物来源
   */
  herb: {
    main: '#22c55e',
    light: '#86efac',
    dark: '#15803d',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.3)',
  },

  /**
   * 化合物节点 (Compound)
   * 颜色：蓝色系 - 代表化学、分子、科学精确性
   */
  compound: {
    main: '#3b82f6',
    light: '#93c5fd',
    dark: '#1d4ed8',
    bg: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.3)',
  },

  /**
   * 药物靶点节点 (Target)
   * 颜色：红色系 - 代表目标、关键、重要性
   */
  target: {
    main: '#ef4444',
    light: '#fca5a5',
    dark: '#b91c1c',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
  },

  /**
   * 多肽分子节点 (Peptide)
   * 颜色：紫色系 - 代表生物活性、复杂结构
   */
  peptide: {
    main: '#8b5cf6',
    light: '#c4b5fd',
    dark: '#6d28d9',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.3)',
  },

  /**
   * 蛋白质节点 (Protein)
   * 颜色：橙色系 - 代表生命基础、能量、活力
   */
  protein: {
    main: '#f59e0b',
    light: '#fcd34d',
    dark: '#b45309',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
  },

  /**
   * 食物来源节点 (Food Source)
   * 颜色：青色系 - 代表营养、食物链、自然循环
   */
  food_source: {
    main: '#06b6d4',
    light: '#67e8f9',
    dark: '#0e7490',
    bg: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.3)',
  },

  /**
   * 相关疾病节点 (Disease)
   * 颜色：粉色系 - 代表医疗、病理、关注警示
   */
  disease: {
    main: '#ec4899',
    light: '#f9a8d4',
    dark: '#be185d',
    bg: 'rgba(236,72,153,0.1)',
    border: 'rgba(236,72,153,0.3)',
  },
} as const;

/**
 * 获取知识图谱节点颜色配置
 * @param nodeType 节点类型名称
 * @returns 对应的颜色配置对象
 */
export function getKnowledgeGraphColor(nodeType: keyof typeof KNOWLEDGE_GRAPH_COLORS) {
  return KNOWLEDGE_GRAPH_COLORS[nodeType] || KNOWLEDGE_GRAPH_COLORS.compound;
}

/**
 * 获取所有知识图谱颜色的主色调数组（用于图例/调色板）
 * @returns 主色数组
 */
export function getKnowledgeGraphPalette(): string[] {
  return Object.values(KNOWLEDGE_GRAPH_COLORS).map(c => c.main);
}

/**
 * 图表专用调色板（按文档规范顺序）
 * 用于饼图、柱状图等数据可视化
 */
export const CHART_COLOR_PALETTE = [
  '#22c55e', // 中药材 - 绿
  '#3b82f6', // 化合物 - 蓝
  '#ef4444', // 靶点 - 红
  '#8b5cf6', // 多肽 - 紫
  '#f59e0b', // 蛋白 - 橙
  '#06b6d4', // 食物 - 青
  '#ec4899', // 疾病 - 粉
] as const;
