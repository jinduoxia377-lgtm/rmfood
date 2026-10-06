/**
 * 配方卡片组件 — 用于卡片视图展示单个配方
 * Apple HIG 风格：清晰层级、充足呼吸空间、语义化颜色
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
  approved:     'border-emerald-500',
  pending_review: 'border-amber-500',
  in_review:    'border-blue-500',
  rejected:     'border-red-500',
  draft:        'border-neutral-300',
  archived:     'border-neutral-200',
  deprecated:   'border-neutral-200',
};

const STATUS_BG: Record<string, string> = {
  approved:     'bg-emerald-50 dark:bg-emerald-950/20',
  pending_review: 'bg-amber-50 dark:bg-amber-950/20',
  in_review:    'bg-blue-50 dark:bg-blue-950/20',
  rejected:     'bg-red-50 dark:bg-red-950/20',
  draft:        'bg-neutral-50 dark:bg-neutral-800/40',
  archived:     'bg-neutral-50 dark:bg-neutral-800/40',
  deprecated:   'bg-neutral-50 dark:bg-neutral-800/40',
};

const STATUS_BAR: Record<string, string> = {
  approved:     'bg-emerald-500',
  pending_review: 'bg-amber-500',
  in_review:    'bg-blue-500',
  rejected:     'bg-red-500',
  draft:        'bg-neutral-300',
  archived:     'bg-neutral-200',
  deprecated:   'bg-neutral-200',
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
  const statusBg     = STATUS_BG[formula.status] || STATUS_BG.draft;
  const statusBar    = STATUS_BAR[formula.status] || STATUS_BAR.draft;
  const isFavOrSelected = isFavorite || isSelected;

  return (
    <Card className={cn(
      'group relative overflow-visible transition-all duration-200',
      'border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm',
      isSelected && 'ring-2 ring-primary-200 dark:ring-primary-800',
      isFavOrSelected && statusBg,
    )}>
      {/* 顶部状态色条 */}
      <div className={cn('h-[3px] w-full rounded-t-xl', statusBar)} />

      <CardContent className="p-5">
        {/* 收藏按钮 */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-lg transition-all',
            isFavorite
              ? 'bg-warning-50 dark:bg-warning-900/20 text-warning-500'
              : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-warning-400',
          )}
          aria-label={isFavorite ? '取消收藏' : '收藏'}
          aria-pressed={isFavorite}
        >
          <Star size={14} className={isFavorite ? 'fill-warning-400 text-warning-400' : ''} />
        </button>

        {/* 多选框 */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
          className={cn(
            'w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center mt-0.5',
            isSelected
              ? 'bg-primary-container border-primary-500 text-primary-main'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
          )}
          aria-label={isSelected ? '取消选择' : '选择'}
          aria-pressed={isSelected}
        >
          {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
        </button>

        {/* 标题区 */}
        <div className="flex items-start justify-between mb-2 pl-7 pr-8">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1 leading-snug">
              <Highlight text={formula.name} keyword={search} />
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-relaxed">
              <Highlight text={formula.code || ''} keyword={search} /> · v{formula.version}
            </p>
          </div>
          <StatusBadge status={formula.status} />
        </div>

        {/* 描述 */}
        {formula.description && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3 leading-relaxed pl-7">
            {formula.description}
          </p>
        )}

        {/* 功效标签 */}
        {formula.targetEffects && formula.targetEffects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pl-7">
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
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{formatDate(formula.updatedAt)}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.preventDefault(); onPreview(); }}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              aria-label="快速预览"
            >
              <Eye size={14} />
            </button>
            <Link
              to={`/formulas/${formula.id}`}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
