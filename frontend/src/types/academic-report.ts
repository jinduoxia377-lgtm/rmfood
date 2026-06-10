export type ReferenceType = 'article' | 'book' | 'conference' | 'thesis' | 'website' | 'patent';

export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'gb-t-7714-2015';

export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'latex' | 'markdown';

export interface Author {
  id: string;
  name: string;
  email?: string;
  affiliation?: string;
  orcid?: string;
}

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
  publisher?: string;
  citationKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  order: number;
  figures: Figure[];
  tables: Table[];
  formulas: Formula[];
  references: string[];
  children: Section[];
}

export interface Section {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  order: number;
}

export interface Figure {
  id: string;
  caption: string;
  number: string;
  src: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface Table {
  id: string;
  caption: string;
  number: string;
  headers: string[];
  rows: string[][];
}

export interface Formula {
  id: string;
  content: string;
  number: string;
  label?: string;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  caption?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  sections: TemplateSection[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateSection {
  id: string;
  title: string;
  content?: string;
  order: number;
  required?: boolean;
  children?: TemplateSection[];
}

export interface Review {
  id: string;
  reportId: string;
  reviewer: Author;
  status: ReviewStatus;
  comments: ReviewComment[];
  startedAt?: Date;
  completedAt?: Date;
  deadline?: Date;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  author: Author;
  content: string;
  position?: {
    chapterId?: string;
    paragraphIndex?: number;
    startOffset?: number;
    endOffset?: number;
  };
  parentId?: string;
  resolved?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Version {
  id: string;
  reportId: string;
  version: string;
  content: string;
  author: Author;
  createdAt: Date;
  message?: string;
}

export interface Participant {
  id: string;
  user: Author;
  role: 'owner' | 'editor' | 'reviewer' | 'viewer';
  joinedAt: Date;
  cursor?: CursorPosition;
}

export interface CursorPosition {
  userId: string;
  chapterId?: string;
  paragraphIndex?: number;
  offset?: number;
  color?: string;
}

export interface Operation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'update' | 'format';
  target: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'code';
    id: string;
  };
  before?: unknown;
  after?: unknown;
  timestamp: Date;
}

export interface ExportOptions {
  format: ExportFormat;
  includeAbstract?: boolean;
  includeReferences?: boolean;
  includeAppendices?: boolean;
  citationStyle?: CitationStyle;
  paperSize?: 'a4' | 'letter' | 'a4-landscape';
  fontSize?: number;
  fontFamily?: string;
  lineSpacing?: number;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface ExportProgress {
  status: 'idle' | 'pending' | 'preparing' | 'processing' | 'exporting' | 'finalizing' | 'completed' | 'failed';
  percentage: number;
  currentStep: number | string;
  totalSteps: number;
}

export interface AcademicReport {
  id: string;
  title: string;
  abstract?: string;
  authors: Author[];
  keywords: string[];
  chapters: Chapter[];
  references: Reference[];
  templateId?: string;
  version: string;
  status: 'draft' | 'in_review' | 'published';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}
