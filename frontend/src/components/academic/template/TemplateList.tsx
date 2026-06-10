import { FileText, Plus, Search } from 'lucide-react';

interface TemplateListProps {
  templates?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  }[];
  onSelect?: (id: string) => void;
  onCreate?: () => void;
}

export function TemplateList({ templates = [], onSelect, onCreate }: TemplateListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索模板..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          />
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          创建模板
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => onSelect?.(template.id)}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{template.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                  {template.description || '暂无描述'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-400">暂无模板</p>
          <button
            onClick={onCreate}
            className="mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            创建第一个模板
          </button>
        </div>
      )}
    </div>
  );
}
