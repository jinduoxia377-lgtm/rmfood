/**
 * 配方卡片组件 — 用于卡片视图展示单个配方
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, Star, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Highlight } from '@/components/common';
import { StatusBadge, Badge, Card, CardContent } from '@/components/ui';
import type { Formula, FormulaStatus } from '@/types/formula';

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function getStatusLabel(status: FormulaStatus): string {
  const map: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审核',
    in_review: '审核中',
    approved: '已通过',
    rejected: '已驳回',
    archived: '已归档',
    deprecated: '已弃用',
  };
  return map[status as string] || (status as string);
}

const STATUS_ACCENT: Record<string, string> = {
  approved:  'border-emerald-500',
  pending_review: 'border-amber-500',
  in_review: 'border-blue-500',
  rejected:  'border-red-500',
  draft:     'border-neutral-400',
  archived:  'border-neutral-300',
  deprecated:'border-neutral-300',
};

const STATUS_BG: Record<string, string> = {
  approved:  'bg-primary-50 dark:bg-emerald-950/20',
  pending_review: 'bg-warning-50 dark:bg-amber-950/20',
  in_review: 'bg-secondary-50 dark:bg-blue-950/20',
  rejected:  'bg-error-50 dark:bg-red-950/20',
  draft:     'bg-slate-50 dark:bg-neutral-900/20',
  archived:  'bg-slate-50 dark:bg-neutral-900/20',
  deprecated:'bg-slate-50 dark:bg-neutral-900/20',
};

export function FormulaCard({
  formula,
  search,
  isFavorite,
  isSelected,
  onToggleFavorite,
  onToggleSelect,
  onPreview,
}: {
  formula: Formula;
  search: string;
  isFavorite: boolean;
  isSelected: boolean;
  onToggleFavorite: () => void;
  onToggleSelect: () => void;
  onPreview: () => void;
}) {
  const accentBorder = STATUS_ACCENT[formula.status] || STATUS_ACCENT.draft;
  const isFavOrSelected = isFavorite || isSelected;

  return (
    <Card className={cn(
      "group card-hover relative animate-in fade-in slide-in-from-2 duration-300",
      "border-l-4", accentBorder,
      isFavOrSelected && (STATUS_BG[formula.status] ?? ''),
    )}>
      <CardContent className="p-5">
        {/* 收藏按钮 */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label={isFavorite ? '取消收藏' : '收藏'}
          aria-pressed={isFavorite}
        >
          <Star size={16} className={isFavorite ? 'fill-amber-400 text-warning-400' : 'text-neutral-300'} />
        </button>

        {/* 多选框 */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          className={cn(
            'w-5 h-5 rounded border-2 shrink-0 transition-colors flex items-center justify-center mb-3',
            isSelected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
          )}
          aria-label={isSelected ? '取消选择' : '选择'}
          aria-pressed={isSelected}
        >
          {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
        </button>

        {/* 标题区 — 增强层次 */}
        <div className="flex items-start justify-between mb-2 pr-8">
          <div>
            <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 transition-colors line-clamp-1">
              <Highlight text={formula.name} keyword={search} />
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              <Highlight text={formula.code || ''} keyword={search} /> · v{formula.version}
            </p>
          </div>
          <StatusBadge status={formula.status} />
        </div>

        {/* 描述 */}
        {formula.description && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3">{formula.description}</p>
        )}

        {/* 功效标签 */}
        {formula.targetEffects && formula.targetEffects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {formula.targetEffects.slice(0, 3).map((effect: any) => (
              <Badge key={typeof effect === 'string' ? effect : effect.effectName} variant="primary" size="sm">
                {typeof effect === 'string' ? effect : effect.effectName}
              </Badge>
            ))}
            {formula.targetEffects.length > 3 && (
              <Badge variant="neutral" size="sm">
                +{formula.targetEffects.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-400">{formatDate(formula.updatedAt)}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.preventDefault();
                onPreview();
              }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-primary-600 transition-colors"
              title="快速预览"
              aria-label="快速预览"
            >
              <Eye size={14} />
            </button>
            <Link
              to={`/formulas/${formula.id}`}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-primary-600 transition-colors"
              title="查看详情"
              aria-label="查看详情"
            >
              <ArrowRightLeft size={14} />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
