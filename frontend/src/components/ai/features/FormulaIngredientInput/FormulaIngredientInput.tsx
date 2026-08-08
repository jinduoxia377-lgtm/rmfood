import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Alert, AlertTitle } from '@/components/ui';
import { LoadingSpinner } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { Tooltip } from '@/components/ui';
import {
  Plus,
  Trash2,
  LayoutTemplate,
  RefreshCw,
  Save,
  Calculator,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { IngredientRow } from './IngredientRow';
import { IngredientSelector } from './IngredientSelector';
import { TemplateSelector } from './TemplateSelector';
import type { FormulaIngredient, FormulaTemplate, ValidationError, RatioUnit } from './types';
import {
  validateForm,
  calculateDosages,
  saveToLocalStorage,
  loadFromLocalStorage,
  createNewIngredient,
  duplicateIngredient,
  formatForNSGAII,
} from './utils';

interface FormulaIngredientInputProps {
  onSubmit: (data: ReturnType<typeof formatForNSGAII>) => void;
  disabled?: boolean;
  ingredients?: FormulaIngredient[];
  setIngredients?: React.Dispatch<React.SetStateAction<FormulaIngredient[]>>;
  totalWeight?: number;
  setTotalWeight?: React.Dispatch<React.SetStateAction<number>>;
}

export const FormulaIngredientInput: React.FC<FormulaIngredientInputProps> = ({
  onSubmit,
  disabled = false,
  ingredients: externalIngredients,
  setIngredients: externalSetIngredients,
  totalWeight: externalTotalWeight,
  setTotalWeight: externalSetTotalWeight,
}) => {
  const [internalIngredients, setInternalIngredients] = useState<FormulaIngredient[]>([]);
  const [internalTotalWeight, setInternalTotalWeight] = useState(100);

  const ingredients = externalIngredients !== undefined ? externalIngredients : internalIngredients;
  const setIngredients = externalSetIngredients !== undefined 
    ? externalSetIngredients 
    : setInternalIngredients;
  const totalWeight = externalTotalWeight !== undefined ? externalTotalWeight : internalTotalWeight;
  const setTotalWeight = externalSetTotalWeight !== undefined 
    ? externalSetTotalWeight 
    : setInternalTotalWeight;
  const [ratioUnit, setRatioUnit] = useState<RatioUnit>('percentage');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedData = loadFromLocalStorage();
    if (savedData) {
      setIngredients(savedData.ingredients);
      setTotalWeight(savedData.totalWeight);
    }
  }, []);

  useEffect(() => {
    const calculated = calculateDosages(ingredients, totalWeight);
    setIngredients(calculated);
  }, [totalWeight]);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      setIsAutoSaving(true);
      saveToLocalStorage({ ingredients, totalWeight });
      setLastSaved(new Date());
      setIsAutoSaving(false);
    }, 30000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [ingredients, totalWeight]);

  const handleSaveNow = useCallback(() => {
    saveToLocalStorage({ ingredients, totalWeight });
    setLastSaved(new Date());
  }, [ingredients, totalWeight]);

  const handleAddIngredient = () => {
    setShowSelector(true);
  };

  const handleQuickAddIngredient = () => {
    const newIng = createNewIngredient();
    setIngredients([...ingredients, newIng]);
    setExpandedRowId(newIng.id);
  };

  const handleSelectIngredient = (ingredient: FormulaIngredient) => {
    setIngredients([...ingredients, ingredient]);
    setExpandedRowId(ingredient.id);
  };

  const handleUpdateIngredient = (id: string, updates: Partial<FormulaIngredient>) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, ...updates } : ing))
    );
  };

  const handleDeleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
    if (expandedRowId === id) {
      setExpandedRowId(null);
    }
  };

  const handleDuplicateIngredient = (ingredient: FormulaIngredient) => {
    const duplicated = duplicateIngredient(ingredient);
    setIngredients([...ingredients, duplicated]);
    setExpandedRowId(duplicated.id);
  };

  const handleLoadTemplate = (template: FormulaTemplate) => {
    const newIngredients = template.ingredients.map((ing) => ({
      ...ing,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parameters: ing.parameters.map((p) => ({ ...p, id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` })),
    }));
    setIngredients(calculateDosages(newIngredients, template.totalWeight));
    setTotalWeight(template.totalWeight);
    setErrors([]);
  };

  const handleClearAll = () => {
    setIngredients([]);
    setTotalWeight(100);
    setErrors([]);
  };

  const handleSubmit = async () => {
    const validationErrors = validateForm(ingredients);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors([]);
    
    try {
      const data = formatForNSGAII(ingredients, totalWeight);
      onSubmit(data);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRatio = ingredients.reduce((sum, ing) => sum + ing.ratio, 0);
  const isValidRatio = Math.abs(totalRatio - 100) <= 0.01;

  return (
    <div className="formula-ingredient-input">
      <div className="input-header">
        <h2 className="input-title">配方成分输入</h2>
        <div className="header-actions">
          <Tooltip content={lastSaved ? `上次保存: ${lastSaved.toLocaleTimeString()}` : '未保存'}>
            <Button
              icon={isAutoSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              onClick={handleSaveNow}
              size="sm"
              disabled={disabled}
              variant="secondary"
            >
              {isAutoSaving ? '保存中...' : '保存'}
            </Button>
          </Tooltip>
          <Button
            icon={<LayoutTemplate className="w-4 h-4" />}
            onClick={() => setShowTemplateSelector(true)}
            size="sm"
            disabled={disabled}
            variant="secondary"
          >
            模板
          </Button>
        </div>
      </div>

      <div className="total-weight-section">
        <label className="total-weight-label">
          <Calculator className="w-4 h-4 mr-2" /> 成品总克数
        </label>
        <div className="total-weight-input-wrapper">
          <Input
            type="number"
            min={1}
            max={10000}
            step={1}
            value={totalWeight || ''}
            onChange={(e) => setTotalWeight(parseFloat(e.target.value) || 100)}
            className="total-weight-input"
            disabled={disabled}
          />
          <span className="total-weight-unit">g</span>
        </div>
        <div className="total-ratio-status">
          <span className="ratio-label">比例总和:</span>
          <span className={`ratio-value ${isValidRatio ? 'valid' : 'invalid'}`}>
            {totalRatio.toFixed(2)}%
          </span>
          {isValidRatio ? (
            <CheckCircle2 className="ratio-icon valid w-5 h-5" />
          ) : (
            <AlertCircle className="ratio-icon invalid w-5 h-5" />
          )}
        </div>
      </div>

      <div className="unit-switch-section">
        <span className="unit-label">比例单位:</span>
        <div className="unit-switch">
          <button
            type="button"
            className={`unit-btn ${ratioUnit === 'percentage' ? 'active' : ''}`}
            onClick={() => setRatioUnit('percentage')}
            disabled={disabled}
          >
            百分比 (%)
          </button>
          <button
            type="button"
            className={`unit-btn ${ratioUnit === 'mass' ? 'active' : ''}`}
            onClick={() => setRatioUnit('mass')}
            disabled={disabled}
          >
            质量分数
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>输入验证失败</AlertTitle>
          <ul className="error-list">
            {errors.map((error, index) => (
              <li key={index}>
                <span className="error-message">{error.message}</span>
                <span className="error-suggestion">({error.suggestion})</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="ingredients-section">
        <div className="ingredients-header">
          <span className="ingredients-count">{ingredients.length} 种成分</span>
          <div className="ingredients-actions">
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={handleAddIngredient}
              size="sm"
              variant="primary"
              disabled={disabled}
            >
              从数据库添加
            </Button>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={handleQuickAddIngredient}
              size="sm"
              disabled={disabled}
              variant="secondary"
            >
              快速添加
            </Button>
            {ingredients.length > 0 && (
              <Button
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleClearAll}
                size="sm"
                variant="danger"
                disabled={disabled}
              >
                清空全部
              </Button>
            )}
          </div>
        </div>

        <div className="ingredients-list">
          {isLoading ? (
            <div className="loading-container">
              <LoadingSpinner size="lg" />
            </div>
          ) : ingredients.length === 0 ? (
            <EmptyState title="暂无成分" description="请添加配方成分" />
          ) : (
            ingredients.map((ingredient) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                onUpdate={handleUpdateIngredient}
                onDelete={handleDeleteIngredient}
                onDuplicate={handleDuplicateIngredient}
                onSelectIngredient={() => setShowSelector(true)}
                expanded={expandedRowId === ingredient.id}
                onToggleExpand={() =>
                  setExpandedRowId(
                    expandedRowId === ingredient.id ? null : ingredient.id
                  )
                }
              />
            ))
          )}
        </div>
      </div>

      <div className="submit-section">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={disabled || ingredients.length === 0 || isLoading}
          loading={isLoading}
        >
          提交优化
        </Button>
        <span className="submit-hint">
          请确保比例总和为100%，所有必填参数已填写
        </span>
      </div>

      <IngredientSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleSelectIngredient}
      />

      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onLoadTemplate={handleLoadTemplate}
      />
    </div>
  );
};