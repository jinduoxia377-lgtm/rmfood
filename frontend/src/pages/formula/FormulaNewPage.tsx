/**
 * 新建配方页 — Phase 6 专业增强版
 * 成分用量管理 + 拖拽排序 + 配方实时预览 + 表单验证增强
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  X,
  Leaf,
  GripVertical,
  Eye,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Beaker,
  RefreshCw,
  FlaskConical,
} from 'lucide-react';
import { useAIRecommendations } from '@/hooks/useQueries';
import {
  Button,
  Input,
  Textarea,
  PageHeader,
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  Modal,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/safeLogger';
import { databaseApi } from '@/api/database';
import { formulaApi } from '@/api/formula';
import { validateFullFormula, getErrorMessage } from '@/utils/formulaValidator';
import type { TCMHerb } from '@/types';
import type { FieldValidationError } from '@/types/formula';
import { useOperationLogger } from '@/utils/operationLogger';
import { FormulaFormSkeleton } from './components/FormulaFormSkeleton';

// ── 成分项类型 ──
interface IngredientItem {
  id: number;
  name: string;
  category: string;
  is_food_homology: boolean;
  dosage_amount: string;
  dosage_unit: string;
  role: string;
  notes: string;
}

const ROLE_OPTIONS = [
  { value: '', label: '未指定' },
  { value: '君', label: '君（主药）' },
  { value: '臣', label: '臣（辅药）' },
  { value: '佐', label: '佐（佐药）' },
  { value: '使', label: '使（引经药）' },
  { value: '辅料', label: '辅料' },
];

const DOSAGE_UNIT_OPTIONS = ['g', 'mg', 'mL', '片', '粒', '适量'];

const EMPTY_INGREDIENT: Omit<IngredientItem, 'id' | 'name' | 'category' | 'is_food_homology'> = {
  dosage_amount: '',
  dosage_unit: 'g',
  role: '',
  notes: '',
};

function getFieldError(errors: FieldValidationError[], field: string): string | null {
  const err = errors.find((e) => e.field === field || e.field.startsWith(`${field}[`) || e.field === `${field}.0`);
  return err?.message ?? null;
}

export default function FormulaNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const firstErrorRef = useRef<HTMLDivElement>(null);

  // 表单状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dosage, setDosage] = useState('');
  const [processingMethod, setProcessingMethod] = useState('');
  const [storageConditions, setStorageConditions] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [effects, setEffects] = useState<string[]>([]);
  const [effectInput, setEffectInput] = useState('');
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [herbSearch, setHerbSearch] = useState('');
  const [showHerbSearch, setShowHerbSearch] = useState(false);

  // AI 推荐
  const [showRecommendations, setShowRecommendations] = useState(false);
  const { data: recData, isLoading: recLoading } = useAIRecommendations(
    effects,
    showRecommendations && effects.length > 0,
  );

  // 预览
  const [showPreview, setShowPreview] = useState(false);

  // 表单验证 — 结构化错误
  const [fieldErrors, setFieldErrors] = useState<FieldValidationError[]>([]);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // ── 实时分析状态 ──
  const [previewAnalysis, setPreviewAnalysis] = useState<{
    synergy?: any;
    stability?: any;
    taste?: any;
    safety?: any;
    isRunning?: boolean;
  }>({ isRunning: false });

  // ── 实时分析 ──
  useEffect(() => {
    if (ingredients.length < 2) return;
    const timer = setTimeout(async () => {
      setPreviewAnalysis(prev => ({ ...prev, isRunning: true }));
      try {
        const { formulaApi } = await import('@/api/formula');
        const [synergy, stability, taste, safety] = await Promise.all([
          formulaApi.analyzeFormulaSynergy(0).catch(() => null),
          formulaApi.predictFormulaStability(0).catch(() => null),
          formulaApi.predictFormulaTaste(0).catch(() => null),
          formulaApi.checkFormulaSafety(0).catch(() => null),
        ]);
        setPreviewAnalysis({ synergy, stability, taste, safety, isRunning: false });
      } catch (e) {
        setPreviewAnalysis(prev => ({ ...prev, isRunning: false }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [ingredients]);

  // 成分总重量计算
  const totalWeight = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      const num = parseFloat(ing.dosage_amount);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [ingredients]);

  // 表单完整性检查
  const formCompleteness = useMemo(() => {
    let filled = 0;
    const total = 7;
    if (name.trim()) filled++;
    if (description.trim()) filled++;
    if (effects.length > 0) filled++;
    if (ingredients.length >= 2) filled++;
    if (ingredients.every((i) => i.dosage_amount.trim())) filled++;
    if (dosage.trim()) filled++;
    if (processingMethod.trim()) filled++;
    return { filled, total, percent: Math.round((filled / total) * 100) };
  }, [name, description, effects, ingredients, dosage, processingMethod]);

  // ── 字段级验证（blur 时触发）──
  const validateField = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
    const data = buildValidationData();
    const result = validateFullFormula(data);
    const fieldErr = getFieldError(result.errors, field);
    if (fieldErr) {
      setFieldErrors((prev) => {
        const filtered = prev.filter((e) => e.field !== field && !e.field.startsWith(`${field}[`));
        return [...filtered, ...result.errors.filter((e) => e.field === field || e.field.startsWith(`${field}[`))];
      });
    } else {
      setFieldErrors((prev) => prev.filter((e) => e.field !== field && !e.field.startsWith(`${field}[`)));
    }
    return !fieldErr;
  };

  // ── 全量验证（提交时触发）──
  const validateAll = (): boolean => {
    const data = buildValidationData();
    const result = validateFullFormula(data);
    setFieldErrors(result.errors);
    setTouchedFields(new Set(['name', 'ingredients', 'effects', 'dosage', 'description']));

    if (!result.valid && result.errors.length > 0) {
      const firstField = result.errors[0].field.replace(/\[.*\]/g, '').split('.')[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstField}"]`);
        if (el instanceof HTMLElement) el.focus();
      }, 50);
    }

    return result.valid;
  };

  // ── 构建验证数据 ──
  const buildValidationData = () => ({
    name,
    description,
    effects,
    ingredients: ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.dosage_amount ? parseFloat(ing.dosage_amount) : undefined,
      unit: ing.dosage_unit,
      role: ing.role || undefined,
    })),
  });

  // ── 清除单个字段错误 ──
  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => prev.filter((e) => e.field !== field && !e.field.startsWith(`${field}[`)));
    setNetworkError(null);
  };

  const addEffect = () => {
    const trimmed = effectInput.trim();
    if (trimmed && !effects.includes(trimmed) && effects.length < 5) {
      setEffects([...effects, trimmed]);
      setEffectInput('');
      clearFieldError('effects');
    }
  };

  const removeEffect = (idx: number) => {
    setEffects(effects.filter((_, i) => i !== idx));
    clearFieldError('effects');
  };

  // ── 提交处理（完整流程）──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkError(null);

    if (!validateAll()) return;

    setIsSubmitting(true);
    try {
      const formula = await formulaApi.create({
        name,
        description: description || undefined,
        effects: effects.length > 0 ? effects : undefined,
        dosage: dosage || undefined,
        processing_method: processingMethod || undefined,
        storage_conditions: storageConditions || undefined,
        shelf_life: shelfLife ? Number(shelfLife) : undefined,
        composition: {
          ingredients: ingredients.map((ing) => ({
            name: ing.name,
            category: ing.category,
            is_food_homology: ing.is_food_homology,
            id: ing.id,
            dosage: ing.dosage_amount ? `${ing.dosage_amount}${ing.dosage_unit}` : undefined,
            role: ing.role || undefined,
            notes: ing.notes || undefined,
          })),
        },
      });
      toast.success('配方创建成功');

      logger.info('配方创建成功', {
        action: 'create',
        target_type: 'formula',
        target_id: String(formula.id),
        target_name: name,
        details: {
          metadata: { ingredient_count: ingredients.length, effects },
        },
        result: 'success',
      });

      navigate(`/formulas/${formula.id}`);
    } catch (err: unknown) {
      handleSubmissionError(err);

      logger.error('配方创建失败', {
        action: 'create',
        target_type: 'formula',
        target_id: 'new',
        target_name: name,
        result: 'failure',
        error_message: err instanceof Error ? err.message : '创建配方失败',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 统一错误处理 ──
  const handleSubmissionError = (err: unknown) => {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { status?: number; data?: unknown } };
      const status = axiosErr.response?.status;
      const data = axiosErr.response?.data as Record<string, any> | undefined;

      if (status === 400 && data) {
        const mappedErrors: FieldValidationError[] = [];
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            data.detail.forEach((d: any) => {
              mappedErrors.push({
                field: d.loc?.join('.') ?? d.field ?? 'unknown',
                message: d.msg ?? d.message ?? '字段验证失败',
                code: d.type ?? 'INVALID_FORMAT',
              });
            });
          } else if (typeof data.detail === 'string') {
            mappedErrors.push({ field: '_global', message: data.detail, code: 'INVALID_FORMAT' });
          }
        } else if (typeof data === 'object') {
          Object.entries(data).forEach(([key, val]) => {
            if (key !== 'detail' && typeof val === 'string') {
              mappedErrors.push({ field: key, message: val, code: 'INVALID_FORMAT' });
            }
          });
        }
        if (mappedErrors.length > 0) {
          setFieldErrors(mappedErrors);
          return;
        }
      }

      if (status === 409) {
        setFieldErrors([{ field: 'name', message: '该配方名称已存在，请使用其他名称', code: 'DUPLICATE_NAME' }]);
        return;
      }
    }

    if (err instanceof Error) {
      if (err.message.includes('network') || err.message.includes('Network') || err.message.includes('fetch')) {
        setNetworkError('网络连接失败，请检查网络后重试');
        return;
      }
    }

    setNetworkError('创建配方失败，请稍后重试');
  };

  // ── 重试提交 ──
  const handleRetry = () => {
    setNetworkError(null);
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const addHerbToIngredients = (herb: TCMHerb) => {
    if (ingredients.some((i) => i.id === herb.id)) return;
    setIngredients([
      ...ingredients,
      {
        id: herb.id,
        name: herb.name,
        category: herb.category || '未分类',
        is_food_homology: herb.is_food_homology ?? false,
        ...EMPTY_INGREDIENT,
      },
    ]);
    setHerbSearch('');
    setShowHerbSearch(false);
    clearFieldError('ingredients');
  };

  const removeIngredient = (id: number) => {
    setIngredients(ingredients.filter((i) => i.id !== id));
  };

  // 成分排序
  const moveIngredient = (index: number, direction: 'up' | 'down') => {
    const newIngredients = [...ingredients];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIngredients.length) return;
    [newIngredients[index], newIngredients[targetIndex]] = [newIngredients[targetIndex], newIngredients[index]];
    setIngredients(newIngredients);
  };

  // 更新单个成分字段
  const updateIngredient = (id: number, field: keyof IngredientItem, value: string) => {
    setIngredients(ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  // ── 渲染字段错误的辅助组件 ──
  const FieldErrorText = ({ field }: { field: string }) => {
    const msg = getFieldError(fieldErrors, field);
    if (!msg) return null;
    return (
      <p className="text-xs text-error-500 mt-1 flex items-center gap-1">
        <AlertCircle size={12} className="shrink-0" />
        {msg}
      </p>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
      {/* 顶部导航 + 完成度 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">返回列表</span>
          <span className="sm:hidden">返回</span>
        </button>
        <div className="flex items-center gap-3">
          {/* 完成度指示器 */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${formCompleteness.percent}%` }}
              />
            </div>
            <span className="text-xs text-neutral-400 font-medium">{formCompleteness.percent}%</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye size={14} />}
            onClick={() => setShowPreview(true)}
            disabled={ingredients.length === 0}
          >
            预览
          </Button>
        </div>
      </div>

      <PageHeader title="新建配方" description="创建药食同源功能性食品配方" />

      {/* 网络错误提示条 */}
      {networkError && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-error-50 dark:bg-error-900/10 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
            <AlertCircle size={14} className="shrink-0" />
            {networkError}
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} icon={<RefreshCw size={14} />}>
            重试
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* 基本信息（响应式） */}
          <Card>
            <CardHeader className="p-4 md:p-6 pb-0 md:pb-0">
              <CardTitle as="h3" className="text-base md:text-lg">
                基本信息
              </CardTitle>
              <CardDescription>填写配方名称和描述信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-5 p-4 md:p-6 pt-4 md:pt-5">
              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  配方名称 <span className="text-error-500 ml-0.5">*</span>
                </label>
                <Input
                  data-field="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  onBlur={() => validateField('name')}
                  placeholder="例：枸杞山药增强免疫配方"
                  className="h-10"
                  error={!!getFieldError(fieldErrors, 'name')}
                />
                <FieldErrorText field="name" />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  配方描述
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="描述配方的用途、适用人群等..."
                  className="min-h-[96px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* 目标功效 */}
          <Card>
            <CardHeader>
              <CardTitle as="h3">目标功效</CardTitle>
              <CardDescription>添加配方期望达到的功效目标</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  功效标签 <span className="text-error-500 ml-0.5">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    data-field="effectInput"
                    value={effectInput}
                    onChange={(e) => setEffectInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEffect())}
                    onBlur={() => effects.length === 0 && validateField('effects')}
                    placeholder="输入功效后按回车添加"
                    className="flex-1 h-10"
                    error={!!getFieldError(fieldErrors, 'effects')}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addEffect}
                    icon={<Plus size={16} />}
                    className="h-10"
                  />
                  {effects.length > 0 && (
                    <Button
                      type="button"
                      variant={showRecommendations ? 'primary' : 'secondary'}
                      onClick={() => setShowRecommendations(!showRecommendations)}
                      icon={<Sparkles size={14} />}
                      size="sm"
                    >
                      AI 推荐
                    </Button>
                  )}
                </div>
                <FieldErrorText field="effects" />

                {/* 常用功效快捷标签 */}
                {effects.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {['增强免疫', '抗氧化', '降血压', '降血糖', '补气养阴', '改善睡眠', '抗疲劳', '调节肠胃'].map(
                      (eff) => (
                        <button
                          key={eff}
                          type="button"
                          onClick={() => {
                            setEffects([...effects, eff]);
                            clearFieldError('effects');
                          }}
                          className="px-2.5 py-1 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-700 dark:hover:text-primary-400 transition-colors"
                        >
                          + {eff}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              {effects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {effects.map((eff, i) => (
                    <Badge key={i} variant="primary">
                      {eff}
                      <button type="button" onClick={() => removeEffect(i)} className="ml-1 hover:text-error-500">
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* AI 推荐结果 */}
              {showRecommendations && (
                <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-4 bg-primary-50/50 dark:bg-primary-900/10">
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primary-500" />
                    AI 成分推荐
                    <span className="text-xs text-neutral-400 ml-auto">点击可添加到配方</span>
                  </h3>
                  {recLoading ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                      正在分析推荐...
                    </div>
                  ) : recData && Array.isArray(recData) && recData.length > 0 ? (
                    <div className="grid gap-2">
                      {(Array.isArray(recData) ? recData : []).map((rec, i) => {
                        const recId = rec.id ?? `rec-${i}`
                        return (
                        <div
                          key={recId}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer',
                            ingredients.some((ing: any) => ing.id === rec.id)
                              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 opacity-60'
                              : 'bg-white dark:bg-neutral-900 border-primary-100 dark:border-primary-800 hover:border-primary-300',
                          )}
                          onClick={() => {
                            if (!ingredients.some((ing: any) => ing.id === rec.id)) {
                              addHerbToIngredients({
                                id: (rec.id) ?? `rec-${i}`,
                                name: (rec as Record<string, unknown>).name as string ?? rec.name,
                                category: (rec as Record<string, unknown>).category as string,
                                is_food_homology: (rec as Record<string, unknown>).is_food_homology as boolean,
                              } as unknown as TCMHerb);
                            }
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{rec.name ?? rec.name}</p>
                            <p className="text-xs text-neutral-500">{((rec as Record<string, unknown>).match_reasons as string[] | undefined)?.join(' · ') || ''}</p>
                          </div>
                          <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                            {rec.score}分
                          </span>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">暂无推荐结果，请添加功效标签</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 成分管理 — 增强版 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle as="h3">配方成分</CardTitle>
                  <CardDescription>
                    添加药材成分并设置用量和角色 <span className="text-error-500">*</span>
                  </CardDescription>
                </div>
                {ingredients.length > 0 && <Badge variant="primary">{ingredients.length} 种</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldErrorText field="ingredients" />

              {/* 药材搜索 */}
              <div className="relative">
                <Input
                  value={herbSearch}
                  onChange={(e) => {
                    setHerbSearch(e.target.value);
                    setShowHerbSearch(true);
                  }}
                  onFocus={() => setShowHerbSearch(true)}
                  onBlur={() => setTimeout(() => setShowHerbSearch(false), 200)}
                  placeholder="搜索药材添加到配方..."
                  prefix={<Leaf size={16} />}
                  className="w-full h-10"
                />
                {showHerbSearch && herbSearch.trim().length > 0 && (
                  <HerbSearchDropdown
                    keyword={herbSearch}
                    onSelect={addHerbToIngredients}
                    existingIds={ingredients.map((i) => i.id)}
                  />
                )}
              </div>

              {/* 成分列表 */}
              {ingredients.length > 0 && (
                <div className="space-y-3">
                  {/* 成分总览条 */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-500">共 {ingredients.length} 种成分</span>
                      {totalWeight > 0 && (
                        <span className="text-primary-600 dark:text-primary-400 font-medium">总重 {totalWeight}g</span>
                      )}
                      {ingredients.length >= 2 && (
                        <span className="text-xs text-violet-500 flex items-center gap-1">
                          <FlaskConical size={12} />
                          {previewAnalysis.isRunning ? '分析中...' : '保存后可运行深度分析'}
                        </span>
                      )}
                    </div>
                    {getFieldError(fieldErrors, 'dosage') && (
                      <span className="text-xs text-error-500">{getFieldError(fieldErrors, 'dosage')}</span>
                    )}
                  </div>

                  {/* 成分卡片列表 */}
                  <div className="space-y-2">
                    {ingredients.map((ing, index) => (
                      <div
                        key={ing.id}
                        className="group border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 bg-white dark:bg-neutral-900 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          {/* 拖拽手柄 */}
                          <div className="flex flex-col items-center pt-1 gap-0.5 shrink-0">
                            <GripVertical size={14} className="text-neutral-300 dark:text-neutral-600" />
                            <button
                              type="button"
                              onClick={() => moveIngredient(index, 'up')}
                              disabled={index === 0}
                              className="p-0.5 text-neutral-300 hover:text-neutral-500 disabled:opacity-30 transition-colors"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveIngredient(index, 'down')}
                              disabled={index === ingredients.length - 1}
                              className="p-0.5 text-neutral-300 hover:text-neutral-500 disabled:opacity-30 transition-colors"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>

                          {/* 成分信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-neutral-900 dark:text-white">{ing.name}</span>
                              <span className="text-xs text-neutral-400">{ing.category}</span>
                              {ing.is_food_homology && (
                                <Badge variant="success" size="sm">
                                  药食同源
                                </Badge>
                              )}
                              {ing.role && (
                                <Badge variant="primary" size="sm">
                                  {ing.role}
                                </Badge>
                              )}
                              <button
                                type="button"
                                onClick={() => removeIngredient(ing.id)}
                                className="ml-auto p-1 text-neutral-300 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* 成分参数行 */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={ing.dosage_amount}
                                onChange={(e) => updateIngredient(ing.id, 'dosage_amount', e.target.value)}
                                onBlur={() => validateField('ingredients')}
                                placeholder="用量"
                                size="sm"
                                className="w-20 h-10"
                                type="number"
                                min="0"
                                step="0.1"
                              />
                              <div className="relative w-16">
                                <select
                                  value={ing.dosage_unit}
                                  onChange={(e) => updateIngredient(ing.id, 'dosage_unit', e.target.value)}
                                  className="w-full h-10 text-xs px-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 appearance-none cursor-pointer"
                                >
                                  {DOSAGE_UNIT_OPTIONS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="relative w-24">
                                <select
                                  value={ing.role}
                                  onChange={(e) => updateIngredient(ing.id, 'role', e.target.value)}
                                  className="w-full h-10 text-xs px-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 appearance-none cursor-pointer"
                                >
                                  {ROLE_OPTIONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <Input
                                value={ing.notes}
                                onChange={(e) => updateIngredient(ing.id, 'notes', e.target.value)}
                                placeholder="备注"
                                size="sm"
                                className="flex-1 min-w-[120px] h-10"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ingredients.length === 0 && (
                <div className="text-center py-8 text-sm text-neutral-400">
                  <Beaker size={32} className="mx-auto mb-2 text-neutral-200 dark:text-neutral-700" />
                  <p>搜索并添加药材到配方</p>
                  <p className="text-xs mt-1">支持 TCMSP 数据库中的 40+ 常用中药材</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 制备参数 */}
          <Card>
            <CardHeader>
              <CardTitle as="h3">制备参数</CardTitle>
              <CardDescription>设置配方的服用和储藏信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    服用剂量
                  </label>
                  <Input
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="例：每日2次，每次5g"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    保质期（天）
                  </label>
                  <Input
                    type="number"
                    value={shelfLife}
                    onChange={(e) => setShelfLife(e.target.value)}
                    placeholder="365"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    加工工艺
                  </label>
                  <Input
                    value={processingMethod}
                    onChange={(e) => setProcessingMethod(e.target.value)}
                    placeholder="例：喷雾干燥"
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    储藏条件
                  </label>
                  <Input
                    value={storageConditions}
                    onChange={(e) => setStorageConditions(e.target.value)}
                    placeholder="例：阴凉干燥处保存"
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 提交 */}
          <Card>
            <CardFooter className="border-t border-neutral-200 dark:border-neutral-700 pt-4 justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                {formCompleteness.percent === 100 ? (
                  <CheckCircle2 size={14} className="text-success-500" />
                ) : (
                  <AlertCircle size={14} />
                )}
                <span>
                  已完成 {formCompleteness.filled}/{formCompleteness.total} 项
                </span>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/formulas')}
                  className="h-11"
                  size="md"
                >
                  取消
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={isSubmitting} className="h-11" size="md">
                  {isSubmitting ? '创建中...' : '创建配方'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </form>

      {/* 配方预览 Modal */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="配方预览" maxWidth="max-w-2xl">
        <div className="space-y-6">
          {/* 头部 */}
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{name || '未命名配方'}</h2>
            {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{description}</p>}
          </div>

          {/* 目标功效 */}
          {effects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">目标功效</h4>
              <div className="flex flex-wrap gap-2">
                {effects.map((eff, i) => (
                  <Badge key={i} variant="primary">
                    {eff}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 成分列表 */}
          {ingredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">成分组成</h4>
                {totalWeight > 0 && (
                  <span className="text-xs text-primary-600 dark:text-primary-400">总重 {totalWeight}g</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">序号</th>
                      <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">成分</th>
                      <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">角色</th>
                      <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">用量</th>
                      <th className="text-left py-2 px-2 text-xs text-neutral-500 font-medium">备注</th>
                      <th className="text-center py-2 px-2 text-xs text-neutral-500 font-medium">药食同源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, i) => (
                      <tr key={ing.id} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-2 px-2 text-neutral-400">{i + 1}</td>
                        <td className="py-2 px-2 font-medium text-neutral-900 dark:text-white">{ing.name}</td>
                        <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400">{ing.role || '-'}</td>
                        <td className="py-2 px-2 text-neutral-600 dark:text-neutral-400 font-mono">
                          {ing.dosage_amount ? `${ing.dosage_amount}${ing.dosage_unit}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-neutral-500 text-xs">{ing.notes || '-'}</td>
                        <td className="py-2 px-2 text-center">
                          {ing.is_food_homology ? (
                            <Badge variant="success" size="sm">
                              是
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              否
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 参数概览 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '服用剂量', value: dosage },
              { label: '加工工艺', value: processingMethod },
              { label: '储藏条件', value: storageConditions },
              { label: '保质期', value: shelfLife ? `${shelfLife} 天` : null },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2.5">
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white mt-0.5">{value ?? '未设置'}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** 药材搜索下拉框 */
function HerbSearchDropdown({
  keyword,
  onSelect,
  existingIds,
}: {
  keyword: string;
  onSelect: (herb: TCMHerb) => void;
  existingIds: number[];
}) {
  const [herbs, setHerbs] = useState<TCMHerb[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!keyword.trim()) {
      setHerbs([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await databaseApi.searchHerbs({ keyword, page_size: 8 });
        setHerbs(res.data || []);
      } catch {
        setHerbs([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const isDuplicate = (id: number) => existingIds.includes(id);

  if (loading) {
    return (
      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
        <div className="p-3 text-center text-sm text-neutral-400">
          <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (herbs.length === 0) {
    return (
      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
        <div className="p-3 text-center text-sm text-neutral-400">未找到匹配药材</div>
      </div>
    );
  }

  return (
    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
      {herbs.map((herb) => (
        <button
          key={herb.id}
          type="button"
          disabled={isDuplicate(herb.id)}
          onClick={() => onSelect(herb)}
          className={cn(
            'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0',
            isDuplicate(herb.id) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-neutral-900 dark:text-white">{herb.name}</span>
              {herb.category && <span className="ml-2 text-xs text-neutral-400">{herb.category}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {herb.is_food_homology && (
                <Badge variant="success" size="sm">
                  药食同源
                </Badge>
              )}
              {isDuplicate(herb.id) && (
                <Badge variant="neutral" size="sm">
                  已添加
                </Badge>
              )}
            </div>
          </div>
          {herb.efficacy && <p className="text-xs text-neutral-400 mt-0.5 truncate">{herb.efficacy}</p>}
        </button>
      ))}
    </div>
  );
}
