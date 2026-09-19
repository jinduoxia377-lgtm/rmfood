/**
 * 配方详情页 - Phase 5 深度增强版（Tab 重构）
 * 配方信息、AI分析、评论区、导出、版本历史、审核、活动时间线、成分可视化
 * 新增: 5个Tab布局、内联编辑、版本对比/回滚、相关推荐、增强删除确认
 */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Send,
  CheckCircle2,
  XCircle,
  History,
  Shield,
  Activity,
  Leaf,
  MessageSquare,
  Download,
  ChevronDown,
  ChevronUp,
  Trash2,
  Reply,
  Copy,
  Star,
  Zap,
  GitCompare,
  Clock,
  BarChart3,
  Share2,
  Heart,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
  Check,
  Package,
  ListOrdered,
  GitBranch,
  Sparkles,
  FlaskConical,
  Thermometer,
  Wrench,
  AlertOctagon,
  TestTubes,
  Plus,
  FileText,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormula, useFormulaVersions, useSubmitFormula, useReviewFormula } from '@/hooks/useQueries';
import { useAuthStore } from '@/stores/auth';
import { StatusBadge, Skeleton, EmptyState } from '@/components/ui/Common';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Textarea,
  useToast,
  Modal,
  Input,
  Checkbox,
  Alert,
} from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { commentApi, type Comment } from '@/api/comment';
import { aiApi } from '@/api/ai';
import { formulaApi } from '@/api/formula';
import { calculateNutritionLabel } from '@/api/formula';
import { experimentApi } from '@/api/experiment';
import { validateFormulaName } from '@/utils/formulaValidator';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/safeLogger';
import { ActivityTimeline, generateMockTimeline } from './components/ActivityTimeline';
import { CommentItem } from './components/CommentItem';
import { CompositionChart } from './components/CompositionChart';
import { NutritionLabel, NutritionNRVChart, NutritionClaimBadges } from '@/components/nutrition';
import { FormulaCostAnalysis } from './components/FormulaCostAnalysis';
import { FormulaCompare } from './components/FormulaCompare';
import { VersionDiffViewer } from './components/VersionDiffViewer';
import { ShareFormula } from './components/ShareFormula';
import { useOperationLogger } from '@/utils/operationLogger';
import { usePermission, FormulaPermission } from '@/utils/permissions';
import { FormulaDetailSkeleton } from './components/FormulaDetailSkeleton';
import { ExplainabilityReport } from '@/components/report/ExplainabilityReport';
import { ReportExportPanel } from '@/components/report/ReportExportPanel';
import { EffectCurveChart } from '@/components/formula/EffectCurveChart';
import { ParetoFrontierChart } from '@/components/formula/ParetoFrontierChart';
import { TemplateEditor } from '@/components/formula/TemplateEditor';
import { useComplianceCheck, complianceApi } from '@/api/compliance';
import { explainabilityApi } from '@/api/explainability';
import { renderSynergyResult, renderStabilityResult, renderTasteResult, renderEffectResult, renderCompatResult, renderSafetyResult, ComplianceCheckSection, ExplainabilityReportSection, AnalysisCard } from './FormulaDetailSubComponents'

export default function FormulaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { has } = usePermission();
  const formulaId = Number(id);

  // ── 可解释性报告状态 ──
  const [explainabilityResult, setExplainabilityResult] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // ── 所有 Hooks 必须放在这里（在 early return 之前）──

  // 收藏功能 (localStorage) - 必须在 hooks 区域
  const [isFavorite, setIsFavorite] = useState(false);
  const FAV_KEY = 'rmfood_formula_favorites';

  // 复制配方相关
  const [copyLoading, setCopyLoading] = useState(false);

  // AI 分析相关
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // 评论相关
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  // 审核相关
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  // 详情页标签
  const [showCompare, setShowCompare] = useState(false);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);

  // 版本对比
  const [showVersionDiff, setShowVersionDiff] = useState(false);

  // 营养标签数据
  const [nutritionLabelData, setNutritionLabelData] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [diffLeftVersion, setDiffLeftVersion] = useState<{
    id: number;
    version: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    change_summary?: string;
  } | null>(null);
  const [diffRightVersion, setDiffRightVersion] = useState<{
    id: number;
    version: string;
    snapshot: Record<string, unknown>;
    created_at: string;
    change_summary?: string;
  } | null>(null);
  const [selectingDiffSide, setSelectingDiffSide] = useState<'left' | 'right' | null>(null);

  // 内联编辑状态（Tab 1: 基本信息）
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteInputValue, setDeleteInputValue] = useState('');

  // 推荐数据（Tab 5）
  const [recommendations, setRecommendations] = useState<
    {
      id: string;
      name: string;
      score: number;
      ingredients: { name: string; dosage: string }[];
      effects: string[];
    }[]
  >([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // ── 深度分析状态 ──
  const [analysisSynergy, setAnalysisSynergy] = useState<any>(null);
  const [analysisStability, setAnalysisStability] = useState<any>(null);
  const [analysisTaste, setAnalysisTaste] = useState<any>(null);
  const [analysisEffect, setAnalysisEffect] = useState<any>(null);
  const [analysisCompat, setAnalysisCompat] = useState<any>(null);
  const [analysisSafety, setAnalysisSafety] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  // Tab 懒加载控制
  const [activeTab, setActiveTab] = useState('basic');
  const renderedTabs = useRef(new Set(['basic', 'nutrition']));

  // 成分展开/折叠状态（Tab 2）
  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());

  // QueryClient
  const qc = useQueryClient();

  // Toast hook
  const { addToast } = useToast();

  // 数据获取
  const { data: formula, isLoading } = useFormula(formulaId);
  // 加载营养标签数据
  useEffect(() => {
    const fetchNutrition = async () => {
      if (!formulaId || isNaN(formulaId)) return;
      setNutritionLoading(true);
      try {
        const result = await calculateNutritionLabel(formulaId, { serving_size_g: 100 });
        setNutritionLabelData(result);
      } catch (e) {
        logger.error('Failed to load nutrition label', e);
      } finally {
        setNutritionLoading(false);
      }
    };
    fetchNutrition();
  }, [formulaId]);
  const { data: versions } = useFormulaVersions(formulaId);
  // 关联实验列表
  const { data: experimentsData } = useQuery({
    queryKey: ['experiments', 'formula', formulaId],
    queryFn: () => experimentApi.list({ formula_id: formulaId, page_size: 10 }),
    enabled: !!formulaId,
    staleTime: 5 * 60_000,
  });
  const experiments = experimentsData?.items ?? [];
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', 'formula', formulaId],
    queryFn: () => commentApi.list({ formula_id: formulaId, page: 1, page_size: 50 }),
    enabled: !!formulaId,
  });

  // Mutations
  const submitMut = useSubmitFormula();
  const reviewMut = useReviewFormula();
  const createCommentMut = useMutation({
    mutationFn: (data: { content: string; parent_id?: number }) =>
      commentApi.create({ formula_id: formulaId, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', 'formula', formulaId] });
      setCommentText('');
      setReplyTo(null);
    },
  });
  const deleteCommentMut = useMutation({
    mutationFn: (id: number) => commentApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', 'formula', formulaId] }),
  });

  // ── 解析安全检查结果 ──
  const safetyParsed = useMemo((): {
    passed: unknown;
    summary: string;
    items: { name: string; status: string; detail: string }[];
  } | null => {
    if (!formula?.safety_check || typeof formula.safety_check !== 'object') return null;
    const sc = formula.safety_check as Record<string, unknown>;
    return {
      passed: sc.passed ?? sc.is_passed ?? null,
      summary: (sc.summary ?? '') as string,
      items: Array.isArray(sc.items || sc.checks)
        ? ((sc.items || sc.checks) as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
            name: (item.name ?? item.check ?? '') as string,
            status: (item.status ?? item.result ?? '') as string,
            detail: (item.detail ?? item.message ?? '') as string,
          }))
        : [],
    };
  }, [formula?.safety_check]);

  // ── 解析协同分析结果 ──
  const synergyParsed = useMemo(() => {
    if (!formula?.synergy_analysis || typeof formula.synergy_analysis !== 'object') return null;
    const sa = formula.synergy_analysis as Record<string, unknown>;
    return {
      score: (sa.score ?? sa.overall_score ?? null) as number | null,
      summary: (sa.summary ?? '') as string,
      synergyPairs: Array.isArray(sa.synergy_pairs) ? sa.synergy_pairs : [],
      antagonismWarnings: Array.isArray(sa.antagonism_warnings) ? sa.antagonism_warnings : [],
      sharedPathways: Array.isArray(sa.shared_pathways) ? sa.shared_pathways : [],
    };
  }, [formula?.synergy_analysis]);

  // ── 解析成分列表（从 formula.ingredients API 响应）──
  const ingredientList = useMemo(() => {
    if (!formula?.ingredients || !Array.isArray(formula.ingredients)) return [];
    return formula.ingredients.map((ing: any) => ({
      name: ing.name || '-',
      category: ing.category || '-',
      is_food_homology: ing.is_food_homology === true,
      source: ing.source || '-',
      dosage: ing.properties?.dosage || '-',
    }));
  }, [formula?.ingredients]);

  // ── 活动时间线 ──
  const timeline = useMemo(() => {
    if (!formula) return [];
    return generateMockTimeline({
      created_at: formula.created_at || formula.createdAt,
      updated_at: formula.updated_at || formula.updatedAt,
      status: formula.status,
      reviewer_id: formula.reviewer_id ?? undefined,
      reviewed_at: formula.reviewed_at ?? undefined,
      review_notes: formula.review_notes ?? undefined,
    });
  }, [formula]);

  // 收藏功能 Effect
  useEffect(() => {
    const favs: number[] = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    setIsFavorite(favs.includes(formulaId));
  }, [formulaId]);

  // ── Early Returns（在所有 hooks 之后）──

  if (isLoading) {
    return <FormulaDetailSkeleton activeTab={activeTab} />;
  }

  if (!formula) {
    return (
      <div className="max-w-4xl mx-auto">
        <EmptyState
          icon={<FlaskConical size={48} strokeWidth={1.5} />}
          title="配方不存在"
          description="该配方可能已被删除或您没有访问权限"
          action={
            <Link to="/formulas">
              <Button variant="outline" size="sm">
                返回列表
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // ── 事件处理函数（在 early return 之后，因为依赖 formula）──

  const toggleFavorite = () => {
    const favs: number[] = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    if (isFavorite) {
      const idx = favs.indexOf(formulaId);
      if (idx > -1) favs.splice(idx, 1);
    } else {
      favs.push(formulaId);
    }
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    setIsFavorite(!isFavorite);
  };

  // ── 内联编辑功能（Tab 1）──
  const EDITABLE_FIELDS = ['name', 'description', 'targetEffects', 'category', 'tags', 'notes'] as const;

  const getChangedFields = useCallback((): Record<string, any> => {
    const changed: Record<string, any> = {};
    EDITABLE_FIELDS.forEach((key) => {
      if (!(key in editedData)) return;
      const editedVal = editedData[key];
      const originalVal = (formula as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(editedVal) !== JSON.stringify(originalVal ?? '')) {
        changed[key] = editedVal;
      }
    });
    return changed;
  }, [editedData, formula]);

  const hasChanges = Object.keys(getChangedFields()).length > 0;

  const isFieldChanged = useCallback(
    (field: string): boolean => {
      if (!(field in editedData)) return false;
      const editedVal = editedData[field];
      const originalVal = (formula as unknown as Record<string, unknown>)[field];
      return JSON.stringify(editedVal) !== JSON.stringify(originalVal ?? '');
    },
    [editedData, formula],
  );

  const startEditing = useCallback(() => {
    setEditedData({
      name: formula.name,
      description: formula.description || '',
      targetEffects: (formula.target_effects || formula.targetEffects) as string[] || [],
      category: formula.category || '',
      tags: formula.tags || [],
      notes: formula.notes || '',
    });
    setEditErrors({});
    setIsEditing(true);
  }, [formula]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditedData({});
    setEditErrors({});
    setIsSaving(false);
  }, []);

  const saveEditedData = useCallback(async () => {
    const nameErrors = validateFormulaName(editedData.name || '');
    if (nameErrors.length > 0) {
      setEditErrors({ name: nameErrors[0].message });
      return;
    }

    const changedFields = getChangedFields();
    if (Object.keys(changedFields).length === 0) {
      addToast({ type: 'info', message: '没有修改' });
      cancelEditing();
      return;
    }

    setIsSaving(true);
    try {
      await import('@/api/formula').then((m) => m.formulaApi.patch(formula.id, changedFields));
      qc.invalidateQueries({ queryKey: ['formula', formulaId] });
      addToast({ type: 'success', message: '配方信息已更新' });
      setIsEditing(false);
      setEditErrors({});
    } catch (error: any) {
      const msg = error?.message || '保存失败，请稍后重试';
      if (error?.detail) {
        try {
          const detail = typeof error.detail === 'string' ? JSON.parse(error.detail) : error.detail;
          if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
            setEditErrors(
              Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])),
            );
            addToast({ type: 'error', message: '部分字段校验失败，请检查' });
          } else {
            addToast({ type: 'error', message: msg });
          }
        } catch {
          addToast({ type: 'error', message: msg });
        }
      } else {
        addToast({ type: 'error', message: msg });
      }
    } finally {
      setIsSaving(false);
    }
  }, [editedData, formula, formulaId, qc, addToast, cancelEditing, getChangedFields]);

  const updateEditedField = useCallback(
    (field: string, value: any) => {
      setEditedData((prev) => ({ ...prev, [field]: value }));
      // 清除该字段的错误
      if (editErrors[field]) {
        setEditErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [editErrors],
  );

  // ── 删除功能（增强确认）──
  const handleDelete = async () => {
    if (!deleteConfirmed || deleteInputValue !== formula.name) {
      return;
    }

    try {
      await import('@/api/formula').then((m) => m.formulaApi.delete(formula.id));
      addToast({
        type: 'success',
        message: `配方 "${formula.name}" 已删除`,
        duration: 5000,
      });

      logger.info('删除配方成功', { formula_id: formula.id, formula_name: formula.name });

      navigate('/formulas');
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || '删除失败，请稍后重试' });
      logger.error('删除配方失败', { formula_id: formula.id, error: error?.message });
    }
  };

  // ── 推荐功能（Tab 5）──
  const loadRecommendations = useCallback(async () => {
    const effects = (formula.target_effects || formula.targetEffects) as string[];
    if (!effects || effects.length === 0) {
      addToast({ type: 'info', message: '暂无目标功效，无法生成推荐' });
      return;
    }

    setLoadingRecommendations(true);
    try {
      const data = await import('@/api/formula').then((m) =>
        m.formulaApi.recommendations((formula.target_effects || formula.targetEffects) as string[]),
      );
      setRecommendations(data);
    } catch (error: any) {
      addToast({ type: 'error', message: error?.message || '加载推荐失败' });
    } finally {
      setLoadingRecommendations(false);
    }
  }, [(formula.target_effects || formula.targetEffects) as string[], addToast]);

  // ── 成分展开/折叠（Tab 2）──
  const toggleIngredientExpand = useCallback((name: string) => {
    setExpandedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── 复制成分列表到剪贴板（Tab 2）──
  const copyIngredientListToClipboard = useCallback(async () => {
    if (ingredientList.length === 0) return;

    const text = ingredientList
      .map((ing, idx) => `${idx + 1}. ${ing.name} | 用量: ${ing.dosage} | 分类: ${ing.category} | 来源: ${ing.source}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', message: '成分列表已复制到剪贴板' });
    } catch {
      addToast({ type: 'error', message: '复制失败，请手动选择复制' });
    }
  }, [ingredientList, addToast]);

  const handleCopyFormula = async () => {
    if (!formula) return;
    setCopyLoading(true);
    try {
      const { ...data } = formula;
      // 将null值转换为undefined以符合FormulaCreatePayload类型
      const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = value === null ? undefined : value;
        return acc;
      }, {} as Record<string, unknown>);
      const copied = await import('@/api/formula').then((m) =>
        m.formulaApi.create({
          ...sanitizedData,
          name: `${formula.name} (副本)`,
        }),
      );
      addToast({ type: 'success', message: `配方已复制: ${copied.name}` });
      navigate(`/formulas/${copied.id}`);
    } catch {
      addToast({ type: 'error', message: '复制失败，请稍后重试' });
    } finally {
      setCopyLoading(false);
    }
  };

  const handleRunAIAnalysis = async () => {
    if (!formula || !ingredientList.length) return;
    setAiAnalyzing(true);
    try {
      const names = ingredientList.map((i) => i.name);
      const [safetyRes, synergyRes] = await Promise.all([aiApi.safetyCheck(names), aiApi.synergyAnalysis(names)]);
      await import('@/api/formula').then((m) =>
        m.formulaApi.update(formula.id, {
          safety_check: safetyRes,
          synergy_analysis: synergyRes,
        }),
      );
      qc.invalidateQueries({ queryKey: ['formula', formulaId] });
      addToast({ type: 'success', message: 'AI 分析完成，安全检查和协同分析已更新' });
    } catch {
      addToast({ type: 'error', message: 'AI 分析失败，请稍后重试' });
    } finally {
      setAiAnalyzing(false);
    }
  };

  // ── 深度分析处理函数 ──
  const runAllAnalyses = useCallback(async () => {
    if (!formula || !ingredientList.length) return;
    setIsAnalyzing(true);
    try {
      const {
        analyzeFormulaSynergy,
        predictFormulaStability,
        predictFormulaTaste,
        predictFormulaEffect,
        checkFormulaCompatibility,
        checkFormulaSafety,
      } = await import('@/api/formula');

      const { temperature_c, humidity_pct, light_exposure } = { temperature_c: 25, humidity_pct: 60, light_exposure: 'normal' };

      const [synergy, stability, taste, effect, compat, safety] = await Promise.all([
        analyzeFormulaSynergy(formulaId),
        predictFormulaStability(formulaId, { temperature_c, humidity_pct, light_exposure }),
        predictFormulaTaste(formulaId),
        predictFormulaEffect(formulaId, { body_weight_kg: 70, simulation_hours: 24 }),
        checkFormulaCompatibility(formulaId),
        checkFormulaSafety(formulaId, { daily_dosage_g: 10, target_group: 'adult' }),
      ]);

      setAnalysisSynergy(synergy);
      setAnalysisStability(stability);
      setAnalysisTaste(taste);
      setAnalysisEffect(effect);
      setAnalysisCompat(compat);
      setAnalysisSafety(safety);
      addToast({ type: 'success', message: '所有深度分析完成' });
    } catch (err) {
      console.error('深度分析失败:', err);
      addToast({ type: 'error', message: '深度分析失败，请稍后重试' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [formulaId, formula, ingredientList, qc, addToast]);

  const runOptimizeLP = useCallback(async () => {
    if (!formula) return;
    setIsOptimizing(true);
    setOptimizationResult(null);
    try {
      const { optimizeLP } = await import('@/api/formula');
      const result = await optimizeLP(formulaId, { total_dosage_g: 100 });
      setOptimizationResult(result);
      addToast({ type: 'success', message: '配比优化完成' });
    } catch (err) {
      console.error('配比优化失败:', err);
      addToast({ type: 'error', message: '配比优化失败' });
    } finally {
      setIsOptimizing(false);
    }
  }, [formulaId, addToast]);

  const runExportFormula = useCallback(async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const { exportFormulaPDF, exportFormulaExcel } = await import('@/api/formula');
      let blob: Blob;
      if (format === 'pdf') {
        const data = await exportFormulaPDF(formulaId);
        // Create a simple text representation for PDF
        const content = JSON.stringify(data, null, 2);
        blob = new Blob([content], { type: 'application/json' });
      } else {
        blob = await exportFormulaExcel(formulaId);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `formula_${formulaId}.${format === 'pdf' ? 'json' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: `已导出为 ${format.toUpperCase()}` });
    } catch (err) {
      console.error('导出失败:', err);
      addToast({ type: 'error', message: '导出失败' });
    } finally {
      setIsExporting(false);
    }
  }, [formulaId, addToast]);

  const runApplyOptimization = useCallback(async () => {
    if (!optimizationResult?.ratios?.length) return;
    setIsOptimizing(true);
    try {
      const { applyOptimization } = await import('@/api/formula');
      const result = await applyOptimization(formulaId, { ratios: optimizationResult.ratios });
      addToast({ type: 'success', message: result.message || '优化结果已应用到配方' });
      setOptimizationResult(null);
    } catch (err) {
      console.error('应用优化失败:', err);
      addToast({ type: 'error', message: '应用优化失败' });
    } finally {
      setIsOptimizing(false);
    }
  }, [formulaId, optimizationResult, addToast]);

  const runSaveAnalysis = useCallback(async (type: string, result: any) => {
    try {
      const { saveAnalysisResult } = await import('@/api/formula');
      await saveAnalysisResult(formulaId, type, result);
      addToast({ type: 'success', message: '分析结果已保存' });
    } catch (err) {
      console.error('保存分析失败:', err);
    }
  }, [formulaId, addToast]);

  const runAnalysis = useCallback(async (type: 'synergy' | 'stability' | 'taste' | 'effect' | 'compat' | 'safety') => {
    try {
      const {
        analyzeFormulaSynergy,
        predictFormulaStability,
        predictFormulaTaste,
        predictFormulaEffect,
        checkFormulaCompatibility,
        checkFormulaSafety,
      } = await import('@/api/formula');
      switch (type) {
        case 'synergy': {
          const r = await analyzeFormulaSynergy(formulaId);
          setAnalysisSynergy(r);
          break;
        }
        case 'stability': {
          const r = await predictFormulaStability(formulaId);
          setAnalysisStability(r);
          break;
        }
        case 'taste': {
          const r = await predictFormulaTaste(formulaId);
          setAnalysisTaste(r);
          break;
        }
        case 'effect': {
          const r = await predictFormulaEffect(formulaId);
          setAnalysisEffect(r);
          break;
        }
        case 'compat': {
          const r = await checkFormulaCompatibility(formulaId);
          setAnalysisCompat(r);
          break;
        }
        case 'safety': {
          const r = await checkFormulaSafety(formulaId, { daily_dosage_g: 10, target_group: 'adult' });
          setAnalysisSafety(r);
          break;
        }
      }
      addToast({ type: 'success', message: `${type} 分析完成` });
    } catch (err) {
      console.error(`分析失败 [${type}]:`, err);
      addToast({ type: 'error', message: `${type} 分析失败，请稍后重试` });
    }
  }, [formulaId, addToast]);

  const toggleReplies = (commentId: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const handleReview = (approved: boolean) => {
    if (!reviewNotes.trim()) {
      setReviewAction(approved ? 'approve' : 'reject');
      return;
    }
    reviewMut.mutate({
      id: formula.id,
      approved,
      notes: reviewNotes,
    });
    setReviewNotes('');
    setReviewAction(null);
  };

  const handleExport = () => {
    const exportData = {
      name: formula.name,
      code: formula.code,
      description: formula.description,
      status: formula.status,
      version: formula.version,
      targetEffects: (formula.target_effects || formula.targetEffects) as string[],
      composition: formula.composition,
      processing_method: formula.processing_method,
      dosage: formula.dosage,
      storage_conditions: formula.storage_conditions,
      shelf_life: formula.shelf_life,
      safety_check: formula.safety_check,
      synergy_analysis: formula.synergy_analysis,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formula.code}_${formula.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Tab 懒加载处理 ──
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      renderedTabs.current.add(tab);

      if (tab === 'recommendations' && recommendations.length === 0 && !loadingRecommendations) {
        setLoadingRecommendations(true);
        // getRecommendations not available on aiApi; skip for now
        setLoadingRecommendations(false);
      }
    },
    [formulaId, recommendations.length, loadingRecommendations],
  );

  // ── 派生状态 ──

  const canEdit = formula.status === 'draft' || (formula.status as string) === 'rejected';
  const canSubmit = formula.status === 'draft';
  const canReview = (formula.status as string) === 'pending_review' && has(FormulaPermission.AUDIT);
  const hasAnalysisData = safetyParsed || synergyParsed || ingredientList.length > 0;

  // 成分总用量统计
  const totalDosage = useMemo(() => {
    if (!ingredientList.length) return null;
    return ingredientList.reduce((sum, ing) => {
      const dosage = parseFloat(String(ing.dosage).replace(/[^\d.]/g, '')) || 0;
      return sum + dosage;
    }, 0);
  }, [ingredientList]);

  // 制作步骤数据（从 composition 中解析）
  const processSteps = useMemo(() => {
    if (!formula?.composition || typeof formula.composition !== 'object') return [];
    const comp = formula.composition as Record<string, unknown>;
    const steps = comp.process_steps ?? comp.steps;
    if (!Array.isArray(steps)) return [];
    return steps.map((step: Record<string, unknown>, idx: number) => ({
      step_number: (step.step_number ?? idx + 1) as number,
      description: (step.description ?? '') as string,
      temperature: step.temperature as { min?: number; max?: number; unit?: string } | undefined,
      duration: step.duration as { value?: number; unit?: string } | undefined,
      equipment: (step.equipment ?? '') as string,
      notes: (step.notes ?? '') as string,
    }));
  }, [formula?.composition]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 px-4 md:px-0">
      {/* 返回 + 操作栏（移动端优化） */}
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <button
          onClick={() => navigate('/formulas')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">返回列表</span>
          <span className="sm:hidden">返回</span>
        </button>
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {/* 收藏 */}
          <Button
            variant="ghost"
            size="sm"
            icon={<Star size={14} className={isFavorite ? 'fill-amber-400 text-warning-400' : ''} />}
            onClick={toggleFavorite}
          />
          {/* 编辑（切换内联编辑模式）*/}
          {canEdit && has(FormulaPermission.EDIT) && !isEditing && (
            <Button variant="secondary" size="sm" icon={<Edit3 size={14} />} onClick={startEditing}>
              编辑
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={cancelEditing} disabled={isSaving}>
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={14} />}
                onClick={saveEditedData}
                loading={isSaving}
                disabled={!hasChanges || isSaving}
              >
                保存
              </Button>
            </>
          )}
          {/* 复制配方 */}
          {has(FormulaPermission.CREATE) && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Copy size={14} />}
              onClick={handleCopyFormula}
              loading={copyLoading}
            >
              复制
            </Button>
          )}
          {/* 从此配方创建实验 */}
          {has(FormulaPermission.CREATE) && (
            <Link to={`/experiments/new?formula_id=${formula.id}`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<TestTubes size={14} />}
              >
                创建实验
              </Button>
            </Link>
          )}
          {/* AI 分析 */}
          {canEdit && has(FormulaPermission.EDIT) && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Zap size={14} />}
              loading={aiAnalyzing}
              onClick={handleRunAIAnalysis}
              disabled={ingredientList.length === 0}
            >
              AI 分析
            </Button>
          )}
          {canSubmit && has(FormulaPermission.AUDIT) && (
            <Button
              size="sm"
              icon={<Send size={14} />}
              onClick={() => submitMut.mutate(formula.id)}
              loading={submitMut.isPending}
              className="bg-warning-500 hover:bg-warning-600 shadow-amber-600/25"
            >
              提交审核
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<GitCompare size={14} />}
            onClick={() => {
              setCompareId(formula.id);
              setShowCompare(true);
            }}
          >
            对比
          </Button>
          <Button variant="ghost" size="sm" icon={<Share2 size={14} />} onClick={() => setShowShare(true)}>
            分享
          </Button>
          {has(FormulaPermission.EXPORT) && (
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={handleExport}>
              导出
            </Button>
          )}
          {/* 删除按钮 */}
          {has(FormulaPermission.DELETE) && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteConfirmed(false);
                setDeleteInputValue('');
              }}
            >
              删除
            </Button>
          )}
        </div>
      </div>

      {/* 配方头部 */}
      <Card>
        <CardContent>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="h1 text-neutral-900 dark:text-white">{formula.name}</h1>
                <StatusBadge status={formula.status} />
                {isEditing && (
                  <Badge variant="neutral" size="sm">
                    编辑中
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {formula.code} · 版本 v{formula.version} · 创建于{' '}
                {new Date(formula.created_at || formula.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
          </div>

          {/* Tabs 布局（响应式） */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 md:mt-6">
            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 pb-2">
              <TabsList className="border-b border-neutral-200 dark:border-neutral-700 bg-transparent p-0 h-auto gap-0 min-w-max md:min-w-0">
                <TabsTrigger value="basic" icon={<Package size={14} />}>
                  基本信息
                </TabsTrigger>
                <TabsTrigger value="ingredients" icon={<BarChart3 size={14} />}>
                  成分列表
                </TabsTrigger>
                <TabsTrigger value="steps" icon={<ListOrdered size={14} />}>
                  制作步骤
                </TabsTrigger>
                <TabsTrigger value="versions" icon={<GitBranch size={14} />}>
                  版本历史
                </TabsTrigger>
                <TabsTrigger value="recommendations" icon={<Sparkles size={14} />}>
                  相关推荐
                </TabsTrigger>
                <TabsTrigger value="explainability" icon={<FileText size={14} />}>
                  可解释性
                </TabsTrigger>
                <TabsTrigger value="analysis" icon={<FlaskConical size={14} />}>
                  深度分析
                </TabsTrigger>
                <TabsTrigger value="nutrition" icon={<Leaf size={14} />}>
                  营养成分
                </TabsTrigger>
              </TabsList>

              {/* ═══════════════ Tab 1: 基本信息 ═══════════════ */}
              <TabsContent value="basic">
                <div className="space-y-4 pt-4">
                  {/* 配方名称 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">配方名称</label>
                    <div
                      className={cn(
                        'md:col-span-2',
                        isEditing && isFieldChanged('name') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-1">
                          <Input
                            value={editedData.name || ''}
                            onChange={(e) => updateEditedField('name', e.target.value)}
                            error={editErrors.name}
                            placeholder="请输入配方名称"
                          />
                          {editErrors.name && <p className="text-xs text-error-500">{editErrors.name}</p>}
                        </div>
                      ) : (
                        <p className="text-neutral-900 dark:text-white font-medium">{formula.name}</p>
                      )}
                    </div>
                  </div>

                  {/* 描述 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">描述</label>
                    <div
                      className={cn(
                        'md:col-span-2',
                        isEditing && isFieldChanged('description') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                      )}
                    >
                      {isEditing ? (
                        <Textarea
                          value={editedData.description || ''}
                          onChange={(e) => updateEditedField('description', e.target.value)}
                          placeholder="请输入配方描述"
                          rows={3}
                        />
                      ) : (
                        <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {formula.description || '-'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 目标功效 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">目标功效</label>
                    <div
                      className={cn(
                        'md:col-span-2',
                        isEditing && isFieldChanged('targetEffects') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                      )}
                    >
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          {(editedData.targetEffects || []).map((effect: string) => (
                            <Badge key={effect} variant="primary">
                              {effect}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {((formula.target_effects || formula.targetEffects) as string[]).length > 0 ? (
                            ((formula.target_effects || formula.targetEffects) as string[]).map((effect: string) => (
                              <Badge key={effect} variant="primary">
                                {effect}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 分类 & 标签 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-3 gap-4 items-start">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">分类</label>
                      <div
                        className={cn(
                          'col-span-2',
                          isEditing && isFieldChanged('category') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                        )}
                      >
                        {isEditing ? (
                          <Input
                            value={editedData.category || ''}
                            onChange={(e) => updateEditedField('category', e.target.value)}
                            placeholder="请输入分类"
                          />
                        ) : (
                          <p className="text-neutral-600 dark:text-neutral-400">{formula.category || '-'}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-start">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">标签</label>
                      <div
                        className={cn(
                          'col-span-2',
                          isEditing && isFieldChanged('tags') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                        )}
                      >
                        {isEditing ? (
                          <div className="flex flex-wrap gap-1">
                            {(editedData.tags || []).map((tag: string) => (
                              <Badge key={tag} variant="neutral" size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {formula.tags && formula.tags.length > 0 ? (
                              formula.tags.map((tag) => (
                                <Badge key={tag} variant="neutral" size="sm">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 备注 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2">备注</label>
                    <div
                      className={cn(
                        'md:col-span-2',
                        isEditing && isFieldChanged('notes') && 'border-l-3 border-primary-500 pl-3 -ml-3',
                      )}
                    >
                      {isEditing ? (
                        <Textarea
                          value={editedData.notes || ''}
                          onChange={(e) => updateEditedField('notes', e.target.value)}
                          placeholder="请输入备注"
                          rows={2}
                        />
                      ) : (
                        <p className="text-neutral-600 dark:text-neutral-400">{formula.notes || '-'}</p>
                      )}
                    </div>
                  </div>

                  {/* 配方参数 */}
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    {[
                      { label: '服用剂量', value: formula.dosage },
                      { label: '加工工艺', value: formula.processing_method },
                      { label: '储藏条件', value: formula.storage_conditions },
                      { label: '保质期', value: formula.shelf_life ? `${formula.shelf_life} 天` : null },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{value ?? '-'}</p>
                      </div>
                    ))}
                  </div>

                  {/* 元信息 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
                    <div>
                      <p className="mb-0.5">创建者</p>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">{formula.creator_name || '-'}</p>
                    </div>
                    <div>
                      <p className="mb-0.5">创建时间</p>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        {new Date(formula.created_at || formula.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5">更新时间</p>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        {new Date(formula.updated_at || formula.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>

                  {/* 编辑操作按钮 */}
                  {isEditing && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      {!hasChanges && <p className="text-xs text-neutral-400 self-center mr-auto">没有修改</p>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditing}
                        icon={<X size={14} />}
                        disabled={isSaving}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEditedData}
                        icon={<Save size={14} />}
                        loading={isSaving}
                        disabled={!hasChanges || isSaving}
                      >
                        保存更改
                      </Button>
                    </div>
                  )}

                  {/* AI 分析摘要区域（保留现有功能）*/}
                  {hasAnalysisData && !isEditing && (
                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                        <Activity size={20} className="text-primary-500" />
                        AI 分析摘要
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 安全检查摘要 */}
                        {safetyParsed && (
                          <div
                            className={`rounded-xl p-4 border ${
                              safetyParsed.passed
                                ? 'border-green-200 bg-success-50/50 dark:border-green-800 dark:bg-success-900/10'
                                : 'border-red-200 bg-error-50/50 dark:border-red-800 dark:bg-error-900/10'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Shield size={16} className={safetyParsed.passed ? 'text-success-600' : 'text-error-600'} />
                              <span className="font-semibold text-sm">安全检查</span>
                              <Badge variant={safetyParsed.passed ? 'success' : 'danger'} size="sm">
                                {safetyParsed.passed ? '通过' : '未通过'}
                              </Badge>
                            </div>
                            {safetyParsed.summary && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-300">{safetyParsed.summary}</p>
                            )}
                          </div>
                        )}

                        {/* 协同分析摘要 */}
                        {synergyParsed && (
                          <div className="rounded-xl p-4 border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Leaf size={16} className="text-primary-600" />
                              <span className="font-semibold text-sm">协同分析</span>
                              {synergyParsed.score !== null && (
                                <Badge variant="primary" size="sm">
                                  评分: {synergyParsed.score}
                                </Badge>
                              )}
                            </div>
                            {synergyParsed.summary && (
                              <p className="text-sm text-neutral-600 dark:text-neutral-300">{synergyParsed.summary}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══════════════ Tab 2: 成分列表 ═══════════════ */}
              {renderedTabs.current.has('ingredients') && (
                <TabsContent value="ingredients">
                  <div className="space-y-4 pt-4">
                    {/* 操作栏 */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <BarChart3 size={20} />
                        成分列表
                        <Badge variant="neutral" size="sm">
                          {ingredientList.length} 种成分
                        </Badge>
                      </h2>
                      <div className="flex items-center gap-2">
                        {totalDosage !== null && (
                          <span className="text-sm text-neutral-500">
                            总用量:{' '}
                            <strong className="text-neutral-900 dark:text-white">{totalDosage.toFixed(2)}g</strong>
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Copy size={14} />}
                          onClick={copyIngredientListToClipboard}
                          disabled={ingredientList.length === 0}
                        >
                          复制列表
                        </Button>
                      </div>
                    </div>

                    {ingredientList.length > 0 ? (
                      <>
                        {/* 成分表格 */}
                        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                              <tr>
                                <th className="text-left p-3 text-neutral-500 font-medium w-12">#</th>
                                <th className="text-left p-3 text-neutral-500 font-medium">成分名称</th>
                                <th className="text-left p-3 text-neutral-500 font-medium">用量(g)</th>
                                <th className="text-left p-3 text-neutral-500 font-medium">分类</th>
                                <th className="text-left p-3 text-neutral-500 font-medium">来源</th>
                                <th className="text-center p-3 text-neutral-500 font-medium w-24">药食同源</th>
                                <th className="text-center p-3 text-neutral-500 font-medium w-20">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {ingredientList.map((ing, i) => (
                                <>
                                  <tr
                                    key={ing.name}
                                    className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
                                  >
                                    <td className="p-3 text-neutral-500">{i + 1}</td>
                                    <td className="p-3 text-neutral-900 dark:text-white font-medium">{ing.name}</td>
                                    <td className="p-3 text-neutral-600 dark:text-neutral-400">{ing.dosage}</td>
                                    <td className="p-3 text-neutral-600 dark:text-neutral-400">{ing.category}</td>
                                    <td className="p-3 text-neutral-600 dark:text-neutral-400">{ing.source}</td>
                                    <td className="p-3 text-center">
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
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => toggleIngredientExpand(ing.name)}
                                        className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors"
                                      >
                                        {expandedIngredients.has(ing.name) ? '收起' : '详情'}
                                      </button>
                                    </td>
                                  </tr>
                                  {/* 展开详情行 */}
                                  {expandedIngredients.has(ing.name) && (
                                    <tr key={`${ing.name}-detail`}>
                                      <td colSpan={7} className="p-4 bg-slate-50/50 dark:bg-neutral-800/30">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                          <div>
                                            <p className="text-neutral-500 mb-1">性味归经</p>
                                            <p className="text-neutral-700 dark:text-neutral-300">-</p>
                                          </div>
                                          <div>
                                            <p className="text-neutral-500 mb-1">化学成分</p>
                                            <p className="text-neutral-700 dark:text-neutral-300">-</p>
                                          </div>
                                          <div>
                                            <p className="text-neutral-500 mb-1">药理作用</p>
                                            <p className="text-neutral-700 dark:text-neutral-300">-</p>
                                          </div>
                                          <div>
                                            <p className="text-neutral-500 mb-1">注意事项</p>
                                            <p className="text-neutral-700 dark:text-neutral-300">-</p>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* 成分可视化图表 */}
                        <div className="pt-4">
                          <CompositionChart ingredients={ingredientList} />
                        </div>
                      </>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                        <p>暂无成分数据</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ═══════════════ Tab: 营养成分 ═══════════════ */}
              {renderedTabs.current.has("nutrition") && (
                <TabsContent value="nutrition">
                  <div className="space-y-6 pt-4">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Leaf size={20} />
                      营养成分表
                      <Badge variant="neutral" size="sm">GB 28050-2011</Badge>
                    </h2>
                    
                    {/* 营养标签 */}
                    {nutritionLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <span className="text-sm text-neutral-500">加载营养数据中...</span>
                      </div>
                    ) : nutritionLabelData ? (
                      <>
                        <NutritionLabel data={nutritionLabelData} showServing />
                        
                        {/* NRV环形图 */}
                        {nutritionLabelData.label_items && nutritionLabelData.label_items.length > 0 && (
                          <NutritionNRVChart
                            items={nutritionLabelData.label_items
                              .filter((item: {nutrient: string; nrv_percent: number | null; unit: string}) => item.nrv_percent != null && item.nrv_percent! > 0)
                              .map((item: {nutrient: string; nrv_percent: number | null; unit: string}) => ({
                                nutrient: item.nutrient,
                                nrv_percent: item.nrv_percent,
                                unit: item.unit,
                              }))}
                            size={100}
                            className="mt-6"
                          />
                        )}
                        
                        {/* 营养声称 */}
                        {nutritionLabelData.claims && nutritionLabelData.claims.length > 0 && (
                          <NutritionClaimBadges claims={nutritionLabelData.claims} className="mt-4" />
                        )}
                        
                        {/* 合规提示 */}
                        {nutritionLabelData.warnings && nutritionLabelData.warnings.length > 0 && (
                          <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/10 rounded-lg">
                            {nutritionLabelData.warnings.map((w: string, i: number) => (
                              <p key={i} className="text-sm text-warning-700 dark:text-warning-400">
                                ⚠ {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <Leaf size={48} className="mx-auto mb-3 opacity-50" />
                        <p>暂无营养数据</p>
                        <p className="text-xs mt-1">请确保配方包含已知药材</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ═══════════════ Tab 3: 制作步骤 ═══════════════ */}
              {renderedTabs.current.has('steps') && (
                <TabsContent value="steps">
                  <div className="space-y-4 pt-4">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <ListOrdered size={20} />
                      制作步骤
                      <Badge variant="neutral" size="sm">
                        {processSteps.length} 步
                      </Badge>
                    </h2>

                    {processSteps.length > 0 ? (
                      <div className="relative">
                        {/* 时间线连接线 */}
                        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

                        <div className="space-y-6">
                          {processSteps.map((step, index) => (
                            <div key={index} className="relative flex gap-4 pl-4">
                              {/* 时间线节点 */}
                              <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 border-4 border-white dark:border-neutral-900 flex items-center justify-center">
                                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                  {step.step_number}
                                </span>
                              </div>

                              {/* 步骤内容卡片 */}
                              <div className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-semibold text-neutral-900 dark:text-white">
                                    步骤 {step.step_number}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    {step.temperature && (
                                      <span className="px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                                        <Thermometer className="w-3 h-3 inline mr-0.5" />{step.temperature.min}-{step.temperature.max}
                                        {step.temperature.unit}
                                      </span>
                                    )}
                                    {step.duration && (
                                      <span className="px-2 py-1 rounded-full bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400">
                                        ⏱️ {step.duration.value}
                                        {step.duration.unit}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                                  {step.description}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-neutral-500">
                                  {step.equipment && <span><Wrench className="w-3 h-3 inline mr-0.5" />设备: {step.equipment}</span>}
                                  {step.notes && <span><AlertOctagon className="w-3 h-3 inline mr-0.5" />{step.notes}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <ListOrdered size={48} className="mx-auto mb-3 opacity-50" />
                        <p>暂无制作步骤</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ═══════════════ Tab 4: 版本历史 ═══════════════ */}
              {renderedTabs.current.has('versions') && (
                <TabsContent value="versions">
                  <div className="space-y-4 pt-4">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <GitBranch size={20} />
                      版本历史
                      <Badge variant="neutral" size="sm">
                        {versions?.length || 0} 个版本
                      </Badge>
                    </h2>

                    {versions && versions.length > 0 ? (
                      <div className="relative">
                        {/* 时间线 */}
                        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-neutral-200 dark:bg-neutral-700" />

                        <div className="space-y-4">
                          {versions.map((v, index) => (
                            <div key={v.id} className="relative flex gap-4 pl-4">
                              {/* 版本节点 */}
                              <div
                                className={cn(
                                  'relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-4 border-white dark:border-neutral-900 flex items-center justify-center',
                                  v.is_current
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500',
                                )}
                              >
                                <GitBranch size={16} />
                              </div>

                              {/* 版本内容 */}
                              <div
                                className={cn(
                                  'flex-1 rounded-xl border p-4',
                                  v.is_current
                                    ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/10'
                                    : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800',
                                )}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-neutral-900 dark:text-white">
                                      v{v.version_number || v.version_label}
                                    </span>
                                    {v.is_current && (
                                      <Badge variant="success" size="sm">
                                        当前版本
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-400">
                                      {new Date(v.created_at).toLocaleString('zh-CN')}
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                      by {v.changed_by_name || v.changed_by || '-'}
                                    </span>
                                  </div>
                                </div>

                                {v.change_summary && (
                                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-3">{v.change_summary}</p>
                                )}

                                <div className="flex items-center gap-2">
                                  {/* 对比按钮 */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={<GitCompare size={12} />}
                                    onClick={() => {
                                      setSelectingDiffSide('left');
                                      setDiffLeftVersion({
                                        id: Number(v.id),
                                        version: String(v.version_number || v.version_label),
                                        snapshot: v.snapshot,
                                        created_at: v.created_at,
                                        change_summary: v.change_summary || undefined,
                                      });
                                      setShowVersionDiff(true);
                                    }}
                                  >
                                    对比
                                  </Button>

                                  {/* 回滚按钮（非当前版本才显示）*/}
                                  {!v.is_current && canEdit && has(FormulaPermission.MANAGE) && (
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      icon={<History size={12} />}
                                      onClick={async () => {
                                        if (
                                          !confirm(
                                            `确定要回滚到版本 v${v.version_number || v.version_label} 吗？此操作不可撤销。`,
                                          )
                                        ) {
                                          return;
                                        }
                                        try {
                                          await import('@/api/formula').then((m) =>
                                            m.formulaApi.rollbackToVersion(formulaId, String(v.id)),
                                          );
                                          qc.invalidateQueries({ queryKey: ['formula', formulaId] });
                                          qc.invalidateQueries({ queryKey: ['formula-versions', formulaId] });
                                          addToast({
                                            type: 'success',
                                            message: `已回滚到版本 v${v.version_number || v.version_label}`,
                                          });

                                          logger.info('版本回滚成功', { formula_id: formulaId, version: v.version_number });
                                        } catch (error: any) {
                                          addToast({ type: 'error', message: error?.message || '回滚失败' });
                                          logger.error('版本回滚失败', { formula_id: formulaId, error: error?.message });
                                        }
                                      }}
                                    >
                                      回滚到此版本
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <GitBranch size={48} className="mx-auto mb-3 opacity-50" />
                        <p>暂无版本记录</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ═══════════════ Tab 5: 相关推荐 ═══════════════ */}
              {renderedTabs.current.has('recommendations') && (
                <TabsContent value="recommendations">
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Sparkles size={20} />
                        相关推荐
                        {recommendations.length > 0 && (
                          <Badge variant="neutral" size="sm">
                            {recommendations.length} 个推荐
                          </Badge>
                        )}
                      </h2>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        onClick={loadRecommendations}
                        loading={loadingRecommendations}
                      >
                        换一批
                      </Button>
                    </div>

                    {recommendations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommendations.map((rec) => (
                          <Link
                            key={rec.id}
                            to={`/formulas/${rec.id}`}
                            className="block rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all"
                          >
                            {/* 推荐头部 */}
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-semibold text-neutral-900 dark:text-white line-clamp-2">{rec.name}</h4>
                              <div className="flex-shrink-0 ml-2 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold">
                                {Math.round(rec.score * 100)}%
                              </div>
                            </div>

                            {/* 匹配点标签 */}
                            <div className="flex flex-wrap gap-1 mb-3">
                              {rec.effects.slice(0, 3).map((effect) => (
                                <Badge key={effect} variant="info" size="sm">
                                  {effect}
                                </Badge>
                              ))}
                              {rec.effects.length > 3 && (
                                <Badge variant="neutral" size="sm">
                                  +{rec.effects.length - 3}
                                </Badge>
                              )}
                            </div>

                            {/* 关键成分预览 */}
                            <div className="text-xs text-neutral-500 space-y-1">
                              <p className="font-medium text-neutral-600 dark:text-neutral-400">关键成分:</p>
                              <div className="flex flex-wrap gap-1">
                                {rec.ingredients.slice(0, 4).map((ing) => (
                                  <span key={ing.name} className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700">
                                    {ing.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-neutral-400">
                        <Sparkles size={48} className="mx-auto mb-3 opacity-50" />
                        <p className="mb-2">暂无推荐数据</p>
                        <p className="text-xs">点击"换一批"按钮加载相关推荐</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* ═══════════════ Tab: 可解释性 ═══════════════ */}
              <TabsContent value="explainability">
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-violet-600" />
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      配方可解释性报告
                    </h2>
                  </div>

                  {!((formula.target_effects || formula.targetEffects) as string[])?.length ? (
                    <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 text-center text-gray-500">
                      请先设置目标功效以生成解释报告
                    </div>
                  ) : (
                    <>
                      {/* 实时合规状态 */}
                      <ComplianceCheckSection
                        ingredients={ingredientList.map((i) => ({
                          name: i.name,
                          dosage_mg: i.dosage || 0,
                        }))}
                        targetEffects={(formula.target_effects || formula.targetEffects) as string[]}
                      />

                      {/* 可解释性报告 */}
                      <ExplainabilityReportSection
                        formulaName={formula.name || '未命名配方'}
                        ingredients={ingredientList.map((i) => ({
                          name: i.name,
                          dosage_mg: i.dosage || 0,
                        }))}
                        targetEffects={(formula.target_effects || formula.targetEffects) as string[]}
                      />

                      {/* 导出报告 */}
                      <ReportExportPanel
                        report={null as ExplainabilityResult | null}
                        formulaName={formula.name || '未命名配方'}
                        ingredients={ingredientList.map((i) => ({
                          name: i.name,
                          dosage_mg: i.dosage || 0,
                        }))}
                        targetEffects={(formula.target_effects || formula.targetEffects) as string[]}
                      />
                    </>
                  )}
                </div>
              </TabsContent>
              {/* ═══════════════ Tab: 深度分析 ═══════════════ */}
              <TabsContent value="analysis">
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConical size={20} className="text-violet-600" />
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        配方深度分析
                      </h2>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<RefreshCw size={14} />}
                      disabled={isAnalyzing || !ingredientList.length}
                      onClick={runAllAnalyses}
                    >
                      {isAnalyzing ? '分析中...' : '运行所有分析'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Zap size={14} />}
                      disabled={isOptimizing || !ingredientList.length}
                      onClick={runOptimizeLP}
                    >
                      {isOptimizing ? '优化中...' : '配比优化'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Download size={14} />}
                      disabled={isExporting}
                      onClick={() => runExportFormula('pdf')}
                    >
                      导出 PDF
                    </Button>
                  </div>

                  {!ingredientList.length && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        请先添加成分后运行深度分析
                      </p>
                    </div>
                  )}

                  {/* 协同效应 */}
                  <AnalysisCard
                    title="协同效应分析"
                    icon={<TestTubes size={16} />}
                    result={analysisSynergy}
                    loading={isAnalyzing}
                    onRun={() => {
                      runAnalysis('synergy');
                    }}
                  >
                    {analysisSynergy && renderSynergyResult(analysisSynergy)}
                  </AnalysisCard>

                  {/* 稳定性预测 */}
                  <AnalysisCard
                    title="稳定性预测"
                    icon={<Thermometer size={16} />}
                    result={analysisStability}
                    loading={isAnalyzing}
                    onRun={() => runAnalysis('stability')}
                  >
                    {analysisStability && renderStabilityResult(analysisStability)}
                  </AnalysisCard>

                  {/* 风味预测 */}
                  <AnalysisCard
                    title="风味预测"
                    icon={<Zap size={16} />}
                    result={analysisTaste}
                    loading={isAnalyzing}
                    onRun={() => runAnalysis('taste')}
                  >
                    {analysisTaste && renderTasteResult(analysisTaste)}
                  </AnalysisCard>

                  {/* 效果预测 */}
                  <AnalysisCard
                    title="效果预测 (PK/PD)"
                    icon={<Activity size={16} />}
                    result={analysisEffect}
                    loading={isAnalyzing}
                    onRun={() => runAnalysis('effect')}
                  >
                    {analysisEffect && renderEffectResult(analysisEffect)}
                  </AnalysisCard>

                  {/* 兼容性检测 */}
                  <AnalysisCard
                    title="兼容性检测"
                    icon={<CheckCircle2 size={16} />}
                    result={analysisCompat}
                    loading={isAnalyzing}
                    onRun={() => runAnalysis('compat')}
                  >
                    {analysisCompat && renderCompatResult(analysisCompat)}
                  </AnalysisCard>

                  {/* 安全检查 */}
                  <AnalysisCard
                    title="安全检查"
                    icon={<Shield size={16} />}
                    result={analysisSafety}
                    loading={isAnalyzing}
                    onRun={() => runAnalysis('safety')}
                  >
                    {analysisSafety && renderSafetyResult(analysisSafety)}
                  </AnalysisCard>

                  {/* 配比优化结果 */}
                  {optimizationResult && (
                    <div className="mt-4 p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                      <h3 className="text-sm font-medium text-violet-700 dark:text-violet-300 mb-3">
                        配比优化结果
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-violet-500">总成本:</span>
                          <span className="font-bold ml-1">{optimizationResult.min_cost?.toFixed(2)} 元</span>
                        </div>
                        <div>
                          <span className="text-violet-500">求解时间:</span>
                          <span className="font-bold ml-1">{optimizationResult.solve_time_ms?.toFixed(0)} ms</span>
                        </div>
                        <div>
                          <span className="text-violet-500">可行解:</span>
                          <span className={`font-bold ml-1 ${optimizationResult.feasible ? 'text-emerald-600' : 'text-error-600'}`}>
                            {optimizationResult.feasible ? '是' : '否'}
                          </span>
                        </div>
                        <div>
                          <span className="text-violet-500">成分数:</span>
                          <span className="font-bold ml-1">{optimizationResult.ratios?.length ?? 0}</span>
                        </div>
                      </div>
                      {optimizationResult.ratios?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-violet-600 dark:text-violet-400">最优配比:</p>
                          {optimizationResult.ratios.slice(0, 5).map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-24 truncate">{r.ingredient}</span>
                              <span className="text-violet-600 dark:text-violet-400">{r.dosage_g?.toFixed(1)}g</span>
                              <span className="text-violet-500">({r.percentage?.toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle2 size={14} />}
                          disabled={isOptimizing}
                          onClick={runApplyOptimization}
                        >
                          {isOptimizing ? '应用中...' : '应用到配方'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Save size={14} />}
                          onClick={() => runSaveAnalysis('optimization', optimizationResult)}
                        >
                          保存结果
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* 审核区域（保留原有功能，放在 Tabs 外面）*/}
      {canReview && (
        <Card className="!border-amber-300 dark:!border-amber-800/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-900/20 flex items-center justify-center">
                <MessageSquare size={20} className="text-warning-500" />
              </div>
              <div>
                <CardTitle as="h2">配方审核</CardTitle>
                <CardDescription>请仔细审阅配方后给出审核意见</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="请输入审核备注（必填）..."
              rows={3}
              error={
                reviewAction === 'approve' && !reviewNotes.trim()
                  ? '请填写审核备注'
                  : reviewAction === 'reject' && !reviewNotes.trim()
                    ? '请填写驳回原因'
                    : undefined
              }
            />
          </CardContent>
          <CardFooter className="justify-end gap-3">
            <Button
              variant="danger"
              icon={<XCircle size={16} />}
              onClick={() => handleReview(false)}
              loading={reviewMut.isPending}
            >
              驳回
            </Button>
            <Button icon={<CheckCircle2 size={16} />} onClick={() => handleReview(true)} loading={reviewMut.isPending}>
              通过
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* 评论区（保留原有功能）*/}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <MessageSquare size={16} className="text-neutral-400" />
            </div>
            <CardTitle as="h2">评论</CardTitle>
            <Badge variant="neutral" size="sm">
              {commentsData?.total ?? 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* 发表评论 */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 text-xs font-bold shrink-0 mt-0.5">
              {user?.fullName?.[0] ?? user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1">
              <Textarea
                value={replyTo ? `@... ` : commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyTo ? '回复评论...' : '发表评论...'}
                rows={2}
                className="!text-sm"
              />
              <div className="flex items-center justify-between mt-2">
                {replyTo && (
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    取消回复
                  </button>
                )}
                <div className="ml-auto">
                  <Button
                    size="sm"
                    onClick={() => createCommentMut.mutate({ content: commentText, parent_id: replyTo || undefined })}
                    loading={createCommentMut.isPending}
                    disabled={!commentText.trim()}
                  >
                    发表
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 评论列表 */}
          {commentsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : commentsData?.items && commentsData.items.length > 0 ? (
            <div className="space-y-3">
              {commentsData.items.map((comment: Comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onDelete={(id) => deleteCommentMut.mutate(id)}
                  onReply={(id) => {
                    setReplyTo(id);
                    setCommentText('');
                  }}
                  expanded={expandedReplies.has(comment.id)}
                  onToggle={() => toggleReplies(comment.id)}
                />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-neutral-400">暂无评论，成为第一个评论者</div>
          )}
        </CardContent>
      </Card>

      {/* 活动时间线（保留原有功能）*/}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <Clock size={16} className="text-neutral-400" />
            </div>
            <CardTitle as="h2">活动时间线</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ActivityTimeline activities={timeline} />
        </CardContent>
      </Card>

      {/* 关联实验 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <TestTubes size={16} className="text-violet-500" />
              </div>
              <CardTitle as="h2">关联实验</CardTitle>
              {experiments.length > 0 && (
                <Badge variant="neutral" size="sm">{experiments.length}</Badge>
              )}
            </div>
            <Link to={`/experiments/new?formula_id=${formulaId}`}>
              <Button variant="ghost" size="sm" icon={<Plus size={14} />}>
                新建实验
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {experiments.length === 0 ? (
            <div className="text-center py-8">
              <TestTubes size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无关联实验</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">创建实验来验证此配方的效果</p>
              <Link to={`/experiments/new?formula_id=${formulaId}`} className="mt-3 inline-block">
                <Button size="sm" variant="secondary" icon={<Plus size={12} />}>
                  从此配方创建实验
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {experiments.map((exp: any) => (
                <Link
                  key={exp.id}
                  to={`/experiments/${exp.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <TestTubes size={14} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-violet-600 transition-colors truncate">
                      {exp.title}
                    </p>
                    <p className="text-xs text-neutral-400">{exp.code}</p>
                  </div>
                  <StatusBadge status={exp.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 增强删除确认对话框 */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="确认删除配方"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Alert variant="destructive">此操作不可撤销！删除后所有相关数据将被永久移除。</Alert>

          <div className="rounded-lg bg-error-50 dark:bg-error-900/10 border border-red-200 dark:border-red-800 p-4">
            <p className="font-semibold text-error-900 dark:text-error-100 mb-2">将要删除的配方：</p>
            <p className="text-error-700 dark:text-error-300 font-mono text-sm bg-white dark:bg-neutral-800 rounded px-2 py-1">
              {formula.name}
            </p>
          </div>

          {/* 关联影响提示 */}
          <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <p className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
              同时删除关联的 {commentsData?.total ?? 0} 条评论
            </p>
            <p className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
              清除所有分析记录和版本历史
            </p>
          </div>

          {/* 确认方式：输入配方名称或勾选确认框 */}
          <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={deleteConfirmed} onCheckedChange={(checked) => setDeleteConfirmed(checked === true)} />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">我已了解此操作的后果，确认删除</span>
            </label>

            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">请输入配方名称以确认：</label>
              <Input
                value={deleteInputValue}
                onChange={(e) => setDeleteInputValue(e.target.value)}
                placeholder={`输入 "${formula.name}" 确认`}
                error={deleteInputValue && deleteInputValue !== formula.name ? '输入的名称不匹配' : undefined}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={handleDelete}
              disabled={!deleteConfirmed || deleteInputValue !== formula.name}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>

      {/* 配方对比 Modal */}
      <Modal
        open={showCompare}
        onClose={() => {
          setShowCompare(false);
          setCompareId(null);
        }}
        title="配方对比"
        maxWidth="max-w-4xl"
      >
        <FormulaCompare leftId={compareId} rightId={null} />
      </Modal>

      {/* 配方分享 Modal */}
      <ShareFormula
        formulaId={formulaId}
        formulaName={formula?.name || ''}
        open={showShare}
        onClose={() => setShowShare(false)}
      />

      {/* 版本对比 Modal */}
      <Modal
        open={showVersionDiff}
        onClose={() => {
          setShowVersionDiff(false);
          setSelectingDiffSide(null);
        }}
        title="版本对比"
        maxWidth="max-w-4xl"
      >
        {selectingDiffSide ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">
              选择要对比的版本（当前选择：
              {selectingDiffSide === 'left'
                ? diffLeftVersion
                  ? `v${diffLeftVersion.version}`
                  : ''
                : diffRightVersion
                  ? `v${diffRightVersion.version}`
                  : ''}
              ）
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {versions
                ?.filter(
                  (v) =>
                    String(v.id) !== String(selectingDiffSide === 'left' ? diffLeftVersion?.id : diffRightVersion?.id),
                )
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (selectingDiffSide === 'left') {
                        setDiffRightVersion({
                          id: Number(v.id),
                          version: String(v.version_number || v.version_label),
                          snapshot: v.snapshot,
                          created_at: v.created_at,
                          change_summary: v.change_summary || undefined,
                        });
                      } else {
                        setDiffLeftVersion({
                          id: Number(v.id),
                          version: String(v.version_number || v.version_label),
                          snapshot: v.snapshot,
                          created_at: v.created_at,
                          change_summary: v.change_summary || undefined,
                        });
                      }
                      setSelectingDiffSide(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900 dark:text-white">
                        v{v.version_number || v.version_label}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(v.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    {v.change_summary && <p className="text-xs text-neutral-500 mt-0.5">{v.change_summary}</p>}
                  </button>
                ))}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSelectingDiffSide(null)}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <VersionDiffViewer leftVersion={diffLeftVersion} rightVersion={diffRightVersion} />
        )}
      </Modal>
    </div>
  );
}

// ── 子组件：合规检查区块 ──────────────────────────────────