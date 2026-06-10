import { useState } from 'react';
import { FileText, ArrowRight, Check } from 'lucide-react';

interface TemplateWizardProps {
  onComplete?: (template: unknown) => void;
  onCancel?: () => void;
}

export function TemplateWizard({ onComplete, onCancel }: TemplateWizardProps) {
  const [step, setStep] = useState(1);
  const [templateData, setTemplateData] = useState({
    name: '',
    description: '',
    category: 'research_report',
    structure: {
      sections: [] as string[],
    },
  });

  const categories = [
    { value: 'research_report', label: '研究报告' },
    { value: 'thesis', label: '学术论文' },
    { value: 'literature_review', label: '文献综述' },
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete?.(templateData);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-16 h-0.5 ${step > s ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">基本信息</h2>
          <div>
            <label className="block text-sm font-medium mb-1">模板名称</label>
            <input
              type="text"
              value={templateData.name}
              onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="输入模板名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模板描述</label>
            <textarea
              value={templateData.description}
              onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              placeholder="输入模板描述"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模板分类</label>
            <select
              value={templateData.category}
              onChange={(e) => setTemplateData({ ...templateData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">章节结构</h2>
          <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">选择预设章节模板或自定义章节</p>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">确认信息</h2>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p><strong>名称：</strong>{templateData.name}</p>
            <p><strong>分类：</strong>{categories.find(c => c.value === templateData.category)?.label}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          取消
        </button>
        <div className="flex gap-2">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            {step < 3 ? '下一步' : '完成'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
