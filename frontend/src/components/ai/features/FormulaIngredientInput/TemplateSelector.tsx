import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { EmptyState } from '@/components/ui';
import { Tooltip } from '@/components/ui';
import { LayoutTemplate, Save, Delete, Check } from 'lucide-react';
import type { FormulaTemplate } from './types';
import { PRESET_TEMPLATES } from './types';
import { loadTemplates, saveTemplate, deleteTemplate } from './utils';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (template: FormulaTemplate) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
}) => {
  const [templates, setTemplates] = useState<FormulaTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<FormulaTemplate[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateIngredients, setTemplateIngredients] = useState<FormulaTemplate['ingredients']>([]);
  const [templateTotalWeight, setTemplateTotalWeight] = useState(100);

  useEffect(() => {
    if (isOpen) {
      loadCustomTemplates();
    }
  }, [isOpen]);

  const loadCustomTemplates = () => {
    const saved = loadTemplates();
    setCustomTemplates(saved);
    setTemplates([...PRESET_TEMPLATES, ...saved]);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    
    const newTemplate: Omit<FormulaTemplate, 'id' | 'createdAt' | 'isSystem'> = {
      name: templateName,
      description: templateDesc,
      ingredients: templateIngredients,
      totalWeight: templateTotalWeight,
      category: templateCategory,
    };
    
    saveTemplate(newTemplate);
    loadCustomTemplates();
    setShowSaveForm(false);
    setTemplateName('');
    setTemplateDesc('');
    setTemplateCategory('');
    setTemplateIngredients([]);
    setTemplateTotalWeight(100);
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteTemplate(templateId);
    loadCustomTemplates();
  };

  return (
    <Modal
      title="配方模板"
      open={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="template-selector">
        {templates.length === 0 ? (
          <EmptyState title="暂无模板" />
        ) : (
          <>
            <div className="template-section">
              <h4 className="section-title">
                <Check className="w-4 h-4 mr-2" /> 系统预设模板
              </h4>
              <div className="template-list">
                {PRESET_TEMPLATES.map((template) => (
                  <div key={template.id} className="template-item">
                    <div className="template-info">
                      <div className="template-header">
                        <span className="template-name">{template.name}</span>
                        <Badge className="template-badge system">{template.category}</Badge>
                      </div>
                      <p className="template-desc">{template.description}</p>
                      <span className="template-meta">
                        {template.ingredients.length} 种成分 · 总重 {template.totalWeight}g
                      </span>
                    </div>
                    <Button
                      onClick={() => {
                        onLoadTemplate(template);
                        onClose();
                      }}
                      size="sm"
                      variant="primary"
                    >
                      使用
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {customTemplates.length > 0 && (
              <div className="template-section">
                <h4 className="section-title">我的自定义模板</h4>
                <div className="template-list">
                  {customTemplates.map((template) => (
                    <div key={template.id} className="template-item">
                      <div className="template-info">
                        <div className="template-header">
                          <span className="template-name">{template.name}</span>
                          <Badge className="template-badge custom">{template.category}</Badge>
                        </div>
                        <p className="template-desc">{template.description}</p>
                      </div>
                      <div className="template-actions">
                        <Button
                          onClick={() => {
                            onLoadTemplate(template);
                            onClose();
                          }}
                          size="sm"
                          variant="primary"
                        >
                          使用
                        </Button>
                        <Tooltip content="删除模板">
                          <Button
                            icon={<Delete className="w-4 h-4" />}
                            onClick={() => handleDeleteTemplate(template.id)}
                            size="sm"
                            variant="danger"
                          />
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="save-template-section">
              {showSaveForm ? (
                <div className="save-form">
                  <h4>保存当前配方为模板</h4>
                  <input
                    type="text"
                    placeholder="模板名称"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="模板描述"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="分类"
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="form-input"
                  />
                  <div className="form-actions">
                    <Button onClick={handleSaveTemplate} variant="primary">
                      保存
                    </Button>
                    <Button onClick={() => setShowSaveForm(false)} variant="secondary">
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  icon={<Save className="w-4 h-4" />}
                  onClick={() => setShowSaveForm(true)}
                  variant="secondary"
                >
                  保存为模板
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};