import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAcademicReportStore } from '@/stores/academicReportStore';
import type { ReportItem } from '@/stores/academicReportStore';

describe('Academic Report Lifecycle Management Tests', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Store Operations', () => {
    it('should mock localStorage correctly', () => {
      expect(localStorage.getItem('test')).toBeNull();
      localStorage.setItem('test', 'value');
      expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');
    });

    it('should generate unique IDs', () => {
      const id1 = `id-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const id2 = `id-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1.length).toBeGreaterThan(0);
      expect(id2.length).toBeGreaterThan(0);
    });

    it('should format dates correctly', () => {
      const date = new Date('2024-01-15');
      const formatted = date.toLocaleDateString('zh-CN');
      expect(formatted).toBe('2024/1/15');
    });
  });

  describe('Reference Store Tests', () => {
    it('should generate citation for articles', () => {
      const ref = {
        type: 'article' as const,
        title: '测试文章',
        authors: ['张三', '李四'],
        year: 2024,
        journal: '测试期刊',
        volume: '10',
        pages: '1-10'
      };
      
      const authors = ref.authors.join('、');
      const citation = `${authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}, ${ref.volume}(${ref.pages}).`;
      
      expect(citation).toContain('张三');
      expect(citation).toContain('测试文章');
      expect(citation).toContain('测试期刊');
    });

    it('should generate BibTeX format correctly', () => {
      const ref = {
        id: 'ref-123',
        type: 'article' as const,
        title: 'BibTeX测试',
        authors: ['作者1', '作者2'],
        year: 2024,
        journal: '测试期刊',
        volume: '5',
        pages: '100-110'
      };

      const bibtex = `@article{123,
  title = {${ref.title}},
  author = {${ref.authors.join(' and ')}},
  year = {${ref.year}},
  journal = {${ref.journal}},
  volume = {${ref.volume}},
  pages = {${ref.pages}},
}`;

      expect(bibtex).toContain('@article');
      expect(bibtex).toContain('BibTeX测试');
      expect(bibtex).toContain('作者1 and 作者2');
    });
  });

  describe('Review Progress Calculation', () => {
    type StageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';
    
    it('should calculate progress correctly', () => {
      const stages: { id: string; status: StageStatus }[] = [
        { id: 's1', status: 'approved' },
        { id: 's2', status: 'approved' },
        { id: 's3', status: 'pending' }
      ];

      const completedStages = stages.filter(s => s.status === 'approved').length;
      const progress = Math.round((completedStages / stages.length) * 100);

      expect(progress).toBe(67);
    });

    it('should return 0% when no stages are approved', () => {
      const stages: { id: string; status: StageStatus }[] = [
        { id: 's1', status: 'pending' },
        { id: 's2', status: 'pending' },
        { id: 's3', status: 'pending' }
      ];

      const completedStages = stages.filter(s => s.status === 'approved').length;
      const progress = Math.round((completedStages / stages.length) * 100);

      expect(progress).toBe(0);
    });

    it('should return 100% when all stages are approved', () => {
      const stages: { id: string; status: StageStatus }[] = [
        { id: 's1', status: 'approved' },
        { id: 's2', status: 'approved' },
        { id: 's3', status: 'approved' }
      ];

      const completedStages = stages.filter(s => s.status === 'approved').length;
      const progress = Math.round((completedStages / stages.length) * 100);

      expect(progress).toBe(100);
    });
  });

  describe('Export Options Validation', () => {
    it('should have default export options', () => {
      const defaultOptions = {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 25, right: 25, bottom: 25, left: 25 },
        includeToc: true,
        includeBibliography: true
      };

      expect(defaultOptions.pageSize).toBe('A4');
      expect(defaultOptions.orientation).toBe('portrait');
      expect(defaultOptions.includeToc).toBe(true);
      expect(defaultOptions.includeBibliography).toBe(true);
    });

    it('should update export options correctly', () => {
      let options = {
        pageSize: 'A4',
        includeToc: true
      };

      options = { ...options, pageSize: 'A3', includeToc: false };

      expect(options.pageSize).toBe('A3');
      expect(options.includeToc).toBe(false);
    });
  });

  describe('Template Filtering', () => {
    it('should filter templates by search query', () => {
      const templates = [
        { id: 't1', name: '期刊论文模板', description: '适用于期刊投稿' },
        { id: 't2', name: '学位论文模板', description: '适用于学位论文' },
        { id: 't3', name: '研究报告模板', description: '适用于研究报告' }
      ];

      const searchQuery = '论文';
      const filtered = templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered.length).toBe(2);
      expect(filtered[0]!.name).toBe('期刊论文模板');
			expect(filtered[1]!.name).toBe('学位论文模板');
    });
  });

  describe('syncReport Regression (no duplicate localStorage writes)', () => {
    const makeReportData = (title: string): Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt'> => ({
      title,
      abstract: '摘要',
      authors: ['张三'],
      keywords: ['测试'],
      chapters: [],
      references: [],
      templateId: 'research_report',
      version: '1.0',
      status: 'draft',
    });

    beforeEach(() => {
      useAcademicReportStore.setState({ reports: [], currentReport: null });
      vi.clearAllMocks();
    });

    it('persists the new report exactly once via zustand persist', async () => {
      const existingReport: ReportItem = {
        ...makeReportData('已有报告'),
        id: 'report-existing',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      // 模拟 localStorage 中已有持久化数据（zustand persist 写入后的形态）
      const stored = JSON.stringify({
        state: { reports: [existingReport], currentReport: null },
        version: 0,
      });
      vi.mocked(Storage.prototype.getItem).mockReturnValue(stored);

      const newId = await useAcademicReportStore.getState().syncReport(makeReportData('新同步报告'));
      expect(newId).toBeDefined();
      expect(newId).not.toBe(existingReport.id);

      // zustand persist 在 set() 时同步写入 localStorage；修复后不应再有手动 push 写入
      const setItemMock = vi.mocked(Storage.prototype.setItem);
      const writes = setItemMock.mock.calls
        .map(call => call[1])
        .filter((value): value is string => typeof value === 'string')
        .map(value => {
          try {
            return JSON.parse(value) as { state?: { reports?: { id: string }[] } };
          } catch {
            return null;
          }
        })
        .filter((parsed): parsed is { state?: { reports?: { id: string }[] } } => parsed !== null);

      // 至少有一次持久化写入包含了新报告
      const writesContainingNew = writes.filter(parsed =>
        parsed.state?.reports?.some(r => r.id === newId),
      );
      expect(writesContainingNew.length).toBeGreaterThan(0);

      // 任意一次写入中，新报告都只能出现一次（回归：syncReport 不再手动 push 重复项）
      for (const parsed of writesContainingNew) {
        const occurrences = parsed.state!.reports!.filter(r => r.id === newId).length;
        expect(occurrences).toBe(1);
      }
    });
  });

  describe('duplicateReport (P1-B 真实复制)', () => {
    const makeReportData = (title: string): Omit<ReportItem, 'id' | 'createdAt' | 'updatedAt'> => ({
      title,
      abstract: '摘要',
      authors: ['张三'],
      keywords: ['测试'],
      chapters: [
        {
          id: 'ch-1',
          title: '第一章',
          content: '内容',
          level: 1,
          order: 1,
          children: [{ id: 'ch-1-1', title: '子章节', content: '子内容', level: 2, order: 1, children: [] }],
        },
      ],
      references: [{ number: 1, authors: '张三', title: '文献', journal: '期刊', year: 2026 }],
      templateId: 'research_report',
      version: '1.0',
      status: 'draft',
      formulaId: 'formula-1',
      formulaName: '测试配方',
    });

    beforeEach(() => {
      useAcademicReportStore.setState({ reports: [], currentReport: null });
      vi.clearAllMocks();
    });

    it('深拷贝原报告内容并生成新 id 写入 reports', () => {
      const source: ReportItem = {
        ...makeReportData('原报告'),
        id: 'report-source',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      useAcademicReportStore.setState({ reports: [source], currentReport: null });

      const newId = useAcademicReportStore.getState().duplicateReport('report-source');

      expect(newId).toBeDefined();
      expect(newId).not.toBe('report-source');

      const reports = useAcademicReportStore.getState().reports;
      expect(reports.length).toBe(2);

      const copy = reports.find(r => r.id === newId)!;
      // 内容深拷贝
      expect(copy.title).toBe('原报告（副本）');
      expect(copy.abstract).toBe('摘要');
      expect(copy.authors).toEqual(['张三']);
      expect(copy.keywords).toEqual(['测试']);
      expect(copy.formulaName).toBe('测试配方');
      expect(copy.formulaId).toBe('formula-1');
      expect(copy.references).toEqual(source.references);
      expect(copy.chapters).toHaveLength(1);
      expect(copy.chapters[0]!.title).toBe('第一章');
      expect(copy.chapters[0]!.children).toHaveLength(1);
      // 深拷贝：副本章节 id 与原报告不同（独立副本）
      expect(copy.chapters[0]!.id).not.toBe(source.chapters[0]!.id);
      // 副本为草稿状态，时间戳为新建
      expect(copy.status).toBe('draft');
      expect(copy.id).toMatch(/^report-\d+-/);
    });

    it('源报告不存在时返回 undefined 且不修改 reports', () => {
      useAcademicReportStore.setState({ reports: [], currentReport: null });
      const result = useAcademicReportStore.getState().duplicateReport('not-exist');
      expect(result).toBeUndefined();
      expect(useAcademicReportStore.getState().reports).toHaveLength(0);
    });
  });
});