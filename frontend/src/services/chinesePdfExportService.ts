/**
 * PDF 中文导出服务
 * 提供中文 PDF 导出支持。
 *
 * 实现说明：jsPDF 内置字体不含 CJK 字形，直接 setFont('SimSun') 会抛
 * "Unknown font" 异常。本服务统一采用「生成 HTML → 浏览器打印 → 另存为 PDF」
 * 方案，由浏览器原生渲染中文（无乱码）。
 */

import type { AcademicReport } from './academicReportService';
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter';
import { feedbackService } from './feedbackService';

export interface ChinesePdfOptions {
  filename?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  orientation?: 'portrait' | 'landscape';
  fontSize?: {
    title?: number;
    heading?: number;
    body?: number;
    small?: number;
  };
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  showPageNumbers?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  headerText?: string;
  footerText?: string;
}

type ResolvedPdfOptions = Required<ChinesePdfOptions> & {
  fontSize: Required<NonNullable<ChinesePdfOptions['fontSize']>>;
  margins: Required<NonNullable<ChinesePdfOptions['margins']>>;
};

const DEFAULT_OPTIONS: ResolvedPdfOptions = {
  filename: '配方学术报告',
  title: '配方研发学术报告',
  author: '莱茵分子生物科技有限公司',
  subject: '药食同源复方研发报告',
  keywords: ['药食同源', '配方研发', '学术报告'],
  orientation: 'portrait',
  fontSize: {
    title: 20,
    heading: 16,
    body: 11,
    small: 9,
  },
  margins: {
    top: 25,
    right: 20,
    bottom: 25,
    left: 25,
  },
  showPageNumbers: true,
  showHeader: true,
  showFooter: true,
  headerText: '配方研发学术报告',
  footerText: '© 莱茵分子生物科技有限公司',
};

/** 将 Markdown 正文转换为简单 HTML（打印用） */
function markdownToHtml(content: string): string {
  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const h3 = trimmed.match(/^###\s+(.+)/);
      if (h3) return `<h3>${h3[1]}</h3>`;
      const h4 = trimmed.match(/^####\s+(.+)/);
      if (h4) return `<h4>${h4[1]}</h4>`;
      if (trimmed.startsWith('- ')) return `<p>• ${trimmed.slice(2)}</p>`;
      if (/^\d+\./.test(trimmed)) return `<p>${trimmed}</p>`;
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return `<p><strong>${trimmed.replace(/\*\*/g, '')}</strong></p>`;
      }
      return `<p>${trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n');
}

/** 将 AcademicReport 转换为完整可打印 HTML */
function academicReportToHtml(report: AcademicReport, title: string): string {
  const sections: string[] = [];

  sections.push(`<h1>${title}</h1>`);
  sections.push(`<p style="text-align:center;">作者：${report.authors.join('、')}｜单位：${report.institution}｜日期：${report.date}</p>`);
  sections.push(`<h2>摘要</h2><p>${report.abstract}</p>`);

  report.chapters.forEach((chapter, index) => {
    sections.push(`<h2>${index + 1}. ${chapter.title}</h2>`);
    sections.push(markdownToHtml(chapter.content));
    if (chapter.tables) {
      chapter.tables.forEach(table => {
        sections.push(`<h3>${table.title}</h3>`);
        sections.push('<table><thead><tr>');
        table.headers.forEach(h => { sections.push(`<th>${h}</th>`); });
        sections.push('</tr></thead><tbody>');
        table.rows.forEach(row => {
          sections.push('<tr>');
          row.forEach(cell => { sections.push(`<td>${cell}</td>`); });
          sections.push('</tr>');
        });
        sections.push('</tbody></table>');
      });
    }
  });

  if (report.references && report.references.length > 0) {
    sections.push('<h2>参考文献</h2>');
    report.references.forEach(ref => {
      sections.push(`<p>[${ref.number}] ${ref.authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}${ref.volume ? `, ${ref.volume}` : ''}${ref.pages ? `(${ref.pages})` : ''}${ref.doi ? `. DOI: ${ref.doi}` : ''}</p>`);
    });
  }

  return wrapPrintHtml(sections.join('\n'), title);
}

export class ChinesePdfExportService {
  private options: ResolvedPdfOptions;

  constructor(options: Partial<ChinesePdfOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as ResolvedPdfOptions;
  }

  public async exportReport(report: AcademicReport): Promise<Blob> {
    try {
      const title = this.options.title || report.title;
      const html = academicReportToHtml(report, title);

      exportHtmlAsPdf(html, {
        title,
        onError: (message) => {
          feedbackService.showError('导出失败', message);
        },
      });

      // 为兼容调用方，返回 HTML Blob（打印窗口已打开，不再用于下载）
      return new Blob([html], { type: 'text/html;charset=utf-8' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      feedbackService.showError('导出失败', `PDF导出失败: ${message}`);
      throw new Error(`PDF导出失败: ${message}`);
    }
  }

  public async exportAndDownload(report: AcademicReport): Promise<void> {
    // 浏览器打印方案：打开打印窗口后由用户选择「另存为 PDF」，无需下载 Blob
    await this.exportReport(report);
  }

  private formatDate(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
}

export function exportAcademicReportToChinesePdf(
  report: AcademicReport,
  options?: Partial<ChinesePdfOptions>,
): Promise<Blob> {
  const service = new ChinesePdfExportService(options);
  return service.exportReport(report);
}

export function downloadAcademicReportAsPdf(
  report: AcademicReport,
  options?: Partial<ChinesePdfOptions>,
): Promise<void> {
  const service = new ChinesePdfExportService(options);
  return service.exportAndDownload(report);
}