/**
 * StabilityPredictTab - 稳定性评估模块 (增强版)
 *
 * 从 35% 提升至 70% 的深度开发版本
 * 集成时间序列图、保质期预测算法、因素分析等核心功能
 *
 * 架构设计：
 * - 左侧：输入与参数配置（40%）
 * - 右侧：可视化结果展示（60%）
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import { Input, Button, Card, Select, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import {
  BarChart3,
  Thermometer,
  Droplets,
  Sun,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  TrendingDown,
  Info,
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { stabilityPredictor } from '@/services/stabilityPredictor';
import type { StabilityAssessment, StorageCondition } from '@/types/stability.types';

export function StabilityPredictTab() {
  const [stabilityInput, setStabilityInput] = useState('');
  const [stabilityResult, setStabilityResult] = useState<StabilityAssessment | null>(null);

  const [temperature, setTemperature] = useState<number>(25);
  const [humidity, setHumidity] = useState<number>(60);
  const [lightExposure, setLightExposure] = useState<'dark' | 'ambient' | 'bright'>('ambient');
  const [packaging, setPackaging] = useState<'sealed' | 'semi-permeable' | 'open'>('sealed');

  const mutation = useMutation({
    mutationFn: async (names: string[]) => {
      return await aiApi.stabilityPredict(names.map((name) => ({ name })));
    },
    onSuccess: (data) => {
      const mapped: StabilityAssessment = {
        score: data.stability_score,
        shelfLifeDays: data.estimated_shelf_life_months * 30,
        degradationPathway: data.risk_factors,
        criticalFactors: data.risk_factors,
        storageRecommendations: [data.storage_advice],
        timeSeriesData: data.monthly_curve.map((c) => ({
          time: c.month,
          timeUnit: 'month',
          potency: c.stability,
          // 根据稳定性得分推算杂质含量 (100 - potency) * 0.8
          impurities: Math.min(100, (100 - c.stability) * 80),
        })),
        // 用本地预测器补全 factorContributions
        ...(() => {
          const condition: StorageCondition = { temperature, humidity, lightExposure, packaging };
          const inputNames = stabilityInput.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
          const localResult = stabilityPredictor.predict({
            initialPotency: 100,
            targetPotency: 90,
            storageCondition: condition,
            ingredients: inputNames,
          });
          return { factorContributions: localResult.factorContributions };
        })(),
      };
      setStabilityResult(mapped);
    },
  });

  const handlePredict = useCallback(() => {
    const names = stabilityInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    mutation.mutate(names);
  }, [stabilityInput, temperature, humidity, lightExposure, packaging, mutation]);

  const handleLocalPredict = useCallback(() => {
    const names = stabilityInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const condition: StorageCondition = {
      temperature,
      humidity,
      lightExposure,
      packaging,
    };

    const result = stabilityPredictor.predict({
      initialPotency: 100,
      targetPotency: 90,
      storageCondition: condition,
      ingredients: names,
    });

    setStabilityResult(result);
  }, [stabilityInput, temperature, humidity, lightExposure, packaging]);

  const handleClear = useCallback(() => {
    setStabilityInput('');
    setStabilityResult(null);
  }, []);

  const parsedIngredients = useMemo(() => {
    return stabilityInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [stabilityInput]);

  const formatShelfLife = (days: number): string => {
    if (days >= 365) {
      return `${(days / 365).toFixed(1)} 年`;
    } else if (days >= 30) {
      return `${(days / 30).toFixed(1)} 个月`;
    } else {
      return `${Math.round(days)} 天`;
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* 左侧：输入控制面板 */}
      <div className="col-span-4 space-y-4">
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-secondary-500" />
              稳定性评估
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              预测配方的化学稳定性和保质期。基于 Arrhenius 方程和 Q10 法则。
            </p>
          </div>

          {/* 输入框 */}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">配方成分</label>
            <textarea
              value={stabilityInput}
              onChange={(e) => setStabilityInput(e.target.value)}
              placeholder={`如:\n黄芪\n党参\n枸杞子\n甘草`}
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600
                         rounded-lg text-sm bg-white dark:bg-neutral-800
                         focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 储存条件配置 */}
          <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              储存条件
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-600 mb-1 block">温度 (°C)</label>
                <Select value={String(temperature)} onChange={(e) => setTemperature(Number(e.target.value))}>
                  {[4, 15, 25, 30, 37].map((t) => (
                    <option key={t} value={String(t)}>
                      {t}°C
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs text-neutral-600 mb-1 block">湿度 (%)</label>
                <Select value={String(humidity)} onChange={(e) => setHumidity(Number(e.target.value))}>
                  {[30, 45, 60, 75, 90].map((h) => (
                    <option key={h} value={String(h)}>
                      {h}%
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-600 mb-1 block">光照</label>
                <Select value={lightExposure} onChange={(e) => setLightExposure(e.target.value as 'dark' | 'ambient' | 'bright')}>
                  <option value="dark">避光</option>
                  <option value="ambient">正常</option>
                  <option value="bright">强光</option>
                </Select>
              </div>

              <div>
                <label className="text-xs text-neutral-600 mb-1 block">包装</label>
                <Select value={packaging} onChange={(e) => setPackaging(e.target.value as 'sealed' | 'semi-permeable' | 'open')}>
                  <option value="sealed">密封</option>
                  <option value="semi-permeable">半透膜</option>
                  <option value="open">开放</option>
                </Select>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleLocalPredict}
              disabled={!stabilityInput.trim()}
              icon={<BarChart3 className="w-4 h-4" />}
              variant="outline"
              className="flex-1"
            >
              本地计算
            </Button>
            <Button
              onClick={handlePredict}
              disabled={!stabilityInput.trim() || mutation.isPending}
              loading={mutation.isPending}
              icon={<TrendingDown className="w-4 h-4" />}
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

        {/* 条件摘要卡片 */}
        {(parsedIngredients.length > 0 || stabilityResult) && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">当前评估条件</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-600">
                  <Thermometer className="w-4 h-4" /> 温度
                </span>
                <Badge variant={temperature > 30 ? 'danger' : temperature > 25 ? 'warning' : 'success'}>
                  {temperature}°C
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-600">
                  <Droplets className="w-4 h-4" /> 湿度
                </span>
                <Badge variant={humidity > 70 ? 'danger' : humidity > 60 ? 'warning' : 'success'}>{humidity}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-600">
                  <Sun className="w-4 h-4" /> 光照
                </span>
                <Badge variant={lightExposure === 'bright' ? 'warning' : 'success'}>
                  {lightExposure === 'dark' ? '避光' : lightExposure === 'ambient' ? '正常' : '强光'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-neutral-600">
                  <Package className="w-4 h-4" /> 包装
                </span>
                <Badge
                  variant={packaging === 'open' ? 'danger' : packaging === 'semi-permeable' ? 'warning' : 'success'}
                >
                  {packaging === 'sealed' ? '密封' : packaging === 'semi-permeable' ? '半透膜' : '开放'}
                </Badge>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 右侧：可视化结果展示 */}
      <div className="col-span-8">
        {!stabilityResult ? (
          <Card
            className="h-full flex items-center justify-center bg-gradient-to-br
                           from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-slate-900"
          >
            <div className="text-center space-y-3 p-8">
              <BarChart3 className="w-16 h-16 mx-auto text-secondary-300 dark:text-secondary-600" />
              <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">等待输入配方...</h3>
              <p className="text-sm text-neutral-500 max-w-md">
                在左侧输入成分名称并配置储存条件后，点击"本地计算"或"AI 分析"按钮，
                此处将显示稳定性评分、保质期预测和时间序列分析。
              </p>
            </div>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" icon={<Info className="w-4 h-4" />}>
                总览
              </TabsTrigger>
              <TabsTrigger value="timeseries" icon={<TrendingDown className="w-4 h-4" />}>
                时间序列
              </TabsTrigger>
              <TabsTrigger value="factors" icon={<AlertTriangle className="w-4 h-4" />}>
                因素分析
              </TabsTrigger>
              <TabsTrigger value="recommendations" icon={<CheckCircle2 className="w-4 h-4" />}>
                建议
              </TabsTrigger>
            </TabsList>

            {/* 总览视图 */}
            <TabsContent value="overview" className="mt-0">
              <Card className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* 稳定性评分 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">稳定性评分</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-secondary-600">{stabilityResult.score.toFixed(0)}</span>
                      <span className="text-xl text-neutral-500">/100</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          stabilityResult.score >= 80
                            ? 'bg-success-500'
                            : stabilityResult.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-error-500'
                        }`}
                        style={{ width: `${stabilityResult.score}%` }}
                      />
                    </div>
                    <p className="text-sm text-neutral-600">
                      {stabilityResult.score >= 80
                        ? '✅ 稳定性良好，适合长期储存'
                        : stabilityResult.score >= 60
                          ? '⚠️ 稳定性一般，建议优化储存条件'
                          : '❌ 稳定性较差，需立即改善储存环境'}
                    </p>
                  </div>

                  {/* 保质期预测 */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      预测保质期
                    </h3>
                    <div className="text-4xl font-bold text-accent-600">
                      {formatShelfLife(stabilityResult.shelfLifeDays)}
                    </div>
                    <p className="text-sm text-neutral-600">基于当前储存条件和 Arrhenius 动力学模型计算</p>
                  </div>
                </div>

                {/* 关键影响因素 */}
                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <h4 className="font-semibold mb-3">关键影响因素</h4>
                  <div className="flex flex-wrap gap-2">
                    {stabilityResult.criticalFactors.map((factor, idx) => (
                      <Badge
                        key={idx}
                        variant={factor.includes('加速') || factor.includes('促进') ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {factor}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* 时间序列视图 */}
            <TabsContent value="timeseries" className="mt-0">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">有效成分含量变化趋势</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={stabilityResult.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      label={{ value: '时间 (天)', position: 'insideBottomRight', offset: -10 }}
                      tickFormatter={(value) => (value >= 30 ? `${(value / 30).toFixed(0)}月` : `${value}天`)}
                    />
                    <YAxis domain={[0, 105]} label={{ value: '含量 (%)', angle: -90, position: 'insideLeft' }} />
                    <RechartsTooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, '有效成分']}
                      labelFormatter={(value: any) => {
                        const numValue = Number(value);
                        return numValue >= 30 ? `${(numValue / 30).toFixed(1)} 个月` : `${numValue} 天`;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="potency"
                      stroke="#007AFF"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 6 }}
                      name="有效成分 (%)"
                    />
                    <Line
                      type="monotone"
                      dataKey="impurities"
                      stroke="#FF3B30"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="杂质 (ppm)"
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-secondary-500 rounded-full" />
                    <span>有效成分含量</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 bg-error-500 rounded-full"
                      style={{
                        background: 'repeating-linear-gradient(45deg, #FF3B30, #FF3B30 2px, white 2px, white 4px)',
                      }}
                    />
                    <span>杂质累积</span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* 因素分析视图 */}
            <TabsContent value="factors" className="mt-0">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">各因素贡献度分析</h3>
                <div className="space-y-4">
                  {stabilityResult.factorContributions.map((contrib, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{contrib.factor}</span>
                        <Badge variant={contrib.impact > 2 ? 'danger' : contrib.impact > 1.2 ? 'warning' : 'success'}>
                          影响系数: {contrib.impact.toFixed(2)}x
                        </Badge>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            contrib.impact > 2 ? 'bg-error-500' : contrib.impact > 1.2 ? 'bg-yellow-500' : 'bg-success-500'
                          }`}
                          style={{
                            width: `${Math.min((contrib.impact / 4) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm text-neutral-600">{contrib.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* 建议视图 */}
            <TabsContent value="recommendations" className="mt-0">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success-500" />
                  储存优化建议
                </h3>

                <div className="space-y-3">
                  {stabilityResult.storageRecommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-success-50 dark:bg-success-900/20
                                 border border-green-200 dark:border-green-800"
                    >
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-success-200
                                      dark:bg-success-800 text-success-800 dark:text-success-200
                                      flex items-center justify-center text-sm font-bold"
                      >
                        {index + 1}
                      </span>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{rec}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <h4 className="font-semibold text-sm mb-2">降解途径说明</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {stabilityResult.degradationPathway.map((pathway, idx) => (
                      <div key={idx} className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded">
                        • {pathway}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default StabilityPredictTab;
