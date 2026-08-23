/**
 * 模板编辑器 - 创建/编辑配方模板
 */
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { formulaApi } from '@/api/formula';
import { useToast } from '@/components/ui';

interface TemplateEditorProps {
  open: boolean;
  onClose: () => void;
  template?: any;
  onSuccess: () => void;
}

export function TemplateEditor({ open, onClose, template, onSuccess }: TemplateEditorProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category: '',
    effects: [] as string[],
    effectInput: '',
    is_featured: false,
  });

  if (!open) return null;

  const handleSubmit = async () => {
    if (!formData.code || !formData.name) {
      addToast({ type: 'error', message: '请填写模板代码和名称' });
      return;
    }
    setLoading(true);
    try {
      if (template) {
        await formulaApi.updateFormulaTemplate(template.code, formData);
        addToast({ type: 'success', message: '模板已更新' });
      } else {
        await formulaApi.createFormulaTemplate(formData);
        addToast({ type: 'success', message: '模板已创建' });
      }
      onSuccess();
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: '操作失败' });
    } finally {
      setLoading(false);
    }
  };

  const addEffect = () => {
    if (formData.effectInput.trim() && !formData.effects.includes(formData.effectInput.trim())) {
      setFormData(prev => ({ ...prev, effects: [...prev.effects, prev.effectInput.trim()] }));
      setFormData(prev => ({ ...prev, effectInput: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {template ? '编辑模板' : '创建模板'}
            </h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                模板代码 <span className="text-error-500">*</span>
              </label>
              <Input
                value={formData.code}
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="如：immune-boost"
                disabled={!!template}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                模板名称 <span className="text-error-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="如：增强免疫配方"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                分类
              </label>
              <Input
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="如：免疫力、睡眠、慢性病"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                描述
              </label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="模板描述..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                功效标签
              </label>
              <div className="flex gap-2">
                <Input
                  value={formData.effectInput}
                  onChange={e => setFormData(prev => ({ ...prev, effectInput: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEffect())}
                  placeholder="输入功效后回车"
                />
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addEffect}>
                  添加
                </Button>
              </div>
              {formData.effects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.effects.map((eff, idx) => (
                    <span key={idx} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs">
                      {eff}
                      <button onClick={() => setFormData(prev => ({ ...prev, effects: prev.effects.filter((_, i) => i !== idx) }))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={formData.is_featured}
                onChange={e => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="featured" className="text-sm text-neutral-700 dark:text-neutral-300">
                设为推荐模板
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {template ? '保存修改' : '创建模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}
