import { describe, it, expect } from 'vitest';
import {
  moduleDataToChapters,
  parseReferences,
  v2ReportToReportItemData,
  reportItemToReportDocument,
  reportDocumentToReportItemData,
  normalizeReportType,
} from '@/utils/academicReportLinkage';
import { ReportModuleType } from '@/types/academicReportModules';
import type { ModuleData, ReportMetadata } from '@/types/academicReportModules';
import type { AICandidate } from '@/types';
import type { ReportItem } from '@/stores/academicReportStore';

describe('academicReportLinkage', () => {
  describe('normalizeReportType', () => {
    it('maps research_report to research', () => {
      expect(normalizeReportType('research_report')).toBe('research');
    });

    it('passes journal and thesis through', () => {
      expect(normalizeReportType('journal')).toBe('journal');
      expect(normalizeReportType('thesis')).toBe('thesis');
    });

    it('falls back to research for undefined or unknown types', () => {
      expect(normalizeReportType(undefined)).toBe('research');
      expect(normalizeReportType('review')).toBe('research');
      expect(normalizeReportType('technical')).toBe('research');
      expect(normalizeReportType('')).toBe('research');
    });
  });

  describe('moduleDataToChapters', () => {
    const now = 1234567890000;

    it('maps modules to chapters with stable ids, order, and type', () => {
      const modules = [
        {
          type: ReportModuleType.ABSTRACT,
          data: { title: '摘要', content: '摘要正文' } as ModuleData,
        },
        {
          type: ReportModuleType.INTRODUCTION,
          data: { title: '1 引言', content: '引言正文' } as ModuleData,
        },
        {
          type: ReportModuleType.APPENDIX,
          data: { title: '附录', content: '附录正文' } as ModuleData,
        },
      ];

      const chapters = moduleDataToChapters(modules, now);

      expect(chapters).toHaveLength(3);
      expect(chapters[0]).toMatchObject({
        id: `ch-${now}-${ReportModuleType.ABSTRACT}-0`,
        title: '摘要',
        content: '摘要正文',
        level: 1,
        order: 1,
        type: 'abstract',
        children: [],
      });
      expect(chapters[1]).toMatchObject({
        id: `ch-${now}-${ReportModuleType.INTRODUCTION}-1`,
        title: '1 引言',
        order: 2,
        type: 'normal',
      });
      expect(chapters[2]).toMatchObject({
        id: `ch-${now}-${ReportModuleType.APPENDIX}-2`,
        order: 3,
        type: 'appendix',
      });
    });

    it('preserves tables and figures', () => {
      const modules = [
        {
          type: ReportModuleType.RESULTS,
          data: {
            title: '4 研究结果',
            content: '结果',
            tables: [{ title: '表1 成分含量', headers: ['成分', '含量'], rows: [['黄芪', '10g']] }],
            figures: [{ title: '图1 通路图', description: '通路图描述' }],
          } as ModuleData,
        },
      ];

      const chapters = moduleDataToChapters(modules, now);
      expect(chapters[0]?.tables).toEqual([
        { id: `tbl-${now}-${ReportModuleType.RESULTS}-0`, caption: '表1 成分含量', headers: ['成分', '含量'], rows: [['黄芪', '10g']] },
      ]);
      expect(chapters[0]?.figures).toEqual([
        { id: `fig-${now}-${ReportModuleType.RESULTS}-0`, caption: '图1 通路图', data: '通路图描述' },
      ]);
    });
  });

  describe('parseReferences', () => {
    it('splits numbered reference lines', () => {
      const content = '[1] 张三. 测试文章[J]. 测试期刊, 2024.\n\n[2] 李四. 测试书[M]. 北京: 出版社, 2023.\n普通文本';
      expect(parseReferences(content)).toEqual([
        '[1] 张三. 测试文章[J]. 测试期刊, 2024.',
        '[2] 李四. 测试书[M]. 北京: 出版社, 2023.',
      ]);
    });

    it('trims whitespace around reference lines', () => {
      expect(parseReferences('  [1] 缩进条目  \n[2] 第二条  ')).toEqual([
        '[1] 缩进条目',
        '[2] 第二条',
      ]);
    });

    it('keeps the whole content when no numbered lines exist', () => {
      expect(parseReferences('无编号的参考文献文本')).toEqual(['无编号的参考文献文本']);
    });

    it('returns empty array for empty content', () => {
      expect(parseReferences('')).toEqual([]);
      expect(parseReferences('   \n  ')).toEqual([]);
    });
  });

  describe('v2ReportToReportItemData', () => {
    const metadata: ReportMetadata = {
      title: '配方研发学术报告',
      authors: ['项目组'],
      institution: '某机构',
      date: '2026-10-28',
      abstract: '',
      keywords: ['药食同源', '免疫'],
      reportType: 'research_report',
      version: '1.2',
    };

    const modules = [
      {
        type: ReportModuleType.ABSTRACT,
        data: { title: '摘要', content: '模块摘要正文' } as ModuleData,
      },
      {
        type: ReportModuleType.RESULTS,
        data: { title: '4 研究结果', content: '结果正文' } as ModuleData,
      },
      {
        type: ReportModuleType.REFERENCES,
        data: {
          title: '参考文献',
          content: '[1] 张三. 测试文章[J]. 测试期刊, 2024.\n[2] 李四. 测试书[M]. 北京: 出版社, 2023.',
        } as ModuleData,
      },
    ];

    const candidate: AICandidate = {
      id: 'cand-001',
      name: '黄芪姜黄复合肽固体饮料',
      effects: [],
      formula_name: '黄芪姜黄复合肽固体饮料',
    };

    it('maps metadata/modules/candidate/templateId to ReportItem data', () => {
      const itemData = v2ReportToReportItemData({
        metadata,
        modules,
        candidate,
        templateId: 'research_report',
      });

      expect(itemData.title).toBe('配方研发学术报告');
      // metadata.abstract 为空时回退到 ABSTRACT 模块内容
      expect(itemData.abstract).toBe('模块摘要正文');
      expect(itemData.authors).toEqual(['项目组']);
      expect(itemData.keywords).toEqual(['药食同源', '免疫']);
      expect(itemData.chapters).toHaveLength(3);
      expect(itemData.references).toEqual([
        '[1] 张三. 测试文章[J]. 测试期刊, 2024.',
        '[2] 李四. 测试书[M]. 北京: 出版社, 2023.',
      ]);
      expect(itemData.templateId).toBe('research_report');
      expect(itemData.version).toBe('1.2');
      expect(itemData.status).toBe('draft');
      expect(itemData.formulaId).toBe('cand-001');
      expect(itemData.formulaName).toBe('黄芪姜黄复合肽固体饮料');
    });

    it('uses candidate.candidateId / candidate.name as fallbacks', () => {
      const itemData = v2ReportToReportItemData({
        metadata,
        modules,
        candidate: { candidateId: 'cand-fallback', name: '备用配方名' } as AICandidate,
        templateId: 'journal',
      });

      expect(itemData.formulaId).toBe('cand-fallback');
      expect(itemData.formulaName).toBe('备用配方名');
      expect(itemData.templateId).toBe('journal');
    });
  });

  describe('ReportItem ↔ ReportDocument round-trip', () => {
    const metadata: ReportMetadata = {
      title: '配方研发学术报告',
      authors: ['项目组'],
      institution: '某机构',
      date: '2026-10-28',
      abstract: '',
      keywords: ['药食同源'],
      reportType: 'research_report',
      version: '1.0',
    };

    const modules = [
      {
        type: ReportModuleType.ABSTRACT,
        data: { title: '摘要', content: '摘要正文' } as ModuleData,
      },
      {
        type: ReportModuleType.INTRODUCTION,
        data: { title: '1 引言', content: '引言正文' } as ModuleData,
      },
      {
        type: ReportModuleType.REFERENCES,
        data: {
          title: '参考文献',
          content: '[1] 张三. 测试文章[J]. 测试期刊, 2024.',
        } as ModuleData,
      },
    ];

    const candidate: AICandidate = { id: 'cand-001', formula_name: '测试配方' };

    const itemData = v2ReportToReportItemData({
      metadata,
      modules,
      candidate,
      templateId: 'research_report',
    });

    const report: ReportItem = {
      ...itemData,
      id: 'report-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };

    it('converts ReportItem → ReportDocument with normalized type', () => {
      const doc = reportItemToReportDocument(report);

      expect(doc.id).toBe('report-1');
      expect(doc.title).toBe('配方研发学术报告');
      expect(doc.type).toBe('research');
      expect(doc.templateId).toBe('research_report');
      expect(doc.abstractChinese).toBe('摘要正文');
      expect(doc.authors).toEqual(['项目组']);
      expect(doc.keywords).toEqual(['药食同源']);
      expect(doc.chapters).toHaveLength(3);
      expect(doc.citations).toEqual([]);
      expect(doc.citationStyle).toBe('gbt7714');
      expect(doc.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(doc.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    });

    it('round-trips ReportDocument → ReportItemData preserving key fields', () => {
      const doc = reportItemToReportDocument(report);
      const roundTrip = reportDocumentToReportItemData(doc, report);

      expect(roundTrip.title).toBe(report.title);
      expect(roundTrip.abstract).toBe(report.abstract);
      expect(roundTrip.authors).toEqual(report.authors);
      expect(roundTrip.keywords).toEqual(report.keywords);
      expect(roundTrip.chapters).toEqual(report.chapters);
      expect(roundTrip.references).toEqual(report.references);
      expect(roundTrip.templateId).toBe(report.templateId);
      expect(roundTrip.version).toBe(report.version);
      expect(roundTrip.status).toBe(report.status);
      expect(roundTrip.formulaId).toBe(report.formulaId);
      expect(roundTrip.formulaName).toBe(report.formulaName);
    });

    it('keeps original references when document has no reference chapter', () => {
      const doc = reportItemToReportDocument(report);
      const docWithoutRefChapter: typeof doc = {
        ...doc,
        chapters: doc.chapters.filter(ch => ch.title.trim() !== '参考文献'),
      };

      const roundTrip = reportDocumentToReportItemData(docWithoutRefChapter, report);
      expect(roundTrip.references).toEqual(report.references);
    });
  });
});