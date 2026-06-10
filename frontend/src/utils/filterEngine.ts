/**
 * 高级筛选引擎
 *
 * 提供筛选条件的编译、执行和验证功能
 * 支持嵌套条件组、多种操作符、性能优化
 */

import { FilterOperator } from '@/types/filter.types'
import type { FilterGroup, FilterCondition, FilterResult, FilterConfig } from '@/types/filter.types'

/**
 * 生成简单的唯一ID (UUID v4 的简化版)
 */
export function generateFilterId(): string {
  return 'filter-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

/**
 * 深拷贝 FilterGroup (用于编辑时的副本)
 */
export function cloneFilterGroup(group: FilterGroup): FilterGroup {
  return JSON.parse(JSON.stringify(group));
}

/**
 * 深拷贝 FilterConfig
 */
export function cloneFilterConfig(config: FilterConfig): FilterConfig {
  return JSON.parse(JSON.stringify(config));
}

/**
 * 统计条件组中的总条件数 (包括嵌套)
 */
export function countConditions(group: FilterGroup): number {
  let count = 0;
  for (const item of group.conditions) {
    if ('conditions' in item) {
      count += countConditions(item);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * 验证 FilterConfig 是否有效
 */
export function validateFilterConfig(config: FilterConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 基础校验
  if (!config.id || config.id.trim() === '') {
    errors.push('缺少方案ID');
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('方案名称不能为空');
  }

  if (!config.group || !Array.isArray(config.group.conditions)) {
    errors.push('筛选条件组无效');
    return { valid: false, errors };
  }

  // 校验嵌套层级
  const maxLevel = validateNestingLevel(config.group, 0, 3);
  if (maxLevel > 3) {
    errors.push(`条件嵌套层级过深 (${maxLevel}层，最大允许3层)`);
  }

  // 校验每个条件
  validateConditionsRecursive(config.group, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证嵌套层级
 */
function validateNestingLevel(group: FilterGroup, currentLevel: number, maxAllowed: number): number {
  let maxLevel = currentLevel;

  for (const item of group.conditions) {
    if ('conditions' in item) {
      const childMax = validateNestingLevel(item, currentLevel + 1, maxAllowed);
      maxLevel = Math.max(maxLevel, childMax);
    }
  }

  return maxLevel;
}

/**
 * 递归校验所有条件
 */
function validateConditionsRecursive(group: FilterGroup, errors: string[]): void {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (!item) continue;

    if ('conditions' in item) {
      // 递归校验子组
      if (!item.logicOperator || !['AND', 'OR'].includes(item.logicOperator)) {
        errors.push(`条件组 #${i + 1}: 无效的逻辑操作符`);
      }
      validateConditionsRecursive(item, errors);
    } else {
      // 校验单个条件
      if (!item.fieldKey || item.fieldKey.trim() === '') {
        errors.push(`条件 #${i + 1}: 字段key不能为空`);
      }

      if (!item.operator || !Object.values(FilterOperator).includes(item.operator)) {
        errors.push(`条件 #${i + 1}: 无效的操作符`);
      }

      // 特殊操作符不需要值
      const noValueOps = [FilterOperator.IS_EMPTY, FilterOperator.IS_NOT_EMPTY];
      if (!noValueOps.includes(item.operator)) {
        const operator = item.operator
        if (item.value === undefined || item.value === null) {
          if (operator !== FilterOperator.IS_EMPTY && operator !== FilterOperator.IS_NOT_EMPTY) {
            errors.push(`条件 #${i + 1}: 筛选值不能为空`);
          }
        }
      }
    }
  }
}

/**
 * 将 FilterGroup 编译为过滤函数
 *
 * 使用递归下降算法处理嵌套的条件组，
 * 返回一个可对数据项进行判断的函数
 *
 * @param group 筛选条件组
 * @returns 过滤函数 (item => boolean)
 */
export function compileFilter<T extends Record<string, any>>(
  group: FilterGroup,
): (item: T) => boolean {
  // 如果没有条件，返回全部通过
  if (!group.conditions || group.conditions.length === 0) {
    return () => true;
  }

  return (item: T) => evaluateGroup(item, group);
}

/**
 * 执行筛选并返回结果
 *
 * @param data 原始数据数组
 * @param group 筛选条件组
 * @returns 包含筛选后数据和统计信息的对象
 */
export function executeFilter<T extends Record<string, any>>(
  data: T[],
  group: FilterGroup,
): { data: T[]; stats: FilterResult } {
  const startTime = performance.now();

  const totalCount = data.length;
  const hasConditions = countConditions(group) > 0;

  let filteredData: T[];

  if (!hasConditions) {
    // 无筛选条件，返回全部数据
    filteredData = [...data];
  } else {
    // 编译并应用筛选器
    const filterFn = compileFilter<T>(group);
    filteredData = data.filter(filterFn);
  }

  const endTime = performance.now();
  const executionTime = Math.round((endTime - startTime) * 100) / 100;

  return {
    data: filteredData,
    stats: {
      totalCount,
      filteredCount: filteredData.length,
      isFiltered: hasConditions && filteredData.length < totalCount,
      executionTime,
      activeConditionsCount: hasConditions ? countConditions(group) : 0,
    },
  };
}

/**
 * 评估单个条件是否匹配
 */
function evaluateCondition<T>(
  item: T,
  condition: FilterCondition,
): boolean {
  const fieldValue = getNestedValue(item, condition.fieldKey);
  const operator = condition.operator;
  const value = condition.value;

  switch (operator) {
    case FilterOperator.EQUALS:
      return fieldValue == value;  // 宽松相等

    case FilterOperator.NOT_EQUALS:
      return fieldValue != value;

    case FilterOperator.CONTAINS:
      return typeof fieldValue === 'string' &&
             typeof value === 'string' &&
             fieldValue.toLowerCase().includes(value.toLowerCase());

    case FilterOperator.NOT_CONTAINS:
      return !(typeof fieldValue === 'string' &&
               typeof value === 'string' &&
               fieldValue.toLowerCase().includes(value.toLowerCase()));

    case FilterOperator.STARTS_WITH:
      return typeof fieldValue === 'string' &&
             typeof value === 'string' &&
             fieldValue.toLowerCase().startsWith(value.toLowerCase());

    case FilterOperator.ENDS_WITH:
      return typeof fieldValue === 'string' &&
             typeof value === 'string' &&
             fieldValue.toLowerCase().endsWith(value.toLowerCase());

    case FilterOperator.GT:
      return compareValues(fieldValue, value) > 0;

    case FilterOperator.GTE:
      return compareValues(fieldValue, value) >= 0;

    case FilterOperator.LT:
      return compareValues(fieldValue, value) < 0;

    case FilterOperator.LTE:
      return compareValues(fieldValue, value) <= 0;

    case FilterOperator.IN_RANGE:
      if (Array.isArray(value) && value.length === 2) {
        const cmpMin = compareValues(fieldValue, value[0]);
        const cmpMax = compareValues(fieldValue, value[1]);
        return cmpMin >= 0 && cmpMax <= 0;
      }
      return false;

    case FilterOperator.NOT_IN_RANGE:
      if (Array.isArray(value) && value.length === 2) {
        const cmpMin = compareValues(fieldValue, value[0]);
        const cmpMax = compareValues(fieldValue, value[1]);
        return !(cmpMin >= 0 && cmpMax <= 0);
      }
      return false;

    case FilterOperator.IS_EMPTY:
      return fieldValue === null ||
             fieldValue === undefined ||
             fieldValue === '' ||
             (Array.isArray(fieldValue) && fieldValue.length === 0);

    case FilterOperator.IS_NOT_EMPTY:
      return fieldValue !== null &&
             fieldValue !== undefined &&
             fieldValue !== '' &&
             !(Array.isArray(fieldValue) && fieldValue.length === 0);

    case FilterOperator.IN_LIST:
      if (Array.isArray(value)) {
        return value.some(v => fieldValue == v);
      }
      return fieldValue == value;

    case FilterOperator.NOT_IN_LIST:
      if (Array.isArray(value)) {
        return !value.some(v => fieldValue == v);
      }
      return fieldValue != value;

    default:
      console.warn(`未知的筛选操作符: ${operator}`);
      return true;
  }
}

/**
 * 递归评估条件组
 */
function evaluateGroup<T>(item: T, group: FilterGroup): boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return true;
  }

  const results = group.conditions.map(condition => {
    if ('conditions' in condition) {
      // 是嵌套组，递归评估
      return evaluateGroup(item, condition);
    } else {
      // 是单个条件
      return evaluateCondition(item, condition);
    }
  });

  // 根据 logicOperator 组合结果
  if (group.logicOperator === 'OR') {
    return results.some(r => r);  // 任一为true则整体为true
  } else {
    // 默认 AND: 全部为true才为true
    return results.every(r => r);
  }
}

/**
 * 获取对象的嵌套属性值
 * 支持 "a.b.c" 这样的路径访问
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * 比较两个值的大小
 * 处理数字、字符串、日期等类型
 * 返回: 正数(a>b), 0(相等), 负数(a<b)
 */
function compareValues(a: any, b: any): number {
  // 处理 null/undefined
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  // 尝试数字比较
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }

  // 尝试日期比较
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
    return dateA.getTime() - dateB.getTime();
  }

  // 字符串比较
  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  return strA.localeCompare(strB);
}

/**
 * 创建空的 FilterGroup
 */
export function createEmptyFilterGroup(): FilterGroup {
  return {
    id: generateFilterId(),
    logicOperator: 'AND',
    conditions: [],
    level: 0,
  };
}

/**
 * 创建空的 FilterCondition
 */
export function createEmptyCondition(): FilterCondition {
  return {
    id: generateFilterId(),
    fieldKey: '',
    fieldLabel: '',
    operator: FilterOperator.CONTAINS,
    value: '',
    logicOperator: 'AND',
  };
}

/**
 * 向 FilterGroup 添加条件
 */
export function addCondition(
  group: FilterGroup,
  condition?: Partial<FilterCondition>,
): FilterGroup {
  const newGroup = cloneFilterGroup(group);
  newGroup.conditions.push({
    ...createEmptyCondition(),
    ...condition,
  });
  return newGroup;
}

/**
 * 从 FilterGroup 移除指定ID的条件或组
 */
export function removeCondition(
  group: FilterGroup,
  conditionId: string,
): FilterGroup {
  const newGroup = cloneFilterGroup(group);
  newGroup.conditions = newGroup.conditions.filter(item => {
    if ('id' in item && item.id === conditionId) {
      return false;
    }
    return true;
  });
  return newGroup;
}

/**
 * 更新 FilterGroup 中指定ID的条件
 */
export function updateCondition(
  group: FilterGroup,
  conditionId: string,
  updates: Partial<FilterCondition>,
): FilterGroup {
  const newGroup = cloneFilterGroup(group);

  updateConditionRecursive(newGroup, conditionId, updates);

  return newGroup;
}

/**
 * 递归更新条件
 */
function updateConditionRecursive(
  group: FilterGroup,
  targetId: string,
  updates: Partial<FilterCondition>,
): boolean {
  for (let i = 0; i < group.conditions.length; i++) {
    const item = group.conditions[i];

    if (!item) continue;

    if ('id' in item && item.id === targetId) {
      // 找到目标，更新它
      Object.assign(item, updates);
      return true;
    }

    if ('conditions' in item) {
      // 递归搜索子组
      if (updateConditionRecursive(item, targetId, updates)) {
        return true;
      }
    }
  }

  return false;
}
