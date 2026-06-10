/**
 * 高级筛选系统 - 类型定义
 *
 * 为 FormulaTable 组件提供企业级的筛选功能支持
 * 包括：多条件组合、嵌套分组、多种操作符、筛选方案持久化
 */

// 筛选操作符枚举
export enum FilterOperator {
  // 文本匹配类
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',

  // 数值比较类
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  IN_RANGE = 'in_range',
  NOT_IN_RANGE = 'not_in_range',

  // 空值判断类
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',

  // 列表成员判断类
  IN_LIST = 'in_list',
  NOT_IN_LIST = 'not_in_list'
}

// 逻辑连接符 (用于组合多个条件)
export type LogicOperator = 'AND' | 'OR';

/**
 * 单个筛选条件
 */
export interface FilterCondition {
  id: string;                    // 唯一标识符 (UUID v4)
  fieldKey: string;              // 目标字段的数据key
  fieldLabel: string;            // 字段的显示名称 (用于UI展示)
  operator: FilterOperator;      // 筛选操作符
  value: any;                    // 筛选值 (类型取决于 operator)
  valueLabel?: string;           // 值的显示文本 (用于下拉选择等场景)
  logicOperator?: LogicOperator; // 与下一个条件的逻辑关系 (默认 AND)
}

/**
 * 筛选条件组 (支持嵌套以构建复杂查询)
 *
 * 示例:
 * {
 *   logicOperator: 'AND',
 *   conditions: [
 *     { fieldKey: 'amount', operator: 'gt', value: 10 },
 *     {
 *       logicOperator: 'OR',
 *       conditions: [
 *         { fieldKey: 'source', operator: 'equals', value: 'medicine_food' },
 *         { fieldKey: 'source', operator: 'equals', value: 'peptide' }
 *       ]
 *     }
 *   ]
 * }
 */
export interface FilterGroup {
  id: string;
  logicOperator: LogicOperator;
  conditions: (FilterCondition | FilterGroup)[];
  /** 嵌套层级 (0=顶层, 最大允许3层) */
  level?: number;
}

/**
 * 完整的筛选配置 (可保存为筛选方案)
 */
export interface FilterConfig {
  id: string;
  name: string;                  // 方案名称 (如"高功效成分", "低用量配方")
  description?: string;         // 方案描述
  group: FilterGroup;            // 筛选条件组
  createdAt: number;             // 创建时间戳 (Date.now())
  updatedAt?: number;            // 最后更新时间戳
  isDefault?: boolean;           // 是否为默认方案
}

/**
 * 字段定义 (用于动态生成筛选器UI)
 * 定义了每个可筛选项的元信息
 */
export interface FilterFieldDefinition {
  key: string;                   // 数据字段key
  label: string;                 // 显示标签
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';  // 字段UI类型
  operators: FilterOperator[];    // 该字段支持的操作符列表
  options?: {                   // 下拉选项 (type=select/multiselect时使用)
    label: string;
    value: any;
  }[];
  placeholder?: string;          // 输入框占位文本
  defaultValue?: any;            // 默认值
  validation?: {                 // 校验规则
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    customMessage?: string;
  };
}

/**
 * 筛选执行结果统计
 */
export interface FilterResult {
  totalCount: number;             // 筛选前总记录数
  filteredCount: number;         // 筛选后记录数
  isFiltered: boolean;           // 是否有激活的筛选条件
  executionTime: number;         // 执行耗时 (毫秒)
  activeConditionsCount: number; // 激活的条件数量 (包括嵌套)
}

/**
 * FilterBuilder 组件 Props
 */
export interface FilterBuilderProps {
  fields: FilterFieldDefinition[];        // 可筛选项的字段定义列表
  value: FilterGroup;                     // 当前筛选条件组 (受控模式)
  onChange: (group: FilterGroup) => void; // 条件变更回调
  savedFilters?: FilterConfig[];          // 已保存的筛选方案列表
  onSaveFilter?: (config: FilterConfig) => void;  // 保存方案回调
  onLoadFilter?: (config: FilterConfig) => void;   // 加载方案回调
  onDeleteFilter?: (id: string) => void;         // 删除方案回调
  maxHeight?: number;                      // 条件列表最大高度 (px), 超出显示滚动条
  className?: string;                      // 自定义CSS类名
}

/**
 * 操作符配置 (用于UI显示)
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  [FilterOperator.EQUALS]: '等于',
  [FilterOperator.NOT_EQUALS]: '不等于',
  [FilterOperator.CONTAINS]: '包含',
  [FilterOperator.NOT_CONTAINS]: '不包含',
  [FilterOperator.STARTS_WITH]: '开头是',
  [FilterOperator.ENDS_WITH]: '结尾是',
  [FilterOperator.GT]: '大于',
  [FilterOperator.GTE]: '大于等于',
  [FilterOperator.LT]: '小于',
  [FilterOperator.LTE]: '小于等于',
  [FilterOperator.IN_RANGE]: '在范围内',
  [FilterOperator.NOT_IN_RANGE]: '不在范围内',
  [FilterOperator.IS_EMPTY]: '为空',
  [FilterOperator.IS_NOT_EMPTY]: '不为空',
  [FilterOperator.IN_LIST]: '在列表中',
  [FilterOperator.NOT_IN_LIST]: '不在列表中',
};

/**
 * 根据字段类型推荐的操作符
 */
export const DEFAULT_OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text: [
    FilterOperator.EQUALS,
    FilterOperator.NOT_EQUALS,
    FilterOperator.CONTAINS,
    FilterOperator.NOT_CONTAINS,
    FilterOperator.STARTS_WITH,
    FilterOperator.ENDS_WITH,
    FilterOperator.IS_EMPTY,
    FilterOperator.IS_NOT_EMPTY,
  ],
  number: [
    FilterOperator.EQUALS,
    FilterOperator.NOT_EQUALS,
    FilterOperator.GT,
    FilterOperator.GTE,
    FilterOperator.LT,
    FilterOperator.LTE,
    FilterOperator.IN_RANGE,
    FilterOperator.NOT_IN_RANGE,
    FilterOperator.IS_EMPTY,
    FilterOperator.IS_NOT_EMPTY,
  ],
  date: [
    FilterOperator.EQUALS,
    FilterOperator.NOT_EQUALS,
    FilterOperator.GT,
    FilterOperator.GTE,
    FilterOperator.LT,
    FilterOperator.LTE,
    FilterOperator.IN_RANGE,
    FilterOperator.IS_EMPTY,
    FilterOperator.IS_NOT_EMPTY,
  ],
  select: [
    FilterOperator.EQUALS,
    FilterOperator.NOT_EQUALS,
    FilterOperator.IN_LIST,
    FilterOperator.NOT_IN_LIST,
    FilterOperator.IS_EMPTY,
    FilterOperator.IS_NOT_EMPTY,
  ],
  multiselect: [
    FilterOperator.IN_LIST,
    FilterOperator.NOT_IN_LIST,
    FilterOperator.IS_EMPTY,
    FilterOperator.IS_NOT_EMPTY,
  ],
};
