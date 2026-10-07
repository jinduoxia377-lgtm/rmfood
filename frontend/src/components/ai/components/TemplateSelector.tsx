import React, { useState, useMemo } from 'react';
import { ReportTemplate, ReportTemplateType, ReportLanguage, DetailLevel } from '../../../types/report.types';
import {
  allTemplates,
  getRecommendedTemplates,
  searchTemplates,
  getTemplatesByType,
} from '../../../utils/reportTemplates';

interface TemplateSelectorProps {
  onSelect: (template: ReportTemplate) => void;
  onPreview?: (template: ReportTemplate) => void;
  selectedTemplateId?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect, onPreview, selectedTemplateId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ReportTemplateType | 'all'>('all');
  const [showRecommended, setShowRecommended] = useState(true);

  const filteredTemplates = useMemo(() => {
    let templates = showRecommended ? getRecommendedTemplates() : allTemplates;

    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }

    if (selectedType !== 'all') {
      templates = templates.filter((t: ReportTemplate) => t.type === selectedType);
    }

    return templates;
  }, [searchQuery, selectedType, showRecommended]);

  const templateTypes = [
    { value: 'all' as const, label: '全部', icon: '📚' },
    { value: ReportTemplateType.ACADEMIC, label: '学术研究', icon: '🎓' },
    { value: ReportTemplateType.BUSINESS, label: '商业提案', icon: '💼' },
    { value: ReportTemplateType.EXPERIMENT, label: '实验记录', icon: '🔬' },
    { value: ReportTemplateType.PATENT, label: '专利申请', icon: '📋' },
    { value: ReportTemplateType.REGULATORY, label: '监管申报', icon: '🏛️' },
  ];

  const getTypeColor = (type: ReportTemplateType): string => {
    switch (type) {
      case ReportTemplateType.ACADEMIC:
        return 'border-blue-500 bg-secondary-50 hover:bg-secondary-100';
      case ReportTemplateType.BUSINESS:
        return 'border-green-500 bg-success-50 hover:bg-success-100';
      case ReportTemplateType.EXPERIMENT:
        return 'border-purple-500 bg-accent-50 hover:bg-accent-100';
      case ReportTemplateType.PATENT:
        return 'border-red-500 bg-error-50 hover:bg-error-100';
      case ReportTemplateType.REGULATORY:
        return 'border-cyan-500 bg-cyan-50 hover:bg-cyan-100';
      default:
        return 'border-neutral-500 bg-slate-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:bg-neutral-800';
    }
  };

  const getSelectedIndicatorColor = (type: ReportTemplateType): string => {
    switch (type) {
      case ReportTemplateType.ACADEMIC:
        return 'bg-secondary-500';
      case ReportTemplateType.BUSINESS:
        return 'bg-success-500';
      case ReportTemplateType.EXPERIMENT:
        return 'bg-accent-500';
      case ReportTemplateType.PATENT:
        return 'bg-error-500';
      case ReportTemplateType.REGULATORY:
        return 'bg-cyan-500';
      default:
        return 'bg-neutral-500';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="h2 text-neutral-900">选择报告模板</h2>
          <p className="mt-1 text-sm text-neutral-600">选择适合您需求的报告模板，或自定义模板结构</p>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRecommended}
            onChange={(e) => setShowRecommended(e.target.checked)}
            className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-neutral-700">仅显示推荐模板</span>
        </label>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="搜索模板名称、描述或标签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {templateTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedType === type.value
                ? 'bg-secondary-container text-secondary-main shadow-md'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            <span className="mr-1">{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template: ReportTemplate) => (
          <div
            key={template.id}
             role="button" tabIndex={0} onClick={() => onSelect(template)}
            className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg ${
              selectedTemplateId === template.id
                ? `${getTypeColor(template.type)} ring-2 ring-offset-2 ring-blue-500`
                : `border-neutral-200 bg-white dark:bg-neutral-900 hover:border-neutral-300`
            }`}
          >
            {selectedTemplateId === template.id && (
              <div
                className={`absolute top-4 right-4 w-6 h-6 ${getSelectedIndicatorColor(template.type)} rounded-full flex items-center justify-center`}
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}

            <div className="flex items-start space-x-4">
              <div className="text-4xl">{template.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900 truncate">{template.name}</h3>
                <p className="text-sm text-neutral-500 mt-0.5">{template.nameEn}</p>
              </div>
            </div>

            <p className="mt-3 text-sm text-neutral-600 line-clamp-2">{template.description}</p>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-3 text-xs text-neutral-500">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {template.metadata.rating}
                </span>
                <span>{template.metadata.usageCount.toLocaleString()} 次使用</span>
              </div>

              <div className="flex items-center space-x-1">
                {template.metadata.isOfficial && (
                  <span className="px-2 py-0.5 bg-secondary-100 text-secondary-700 text-xs rounded-full font-medium">官方</span>
                )}
                {template.metadata.isRecommended && (
                  <span className="px-2 py-0.5 bg-success-100 text-success-700 text-xs rounded-full font-medium">推荐</span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="flex flex-wrap gap-1">
                {template.supportedLanguages.map((lang: ReportLanguage) => (
                  <span key={lang} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 text-xs rounded">
                    {lang === 'zh-CN' ? '中文' : 'English'}
                  </span>
                ))}
                {template.supportedDetailLevels.map((level: DetailLevel) => (
                  <span key={level} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 text-xs rounded">
                    {getDetailLevelLabel(level)}
                  </span>
                ))}
              </div>
            </div>

            {onPreview && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(template);
                }}
                className="mt-3 w-full px-3 py-1.5 text-sm text-secondary-600 bg-secondary-50 rounded-md hover:bg-secondary-100 transition-colors"
              >
                预览模板结构 →
              </button>
            )}
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-neutral-600">未找到匹配的模板</p>
          <p className="text-xs text-neutral-400 mt-1">尝试调整搜索条件或筛选器</p>
        </div>
      )}
    </div>
  );
};

function getDetailLevelLabel(level: DetailLevel): string {
  switch (level) {
    case DetailLevel.BRIEF:
      return '简略';
    case DetailLevel.STANDARD:
      return '标准';
    case DetailLevel.DETAILED:
      return '详细';
    case DetailLevel.COMPREHENSIVE:
      return '全面';
    default:
      return level;
  }
}

export default TemplateSelector;
