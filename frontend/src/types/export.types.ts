export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  PDF = 'pdf'
}

export enum ExportScope {
  ALL_DATA = 'all_data',
  CURRENT_PAGE = 'current_page',
  SELECTED_ROWS = 'selected_rows',
  FILTERED_DATA = 'filtered_data'
}

export interface ExportColumn {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width?: number;
  format?: (value: unknown) => string;
}

interface ExcelStyleConfig {
  headerBgColor?: string;
  headerFontColor?: string;
  headerFontSize?: number;
  headerBold?: boolean;
  dataFontSize?: number;
  alternateRowColors?: boolean;
  autoFilter?: boolean;
  freezePane?: boolean;
}

interface PDFConfig {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'Letter';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  title?: string;
  subtitle?: string;
  logoUrl?: string;
}

interface CSVConfig {
  delimiter?: string;
  encoding?: string;
  includeBOM?: boolean;
  quoteFields?: boolean;
}

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  columns: ExportColumn[];
  fileName?: string;
  includeHeader?: boolean;
  includeIndex?: boolean;

  excelStyle?: ExcelStyleConfig;
  pdfConfig?: PDFConfig;
  csvConfig?: CSVConfig;
}

export interface ExportProgress {
  isExporting: boolean;
  currentStep: string;
  progress: number;
  totalSteps: number;
}

export interface ExportResult {
  success: boolean;
  fileName: string;
  format: ExportFormat;
  recordCount: number;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  timestamp: number;
}

export type ExportCallback = (progress: ExportProgress) => void;
export type ExportCompleteCallback = (result: ExportResult) => void;
