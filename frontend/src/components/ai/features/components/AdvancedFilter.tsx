/**
 * AdvancedFilter - 高级多条件组合筛选器组件 (v1.0)
 *
 * 提供专业的多维度配方筛选UI，支持：
 * - 质量等级筛选（A/B/C/D/F 多选）
 * - 置信度范围筛选（双滑块 0-100%）
 * - 时间范围筛选（今天/本周/本月/自定义）
 * - 成分数量范围筛选
 * - 标签多选筛选（动态从数据提取）
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 * @author RMFOOD Team
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { AIRecognizedFormula, FormulaFilters } from '@/types/ai.types';
import { Button } from '@/components/ui';

import { Filter, RotateCcw, Check, Calendar, Tag, Star, TrendingUp, Hash } from 'lucide-react';

interface AdvancedFilterProps {
  /** 当前筛选条件 */
  filters: FormulaFilters;
  /** 筛选条件变更回调 */
  onFiltersChange: (filters: FormulaFilters) => void;
  /** 重置筛选条件 */
  onReset: () => void;
  /** 所有配方数据（用于动态提取标签等） */
  allFormulas: AIRecognizedFormula[];
}

/** 质量等级选项 */
const QUALITY_GRADE_OPTIONS = [
  { value: 'A', label: 'A级', color: 'text-success-600 bg-success-100 dark:bg-success-300/25' },
  { value: 'B', label: 'B级', color: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-300/25' },
  { value: 'C', label: 'C级', color: 'text-warning-600 bg-warning-100 dark:bg-warning-300/25' },
  { value: 'D', label: 'D级', color: 'text-warning-600 bg-warning-100 dark:bg-warning-300/25' },
  { value: 'F', label: 'F级', color: 'text-error-600 bg-error-100 dark:bg-error-300/25' },
];

/** 时间范围选项 */
const DATE_RANGE_OPTIONS = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自定义' },
];

/**
 * AdvancedFilter 组件
 */
const AdvancedFilter: React.FC<AdvancedFilterProps> = ({ filters, onFiltersChange, onReset, allFormulas }) => {
  const [localFilters, setLocalFilters] = useState<FormulaFilters>(filters);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allFormulas.forEach((formula) => {
      formula.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [allFormulas]);

  const updateFilter = useCallback(<K extends keyof FormulaFilters>(key: K, value: FormulaFilters[K]) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleQualityGradeToggle = useCallback(
    (grade: string) => {
      const currentGrades = localFilters.qualityGrades || [];
      const typedGrade = grade as "A" | "D" | "B" | "C" | "F";
      const newGrades = currentGrades.includes(typedGrade)
        ? currentGrades.filter((g) => g !== grade)
        : [...currentGrades, typedGrade];

      updateFilter('qualityGrades', newGrades);
      onFiltersChange({
        ...localFilters,
        qualityGrades: newGrades,
      });
    },
    [localFilters, updateFilter, onFiltersChange],
  );

  const handleConfidenceRangeChange = useCallback(
    (min: number, max: number) => {
      const newFilters = {
        ...localFilters,
        confidenceRange: { min, max },
      };
      setLocalFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [localFilters, onFiltersChange],
  );

  const handleDateRangeChange = useCallback(
    (type: string, start?: number, end?: number) => {
      let dateRange: FormulaFilters['dateRange'] | undefined;

      if (type === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateRange = {
          start: today.getTime(),
          end: tomorrow.getTime(),
        };
      } else if (type === 'week') {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateRange = {
          start: weekAgo.getTime(),
          end: now.getTime(),
        };
      } else if (type === 'month') {
        const now = new Date();
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateRange = {
          start: monthAgo.getTime(),
          end: now.getTime(),
        };
      } else if (type === 'custom' && start && end) {
        dateRange = { start, end };
      }

      const newFilters = {
        ...localFilters,
        dateRange,
      };
      setLocalFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [localFilters, onFiltersChange],
  );

  const handleIngredientCountChange = useCallback(
    (min: number, max: number) => {
      const newFilters = {
        ...localFilters,
        ingredientCountRange: { min, max },
      };
      setLocalFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [localFilters, onFiltersChange],
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      const currentTags = localFilters.tags || [];
      const newTags = currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag];

      const newFilters = {
        ...localFilters,
        tags: newTags,
      };
      setLocalFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [localFilters, onFiltersChange],
  );

  const hasActiveFilters = useMemo(() => {
    return !!(
      (localFilters.qualityGrades && localFilters.qualityGrades.length > 0) ||
      localFilters.confidenceRange ||
      localFilters.dateRange ||
      localFilters.ingredientCountRange ||
      (localFilters.tags && localFilters.tags.length > 0)
    );
  }, [localFilters]);

  return (
    <div className="px-6 py-4">
      {/* 筛选器头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          <Filter size={16} />
          高级筛选
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw size={14} />}>
              重置
            </Button>
          )}
        </div>
      </div>

      {/* 筛选条件网格 */}
      <div className="space-y-4">
        {/* ===== 质量等级筛选 ===== */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <Star size={14} />
            质量等级
          </div>

          <div className="flex flex-wrap gap-2">
            {QUALITY_GRADE_OPTIONS.map((option) => {
              const isSelected =
                localFilters.qualityGrades?.includes(option.value as 'A' | 'B' | 'C' | 'D' | 'F') ?? false;
              return (
                <button
                  key={option.value}
                  onClick={() => handleQualityGradeToggle(option.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                    isSelected
                      ? `${option.color} border-current`
                      : 'border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                  }`}
                >
                  <span className="mr-1">{isSelected ? '✓' : ''}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== 置信度范围筛选 ===== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} />
              置信度范围
            </div>
            {localFilters.confidenceRange && (
              <span className="text-secondary-600 dark:text-secondary-700">
                {localFilters.confidenceRange.min}% - {localFilters.confidenceRange.max}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={localFilters.confidenceRange?.min ?? 0}
              onChange={(e) => {
                const min = parseInt(e.target.value);
                const max = localFilters.confidenceRange?.max ?? 100;
                handleConfidenceRangeChange(Math.min(min, max), max);
              }}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-secondary-500"
              aria-label="置信度下限"
            />
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-10 text-right">{localFilters.confidenceRange?.min ?? 0}%</span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={localFilters.confidenceRange?.max ?? 100}
              onChange={(e) => {
                const max = parseInt(e.target.value);
                const min = localFilters.confidenceRange?.min ?? 0;
                handleConfidenceRangeChange(min, Math.max(min, max));
              }}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-secondary-500"
              aria-label="置信度上限"
            />
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-10 text-right">{localFilters.confidenceRange?.max ?? 100}%</span>
          </div>
        </div>

        {/* ===== 时间范围筛选 ===== */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <Calendar size={14} />
            时间范围
          </div>

          <div className="flex flex-wrap gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleDateRangeChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-all ${
                  (option.value === 'custom' && localFilters.dateRange) ||
                  (option.value !== 'custom' && localFilters.dateRange)
                    ? 'border-secondary-500 bg-secondary-50 text-secondary-700 dark:bg-secondary-300/20 dark:text-secondary-700'
                    : 'border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {localFilters.dateRange && (
            <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
              <span>{new Date(localFilters.dateRange.start).toLocaleDateString('zh-CN')}</span>
              <span>-</span>
              <span>{new Date(localFilters.dateRange.end).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
        </div>

        {/* ===== 成分数量范围筛选 ===== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <Hash size={14} />
              成分数量
            </div>
            {localFilters.ingredientCountRange && (
              <span className="text-secondary-600 dark:text-secondary-700">
                {localFilters.ingredientCountRange.min} - {localFilters.ingredientCountRange.max} 种
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="number"
                min="0"
                max="50"
                value={localFilters.ingredientCountRange?.min ?? ''}
                onChange={(e) => {
                  const min = parseInt(e.target.value) || 0;
                  const max = localFilters.ingredientCountRange?.max ?? 50;
                  handleIngredientCountChange(min, Math.max(min, max));
                }}
                placeholder="最少"
                className="w-20 px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 outline-none focus:ring-2 focus:ring-secondary-500"
              />
              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">-</span>
              <input
                type="number"
                min="0"
                max="50"
                value={localFilters.ingredientCountRange?.max ?? ''}
                onChange={(e) => {
                  const max = parseInt(e.target.value) || 50;
                  const min = localFilters.ingredientCountRange?.min ?? 0;
                  handleIngredientCountChange(Math.min(min, max), max);
                }}
                placeholder="最多"
                className="w-20 px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-700 outline-none focus:ring-2 focus:ring-secondary-500"
              />
              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">种</span>
            </div>
          </div>
        </div>

        {/* ===== 标签筛选 ===== */}
        {availableTags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <Tag size={14} />
              标签
              <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] normal-font">({availableTags.length} 个可用)</span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableTags.slice(0, 20).map((tag) => {
                const isSelected = localFilters.tags?.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-300/25 dark:text-primary-700 ring-2 ring-primary-500'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    <span className="mr-1">{isSelected ? '✓' : ''}</span>
                    {tag}
                  </button>
                );
              })}
            </div>

            {availableTags.length > 20 && (
              <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic">还有 {availableTags.length - 20} 个标签未显示...</div>
            )}
          </div>
        )}

        {/* 无可用标签提示 */}
        {availableTags.length === 0 && (
          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic py-2 text-center">暂无可用标签（配方数据中未包含标签信息）</div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
        <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          {hasActiveFilters ? (
            <span>
              已启用 <strong>{Object.values(localFilters).filter(Boolean).length}</strong> 个筛选条件
            </span>
          ) : (
            <span>未启用任何筛选条件</span>
          )}
        </div>

        <Button size="sm" onClick={() => onFiltersChange(localFilters)} disabled={!hasActiveFilters}>
          应用筛选
        </Button>
      </div>
    </div>
  );
};

AdvancedFilter.displayName = 'AdvancedFilter';

export { AdvancedFilter };
export default AdvancedFilter;
