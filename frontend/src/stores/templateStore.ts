import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Template, TemplateCategory } from '@/types/academic-report-lifecycle';

interface TemplateState {
  // 模板列表
  templates: Template[];
  selectedTemplate: Template | null;

  // 搜索和过滤
  searchQuery: string;
  categoryFilter: TemplateCategory | 'all';

  // 加载状态
  isLoading: boolean;
  error: string | null;

  // 操作
  loadTemplates: () => void;
  selectTemplate: (id: string) => void;
  createTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;

  // 版本管理
  createVersion: (templateId: string, description: string) => void;
  rollbackToVersion: (templateId: string, versionNumber: number) => void;

  // 选择器
  filteredTemplates: () => Template[];
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      selectedTemplate: null,
      searchQuery: '',
      categoryFilter: 'all',
      isLoading: false,
      error: null,

      loadTemplates: () => {
        set({ isLoading: true, error: null });
        const mockTemplates: Template[] = [
          {
            id: 'template-journal',
            name: '期刊论文模板',
            description: '适用于学术期刊投稿的标准格式',
            category: 'journal_article',
            structure: {
              sections: [
                { id: 'abstract', name: '摘要', title: '摘要', type: 'abstract', required: true, order: 1 },
                { id: 'introduction', name: '引言', title: '引言', type: 'chapter', required: true, order: 2 },
                { id: 'methods', name: '材料与方法', title: '材料与方法', type: 'chapter', required: true, order: 3 },
                { id: 'results', name: '结果', title: '结果', type: 'chapter', required: true, order: 4 },
                { id: 'discussion', name: '讨论', title: '讨论', type: 'chapter', required: true, order: 5 },
                { id: 'conclusion', name: '结论', title: '结论', type: 'chapter', required: false, order: 6 },
                { id: 'references', name: '参考文献', title: '参考文献', type: 'reference', required: true, order: 7 },
              ],
              layouts: { default: 'single-column' },
              pageSettings: {
                size: 'A4',
                orientation: 'portrait',
                margins: { top: 25, right: 25, bottom: 25, left: 25 },
              },
            },
            styles: {
              fonts: { heading: 'SimSun', body: 'SimSun', caption: 'SimSun', title: 'SimSun' },
              colors: { primary: '#1e40af', secondary: '#475569', accent: '#0ea5e9' },
              spacing: { lineHeight: 1.5, paragraphSpacing: 12, marginTop: 18, marginBottom: 12, headingSpacing: 18 },
              headings: {
                h1: { fontSize: 16, fontWeight: 'bold', color: '#1e40af' },
                h2: { fontSize: 14, fontWeight: 'bold', color: '#334155' },
                h3: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
              },
            },
            variables: [],
            version: '1',
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'template-thesis',
            name: '学位论文模板',
            description: '适用于硕士/博士学位论文格式',
            category: 'thesis_master',
            structure: {
              sections: [
                { id: 'abstract-cn', name: '中文摘要', title: '中文摘要', type: 'abstract', required: true, order: 1 },
                { id: 'abstract-en', name: '英文摘要', title: '英文摘要', type: 'abstract', required: true, order: 2 },
                { id: 'contents', name: '目录', title: '目录', type: 'toc', required: true, order: 3 },
                { id: 'intro', name: '引言', title: '引言', type: 'chapter', required: true, order: 4 },
                { id: 'literature', name: '文献综述', title: '文献综述', type: 'chapter', required: true, order: 5 },
                { id: 'methods', name: '研究方法', title: '研究方法', type: 'chapter', required: true, order: 6 },
                { id: 'results', name: '研究结果', title: '研究结果', type: 'chapter', required: true, order: 7 },
                { id: 'discussion', name: '讨论', title: '讨论', type: 'chapter', required: true, order: 8 },
                { id: 'conclusion', name: '结论', title: '结论', type: 'chapter', required: true, order: 9 },
                { id: 'references', name: '参考文献', title: '参考文献', type: 'reference', required: true, order: 10 },
                { id: 'appendix', name: '附录', title: '附录', type: 'appendix', required: false, order: 11 },
              ],
              layouts: { default: 'single-column' },
              pageSettings: {
                size: 'A4',
                orientation: 'portrait',
                margins: { top: 30, right: 25, bottom: 25, left: 35 },
              },
            },
            styles: {
              fonts: { heading: 'SimHei', body: 'SimSun', caption: 'SimSun', title: 'SimHei' },
              colors: { primary: '#1f2937', secondary: '#4b5563', accent: '#3b82f6' },
              spacing: { lineHeight: 1.8, paragraphSpacing: 15, marginTop: 24, marginBottom: 15, headingSpacing: 24 },
              headings: {
                h1: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
                h2: { fontSize: 16, fontWeight: 'bold', color: '#374151' },
                h3: { fontSize: 14, fontWeight: 'bold', color: '#4b5563' },
                h4: { fontSize: 12, fontWeight: 'bold', color: '#6b7280' },
              },
            },
            variables: [],
            version: '1',
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'template-research',
            name: '研究报告模板',
            description: '适用于科研项目结题报告',
            category: 'research_report',
            structure: {
              sections: [
                { id: 'summary', name: '项目概述', title: '项目概述', type: 'chapter', required: true, order: 1 },
                { id: 'objectives', name: '研究目标', title: '研究目标', type: 'chapter', required: true, order: 2 },
                { id: 'methods', name: '研究方法', title: '研究方法', type: 'chapter', required: true, order: 3 },
                { id: 'results', name: '研究成果', title: '研究成果', type: 'chapter', required: true, order: 4 },
                { id: 'analysis', name: '数据分析', title: '数据分析', type: 'chapter', required: true, order: 5 },
                { id: 'conclusion', name: '结论与建议', title: '结论与建议', type: 'chapter', required: true, order: 6 },
                { id: 'references', name: '参考文献', title: '参考文献', type: 'reference', required: true, order: 7 },
              ],
              layouts: { default: 'single-column' },
              pageSettings: {
                size: 'A4',
                orientation: 'portrait',
                margins: { top: 25, right: 25, bottom: 25, left: 25 },
              },
            },
            styles: {
              fonts: { heading: 'SimHei', body: 'SimSun', caption: 'SimSun', title: 'SimHei' },
              colors: { primary: '#065f46', secondary: '#3f6212', accent: '#10b981' },
              spacing: { lineHeight: 1.6, paragraphSpacing: 12, marginTop: 20, marginBottom: 12, headingSpacing: 20 },
              headings: {
                h1: { fontSize: 18, fontWeight: 'bold', color: '#065f46' },
                h2: { fontSize: 15, fontWeight: 'bold', color: '#047857' },
                h3: { fontSize: 13, fontWeight: 'bold', color: '#059669' },
              },
            },
            variables: [],
            version: '1',
            isPublic: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        set({ templates: mockTemplates, isLoading: false });
      },

      selectTemplate: (id: string) => {
        const template = get().templates.find(t => t.id === id);
        set({ selectedTemplate: template || null });
      },

      createTemplate: (templateData) => {
        const newTemplate: Template = {
          ...templateData,
          id: `template-${Date.now()}`,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({
          templates: [...state.templates, newTemplate],
          selectedTemplate: newTemplate,
        }));
      },

      updateTemplate: (id: string, updates) => {
        set(state => ({
          templates: state.templates.map(t =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
          ),
          selectedTemplate: state.selectedTemplate?.id === id
            ? { ...state.selectedTemplate, ...updates, updatedAt: new Date().toISOString() }
            : state.selectedTemplate,
        }));
      },

      deleteTemplate: (id: string) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== id),
          selectedTemplate: state.selectedTemplate?.id === id ? null : state.selectedTemplate,
        }));
      },

      duplicateTemplate: (id: string) => {
        const template = get().templates.find(t => t.id === id);
        if (template) {
          const duplicated: Template = {
            ...template,
            id: `template-${Date.now()}`,
            name: `${template.name} (副本)`,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set(state => ({
            templates: [...state.templates, duplicated],
            selectedTemplate: duplicated,
          }));
        }
      },

      createVersion: (templateId: string, _description: string) => {
        set(state => ({
          templates: state.templates.map(t =>
            t.id === templateId
              ? { ...t, version: String((parseInt(String(t.version)) || 1) + 1), updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
      },

      rollbackToVersion: (templateId: string, versionNumber: number) => {
        set(state => ({
          templates: state.templates.map(t =>
            t.id === templateId
              ? { ...t, version: versionNumber, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
      },

      filteredTemplates: () => {
        const { templates, searchQuery, categoryFilter } = get();
        return templates.filter(template => {
          const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               template.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
          return matchesSearch && matchesCategory;
        });
      },
    }),
    {
      name: 'template-storage',
    },
  ),
);
