/**
 * M8 过滤/搜索 — 分类 / 级别 / 致敏 筛选 + 关键词搜索
 */
import { useTranslation } from 'react-i18next';
import { Search, Filter, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { CATEGORY_LABEL_KEY } from './labelCheckMeta';
import type { LabelCheckFilters, LevelFilter, AllergenFilter } from './filterLogic';

interface FilterBarProps {
  filters: LabelCheckFilters;
  onChange: (f: LabelCheckFilters) => void;
  categories: string[]; // 出现在当前结果中的分类 key
  shown: number; // 过滤后数量
  total: number; // 过滤前总数
}

const LEVELS: LevelFilter[] = ['all', 'info', 'note', 'warning'];
const ALLERGENS: AllergenFilter[] = ['all', 'yes', 'no'];

export default function FilterBar({ filters, onChange, categories, shown, total }: FilterBarProps) {
  const { t } = useTranslation();
  const set = (patch: Partial<LabelCheckFilters>) => onChange({ ...filters, ...patch });

  const levelLabel = (l: LevelFilter) =>
    l === 'all' ? t('pages.labelCheck.filterAll') : t(`pages.labelCheck.level${l.charAt(0).toUpperCase()}${l.slice(1)}`);

  const allergenLabel = (a: AllergenFilter) =>
    a === 'all' ? t('pages.labelCheck.filterAll')
      : a === 'yes' ? t('pages.labelCheck.filterAllergenYes')
        : t('pages.labelCheck.filterAllergenNo');

  const active = filters.category !== 'all' || filters.level !== 'all' || filters.allergen !== 'all' || filters.query.trim() !== '';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> {t('pages.labelCheck.filterCategory')}
        </span>
        <button
          onClick={() => set({ category: 'all' })}
          className={`min-h-[44px] inline-flex items-center text-sm rounded-full px-4 border transition-colors ${filters.category === 'all' ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-muted'}`}
        >
          {t('pages.labelCheck.filterAll')}
        </button>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => set({ category: filters.category === c ? 'all' : c })}
            className={`min-h-[44px] inline-flex items-center text-sm rounded-full px-4 border transition-colors ${filters.category === c ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-muted'}`}
          >
            {t(CATEGORY_LABEL_KEY[c] ?? 'pages.labelCheck.categoryUnknown')}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">{t('pages.labelCheck.filterLevel')}</span>
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => set({ level: l })}
            className={`min-h-[44px] inline-flex items-center text-sm rounded-full px-4 border transition-colors ${filters.level === l ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-muted'}`}
          >
            {levelLabel(l)}
          </button>
        ))}
        <span className="text-xs font-medium text-muted-foreground ml-2">{t('pages.labelCheck.filterAllergen')}</span>
        {ALLERGENS.map(a => (
          <button
            key={a}
            onClick={() => set({ allergen: a })}
            className={`min-h-[44px] inline-flex items-center text-sm rounded-full px-4 border transition-colors ${filters.allergen === a ? 'bg-primary text-primary-foreground border-transparent' : 'border-border hover:bg-muted'}`}
          >
            {allergenLabel(a)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t('pages.labelCheck.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ category: 'all', level: 'all', allergen: 'all', query: '' })}>
            <X className="w-4 h-4 mr-1" /> {t('pages.labelCheck.filterReset')}
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {t('pages.labelCheck.filterShowing', { shown, total })}
      </div>
    </div>
  );
}
