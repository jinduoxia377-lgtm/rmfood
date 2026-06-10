/**
 * 学术报告格式化与导出服务
 */

import type {
  ReportModuleType,
  ModuleData,
  ReportMetadata,
  ReportConfiguration,
  MODULE_TITLE_MAP,
} from '@/types/academicReportModules';
import type { ReportModuleType as ReportModuleTypeEnum } from '@/types/academicReportModules';

// 导出格式类型
export type ExportFormat = 'markdown' | 'html' | 'word' | 'pdf';

// 格式化选项
export interface FormatOptions {
  includeTitlePage?: boolean;
  includeTOC?: boolean;
  includeHeaders?: boolean;
  includeFooters?: boolean;
  tableStyle?: 'grid' | 'bordered' | 'minimal';
  figureNumbering?: boolean;
  referenceFormat?: 'numbered' | 'author-date';
}

// 默认格式化选项
const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  includeTitlePage: true,
  includeTOC: true,
  includeHeaders: true,
  includeFooters: true,
  tableStyle: 'grid',
  figureNumbering: true,
  referenceFormat: 'numbered',
};

// 样式主题配置
const STYLE_THEMES = {
  journal: {
    primaryColor: '#1e40af',
    secondaryColor: '#475569',
    accentColor: '#0ea5e9',
    fontFamily: 'SimSun',
    fontSize: 12,
    lineSpacing: 1.6,
  },
  thesis: {
    primaryColor: '#7c3aed',
    secondaryColor: '#4338ca',
    accentColor: '#8b5cf6',
    fontFamily: 'SimSun',
    fontSize: 12,
    lineSpacing: 1.6,
  },
  research_report: {
    primaryColor: '#15803d',
    secondaryColor: '#451a03',
    accentColor: '#78350f',
    fontFamily: 'SimSun',
    fontSize: 12,
    lineSpacing: 1.6,
  },
};

/**
 * 学术报告格式化器类
 */
export class AcademicReportFormatter {
  private metadata: ReportMetadata;
  private modules: Map<ReportModuleType, ModuleData>;
  private config: ReportConfiguration;
  private formatOptions: FormatOptions;
  private tableCounter: number;
  private figureCounter: number;

  constructor(
    metadata: ReportMetadata,
    modules: Map<ReportModuleType, ModuleData>,
    config: ReportConfiguration,
    formatOptions?: Partial<FormatOptions>,
  ) {
    this.metadata = metadata;
    this.modules = modules;
    this.config = config;
    this.formatOptions = { ...DEFAULT_FORMAT_OPTIONS, ...formatOptions };
    this.tableCounter = 0;
    this.figureCounter = 0;
  }

  /**
   * 获取启用的模块列表（按优先级排序）
   */
  private getEnabledModules(): ReportModuleType[] {
    return Array.from(this.modules.keys())
      .filter(type => {
        const moduleConfig = this.config.modules[type];
        return moduleConfig?.enabled !== false;
      })
      .sort((a, b) => {
        const configA = this.config.modules[a];
        const configB = this.config.modules[b];
        const priorityA = configA?.priority ?? 999;
        const priorityB = configB?.priority ?? 999;
        return priorityA - priorityB;
      });
  }

  /**
   * 格式化为Markdown
   */
  formatToMarkdown(): string {
    let content = '';

    // 标题页
    if (this.formatOptions.includeTitlePage) {
      content += this.generateTitlePageMarkdown();
      content += '\n\n';
    }

    // 目录
    if (this.formatOptions.includeTOC) {
      content += this.generateTableOfContentsMarkdown();
      content += '\n\n';
    }

    // 各模块内容
    const enabledModules = this.getEnabledModules();
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        content += this.formatModuleMarkdown(moduleType, moduleData);
        content += '\n\n';
      }
    }

    return content;
  }

  /**
   * 生成Markdown标题页
   */
  private generateTitlePageMarkdown(): string {
    let pageContent = `# ${this.metadata.title}\n\n`;

    if (this.metadata.authors.length > 0) {
      pageContent += `**作者**：${this.metadata.authors.join('、')}\n\n`;
    }

    if (this.metadata.institution) {
      pageContent += `**单位**：${this.metadata.institution}\n\n`;
    }

    if (this.metadata.date) {
      pageContent += `**日期**：${this.metadata.date}\n\n`;
    }

    pageContent += `---\n\n`;

    if (this.metadata.abstract) {
      pageContent += `## 摘要\n\n${this.metadata.abstract}\n\n`;
    }

    if (this.metadata.keywords.length > 0) {
      pageContent += `**关键词**：${this.metadata.keywords.join('、')}\n\n`;
    }

    return pageContent;
  }

  /**
   * 生成Markdown目录
   */
  private generateTableOfContentsMarkdown(): string {
    let toc = '## 目录\n\n';
    const enabledModules = this.getEnabledModules();

    enabledModules.forEach((moduleType, index) => {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        const title = moduleData.title;
        toc += `${index + 1}. [${title}](#${this.titleToAnchor(title)})\n`;
      }
    });

    return toc;
  }

  /**
   * 格式化单个模块为Markdown
   */
  private formatModuleMarkdown(moduleType: ReportModuleType, moduleData: ModuleData): string {
    let content = '';

    // 模块标题
    content += `## ${moduleData.title}\n\n`;

    // 模块内容
    content += moduleData.content + '\n\n';

    // 表格
    if (moduleData.tables && moduleData.tables.length > 0) {
      moduleData.tables.forEach(table => {
        content += `### ${table.title}\n\n`;
        content += this.formatTableMarkdown(table.headers, table.rows);
        content += '\n';
      });
    }

    // 图表
    if (moduleData.figures && moduleData.figures.length > 0) {
      moduleData.figures.forEach(figure => {
        content += `### ${figure.title}\n\n`;
        content += figure.description + '\n\n';
      });
    }

    return content;
  }

  /**
   * 格式化表格为Markdown
   */
  private formatTableMarkdown(headers: string[], rows: string[][]): string {
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(row => {
      table += '| ' + row.join(' | ') + ' |\n';
    });
    return table;
  }

  /**
   * 格式化为HTML
   */
  formatToHtml(format: 'html' | 'word' | 'pdf' = 'html'): string {
    const theme = STYLE_THEMES[this.metadata.reportType] || STYLE_THEMES.research_report;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.metadata.title}</title>
  <style>
    ${this.generateCssStyles(theme)}
  </style>
</head>
<body>
  <div class="academic-report">
    ${this.generateTitlePageHtml()}
    ${this.generateTableOfContentsHtml()}
    ${this.generateModulesHtml()}
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * 生成CSS样式
   */
  private generateCssStyles(theme: any): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: ${theme.fontFamily}, 'Times New Roman', serif;
        font-size: ${theme.fontSize}pt;
        line-height: ${theme.lineSpacing};
        color: #1f2937;
        background-color: #ffffff;
      }

      .academic-report {
        max-width: 210mm;
        margin: 0 auto;
        padding: ${this.config.formatOptions.pageMargins.top}cm
                 ${this.config.formatOptions.pageMargins.right}cm
                 ${this.config.formatOptions.pageMargins.bottom}cm
                 ${this.config.formatOptions.pageMargins.left}cm;
      }

      .title-page {
        text-align: center;
        padding: 3em 0;
      }

      .report-title {
        font-size: 24pt;
        font-weight: bold;
        color: ${theme.primaryColor};
        margin-bottom: 1.5em;
        line-height: 1.4;
      }

      .metadata-item {
        margin: 0.5em 0;
        font-size: 12pt;
      }

      .abstract-section {
        margin: 2em 0;
        padding: 1.5em 2em;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }

      .abstract-title {
        font-size: 14pt;
        font-weight: bold;
        text-align: center;
        color: ${theme.primaryColor};
        margin-bottom: 1em;
        padding-bottom: 0.5em;
        border-bottom: 1px dashed #e5e7eb;
      }

      .abstract-content {
        text-indent: 2em;
        text-align: justify;
      }

      .keywords {
        text-align: right;
        color: #475569;
        margin-top: 1em;
      }

      .toc-section {
        margin: 2em 0;
      }

      .toc-title {
        font-size: 16pt;
        font-weight: bold;
        text-align: center;
        color: ${theme.primaryColor};
        margin-bottom: 1em;
      }

      .toc-list {
        list-style: none;
      }

      .toc-item {
        padding: 0.5em 0;
        border-bottom: 1px dotted #d1d5db;
      }

      .toc-item a {
        color: inherit;
        text-decoration: none;
      }

      .module-section {
        margin: 2em 0;
        page-break-inside: avoid;
      }

      .module-title {
        font-size: 18pt;
        font-weight: bold;
        text-align: center;
        color: ${theme.primaryColor};
        margin: 1.5em 0 1em 0;
        padding-bottom: 0.5em;
        border-bottom: 2px solid ${theme.primaryColor};
      }

      .module-content {
        line-height: 1.8;
      }

      .module-content h3 {
        font-size: 14pt;
        font-weight: bold;
        color: ${theme.secondaryColor};
        margin: 1.5em 0 0.8em 0;
        padding-left: 0.5em;
        border-left: 4px solid ${theme.accentColor};
      }

      .module-content h4 {
        font-size: 13pt;
        font-weight: bold;
        color: ${theme.secondaryColor};
        margin: 1.2em 0 0.6em 0;
        font-style: italic;
      }

      .module-content p {
        text-indent: 2em;
        text-align: justify;
        margin-bottom: 1em;
      }

      .table-wrapper {
        margin: 1.5em 0;
        overflow-x: auto;
      }

      .table-title {
        font-size: 11pt;
        font-weight: bold;
        text-align: center;
        color: ${theme.secondaryColor};
        margin-bottom: 0.5em;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        border-radius: 8px;
        overflow: hidden;
      }

      .data-table th {
        background: linear-gradient(180deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%);
        color: white;
        font-weight: bold;
        padding: 0.75em 1em;
        text-align: center;
        vertical-align: middle;
      }

      .data-table td {
        padding: 0.6em 1em;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: middle;
      }

      .data-table tr:nth-child(even) {
        background-color: #f3f4f6;
      }

      .data-table tr:hover {
        background-color: #f9fafb;
      }

      .figure-wrapper {
        margin: 2em 0;
        text-align: center;
      }

      .figure-title {
        font-size: 11pt;
        font-weight: bold;
        color: ${theme.secondaryColor};
        margin-top: 0.5em;
      }

      .figure-description {
        font-size: 10pt;
        color: #475569;
        margin-top: 0.5em;
      }

      .references-section {
        margin-top: 3em;
        padding-top: 1.5em;
        border-top: 2px solid #e5e7eb;
      }

      .reference-item {
        font-size: 10pt;
        line-height: 1.8;
        text-indent: -2em;
        padding-left: 2em;
        margin-bottom: 0.8em;
        text-align: justify;
        color: #374151;
      }

      @media print {
        body {
          background-color: white !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .academic-report {
          max-width: none;
          padding: ${this.config.formatOptions.pageMargins.top}cm
                   ${this.config.formatOptions.pageMargins.right}cm
                   ${this.config.formatOptions.pageMargins.bottom}cm
                   ${this.config.formatOptions.pageMargins.left}cm;
        }

        .module-title,
        .module-content h3,
        .module-content h4 {
          page-break-after: avoid;
        }

        .data-table {
          page-break-inside: avoid;
        }

        @page {
          size: A4;
          margin: ${this.config.formatOptions.pageMargins.top}cm
                   ${this.config.formatOptions.pageMargins.right}cm
                   ${this.config.formatOptions.pageMargins.bottom}cm
                   ${this.config.formatOptions.pageMargins.left}cm;
        }
      }

      @media screen and (max-width: 768px) {
        .academic-report {
          padding: 1.5cm;
          font-size: 11pt;
        }

        .report-title {
          font-size: 20pt !important;
        }

        .module-title {
          font-size: 16pt !important;
        }
      }
    `;
  }

  /**
   * 生成HTML标题页
   */
  private generateTitlePageHtml(): string {
    if (!this.formatOptions.includeTitlePage) {
      return '';
    }

    let html = `<div class="title-page">`;

    html += `<h1 class="report-title">${this.metadata.title}</h1>`;

    if (this.metadata.authors.length > 0) {
      html += `<p class="metadata-item"><strong>作者：</strong>${this.metadata.authors.join('、')}</p>`;
    }

    if (this.metadata.institution) {
      html += `<p class="metadata-item"><strong>单位：</strong>${this.metadata.institution}</p>`;
    }

    if (this.metadata.date) {
      html += `<p class="metadata-item"><strong>日期：</strong>${this.metadata.date}</p>`;
    }

    html += `</div>`;

    if (this.metadata.abstract) {
      html += `
        <div class="abstract-section">
          <h2 class="abstract-title">摘要</h2>
          <p class="abstract-content">${this.metadata.abstract}</p>
          <p class="keywords"><strong>关键词：</strong>${this.metadata.keywords.join('、')}</p>
        </div>
      `;
    }

    return html;
  }

  /**
   * 生成HTML目录
   */
  private generateTableOfContentsHtml(): string {
    if (!this.formatOptions.includeTOC) {
      return '';
    }

    let html = `<div class="toc-section">`;
    html += `<h2 class="toc-title">目录</h2>`;
    html += `<ul class="toc-list">`;

    const enabledModules = this.getEnabledModules();
    enabledModules.forEach((moduleType, index) => {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        const anchorId = this.titleToAnchor(moduleData.title);
        html += `<li class="toc-item"><a href="#${anchorId}">${index + 1}. ${moduleData.title}</a></li>`;
      }
    });

    html += `</ul></div>`;
    return html;
  }

  /**
   * 生成模块HTML
   */
  private generateModulesHtml(): string {
    let html = '';

    const enabledModules = this.getEnabledModules();
    for (const moduleType of enabledModules) {
      const moduleData = this.modules.get(moduleType);
      if (moduleData) {
        html += this.formatModuleHtml(moduleType, moduleData);
      }
    }

    return html;
  }

  /**
   * 格式化单个模块为HTML
   */
  private formatModuleHtml(moduleType: ReportModuleType, moduleData: ModuleData): string {
    const anchorId = this.titleToAnchor(moduleData.title);
    let html = `<div class="module-section" id="${anchorId}">`;

    // 模块标题
    html += `<h2 class="module-title">${moduleData.title}</h2>`;

    // 模块内容
    html += `<div class="module-content">${this.formatContentHtml(moduleData.content)}</div>`;

    // 表格
    if (moduleData.tables && moduleData.tables.length > 0) {
      moduleData.tables.forEach(table => {
        html += `<div class="table-wrapper">`;
        html += `<p class="table-title">${table.title}</p>`;
        html += this.formatTableHtml(table.headers, table.rows);
        html += `</div>`;
      });
    }

    // 图表
    if (moduleData.figures && moduleData.figures.length > 0) {
      moduleData.figures.forEach(figure => {
        html += `<div class="figure-wrapper">`;
        html += `<p class="figure-title">${figure.title}</p>`;
        html += `<p class="figure-description">${figure.description}</p>`;
        html += `</div>`;
      });
    }

    html += `</div>`;
    return html;
  }

  /**
   * 格式化内容HTML
   */
  private formatContentHtml(content: string): string {
    // 简单的Markdown到HTML转换
    let html = content
      .replace(/###\s+(.*)/g, '<h4>$1</h4>')
      .replace(/##\s+(.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>');

    if (html && !html.startsWith('<p>')) {
      html = '<p>' + html;
    }
    if (html && !html.endsWith('</p>')) {
      html = html + '</p>';
    }

    return html;
  }

  /**
   * 格式化表格为HTML
   */
  private formatTableHtml(headers: string[], rows: string[][]): string {
    let html = `<table class="data-table">`;

    // 表头
    html += `<thead><tr>`;
    headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += `</tr></thead>`;

    // 表格内容
    html += `<tbody>`;
    rows.forEach(row => {
      html += `<tr>`;
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;

    html += `</table>`;
    return html;
  }

  /**
   * 格式化为Word（HTML格式）
   */
  formatToWord(): string {
    return this.formatToHtml('word');
  }

  /**
   * 格式化为PDF（通过浏览器打印）
   */
  formatToPdf(): string {
    return this.formatToHtml('pdf');
  }

  /**
   * 标题转锚点ID
   */
  private titleToAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * 重置计数器
   */
  resetCounters(): void {
    this.tableCounter = 0;
    this.figureCounter = 0;
  }
}

export default AcademicReportFormatter;
