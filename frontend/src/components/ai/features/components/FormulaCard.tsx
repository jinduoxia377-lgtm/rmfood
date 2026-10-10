/**
 * FormulaCard - 专业级配方卡片组件 (v1.0)
 *
 * 单个配方的卡片式展示，包含完整信息层次和交互功能。
 * 支持质量评分可视化、智能命名、手动编辑、展开详情等功能。
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useRef, useEffect } from 'react';
import type { AIRecognizedFormula, FormulaQualityScore } from '@/types/ai.types';
import { Button } from '@/components/ui';
import { useSwipe } from '@/hooks/useMobile';
import { useLongPress } from '@/hooks/useShortcuts';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  Table2,
  Star,
  Calendar,
  Hash,
  MessageSquare,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react';

interface FormulaCardProps {
  /** 配方数据 */
  formula: AIRecognizedFormula;
  /** 是否展开详情 */
  isExpanded: boolean;
  /** 是否被选中（批量操作） */
  isSelected: boolean;
  /** 切换展开/收起状态 */
  onToggleExpand: (id: string) => void;
  /** 切换选中状态 */
  onSelect?: (id: string) => void;
  /** 查看详细数据表格 */
  onShowDetail: (id: string) => void;
  /** 生成报告（可选指定单个配方） */
  onGenerateReport: (id?: string) => void;
  /** 重命名配方 */
  onRename?: (id: string, newName: string) => void;
  /** 质量评分数据 */
  qualityScore?: FormulaQualityScore | null;
  /** 是否为紧凑模式（平板端双列布局） */
  compact?: boolean;
  /** 显示上下文菜单回调 */
  onShowContextMenu?: (id: string, position: { x: number; y: number }) => void;
  /** 跳转到原文 */
  onJumpToSource?: (sourceMessageId: string) => void;
  /** 切换收藏状态 */
  onToggleFavorite?: (id: string) => void;
}

const FormulaCard = React.memo<FormulaCardProps>(
  ({
    formula,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
    onShowDetail,
    onGenerateReport,
    onRename,
    qualityScore,
    compact = false,
    onShowContextMenu,
    onJumpToSource,
    onToggleFavorite,
  }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const swipeHandlers = useSwipe({
      onSwipeRight: () => onSelect?.(formula.id),
      onSwipeLeft: () => onSelect?.(formula.id),
      threshold: 30,
    });

    const { isPressed: isLongPressed, handlers: longPressHandlers } = useLongPress(
      () => {
        if (onShowContextMenu) {
          onShowContextMenu(formula.id, { x: 0, y: 0 });
        }
      },
      {
        threshold: 500,
      },
    );

    useEffect(() => {
      if (isEditingName && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditingName]);

    useEffect(() => {
      return () => {
        setIsEditingName(false);
        setEditValue('');
      };
    }, []);

    const handleStartEdit = () => {
      if (!onRename) return;
      setEditValue(formula.autoName || formula.name);
      setIsEditingName(true);
    };

    const handleSaveEdit = () => {
      if (!onRename || !editValue.trim()) return;
      onRename(formula.id, editValue.trim());
      setIsEditingName(false);
      setEditValue('');
    };

    const handleCancelEdit = () => {
      setIsEditingName(false);
      setEditValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    };

    const renderQualityBadge = () => {
      const grade = qualityScore?.qualityGrade || formula.qualityGrade;
      if (!grade) return null;

      const gradeConfig = {
        A: { bg: 'bg-success-100', text: 'text-success-700', border: 'border-success-200', label: 'A级 · 优秀' },
        B: { bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200', label: 'B级 · 良好' },
        C: { bg: 'bg-warning-100', text: 'text-warning-700', border: 'border-warning-200', label: 'C级 · 一般' },
        D: { bg: 'bg-warning-100', text: 'text-warning-700', border: 'border-warning-200', label: 'D级 · 较差' },
        F: { bg: 'bg-error-100', text: 'text-error-700', border: 'border-error-200', label: 'F级 · 不合格' },
      };

      const config = gradeConfig[grade];
      if (!config) return null;

      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} border ${config.border}`}
        >
          {grade}
          <span className="ml-1 text-xs opacity-75">{config.label.split('·')[1]}</span>
        </span>
      );
    };

    const renderConfidenceBadge = () => {
      const confidence = formula.confidence;
      if (!confidence) return null;

      const percentage = Math.round(confidence * 100);
      let colorClass = 'text-error-600';
      let bgColor = 'bg-error-50';

      if (percentage >= 90) {
        colorClass = 'text-success-600';
        bgColor = 'bg-success-50';
      } else if (percentage >= 70) {
        colorClass = 'text-warning-600';
        bgColor = 'bg-warning-50';
      }

      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colorClass} ${bgColor}`}
        >
          置信度: {percentage}%
        </span>
      );
    };

    const renderEfficacyTags = () => {
      const tags = formula.tags;
      if (!tags || tags.length === 0) return null;

      const maxTags = compact ? 3 : 4;

      return (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, maxTags).map((tag, index) => (
            <span
              key={index}
              className={`inline-flex items-center rounded-full font-medium bg-accent-50 text-accent-700 dark:bg-accent-300/25 dark:text-accent-700 ${
                compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
              }`}
            >
              {tag}
            </span>
          ))}
          {tags.length > maxTags && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400 px-1">+{tags.length - maxTags}</span>
          )}
        </div>
      );
    };

    const renderIngredients = () => {
      const ingredients = formula.ingredients;
      if (!ingredients || ingredients.length === 0) return null;

      const maxIngredients = compact ? 3 : 5;
      const displayIngredients = ingredients.slice(0, maxIngredients);
      const remainingCount = ingredients.length - maxIngredients;

      return (
        <div>
          <div className={`font-medium text-neutral-500 dark:text-neutral-400 mb-2 ${compact ? 'text-xs' : 'text-xs'}`}>
            核心成分:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayIngredients.map((ing, index) => (
              <span
                key={index}
                className={`inline-flex items-center rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${
                  compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
                }`}
                title={`${ing.name}: ${ing.dosage}${ing.unit ? ing.unit : ''}`}
              >
                {ing.name}
              </span>
            ))}
            {remainingCount > 0 && (
              <span
                className={`inline-flex items-center rounded-md font-medium bg-primary-50 text-primary-700 dark:bg-primary-300/20 dark:text-primary-700 ${
                  compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
                }`}
              >
                +{remainingCount}种
              </span>
            )}
          </div>
        </div>
      );
    };

    const renderMetaInfo = () => {
      const parsedAt = formula.parsedAt;
      const timeStr = parsedAt
        ? parsedAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '未知时间';

      return (
        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {timeStr}
          </span>
          <span className="inline-flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            {formula.ingredientCount || formula.ingredients?.length || 0}种成分
          </span>
          {isExpanded && (
            <span
              className="inline-flex items-center gap-1 text-secondary-600 dark:text-secondary-700 font-medium cursor-pointer"
               role="button" tabIndex={0} onClick={() => onToggleExpand(formula.id)}
            >
              <Eye className="w-3.5 h-3.5" />
              已收起
              <ChevronUp className="w-3.5 h-3.5" />
            </span>
          )}
          {!isExpanded && (
            <span
              className="inline-flex items-center gap-1 text-secondary-600 dark:text-secondary-700 font-medium cursor-pointer"
               role="button" tabIndex={0} onClick={() => onToggleExpand(formula.id)}
            >
              展开详情
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      );
    };

    const renderExpandedContent = () => {
      if (!isExpanded) return null;

      return (
        <div
          className="border-t border-neutral-200 dark:border-neutral-700 overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            animationDuration: '300ms',
            animationTimingFunction: 'ease-in-out',
            animationFillMode: 'forwards',
          }}
        >
          <div className="border-t border-neutral-200 dark:border-neutral-700">
            <div className="p-4 space-y-4 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900/50 dark:to-neutral-900">
              {(formula.targetAudience?.length || formula.recommendedDosage || formula.contraindications) && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">详细信息</div>

                  {formula.targetAudience && formula.targetAudience.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400 shrink-0">适用人群:</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{formula.targetAudience.join('、')}</span>
                    </div>
                  )}

                  {formula.recommendedDosage && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400 shrink-0">推荐剂量:</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{formula.recommendedDosage}</span>
                    </div>
                  )}

                  {formula.contraindications && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400 shrink-0">禁忌症:</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{formula.contraindications}</span>
                    </div>
                  )}

                  {formula.efficacy && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400 shrink-0">功效描述:</span>
                      <span className="text-neutral-700 dark:text-neutral-300">{formula.efficacy}</span>
                    </div>
                  )}
                </div>
              )}

              {qualityScore && (
                <div className="grid grid-cols-4 gap-3 p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
                  <div className="text-center">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">综合评分</div>
                    <div className="text-lg font-bold text-primary-700 dark:text-primary-700">
                      {qualityScore.overallScore}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">置信度</div>
                    <div className="text-lg font-bold text-success-600 dark:text-success-600">
                      {qualityScore.confidenceScore}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">完整性</div>
                    <div className="text-lg font-bold text-secondary-600 dark:text-secondary-700">
                      {qualityScore.completenessScore}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">多样性</div>
                    <div className="text-lg font-bold text-accent-600 dark:text-accent-700">
                      {qualityScore.diversityScore}
                    </div>
                  </div>
                </div>
              )}

              {formula.sourceMessageId && (
                <div className="p-3 bg-warning-50 dark:bg-warning-300/20 rounded-lg border border-warning-200 dark:border-warning-800">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-warning-600 dark:text-warning-700 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-warning-800 dark:text-warning-700 mb-1">来源消息</div>
                      <div className="text-xs text-warning-700 dark:text-warning-700 truncate">
                        Message ID: {formula.sourceMessageId}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {formula.sourceMessageId && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToSource?.(formula.sourceMessageId);
                    }}
                    icon={<ExternalLink size={14} />}
                  >
                    查看原文
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(formula.id);
                  }}
                  icon={<Eye size={14} />}
                >
                  收起
                </Button>

                <Button
                  variant="ai"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateReport(formula.id);
                  }}
                  icon={<FileText size={14} />}
                >
                  生成报告
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetail(formula.id);
                  }}
                  disabled={!formula.ingredients || formula.ingredients.length === 0}
                  icon={<Table2 size={14} />}
                >
                  数据表格
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.(formula.id);
                  }}
                  icon={
                    formula.isFavorite ? (
                      <Star size={14} className="fill-current text-warning-500" />
                    ) : (
                      <Star size={14} />
                    )
                  }
                >
                  {formula.isFavorite ? '已收藏' : '收藏'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const displayName = formula.autoName || formula.name;
    const parsedAt = formula.parsedAt;
    const timeStr = parsedAt
      ? parsedAt.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '未知时间';

    return (
      <div
        {...swipeHandlers}
        {...longPressHandlers}
        className={`
        group relative rounded-xl transition-all duration-200 ease-out
        border bg-white dark:bg-neutral-800
        shadow-sm hover:shadow-md
        hover:-translate-y-0.5
        touch-pan-x select-none
        ${
          isSelected
            ? 'border-l-4 border-l-primary-500 border-primary-300 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-300/15'
            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
        }
      `}
        onDoubleClick={() => onToggleExpand(formula.id)}
      >
        <div className={`space-y-3 ${compact ? 'p-3' : 'sm:p-4 p-3'}`}>
          {/* Header: Checkbox + 名称 + 质量等级 - 移动端堆叠显示 */}
          <div
            className={`flex items-start justify-between gap-3 ${compact ? 'flex-col sm:flex-row sm:items-center' : ''}`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {onSelect && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onSelect(formula.id);
                  }}
                  className={`mt-1 rounded border-neutral-300 dark:border-neutral-700 text-primary-700 focus:ring-primary-500/50 cursor-pointer shrink-0 ${
                    compact ? 'w-5 h-5 sm:w-4 sm:h-4' : 'w-4 h-4'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                />
              )}

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveEdit}
                      className={`flex-1 font-semibold border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/50 bg-white dark:bg-neutral-900 dark:border-primary-700 dark:text-white ${
                        compact ? 'px-2 py-1 text-sm' : 'px-2 py-1 text-base'
                      }`}
        aria-label="配方名称"
      />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit();
                      }}
                      className="p-2 sm:p-1 text-success-600 hover:bg-success-50 rounded min-h-[44px] sm:min-h-0"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      className="p-2 sm:p-1 text-neutral-500 hover:bg-neutral-100 dark:bg-neutral-800 rounded min-h-[44px] sm:min-h-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 cursor-pointer group/name"
                     role="button" tabIndex={0} onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit();
                    }}
                    title="点击编辑名称"
                  >
                    <h3
                      className={`${compact ? 'text-sm' : 'text-lg sm:text-lg'} font-semibold text-neutral-900 dark:text-white truncate flex-1`}
                    >
                      {displayName}
                    </h3>
                    {onRename && (
                      <Pencil
                        size={14}
                        className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0">{renderQualityBadge()}</div>
          </div>

          {/* Body: 功效标签 + 置信度 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">{renderEfficacyTags()}</div>
            <div className="shrink-0">{renderConfidenceBadge()}</div>
          </div>

          {/* Ingredients: 核心成分 pill 标签 */}
          {renderIngredients()}

          {/* Footer: 时间 + 成分数 + 展开按钮 - 移动端精简 */}
          <div
            className={`flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-700 ${compact ? 'flex-wrap' : ''}`}
          >
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{timeStr}</span>
              <span className="sm:hidden">{parsedAt ? parsedAt.toLocaleDateString('zh-CN') : '未知'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {formula.ingredientCount || formula.ingredients?.length || 0}种成分
            </span>

            {/* 移动端触摸优化的展开按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(formula.id);
              }}
              className="ml-auto inline-flex items-center gap-1 text-secondary-600 dark:text-secondary-700 font-medium cursor-pointer p-2 -mr-2 active:bg-neutral-100 dark:bg-neutral-800 rounded-full min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              aria-label={isExpanded ? '收起' : '展开详情'}
            >
              {isExpanded ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">已收起</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">展开详情</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {renderExpandedContent()}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.formula.id === nextProps.formula.id &&
      prevProps.formula.autoName === nextProps.formula.autoName &&
      prevProps.formula.name === nextProps.formula.name &&
      prevProps.formula.qualityGrade === nextProps.formula.qualityGrade &&
      prevProps.formula.confidence === nextProps.formula.confidence &&
      prevProps.formula.tags === nextProps.formula.tags &&
      prevProps.formula.isFavorite === nextProps.formula.isFavorite &&
      prevProps.formula.ingredientCount === nextProps.formula.ingredientCount &&
      prevProps.formula.updatedAt === nextProps.formula.updatedAt &&
      prevProps.isExpanded === nextProps.isExpanded &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.compact === nextProps.compact &&
      prevProps.qualityScore?.overallScore === nextProps.qualityScore?.overallScore &&
      prevProps.qualityScore?.qualityGrade === nextProps.qualityScore?.qualityGrade &&
      prevProps.qualityScore?.confidenceScore === nextProps.qualityScore?.confidenceScore
    );
  },
);

FormulaCard.displayName = 'FormulaCard';

export { FormulaCard };
export type { FormulaCardProps };
