/**
 * 新建配方页 — Phase 6 专业增强版
 * 成分用量管理 + 上下按钮排序 + 配方实时预览 + 表单验证增强 + 实时分析
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/safeLogger';
import { databaseApi } from '@/api/database';
import { formulaApi } from '@/api/formula';
import { validateFullFormula } from '@/utils/formulaValidator';
import type { TCMHerb } from '@/types';
import type {
  FieldValidationError,
  SynergyAnalysisResponse,
  SafetyCheckResponse,
} from '@/types/formula';

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

/** 剂量单位→克换算系数（质量/体积单位有效，计数单位返回 0） */
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  mg: 0.001,
  mL: 1, // 近似密度 1g/mL
  '片': 0,
  '粒': 0,
  '适量': 0,
};

/** 将任意单位的剂量统一换算为克 */
function toGrams(amount: number, unit: string): number {
  const factor = UNIT_TO_GRAMS[unit] ?? 0;
  return amount * factor;
}

/** 格式化总重量显示（≥1g 显示克，<1g 显示毫克） */
function formatTotalWeight(grams: number): string {
  if (grams >= 1) {
    return `${Math.round(grams * 100) / 100}g`;
  }
  return `${Math.round(grams * 1000)}mg`;
}

const EMPTY_INGREDIENT: Omit<IngredientItem, 'id' | 'name' | 'category' | 'is_food_homology'> = {
  dosage_amount: '',
  dosage_unit: 'g',
  role: '',
  notes: '',
};

/** 实时分析结果类型 */
interface PreviewAnalysisState {
  synergy?: SynergyAnalysisResponse;
  stability?: { predicted_shelf_life_months: number; stability_score: number; risk_factors: any[]; storage_recommendations: string[] };
  taste?: { taste_profile: { bitter: number; sweet: number; umami: number; astringent: number; sour: number }; balance_score: number; acceptability: number };
  safety?: SafetyCheckResponse;
  isRunning?: boolean;
}

function getFieldError(errors: FieldValidationError[], field: string): string | null {
  const err = errors.find((e) => e.field === field || e.field.startsWith(`${field}[`) || e.field === `${field}.0`);
  return err?.message ?? null;
}

/** 渲染字段错误的辅助组件（模块级定义，避免在渲染期间创建组件） */
function FieldErrorText({ field, errors }: { field: string; errors: FieldValidationError[] }) {
  const msg = getFieldError(errors, field);
  if (!msg) return null;
  return (
    <p className="text-xs text-[var(--color-error-text)]0 mt-1 flex items-center gap-1">
      <AlertCircle size={12} className="shrink-0" />
      {msg}
    </p>
  );
}

export default function FormulaNewPage() {
  const navigate = useNavigate();
  const toast = useToast();

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
  const herbInputRef = useRef<HTMLInputElement>(null);
  const [herbActiveIndex, setHerbActiveIndex] = useState(-1);

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
  const [, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // ── 实时分析状态 ──
  const [previewAnalysis, setPreviewAnalysis] = useState<PreviewAnalysisState>({ isRunning: false });

  // ── 模板预填：从模板库"使用此模板"跳转时读取 sessionStorage 并填充表单 ──
  useEffect(() => {
    try {
      const fromTemplate = new URLSearchParams(window.location.search).get('from_template');
      if (fromTemplate !== 'true') return;
      const raw = sessionStorage.getItem('formula_template');
      if (!raw) return;
      const tpl = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 模板预填：挂载时从 sessionStorage 一次性同步到表单状态
      if (tpl.name) setName(String(tpl.name));
      if (tpl.description) setDescription(String(tpl.description));
      if (Array.isArray(tpl.effects) && tpl.effects.length > 0) setEffects(tpl.effects.map(String));
      if (Array.isArray(tpl.ingredients) && tpl.ingredients.length > 0) {
        const parsed = tpl.ingredients.map((ing: Record<string, string>, idx: number) => {
          const dosageStr = (ing.dosage || '').trim();
          const match = dosageStr.match(/^([\d.]+)\s*([a-zA-Z%]*)$/);
          const amount = match ? match[1] : '';
          const unit = match ? (match[2] || 'g') : 'g';
          return {
            id: idx + 1,
            name: String(ing.name || ''),
            category: String(ing.category || ''),
            is_food_homology: false,
            dosage_amount: amount,
            dosage_unit: unit,
            role: String(ing.role || ''),
            notes: '',
          };
        });
        setIngredients(parsed);
      }
      // 清理存储，避免刷新后重复填充
      sessionStorage.removeItem('formula_template');
    } catch (e) {
      logger.error('[FormulaNewPage] 模板预填失败:', e);
    }
  }, []);

  // ── 实时分析（基于成分列表，无需配方 ID）──
  useEffect(() => {
    if (ingredients.length < 2) return;
    
    let cancelled = false;
    
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPreviewAnalysis(prev => ({ ...prev, isRunning: true }));
      try {
        // 成分数据：按剂量换算 amount_mg，按总剂量计算百分比
        const totalAmount = ingredients.reduce((sum, ing) => {
          const amt = parseFloat(ing.dosage_amount) || 0;
          return sum + toGrams(amt, ing.dosage_unit);
        }, 0);
        const ingData = ingredients.map(ing => {
          const amt = parseFloat(ing.dosage_amount) || 0;
          const amountG = toGrams(amt, ing.dosage_unit);
          return {
            name: ing.name,
            percentage: totalAmount > 0 ? Math.round((amountG / totalAmount) * 10000) / 100 : undefined,
            amount_mg: Math.round(amountG * 1000),
          };
        });

        const [synergy, stability, taste, safety] = await Promise.all([
          formulaApi.analyzeSynergy({
            ingredient_a: ingredients[0].name,
            ingredient_b: ingredients[1].name,
          }).catch(() => null),
          formulaApi.predictStability({
            ingredients: ingData.map(({ name, percentage }) => ({ name, percentage })),
          }).catch(() => null),
          formulaApi.predictTaste({
            ingredients: ingData.map(({ name, percentage }) => ({ name, percentage })),
          }).catch(() => null),
          formulaApi.checkSafety({
            ingredients: ingData.map(({ name, amount_mg, percentage }) => ({ name, amount_mg, percentage: percentage ?? 0 })),
            daily_dosage_g: totalAmount > 0 ? totalAmount : 10,
            target_group: 'adult',
            usage_scenario: 'supplement',
          }).catch(() => null),
        ]);
        
        if (!cancelled) {
          setPreviewAnalysis({ synergy: synergy ?? undefined, stability: stability ?? undefined, taste: taste ?? undefined, safety: safety ?? undefined, isRunning: false });
        }
      } catch {
        if (!cancelled) {
          setPreviewAnalysis(prev => ({ ...prev, isRunning: false }));
        }
      }
    }, 1000);
    
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ingredients]);

  // 成分总重量计算（统一换算为克）
  const totalWeight = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      const num = parseFloat(ing.dosage_amount);
      return sum + (isNaN(num) ? 0 : toGrams(num, ing.dosage_unit));
    }, 0);
  }, [ingredients]);

  // 各成分百分比（末位补偿确保总和精确=100%）
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- useMemo 内部对数组就地修改，编译器无法保留手动 memo；保持现有实现不变
  const ingredientPcts = useMemo(() => {
    const gramAmounts = ingredients.map((ing) => {
      const num = parseFloat(ing.dosage_amount) || 0;
      return toGrams(num, ing.dosage_unit);
    });
    const totalG = gramAmounts.reduce((s, g) => s + g, 0);
    if (totalG <= 0) return ingredients.map(() => 0);

    const rawPcts = gramAmounts.map((g) => (g / totalG) * 100);
    const rounded = rawPcts.map((p) => Math.round(p * 10) / 10);

    // 末位补偿：将舍入差值分配给最后一个非零成分
    const sum = rounded.reduce((s, p) => s + p, 0);
    const diff = Math.round((100 - sum) * 10) / 10;
    if (Math.abs(diff) > 0.001) {
      for (let i = rounded.length - 1; i >= 0; i--) {
        if (rounded[i] > 0) {
          rounded[i] = Math.round((rounded[i] + diff) * 10) / 10;
          break;
        }
      }
    }
    return rounded;
  }, [ingredients]);

  // 表单完整性检查
  const formCompleteness = useMemo(() => {
    let filled = 0;
    const total = 7;
    const missing: string[] = [];
    
    if (name.trim()) filled++;
    else missing.push('配方名称');
    if (description.trim()) filled++;
    if (effects.length > 0) filled++;
    else missing.push('功效标签');
    if (ingredients.length >= 2) filled++;
    else missing.push('成分（≥2种）');
    if (ingredients.length > 0 && ingredients.every((i) => i.dosage_amount.trim())) filled++;
    else missing.push('成分用量');
    if (dosage.trim()) filled++;
    else missing.push('服用剂量');
    if (processingMethod.trim()) filled++;
    else missing.push('加工工艺');
    
    return { filled, total, percent: Math.round((filled / total) * 100), missing };
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
    setTouchedFields(new Set(['name', 'ingredients', 'effects', 'dosage', 'description', 'shelf_life', 'processing_method', 'storage_conditions']));

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
    dosage: dosage || undefined,
    ingredients: ingredients.map((ing, idx) => ({
      name: ing.name,
      amount: ing.dosage_amount ? parseFloat(ing.dosage_amount) : undefined,
      unit: ing.dosage_unit,
      percentage: ingredientPcts[idx],
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
        target_effects: effects.length > 0 ? effects : undefined,
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
        ingredient_ids: ingredients.map((ing) => ing.id),
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

  // ── 生成唯一数字 ID（用于 AI 推荐等非数据库来源的成分）──
  const generateUniqueId = (): number => {
    const maxId = ingredients.reduce((max, ing) => Math.max(max, ing.id), 0);
    return maxId + 1;
  };

  const addHerbToIngredients = (herb: Partial<TCMHerb> & { id: number; name: string }) => {
    if (ingredients.some((i) => i.id === herb.id)) return;
    setIngredients([
      ...ingredients,
      {
        id: herb.id,
        name: herb.name_cn || herb.name || '',
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

  // ── 生成预览文本（用于复制到剪贴板）──
  const generatePreviewText = () => {
    const lines: string[] = [];
    lines.push(`# ${name || '未命名配方'}`);
    if (description) lines.push(`\n## 描述\n${description}`);
    if (effects.length > 0) lines.push(`\n## 目标功效\n${effects.join('、')}`);
    if (ingredients.length > 0) {
      lines.push(`\n## 成分组成`);
      if (totalWeight > 0) lines.push(`总重：${formatTotalWeight(totalWeight)}`);
      ingredients.forEach((ing, i) => {
        const pct = totalWeight > 0 && ing.dosage_amount ? `${ingredientPcts[i]}%` : '';
        const dosage = ing.dosage_amount ? `${ing.dosage_amount}${ing.dosage_unit}` : '';
        const role = ing.role ? `[${ing.role}]` : '';
        lines.push(`${i + 1}. ${ing.name} ${role} - ${dosage}${pct ? ` (${pct})` : ''}`);
        if (ing.notes) lines.push(`   备注：${ing.notes}`);
      });
    }
    if (dosage) lines.push(`\n## 服用剂量\n${dosage}`);
    if (processingMethod) lines.push(`\n## 加工工艺\n${processingMethod}`);
    if (storageConditions) lines.push(`\n## 储藏条件\n${storageConditions}`);
    if (shelfLife) lines.push(`\n## 保质期\n${shelfLife} 天`);
    return lines.join('\n');
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-[var(--space-apple-md)] md:space-y-6 px-[var(--space-apple-md)] md:px-0">
      {/* 顶部导航 + 完成度 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">返回列表</span>
          <span className="sm:hidden">返回</span>
        </button>
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          {/* 完成度指示器 */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary-container)]0 rounded-[var(--radius-pill)] transition-all duration-500"
                style={{ width: `${formCompleteness.percent}%` }}
              />
            </div>
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">{formCompleteness.percent}%</span>
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
        <div className="flex items-center justify-between px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/15 border border-[var(--color-error-border)] dark:border-[var(--color-error)]">
          <div className="flex items-center gap-2 text-sm text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">
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
            <CardHeader className="p-[var(--space-apple-md)] md:p-[var(--space-apple-lg)] pb-0 md:pb-0">
              <CardTitle as="h3" className="text-base md:text-lg">
                基本信息
              </CardTitle>
              <CardDescription>填写配方名称和描述信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-[var(--space-apple-md)] md:space-y-5 p-[var(--space-apple-md)] md:p-[var(--space-apple-lg)] pt-[var(--space-apple-md)] md:pt-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  配方名称 <span className="text-[var(--color-error-text)]0 ml-0.5">*</span>
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
                <FieldErrorText field="name" errors={fieldErrors} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
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
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  功效标签 <span className="text-[var(--color-error-text)]0 ml-0.5">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    data-field="effectInput"
                    value={effectInput}
                    onChange={(e) => setEffectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEffect();
                      }
                    }}
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
                <FieldErrorText field="effects" errors={fieldErrors} />

                {/* 常用功效快捷标签 */}
                {effects.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-[var(--space-apple-sm)]">
                    {['增强免疫', '抗氧化', '降血压', '降血糖', '补气养阴', '改善睡眠', '抗疲劳', '调节肠胃'].map(
                      (eff) => (
                        <button
                          key={eff}
                          type="button"
                          onClick={() => {
                            setEffects([...effects, eff]);
                            clearFieldError('effects');
                          }}
                          className="inline-flex items-center min-h-[44px] px-3 py-1 text-xs rounded-[var(--radius-pill)] border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--color-primary-border)] hover:text-[var(--color-primary-text)] dark:hover:border-[var(--color-primary)] dark:hover:text-[var(--color-primary-text)] transition-colors"
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
                      <button type="button" onClick={() => removeEffect(i)} className="ml-1 hover:text-[var(--color-error-text)]0" aria-label="移除功效">
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* AI 推荐结果 */}
              {showRecommendations && (
                <div className="border border-[var(--color-primary-border)] dark:border-[var(--color-primary)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] bg-[var(--color-primary-container)]/50 dark:bg-[var(--color-primary-container)]/15">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[var(--color-primary-text)]0" />
                    AI 成分推荐
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-auto">点击可添加到配方</span>
                  </h3>
                  {recLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <div className="w-4 h-4 border-2 border-[var(--color-primary-border)] border-t-primary-600 rounded-[var(--radius-pill)] animate-spin" />
                      正在分析推荐...
                    </div>
                  ) : recData && Array.isArray(recData) && recData.length > 0 ? (
                    <div className="grid gap-2">
                      {(Array.isArray(recData) ? recData : []).map((rec) => {
                        const recId = typeof rec.id === 'number' ? rec.id : generateUniqueId();
                        const isAdded = ingredients.some((ing) => ing.id === recId || ing.name === rec.name);
                        return (
                        <div
                          key={recId}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-[var(--radius-Apple-sm)] border transition-colors cursor-pointer',
                            isAdded
                              ? 'bg-[var(--color-primary-container)] border-[var(--color-primary-border)] dark:border-[var(--color-primary)] opacity-60'
                              : 'bg-[var(--bg-secondary)] border-[var(--color-primary-border)] dark:border-[var(--color-primary)] hover:border-[var(--color-primary-border)]',
                          )}
                          onClick={() => {
                            if (!isAdded) {
                              addHerbToIngredients({
                                id: recId,
                                name: rec.name,
                                category: (rec as Record<string, unknown>).category as string || '',
                                is_food_homology: (rec as Record<string, unknown>).is_food_homology as boolean || false,
                              });
                            }
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{rec.name}</p>
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{((rec as Record<string, unknown>).match_reasons as string[] | undefined)?.join(' · ') || ''}</p>
                          </div>
                          <span className="text-xs font-medium text-[var(--color-primary-text)]">
                            {rec.score}分
                          </span>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无推荐结果，请添加功效标签</p>
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
                    添加药材成分并设置用量和角色 <span className="text-[var(--color-error-text)]0">*</span>
                  </CardDescription>
                </div>
                {ingredients.length > 0 && <Badge variant="primary">{ingredients.length} 种</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldErrorText field="ingredients" errors={fieldErrors} />

              {/* 药材搜索 */}
              <div className="relative">
                <Input
                  ref={herbInputRef}
                  value={herbSearch}
                  onChange={(e) => {
                    setHerbSearch(e.target.value);
                    setShowHerbSearch(true);
                  }}
                  onFocus={() => setShowHerbSearch(true)}
                  onBlur={() => setTimeout(() => setShowHerbSearch(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowHerbSearch(false);
                      herbInputRef.current?.blur();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHerbActiveIndex(prev => prev + 1);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHerbActiveIndex(prev => prev > 0 ? prev - 1 : -1);
                    } else if (e.key === 'Enter' && herbActiveIndex >= 0) {
                      e.preventDefault();
                      // 选中当前高亮项（由 dropdown 内部处理）
                    }
                  }}
                  placeholder="搜索药材添加到配方..."
                  prefix={<Leaf size={16} />}
                  className="w-full h-10"
                />
                {showHerbSearch && herbSearch.trim().length > 0 && (
                  <HerbSearchDropdown
                    keyword={herbSearch}
                    onSelect={addHerbToIngredients}
                    existingIds={ingredients.map((i) => i.id)}
                    inputRef={herbInputRef}
                    activeIndex={herbActiveIndex}
                    onActiveIndexChange={setHerbActiveIndex}
                  />
                )}
              </div>

              {/* 成分列表 */}
              {ingredients.length > 0 && (
                <div className="space-y-[var(--space-apple-sm)]">
                  {/* 成分总览条 */}
                  <div className="flex items-center justify-between px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">共 {ingredients.length} 种成分</span>
                      {totalWeight > 0 && (
                        <span className="text-[var(--color-primary-text)] font-medium">总重 {formatTotalWeight(totalWeight)}</span>
                      )}
                      {ingredients.length >= 2 && (
                        <span className="text-xs text-[var(--color-accent-text)]0 flex items-center gap-1">
                          <FlaskConical size={12} />
                          {previewAnalysis.isRunning ? '分析中...' : '实时分析已完成'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 成分卡片列表 */}
                  <div className="space-y-2">
                    {ingredients.map((ing, index) => (
                      <div
                        key={ing.id}
                        className="group border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] p-[var(--space-apple-sm)] bg-[var(--bg-secondary)] hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)] transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          {/* 拖拽手柄 */}
                          <div className="flex flex-col items-center pt-1 gap-0.5 shrink-0">
                            <GripVertical size={14} className="text-[var(--text-muted)] dark:text-[var(--text-muted)]" />
                            <button
                              type="button"
                              onClick={() => moveIngredient(index, 'up')}
                              disabled={index === 0}
                              className="p-0.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] disabled:opacity-30 transition-colors"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveIngredient(index, 'down')}
                              disabled={index === ingredients.length - 1}
                              className="p-0.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] disabled:opacity-30 transition-colors"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>

                          {/* 成分信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-[var(--text-primary)]">{ing.name}</span>
                              <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{ing.category}</span>
                              {totalWeight > 0 && ing.dosage_amount && (
                                <span className="text-xs text-[var(--color-primary-text)] font-medium bg-[var(--color-primary-container)] px-1.5 py-0.5 rounded">
                                  {ingredientPcts[index]}%
                                </span>
                              )}
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
                                className="ml-auto p-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 opacity-0 group-hover:opacity-100 transition-all"
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
                              <div className="w-16">
                                <Select value={ing.dosage_unit} onValueChange={(v) => updateIngredient(ing.id, 'dosage_unit', v)}>
                                  <SelectTrigger className="h-10 w-full text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DOSAGE_UNIT_OPTIONS.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-24">
                                <Select value={ing.role} onValueChange={(v) => updateIngredient(ing.id, 'role', v)}>
                                  <SelectTrigger className="h-10 w-full text-xs">
                                    <SelectValue placeholder="角色" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ROLE_OPTIONS.map((r) => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
                <div className="text-center py-8 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <Beaker size={32} className="mx-auto mb-2 text-neutral-200 dark:text-[var(--text-primary)]" />
                  <p>搜索并添加药材到配方</p>
                  <p className="text-xs mt-1">支持 TCMSP 数据库中的 40+ 常用中药材</p>
                </div>
              )}

              {/* 实时分析结果 */}
              {ingredients.length >= 2 && (
                <div className="border-t border-[var(--border-color)] pt-[var(--space-apple-md)] mt-[var(--space-apple-md)]">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-[var(--space-apple-sm)] flex items-center gap-1.5">
                    <FlaskConical size={14} className="text-[var(--color-accent-text)]0" />
                    实时分析
                    {previewAnalysis.isRunning && (
                      <span className="text-xs text-[var(--color-accent-text)]0 font-normal">分析中...</span>
                    )}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--space-apple-sm)]">
                    {/* 协同分析 */}
                    <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">协同分析</p>
                      {previewAnalysis.synergy ? (
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {previewAnalysis.synergy.overall_si != null
          ? `${Math.round(previewAnalysis.synergy.overall_si * 100)}%`
          : '—'}
                          </p>
                          {previewAnalysis.synergy.dominant_mechanism && (
                            <p className="text-xs text-[var(--color-primary-text)] mt-0.5">
                              {String(previewAnalysis.synergy.dominant_mechanism).replace(/_/g, ' ')}
                            </p>
                          )}
                          {previewAnalysis.synergy?.mechanisms && (
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 line-clamp-2">
                              {Object.keys(previewAnalysis.synergy.mechanisms).slice(0, 3).map(k => `${k.replace(/_/g, ' ')}: ${Math.round((previewAnalysis.synergy?.mechanisms?.[k] ?? 0) * 100)}%`).join(' · ')}
                            </p>
                          )}
                        </div>
                      ) : previewAnalysis.isRunning ? (
                        <p className="text-xs text-[color:var(--text-muted)]">加载中...</p>
                      ) : (
                        <p className="text-xs text-[color:var(--text-muted)]">暂无数据</p>
                      )}
                    </div>

                    {/* 稳定性 */}
                    <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">稳定性预测</p>
                      {previewAnalysis.stability ? (
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {previewAnalysis.stability.stability_score != null
          ? `${Math.round(previewAnalysis.stability.stability_score)}分`
          : '—'}
                          </p>
                          {previewAnalysis.stability.predicted_shelf_life_months != null && (
                            <p className="text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mt-0.5">
                              保质期 ≈ {previewAnalysis.stability.predicted_shelf_life_months} 个月
                            </p>
                          )}
                          {previewAnalysis.stability.risk_factors && previewAnalysis.stability.risk_factors.length > 0 && (
                            <p className="text-xs text-[var(--color-error-text)]0 mt-0.5 line-clamp-1">
                              ⚠ {previewAnalysis.stability.risk_factors[0]?.description || previewAnalysis.stability.risk_factors[0]}
                            </p>
                          )}
                        </div>
                      ) : previewAnalysis.isRunning ? (
                        <p className="text-xs text-[color:var(--text-muted)]">加载中...</p>
                      ) : (
                        <p className="text-xs text-[color:var(--text-muted)]">暂无数据</p>
                      )}
                    </div>

                    {/* 风味预测 */}
                    <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">风味预测</p>
                      {previewAnalysis.taste ? (
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            接受度 {previewAnalysis.taste.acceptability != null
          ? `${Math.round(previewAnalysis.taste.acceptability * 100)}%`
          : '—'}
                          </p>
                          {previewAnalysis.taste?.taste_profile && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(['bitter','sweet','umami','astringent','sour'] as const).map(t => (
                                previewAnalysis.taste?.taste_profile?.[t] != null &&
                                <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-secondary)]">
                                  {t}: {Math.round((previewAnalysis.taste?.taste_profile?.[t] ?? 0) * 100)}%
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : previewAnalysis.isRunning ? (
                        <p className="text-xs text-[color:var(--text-muted)]">加载中...</p>
                      ) : (
                        <p className="text-xs text-[color:var(--text-muted)]">暂无数据</p>
                      )}
                    </div>

                    {/* 安全性 */}
                    <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-[var(--space-apple-sm)]">
                      <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1">安全性检查</p>
                      {previewAnalysis.safety ? (
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {previewAnalysis.safety.is_safe
          ? <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">✓ 安全</span>
          : <span className="text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">✗ 需关注</span>}
                          </p>
                          {previewAnalysis.safety.overall_risk_score != null && (
                            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5">
                              风险评分: {Math.round(previewAnalysis.safety.overall_risk_score)}/100
                            </p>
                          )}
                          {previewAnalysis.safety.alerts && previewAnalysis.safety.alerts.length > 0 && (
                            <p className="text-xs text-[var(--color-warning-text)] mt-0.5 line-clamp-1">
                              ⚠ {previewAnalysis.safety.alerts[0]?.message || '未知风险'}
                            </p>
                          )}
                          {previewAnalysis.safety.blocked_by_critical && (
                            <p className="text-xs text-[var(--color-error-text)] dark:text-[var(--color-error-text)] mt-0.5">已阻止保存</p>
                          )}
                        </div>
                      ) : previewAnalysis.isRunning ? (
                        <p className="text-xs text-[color:var(--text-muted)]">加载中...</p>
                      ) : (
                        <p className="text-xs text-[color:var(--text-muted)]">暂无数据</p>
                      )}
                    </div>
                  </div>
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
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    服用剂量
                  </label>
                  <Input
                    data-field="dosage"
                    value={dosage}
                    onChange={(e) => { setDosage(e.target.value); clearFieldError('dosage'); }}
                    onBlur={() => validateField('dosage')}
                    placeholder="例：每日2次，每次5g"
                    className="h-10"
                  />
                  <FieldErrorText field="dosage" errors={fieldErrors} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    保质期（天）
                  </label>
                  <Input
                    type="number"
                    data-field="shelf_life"
                    value={shelfLife}
                    onChange={(e) => { setShelfLife(e.target.value); clearFieldError('shelf_life'); }}
                    onBlur={() => validateField('shelf_life')}
                    placeholder="365"
                    className="h-10"
                  />
                  <FieldErrorText field="shelf_life" errors={fieldErrors} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    加工工艺
                  </label>
                  <Input
                    data-field="processing_method"
                    value={processingMethod}
                    onChange={(e) => { setProcessingMethod(e.target.value); clearFieldError('processing_method'); }}
                    onBlur={() => validateField('processing_method')}
                    placeholder="例：喷雾干燥"
                    className="h-10"
                  />
                  <FieldErrorText field="processing_method" errors={fieldErrors} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    储藏条件
                  </label>
                  <Input
                    data-field="storage_conditions"
                    value={storageConditions}
                    onChange={(e) => { setStorageConditions(e.target.value); clearFieldError('storage_conditions'); }}
                    onBlur={() => validateField('storage_conditions')}
                    placeholder="例：阴凉干燥处保存"
                    className="h-10"
                  />
                  <FieldErrorText field="storage_conditions" errors={fieldErrors} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 提交 */}
          <Card>
            <CardFooter className="border-t border-[var(--border-color)] pt-[var(--space-apple-md)] justify-between">
              <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                {formCompleteness.percent === 100 ? (
                  <CheckCircle2 size={14} className="text-[var(--color-success-text)]0" />
                ) : (
                  <AlertCircle size={14} />
                )}
                <span>
                  已完成 {formCompleteness.filled}/{formCompleteness.total} 项
                  {formCompleteness.missing.length > 0 && (
                    <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] ml-1">
                      待填：{formCompleteness.missing.join('、')}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex gap-[var(--space-apple-sm)]">
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{name || '未命名配方'}</h2>
              {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const text = generatePreviewText();
                  await navigator.clipboard.writeText(text);
                  toast.success('已复制到剪贴板');
                } catch {
                  toast.error('复制失败');
                }
              }}
            >
              复制
            </Button>
          </div>

          {/* 目标功效 */}
          {effects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-2">目标功效</h4>
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
                <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider">成分组成</h4>
                {totalWeight > 0 && (
                  <span className="text-xs text-[var(--color-primary-text)]">总重 {formatTotalWeight(totalWeight)}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">序号</th>
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">成分</th>
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">角色</th>
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">用量</th>
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">占比</th>
                      <th className="text-left py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">备注</th>
                      <th className="text-center py-2 px-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">药食同源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, i) => (
                      <tr key={ing.id} className="border-b border-[var(--border-color)]">
                        <td className="py-2 px-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{i + 1}</td>
                        <td className="py-2 px-2 font-medium text-[var(--text-primary)]">{ing.name}</td>
                        <td className="py-2 px-2 text-[var(--text-secondary)]">{ing.role || '-'}</td>
                        <td className="py-2 px-2 text-[var(--text-secondary)] font-mono">
                          {ing.dosage_amount ? `${ing.dosage_amount}${ing.dosage_unit}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-[var(--color-primary-text)] font-mono">
                          {totalWeight > 0 && ing.dosage_amount ? `${ingredientPcts[i]}%` : '-'}
                        </td>
                        <td className="py-2 px-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">{ing.notes || '-'}</td>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-[var(--space-apple-sm)]">
            {[
              { label: '服用剂量', value: dosage },
              { label: '加工工艺', value: processingMethod },
              { label: '储藏条件', value: storageConditions },
              { label: '保质期', value: shelfLife ? `${shelfLife} 天` : null },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5">
                <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{label}</p>
                <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">{value ?? '未设置'}</p>
              </div>
            ))}
          </div>

          {/* 分析结果 */}
          {ingredients.length >= 2 && (previewAnalysis.synergy || previewAnalysis.stability || previewAnalysis.taste || previewAnalysis.safety) && (
            <div>
              <h4 className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] uppercase tracking-wider mb-[var(--space-apple-sm)]">分析结果</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2">
                {previewAnalysis.synergy && (
                  <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5 text-center">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">协同</p>
                    <p className="text-sm font-semibold text-[var(--color-primary-text)] mt-0.5">
                      {previewAnalysis.synergy.overall_si != null ? `${Math.round(previewAnalysis.synergy.overall_si * 100)}%` : '—'}
                    </p>
                  </div>
                )}
                {previewAnalysis.stability && (
                  <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5 text-center">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">稳定性</p>
                    <p className="text-sm font-semibold text-[var(--color-success-text)] dark:text-[var(--color-success-text)] mt-0.5">
                      {previewAnalysis.stability.stability_score != null ? `${Math.round(previewAnalysis.stability.stability_score)}分` : '—'}
                    </p>
                  </div>
                )}
                {previewAnalysis.taste && (
                  <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5 text-center">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">接受度</p>
                    <p className="text-sm font-semibold text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] mt-0.5">
                      {previewAnalysis.taste.acceptability != null ? `${Math.round(previewAnalysis.taste.acceptability * 100)}%` : '—'}
                    </p>
                  </div>
                )}
                {previewAnalysis.safety && (
                  <div className="bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] p-2.5 text-center">
                    <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">安全性</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {previewAnalysis.safety.is_safe
                        ? <span className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]">✓ 安全</span>
                        : <span className="text-[var(--color-error-text)] dark:text-[var(--color-error-text)]">✗ 需关注</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
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
  activeIndex,
  onActiveIndexChange,
}: {
  keyword: string;
  onSelect: (herb: TCMHerb) => void;
  existingIds: number[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  const [herbs, setHerbs] = useState<TCMHerb[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!keyword.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 关键词清空时同步重置下拉数据
      setHerbs([]);
      onActiveIndexChange(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      onActiveIndexChange(-1);
      try {
        const res = await databaseApi.searchHerbs({ keyword, page_size: 8 });
        setHerbs(res.items || []);
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
      <div className="absolute z-20 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-xl overflow-hidden">
        <div className="p-[var(--space-apple-sm)] text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <div className="w-4 h-4 border-2 border-[var(--color-primary-border)] border-t-primary-600 rounded-[var(--radius-pill)] animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (herbs.length === 0) {
    return (
      <div className="absolute z-20 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-xl overflow-hidden">
        <div className="p-[var(--space-apple-sm)] text-center text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">未找到匹配药材</div>
      </div>
    );
  }

  return (
    <div className="absolute z-20 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-Apple-md)] shadow-xl overflow-hidden max-h-56 overflow-y-auto">
      {herbs.map((herb, idx) => (
        <button
          key={herb.id}
          type="button"
          disabled={isDuplicate(herb.id)}
          onClick={() => onSelect(herb)}
          onMouseEnter={() => onActiveIndexChange(idx)}
          className={cn(
            'w-full text-left px-[var(--space-apple-sm)] py-2 text-sm hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border-color)] last:border-0',
            idx === activeIndex && 'bg-[var(--bg-tertiary)]',
            isDuplicate(herb.id) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--text-primary)]">{herb.name_cn || herb.name}</span>
              {herb.category && <span className="ml-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{herb.category}</span>}
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
          {(herb.effects || herb.efficacy) && <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 truncate">{herb.effects || herb.efficacy}</p>}
        </button>
      ))}
    </div>
  );
}
