/**
 * 学术报告多格式导出服务
 * 支持Markdown、HTML、Word、PDF四种格式导出
 */

import type { AcademicReport } from './academicReportService';
import type { Reference } from '@/types/academic-report';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CitationStyle } from './citationFormatter';
import { CitationFormatterFactory } from './citationFormatter';
import { FigureNumberingManager } from './figureNumbering';

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

const CHINESE_FONT_NAME = 'SimSun';

interface ChinesePdfConfig {
  titleFontSize: number;
  headingFontSize: number;
  bodyFontSize: number;
  smallFontSize: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  primaryColor: [number, number, number];
  textColor: [number, number, number];
  secondaryColor: [number, number, number];
}

const DEFAULT_CHINESE_PDF_CONFIG: ChinesePdfConfig = {
  titleFontSize: 20,
  headingFontSize: 14,
  bodyFontSize: 10,
  smallFontSize: 8,
  margins: {
    top: 25,
    right: 20,
    bottom: 25,
    left: 25,
  },
  primaryColor: [30, 64, 175],
  textColor: [40, 40, 40],
  secondaryColor: [100, 100, 100],
};

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

/**
 * Word模板样式（用于RTF转换）
 */
const WORD_STYLES = `
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  body { font-family: "SimSun", serif; font-size: 12pt; line-height: 1.5; }
  h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 12pt; }
  h2 { font-size: 14pt; font-weight: bold; margin-top: 24pt; margin-bottom: 12pt; }
  h3 { font-size: 12pt; font-weight: bold; margin-top: 18pt; margin-bottom: 10pt; }
  p { margin-bottom: 12pt; text-indent: 24pt; }
  table { border-collapse: collapse; margin: 12pt 0; }
  th, td { border: 1pt solid #000; padding: 6pt 12pt; }
  th { background-color: #f0f0f0; }
</style>
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
   * 生成导出内容
   */
  private async generateContent(options: ExportOptions): Promise<string> {
    switch (options.format) {
      case 'markdown':
        return this.generateMarkdown(options);
      case 'html':
        return this.generateHtml(options);
      case 'word':
        return this.generateWord(options);
      case 'pdf':
        return '';
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
   * 生成Word格式（HTML格式，Word可直接打开）
   */
  private generateWord(options: ExportOptions): string {
    const sections: string[] = [];

    sections.push(WORD_STYLES);

    if (this.report.title) {
      sections.push(`<h1>${this.report.title}</h1>`);
    }

    if (this.report.authors && this.report.authors.length > 0) {
      sections.push(`<p style="text-align:center;">作者：${this.report.authors.join('、')}</p>`);
    }

    if (this.report.keywords) {
      sections.push(`<p style="text-align:center;">关键词：${this.report.keywords.join('、')}</p>`);
    }

    if (this.report.abstract) {
      sections.push(`<p style="text-indent:24pt;"><strong>摘要：</strong>${this.report.abstract}</p>`);
    }

    if (this.report.chapters) {
      this.report.chapters.forEach((section, index) => {
        sections.push(`<h2>${index + 1}. ${section.title}</h2>`);
        sections.push(this.convertToHtml(section.content));
      });
    }

    if (options.includeReferences && this.report.references && this.report.references.length > 0) {
      sections.push('<h2>参考文献</h2>');
      sections.push('<div style="margin-left:24pt;">');
      const formattedReferences = this.citationFormatter.formatMultiple(
        this.report.references as unknown as Reference[],
        options.citationStyle,
      );
      formattedReferences.forEach((ref, i) => {
        sections.push(`<p style="text-indent:-24pt; margin-left:48pt;">${i + 1}. ${ref}</p>`);
      });
      sections.push('</div>');
    }

    return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head>
<meta charset="UTF-8">
<title>${this.report.title || '学术报告'}</title>
${WORD_STYLES}
</head>
<body>
${sections.join('\n')}
</body>
</html>`;
  }

  /**
   * 导出为PDF（中文优化版本）
   */
  async exportToPdf(options: ExportOptions): Promise<ExportResult> {
    try {
      const config = DEFAULT_CHINESE_PDF_CONFIG;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.setFont(CHINESE_FONT_NAME, 'normal');

      let currentY = config.margins.top;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxContentWidth = pageWidth - config.margins.left - config.margins.right;

      const addHeader = () => {
        doc.setFontSize(config.smallFontSize);
        doc.setTextColor(150, 150, 150);
        doc.text(
          this.report.formulaName || '配方学术报告',
          pageWidth / 2,
          15,
          { align: 'center' },
        );
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(config.margins.left, 18, pageWidth - config.margins.right, 18);
        currentY = 22;
      };

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(config.margins.left, pageHeight - config.margins.bottom + 8, pageWidth - config.margins.right, pageHeight - config.margins.bottom + 8);

        doc.setFontSize(config.smallFontSize);
        doc.setTextColor(150, 150, 150);
        doc.text(
          '© 莱茵分子生物科技有限公司',
          config.margins.left,
          pageHeight - config.margins.bottom + 13,
        );
        doc.text(
          `第 ${pageNum} 页 / 共 ${totalPages} 页`,
          pageWidth - config.margins.right,
          pageHeight - config.margins.bottom + 13,
          { align: 'right' },
        );
      };

      const checkPageBreak = (requiredSpace: number) => {
        if (currentY + requiredSpace > pageHeight - config.margins.bottom) {
          return true;
        }
        return false;
      };

      addHeader();

      if (this.report.title) {
        doc.setFontSize(config.titleFontSize);
        doc.setTextColor(...config.primaryColor);
        doc.setFont(CHINESE_FONT_NAME, 'bold');
        const titleLines = doc.splitTextToSize(this.report.title, maxContentWidth);
        doc.text(titleLines, pageWidth / 2, currentY + 10, { align: 'center' });
        currentY += 10 + titleLines.length * 8;

        doc.setDrawColor(...config.primaryColor);
        doc.setLineWidth(0.5);
        doc.line(config.margins.left, currentY, pageWidth - config.margins.right, currentY);
        currentY += 10;
        doc.setFont(CHINESE_FONT_NAME, 'normal');
      }

      doc.setFontSize(config.bodyFontSize);
      doc.setTextColor(...config.secondaryColor);
      doc.text(`配方名称：${this.report.formulaName}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`配方类型：${this.report.formulaType}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`目标人群：${this.report.targetPopulation}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`功效声称：${this.report.efficacyClaims.join('、')}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`作者：${this.report.authors?.join('、') || '配方研发项目组'}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`单位：${this.report.institution || '莱茵分子生物科技有限公司'}`, config.margins.left, currentY);
      currentY += 7;
      doc.text(`日期：${this.report.date || new Date().toLocaleDateString('zh-CN')}`, config.margins.left, currentY);
      currentY += 15;

      doc.setFontSize(config.headingFontSize);
      doc.setTextColor(...config.primaryColor);
      doc.setFont(CHINESE_FONT_NAME, 'bold');
      doc.text('摘要', config.margins.left, currentY);
      currentY += 8;

      doc.setFont(CHINESE_FONT_NAME, 'normal');
      doc.setFontSize(config.bodyFontSize);
      doc.setTextColor(...config.textColor);
      if (checkPageBreak(40)) {
        addFooter(1, 1);
        doc.addPage();
        addHeader();
      }
      const abstractLines = doc.splitTextToSize(this.report.abstract, maxContentWidth);
      doc.text(abstractLines, config.margins.left, currentY);
      currentY += abstractLines.length * 6 + 5;

      doc.setFontSize(config.bodyFontSize);
      doc.setTextColor(...config.secondaryColor);
      doc.text(`关键词：${this.report.keywords?.join('、') || '药食同源, 配方研发'}`, config.margins.left, currentY);
      currentY += 15;

      let pageCount = 1;
      if (this.report.chapters) {
        this.report.chapters.forEach((section, index) => {
          if (checkPageBreak(25)) {
            addFooter(pageCount, pageCount);
            doc.addPage();
            pageCount++;
            addHeader();
          }

          doc.setFontSize(config.headingFontSize);
          doc.setTextColor(...config.primaryColor);
          doc.setFont(CHINESE_FONT_NAME, 'bold');
          doc.text(`${index + 1}. ${section.title}`, config.margins.left, currentY);
          currentY += 8;

          doc.setDrawColor(...config.primaryColor);
          doc.setLineWidth(0.3);
          doc.line(config.margins.left, currentY, pageWidth - config.margins.right, currentY);
          currentY += 8;

          doc.setFont(CHINESE_FONT_NAME, 'normal');
          doc.setFontSize(config.bodyFontSize);
          doc.setTextColor(...config.textColor);

          const paragraphs = section.content.split('\n');
          paragraphs.forEach(para => {
            const trimmed = para.trim();
            if (!trimmed) return;

            if (trimmed.startsWith('### ')) {
              if (checkPageBreak(15)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }
              doc.setFontSize(config.bodyFontSize + 1);
              doc.setTextColor(...config.textColor);
              doc.setFont(CHINESE_FONT_NAME, 'bold');
              doc.text(trimmed.replace('### ', ''), config.margins.left + 5, currentY);
              currentY += 7;
              doc.setFont(CHINESE_FONT_NAME, 'normal');
            } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              if (checkPageBreak(10)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }
              doc.setFont(CHINESE_FONT_NAME, 'bold');
              const boldText = trimmed.replace(/\*\*/g, '');
              const boldLines = doc.splitTextToSize(boldText, maxContentWidth);
              doc.text(boldLines, config.margins.left, currentY);
              currentY += boldLines.length * 6;
              doc.setFont(CHINESE_FONT_NAME, 'normal');
            } else if (trimmed.startsWith('- ')) {
              if (checkPageBreak(10)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }
              doc.setTextColor(...config.textColor);
              doc.text('•', config.margins.left + 5, currentY);
              const bulletLines = doc.splitTextToSize(trimmed.substring(2), maxContentWidth - 10);
              doc.text(bulletLines, config.margins.left + 10, currentY);
              currentY += bulletLines.length * 6;
            } else if (/^\d+\./.exec(trimmed)) {
              if (checkPageBreak(10)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }
              doc.text(trimmed, config.margins.left, currentY);
              currentY += 6;
            } else {
              if (checkPageBreak(10)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }
              const contentLines = doc.splitTextToSize(trimmed, maxContentWidth);
              doc.text(contentLines, config.margins.left + 10, currentY);
              currentY += contentLines.length * 6;
            }
          });

          if (section.tables && section.tables.length > 0) {
            section.tables.forEach(table => {
              if (checkPageBreak(20)) {
                addFooter(pageCount, pageCount);
                doc.addPage();
                pageCount++;
                addHeader();
              }

              doc.setFontSize(config.bodyFontSize);
              doc.setTextColor(...config.secondaryColor);
              doc.setFont(CHINESE_FONT_NAME, 'bold');
              doc.text(table.title, config.margins.left, currentY);
              currentY += 5;

              autoTable(doc, {
                head: [table.headers],
                body: table.rows,
                startY: currentY,
                margin: {
                  left: config.margins.left,
                  right: config.margins.right,
                },
                styles: {
                  font: CHINESE_FONT_NAME,
                  fontSize: config.smallFontSize,
                  cellPadding: 2,
                  lineColor: [180, 180, 180],
                  lineWidth: 0.1,
                },
                headStyles: {
                  fillColor: config.primaryColor,
                  textColor: [255, 255, 255],
                  fontStyle: 'bold',
                  halign: 'center',
                },
                bodyStyles: {
                  textColor: config.textColor,
                  halign: 'left',
                },
                alternateRowStyles: {
                  fillColor: [248, 248, 248],
                },
              });

              currentY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
            });
          }

          currentY += 10;
        });
      }

      if (options.includeReferences && this.report.references && this.report.references.length > 0) {
        if (checkPageBreak(25)) {
          addFooter(pageCount, pageCount);
          doc.addPage();
          pageCount++;
          addHeader();
        }

        doc.setFontSize(config.headingFontSize);
        doc.setTextColor(...config.primaryColor);
        doc.setFont(CHINESE_FONT_NAME, 'bold');
        doc.text('参考文献', config.margins.left, currentY);
        currentY += 8;

        doc.setFont(CHINESE_FONT_NAME, 'normal');
        doc.setFontSize(config.smallFontSize);
        doc.setTextColor(...config.secondaryColor);

        const formattedReferences = this.citationFormatter.formatMultiple(
          this.report.references as unknown as Reference[],
          options.citationStyle,
        );

        formattedReferences.forEach((ref, i) => {
          if (checkPageBreak(12)) {
            addFooter(pageCount, pageCount);
            doc.addPage();
            pageCount++;
            addHeader();
          }
          const refText = `[${i + 1}] ${ref}`;
          const refLines = doc.splitTextToSize(refText, maxContentWidth);
          doc.text(refLines, config.margins.left + 5, currentY);
          currentY += refLines.length * 5;
        });
      }

      addFooter(pageCount, pageCount);

      const blob = doc.output('blob');
      const filename = this.generateFilename('pdf');

      return {
        success: true,
        filename,
        data: blob,
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
   * 创建Blob文件
   */
  private async createBlob(content: string, format: ExportFormat): Promise<Blob> {
    const mimeTypes: Record<ExportFormat, string> = {
      markdown: 'text/markdown;charset=utf-8',
      html: 'text/html;charset=utf-8',
      word: 'application/msword',
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
      word: '.doc',
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
