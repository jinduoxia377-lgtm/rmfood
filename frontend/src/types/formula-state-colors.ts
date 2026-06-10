/**
 * 配方状态配色系统 (Formula State Colors)
 * 设计系统文档 v1.0 指定值
 * 用于配方列表、状态徽章、工作流可视化等场景
 */

/**
 * 6种配方状态专用颜色
 * 清晰传达配方的当前生命周期阶段
 */
export const FORMULA_STATE_COLORS = {
  /**
   * 草稿状态 (Draft)
   * 颜色：灰色系 - 代表未完成、待编辑、初始阶段
   */
  draft: {
    main: '#94a3b8',
    light: '#cbd5e1',
    dark: '#64748b',
    bg: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.3)',
    label: '草稿',
    description: '正在编辑中，尚未提交审核',
  },

  /**
   * 待审核状态 (Pending Review)
   * 颜色：琥珀色/黄色 - 代表等待、注意、需关注
   */
  pending_review: {
    main: '#f59e0b',
    light: '#fcd34d',
    dark: '#b45309',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
    label: '待审核',
    description: '已提交，等待专家审核',
  },

  /**
   * 已批准状态 (Approved)
   * 颜色：绿色系 - 代表通过、成功、可使用
   */
  approved: {
    main: '#10b981',
    light: '#6ee7b7',
    dark: '#047857',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.3)',
    label: '已批准',
    description: '通过审核，可以投入使用',
  },

  /**
   * 已拒绝状态 (Rejected)
   * 颜色：红色系 - 代表失败、错误、不可用
   */
  rejected: {
    main: '#ef4444',
    light: '#fca5a5',
    dark: '#b91c1c',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.3)',
    label: '已拒绝',
    description: '未通过审核，需要修改后重新提交',
  },

  /**
   * 需修订状态 (Revision Required)
   * 颜色：橙色系 - 代表需要修改、部分问题、改进空间
   */
  revision_required: {
    main: '#f97316',
    light: '#fdba74',
    dark: '#c2410c',
    bg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.3)',
    label: '需修订',
    description: '审核发现小问题，修改后可重新提交',
  },

  /**
   * 已归档状态 (Archived)
   * 颜色：深灰色系 - 代表历史记录、不再活跃、已完成使命
   */
  archived: {
    main: '#4b5563',
    light: '#9ca3af',
    dark: '#374151',
    bg: 'rgba(75,85,99,0.1)',
    border: 'rgba(75,85,99,0.3)',
    label: '已归档',
    description: '已归档保存，不再参与日常流程',
  },
} as const;

/**
 * 获取配方状态颜色配置
 * @param state 状态名称（如 'draft', 'approved' 等）
 * @returns 对应的颜色配置对象
 */
export function getFormulaStateColor(state: keyof typeof FORMULA_STATE_COLORS) {
  return FORMULA_STATE_COLORS[state] || FORMULA_STATE_COLORS.draft;
}

/**
 * 根据状态获取对应的CSS类名前缀（用于Tailwind）
 * @param state 状态名称
 * @returns Tailwind颜色类名（如 'text-green-600', 'bg-red-50'）
 */
export function getFormulaStateClasses(state: keyof typeof FORMULA_STATE_COLORS) {
  const color = FORMULA_STATE_COLORS[state];
  return {
    text: `text-[${color.main}]`,
    bg: `bg-[${color.bg}]`,
    border: `border-[${color.border}]`,
    badge: `${color.bg} ${color.main} text-white px-2 py-1 rounded-full text-xs font-medium`,
  };
}

/**
 * 状态流转顺序（用于进度条/时间线）
 * 定义了配方从创建到最终状态的典型流程
 */
export const FORMULA_STATE_FLOW = [
  'draft',           // 1. 草稿
  'pending_review',  // 2. 待审核
  'approved',        // 3. 已批准 ✅
  'rejected',        // 4. 已拒绝 ❌
  'revision_required', // 5. 需修订 ⚠️
  'archived',         // 6. 已归档 📦
] as const;

/**
 * 判断状态是否为"终态"（不可再变更的状态）
 * @param state 状态名称
 * @returns 是否为终态
 */
export function isTerminalState(state: string): boolean {
  return ['approved', 'rejected', 'archived'].includes(state);
}

/**
 * 判断状态是否为"活跃"（仍在流程中的状态）
 * @param state 状态名称
 * @returns 是否为活跃状态
 */
export function isActiveState(state: string): boolean {
  return ['draft', 'pending_review', 'revision_required'].includes(state);
}
