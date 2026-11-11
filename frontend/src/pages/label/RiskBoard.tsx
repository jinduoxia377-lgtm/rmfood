/**
 * M3 风险看板 — 目录比对提示分 + 需人工核实项 + 分类分布 + 致敏分组视图
 *
 * 🔴 合规红线（契约 v2.1）：
 * - risk_score 仅称「目录比对提示分」（内部参考，非安全评分），不得称「安全评分」，
 *   不得展示「低/中/高风险」「可放心」等绝对化定级措辞。
 * - 主展示中性指标「需人工核实项数」。
 * - 致敏项措辞用「建议标示（GB 7718 附录 B 推荐性）」，不作「高危/违规」判定。
 * - 展示处始终保留固定免责声明。
 */
import { useTranslation } from 'react-i18next';
import { Gauge, Layers, Wheat, SearchCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Progress } from '@/components/ui';
import type { LabelCheckResult } from '@/api/labelCheck';
import { CATEGORY_LABEL_KEY } from './labelCheckMeta';

interface RiskBoardProps {
  result: LabelCheckResult;
}

/** 环形「目录比对提示分」仪表（SVG，中性单色，非定级配色）
 *  用 Ocean Blue(secondary) 而非 Forest Green(primary)：该分是中性「目录比对提示分」，
 *  不是安全评分；绿色易被误读为「成功/安全」态，蓝色代表数据/信息，更契合中性语义。 */
function ScoreGauge({ score }: { score: number }) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, score));
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const filled = (clamped / 100) * CIRC;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 128 128" className="w-36 h-36 -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" className="text-muted" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
            className="stroke-secondary"
            strokeDasharray={`${filled} ${CIRC - filled}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono text-secondary-700 dark:text-secondary-300">{clamped}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge variant="outline">{t('pages.labelCheck.riskScoreLabel')}</Badge>
    </div>
  );
}

export default function RiskBoard({ result }: RiskBoardProps) {
  const { t } = useTranslation();
  // v2 字段可选兜底：后端未就绪时隐藏对应区块，不空白
  const score = result.risk_score ?? null;
  const needsReview = result.needs_review_count ?? null;
  const stats = result.stats ?? null;

  const counts = Object.entries(result.category_counts ?? {});
  const maxCount = Math.max(1, ...counts.map(([, v]) => v));

  const allergens = result.allergen_ingredients ?? [];
  // 按致敏分组聚合
  const byGroup = new Map<string, string[]>();
  for (const a of allergens) {
    const list = byGroup.get(a.group) ?? [];
    list.push(a.name);
    byGroup.set(a.group, list);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 目录比对提示分 + 需人工核实项 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="w-4 h-4" /> {t('pages.labelCheck.riskBoardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {score != null ? (
            <ScoreGauge score={score} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('pages.labelCheck.riskUnavailable')}</p>
          )}
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('pages.labelCheck.riskScore')}</span>
              <span>{score ?? '-'}</span>
            </div>
            <Progress value={score ?? 0} className="[&>div]:bg-secondary" />
          </div>
          <p className="text-xs text-muted-foreground text-center">{t('pages.labelCheck.riskNote')}</p>

          {needsReview != null && (
            <div className="w-full rounded-lg border border-info-200 bg-info-50 dark:bg-info-900/10 p-2.5 flex items-center gap-2">
              <SearchCheck className="w-4 h-4 text-info-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-info-700 dark:text-info-300">
                  {t('pages.labelCheck.needsReviewCount', { count: needsReview })}
                </div>
                <div className="text-xs text-muted-foreground">{t('pages.labelCheck.needsReviewNote')}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分类分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4" /> {t('pages.labelCheck.categoryDistTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {counts.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('pages.labelCheck.noData')}</p>
          )}
          {counts.map(([key, count]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{t(CATEGORY_LABEL_KEY[key] ?? 'pages.labelCheck.categoryUnknown')}</span>
                <span className="font-medium">{count}</span>
              </div>
              <Progress value={(count / maxCount) * 100} />
            </div>
          ))}
          {stats && (
            <div className="pt-2 mt-2 border-t border-border grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>{t('pages.labelCheck.statsTotal')}: {stats.total}</span>
              <span>{t('pages.labelCheck.statsMatched')}: {stats.matched}</span>
              <span>{t('pages.labelCheck.statsUnmatched')}: {stats.unmatched}</span>
              <span>{t('pages.labelCheck.statsCompound')}: {stats.compound_expanded}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 致敏分组视图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wheat className="w-4 h-4" /> {t('pages.labelCheck.allergenGroupTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byGroup.size === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pages.labelCheck.allergenNone')}</p>
          ) : (
            Array.from(byGroup.entries()).map(([group, names]) => (
              <div key={group} className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-xs font-semibold">{group}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{names.join('、')}</div>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">{t('pages.labelCheck.allergenNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
