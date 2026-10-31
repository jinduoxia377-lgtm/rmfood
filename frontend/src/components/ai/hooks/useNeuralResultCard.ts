import { useState, useEffect, useRef, useCallback } from 'react';
import type { AICandidate } from '@/api/ai';
import { validateAiFormula, type AiFormulaValidationResponse } from '@/api/ai';
import { formulaApi } from '@/api/formula';
import type { FormulaCreatePayload } from '@/types/formula';
import { logger } from '@/utils/safeLogger';
import { parseDosageToGramsOrZero } from '@/components/ai/features/utils/dosage';

/** 从剂量字符串/数值解析克数（"1.0-3.0g" / "500mg" / "10g" / "约15克"），单位统一归一化为克。 */
function parseDosageGrams(raw: string): number {
  return parseDosageToGramsOrZero(raw)
}

/** 君臣佐使角色表（按剂量降序推导） */
const HERB_ROLES = ['君药', '臣药', '佐药', '使药'] as const

/** 将 herb_combination 映射为保存 payload 成分（真实 dosage/role，role 缺失时按剂量推导） */
function mapHerbsToComposition(candidate: AICandidate): { name: string; role: string; dosage: string }[] {
  const herbs = (candidate.herb_combination ?? []).filter(h => h.name)
  if (herbs.length === 0) return []

  const herbDosageInGrams = (h: { dosage?: string | number; dosage_g?: number; dosage_mg?: number }): number => {
    if (typeof h.dosage_g === 'number' && Number.isFinite(h.dosage_g)) return h.dosage_g
    if (typeof h.dosage_mg === 'number' && Number.isFinite(h.dosage_mg)) return h.dosage_mg
    if (typeof h.dosage === 'number' && Number.isFinite(h.dosage)) return h.dosage
    return parseDosageToGramsOrZero(typeof h.dosage === 'string' ? h.dosage : '')
  }

  const formatHerbDosage = (h: { dosage?: string | number; dosage_g?: number; dosage_mg?: number }): string => {
    if (typeof h.dosage === 'string' && h.dosage) return h.dosage
    if (typeof h.dosage_g === 'number' && h.dosage_g > 0) return `${h.dosage_g}g`
    if (typeof h.dosage_mg === 'number' && h.dosage_mg > 0) return `${h.dosage_mg}g`
    if (typeof h.dosage === 'number' && h.dosage > 0) return `${h.dosage}g`
    return ''
  }

  const sorted = [...herbs].sort((a, b) => herbDosageInGrams(b) - herbDosageInGrams(a))
  const roleByHerbName = new Map<string, string>()
  sorted.forEach((h, rank) => {
    const derivedRole = HERB_ROLES[Math.min(rank, HERB_ROLES.length - 1)] || '佐药'
    roleByHerbName.set(String(h.name), h.role || derivedRole)
  })

  return herbs.map(h => ({
    name: h.name ? String(h.name) : '',
    role: roleByHerbName.get(String(h.name)) || h.role || '佐药',
    dosage: formatHerbDosage(h),
  }))
}

interface SavedFormulaState {
  formulaId: number;
  savedAt: number;
}

interface HistoryItem {
  name: string;
  description: string;
  type: 'name' | 'description' | 'both';
  timestamp: number;
}

interface UseNeuralResultCardProps {
  candidate: AICandidate;
  index: number;
  onSaveSuccess?: (formulaId: number, candidateId: string) => void;
  onEdit?: (candidate: AICandidate, index: number) => void;
  savedFormulas?: Map<string, SavedFormulaState>;
  selectedEffects?: string[];
}

const MAX_HISTORY = 15;

export function useNeuralResultCard({
  candidate,
  index,
  onSaveSuccess,
  onEdit,
  savedFormulas = new Map(),
  selectedEffects = [],
}: UseNeuralResultCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(
    typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方',
  );
  const [editedDescription, setEditedDescription] = useState(
    typeof candidate.description === 'string' ? candidate.description : '',
  );
  const [originalName, setOriginalName] = useState(
    typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方',
  );
  const [originalDescription, setOriginalDescription] = useState(
    typeof candidate.description === 'string' ? candidate.description : '',
  );
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // ── 保存前 AI 校验（成分级报告弹窗）──
  const [validationResult, setValidationResult] = useState<AiFormulaValidationResponse | null>(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [historyStack, setHistoryStack] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedStateRef = useRef<{ name: string; description: string } | null>(null);
  const historySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidateId = `candidate_${index}_${typeof candidate.formula_name === 'string' ? candidate.formula_name.replace(/\s+/g, '_').toLowerCase() : 'unknown'}`;
  const savedState = savedFormulas.get(candidateId);
  const isAlreadySaved = !!savedState;

  const saveToHistory = useCallback(
    (type: 'name' | 'description' | 'both') => {
      const currentState = { name: editedName, description: editedDescription };
      if (
        lastSavedStateRef.current?.name === currentState.name &&
        lastSavedStateRef.current?.description === currentState.description
      )
        return;
      lastSavedStateRef.current = { ...currentState };
      const newStack = historyStack.slice(0, historyIndex + 1);
      newStack.push({ ...currentState, type, timestamp: Date.now() });
      if (newStack.length > MAX_HISTORY) newStack.shift();
      setHistoryStack(newStack);
      setHistoryIndex(newStack.length - 1);
    },
    [editedName, editedDescription, historyStack, historyIndex],
  );

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const previousState = historyStack[newIndex];
    setEditedName(previousState.name);
    setEditedDescription(previousState.description);
    setHistoryIndex(newIndex);
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    const nextState = historyStack[newIndex];
    setEditedName(nextState.name);
    setEditedDescription(nextState.description);
    setHistoryIndex(newIndex);
  }, [historyIndex, historyStack]);

  const handleReset = useCallback(() => {
    const initialName = typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方';
    const initialDescription = typeof candidate.description === 'string' ? candidate.description : '';
    setEditedName(initialName);
    setEditedDescription(initialDescription);
    setHistoryStack([]);
    setHistoryIndex(-1);
    lastSavedStateRef.current = null;
  }, [candidate]);

  const applyFormatting = useCallback(
    (type: 'bold' | 'italic' | 'bullet' | 'numbered') => {
      const textarea = descriptionTextareaRef.current;
      if (!textarea) return;
      const { selectionStart, selectionEnd, value } = textarea;
      const selectedText = value.substring(selectionStart, selectionEnd);
      let replacement = '';
      switch (type) {
        case 'bold':
          replacement = selectedText ? `**${selectedText}**` : '** **';
          break;
        case 'italic':
          replacement = selectedText ? `*${selectedText}*` : '* *';
          break;
        case 'bullet':
          replacement = selectedText ? `- ${selectedText}` : '- ';
          break;
        case 'numbered':
          replacement = selectedText ? `1. ${selectedText}` : '1. ';
          break;
      }
      const newValue = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
      setEditedDescription(newValue);
      setTimeout(() => saveToHistory('description'), 0);
    },
    [saveToHistory],
  );

  const debouncedAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges && isEditing) {
        setIsAutoSaving(true);
        try {
          setOriginalName(editedName);
          setOriginalDescription(editedDescription);
          setHasUnsavedChanges(false);
          onEdit?.({ ...candidate, formula_name: editedName, description: editedDescription }, index);
        } catch (error) {
          logger.error('自动保存失败:', error);
        } finally {
          setIsAutoSaving(false);
        }
      }
    }, 1500);
  }, [editedName, editedDescription, hasUnsavedChanges, isEditing, candidate, index, onEdit]);

  const enterEditMode = useCallback(() => {
    setOriginalName(editedName);
    setOriginalDescription(editedDescription);
    setIsEditing(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  }, [editedName, editedDescription]);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setEditedName(originalName);
    setEditedDescription(originalDescription);
    setHasUnsavedChanges(false);
  }, [originalName, originalDescription]);

  const saveEdit = useCallback(() => {
    setOriginalName(editedName);
    setOriginalDescription(editedDescription);
    setIsEditing(false);
    setHasUnsavedChanges(false);
    onEdit?.({ ...candidate, formula_name: editedName, description: editedDescription }, index);
  }, [editedName, editedDescription, candidate, index, onEdit]);

  const saveToFormulaManager = useCallback(async () => {
    if (isAlreadySaved && savedState) {
      onSaveSuccess?.(savedState.formulaId, candidateId);
      return;
    }
    try {
      setIsSaving(true);
      const composition = {
        // P1：使用 herb_combination 的真实 dosage/role（role 缺失时按剂量排序推导君臣佐使），
        // 不再硬编码 '1.0-3.0g' / 按 index 循环角色。
        ingredients: mapHerbsToComposition(candidate),
        peptides: candidate.peptide_candidates,
      };
      const payload: FormulaCreatePayload = {
        name: typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方',
        description: typeof candidate.description === 'string' ? candidate.description : '',
        target_effects: selectedEffects,
        composition,
        safety_check: candidate.safety_details,
        synergy_analysis: { score: candidate.synergy_score },
      };

      // ── 保存前 AI 校验（科学级后验校验）──
      // CRITICAL 阻断并弹出成分级报告；warnings 放行并把建议追加到 notes；接口异常诚实降级。
      const validationIngredients: { name: string; dosage_g: number }[] = (candidate.herb_combination ?? [])
        .map(h => ({ name: h.name ? String(h.name) : '', dosage_g: parseDosageGrams(typeof h.dosage === 'string' ? h.dosage : '') }))
        .filter(item => item.name.length > 0)
      try {
        const validation = await validateAiFormula({
          formula_name: payload.name,
          ingredients: validationIngredients,
          target_effects: selectedEffects,
        })
        if (validation.blocked_by_critical) {
          // CRITICAL：阻断保存，打开成分级校验报告弹窗（用户可查看后取消）
          setValidationResult(validation)
          setValidationModalOpen(true)
          return
        }
        // warnings 未阻断 → 继续保存，并把校验建议追加到 notes（【AI校验】前缀）
        const warnings = validation.warnings?.length
          ? validation.warnings
          : (validation.alerts ?? [])
              .filter(a => a.level === 'warning' || !a.blocking)
              .map(a => a.message)
        const suggestions = validation.suggestions?.length
          ? validation.suggestions
          : (validation.recommendations ?? [])
        if (warnings.length > 0 || suggestions.length > 0) {
          const aiNotes = [
            ...warnings.filter(Boolean),
            ...suggestions.map(s => `建议：${s}`),
          ].join('；')
          payload.notes = [payload.notes, `【AI校验】${aiNotes}`].filter(Boolean).join('\n\n')
        }
      } catch (error) {
        // 校验接口异常 → 不阻断保存，但明确提示校验服务不可用（诚实降级）
        setValidationNotice('配方校验服务暂不可用，已跳过校验直接保存')
        logger.warn('[useNeuralResultCard] AI 配方校验服务调用失败，已跳过校验直接保存:', error)
      }

      const result = await formulaApi.create(payload);
      onSaveSuccess?.(result.id, candidateId);
    } catch (error) {
      logger.error('保存配方失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isAlreadySaved, savedState, candidate, index, selectedEffects, onSaveSuccess, candidateId]);

  const handleNameChange = useCallback(
    (value: string) => {
      setEditedName(value);
      if (historySaveTimeoutRef.current) clearTimeout(historySaveTimeoutRef.current);
      historySaveTimeoutRef.current = setTimeout(() => saveToHistory('name'), 500);
    },
    [saveToHistory],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditedDescription(value);
      if (historySaveTimeoutRef.current) clearTimeout(historySaveTimeoutRef.current);
      historySaveTimeoutRef.current = setTimeout(() => saveToHistory('description'), 500);
    },
    [saveToHistory],
  );

  useEffect(() => {
    if (isEditing && historyStack.length === 0) {
      const initialState = {
        name: editedName,
        description: editedDescription,
        type: 'both' as const,
        timestamp: Date.now(),
      };
      setHistoryStack([initialState]);
      setHistoryIndex(0);
      lastSavedStateRef.current = { name: editedName, description: editedDescription };
    }
  }, [isEditing, editedName, editedDescription, historyStack.length]);

  useEffect(() => {
    const nameChanged = editedName !== originalName;
    const descriptionChanged = editedDescription !== originalDescription;
    setHasUnsavedChanges(nameChanged || descriptionChanged);
  }, [editedName, editedDescription, originalName, originalDescription]);

  useEffect(() => {
    if (isEditing) debouncedAutoSave();
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [editedName, editedDescription, isEditing, debouncedAutoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (historySaveTimeoutRef.current) clearTimeout(historySaveTimeoutRef.current);
    };
  }, []);

  return {
    isSaving,
    isEditing,
    editedName,
    editedDescription,
    isAutoSaving,
    hasUnsavedChanges,
    historyIndex,
    historyStack,
    isAlreadySaved,
    nameInputRef,
    descriptionTextareaRef,
    candidateId,
    handleUndo,
    handleRedo,
    handleReset,
    applyFormatting,
    enterEditMode,
    exitEditMode,
    saveEdit,
    saveToFormulaManager,
    handleNameChange,
    handleDescriptionChange,
    // 保存前 AI 校验（成分级报告弹窗）
    validationResult,
    validationModalOpen,
    setValidationModalOpen,
    setValidationResult,
    validationNotice,
    setValidationNotice,
  };
}

export default useNeuralResultCard;
