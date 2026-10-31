/**
 * AcademicExportService 导出链路测试
 *
 * 回归重点（P1-A）：`export({ format: 'pdf' })` 必须短路到浏览器打印方案
 * （exportToPdf），而不是走 `generateContent('') + createBlob` 生成 0 字节空文件。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcademicExportService } from '@/services/academicExportService';
import type { AcademicReport } from '@/services/academicReportService';
import { exportHtmlAsPdf } from '@/utils/pdfPrintExporter';

vi.mock('@/utils/pdfPrintExporter', () => ({
  exportHtmlAsPdf: vi.fn(),
  wrapPrintHtml: vi.fn(),
}));

vi.mock('@/services/feedbackService', () => ({
  feedbackService: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
}));

function buildReport(): AcademicReport {
  return {
    title: '测试学术报告',
    formulaName: '测试配方',
    formulaType: 'research',
    targetPopulation: '成年人',
    efficacyClaims: ['增强免疫'],
    authors: ['张三'],
    institution: '测试单位',
    date: '2026-10-28',
    abstract: '这是报告摘要。',
    keywords: ['免疫', '配方'],
    chapters: [
      { title: '第一章 概述', content: '这是第一章内容。' },
      { title: '参考文献', content: '[1] 张三. 测试文献[J]. 测试期刊, 2026, 1(1): 1-5.' },
    ],
    // 编辑器实际传入的 report 对象无 V1 references 数组（引用以 citations/章节形式存在），
    // 这里置空以贴合真实出口，避免触发 V1 references 的 string/string[] 类型不一致历史问题。
    references: [],
  };
}

describe('AcademicExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pdf 导出短路到打印方案，不再产生 0 字节 Blob', async () => {
    const service = new AcademicExportService(buildReport());
    const result = await service.export({
      format: 'pdf',
      citationStyle: 'gbt7714',
      includeReferences: true,
    });

    expect(result.success).toBe(true);
    // 打印方案不产生可下载 Blob（新窗口 → window.print → 另存为 PDF）
    expect(result.data).toBeUndefined();
    expect(result.filename.endsWith('.pdf')).toBe(true);
    // 必须真正调用打印导出器，而不是生成空内容
    expect(exportHtmlAsPdf).toHaveBeenCalledTimes(1);
    const htmlArg = vi.mocked(exportHtmlAsPdf).mock.calls[0]?.[0] ?? '';
    expect(htmlArg).toContain('测试学术报告');
    expect(htmlArg).toContain('这是报告摘要');
  });

  it('word 导出生成真实非空 .docx Blob', async () => {
    const service = new AcademicExportService(buildReport());
    const result = await service.export({
      format: 'word',
      citationStyle: 'gbt7714',
      includeReferences: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Blob);
    expect((result.data as Blob).size).toBeGreaterThan(0);
    expect(result.data?.type).toContain('wordprocessingml');
    expect(result.filename.endsWith('.docx')).toBe(true);
  });

  it('markdown / html 导出生成非空 Blob', async () => {
    const service = new AcademicExportService(buildReport());

    const md = await service.export({ format: 'markdown', citationStyle: 'gbt7714', includeReferences: true });
    expect(md.success).toBe(true);
    expect(md.data).toBeInstanceOf(Blob);
    expect((md.data as Blob).size).toBeGreaterThan(0);
    expect(md.filename.endsWith('.md')).toBe(true);

    const html = await service.export({ format: 'html', citationStyle: 'gbt7714', includeReferences: true });
    expect(html.success).toBe(true);
    expect(html.data).toBeInstanceOf(Blob);
    expect((html.data as Blob).size).toBeGreaterThan(0);
    expect(html.filename.endsWith('.html')).toBe(true);
  });

  it('pdf 分支不再经过 generateContent 空字符串（generateWord 死代码已删除）', async () => {
    const service = new AcademicExportService(buildReport());
    // 内部 createBlob 仅被 markdown/html 使用；pdf 走 exportToPdf 不生成空 Blob。
    // 这里通过验证 pdf 结果 data 为 undefined 而非空 Blob 来锁定行为。
    const pdf = await service.export({ format: 'pdf', citationStyle: 'gbt7714' });
    expect(pdf.data).toBeUndefined();

    // generateWord 死代码已删除：word 导出走 exportToDocx，不产生 HTML 伪装 .doc
    const word = await service.export({ format: 'word', citationStyle: 'gbt7714' });
    expect(word.data?.type).toContain('wordprocessingml');
    expect(word.data?.type).not.toBe('text/html');
  });
});