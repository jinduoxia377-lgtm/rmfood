/**
 * PDF 中文导出服务
 * 提供完整的中文 PDF 支持，包括中文字体、分页、书签等功能
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AcademicReport } from './academicReportService';


import { logger } from '@/utils/safeLogger';
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

const CHINESE_FONT = {
  name: 'SimSun',
  style: 'normal',
};

interface PageState {
  currentY: number;
  currentPage: number;
  totalPages: number;
  pageHeight: number;
  margins: { top: number; right: number; bottom: number; left: number };
  maxContentWidth: number;
}

export class ChinesePdfExportService {
  private doc: jsPDF;
  private options: ResolvedPdfOptions;
  private pageState: PageState;

  constructor(options: Partial<ChinesePdfOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options } as ResolvedPdfOptions;

    this.doc = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: 'a4',
    });

    this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);

    this.pageState = {
      currentY: this.options.margins.top,
      currentPage: 1,
      totalPages: 1,
      pageHeight: this.doc.internal.pageSize.getHeight(),
      margins: this.options.margins,
      maxContentWidth: this.doc.internal.pageSize.getWidth() - this.options.margins.left - this.options.margins.right,
    };

    this.setupDocumentProperties();
  }

  private setupDocumentProperties(): void {
    this.doc.setProperties({
      title: this.options.title,
      subject: this.options.subject,
      author: this.options.author,
      creator: 'RMFOOD 配方平台',
      keywords: this.options.keywords?.join(', '),
    });
  }

  private checkPageBreak(requiredSpace: number): void {
    const availableSpace = this.pageState.pageHeight - this.options.margins.bottom - this.pageState.currentY;

    if (availableSpace < requiredSpace) {
      this.addNewPage();
    }
  }

  private addNewPage(): void {
    this.addFooter(this.pageState.currentPage);
    this.doc.addPage();
    this.pageState.currentPage++;
    this.pageState.totalPages = this.pageState.currentPage;
    this.pageState.currentY = this.options.margins.top;

    if (this.options.showHeader) {
      this.addHeader();
    }
  }

  private addHeader(): void {
    const pageWidth = this.doc.internal.pageSize.getWidth();

    this.doc.setFontSize(this.options.fontSize.small);
    this.doc.setTextColor(150, 150, 150);
    this.doc.text(this.options.headerText, pageWidth / 2, 15, { align: 'center' });

    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.line(this.options.margins.left, 18, pageWidth - this.options.margins.right, 18);

    this.pageState.currentY = 22;
  }

  private addFooter(pageNum: number): void {
    if (!this.options.showFooter) return;

    const pageWidth = this.doc.internal.pageSize.getWidth();
    const pageHeight = this.doc.internal.pageSize.getHeight();

    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.line(
      this.options.margins.left,
      pageHeight - this.options.margins.bottom + 8,
      pageWidth - this.options.margins.right,
      pageHeight - this.options.margins.bottom + 8,
    );

    this.doc.setFontSize(this.options.fontSize.small);
    this.doc.setTextColor(150, 150, 150);
    this.doc.text(this.options.footerText, this.options.margins.left, pageHeight - this.options.margins.bottom + 13);

    if (this.options.showPageNumbers) {
      this.doc.text(
        `第 ${pageNum} 页 / 共 ${this.pageState.totalPages} 页`,
        pageWidth - this.options.margins.right,
        pageHeight - this.options.margins.bottom + 13,
        { align: 'right' },
      );
    }
  }

  private addTitle(title: string): void {
    this.checkPageBreak(30);

    const pageWidth = this.doc.internal.pageSize.getWidth();

    this.doc.setFontSize(this.options.fontSize.title);
    this.doc.setTextColor(30, 64, 175);
    this.doc.setFont(CHINESE_FONT.name, 'bold');

    const titleLines = this.doc.splitTextToSize(
      title,
      pageWidth - this.options.margins.left - this.options.margins.right,
    );

    this.doc.text(titleLines, pageWidth / 2, this.pageState.currentY + 10, { align: 'center' });

    this.pageState.currentY += 10 + titleLines.length * 8;

    this.doc.setDrawColor(30, 64, 175);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      this.options.margins.left,
      this.pageState.currentY,
      pageWidth - this.options.margins.right,
      this.pageState.currentY,
    );

    this.pageState.currentY += 10;
    this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);
  }

  private addInfoItem(label: string, value: string): void {
    this.checkPageBreak(8);

    this.doc.setFontSize(this.options.fontSize.body);
    this.doc.setTextColor(60, 60, 60);
    this.doc.setFont(CHINESE_FONT.name, 'bold');
    this.doc.text(`${label}：`, this.options.margins.left, this.pageState.currentY);

    this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);
    const labelWidth = this.doc.getTextWidth(`${label}：`);
    this.doc.text(value, this.options.margins.left + labelWidth, this.pageState.currentY);

    this.pageState.currentY += 8;
  }

  private addSectionTitle(title: string, level = 1): void {
    const spacing = level === 1 ? 15 : 12;
    this.checkPageBreak(spacing + 10);

    const pageWidth = this.doc.internal.pageSize.getWidth();

    if (level === 1) {
      this.doc.setFontSize(this.options.fontSize.heading);
      this.doc.setTextColor(30, 64, 175);
      this.doc.setFont(CHINESE_FONT.name, 'bold');

      this.doc.text(title, this.options.margins.left, this.pageState.currentY);

      this.doc.setDrawColor(30, 64, 175);
      this.doc.setLineWidth(0.3);
      this.doc.line(
        this.options.margins.left,
        this.pageState.currentY + 3,
        pageWidth - this.options.margins.right,
        this.pageState.currentY + 3,
      );
    } else {
      this.doc.setFontSize(this.options.fontSize.body + 1);
      this.doc.setTextColor(60, 60, 60);
      this.doc.setFont(CHINESE_FONT.name, 'bold');
      this.doc.text(title, this.options.margins.left + 5, this.pageState.currentY);
    }

    this.pageState.currentY += spacing;
    this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);
  }

  private addParagraph(text: string, indent = true): void {
    const lines = this.doc.splitTextToSize(text, this.pageState.maxContentWidth - (indent ? 10 : 0));

    lines.forEach((line: string) => {
      this.checkPageBreak(8);

      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setTextColor(40, 40, 40);

      const xPos = indent ? this.options.margins.left + 10 : this.options.margins.left;
      this.doc.text(line, xPos, this.pageState.currentY);

      this.pageState.currentY += 7;
    });

    this.pageState.currentY += 5;
  }

  private addBulletPoint(text: string): void {
    this.checkPageBreak(8);

    this.doc.setFontSize(this.options.fontSize.body);
    this.doc.setTextColor(40, 40, 40);

    this.doc.text('•', this.options.margins.left + 10, this.pageState.currentY);

    const bulletWidth = this.doc.getTextWidth('• ');
    const lines = this.doc.splitTextToSize(text, this.pageState.maxContentWidth - bulletWidth - 10);

    this.doc.text(lines, this.options.margins.left + 10 + bulletWidth, this.pageState.currentY);

    this.pageState.currentY += 7 * lines.length;
  }

  private addTable(headers: string[], rows: string[][], title?: string): void {
    if (title) {
      this.checkPageBreak(15);
      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setTextColor(80, 80, 80);
      this.doc.setFont(CHINESE_FONT.name, 'bold');
      this.doc.text(title, this.options.margins.left, this.pageState.currentY);
      this.pageState.currentY += 8;
      this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);
    }

    const startY = this.pageState.currentY;

    autoTable(this.doc, {
      head: [headers],
      body: rows,
      startY,
      margin: {
        top: 5,
        right: this.options.margins.right,
        bottom: this.options.margins.bottom,
        left: this.options.margins.left,
      },
      styles: {
        font: CHINESE_FONT.name,
        fontSize: this.options.fontSize.small,
        cellPadding: 3,
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: this.options.fontSize.small,
      },
      bodyStyles: {
        textColor: [40, 40, 40],
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
      },
      didDrawPage: () => {
        this.pageState.currentY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      },
    });

    this.pageState.currentY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  private addReferences(references: AcademicReport['references']): void {
    this.addSectionTitle('参考文献');

    references.forEach((ref) => {
      this.checkPageBreak(10);

      const refText = [
        `[${ref.number}] `,
        ref.authors,
        ref.title ? `. ${ref.title}` : '',
        ref.journal ? `[J]. ${ref.journal}` : '',
        ref.year ? `, ${ref.year}` : '',
        ref.volume ? `, ${ref.volume}` : '',
        ref.pages ? `(${ref.pages})` : '',
        ref.doi ? `. DOI: ${ref.doi}` : '',
      ].join('');

      this.doc.setFontSize(this.options.fontSize.small);
      this.doc.setTextColor(80, 80, 80);

      const lines = this.doc.splitTextToSize(refText, this.pageState.maxContentWidth);

      this.doc.text(lines, this.options.margins.left + 5, this.pageState.currentY);
      this.pageState.currentY += 6 * lines.length;
    });

    this.pageState.currentY += 10;
  }

  public async exportReport(report: AcademicReport): Promise<Blob> {
    try {
      this.addTitle(report.title);

      this.doc.setFontSize(this.options.fontSize.body);
      this.doc.setTextColor(100, 100, 100);

      this.addInfoItem('配方名称', report.formulaName);
      this.addInfoItem('配方类型', report.formulaType);
      this.addInfoItem('目标人群', report.targetPopulation);
      this.addInfoItem('功效声称', report.efficacyClaims.join('、'));
      this.addInfoItem('作者', report.authors.join('、'));
      this.addInfoItem('单位', report.institution);
      this.addInfoItem('日期', report.date);

      this.pageState.currentY += 10;

      this.addSectionTitle('摘要', 1);
      this.addParagraph(report.abstract);

      this.addInfoItem('关键词', report.keywords.join('、'));

      this.pageState.currentY += 10;

      report.chapters.forEach((chapter) => {
        this.addSectionTitle(chapter.title, 1);

        const paragraphs = chapter.content.split('\n');
        paragraphs.forEach((para) => {
          const trimmed = para.trim();
          if (!trimmed) return;

          if (trimmed.startsWith('### ')) {
            this.addSectionTitle(trimmed.replace('### ', ''), 2);
          } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
            this.doc.setFont(CHINESE_FONT.name, 'bold');
            this.addParagraph(trimmed.replace(/\*\*/g, ''), false);
            this.doc.setFont(CHINESE_FONT.name, CHINESE_FONT.style);
          } else if (trimmed.startsWith('- ')) {
            this.addBulletPoint(trimmed.substring(2));
          } else if (/^\d+\./.exec(trimmed)) {
            this.addParagraph(trimmed, false);
          } else if (trimmed) {
            this.addParagraph(trimmed);
          }
        });

        if (chapter.tables && chapter.tables.length > 0) {
          this.pageState.currentY += 5;
          chapter.tables.forEach((table) => {
            this.addTable(table.headers, table.rows, table.title);
          });
        }

        this.pageState.currentY += 10;
      });

      if (report.references && report.references.length > 0) {
        this.addReferences(report.references);
      }

      for (let i = 1; i <= this.pageState.totalPages; i++) {
        this.doc.setPage(i);
        this.addFooter(i);
      }

      const blob = this.doc.output('blob');
      return blob;
    } catch (error) {
      logger.error('[ChinesePdfExportService] Export failed:', error);
      throw new Error(`PDF导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  public async exportAndDownload(report: AcademicReport): Promise<void> {
    const blob = await this.exportReport(report);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.options.filename}_${this.formatDate()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
