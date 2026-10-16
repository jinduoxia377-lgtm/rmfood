import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import type { AICandidate, AdvancedGenerateResponse } from '@/api/ai';
import { useGenerationProgress } from '@/hooks/useGenerationProgress';
import { GenerationProgressPanel } from './GenerationProgressPanel';
import { Card, Input, Button, Slider, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Sparkles, Sliders, Tag, Shield, Cherry, AlertTriangle, CheckCircle, X } from 'lucide-react';

const EFFECT_OPTIONS = ['降血压', '抗氧化', '降血糖', '补气养阴', '抗疲劳', '改善睡眠', '增强免疫'];

const INGREDIENT_TYPE_OPTIONS = ['药食同源', '活性肽'];

const TASTE_OPTIONS = ['甜', '苦', '涩', '鲜'];

const SAFETY_LEVEL_OPTIONS = ['常规', '孕妇可用', '儿童可用', '老年适用'];

interface Constraints {
  maxIngredients?: number;
  excludedIngredients?: string[];
  ingredientTypes?: string[];
  tastePreferences?: string[];
  safetyLevel?: string;
}

interface AdvancedGeneratePanelProps {
  onCandidatesGenerated?: (candidates: AICandidate[]) => void;
  className?: string;
}

export function AdvancedGeneratePanel({ onCandidatesGenerated, className }: AdvancedGeneratePanelProps) {
  const [inputMode, setInputMode] = useState<'direct' | 'tag'>('tag');
  const [directInput, setDirectInput] = useState('');
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedIngredientTypes, setSelectedIngredientTypes] = useState<string[]>([]);
  const [selectedTastes, setSelectedTastes] = useState<string[]>([]);
  const [selectedSafetyLevel, setSelectedSafetyLevel] = useState<string>('');
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [excludedInput, setExcludedInput] = useState('');
  const [maxIngredients, setMaxIngredients] = useState(10);
  const [candidates, setCandidates] = useState<AICandidate[] | null>(null);
  const [data, setData] = useState<AdvancedGenerateResponse | null>(null);
  const [priorityValues, setPriorityValues] = useState<Record<string, number>>({
    synergy: 0.7,
    taste: 0.5,
    stability: 0.6,
    safety: 0.8,
  });

  const { progress, startProgress, updateProgress, completeProgress, errorProgress, resetProgress } =
    useGenerationProgress();
  const [announcement, setAnnouncement] = useState('');
  const generateButtonRef = useRef<HTMLButtonElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      startProgress('正在准备生成参数...');

      const targetEffects =
        inputMode === 'direct'
          ? directInput
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : selectedEffects;

      const constraints: Constraints = {
        maxIngredients,
        excludedIngredients: excludedIngredients.length > 0 ? excludedIngredients : undefined,
        ingredientTypes: selectedIngredientTypes.length > 0 ? selectedIngredientTypes : undefined,
        tastePreferences: selectedTastes.length > 0 ? selectedTastes : undefined,
        safetyLevel: selectedSafetyLevel || undefined,
      };

      updateProgress('generating', 30, '遗传算法正在生成配方方案...', 15);

      const result = await aiApi.generateAdvanced(targetEffects, priorityValues, constraints, 5);

      updateProgress('optimizing', 60, '正在优化配方参数...', 10);

      updateProgress('validating', 80, '正在进行安全性验证...', 5);

      return result;
    },
    onSuccess: (data) => {
      completeProgress();
      setCandidates(data.candidates);
      setData(data);
      onCandidatesGenerated?.(data.candidates);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error && typeof error.message === 'string' ? error.message : '配方生成失败，请稍后重试';
      errorProgress(errorMessage);
    },
  });

  useEffect(() => {
    if (mutation.isPending) {
      setAnnouncement('开始生成配方，请稍候...');
    }
  }, [mutation.isPending]);

  useEffect(() => {
    if (mutation.isSuccess) {
      setAnnouncement('配方生成成功');
    } else if (mutation.isError) {
      setAnnouncement('配方生成失败，请检查输入后重试');
    }
  }, [mutation.isSuccess, mutation.isError]);

  const toggleEffect = (effect: string) => {
    setSelectedEffects((prev) => (prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect]));
  };

  const handleEffectKeyDown = (e: React.KeyboardEvent, effect: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleEffect(effect);
    }
  };

  const handleIngredientTypeKeyDown = (e: React.KeyboardEvent, type: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleIngredientType(type);
    }
  };

  const handleTasteKeyDown = (e: React.KeyboardEvent, taste: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTaste(taste);
    }
  };

  const handleSafetyLevelKeyDown = (e: React.KeyboardEvent, level: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedSafetyLevel(level === selectedSafetyLevel ? '' : level);
    }
  };

  const toggleIngredientType = (type: string) => {
    setSelectedIngredientTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const toggleTaste = (taste: string) => {
    setSelectedTastes((prev) => (prev.includes(taste) ? prev.filter((t) => t !== taste) : [...prev, taste]));
  };

  const addExcludedIngredient = () => {
    const items = excludedInput
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 0) {
      setExcludedIngredients((prev) => [...new Set([...prev, ...items])]);
      setExcludedInput('');
    }
  };

  const removeExcludedIngredient = (item: string) => {
    setExcludedIngredients((prev) => prev.filter((i) => i !== item));
  };

  const handlePriorityChange = (key: string, value: number) => {
    setPriorityValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    mutation.reset();
    resetProgress();
  };

  const canGenerate = inputMode === 'direct' ? directInput.trim().length > 0 : selectedEffects.length > 0;

  return (
    <Card className={`p-6 ${className}`}>
      <span className="sr-only" id="neural-panel-description">
        高级配方优化面板，基于遗传算法多目标优化智能生成配方方案
      </span>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-300/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">高级配方优化生成</h2>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">基于遗传算法多目标优化生成配方方案</p>
        </div>
      </div>

      <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'direct' | 'tag')}>
        <TabsList className="mb-6">
          <TabsTrigger value="tag" icon={<Tag className="w-4 h-4" />}>
            标签选择
          </TabsTrigger>
          <TabsTrigger value="direct" icon={<Sliders className="w-4 h-4" />}>
            直接输入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tag" className="space-y-6">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">
                功效标签（可多选）
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="功效标签选择">
                {EFFECT_OPTIONS.map((effect) => (
                  <button
                    key={effect}
                    onClick={() => toggleEffect(effect)}
                    onKeyDown={(e) => handleEffectKeyDown(e, effect)}
                    role="checkbox"
                    aria-checked={selectedEffects.includes(effect)}
                    aria-label={`功效: ${effect}`}
                    tabIndex={0}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      selectedEffects.includes(effect)
                        ? 'bg-primary-container text-primary-main shadow-sm shadow-primary-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    {effect}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">成分类型</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="成分类型选择">
                {INGREDIENT_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleIngredientType(type)}
                    onKeyDown={(e) => handleIngredientTypeKeyDown(e, type)}
                    role="checkbox"
                    aria-checked={selectedIngredientTypes.includes(type)}
                    aria-label={`成分类型: ${type}`}
                    tabIndex={0}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 ${
                      selectedIngredientTypes.includes(type)
                        ? 'bg-accent-container text-accent-main shadow-sm shadow-accent-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">口感偏好</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="口感偏好选择">
                {TASTE_OPTIONS.map((taste) => (
                  <button
                    key={taste}
                    onClick={() => toggleTaste(taste)}
                    onKeyDown={(e) => handleTasteKeyDown(e, taste)}
                    role="checkbox"
                    aria-checked={selectedTastes.includes(taste)}
                    aria-label={`口感: ${taste}`}
                    tabIndex={0}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-2 ${
                      selectedTastes.includes(taste)
                        ? 'bg-warning-500 text-white shadow-sm shadow-warning-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    <Cherry className="w-3 h-3 inline mr-1" />
                    {taste}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">安全等级</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="安全等级选择">
                {SAFETY_LEVEL_OPTIONS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelectedSafetyLevel(level === selectedSafetyLevel ? '' : level)}
                    onKeyDown={(e) => handleSafetyLevelKeyDown(e, level)}
                    role="checkbox"
                    aria-checked={selectedSafetyLevel === level}
                    aria-label={`安全等级: ${level}`}
                    tabIndex={0}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 ${
                      selectedSafetyLevel === level
                        ? 'bg-success-500 text-white shadow-sm shadow-success-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    <Shield className="w-3 h-3 inline mr-1" />
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="direct">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-2">
                输入目标功效描述
              </label>
              <textarea
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                placeholder="例如：降血糖、抗疲劳、补气养阴"
                className="input resize-none w-full"
                rows={3}
              />
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">多个功效用逗号分隔</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">优先级权重调节</label>
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">调整各项权重影响配方生成倾向</span>
          </div>
          <div className="space-y-4">
            {[
              { key: 'synergy', label: '协同效应', color: 'primary' },
              { key: 'taste', label: '口感偏好', color: 'accent' },
              { key: 'stability', label: '稳定性', color: 'warning' },
              { key: 'safety', label: '安全性', color: 'success' },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</span>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {(priorityValues[item.key] * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={priorityValues[item.key]}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) => handlePriorityChange(item.key, value)}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-3">约束条件</label>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">最大成分数</span>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{maxIngredients}</span>
              </div>
              <Slider
                value={maxIngredients}
                min={3}
                max={20}
                step={1}
                onChange={(value) => setMaxIngredients(value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm text-neutral-600 dark:text-neutral-400 block mb-2">排除成分</label>
              <div className="flex gap-2">
                <Input
                  value={excludedInput}
                  onChange={(e) => setExcludedInput(e.target.value)}
                  placeholder="输入要排除的成分，多个用逗号分隔"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addExcludedIngredient();
                    }
                  }}
                />
                <Button variant="secondary" size="sm" onClick={addExcludedIngredient}>
                  添加
                </Button>
              </div>
              {excludedIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {excludedIngredients.map((item) => (
                    <Badge key={item} variant="danger" className="flex items-center gap-1">
                      {item}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-danger-600"
                        onClick={() => removeExcludedIngredient(item)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {progress.stage !== 'idle' && (
          <GenerationProgressPanel progress={progress} onCancel={handleCancel} showCancelButton={progress.canCancel} />
        )}
        <Button
          ref={generateButtonRef}
          disabled={!canGenerate || mutation.isPending}
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          icon={<Sparkles className="w-4 h-4" />}
          className="w-full"
          aria-describedby="generate-button-hint"
        >
          {mutation.isPending ? '生成中...' : '开始生成'}
        </Button>
        <span id="generate-button-hint" className="sr-only">
          {canGenerate ? '点击或回车生成配方' : '请先选择功效标签或输入功效描述'}
        </span>
      </div>

      {mutation.isError && (
        <div className="mt-4 p-4 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-danger-600 dark:text-danger-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              生成失败：
              {mutation.error instanceof Error && typeof mutation.error.message === 'string'
                ? mutation.error.message
                : '请检查输入后重试'}
            </span>
          </div>
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <section className="mt-6 space-y-4" aria-labelledby="candidates-heading">
          <div className="flex items-center justify-between">
            <h3 id="candidates-heading" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              生成 {candidates.length} 个候选方案
            </h3>
            <Badge variant="primary">
              {data?.generator === 'ga_optimizer'
                ? '遗传算法优化'
                : data?.generator === 'rule_engine_fallback'
                  ? '规则引擎生成'
                  : 'AI 优化生成'}
            </Badge>
          </div>
          <ul className="space-y-4" role="list" aria-label="配方候选方案列表">
            {candidates.map((candidate, index) => (
              <li key={index}>
                <Card hoverable className="p-4 border border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方'}
                      </h4>
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                        协同 {(candidate.synergy_score ?? 0).toFixed(2)} | 口感{' '}
                        {(candidate.taste_score ?? 0).toFixed(2)} | 稳定性 {(candidate.stability_score ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xl font-bold ${
                          (candidate.overall_score ?? 0) >= 0.8
                            ? 'text-success-500'
                            : (candidate.overall_score ?? 0) >= 0.6
                              ? 'text-warning-500'
                              : 'text-danger-500'
                        }`}
                      >
                        {(candidate.overall_score ?? 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">综合评分</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="text-xs font-medium text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">药材组成：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {candidate.herb_combination?.map((herb, i) => (
                        <Badge key={i} variant="neutral" size="sm">
                          {typeof herb.name === 'string' ? herb.name : '未知药材'}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" role="status" aria-label="安全状态">
                    {candidate.safety_passed ? (
                      <Badge variant="success" className="flex items-center gap-1" role="img" aria-label="安全验证通过">
                        <CheckCircle className="w-3 h-3" />
                        安全
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="flex items-center gap-1" role="img" aria-label="需要注意">
                        <AlertTriangle className="w-3 h-3" />
                        需关注
                      </Badge>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

export default AdvancedGeneratePanel;
