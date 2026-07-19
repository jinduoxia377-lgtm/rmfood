import { useState, useEffect, useRef, useCallback } from 'react';
import type { AICandidate } from '@/api/ai';
import { formulaApi } from '@/api/formula';
import { logger } from '@/utils/safeLogger';

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
  const [historyStack, setHistoryStack] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedStateRef = useRef<{ name: string; description: string } | null>(null);
  const historySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const candidateId = `candidate_${index}_${typeof candidate.formula_name === 'string' ? candidate.formula_name.replace(/\s+/g, '_').toLowerCase() : 'unknown'}_${Date.now()}`;
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
        ingredients: (candidate.herb_combination ?? []).map((h) => ({
          name: h.name,
          role: h.role || ['君', '臣', '佐', '使'][index % 4],
          dosage: '1.0-3.0g',
        })),
        peptides: candidate.peptide_candidates,
      };
      const payload = {
        name: typeof candidate.formula_name === 'string' ? candidate.formula_name : '未知配方',
        description: typeof candidate.description === 'string' ? candidate.description : '',
        target_effects: selectedEffects,
        composition,
        safety_check: candidate.safety_details,
        synergy_analysis: { score: candidate.synergy_score },
      };
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
  };
}

export default useNeuralResultCard;
