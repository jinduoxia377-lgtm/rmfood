/**
 * 配方卡片组件 — 用于卡片视图展示单个配方
 * Apple HIG 风格：清晰层级、充足呼吸空间、语义化颜色
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, Star, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Highlight } from '@/components/common';
import { StatusBadge, Badge, Card, CardContent } from '@/components/ui';
import type { Formula } from '@/types/formula';

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

const STATUS_BG: Record<string, string> = {
  approved:     'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20',
  pending_review: 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20',
  in_review:    'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20',
  rejected:     'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/20',
  draft:        'bg-[var(--bg-tertiary)]/40',
  archived:     'bg-[var(--bg-tertiary)]/40',
  deprecated:   'bg-[var(--bg-tertiary)]/40',
};

const STATUS_BAR: Record<string, string> = {
  approved:     'bg-[var(--color-success-container)]0',
  pending_review: 'bg-[var(--color-warning-container)]0',
  in_review:    'bg-[var(--color-secondary-container)]0',
  rejected:     'bg-[var(--color-error-container)]0',
  draft:        'bg-neutral-300',
  archived:     'bg-[var(--border-color)]',
  deprecated:   'bg-[var(--border-color)]',
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
  const statusBg     = STATUS_BG[formula.status] || STATUS_BG.draft;
  const statusBar    = STATUS_BAR[formula.status] || STATUS_BAR.draft;
  const isFavOrSelected = isFavorite || isSelected;

  return (
    <Card className={cn(
      'group relative overflow-visible transition-all duration-200',
      'border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-sm',
      isSelected && 'ring-2 ring-[var(--color-primary-container)] dark:ring-[var(--color-primary)]',
      isFavOrSelected && statusBg,
    )}>
      {/* 顶部状态色条 */}
      <div className={cn('h-[3px] w-full rounded-t-xl', statusBar)} />

      <CardContent className="p-5">
        {/* 收藏按钮 */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(); }}
          className={cn(
            /* A-23：原 26×26（14px 图标 + p-1.5），未达 WCAG 2.5.5 的 44×44。
               撑到 44×44 作命中区，用 -m-[9px] 抵消，视觉位置与原来完全一致。 */
            'absolute top-[var(--space-apple-sm)] right-3 p-1.5 min-w-[44px] min-h-[44px] -m-[9px] inline-flex items-center justify-center rounded-[var(--radius-Apple-sm)] transition-all',
            isFavorite
              ? 'bg-[var(--color-warning-container)] text-[var(--color-warning-text)]0'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--color-warning-text)]',
          )}
          aria-label={isFavorite ? '取消收藏' : '收藏'}
          aria-pressed={isFavorite}
        >
          <Star size={14} className={isFavorite ? 'fill-warning-400 text-[var(--color-warning-text)]' : ''} />
        </button>

        {/* 多选框 */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
          className="w-11 h-11 -m-3 rounded shrink-0 transition-all inline-flex items-center justify-center mt-0.5"
          aria-label={isSelected ? '取消选择' : '选择'}
          aria-pressed={isSelected}
        >
          {/* A-23：20×20 的视觉方框下沉到内层 span，外层 button 只作 44×44 命中区 */}
          <span
            className={cn(
              'w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center',
              isSelected
                ? 'bg-primary-container border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-[var(--border-color)]',
            )}
          >
            {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
          </span>
        </button>

        {/* 标题区 */}
        <div className="flex items-start justify-between mb-2 pl-7 pr-8">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary-text)] dark:group-hover:text-[var(--color-primary-text)] transition-colors line-clamp-1 leading-snug">
              <Highlight text={formula.name} keyword={search} />
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
              <Highlight text={formula.code || ''} keyword={search} /> · v{formula.version}
            </p>
          </div>
          <StatusBadge status={formula.status} />
        </div>

        {/* 描述 */}
        {formula.description && (
          <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-[var(--space-apple-sm)] leading-relaxed pl-7">
            {formula.description}
          </p>
        )}

        {/* 功效标签 */}
        {formula.targetEffects && formula.targetEffects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-[var(--space-apple-sm)] pl-7">
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
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-[var(--border-color)]">
          <span className="text-xs text-[var(--text-muted)]">{formatDate(formula.updatedAt)}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.preventDefault(); onPreview(); }}
              className="p-1.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors"
              aria-label="快速预览"
            >
              <Eye size={14} />
            </button>
            <Link
              to={`/formulas/${formula.id}`}
              className="p-1.5 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--color-primary-text)] dark:hover:text-[var(--color-primary-text)] transition-colors"
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
