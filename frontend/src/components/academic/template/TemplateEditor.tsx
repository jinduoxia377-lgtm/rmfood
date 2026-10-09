import { useState } from 'react';

interface TemplateEditorProps {
  initialTemplate?: {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    version?: string | number;
    createdAt?: string;
    updatedAt?: string;
    sections?: {
      id: string;
      name: string;
      type: string;
      order: number;
      content?: string;
      children?: unknown[];
    }[];
  };
  onSave?: (template: unknown) => void;
  onCancel?: () => void;
}

export function TemplateEditor({ initialTemplate, onSave, onCancel }: TemplateEditorProps) {
  const [template, setTemplate] = useState(initialTemplate || {
    name: '',
    description: '',
    category: 'research_report',
    sections: [],
  });

  const categories = [
    { value: 'research_report', label: '研究报告' },
    { value: 'thesis', label: '学术论文' },
    { value: 'literature_review', label: '文献综述' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
        <h2 className="text-xl font-semibold">模板编辑</h2>
        <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">创建和编辑学术报告模板</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            模板名称
          </label>
          <input
            type="text"
            value={template.name || ''}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
            placeholder="输入模板名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            模板描述
          </label>
          <textarea
            value={template.description || ''}
            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
            placeholder="输入模板描述"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            模板分类
          </label>
          <select
            value={template.category || 'research_report'}
            onChange={(e) => setTemplate({ ...template, category: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <h3 className="font-medium mb-3">模板章节</h3>
        {template.sections && template.sections.length > 0 ? (
          <div className="space-y-2">
            {template.sections.map((section: any, index: number) => (
              <div key={section.id || index} className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <div className="font-medium">{section.name || `章节 ${index + 1}`}</div>
                <div className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{section.type}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无章节</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-700"
        >
          取消
        </button>
        <button
          onClick={() => onSave?.(template)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          保存模板
        </button>
      </div>
    </div>
  );
}
