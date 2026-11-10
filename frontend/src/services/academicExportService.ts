/**
 * 学术报告多格式导出服务
 * 支持Markdown、HTML、Word、PDF四种格式导出
 */

import type { AcademicReport } from './academicReportService';
import type { Reference } from '@/types/academic-report';
import type { CitationStyle } from './citationFormatter';
import { CitationFormatterFactory } from './citationFormatter';
import { FigureNumberingManager } from './figureNumbering';
import { exportHtmlAsPdf } from '@/utils/pdfPrintExporter';
import { feedbackService } from './feedbackService';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';

export type ExportFormat = 'markdown' | 'html' | 'word' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  citationStyle: CitationStyle;
  includeFigures?: boolean;
  includeTables?: boolean;
  includeReferences?: boolean;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  data?: Blob;
  error?: string;
}

/**
 * HTML模板样式
 */
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "SimSun", "Songti SC", serif; line-height: 1.8; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 24px; text-align: center; margin-bottom: 10px; font-weight: bold; }
    h2 { font-size: 18px; margin-top: 30px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 2px solid #1a73e8; color: #1a73e8; }
    h3 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #333; }
    h4 { font-size: 14px; margin-top: 15px; margin-bottom: 8px; color: #555; }
    p { margin-bottom: 12px; text-indent: 2em; }
    ul, ol { margin-left: 2em; margin-bottom: 12px; }
    li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .figure { margin: 20px 0; text-align: center; }
    .figure img { max-width: 100%; height: auto; }
    .figure-caption { font-size: 14px; color: #666; margin-top: 5px; }
    .formula { font-family: "Times New Roman", serif; font-style: italic; text-align: center; margin: 15px 0; font-size: 16px; }
    .code-block { background-color: #f5f5f5; padding: 15px; border-radius: 4px; font-family: "Consolas", "Monaco", monospace; font-size: 14px; overflow-x: auto; margin: 15px 0; }
    .reference-list { margin-left: 1em; }
    .reference-item { margin-bottom: 8px; text-indent: -1em; padding-left: 1em; }
    .abstract { background-color: #f8f9fa; padding: 15px 20px; border-left: 4px solid #1a73e8; margin-bottom: 20px; }
    .author-info { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
    .keywords { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    {{content}}
  </div>
</body>
</html>
`;

export class AcademicExportService {
  private report: AcademicReport;
  private citationFormatter = CitationFormatterFactory;
  private numberingManager = new FigureNumberingManager();

  constructor(report: AcademicReport) {
    this.report = report;
  }

  /**
   * 导出报告
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    try {
      // Word 使用 docx 库生成真实 .docx
      if (options.format === 'word') {
        return await this.exportToDocx(options);
      }

      // PDF 使用浏览器打印方案（新窗口 → window.print → 另存为 PDF），
      // 避免生成空 Blob 导致下载 0 字节文件。
      if (options.format === 'pdf') {
        return await this.exportToPdf(options);
      }

      const content = await this.generateContent(options);
      const blob = await this.createBlob(content, options.format);
      const filename = this.generateFilename(options.format);

      return {
        success: true,
        filename,
        data: blob,
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : '导出失败',
      };
    }
  }

  /**
   * 生成导出内容（word/pdf 已在 export() 中短路到专用导出分支）
   */
  private async generateContent(options: ExportOptions): Promise<string> {
    switch (options.format) {
      case 'markdown':
        return this.generateMarkdown(options);
      case 'html':
        return this.generateHtml(options);
      default:
        return '';
    }
  }

  /**
   * 生成Markdown格式
   */
  private generateMarkdown(options: ExportOptions): string {
    const sections: string[] = [];

    if (this.report.title) {
      sections.push(`# ${this.report.title}`);
    }

    if (this.report.authors && this.report.authors.length > 0) {
      sections.push(`**作者**: ${this.report.authors.join('、')}`);
    }

    if (this.report.keywords) {
      sections.push(`**关键词**: ${this.report.keywords.join('、')}`);
    }

    if (this.report.abstract) {
      sections.push(`## 摘要\n\n${this.report.abstract}`);
    }

    if (this.report.chapters) {
      this.report.chapters.forEach((section, index) => {
        sections.push(`\n## ${index + 1}. ${section.title}`);
        sections.push(section.content);
      });
    }

    if (options.includeReferences && this.report.references && this.report.references.length > 0) {
      sections.push('\n## 参考文献');
      const formattedReferences = this.citationFormatter.formatMultiple(
        this.report.references as unknown as Reference[],
        options.citationStyle,
      );
      sections.push(...formattedReferences.map((ref, i) => `${i + 1}. ${ref}`));
    }

    return sections.join('\n\n');
  }

  /**
   * 生成HTML格式
   */
  private generateHtml(options: ExportOptions): string {
    const sections: string[] = [];

    if (this.report.title) {
      sections.push(`<h1>${this.report.title}</h1>`);
    }

    if (this.report.authors && this.report.authors.length > 0) {
      sections.push(`<div class="author-info">作者：${this.report.authors.join('、')}</div>`);
    }

    if (this.report.keywords) {
      sections.push(`<div class="keywords">关键词：${this.report.keywords.join('、')}</div>`);
    }

    if (this.report.abstract) {
      sections.push(`<div class="abstract"><strong>摘要：</strong>${this.report.abstract}</div>`);
    }

    if (this.report.chapters) {
      this.report.chapters.forEach((section, index) => {
        sections.push(`<h2>${index + 1}. ${section.title}</h2>`);
        sections.push(this.convertToHtml(section.content));
      });
    }

    if (options.includeReferences && this.report.references && this.report.references.length > 0) {
      sections.push('<h2>参考文献</h2>');
      sections.push('<div class="reference-list">');
      const formattedReferences = this.citationFormatter.formatMultiple(
        this.report.references as unknown as Reference[],
        options.citationStyle,
      );
      formattedReferences.forEach((ref, i) => {
        sections.push(`<div class="reference-item">${i + 1}. ${ref}</div>`);
      });
      sections.push('</div>');
    }

    const content = sections.join('\n');
    return HTML_TEMPLATE.replace('{{title}}', this.report.title || '学术报告')
                        .replace('{{content}}', content);
  }

  /**
   * 导出为PDF（中文优化版本，浏览器打印方案）
   */
  async exportToPdf(options: ExportOptions): Promise<ExportResult> {
    try {
      // 生成完整 HTML（含打印样式），交由浏览器原生渲染中文并打印为 PDF
      const html = this.generateHtml(options);
      const filename = this.generateFilename('pdf');

      exportHtmlAsPdf(html, {
        title: this.report.title || '学术报告',
        onSuccess: () => {
          feedbackService.showSuccess('导出成功', 'PDF 打印窗口已打开，请在打印对话框中选择“另存为 PDF”');
        },
        onError: (message) => {
          feedbackService.showError('导出失败', message);
        },
      });

      return {
        success: true,
        filename,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : 'PDF导出失败',
      };
    }
  }

  /**
   * 导出为真实 Word 文档（.docx，使用 docx 库）
   */
  async exportToDocx(options: ExportOptions): Promise<ExportResult> {
    try {
      const children: any[] = [];

      // 标题
      children.push(
        new Paragraph({
          children: [new TextRun({ text: this.report.title || '学术报告', bold: true, size: 36, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `作者：${this.report.authors?.join('、') || ''}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `单位：${this.report.institution || ''}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `日期：${this.report.date || ''}`, size: 24, font: 'SimSun' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      );

      // 摘要
      if (this.report.abstract) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '摘要', bold: true, size: 32, font: 'SimSun' })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: this.report.abstract, size: 24, font: 'SimSun' })],
            spacing: { after: 100 },
          }),
        );
      }

      // 章节
      this.report.chapters.forEach((section, index) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${index + 1}. ${section.title}`, bold: true, size: 32, font: 'SimSun' })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          }),
        );

        const lines = section.content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const plain = trimmed
            .replace(/^#{1,6}\s+/, '')
            .replace(/^\s*[-*+]\s+/, '• ')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
            .replace(/\|/g, ' ')
            .trim();
          children.push(
            new Paragraph({
              children: [new TextRun({ text: plain, size: 24, font: 'SimSun' })],
              spacing: { after: 100 },
            }),
          );
        }

        if (section.tables) {
          section.tables.forEach(table => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: table.title, bold: true, size: 24, font: 'SimSun' })],
                spacing: { before: 200, after: 100 },
              }),
            );
            const headerRow = new TableRow({
              tableHeader: true,
              children: table.headers.map(h =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'SimSun' })] })],
                }),
              ),
            });
            const bodyRows = table.rows.map(row =>
              new TableRow({
                children: row.map(c =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: c, font: 'SimSun' })] })],
                  }),
                ),
              }),
            );
            children.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [headerRow, ...bodyRows],
              }),
            );
          });
        }
      });

      // 参考文献
      if (options.includeReferences && this.report.references && this.report.references.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '参考文献', bold: true, size: 32, font: 'SimSun' })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          }),
        );
        this.report.references.forEach(ref => {
          const text = `${ref.number}. ${ref.authors}. ${ref.title}[J]. ${ref.journal}, ${ref.year}${ref.volume ? `, ${ref.volume}` : ''}${ref.pages ? `(${ref.pages})` : ''}${ref.doi ? `. DOI: ${ref.doi}` : ''}`;
          children.push(
            new Paragraph({
              children: [new TextRun({ text, size: 20, font: 'SimSun' })],
              spacing: { after: 80 },
            }),
          );
        });
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const filename = this.generateFilename('word');

      return {
        success: true,
        filename,
        data: blob,
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : 'Word导出失败',
      };
    }
  }

  /**
   * 创建Blob文件
   */
  private async createBlob(content: string, format: ExportFormat): Promise<Blob> {
    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown;charset=utf-8',
      html: 'text/html;charset=utf-8',
      word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
    };

    return new Blob([content], { type: mimeTypes[format] });
  }

  /**
   * 生成文件名
   */
  private generateFilename(format: ExportFormat): string {
    const title = this.report.title || '学术报告';
    const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    const extension: Record<ExportFormat, string> = {
      markdown: '.md',
      html: '.html',
      word: '.docx',
      pdf: '.pdf',
    };

    return `${sanitizedTitle}${extension[format]}`;
  }

  /**
   * 将文本内容转换为HTML
   */
  private convertToHtml(content: string): string {
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  /**
   * 下载文件
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
