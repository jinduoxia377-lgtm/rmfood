import React, { useState } from 'react';
import type {
  ReportSection,
} from '../../../types/report.types';
import {
  SectionType,
  DetailLevel,
} from '../../../types/report.types';
import { useReportStructure } from '../../../hooks/useReportStructure';

interface StructureEditorProps {
  initialSections: ReportSection[];
  onChange: (sections: ReportSection[]) => void;
  availableSections?: AvailableSection[];
}

interface AvailableSection {
  type: SectionType;
  title: string;
  icon: string;
  description: string;
}

const defaultAvailableSections: AvailableSection[] = [
  { type: SectionType.COVER, title: '封面', icon: '📄', description: '文档封面页' },
  { type: SectionType.TABLE_OF_CONTENTS, title: '目录', icon: '📑', description: '章节目录' },
  { type: SectionType.EXECUTIVE_SUMMARY, title: '摘要/执行摘要', icon: '📝', description: '内容概要' },
  { type: SectionType.INTRODUCTION, title: '引言', icon: '🚀', description: '背景介绍' },
  { type: SectionType.BACKGROUND, title: '背景', icon: '📚', description: '研究背景' },
  { type: SectionType.LITERATURE_REVIEW, title: '文献综述', icon: '📖', description: '相关研究' },
  { type: SectionType.OBJECTIVES, title: '目标与假设', icon: '🎯', description: '研究目标' },
  { type: SectionType.METHODOLOGY, title: '方法', icon: '⚙️', description: '研究方法' },
  { type: SectionType.MATERIALS, title: '材料', icon: '🧪', description: '实验材料' },
  { type: SectionType.EXPERIMENTAL_PROCEDURE, title: '实验步骤', icon: '📋', description: '操作流程' },
  { type: SectionType.DATA_COLLECTION, title: '数据收集', icon: '📊', description: '数据记录' },
  { type: SectionType.RESULTS, title: '结果', icon: '✅', description: '实验结果' },
  { type: SectionType.ANALYSIS, title: '分析', icon: '📈', description: '数据分析' },
  { type: SectionType.DISCUSSION, title: '讨论', icon: '💬', description: '结果讨论' },
  { type: SectionType.CONCLUSION, title: '结论', icon: '🏁', description: '总结结论' },
  { type: SectionType.RECOMMENDATIONS, title: '建议', icon: '💡', description: '改进建议' },
  { type: SectionType.REFERENCES, title: '参考文献', icon: '📚', description: '引用列表' },
  { type: SectionType.APPENDICES, title: '附录', icon: '📎', description: '补充材料' },
  { type: SectionType.CHARTS_AND_GRAPHS, title: '图表', icon: '📊', description: '可视化图表' },
  { type: SectionType.TABLES, title: '表格', icon: '📋', description: '数据表格' },
  { type: SectionType.CUSTOM_CONTENT, title: '自定义内容', icon: '✏️', description: '自由编辑区域' },
];

const StructureEditor: React.FC<StructureEditorProps> = ({
  initialSections,
  onChange,
  availableSections = defaultAvailableSections,
}) => {
  const structure = useReportStructure(initialSections);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [_showLibrary, setShowLibrary] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleSectionChange = () => {
    onChange(structure.sections);
  };

  React.useEffect(() => {
    handleSectionChange();
  }, [structure.sections]);

  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggedId(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = structure.sections.findIndex((s: ReportSection) => s.id === draggedId);
    const targetIndex = structure.sections.findIndex((s: ReportSection) => s.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      structure.reorderSections(draggedIndex, targetIndex);
    }

    setDraggedId(null);
  };

  const handleAddFromLibrary = (sectionType: SectionType) => {
    const newSection: ReportSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: sectionType,
      title: availableSections.find(s => s.type === sectionType)?.title || '新章节',
      required: false,
      order: structure.sections.length,
      level: 1,
      visible: true,
      detailLevel: DetailLevel.STANDARD,
      config: {},
    };

    structure.addSection(newSection);
    setShowLibrary(false);
  };

  return (
    <div className="flex h-[600px] bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-neutral-200">
      <div className="w-64 border-r border-neutral-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">章节库</h3>
        <div className="space-y-1">
          {availableSections.map((section) => (
            <button
              key={section.type}
              onClick={() => handleAddFromLibrary(section.type)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:bg-neutral-800 transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{section.icon}</span>
                <span className="text-sm text-neutral-700 group-hover:text-neutral-900">{section.title}</span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 ml-7">{section.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">报告结构</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => structure.resetToTemplate(initialSections)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 dark:bg-neutral-800 rounded-md hover:bg-neutral-200"
            >
              重置模板
            </button>
            <span className="text-xs text-neutral-500">
              共 {structure.getVisibleSections().length} 个可见章节
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {structure.sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">从左侧章节库添加章节开始构建报告结构</p>
            </div>
          ) : (
            <div className="space-y-1">
              {structure.sections.map((section: ReportSection, index: number) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, section.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, section.id)}
                  onClick={() => setSelectedSectionId(section.id)}
                  className={`group relative flex items-center px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSectionId === section.id
                      ? 'border-blue-500 bg-secondary-50'
                      : section.visible
                      ? 'border-neutral-200 hover:border-neutral-300 bg-white dark:bg-neutral-900'
                      : 'border-neutral-100 bg-slate-50 opacity-60'
                  } ${draggedId === section.id ? 'opacity-50' : ''}`}
                  style={{ paddingLeft: `${(section.level || 0) * 20 + 12}px` }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-500 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-neutral-400 cursor-grab active:cursor-grabbing" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>

                    <span className={`font-medium truncate ${!section.visible ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                      {section.title}
                    </span>

                    {!section.required && (
                      <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-xs rounded">
                        可选
                      </span>
                    )}

                    <span className="px-1.5 py-0.5 bg-secondary-50 text-secondary-600 text-xs rounded ml-auto">
                      {getDetailLevelLabel(section.detailLevel)}
                    </span>
                  </div>

                  <div className="hidden group-hover:flex items-center space-x-1 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        structure.toggleSectionVisibility(section.id);
                      }}
                      className="p-1 text-neutral-500 hover:text-secondary-600 rounded"
                      title={section.visible ? '隐藏' : '显示'}
                    >
                      {section.visible ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (index > 0) structure.moveSection(section.id, 'up');
                      }}
                      disabled={index === 0}
                      className="p-1 text-neutral-500 hover:text-secondary-600 rounded disabled:opacity-30"
                      title="上移"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (index < structure.sections.length - 1) structure.moveSection(section.id, 'down');
                      }}
                      disabled={index === structure.sections.length - 1}
                      className="p-1 text-neutral-500 hover:text-secondary-600 rounded disabled:opacity-30"
                      title="下移"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        structure.duplicateSection(section.id);
                      }}
                      className="p-1 text-neutral-500 hover:text-success-600 rounded"
                      title="复制"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {!section.required && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          structure.removeSection(section.id);
                          setSelectedSectionId(null);
                        }}
                        className="p-1 text-neutral-500 hover:text-error-600 rounded"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedSectionId && (
          <div className="border-t border-neutral-200 p-4 bg-slate-50 dark:bg-neutral-800">
            <SectionPropertyPanel
              section={structure.getSectionById(selectedSectionId)!}
              onUpdate={(updates) => structure.updateSection(selectedSectionId, updates)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionPropertyPanelProps {
  section: ReportSection;
  onUpdate: (updates: Partial<ReportSection>) => void;
}

const SectionPropertyPanel: React.FC<SectionPropertyPanelProps> = ({ section, onUpdate }) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-neutral-900">章节属性</h4>

      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">标题</label>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">详细程度</label>
        <select
          value={section.detailLevel}
          onChange={(e) => onUpdate({ detailLevel: e.target.value as DetailLevel })}
          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={DetailLevel.BRIEF}>简略</option>
          <option value={DetailLevel.STANDARD}>标准</option>
          <option value={DetailLevel.DETAILED}>详细</option>
          <option value={DetailLevel.COMPREHENSIVE}>全面</option>
        </select>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={section.visible}
            onChange={(e) => onUpdate({ visible: e.target.checked })}
            className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-neutral-700">可见</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={section.config?.includeTables !== false}
            onChange={(e) => onUpdate({
              config: { ...section.config, includeTables: e.target.checked },
            })}
            className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-neutral-700">包含表格</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={section.config?.includeCharts !== false}
            onChange={(e) => onUpdate({
              config: { ...section.config, includeCharts: e.target.checked },
            })}
            className="w-4 h-4 text-secondary-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-neutral-700">包含图表</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1">最大字数（可选）</label>
        <input
          type="number"
          value={section.config?.maxWords || ''}
          onChange={(e) => onUpdate({
            config: { ...section.config, maxWords: e.target.value ? Number(e.target.value) : undefined },
          })}
          placeholder="不限"
          className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

function getDetailLevelLabel(level: DetailLevel): string {
  switch (level) {
    case DetailLevel.BRIEF: return '简略';
    case DetailLevel.STANDARD: return '标准';
    case DetailLevel.DETAILED: return '详细';
    case DetailLevel.COMPREHENSIVE: return '全面';
    default: return level;
  }
}

export default StructureEditor;
