/**
 * PDF 高级导出工具
 * 提供书签、目录、页眉页脚等高级功能
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AcademicReport, AcademicReportSection } from './academicReportService';

export interface AdvancedPdfOptions {
  filename?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  orientation?: 'portrait' | 'landscape';
  fontName?: string;
  fontSize?: {
    cover?: number;
    title?: number;
    heading?: number;
    body?: number;
    small?: number;
  };
  colors?: {
    primary?: [number, number, number];
    secondary?: [number, number, number];
    text?: [number, number, number];
    accent?: [number, number, number];
  };
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  showHeader?: boolean;
  showFooter?: boolean;
  showToc?: boolean;
  showBookmarks?: boolean;
  headerText?: string;
  footerText?: string;
}

const DEFAULT_ADVANCED_OPTIONS: Required<AdvancedPdfOptions> = {
  filename: '配方学术报告',
  title: '配方研发学术报告',
  author: '莱茵分子生物科技有限公司',
  subject: '药食同源复方研发报告',
  keywords: ['药食同源', '配方研发', '学术报告'],
  orientation: 'portrait',
  fontName: 'SimSun',
  fontSize: {
    cover: 24,
    title: 18,
    heading: 14,
    body: 10,
    small: 8,
  },
  colors: {
    primary: [30, 64, 175],
    secondary: [100, 100, 100],
    text: [40, 40, 40],
    accent: [0, 100, 150],
  },
  margins: {
    top: 30,
    right: 20,
    bottom: 30,
    left: 25,
  },
  showHeader: true,
  showFooter: true,
  showToc: true,
  showBookmarks: true,
  headerText: '配方研发学术报告',
  footerText: '© 莱茵分子生物科技有限公司',
};

interface BookmarkItem {
  title: string;
  page: number;
  level: number;
  y: number;
}

export class AdvancedPdfExportService {
  private doc: jsPDF;
  private options: Required<AdvancedPdfOptions>;
  private currentY: number;
  private pageNumber: number;
  private totalPages: number;
  private pageHeight: number;
  private pageWidth: number;
  private maxContentWidth: number;
  private bookmarks: BookmarkItem[];
  private tocItems: { title: string; page: number; level: number }[];

  constructor(options: Partial<AdvancedPdfOptions> = {}) {
    this.options = { ...DEFAULT_ADVANCED_OPTIONS, ...options } as Required<AdvancedPdfOptions>;

    this.doc = new jsPDF({
      orientation: this.options.orientation,
      unit: 'mm',
      format: 'a4',
    });

    this.doc.setFont(this.options.fontName, 'normal');

    this.currentY = this.options.margins.top!;
    this.pageNumber = 1;
    this.totalPages = 1;
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.maxContentWidth = this.pageWidth - this.options.margins.left! - this.options.margins.right!;
    this.bookmarks = [];
    this.tocItems = [];

    this.setupDocument();
  }

  private setupDocument(): void {
    this.doc.setProperties({
      title: this.options.title,
      subject: this.options.subject,
      author: this.options.author,
      creator: 'RMFOOD 配方平台',
      keywords: this.options.keywords?.join(', '),
    });
  }

  private checkPageBreak(requiredSpace: number): boolean {
    return this.currentY + requiredSpace > this.pageHeight - this.options.margins.bottom!;
  }

  private addNewPage(): void {
    this.addFooter();
    this.doc.addPage();
    this.pageNumber++;
    this.totalPages = this.pageNumber;
    this.currentY = this.options.margins.top!;

    if (this.options.showHeader) {
      this.addHeader();
    }

    return;
  }

  private addHeader(): void {
    this.doc.setFontSize(this.options.fontSize.small!);
    this.doc.setTextColor(...this.options.colors.secondary!);
    this.doc.text(this.options.headerText, this.pageWidth / 2, 15, { align: 'center' });

    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.line(this.options.margins.left!, 18, this.pageWidth - this.options.margins.right!, 18);

    this.currentY = 22;
  }

  private addFooter(): void {
    if (!this.options.showFooter) return;

    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.2);
    this.doc.line(
      this.options.margins.left!,
      this.pageHeight - this.options.margins.bottom! + 10,
      this.pageWidth - this.options.margins.right!,
      this.pageHeight - this.options.margins.bottom! + 10,
    );

    this.doc.setFontSize(this.options.fontSize.small!);
    this.doc.setTextColor(...this.options.colors.secondary!);
    this.doc.text(
      this.options.footerText,
      this.options.margins.left!,
      this.pageHeight - this.options.margins.bottom! + 15,
    );

    this.doc.text(
      `第 ${this.pageNumber} 页 / 共 ${this.totalPages} 页`,
      this.pageWidth - this.options.margins.right!,
      this.pageHeight - this.options.margins.bottom! + 15,
      { align: 'right' },
    );
  }

  private addBookmark(title: string, level = 0): void {
    this.bookmarks.push({
      title,
      page: this.pageNumber,
      level,
      y: this.currentY,
    });
  }

  private renderCover(report: AcademicReport): void {
    this.doc.setFillColor(...this.options.colors.primary!);
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(this.options.fontSize.cover!);
    this.doc.setFont(this.options.fontName, 'bold');

    const titleLines = this.doc.splitTextToSize(report.title, this.maxContentWidth);
    this.doc.text(titleLines, this.pageWidth / 2, this.pageHeight / 3, { align: 'center' });

    this.currentY = this.pageHeight / 3 + titleLines.length * 12;

    this.doc.setFontSize(this.options.fontSize.heading!);
    this.doc.setFont(this.options.fontName, 'normal');
    this.doc.text(report.formulaName, this.pageWidth / 2, this.currentY + 20, { align: 'center' });

    this.currentY += 40;

    this.doc.setFontSize(this.options.fontSize.body!);
    this.doc.text(`作者：${report.authors?.join('、') || '配方研发项目组'}`, this.pageWidth / 2, this.currentY, {
      align: 'center',
    });

    this.currentY += 8;
    this.doc.text(report.institution || '莱茵分子生物科技有限公司', this.pageWidth / 2, this.currentY, {
      align: 'center',
    });

    this.currentY += 8;
    this.doc.text(report.date, this.pageWidth / 2, this.currentY, { align: 'center' });

    this.addNewPage();
  }

  private renderToc(report: AcademicReport): void {
    this.doc.setFontSize(this.options.fontSize.title!);
    this.doc.setTextColor(...this.options.colors.primary!);
    this.doc.setFont(this.options.fontName, 'bold');
    this.doc.text('目 录', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 15;

    this.doc.setDrawColor(...this.options.colors.primary!);
    this.doc.setLineWidth(0.5);
    this.doc.line(
      this.options.margins.left!,
      this.currentY,
      this.pageWidth - this.options.margins.right!,
      this.currentY,
    );
    this.currentY += 10;

    report.chapters.forEach((chapter, index) => {
      if (this.checkPageBreak(12)) {
        this.addNewPage();
      }

      const tocText = `${index + 1}. ${chapter.title}`;
      const pageNum = this.pageNumber + Math.floor((index + 1) / 20);

      this.doc.setFontSize(this.options.fontSize.body!);
      this.doc.setTextColor(...this.options.colors.text!);
      this.doc.setFont(this.options.fontName, 'normal');

      this.doc.text(tocText, this.options.margins.left!, this.currentY);

      this.doc.setTextColor(...this.options.colors.secondary!);
      const dots = '.'.repeat(50);
      const dotsWidth = this.doc.getTextWidth(dots);
      const textWidth = this.doc.getTextWidth(tocText);
      const pageNumWidth = this.doc.getTextWidth(` ${pageNum}`);

      if (textWidth + dotsWidth + pageNumWidth < this.maxContentWidth) {
        this.doc.text(
          dots.substring(0, Math.floor((this.maxContentWidth - textWidth - pageNumWidth) / this.doc.getTextWidth('.'))),
          this.options.margins.left! + textWidth,
          this.currentY,
        );
      }

      this.doc.text(` ${pageNum}`, this.pageWidth - this.options.margins.right! - pageNumWidth, this.currentY);

      this.tocItems.push({
        title: chapter.title,
        page: this.pageNumber,
        level: 0,
      });

      this.currentY += 10;
    });

    this.addNewPage();
  }

  private renderSection(section: AcademicReportSection, index: number): void {
    if (this.checkPageBreak(30)) {
      this.addNewPage();
    }

    this.addBookmark(section.title, 0);

    this.doc.setFontSize(this.options.fontSize.heading!);
    this.doc.setTextColor(...this.options.colors.primary!);
    this.doc.setFont(this.options.fontName, 'bold');

    this.doc.text(`${index + 1}. ${section.title}`, this.options.margins.left!, this.currentY);

    this.currentY += 10;

    this.doc.setDrawColor(...this.options.colors.primary!);
    this.doc.setLineWidth(0.3);
    this.doc.line(
      this.options.margins.left!,
      this.currentY,
      this.pageWidth - this.options.margins.right!,
      this.currentY,
    );
    this.currentY += 8;

    this.doc.setFont(this.options.fontName, 'normal');
    this.doc.setFontSize(this.options.fontSize.body!);
    this.doc.setTextColor(...this.options.colors.text!);

    const paragraphs = section.content.split('\n');
    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('### ')) {
        if (this.checkPageBreak(15)) this.addNewPage();

        this.addBookmark(trimmed.replace('### ', ''), 1);

        this.doc.setFontSize(this.options.fontSize.body! + 1);
        this.doc.setTextColor(...this.options.colors.text!);
        this.doc.setFont(this.options.fontName, 'bold');
        this.doc.text(trimmed.replace('### ', ''), this.options.margins.left! + 5, this.currentY);
        this.currentY += 8;
        this.doc.setFont(this.options.fontName, 'normal');
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        if (this.checkPageBreak(10)) this.addNewPage();

        this.doc.setFont(this.options.fontName, 'bold');
        const boldText = trimmed.replace(/\*\*/g, '');
        const boldLines = this.doc.splitTextToSize(boldText, this.maxContentWidth);
        this.doc.text(boldLines, this.options.margins.left!, this.currentY);
        this.currentY += boldLines.length * 6;
        this.doc.setFont(this.options.fontName, 'normal');
      } else if (trimmed.startsWith('- ')) {
        if (this.checkPageBreak(10)) this.addNewPage();

        this.doc.setTextColor(...this.options.colors.text!);
        this.doc.text('•', this.options.margins.left! + 5, this.currentY);

        const bulletLines = this.doc.splitTextToSize(trimmed.substring(2), this.maxContentWidth - 10);
        this.doc.text(bulletLines, this.options.margins.left! + 10, this.currentY);
        this.currentY += bulletLines.length * 6;
      } else if (/^\d+\./.exec(trimmed)) {
        if (this.checkPageBreak(10)) this.addNewPage();

        this.doc.text(trimmed, this.options.margins.left!, this.currentY);
        this.currentY += 6;
      } else {
        if (this.checkPageBreak(10)) this.addNewPage();

        const contentLines = this.doc.splitTextToSize(trimmed, this.maxContentWidth - 10);
        this.doc.text(contentLines, this.options.margins.left! + 10, this.currentY);
        this.currentY += contentLines.length * 6;
      }
    });

    if (section.tables && section.tables.length > 0) {
      this.currentY += 5;
      section.tables.forEach((table) => {
        if (this.checkPageBreak(25)) this.addNewPage();

        this.doc.setFontSize(this.options.fontSize.body!);
        this.doc.setTextColor(...this.options.colors.secondary!);
        this.doc.setFont(this.options.fontName, 'bold');
        this.doc.text(table.title, this.options.margins.left!, this.currentY);
        this.currentY += 5;

        autoTable(this.doc, {
          head: [table.headers],
          body: table.rows,
          startY: this.currentY,
          margin: {
            left: this.options.margins.left!,
            right: this.options.margins.right!,
          },
          styles: {
            font: this.options.fontName,
            fontSize: this.options.fontSize.small!,
            cellPadding: 2,
            lineColor: [180, 180, 180],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: this.options.colors.primary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
          },
          bodyStyles: {
            textColor: this.options.colors.text,
            halign: 'left',
          },
          alternateRowStyles: {
            fillColor: [248, 248, 248],
          },
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        this.doc.setFont(this.options.fontName, 'normal');
      });
    }

    this.currentY += 10;
  }

  private renderReferences(references: AcademicReport['references']): void {
    if (this.checkPageBreak(25)) {
      this.addNewPage();
    }

    this.addBookmark('参考文献', 0);

    this.doc.setFontSize(this.options.fontSize.heading!);
    this.doc.setTextColor(...this.options.colors.primary!);
    this.doc.setFont(this.options.fontName, 'bold');
    this.doc.text('参考文献', this.options.margins.left!, this.currentY);
    this.currentY += 10;

    this.doc.setFont(this.options.fontName, 'normal');
    this.doc.setFontSize(this.options.fontSize.small!);
    this.doc.setTextColor(...this.options.colors.secondary!);

    references.forEach((ref, i) => {
      if (this.checkPageBreak(15)) this.addNewPage();

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

      const refLines = this.doc.splitTextToSize(refText, this.maxContentWidth);

      this.doc.text(refLines, this.options.margins.left! + 5, this.currentY);
      this.currentY += refLines.length * 5;
    });

    this.currentY += 10;
  }

  private addBookmarksToPdf(): void {
    try {
      const outline = this.doc.outline;

      if (outline && this.bookmarks.length > 0) {
        let currentLevel0: any = null;
        let currentLevel1: any = null;

        this.bookmarks.forEach((bookmark) => {
          const page = this.doc.internal.pages[bookmark.page];

          if (bookmark.level === 0) {
            currentLevel0 = {
              title: bookmark.title,
              pageNumber: bookmark.page,
            };
            (outline as any).addPage(currentLevel0);
            currentLevel1 = null;
          } else if (bookmark.level === 1 && currentLevel0) {
            currentLevel1 = {
              title: bookmark.title,
              pageNumber: bookmark.page,
            };
            currentLevel0.children = currentLevel0.children || [];
            currentLevel0.children.push(currentLevel1);
          }
        });
      }
    } catch (error) {
      console.warn('[AdvancedPdfExport] Failed to add bookmarks:', error);
    }
  }

  public async export(report: AcademicReport): Promise<Blob> {
    try {
      if (this.options.showBookmarks) {
        this.renderCover(report);
      }

      if (this.options.showToc) {
        this.renderToc(report);
      }

      if (report.chapters) {
        report.chapters.forEach((chapter, index) => {
          this.renderSection(chapter, index);
        });
      }

      if (report.references && report.references.length > 0) {
        this.renderReferences(report.references);
      }

      for (let i = 1; i <= this.totalPages; i++) {
        this.doc.setPage(i);
        this.addFooter();
      }

      this.addBookmarksToPdf();

      const blob = this.doc.output('blob');
      return blob;
    } catch (error) {
      console.error('[AdvancedPdfExport] Export failed:', error);
      throw new Error(`PDF导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  public async exportAndDownload(report: AcademicReport): Promise<void> {
    const blob = await this.export(report);
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

export function exportToAdvancedPdf(report: AcademicReport, options?: Partial<AdvancedPdfOptions>): Promise<Blob> {
  const service = new AdvancedPdfExportService(options);
  return service.export(report);
}

export function downloadAdvancedPdf(report: AcademicReport, options?: Partial<AdvancedPdfOptions>): Promise<void> {
  const service = new AdvancedPdfExportService(options);
  return service.exportAndDownload(report);
}
