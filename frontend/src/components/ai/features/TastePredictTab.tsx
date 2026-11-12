/**
 * TastePredictTab - 口感预测模块 (增强版)
 *
 * 从 35% 提升至 75% 的深度开发版本
 * 集成风味轮、雷达图、本地算法、成分映射表等核心功能
 *
 * 架构设计：
 * - 左侧：输入控制面板（40%）
 * - 右侧：可视化结果展示（60%）
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import { Button, Card, Select, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Cherry, FlaskConical, BarChart3, Table2, Lightbulb, RotateCcw, History } from 'lucide-react';

import { FlavorWheel } from '@/components/ai/visualization/FlavorWheel';
import { TasteRadarChart } from '@/components/ai/visualization/TasteRadarChart';
import { localTastePredictor } from '@/services/tastePredictor';
import { TastePrediction, FiveTastes } from '@/types/taste.types';
import {
  FIVE_TASTES_LABELS,
  FIVE_TASTES_COLORS,
  INGREDIENT_TASTE_DATABASE,
  PROCESSING_METHODS,
} from '@/types/taste.types';

interface IngredientInput {
  name: string;
  amount?: number;
  unit?: string;
  processingMethod?: string;
}

/** 炮制方法中文名 → i18n key（ai.taste.processing.methods.*）映射 */
const PROCESSING_METHOD_KEYS: Record<string, string> = {
  '蜜炙': 'honey',
  '酒炒': 'wine',
  '醋制': 'vinegar',
  '盐炒': 'salt',
  '麸炒': 'bran',
  '土炒': 'earth',
};

function computeAvgSour(names: string[]): number {
  let total = 0, count = 0;
  for (const name of names) {
    const profile = INGREDIENT_TASTE_DATABASE[name];
    if (profile) { total += profile.sour; count++; }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

export function TastePredictTab() {
  const { t } = useTranslation();
  const [tasteInput, setTasteInput] = useState('');
  const [, setIngredients] = useState<IngredientInput[]>([]);
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [algorithmMode, setAlgorithmMode] = useState<'weighted' | 'synergy'>('weighted');
  const [tasteResult, setTasteResult] = useState<TastePrediction | null>(null);
  const [historyResults, setHistoryResults] = useState<TastePrediction[]>([]);

  const mutation = useMutation({
    mutationFn: async (names: string[]) => {
      return await aiApi.tastePredict(names.map((name) => ({ name })));
    },
    onSuccess: (data) => {
      const names = tasteInput.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
      const mapped: TastePrediction = {
        score: data.overall_score,
        // 全 0（无口感数据）时主味设为"淡"(BLAND)，不误判为甜：
        // 旧逻辑 sweetness>=bitterness && sweetness>=astringency 在全 0 时恒真 → 误判 SWEET
        dominantTaste:
          data.sweetness === 0 && data.bitterness === 0 && data.astringency === 0
            ? FiveTastes.BLAND
            : data.sweetness >= data.bitterness && data.sweetness >= data.astringency
              ? FiveTastes.SWEET
              : data.bitterness >= data.astringency
                ? FiveTastes.BITTER
                : FiveTastes.SOUR,
        dominantIntensity: Math.max(data.sweetness, data.bitterness, data.astringency),
        profile: {
          sweet: data.sweetness,
          sour: computeAvgSour(names),
          bitter: data.bitterness,
          pungent: data.pungency ?? 0,
          salty: data.saltiness ?? 0,
          bland: 0,
        },
        features: data.flavor_notes,
        description: '',
        // 用本地预测器补全 suggestions 和 contributions
        ...(() => {
          const localInput = names.map((n) => ({ name: n, processingMethod }));
          const localResult = localTastePredictor.predict({ ingredients: localInput, algorithmMode });
          return { suggestions: localResult.suggestions, contributions: localResult.contributions };
        })(),
      };
      setTasteResult(mapped);
      if (!historyResults.find((r) => r.score === mapped.score)) {
        setHistoryResults((prev) => [mapped, ...prev].slice(0, 5));
      }
    },
  });

  const handlePredict = useCallback(() => {
    const names = tasteInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    setIngredients(names.map((n) => ({ name: n, processingMethod })));
    mutation.mutate(names);
  }, [tasteInput, processingMethod, algorithmMode, mutation]);

  const handleLocalPredict = useCallback(() => {
    const names = tasteInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const inputIngredients = names.map((n) => ({
      name: n,
      processingMethod: processingMethod || undefined,
    }));

    setIngredients(inputIngredients);

    const result = localTastePredictor.predict({
      ingredients: inputIngredients,
      algorithmMode,
    });

    setTasteResult(result);
    if (!historyResults.find((r) => r.score === result.score)) {
      setHistoryResults((prev) => [result, ...prev].slice(0, 5));
    }
  }, [tasteInput, processingMethod, algorithmMode]);

  const handleClear = useCallback(() => {
    setTasteInput('');
    setIngredients([]);
    setTasteResult(null);
    setProcessingMethod('');
  }, []);

  const parsedIngredients = useMemo(() => {
    return tasteInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [tasteInput]);

  const ingredientProfiles = useMemo(() => {
    return parsedIngredients.map((name) => ({
      name,
      profile: INGREDIENT_TASTE_DATABASE[name] || null,
      hasData: !!INGREDIENT_TASTE_DATABASE[name],
    }));
  }, [parsedIngredients]);

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* 左侧：输入控制面板 — 玻璃态设计 */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-warning-500 to-danger-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur" />
          <Card className="relative p-6 space-y-5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm rounded-2xl">
            {/* 标题区 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning-500 to-danger-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Cherry className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {t('ai.taste.title')}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  {t('ai.taste.subtitle')}
                </p>
              </div>
            </div>

            {/* 输入框 */}
            <div>
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 block">
                {t('ai.taste.formulaLabel')}
              </label>
              <textarea
                value={tasteInput}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTasteInput(e.target.value)}
                placeholder={t('ai.taste.placeholder')}
                rows={4}
                className="w-full px-4 py-3 border border-neutral-200 dark:border-neutral-700
                           rounded-xl text-sm bg-neutral-50 dark:bg-neutral-800/50
                           focus:ring-2 focus:ring-warning-200 dark:focus:ring-warning-800 focus:border-warning-400
                           resize-none transition-all duration-200"
              />
            </div>

            {/* 参数配置 — 选择器样式 */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 block">
                  {t('ai.taste.processing.label')}
                </label>
                <Select
                  value={processingMethod}
                  onChange={(v) => setProcessingMethod(v)}
                  placeholder={t('ai.taste.processing.placeholder')}
                  className="rounded-xl"
                >
                  <option value="">{t('ai.taste.processing.none')}</option>
                  {PROCESSING_METHODS.map((method) => {
                    const methodKey = PROCESSING_METHOD_KEYS[method.name] || method.name;
                    return (
                      <option key={method.name} value={method.name}>
                        {t(`ai.taste.processing.methods.${methodKey}.name`)} - {t(`ai.taste.processing.methods.${methodKey}.description`)}
                      </option>
                    );
                  })}
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 block">
                  {t('ai.taste.algorithm.label')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAlgorithmMode('weighted')}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                      algorithmMode === 'weighted'
                        ? 'bg-warning-50 dark:bg-warning-300/20 border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-700 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-warning-200'
                    }`}
                  >
                    <div className="font-semibold">{t('ai.taste.algorithm.weighted.title')}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t('ai.taste.algorithm.weighted.subtitle')}</div>
                  </button>
                  <button
                    onClick={() => setAlgorithmMode('synergy')}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                      algorithmMode === 'synergy'
                        ? 'bg-warning-50 dark:bg-warning-300/20 border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-700 shadow-sm'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-warning-200'
                    }`}
                  >
                    <div className="font-semibold">{t('ai.taste.algorithm.synergy.title')}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t('ai.taste.algorithm.synergy.subtitle')}</div>
                  </button>
                </div>
              </div>
            </div>

            {/* 操作按钮 — 渐变按钮 */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleLocalPredict}
                disabled={!tasteInput.trim()}
                icon={<FlaskConical className="w-4 h-4" />}
                variant="outline"
                className="flex-1 rounded-xl font-medium border-neutral-200 dark:border-neutral-700"
              >
                {t('ai.taste.buttons.localPredict')}
              </Button>
              <Button
                onClick={handlePredict}
                disabled={!tasteInput.trim() || mutation.isPending}
                loading={mutation.isPending}
                icon={<Cherry className="w-4 h-4" />}
                className="flex-1 rounded-md font-medium transition-colors duration-150"
              >
                {t('ai.taste.buttons.aiAnalyze')}
              </Button>
            </div>

            <Button
              onClick={handleClear}
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              className="w-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              {t('ai.taste.buttons.clearReset')}
            </Button>
          </Card>
        </div>

        {/* 成分预览卡片 */}
        {ingredientProfiles.length > 0 && (
          <Card className="p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <div className="w-6 h-6 rounded-lg bg-warning-100 dark:bg-warning-300/25 flex items-center justify-center">
                  <Table2 className="w-3.5 h-3.5 text-warning-600 dark:text-warning-700" />
                </div>
                {t('ai.taste.ingredients.title')}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-100 dark:bg-warning-300/25 text-warning-600 dark:text-warning-700">
                  {ingredientProfiles.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {ingredientProfiles.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-800/50 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.name}</span>
                  <Badge variant={item.hasData ? 'success' : 'warning'} size="sm" className="rounded-full px-2.5 py-0.5">
                    {item.hasData ? t('ai.taste.ingredients.hasData') : t('ai.taste.ingredients.pending')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 右侧：可视化结果展示 */}
      <div className="col-span-8">
        {!tasteResult ? (
          <Card
            className="h-full flex items-center justify-center bg-gradient-to-br
                           from-error-50 to-warning-50 dark:from-neutral-800 dark:to-neutral-900"
          >
            <div className="text-center space-y-3 p-8">
              <Cherry className="w-16 h-16 mx-auto text-error-300 dark:text-error-600" />
              <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">{t('ai.taste.emptyState.title')}</h3>
              <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] max-w-md">
                {t('ai.taste.emptyState.description')}
              </p>
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="wheel" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="wheel" icon={<BarChart3 className="w-4 h-4" />}>
                {t('ai.taste.tabs.flavorWheel')}
              </TabsTrigger>
              <TabsTrigger value="radar" icon={<BarChart3 className="w-4 h-4" />}>
                雷达图
              </TabsTrigger>
              <TabsTrigger value="details" icon={<Table2 className="w-4 h-4" />}>
                详细数据
              </TabsTrigger>
              <TabsTrigger value="suggestions" icon={<Lightbulb className="w-4 h-4" />}>
                {t('ai.taste.tabs.suggestions')}
              </TabsTrigger>
            </TabsList>

            {/* 风味轮视图 */}
            <TabsContent value="wheel" className="mt-0">
              <Card className="p-6">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <FlavorWheel data={tasteResult.profile} size={320} />

                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('ai.taste.result.overallScore')}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-bold text-secondary-600">{(tasteResult.score * 100).toFixed(0)}</span>
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">/ 100</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-2">{tasteResult.description}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t('ai.taste.result.dominantTaste')}</h4>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: FIVE_TASTES_COLORS[tasteResult.dominantTaste],
                          }}
                        />
                        <span className="font-medium">{FIVE_TASTES_LABELS[tasteResult.dominantTaste]}</span>
                        <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">({tasteResult.dominantIntensity.toFixed(1)})</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">{t('ai.taste.result.tasteFeatures')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {tasteResult.features.map((feature, i) => (
                          <Badge key={i} variant="neutral" size="sm">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* 雷达图视图 */}
            <TabsContent value="radar" className="mt-0">
              <Card className="p-6">
                <TasteRadarChart
                  primaryData={tasteResult.profile}
                  comparisonData={
                    historyResults.length > 0
                      ? [
                          {
                            label: t('ai.taste.history.label', { index: 1 }),
                            data: historyResults[0].profile,
                            color: 'var(--color-primary-400)',
                          },
                        ]
                      : undefined
                  }
                  height={420}
                />
              </Card>
            </TabsContent>

            {/* 详细数据视图 */}
            <TabsContent value="details" className="mt-0">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">{t('ai.taste.details.title')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3">{t('ai.taste.details.ingredient')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.sweet')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.sour')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.bitter')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.pungent')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.salty')}</th>
                        <th className="text-center py-2 px-2">{t('ai.taste.tastes.bland')}</th>
                        <th className="text-right py-2 px-3">{t('ai.taste.details.weight')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasteResult.contributions.map((contrib, idx) => (
                        <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800">
                          <td className="py-2 px-3 font-medium">{contrib.name}</td>
                          {(Object.keys(contrib.profile) as (keyof typeof contrib.profile)[]).map((taste) => (
                            <td key={taste} className="text-center py-2 px-2">
                              {contrib.profile[taste].toFixed(0)}
                            </td>
                          ))}
                          <td className="text-right py-2 px-3 text-neutral-600">
                            {(contrib.percentage || 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* 优化建议视图 */}
            <TabsContent value="suggestions" className="mt-0">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-warning-500" />
                  {t('ai.taste.suggestions.title')}
                </h3>

                <div className="space-y-3">
                  {tasteResult.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-warning-50 dark:bg-warning-300/20
                                 border border-warning-200 dark:border-warning-800"
                    >
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-warning-200
                                      dark:bg-warning-800 text-warning-800 dark:text-warning-200
                                      flex items-center justify-center text-sm font-bold"
                      >
                        {index + 1}
                      </span>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{suggestion}</p>
                    </div>
                  ))}
                </div>

                {historyResults.length > 0 && (
                  <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      {t('ai.taste.history.title')}
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {historyResults.slice(0, 5).map((result, idx) => (
                        <button
                          key={idx}
                          onClick={() => setTasteResult(result)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800
                                     hover:bg-neutral-200 dark:hover:bg-neutral-700
                                     text-xs whitespace-nowrap transition-colors"
                        >
                          {t('ai.taste.history.score', { index: idx + 1, score: (result.score * 100).toFixed(0) })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default TastePredictTab;
