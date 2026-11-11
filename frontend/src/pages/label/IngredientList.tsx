/**
 * M4 成分明细升级 — 每项可展开/折叠
 *
 * 展开显示：匹配方式 / 置信度 / 别名链 / 限量 / 功能 / 来源法规 / 复合配料子成分 / 风险贡献。
 * 字段全部 v2 可选，读取处 `??` 兜底，避免字段漂移导致空白。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Link2, FlaskConical, ShieldAlert, Sigma } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { LabelIngredient } from '@/api/labelCheck';
import { LEVEL_META, MATCH_META, CATEGORY_VARIANT } from './labelCheckMeta';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="flex-1 min-w-0 break-words">{value}</span>
    </div>
  );
}

function IngredientRow({ ing }: { ing: LabelIngredient }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const meta = LEVEL_META[ing.level] ?? LEVEL_META.info;
  const Icon = meta.icon;
  const match = ing.match_method ? MATCH_META[ing.match_method] : null;

  const hasDetail =
    ing.match_method != null || ing.match_confidence != null || (ing.aliases?.length ?? 0) > 0 ||
    ing.max_dosage_mg_per_day != null || ing.function != null || ing.max_usage != null ||
    ing.source != null || ing.risk_contribution != null || ing.is_compound || (ing.sub_ingredients?.length ?? 0) > 0 ||
    ing.raw_name != null || ing.caution != null;

  const confidencePct = ing.match_confidence != null ? Math.round(ing.match_confidence * 100) : null;

  return (
    <div className={`rounded-xl border ${ing.level === 'warning' ? 'border-danger-200 bg-danger-50 dark:bg-danger-900/10' : ing.level === 'note' ? 'border-warning-200 bg-warning-50 dark:bg-warning-900/10' : 'border-border bg-muted/30'}`}>
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-3 text-left cursor-pointer disabled:cursor-default"
        aria-expanded={open}
        disabled={!hasDetail}
      >
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.textClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{ing.name}</span>
            <Badge variant={CATEGORY_VARIANT[ing.category] ?? 'outline'}>{ing.category_label}</Badge>
            {match && confidencePct != null && (
              <Badge variant="outline" className="gap-1">
                <match.icon className="w-3.5 h-3.5" />
                {t(match.labelKey)} · {confidencePct}%
              </Badge>
            )}
            {ing.allergen && (
              <Badge variant="warning">{t('pages.labelCheck.allergen', { group: ing.allergen_group ?? '' })}</Badge>
            )}
            {ing.is_compound && (
              <Badge variant="info"><FlaskConical className="w-3.5 h-3.5 mr-1" />{t('pages.labelCheck.compound')}</Badge>
            )}
            {ing.caution && (
              <Badge variant="warning"><ShieldAlert className="w-3.5 h-3.5 mr-1" />{ing.caution}</Badge>
            )}
          </div>
          <p className="text-sm mt-1 text-muted-foreground">{ing.message}</p>
        </div>
        {hasDetail && (
          open ? <ChevronDown className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 mt-1 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && hasDetail && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-border/60 mt-1">
          {ing.raw_name != null && ing.raw_name !== ing.name && (
            <DetailRow label={t('pages.labelCheck.detailRawName')} value={ing.raw_name} />
          )}
          {match && (
            <DetailRow label={t('pages.labelCheck.detailMatchMethod')} value={t(match.labelKey)} />
          )}
          {confidencePct != null && (
            <DetailRow label={t('pages.labelCheck.detailConfidence')} value={`${confidencePct}%`} />
          )}
          {(ing.aliases?.length ?? 0) > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" />{t('pages.labelCheck.detailAliases')}
              </span>
              <span className="flex-1 min-w-0 break-words">{ing.aliases!.join(' → ')}</span>
            </div>
          )}
          {ing.caution && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />{t('pages.labelCheck.detailCaution')}
              </span>
              <span className="flex-1 min-w-0 break-words">{ing.caution}</span>
            </div>
          )}
          {ing.max_dosage_mg_per_day != null && (
            <DetailRow label={t('pages.labelCheck.detailMaxDosage')} value={`${ing.max_dosage_mg_per_day} mg`} />
          )}
          {ing.function != null && (
            <DetailRow label={t('pages.labelCheck.detailFunction')} value={ing.function} />
          )}
          {ing.max_usage != null && (
            <DetailRow label={t('pages.labelCheck.detailMaxUsage')} value={ing.max_usage} />
          )}
          {ing.source != null && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />{t('pages.labelCheck.detailSource')}
              </span>
              <span className="flex-1 min-w-0 break-words">{ing.source}</span>
            </div>
          )}
          {ing.risk_contribution != null && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                <Sigma className="w-3.5 h-3.5" />{t('pages.labelCheck.detailRiskContribution')}
              </span>
              <span className="flex-1 min-w-0 break-words">{ing.risk_contribution}</span>
            </div>
          )}
          {(ing.sub_ingredients?.length ?? 0) > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 w-28">{t('pages.labelCheck.detailSubIngredients')}</span>
              <span className="flex-1 min-w-0 break-words">{ing.sub_ingredients!.join('、')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngredientList({ ingredients }: { ingredients: LabelIngredient[] }) {
  const { t } = useTranslation();
  if (ingredients.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{t('pages.labelCheck.filterEmpty')}</p>;
  }
  return (
    <div className="space-y-2">
      {ingredients.map((ing, idx) => (
        <IngredientRow key={`${ing.name}-${idx}`} ing={ing} />
      ))}
    </div>
  );
}
