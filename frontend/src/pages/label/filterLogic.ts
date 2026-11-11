/**
 * M8 过滤/搜索 — 结果筛选状态与过滤逻辑（纯函数，可单测）
 */
import type { LabelIngredient } from '@/api/labelCheck';

export type LevelFilter = 'all' | 'info' | 'note' | 'warning';
export type AllergenFilter = 'all' | 'yes' | 'no';

export interface LabelCheckFilters {
  category: string; // 'all' 或具体分类 key
  level: LevelFilter;
  allergen: AllergenFilter;
  query: string;
}

export const DEFAULT_FILTERS: LabelCheckFilters = {
  category: 'all',
  level: 'all',
  allergen: 'all',
  query: '',
};

/** 对成分列表应用筛选（关键词匹配 name / raw_name / aliases / message） */
export function filterIngredients(
  ingredients: LabelIngredient[],
  f: LabelCheckFilters,
): LabelIngredient[] {
  const q = f.query.trim().toLowerCase();
  return ingredients.filter(ing => {
    if (f.category !== 'all' && ing.category !== f.category) return false;
    if (f.level !== 'all' && ing.level !== f.level) return false;
    if (f.allergen === 'yes' && !ing.allergen) return false;
    if (f.allergen === 'no' && ing.allergen) return false;
    if (q) {
      const haystack = [ing.name, ing.raw_name, ing.message, ...(ing.aliases ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
