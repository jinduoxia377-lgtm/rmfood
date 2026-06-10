/**
 * 学术报告生命周期类型定义
 */

// 工具类型

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams {
  query: string;
  filters?: Record<string, string | string[]>;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// 报告相关类型

export type ReportStatus = 'draft' | 'in_review' | 'approved' | 'published';

export interface ReportMetadata {
  authors: string[];
  institution?: string;
  date: string;
  keywords: string[];
  abstract?: string;
}

export interface ReportContent {
  chapters: Chapter[];
  abstract?: string;
  conclusion?: string;
  references: Reference[];
}

export interface Report {
  id: string;
  title: string;
  templateId: string;
  content: ReportContent;
  metadata: ReportMetadata;
  references: Reference[];
  versions: Version[];
  reviews: Review[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: ReportStatus;
}

// 模板相关类型

export type TemplateCategory =
  | 'journal_article'
  | 'thesis_bachelor'
  | 'thesis_master'
  | 'thesis_phd'
  | 'research_report'
  | 'patent'
  | 'conference_paper';

export interface TemplateVariable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  defaultValue?: unknown;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: unknown[];
  };
}

export interface TemplateStyles {
  fonts: {
    heading?: string;
    body?: string;
    code?: string;
    caption?: string;
    title?: string;
  };
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
    background?: string;
  };
  spacing: {
    lineHeight?: number;
    paragraphSpacing?: number;
    marginTop?: number;
    marginBottom?: number;
    headingSpacing?: number;
  };
  headings: {
    h1?: Record<string, unknown>;
    h2?: Record<string, unknown>;
    h3?: Record<string, unknown>;
    h4?: Record<string, unknown>;
  };
}

export interface TemplateSection {
  id: string;
  name: string;
  title?: string;
  type: 'cover' | 'abstract' | 'toc' | 'chapter' | 'reference' | 'appendix';
  required: boolean;
  order: number;
  content?: string;
  children?: TemplateSection[];
}

export interface TemplateLayout {
  id: string;
  name: string;
  type: 'single' | 'double' | 'mixed';
  sections: string[];
}

export interface PageSettings {
  size: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerHeight?: number;
  footerHeight?: number;
}

export interface TemplateStructure {
  sections: TemplateSection[];
  layouts: Record<string, string> | TemplateLayout[];
  pageSettings: PageSettings;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  structure: TemplateStructure;
  styles: TemplateStyles;
  variables: TemplateVariable[];
  version: string | number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// 参考文献相关类型

export type ReferenceType = 'article' | 'book' | 'chapter' | 'thesis' | 'website' | 'conference' | 'patent';

export interface Reference {
  id: string;
  type: ReferenceType;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  abstract?: string;
  citation?: string;
}

export interface Citation {
  id: string;
  referenceId: string;
  location: {
    chapterId?: string;
    page?: number;
    line?: number;
  };
  format: string;
  createdAt: string;
}

// 版本相关类型

export interface Version {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  parentId?: string;
  content: ReportContent;
}

export interface VersionSnapshot {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  parentId?: string;
  changes?: {
    added?: number;
    removed?: number;
    modified?: number;
  };
  content: ReportContent;
}

// 评审相关类型

export type ReviewStatus = 'pending' | 'in_progress' | 'needs_revision' | 'approved' | 'published';

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'approved';

export type CommentType = 'general' | 'section' | 'inline' | 'suggestion' | 'issue' | 'critical';

export interface ReviewCriteria {
  id: string;
  name: string;
  description?: string;
  weight: number;
  score?: number;
  passed?: boolean;
  required?: boolean;
}

export interface ReviewComment {
  id: string;
  stageId: string;
  reviewerId: string;
  type: CommentType;
  content: string;
  pageNumber?: number;
  lineNumber?: number;
  status: 'open' | 'resolved' | 'accepted' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
}

export interface ReviewStage {
  id: string;
  name: string;
  description?: string;
  reviewers: string[];
  deadline?: string;
  requiredApprovals: number;
  criteria: ReviewCriteria[];
  status: StageStatus;
  approvals?: number;
  comments?: ReviewComment[];
}

export interface Review {
  id: string;
  reportId: string;
  stages: ReviewStage[];
  currentStage: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  comments?: ReviewComment[];
}

// 学术元素类型

export interface Formula {
  id: string;
  latex: string;
  display: 'inline' | 'block';
  numbering?: string;
  label?: string;
}

export interface Figure {
  id: string;
  title?: string;
  caption?: string;
  src: string;
  numbering?: string;
  label?: string;
  position?: 'start' | 'center' | 'end';
}

export interface Table {
  id: string;
  title?: string;
  caption?: string;
  headers: string[];
  rows: string[][];
  numbering?: string;
  label?: string;
  position?: 'start' | 'center' | 'end';
}

export interface CodeBlock {
  id: string;
  language?: string;
  code: string;
  lineNumbers?: boolean;
}

// 导出相关类型

export type ExportFormat = 'pdf' | 'docx' | 'latex' | 'html' | 'markdown';

export interface ExportOptions {
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeToc?: boolean;
  includeBibliography?: boolean;
  watermark?: {
    text: string;
    opacity: number;
    position: 'diagonal' | 'header' | 'footer';
  };
}

export interface ExportProgress {
  status: 'idle' | 'pending' | 'preparing' | 'processing' | 'exporting' | 'finalizing' | 'completed' | 'failed';
  percentage: number;
  currentStep: number;
  totalSteps: number;
}

// 协作相关类型

export type OperationType = 'insert' | 'delete' | 'format' | 'structural';

export interface Operation {
  id: string;
  userId: string;
  type: OperationType;
  timestamp: string;
  content: unknown;
  sectionId?: string;
}

export interface Participant {
  userId: string;
  cursor?: {
    position: number;
    sectionId?: string;
  };
  selection?: {
    start: number;
    end: number;
    sectionId?: string;
  };
  isActive: boolean;
  joinedAt: string;
  lastActiveAt: string;
}

export interface CollaborationSession {
  id: string;
  documentId: string;
  participants: Participant[];
  operations: Operation[];
  createdAt: string;
}

// 章节类型（与 ReportContent 配合使用）

export interface Chapter {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
  type?: 'normal' | 'cover' | 'abstract' | 'toc' | 'appendix';
  children?: Chapter[];
  figures?: Figure[];
  tables?: Table[];
  formulas?: Formula[];
  codeBlocks?: CodeBlock[];
}
