/**
 * 学术报告系统类型定义
 */

// 报告类型
export type ReportType = 'journal' | 'thesis' | 'research' | 'review' | 'technical';

// 页眉页脚配置
export interface HeaderConfig {
  showHeader?: boolean;
  headerText?: {
    left?: string;
    center?: string;
    right?: string;
  };
  showFooter?: boolean;
  footerText?: {
    left?: string;
    center?: string;
    right?: string;
  };
  showPageNumber?: boolean;
  pageNumberPosition?: 'left' | 'center' | 'right';
}

// 图表类型
export interface Figure {
  id: string;
  number?: string;
  caption: string;
  source?: string;
  data?: string;
}

// 表格类型
export interface Table {
  id: string;
  number?: string;
  caption: string;
  source?: string;
  headers?: string[];
  rows?: string[][];
}

// 封面页配置
export interface CoverPage {
  title?: string;
  subtitle?: string;
  showAuthors?: boolean;
  showInstitution?: boolean;
  showDate?: boolean;
  showLogo?: boolean;
  logoUrl?: string;
}

// 章节类型
export interface Chapter {
 id: string;
 title: string;
 content: string;
 level: number; // 1-4级标题
 order: number;
 type?: 'normal' | 'cover' | 'abstract' | 'toc' | 'appendix';
 children?: Chapter[];
 figures?: Figure[];
 tables?: Table[];
}

// 引文类型
export type CitationType = 'journal-article' | 'book' | 'book-chapter' | 'conference-proceeding' | 'thesis' | 'report' | 'web-page';

// 引文数据
export interface Citation {
 id: string;
 type: CitationType;
 authors: string[];
 title: string;
 journal?: string;
 year: number;
 volume?: string;
 pages?: string;
 doi?: string;
 isbn?: string;
 publisher?: string;
 url?: string;
 accessedDate?: string;
}

// 引用格式
export type CitationStyle = 'gbt7714' | 'apa' | 'mla' | 'chicago' | 'harvard' | 'ieee';

// 模板配置
export interface ReportTemplate {
 id: string;
 name: string;
 type: ReportType;
 description: string;
 chapters: Chapter[];
 createdAt: string;
 updatedAt: string;
}

// 报告文档
export interface ReportDocument {
 id: string;
 title: string;
 type: ReportType;
 templateId: string;
 chapters: Chapter[];
 citations: Citation[];
 citationStyle: CitationStyle;
 createdAt: string;
 updatedAt: string;
 authors?: string[];
 institution?: string;
 date?: string;
 abstractChinese?: string;
 abstractEnglish?: string;
 keywords?: string[];
 headerConfig?: HeaderConfig;
}

// 模板预设配置
export interface TemplatePreset {
 type: ReportType;
 name: string;
 description: string;
 defaultChapters: Chapter[];
}

// 格式化工具类型
export type FormatToolType = 'heading1' | 'heading2' | 'heading3' | 'heading4' |
 'bold' | 'italic' | 'underline' | 'strikethrough' |
 'bullet-list' | 'numbered-list' | 'quote' |
 'table' | 'equation' | 'reference';

// 报告类型配置
export const ReportTypeConfig: Record<ReportType, { label: string; description: string; icon: string }> = {
 journal: {
 label: '期刊论文',
 description: '适用于学术期刊投稿的论文格式',
 icon: 'FileText',
 },
 thesis: {
 label: '学位论文',
 description: '学士、硕士、博士学位论文格式',
 icon: 'GraduationCap',
 },
 research: {
 label: '研究报告',
 description: '科研项目研究成果报告',
 icon: 'ClipboardList',
 },
 review: {
 label: '综述论文',
 description: '文献综述和系统评价',
 icon: 'BookOpen',
 },
 technical: {
 label: '技术报告',
 description: '技术说明和工程报告',
 icon: 'Settings',
 },
};

// 引文类型配置
export const CitationTypeConfig: Record<CitationType, { label: string }> = {
 'journal-article': { label: '期刊文章' },
 'book': { label: '图书' },
 'book-chapter': { label: '图书章节' },
 'conference-proceeding': { label: '会议论文' },
 'thesis': { label: '学位论文' },
 'report': { label: '研究报告' },
 'web-page': { label: '网页' },
};

// 引用格式
export const CitationStyleConfig: Record<CitationStyle, { label: string; description: string }> = {
  gbt7714: { label: 'GB/T 7714', description: '中国国家标准' },
  apa: { label: 'APA 7th', description: '美国心理学会格式' },
  mla: { label: 'MLA 9th', description: '现代语言协会格式' },
  chicago: { label: 'Chicago 17th', description: '芝加哥格式' },
  harvard: { label: 'Harvard', description: '哈佛格式' },
  ieee: { label: 'IEEE', description: '电气电子工程师学会格式' },
};
