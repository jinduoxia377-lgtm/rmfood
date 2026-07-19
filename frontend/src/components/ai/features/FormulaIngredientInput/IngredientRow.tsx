import React from 'react';
import { Button } from '@/components/ui';
import { Input } from '@/components/ui';
import { Tooltip } from '@/components/ui';
import { Delete, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import type { FormulaIngredient } from './types';

interface IngredientRowProps {
  ingredient: FormulaIngredient;
  onUpdate: (id: string, updates: Partial<FormulaIngredient>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (ingredient: FormulaIngredient) => void;
  onSelectIngredient: (ingredient: FormulaIngredient) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

export const IngredientRow: React.FC<IngredientRowProps> = ({
  ingredient,
  onUpdate,
  onDelete,
  onDuplicate,
  onSelectIngredient,
  expanded,
  onToggleExpand,
}) => {
  return (
    <div className="ingredient-row">
      <div className="ingredient-row-header">
        <button
          type="button"
          onClick={onToggleExpand}
          className="expand-btn"
          aria-label={expanded ? '收起详情' : '展开详情'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <div className="ingredient-info">
          <Input
            value={ingredient.nameCn}
            onChange={(e) => onUpdate(ingredient.id, { nameCn: e.target.value, name: e.target.value })}
            placeholder="输入成分名称"
            className="ingredient-name-input"
            onClick={() => onSelectIngredient(ingredient)}
          />
          <span className="ratio-display">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={ingredient.ratio || ''}
              onChange={(e) => onUpdate(ingredient.id, { ratio: parseFloat(e.target.value) || 0 })}
              className="ratio-input"
            />
            <span className="ratio-unit">%</span>
          </span>
          <span className="dosage-display">
            = <Input
              type="number"
              min={0}
              step={0.1}
              value={ingredient.dosage || ''}
              className="dosage-input"
              disabled
            />
            <span className="dosage-unit">g</span>
          </span>
        </div>

        <div className="ingredient-actions">
          <Tooltip content="复制成分">
            <Button
              icon={<Copy className="w-4 h-4" />}
              onClick={() => onDuplicate(ingredient)}
              size="sm"
              variant="ghost"
              aria-label="复制成分"
            />
          </Tooltip>
          <Tooltip content="删除成分">
            <Button
              icon={<Delete className="w-4 h-4" />}
              onClick={() => onDelete(ingredient.id)}
              size="sm"
              variant="danger"
              aria-label="删除成分"
            />
          </Tooltip>
        </div>
      </div>

      {expanded && (
        <div className="ingredient-params">
          <div className="params-grid">
            {ingredient.parameters.map((param) => (
              <div key={param.id} className="param-item">
                <label className="param-label">
                  {param.name}
                  {param.required && <span className="required-star">*</span>}
                </label>
                <div className="param-input-wrapper">
                  <Input
                    type="number"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.value || ''}
                    onChange={(e) => {
                      const updatedParams = ingredient.parameters.map((p) =>
                        p.id === param.id ? { ...p, value: parseFloat(e.target.value) || null } : p
                      );
                      onUpdate(ingredient.id, { parameters: updatedParams });
                    }}
                    className="param-input"
                    placeholder={`${param.min}-${param.max}${param.unit}`}
                  />
                  <span className="param-unit">{param.unit}</span>
                </div>
                {param.description && (
                  <span className="param-description">{param.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
