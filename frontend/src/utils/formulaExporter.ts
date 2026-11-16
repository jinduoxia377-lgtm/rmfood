import { logger } from '@/utils/safeLogger';
import type { AIRecognizedFormula } from '@/types/ai.types';
import type { Formula } from '@/types/index';
import type { FormulaExportRequest } from '@/types/formula';
import {
  addBOM,
  csvEscape,
  exportHistory,
  formatFilename,
  downloadBlob,
  type ExportProgress,
  type ProgressCallback,
} from './encodingUtils';
import { ERROR_CODES } from '@/constants/errorCodes';
import { getErrorMessage } from '@/constants';
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter';

let _exceljsModule: typeof import('exceljs') | null = null;

async function getExcelJS(): Promise<typeof import('exceljs')> {
  if (!_exceljsModule) {
    _exceljsModule = await import('exceljs');
  }
  return _exceljsModule;
}

export type FormulaExportFormat = 'json' | 'csv' | 'txt' | 'html' | 'excel' | 'pdf';

export interface FormulaExportOptions {
  format: FormulaExportFormat;
  includeMetadata?: boolean;
  includeIngredients?: boolean;
  filename?: string;
  title?: string;
  onProgress?: (progress: number, message: string) => void;
}

export interface EnhancedExportOptions extends Omit<FormulaExportRequest, 'format' | 'scope'> {
  format: 'excel' | 'csv' | 'pdf';
  scope: 'current_page' | 'filtered' | 'all' | 'selected';
  ids?: string[];
  filename?: string;
  onProgress?: ProgressCallback;
}

const STATUS_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  active: { bg: 'D4EDDA', text: '155724' },
  approved: { bg: 'D4EDDA', text: '155724' },
  draft: { bg: 'F1F5F9', text: '6B7280' },
  pending: { bg: 'FFF3CD', text: '856404' },
  rejected: { bg: 'F8D7DA', text: '721C24' },
  archived: { bg: 'E2E3E5', text: '383D41' },
};

const STATUS_LABEL_MAP: Record<string, string> = {
  active: '已通过',
  approved: '已通过',
  draft: '草稿',
  pending: '待审核',
  rejected: '拒绝',
  archived: '已归档',
};

export async function exportFormulas(
  formulas: AIRecognizedFormula[] | Map<string, AIRecognizedFormula>,
  options: FormulaExportOptions,
): Promise<boolean> {
  const startTime = Date.now();
  let taskId = '';

  try {
    const formulaArray = Array.isArray(formulas) ? formulas : Array.from(formulas.values());

    if (formulaArray.length === 0) {
      logger.warn('[FormulaExporter] ' + getErrorMessage(ERROR_CODES.BUSINESS_FORMULA_NOT_FOUND));
      return false;
    }

    options.onProgress?.(10, getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED) + '...');

    const {
      format = 'json',
      includeMetadata = true,
      includeIngredients = true,
      filename,
      title = 'RMFOOD 配方列表',
    } = options;

    taskId = exportHistory.addEntry({
      filename: filename || `rmfood-formulas-${getDateStamp()}.${format}`,
      format,
      fileSize: 0,
      rowCount: formulaArray.length,
      duration: 0,
      status: 'failed',
      timestamp: new Date(),
    });

    options.onProgress?.(20, getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED) + '...');

    if (format === 'excel') {
      await exportAsExcelLegacy(formulaArray, includeMetadata, includeIngredients, filename, options.onProgress);
    } else if (format === 'pdf') {
      await exportAsPDFLegacy(formulaArray, includeMetadata, includeIngredients, filename, title, options.onProgress);
    } else {
      let content: string;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'json':
          content = exportAsJSON(formulaArray, includeMetadata, includeIngredients);
          mimeType = 'application/json';
          fileExtension = 'json';
          break;

        case 'csv':
          content = exportAsCSV(formulaArray, includeMetadata, includeIngredients);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;

        case 'txt':
          content = exportAsTXT(formulaArray, includeMetadata, includeIngredients, title);
          mimeType = 'text/plain';
          fileExtension = 'txt';
          break;

        case 'html':
          content = exportAsHTML(formulaArray, includeMetadata, includeIngredients, title);
          mimeType = 'text/html';
          fileExtension = 'html';
          break;

        default:
          logger.error(`[FormulaExporter] ` + getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED) + `: ${format}`);
          exportHistory.updateEntry(taskId, {
            status: 'failed',
            error: getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED),
          });
          return false;
      }

      options.onProgress?.(80, getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED) + '...');

      downloadFile(content, filename || `rmfood-formulas-${getDateStamp()}`, mimeType, fileExtension);
    }

    options.onProgress?.(100, getErrorMessage(ERROR_CODES.BUSINESS_EXPORT_FAILED) + ' - Success');

    const duration = Date.now() - startTime;
    exportHistory.updateEntry(taskId, {
      status: 'success',
      duration,
      fileSize: 0,
    });

    logger.log(`[FormulaExporter] 成功导出 ${formulaArray.length} 个配方为 ${format.toUpperCase()} 格式`);
    return true;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '未知错误';
    logger.error('[FormulaExporter] 导出失败:', e);

    if (taskId) {
      exportHistory.updateEntry(taskId, {
        status: 'failed',
        error: errorMessage,
      });
    }

    return false;
  }
}

// ==================== 新增：基于 Formula 类型的增强导出 ====================

export async function exportFormulasEnhanced(formulas: Formula[], options: EnhancedExportOptions): Promise<boolean> {
  const startTime = Date.now();
  const taskId = exportHistory.addEntry({
    filename: options.filename || `配方数据_${getDateStamp()}.${options.format === 'excel' ? 'xlsx' : options.format}`,
    format: options.format,
    fileSize: 0,
    rowCount: formulas.length,
    duration: 0,
    status: 'processing' as 'success',
    timestamp: new Date(),
  });

  try {
    if (formulas.length === 0) {
      throw new Error('没有可导出的数据');
    }

    const reportProgress = (stage: ExportProgress['stage'], progress: number, message: string) => {
      options.onProgress?.({
        stage,
        progress,
        message,
        startTime,
        estimatedTimeRemaining: progress > 0 ? ((Date.now() - startTime) / progress) * (100 - progress) : undefined,
      });
    };

    reportProgress('preparing', 10, '准备导出数据...');

    switch (options.format) {
      case 'excel':
        await exportToExcel(formulas, options, reportProgress);
        break;
      case 'csv':
        await exportToCSV(formulas, options, reportProgress);
        break;
      case 'pdf':
        await exportToPDF(formulas, options, reportProgress);
        break;
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }

    reportProgress('completed', 100, '导出完成');

    const duration = Date.now() - startTime;
    exportHistory.updateEntry(taskId, {
      status: 'success',
      duration,
    });

    return true;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '未知错误';
    logger.error('[FormulaExporter] 增强导出失败:', e);

    exportHistory.updateEntry(taskId, {
      status: 'failed',
      error: errorMessage,
    });

    return false;
  }
}

// ==================== Excel 导出（使用 exceljs）====================

async function exportToExcel(
  formulas: Formula[],
  options: EnhancedExportOptions,
  reportProgress: (stage: ExportProgress['stage'], progress: number, message: string) => void,
): Promise<void> {
  reportProgress('processing', 20, '正在生成 Excel 文件...');

  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RMFOOD 配方平台';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options.filename?.replace(/[.].*$/, '') || '配方数据', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = buildHeaders(options);
  const headerRow = worksheet.addRow(headers.map((h) => h.label));
  styleHeaderRow(headerRow);

  worksheet.columns = headers.map((h) => ({
    header: h.label,
    key: h.key,
    width: h.width || 15,
  }));

  const totalRows = formulas.length;
  const batchSize = Math.ceil(totalRows / 80);

  for (let i = 0; i < totalRows; i++) {
    const formula = formulas[i];
    const rowData = buildFormulaRow(formula, options);
    const row = worksheet.addRow(rowData);

    applyStatusConditionalFormat(
      row,
      headers.findIndex((h) => h.key === 'status'),
    );

    if ((i + 1) % batchSize === 0 || i === totalRows - 1) {
      const progress = 20 + Math.floor(((i + 1) / totalRows) * 60);
      reportProgress('processing', progress, `正在处理第 ${i + 1}/${totalRows} 条记录...`);
    }
  }

  autoFitColumnWidths(worksheet, headers);

  reportProgress('finalizing', 85, '正在生成文件...');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `${options.filename || '配方数据_' + getDateStamp()}.xlsx`;
  downloadBlob(blob, filename, { timestamp: false });
}

interface HeaderDef {
  key: string;
  label: string;
  width?: number;
}

function buildHeaders(options: EnhancedExportOptions): HeaderDef[] {
  const baseHeaders: HeaderDef[] = [
    { key: 'index', label: '序号', width: 6 },
    { key: 'name', label: '配方名称', width: 20 },
    { key: 'category', label: '分类', width: 12 },
    { key: 'status', label: '状态', width: 10 },
    { key: 'ingredientCount', label: '成分数', width: 8 },
  ];

  if (options.includeIngredients !== false) {
    baseHeaders.push(
      { key: 'ingredients', label: '成分详情', width: 35 },
      { key: 'totalAmount', label: '总用量', width: 12 },
    );
  }

  if (options.includeSteps) {
    baseHeaders.push({ key: 'steps', label: '制作步骤', width: 30 });
  }

  if (options.includeAnalysis) {
    baseHeaders.push(
      { key: 'effects', label: '功效', width: 25 },
      { key: 'estimatedCost', label: '预估成本', width: 10 },
    );
  }

  baseHeaders.push(
    { key: 'tags', label: '标签', width: 18 },
    { key: 'createdAt', label: '创建时间', width: 16 },
    { key: 'updatedAt', label: '更新时间', width: 16 },
  );

  return baseHeaders;
}

function styleHeaderRow(row: any): void {
  row.eachCell((cell: any) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  row.height = 24;
}

function applyStatusConditionalFormat(row: any, statusColIndex: number): void {
  if (statusColIndex < 0) return;

  const statusCell = row.getCell(statusColIndex + 1);
  const statusValue = String(statusCell.value || '');
  const colorConfig = STATUS_COLOR_MAP[statusValue.toLowerCase()];

  if (colorConfig) {
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorConfig.bg.replace('#', '') },
    };
    statusCell.font = { color: { argb: colorConfig.text.replace('#', '') } };
  }
}

function autoFitColumnWidths(worksheet: any, _headers: HeaderDef[]): void {
  void _headers;
  worksheet.columns.forEach((column: any) => {
    if (!column?.eachCell) return;
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell: any) => {
      const value = String(cell.value || '');
      const length = value.split('').reduce((len, char) => {
        const code = char.charCodeAt(0);
        return len + (code > 0x4e00 && code < 0x9fff ? 2 : 1);
      }, 0);
      maxLength = Math.max(maxLength, length);
    });
    const adjustedWidth = Math.min(Math.max(maxLength + 2, 10), 50);
    column.width = adjustedWidth;
  });
}

// ==================== CSV 导出（UTF-8 BOM）====================

async function exportToCSV(
  formulas: Formula[],
  options: EnhancedExportOptions,
  reportProgress: (stage: ExportProgress['stage'], progress: number, message: string) => void,
): Promise<void> {
  reportProgress('processing', 30, '正在生成 CSV 文件...');

  const headers = buildHeaders(options);
  const csvLines: string[] = [];

  csvLines.push(headers.map((h) => csvEscape(h.label)).join(','));

  const totalRows = formulas.length;

  for (let i = 0; i < totalRows; i++) {
    const rowData = buildFormulaRow(formulas[i], options);
    csvLines.push(
      Object.values(rowData)
        .map((cell) => csvEscape(String(cell ?? '')))
        .join(','),
    );

    if ((i + 1) % 200 === 0 || i === totalRows - 1) {
      const progress = 30 + Math.floor(((i + 1) / totalRows) * 50);
      reportProgress('processing', progress, `正在处理第 ${i + 1}/${totalRows} 条记录...`);
    }
  }

  reportProgress('finalizing', 85, '正在生成文件...');

  const csvContent = addBOM(csvLines.join('\n'));
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const filename = `${options.filename || '配方数据_' + getDateStamp()}.csv`;
  downloadBlob(blob, filename, { timestamp: false });
}

// ==================== PDF 导出（方案C：生成 HTML → 浏览器打印，原生渲染中文）====================

async function exportToPDF(
  formulas: Formula[],
  options: EnhancedExportOptions,
  reportProgress: (stage: ExportProgress['stage'], progress: number, message: string) => void,
): Promise<void> {
  reportProgress('processing', 30, '正在生成 PDF 文件...');

  const headerDefs = buildHeaders(options);
  const headers = headerDefs.map((h) => h.label);
  const statusColIndex = headerDefs.findIndex((h) => h.key === 'status');
  const totalRows = formulas.length;

  const bodyRows: string[] = [];
  for (let i = 0; i < totalRows; i++) {
    const rowData = Object.values(buildFormulaRow(formulas[i], options)).map((cell) => String(cell ?? ''));
    const statusCell =
      statusColIndex >= 0 && rowData[statusColIndex] !== undefined
        ? STATUS_COLOR_MAP[rowData[statusColIndex].toLowerCase()]
        : undefined;
    const cells = rowData
      .map(
        (cell, idx) =>
          `<td style="${idx === statusColIndex && statusCell ? `background:#${statusCell.bg};color:#${statusCell.text};` : ''}">${escapeHtml(cell)}</td>`,
      )
      .join('');
    bodyRows.push(`<tr>${cells}</tr>`);

    if ((i + 1) % 50 === 0 || i === totalRows - 1) {
      const progress = 30 + Math.floor(((i + 1) / totalRows) * 50);
      reportProgress('processing', progress, `正在处理第 ${i + 1}/${totalRows} 条记录...`);
    }
  }

  reportProgress('finalizing', 80, '正在渲染 PDF 页面...');

  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const contentHtml = `
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      .report-container { max-width: none; padding: 0; }
      table { font-size: 7pt; }
      th, td { padding: 3px 5px; word-break: break-word; }
      th { font-size: 8pt; }
    </style>
    <h1 style="font-size:16pt;text-align:left;border:none;color:#1f2937;">RMFOOD 配方数据导出</h1>
    <p style="font-size:9pt;color:#64748b;">导出时间: ${escapeHtml(new Date().toLocaleString('zh-CN'))}  |  共 ${formulas.length} 条记录</p>
    <table>
      ${thead}
      <tbody>${bodyRows.join('')}</tbody>
    </table>`;

  reportProgress('finalizing', 95, '正在保存文件...');

  const filename = `${options.filename || '配方数据_' + getDateStamp()}.pdf`;
  exportHtmlAsPdf(wrapPrintHtml(contentHtml, filename), {
    title: filename,
    onError: (message) => {
      logger.error('[FormulaExporter] PDF 导出失败:', message);
    },
  });
}

// ==================== 数据行构建 ====================

function buildFormulaRow(formula: Formula, options: EnhancedExportOptions): Record<string, unknown> {
  const ingredientsStr =
    formula.ingredients?.map((ing: any) => {
      const amt = ing.amount ?? ing.amount_mg ?? ing.properties?.amount ?? '';
      const unit = ing.unit ?? ing.properties?.unit ?? '';
      return amt ? `${ing.name}:${amt}${unit}` : ing.name;
    }).join('; ') ||
    '';

  const stepsStr = formula.processSteps?.map((step) => step.description).join(' → ') || '';

  const effectsStr = formula.targetEffects?.join(', ') || '';
  const tagsStr = formula.tags?.join(', ') || '';

  const row: Record<string, unknown> = {
    index: undefined,
    name: formula.name,
    category: formula.category || '-',
    status: STATUS_LABEL_MAP[formula.status] || formula.status,
    ingredientCount: formula.ingredients?.length || 0,
  };

  if (options.includeIngredients !== false) {
    row.ingredients = ingredientsStr;
    row.totalAmount = formula.ingredients?.reduce((sum, ing: any) => sum + ((ing.amount ?? ing.amount_mg ?? 0) as number), 0) || 0;
  }

  if (options.includeSteps) {
    row.steps = stepsStr;
  }

  if (options.includeAnalysis) {
    row.effects = effectsStr;
    row.estimatedCost = formula.estimatedCost || '-';
  }

  row.tags = tagsStr;
  row.createdAt = formula.createdAt ? new Date(formula.createdAt).toLocaleDateString('zh-CN') : '-';
  row.updatedAt = formula.updatedAt ? new Date(formula.updatedAt).toLocaleDateString('zh-CN') : '-';

  return row;
}

// ==================== 导入模板生成 ====================

export async function generateImportTemplate(): Promise<Blob> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RMFOOD 配方平台';
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet('导入模板');

  const headers = [
    '配方名称*',
    '分类',
    '状态',
    '标签(分号分隔)',
    '成分名称*|用量|单位|角色(分号分隔多个成分)',
    '制作步骤(分号分隔)',
    '描述',
    '预估成本',
    '生产时间',
  ];

  const headerRow = dataSheet.addRow(headers);
  styleHeaderRow(headerRow);

  dataSheet.addRow([
    '清热解毒汤',
    '中药配方',
    '草稿',
    '清热;解毒;养生',
    '金银花|10g|g|君药;连翘|8g|g|臣药;甘草|3g|g|佐使药',
    '1.将药材洗净浸泡30分钟;2.大火煮沸后转小火煮20分钟;3.过滤取汁',
    '用于清热解毒的经典配方',
    '25.5',
    '45分钟',
  ]);

  dataSheet.addRow([
    '补气养血丸',
    '中药配方',
    '草稿',
    '补气;养血;气血双补',
    '当归|12g|g|君药;黄芪|15g|g|臣药;熟地黄|10g|g|佐药',
    '1.研粉过筛;2.炼蜜为丸;3.每丸9g',
    '气血双补的基础方',
    '42.0',
    '2小时',
  ]);

  const ruleSheet = workbook.addWorksheet('字段说明与校验规则');

  ruleSheet.columns = [
    { header: '字段名', key: 'field', width: 20 },
    { header: '是否必填', key: 'required', width: 12 },
    { header: '说明', key: 'description', width: 40 },
    { header: '校验规则', key: 'rule', width: 35 },
    { header: '示例值', key: 'example', width: 25 },
  ];

  const rules = [
    {
      field: '配方名称',
      required: '是 (*)',
      description: '配方的唯一名称，不可重复',
      rule: '必填；长度2-100字符；不可含特殊字符',
      example: '清热解毒汤',
    },
    {
      field: '分类',
      required: '否',
      description: '配方所属分类',
      rule: '选填；建议从已有分类中选择',
      example: '中药配方',
    },
    {
      field: '状态',
      required: '否',
      description: '初始状态',
      rule: '可选：草稿/待审核/已通过/拒绝/已归档',
      example: '草稿',
    },
    {
      field: '标签',
      required: '否',
      description: '用于搜索和筛选的关键词',
      rule: '多个标签用英文分号分隔',
      example: '清热;解毒;养生',
    },
    {
      field: '成分详情',
      required: '是 (*)',
      description: '配方包含的所有成分信息',
      rule: '格式：名称|用量|单位|角色；多个用分号分隔\n角色可选：君药/臣药/佐药/使药/辅料',
      example: '金银花|10g|g|君药',
    },
    {
      field: '制作步骤',
      required: '否',
      description: '配方的制作流程',
      rule: '多个步骤用分号分隔；可带序号',
      example: '1.清洗;2.煮沸;3.冷却',
    },
    {
      field: '描述',
      required: '否',
      description: '配方的详细文字说明',
      rule: '最长500字符',
      example: '用于清热解毒的经典配方',
    },
    { field: '预估成本', required: '否', description: '单份配方的预估成本（元）', rule: '数字或留空', example: '25.5' },
    { field: '生产时间', required: '否', description: '单份配方的生产耗时', rule: '文本格式', example: '45分钟' },
  ];

  rules.forEach((rule) => ruleSheet.addRow(rule));

  const ruleHeaderRow = ruleSheet.getRow(1);
  styleHeaderRow(ruleHeaderRow);

  dataSheet.columns.forEach((col) => (col.width = 20));
  ruleSheet.getColumn(3).width = 45;
  ruleSheet.getColumn(4).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ==================== 文件解析工具（用于导入预览）====================

export interface ParsedImportRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: ImportErrorDetail[];
  warnings: ImportErrorDetail[];
  isValid: boolean;
  severity: 'valid' | 'warning' | 'error';
}

export interface ImportErrorDetail {
  field?: string;
  message: string;
  code: string;
}

export async function parseImportFile(file: File): Promise<{
  headers: string[];
  rows: ParsedImportRow[];
  totalCount: number;
}> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file);
  } else if (extension === 'csv') {
    return parseCSVFile(file);
  } else {
    throw new Error(`不支持的文件格式: .${extension}，仅支持 .xlsx 和 .csv 格式`);
  }
}

async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: ParsedImportRow[]; totalCount: number }> {
  const ExcelJS = await getExcelJS();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel 文件中没有找到工作表');
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell) => {
    headers.push(String(cell.value || '').trim());
  });

  const rows: ParsedImportRow[] = [];
  let rowIndex = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    rowIndex++;
    const data: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1] || `col_${colNumber}`;
      data[key] = String(cell.value ?? '');
    });

    rows.push({
      rowIndex,
      data,
      errors: [],
      warnings: [],
      isValid: true,
      severity: 'valid',
    });
  });

  return { headers, rows, totalCount: rows.length };
}

async function parseCSVFile(file: File): Promise<{ headers: string[]; rows: ParsedImportRow[]; totalCount: number }> {
  const text = await file.text();
  const lines = text.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV 文件内容为空或只有表头行');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const data: Record<string, string> = {};

    headers.forEach((header, idx) => {
      data[header] = values[idx] || '';
    });

    rows.push({
      rowIndex: i,
      data,
      errors: [],
      warnings: [],
      isValid: true,
      severity: 'valid',
    });
  }

  return { headers, rows, totalCount: rows.length };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// ==================== 数据验证 ====================

export function validateImportRow(row: ParsedImportRow, headers: string[]): ParsedImportRow {
  const validatedRow = { ...row };
  validatedRow.errors = [];
  validatedRow.warnings = [];

  const nameField = headers.find((h) => h.includes('名称'));
  const ingredientField = headers.find((h) => h.includes('成分'));

  if (nameField && !row.data[nameField]?.trim()) {
    validatedRow.errors.push({
      field: nameField,
      message: '配方名称为必填项',
      code: 'REQUIRED',
    });
  } else if (nameField && row.data[nameField]?.trim()) {
    const name = row.data[nameField].trim();
    if (name.length < 2) {
      validatedRow.errors.push({
        field: nameField,
        message: '配方名称至少需要2个字符',
        code: 'MIN_LENGTH',
      });
    } else if (name.length > 100) {
      validatedRow.warnings.push({
        field: nameField,
        message: '配方名称超过100个字符，可能被截断',
        code: 'MAX_LENGTH',
      });
    }
  }

  if (ingredientField && !row.data[ingredientField]?.trim()) {
    validatedRow.errors.push({
      field: ingredientField,
      message: '成分为必填项',
      code: 'REQUIRED',
    });
  }

  const hasData = Object.values(row.data).some((v) => v?.trim());
  if (!hasData) {
    validatedRow.errors.push({
      message: '该行为空行',
      code: 'EMPTY_ROW',
    });
  }

  validatedRow.isValid = validatedRow.errors.length === 0;
  validatedRow.severity =
    validatedRow.errors.length > 0 ? 'error' : validatedRow.warnings.length > 0 ? 'warning' : 'valid';

  return validatedRow;
}

// ==================== 旧版兼容函数 ====================

function exportAsJSON(formulas: AIRecognizedFormula[], includeMetadata: boolean, includeIngredients: boolean): string {
  const data = {
    exportTime: new Date().toISOString(),
    totalCount: formulas.length,
    formulas: formulas.map((f) => ({
      id: f.id,
      name: f.name,
      ...(includeIngredients && { ingredients: f.ingredients }),
      ...(includeMetadata && {
        ingredientCount: f.ingredientCount,
        confidence: f.confidence,
        sourceMessageId: f.sourceMessageId,
        parsedAt: f.parsedAt.toISOString(),
      }),
    })),
  };

  return JSON.stringify(data, null, 2);
}

function exportAsCSV(formulas: AIRecognizedFormula[], includeMetadata: boolean, includeIngredients: boolean): string {
  const headers = ['序号', '配方名称', '成分数量'];

  if (includeMetadata) {
    headers.push('置信度', '识别时间');
  }

  if (includeIngredients) {
    headers.push('成分列表');
  }

  const rows = formulas.map((f, idx) => {
    const row = [csvEscape((idx + 1).toString()), csvEscape(f.name), csvEscape(f.ingredientCount.toString())];

    if (includeMetadata) {
      row.push(csvEscape(`${(f.confidence * 100).toFixed(0)}%`), csvEscape(f.parsedAt.toLocaleString('zh-CN')));
    }

    if (includeIngredients) {
      const ingredientsStr = f.ingredients
        .map((ing) => `${ing.name}${ing.dosage ? `:${ing.dosage}${ing.unit || ''}` : ''}`)
        .join('; ');
      row.push(csvEscape(ingredientsStr));
    }

    return row.join(',');
  });

  const csvContent = [headers.map((h) => csvEscape(h)).join(','), ...rows].join('\n');
  return addBOM(csvContent);
}

function exportAsTXT(
  formulas: AIRecognizedFormula[],
  includeMetadata: boolean,
  includeIngredients: boolean,
  title: string,
): string {
  const lines = [
    '='.repeat(60),
    `  ${title}`,
    '='.repeat(60),
    '',
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `配方总数: ${formulas.length}`,
    '',
    '-'.repeat(60),
  ];

  formulas.forEach((f, idx) => {
    lines.push('');
    lines.push(`【${idx + 1}】${f.name}`);
    lines.push('-'.repeat(40));

    if (includeMetadata) {
      lines.push(`  成分数量: ${f.ingredientCount}`);
      lines.push(`  置信度: ${(f.confidence * 100).toFixed(0)}%`);
      lines.push(`  识别时间: ${f.parsedAt.toLocaleString('zh-CN')}`);
    }

    if (includeIngredients && f.ingredients.length > 0) {
      lines.push('');
      lines.push('  成分列表:');
      f.ingredients.forEach((ing, i) => {
        lines.push(`    ${i + 1}. ${ing.name}${ing.dosage ? ` - ${ing.dosage}${ing.unit || ''}` : ''}`);
      });
    }

    lines.push('');
  });

  lines.push('-'.repeat(60));
  lines.push('');
  lines.push(`由 RMFOOD 配方平台自动生成`);

  return lines.join('\n');
}

function exportAsHTML(
  formulas: AIRecognizedFormula[],
  includeMetadata: boolean,
  includeIngredients: boolean,
  title: string,
): string {
  const formulaRows = formulas
    .map(
      (f, idx) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #ddd; padding: 8px;"><strong>${escapeHtml(f.name)}</strong></td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${f.ingredientCount}</td>
      ${
        includeMetadata
          ? `
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${(f.confidence * 100).toFixed(0)}%</td>
      <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">${f.parsedAt.toLocaleString('zh-CN')}</td>
      `
          : ''
      }
      ${
        includeIngredients
          ? `
      <td style="border: 1px solid #ddd; padding: 8px; font-size: 12px;">
        ${f.ingredients
          .map(
            (ing) =>
              `<div>${escapeHtml(ing.name)}${ing.dosage ? ` <span style="color: #666;">(${ing.dosage}${ing.unit || ''})</span>` : ''}</div>`,
          )
          .join('')}
      </td>
      `
          : ''
      }
    </tr>
  `,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    th {
      background: #3498db;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    tr:nth-child(even) { background: #f9f9f9; }
    tr:hover { background: #f5f5f5; }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #eee;
      padding-top: 15px;
    }
    @media print {
      body { margin: 20px; }
      table { box-shadow: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    导出时间: ${new Date().toLocaleString('zh-CN')} | 配方总数: ${formulas.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>配方名称</th>
        <th>成分数量</th>
        ${includeMetadata ? '<th>置信度</th><th>识别时间</th>' : ''}
        ${includeIngredients ? '<th>成分列表</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${formulaRows}
    </tbody>
  </table>
  <div class="footer">由 RMFOOD 配方平台自动生成</div>
</body>
</html>`;
}

async function exportAsExcelLegacy(
  formulas: AIRecognizedFormula[],
  _includeMetadata: boolean,
  _includeIngredients: boolean,
  _filename?: string,
  _onProgress?: (progress: number, message: string) => void,
): Promise<void> {
  void _includeMetadata;
  void _includeIngredients;
  void _filename;
  void _onProgress;
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('配方数据', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = [
    { header: '序号', key: 'index', width: 8 },
    { header: '配方名称', key: 'name', width: 25 },
    { header: '成分数量', key: 'count', width: 12 },
    { header: '置信度', key: 'confidence', width: 12 },
    { header: '识别时间', key: 'parsedAt', width: 20 },
  ];

  const headerRow = worksheet.getRow(1);
  styleHeaderRow(headerRow);

  formulas.forEach((f, idx) => {
    worksheet.addRow({
      index: idx + 1,
      name: f.name,
      count: f.ingredientCount,
      confidence: `${(f.confidence * 100).toFixed(0)}%`,
      parsedAt: f.parsedAt.toLocaleString('zh-CN'),
    });
  });

  autoFitColumnWidths(worksheet, []);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `rmfood-formulas-${getDateStamp()}.xlsx`, { timestamp: false });
}

async function exportAsPDFLegacy(
  formulas: AIRecognizedFormula[],
  _includeMetadata: boolean,
  _includeIngredients: boolean,
  _filename?: string,
  title?: string,
  _onProgress?: (progress: number, message: string) => void,
): Promise<void> {
  void _includeMetadata;
  void _includeIngredients;
  void _filename;
  void _onProgress;

  const headers = ['序号', '配方名称', '成分数量', '置信度'];
  const rows = formulas.map((f, idx) => [
    String(idx + 1),
    f.name,
    String(f.ingredientCount),
    `${(f.confidence * 100).toFixed(0)}%`,
  ]);

  const contentHtml = `
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      .report-container { max-width: none; padding: 0; }
      th { background: #3498db; color: #fff; }
    </style>
    <h1 style="font-size:16pt;text-align:left;border:none;color:#1f2937;">${escapeHtml(title || 'RMFOOD 配方列表')}</h1>
    <p style="font-size:9pt;color:#64748b;">导出时间: ${escapeHtml(new Date().toLocaleString('zh-CN'))}  |  共 ${formulas.length} 条</p>
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>`;

  const filename = `rmfood-formulas-${getDateStamp()}.pdf`;
  exportHtmlAsPdf(wrapPrintHtml(contentHtml, filename), {
    title: filename,
    onError: (message) => {
      logger.error('[FormulaExporter] PDF 导出失败(legacy):', message);
    },
  });
}

function downloadFile(content: string, filename: string, mimeType: string, fileExtension: string): void {
  let finalContent = content;

  if (mimeType.includes('csv') && !content.startsWith('\uFEFF')) {
    finalContent = addBOM(content);
  }

  const blob = new Blob([finalContent], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = formatFilename(filename, fileExtension);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return (text || '').replace(/[&<>"']/g, (m: string) => map[m] || m);
}
