import { Download, Edit, Copy } from 'lucide-react';

interface TemplatePreviewProps {
  template?: {
    name?: string;
    description?: string;
    category?: string;
    sections?: {
      id: string;
      name: string;
      content?: string;
    }[];
  };
  onEdit?: () => void;
  onDuplicate?: () => void;
}

export function TemplatePreview({ template, onEdit, onDuplicate }: TemplatePreviewProps) {
  if (!template) {
    return (
      <div className="flex items-center justify-center h-64 border rounded-lg bg-neutral-50 dark:bg-neutral-800">
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">选择一个模板进行预览</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{template.name || '未命名模板'}</h2>
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">{template.description || '暂无描述'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDuplicate}
            className="flex items-center gap-2 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Edit className="w-4 h-4" />
            编辑
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white dark:bg-neutral-800">
        <h3 className="font-medium mb-4">模板章节结构</h3>
        {template.sections && template.sections.length > 0 ? (
          <div className="space-y-2">
            {template.sections.map((section, index) => (
              <div key={section.id || index} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                <span className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full text-sm font-medium">
                  {index + 1}
                </span>
                <span className="flex-1">{section.name || `章节 ${index + 1}`}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">暂无章节</p>
        )}
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700">
          <Download className="w-4 h-4" />
          导出模板
        </button>
      </div>
    </div>
  );
}
