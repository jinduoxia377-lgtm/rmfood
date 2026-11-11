/**
 * 配料表核查 v2 — 前端展示映射常量（徽章色 / 图标 / i18n key）
 *
 * 仅做展示层映射，不含任何合规判定逻辑。
 */
import { Info, AlertTriangle, ShieldAlert, CircleCheck } from 'lucide-react';
import type { MatchMethod } from '@/api/labelCheck';

export const LEVEL_META: Record<
  string,
  { labelKey: string; variant: 'info' | 'warning' | 'danger'; icon: typeof Info; textClass: string }
> = {
  info: { labelKey: 'pages.labelCheck.levelInfo', variant: 'info', icon: Info, textClass: 'text-info-500' },
  note: { labelKey: 'pages.labelCheck.levelNote', variant: 'warning', icon: AlertTriangle, textClass: 'text-warning-500' },
  warning: { labelKey: 'pages.labelCheck.levelWarning', variant: 'danger', icon: ShieldAlert, textClass: 'text-danger-500' },
};

export const MATCH_META: Record<MatchMethod, { labelKey: string; icon: typeof CircleCheck }> = {
  exact: { labelKey: 'pages.labelCheck.matchExact', icon: CircleCheck },
  alias: { labelKey: 'pages.labelCheck.matchAlias', icon: Info },
  fuzzy: { labelKey: 'pages.labelCheck.matchFuzzy', icon: AlertTriangle },
  none: { labelKey: 'pages.labelCheck.matchNone', icon: AlertTriangle },
};

/** 分类 key → i18n label key（与现有页面 category* key 对齐） */
export const CATEGORY_LABEL_KEY: Record<string, string> = {
  food_homology: 'pages.labelCheck.categoryFoodHomology',
  new_food_resource: 'pages.labelCheck.categoryNewFood',
  food_additive: 'pages.labelCheck.categoryAdditive',
  ordinary_food: 'pages.labelCheck.categoryOrdinary',
  nutrition_enricher: 'pages.labelCheck.categoryEnricher',
  prohibited: 'pages.labelCheck.categoryProhibited',
  unknown: 'pages.labelCheck.categoryUnknown',
};

/** 分类 key → 徽章 variant */
export const CATEGORY_VARIANT: Record<string, 'info' | 'warning' | 'danger' | 'outline' | 'secondary' | 'neutral'> = {
  prohibited: 'danger',
  unknown: 'neutral',
  food_additive: 'info',
  nutrition_enricher: 'info',
  food_homology: 'secondary',
  new_food_resource: 'secondary',
  ordinary_food: 'outline',
};
