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
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import { Input, Button, Card, Select, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Cherry, FlaskConical, BarChart3, Table2, Lightbulb, RotateCcw, Download, History } from 'lucide-react';

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

export function TastePredictTab() {
  const [tasteInput, setTasteInput] = useState('');
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
  const [processingMethod, setProcessingMethod] = useState<string>('');
  const [algorithmMode, setAlgorithmMode] = useState<'weighted' | 'synergy'>('weighted');
  const [tasteResult, setTasteResult] = useState<TastePrediction | null>(null);
  const [historyResults, setHistoryResults] = useState<TastePrediction[]>([]);

  const mutation = useMutation({
    mutationFn: async (names: string[]) => {
      return await aiApi.tastePredict(names.map((name) => ({ name })));
    },
    onSuccess: (data) => {
      const mapped: TastePrediction = {
        score: data.overall_score,
        dominantTaste:
          data.sweetness >= data.bitterness && data.sweetness >= data.astringency
            ? FiveTastes.SWEET
            : data.bitterness >= data.astringency
              ? FiveTastes.BITTER
              : FiveTastes.SOUR,
        dominantIntensity: Math.max(data.sweetness, data.bitterness, data.astringency),
        profile: {
          sweet: data.sweetness,
          sour: 0,
          bitter: data.bitterness,
          pungent: data.pungency ?? 0,
          salty: data.saltiness ?? 0,
          bland: 0,
        },
        features: data.flavor_notes,
        suggestions: [],
        description: '',
        contributions: [],
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
      {/* 左侧：输入控制面板 */}
      <div className="col-span-4 space-y-4">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Cherry className="w-5 h-5 text-error-500" />
              口感预测
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              输入药材名称，用逗号或换行分隔。支持本地快速预测和 AI 深度分析。
            </p>
          </div>

          {/* 输入框 */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">药材配方</label>
            <textarea
              value={tasteInput}
              onChange={(e) => setTasteInput(e.target.value)}
              placeholder={`如:\n黄芪\n党参\n枸杞子\n山药\n甘草`}
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600
                         rounded-lg text-sm bg-white dark:bg-neutral-800
                         focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 参数配置 */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">
                炮制方法（可选）
              </label>
              <Select
                value={processingMethod}
                onChange={(e) => setProcessingMethod(e.target.value)}
                placeholder="选择炮制方法..."
              >
                <option value="">无</option>
                {PROCESSING_METHODS.map((method) => (
                  <option key={method.name} value={method.name}>
                    {method.name} - {method.description}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">算法模式</label>
              <Select value={algorithmMode} onChange={(e) => setAlgorithmMode(e.target.value}>
                <option value="weighted">加权平均（快速）</option>
                <option value="synergy">协同分析（中等）</option>
              </Select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleLocalPredict}
              disabled={!tasteInput.trim()}
              icon={<FlaskConical className="w-4 h-4" />}
              variant="outline"
              className="flex-1"
            >
              本地预测
            </Button>
            <Button
              onClick={handlePredict}
              disabled={!tasteInput.trim() || mutation.isPending}
              loading={mutation.isPending}
              icon={<Cherry className="w-4 h-4" />}
              className="flex-1"
            >
              AI 分析
            </Button>
          </div>

          <Button
            onClick={handleClear}
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            className="w-full"
          >
            清空重置
          </Button>
        </Card>

        {/* 成分预览卡片 */}
        {ingredientProfiles.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Table2 className="w-4 h-4" />
              成分列表 ({ingredientProfiles.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ingredientProfiles.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg
                             bg-slate-50 dark:bg-neutral-800/50 text-sm"
                >
                  <span className="font-medium">{item.name}</span>
                  <Badge variant={item.hasData ? 'success' : 'warning'} size="sm">
                    {item.hasData ? '有数据' : '待补充'}
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
                           from-red-50 to-orange-50 dark:from-slate-800 dark:to-slate-900"
          >
            <div className="text-center space-y-3 p-8">
              <Cherry className="w-16 h-16 mx-auto text-error-300 dark:text-error-600" />
              <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">等待输入配方...</h3>
              <p className="text-sm text-neutral-500 max-w-md">
                在左侧输入药材名称后，点击"本地预测"或"AI 分析"按钮， 此处将显示五味分布、口感评分和优化建议。
              </p>
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="wheel" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="wheel" icon={<BarChart3 className="w-4 h-4" />}>
                风味轮
              </TabsTrigger>
              <TabsTrigger value="radar" icon={<BarChart3 className="w-4 h-4" />}>
                雷达图
              </TabsTrigger>
              <TabsTrigger value="details" icon={<Table2 className="w-4 h-4" />}>
                详细数据
              </TabsTrigger>
              <TabsTrigger value="suggestions" icon={<Lightbulb className="w-4 h-4" />}>
                优化建议
              </TabsTrigger>
            </TabsList>

            {/* 风味轮视图 */}
            <TabsContent value="wheel" className="mt-0">
              <Card className="p-6">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <FlavorWheel data={tasteResult.profile} size={320} />

                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">综合评分</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-bold text-secondary-600">{(tasteResult.score * 100).toFixed(0)}</span>
                        <span className="text-neutral-500">/ 100</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-2">{tasteResult.description}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">主导口味</h4>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: FIVE_TASTES_COLORS[tasteResult.dominantTaste],
                          }}
                        />
                        <span className="font-medium">{FIVE_TASTES_LABELS[tasteResult.dominantTaste]}</span>
                        <span className="text-neutral-500">({tasteResult.dominantIntensity.toFixed(1)})</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">口感特征</h4>
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
                            label: '历史记录 #1',
                            data: historyResults[0].profile,
                            color: '#34C759',
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
                <h3 className="font-semibold mb-4">成分贡献分析</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left py-2 px-3">成分</th>
                        <th className="text-center py-2 px-2">甘</th>
                        <th className="text-center py-2 px-2">酸</th>
                        <th className="text-center py-2 px-2">苦</th>
                        <th className="text-center py-2 px-2">辛</th>
                        <th className="text-center py-2 px-2">咸</th>
                        <th className="text-center py-2 px-2">淡</th>
                        <th className="text-right py-2 px-3">权重</th>
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
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  优化建议
                </h3>

                <div className="space-y-3">
                  {tasteResult.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20
                                 border border-yellow-200 dark:border-yellow-800"
                    >
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-200
                                      dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200
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
                      历史记录
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
                          #{idx + 1} 分数:{(result.score * 100).toFixed(0)}
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
