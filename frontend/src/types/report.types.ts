export enum ReportTemplateType {
  ACADEMIC = 'academic',
  BUSINESS = 'business',
  EXPERIMENT = 'experiment',
  PATENT = 'patent',
  REGULATORY = 'regulatory',
  CUSTOM = 'custom'
}

export enum ReportLanguage {
  ZH_CN = 'zh-CN',
  EN_US = 'en-US'
}

export enum DetailLevel {
  BRIEF = 'brief',
  STANDARD = 'standard',
  DETAILED = 'detailed',
  COMPREHENSIVE = 'comprehensive'
}

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  titleEn?: string;
  required: boolean;
  order: number;
  level: number;
  visible: boolean;
  detailLevel: DetailLevel;
  config: SectionConfig;
  children?: ReportSection[];
}

export enum SectionType {
  COVER = 'cover',
  TABLE_OF_CONTENTS = 'table_of_contents',
  EXECUTIVE_SUMMARY = 'executive_summary',
  INTRODUCTION = 'introduction',
  BACKGROUND = 'background',
  LITERATURE_REVIEW = 'literature_review',
  OBJECTIVES = 'objectives',
  METHODOLOGY = 'methodology',
  MATERIALS = 'materials',
  EXPERIMENTAL_PROCEDURE = 'experimental_procedure',
  DATA_COLLECTION = 'data_collection',
  RESULTS = 'results',
  ANALYSIS = 'analysis',
  DISCUSSION = 'discussion',
  CONCLUSION = 'conclusion',
  RECOMMENDATIONS = 'recommendations',
  REFERENCES = 'references',
  APPENDICES = 'appendices',
  TECHNICAL_FIELD = 'technical_field',
  BACKGROUND_TECHNOLOGY = 'background_technology',
  INVENTION_CONTENT = 'invention_content',
  EMBODIMENTS = 'embodiments',
  CLAIMS = 'claims',
  MARKET_ANALYSIS = 'market_analysis',
  PRODUCT_DESCRIPTION = 'product_description',
  COMPETITIVE_ADVANTAGE = 'competitive_advantage',
  FINANCIAL_PROJECTION = 'financial_projection',
  REGULATORY_COMPLIANCE = 'regulatory_compliance',
  CHARTS_AND_GRAPHS = 'charts_and_graphs',
  TABLES = 'tables',
  CUSTOM_CONTENT = 'custom_content'
}

export interface SectionConfig {
  maxWords?: number;
  includeImages?: boolean;
  includeTables?: boolean;
  includeCharts?: boolean;
  template?: string;
  placeholders?: Record<string, string>;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  nameEn: string;
  type: ReportTemplateType;
  description: string;
  descriptionEn?: string;
  icon: string;
  version: string;
  sections: ReportSection[];
  defaultLanguage: ReportLanguage;
  supportedLanguages: ReportLanguage[];
  defaultDetailLevel: DetailLevel;
  supportedDetailLevels: DetailLevel[];
  config: TemplateConfig;
  metadata: TemplateMetadata;
}

export interface TemplateConfig {
  pageSize: 'A4' | 'A3' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerEnabled: boolean;
  footerEnabled: boolean;
  pageNumbering: boolean;
  fontFamily: string;
  fontSize: {
    base: number;
    h1: number;
    h2: number;
    h3: number;
    body: number;
  };
  colors: ColorScheme;
  lineSpacing: number;
  paragraphSpacing: number;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  background: string;
  headerBg: string;
  tableHeaderBg: string;
  tableBorder: string;
  linkColor: string;
}

export interface TemplateMetadata {
  author: string;
  organization?: string;
  createdAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  usageCount: number;
  rating: number;
  isOfficial: boolean;
  isRecommended: boolean;
}

export interface ReportGenerationOptions {
  templateId: string;
  language: ReportLanguage;
  detailLevel: DetailLevel;
  customSections?: ReportSection[];
  data: ReportData;
  outputFormat: OutputFormat;
  fileName?: string;
  onProgress?: (progress: GenerationProgress) => void;
}

export enum OutputFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
  MARKDOWN = 'markdown'
}

export interface ReportData {
  title: string;
  subtitle?: string;
  authors: AuthorInfo[];
  date: string;
  abstract?: string;
  keywords?: string[];
  content: Record<string, any>;
  tables?: TableData[];
  charts?: ChartData[];
  images?: ImageData[];
  references?: ReferenceItem[];
  appendices?: AppendixItem[];
}

export interface AuthorInfo {
  name: string;
  email?: string;
  affiliation?: string;
  role?: string;
  orcid?: string;
}

export interface TableData {
  id: string;
  title: string;
  headers: string[];
  rows: any[][];
  caption?: string;
  source?: string;
  notes?: string;
}

export interface ChartData {
  id: string;
  type: ChartType;
  title: string;
  data: any;
  options?: ChartOptions;
  caption?: string;
}

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  SCATTER = 'scatter',
  HEATMAP = 'heatmap',
  SANKEY = 'sankey',
  FUNNEL = 'funnel',
  SUNBURST = 'sunburst',
  BOX_PLOT = 'box_plot',
  VIOLIN = 'violin',
  RADAR = 'radar',
  GANTT = 'gantt',
  TREEMAP = 'treemap',
  BUBBLE = 'bubble'
}

export interface ChartOptions {
  width?: number;
  height?: number;
  colors?: string[];
  legend?: boolean;
  animation?: boolean;
  responsive?: boolean;
  theme?: 'light' | 'dark' | 'custom';
  exportFormat?: 'png' | 'svg' | 'jpg';
  resolution?: number;
}

export interface ImageData {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  position?: 'inline' | 'full-width' | 'float-left' | 'float-right';
}

export interface ReferenceItem {
  id: string;
  type: 'journal' | 'book' | 'conference' | 'web' | 'patent' | 'standard';
  authors: string;
  title: string;
  journal?: string;
  year: number;
  volume?: number;
  issue?: number;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
}

export interface AppendixItem {
  id: string;
  title: string;
  type: 'table' | 'figure' | 'text' | 'code' | 'data';
  content: any;
  order: number;
}

export interface GenerationProgress {
  stage: GenerationStage;
  progress: number;
  total: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export enum GenerationStage {
  INITIALIZING = 'initializing',
  LOADING_TEMPLATE = 'loading_template',
  PROCESSING_DATA = 'processing_data',
  GENERATING_SECTIONS = 'generating_sections',
  RENDERING_CHARTS = 'rendering_charts',
  FORMATTING_TABLES = 'formatting_tables',
  COMPILING_DOCUMENT = 'compiling_document',
  EXPORTING = 'exporting',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  options: ReportGenerationOptions;
  status: 'generating' | 'completed' | 'failed' | 'cancelled';
  progress: GenerationProgress;
  outputUrl?: string;
  outputFile?: Blob;
  error?: string;
  generatedAt: string;
  pageCount?: number;
  fileSize?: number;
}
