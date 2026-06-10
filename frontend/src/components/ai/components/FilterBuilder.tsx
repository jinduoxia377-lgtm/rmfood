/**
 * 高级筛选器 UI 组件
 *
 * 提供可视化的筛选条件构建界面
 * 支持多条件组合、嵌套分组、保存/加载筛选方案
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  FilterBuilderProps,
  FilterGroup,
  FilterCondition,
  FilterConfig,
  FilterFieldDefinition,
} from '@/types/filter.types';
import {
  FilterOperator,
  OPERATOR_LABELS,
  DEFAULT_OPERATORS_BY_TYPE,
} from '@/types/filter.types';

function generateFilterId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function createEmptyFilterGroup(): FilterGroup {
  return {
    id: generateFilterId(),
    logicOperator: 'AND',
    conditions: [],
  };
}

function createEmptyCondition(): FilterCondition {
  return {
    id: generateFilterId(),
    fieldKey: '',
    fieldLabel: '',
    operator: FilterOperator.EQUALS,
    value: '',
  };
}

function cloneFilterGroup(group: FilterGroup): FilterGroup {
  return JSON.parse(JSON.stringify(group));
}

function addCondition(group: FilterGroup): FilterGroup {
  const newGroup = cloneFilterGroup(group);
  newGroup.conditions.push(createEmptyCondition());
  return newGroup;
}

function removeCondition(group: FilterGroup, id: string): FilterGroup {
  const newGroup = cloneFilterGroup(group);
  newGroup.conditions = newGroup.conditions.filter(c => c.id !== id);
  return newGroup;
}

function updateCondition(
  group: FilterGroup,
  id: string,
  updates: Partial<FilterCondition | FilterGroup>,
): FilterGroup {
  const newGroup = cloneFilterGroup(group);

  const updateConditionRecursively = (conditions: (FilterCondition | FilterGroup)[]): (FilterCondition | FilterGroup)[] => {
    return conditions.map(item => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      if ('conditions' in item) {
        return { ...item, conditions: updateConditionRecursively(item.conditions) };
      }
      return item;
    });
  };

  newGroup.conditions = updateConditionRecursively(newGroup.conditions);
  return newGroup;
}

function countConditions(group: FilterGroup): number {
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
 * 筛选条件行组件 (单个条件的UI)
 */
function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
  depth = 0,
  showLogicOperator = true,
}: {
  condition: FilterCondition;
  fields: FilterFieldDefinition[];
  onChange: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  depth?: number;
  showLogicOperator?: boolean;
}) {
  const selectedField = useMemo(
    () => fields.find(f => f.key === condition.fieldKey),
    [fields, condition.fieldKey],
  );

  const availableOperators = useMemo(() => {
    if (selectedField) {
      return selectedField.operators;
    }
    return DEFAULT_OPERATORS_BY_TYPE.text || [];
  }, [selectedField]);

  const handleFieldChange = useCallback((fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    if (field) {
      onChange({
        fieldKey: field.key,
        fieldLabel: field.label,
        operator: field.operators[0] || FilterOperator.CONTAINS,
        value: field.defaultValue ?? '',
      });
    }
  }, [fields, onChange]);

  const handleOperatorChange = useCallback((operator: FilterOperator) => {
    // 切换到不需要值的操作符时清空value
    const noValueOps = [FilterOperator.IS_EMPTY, FilterOperator.IS_NOT_EMPTY];
    onChange({
      operator,
      value: noValueOps.includes(operator) ? undefined : condition.value,
    });
  }, [onChange, condition.value]);

  const renderValueInput = () => {
    if (!selectedField ||
        condition.operator === FilterOperator.IS_EMPTY ||
        condition.operator === FilterOperator.IS_NOT_EMPTY) {
      return null;
    }

    switch (selectedField.type) {
      case 'select':
        return (
          <select
            className="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={condition.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">请选择...</option>
            {selectedField.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            placeholder={selectedField.placeholder || '输入数值'}
            value={condition.value ?? ''}
            onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
            min={selectedField.validation?.min}
            max={selectedField.validation?.max}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            value={condition.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            placeholder={selectedField.placeholder || '输入筛选值...'}
            value={condition.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        );
    }
  };

  return (
    <div
      className={`flex items-center gap-2 ${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-300 dark:border-gray-600' : ''}`}
    >
      {/* 逻辑连接符 */}
      {showLogicOperator && (
        <button
          onClick={() => onChange({
            logicOperator: condition.logicOperator === 'AND' ? 'OR' : 'AND',
          })}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            condition.logicOperator === 'AND'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
          }`}
        >
          {condition.logicOperator}
        </button>
      )}

      {/* 字段选择 */}
      <select
        className="w-36 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
        value={condition.fieldKey}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        <option value="">选择字段...</option>
        {fields.map(field => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>

      {/* 操作符选择 */}
      <select
        className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
      >
        {availableOperators.map(op => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {/* 值输入 */}
      {renderValueInput()}

      {/* 删除按钮 */}
      <button
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        title="删除此条件"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * 条件组渲染组件 (递归)
 */
function ConditionGroupRenderer({
  group,
  fields,
  onChange,
  onAddCondition,
  onAddSubGroup,
  onRemoveItem,
  depth = 0,
}: {
  group: FilterGroup;
  fields: FilterFieldDefinition[];
  onChange: (group: FilterGroup) => void;
  onAddCondition: () => void;
  onAddSubGroup: () => void;
  onRemoveItem: (id: string) => void;
  depth?: number;
}) {
  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg' : ''}`}>
      {group.conditions.map((item, index) => {
        if ('conditions' in item) {
          // 嵌套组
          return (
            <div key={item.id} className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                  条件组 ({item.conditions.length}个条件)
                </span>
                <button
                  onClick={() => onChange(updateCondition(group, item.id, {
                    logicOperator: item.logicOperator === 'AND' ? 'OR' : 'AND',
                  }))}
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    item.logicOperator === 'AND'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {item.logicOperator}
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-0.5 text-gray-400 hover:text-red-600 rounded"
                  title="删除条件组"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ConditionGroupRenderer
                group={item}
                fields={fields}
                onChange={(updatedSubGroup) => {
                  onChange(updateCondition(group, item.id, updatedSubGroup));
                }}
                onAddCondition={() => {} /* 子组的添加由父级处理 */}
                onAddSubGroup={() => {}}
                onRemoveItem={onRemoveItem}
                depth={depth + 1}
              />
            </div>
          );
        } else {
          // 单个条件
          return (
            <ConditionRow
              key={item.id}
              condition={item}
              fields={fields}
              onChange={(updates) => {
                onChange(updateCondition(group, item.id, updates));
              }}
              onRemove={() => onRemoveItem(item.id)}
              depth={depth}
              showLogicOperator={index > 0}
            />
          );
        }
      })}

      {/* 添加按钮 */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onAddCondition}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加条件
        </button>

        {depth < 2 && (
          <button
            onClick={onAddSubGroup}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            添加条件组
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 主筛选器组件
 */
export function FilterBuilder({
  fields,
  value,
  onChange,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  maxHeight = 400,
  className = '',
}: FilterBuilderProps) {
  const [filterName, setFilterName] = useState('');
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  const hasConditions = value.conditions.length > 0;

  const handleAddCondition = useCallback(() => {
    const newGroup = addCondition(value);
    onChange(newGroup);
  }, [value, onChange]);

  const handleAddSubGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      ...cloneFilterGroup(value),
      conditions: [
        ...value.conditions,
        {
          id: generateFilterId(),
          logicOperator: 'AND',
          conditions: [],
          level: (value.level || 0) + 1,
        },
      ],
    };
    onChange(newGroup);
  }, [value, onChange]);

  const handleRemoveItem = useCallback((id: string) => {
    const newGroup = removeCondition(value, id);
    onChange(newGroup);
  }, [value, onChange]);

  const handleClearAll = useCallback(() => {
    onChange(createEmptyFilterGroup());
  }, [onChange]);

  const handleSaveCurrentFilter = useCallback(() => {
    if (!filterName.trim()) {
      alert('请输入筛选方案名称');
      return;
    }

    if (onSaveFilter) {
      onSaveFilter({
        id: generateFilterId(),
        name: filterName.trim(),
        group: cloneFilterGroup(value),
        createdAt: Date.now(),
      });
      setFilterName('');
    }
  }, [filterName, value, onSaveFilter]);

  const handleLoadFilter = useCallback((config: FilterConfig) => {
    if (onLoadFilter) {
      onLoadFilter(config);
    }
  }, [onLoadFilter]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          🔍 高级筛选
        </h3>

        <div className="flex items-center gap-2">
          {hasConditions && (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {value.conditions.length} 个条件
              </span>

              <button
                onClick={handleClearAll}
                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                清空
              </button>
            </>
          )}

          {hasConditions && onSaveFilter && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="方案名称..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentFilter()}
              />
              <button
                onClick={handleSaveCurrentFilter}
                className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 rounded transition-colors"
              >
                💾 保存
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 条件列表区域 */}
      <div
        className="overflow-y-auto p-4"
        style={{ maxHeight }}
      >
        {!hasConditions ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.364 6.364a1 1 0 00-.293.707V17l-4 4v-2.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <p className="text-sm">暂无筛选条件</p>
            <p className="text-xs mt-1">点击下方按钮添加筛选条件</p>
          </div>
        ) : (
          <ConditionGroupRenderer
            group={value}
            fields={fields}
            onChange={onChange}
            onAddCondition={handleAddCondition}
            onAddSubGroup={handleAddSubGroup}
            onRemoveItem={handleRemoveItem}
          />
        )}

        {/* 底部添加按钮 (无条件时显示) */}
        {!hasConditions && (
          <div className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600">
            <button
              onClick={handleAddCondition}
              className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
            >
              + 添加第一个筛选条件
            </button>
          </div>
        )}
      </div>

      {/* 已保存的筛选方案 */}
      {savedFilters.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowSavedPanel(!showSavedPanel)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span>已保存的方案 ({savedFilters.length})</span>
            <svg
              className={`w-4 h-4 transition-transform ${showSavedPanel ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSavedPanel && (
            <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
              {savedFilters.map(filter => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between px-3 py-2 text-xs bg-gray-50 dark:bg-gray-750 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <button
                    onClick={() => handleLoadFilter(filter)}
                    className="flex-1 text-left text-gray-700 dark:text-gray-300 truncate"
                  >
                    📋 {filter.name}
                    <span className="ml-2 text-gray-400">
                      ({countConditions(filter.group)} 条件)
                    </span>
                  </button>

                  {onDeleteFilter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFilter(filter.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all ml-2"
                      title="删除此方案"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterBuilder;
