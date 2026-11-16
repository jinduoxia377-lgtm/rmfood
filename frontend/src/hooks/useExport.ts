import { logger } from '@/utils/safeLogger'
import { useState, useCallback, useRef } from 'react';
import { ExportFormat } from '../types/export.types';
// 方案C：中文 PDF 走「生成 HTML → 浏览器打印」由浏览器原生渲染中文，避免 jsPDF 内置字体缺 CJK 字形乱码。
// 静态导入（而非动态 import）以确保 exportHtmlAsPdf 内的 window.open 处于用户手势同步调用栈内，不被弹窗拦截。
import { exportHtmlAsPdf, wrapPrintHtml } from '@/utils/pdfPrintExporter';
import type {
  ExportOptions,
  ExportColumn,
  ExportProgress,
  ExportResult,
  ExportCallback,
} from '../types/export.types';

export interface UseExportReturn {
  doExport: (options: ExportOptions) => Promise<ExportResult>;
  export: (options: ExportOptions, data: unknown[], onProgress?: ExportCallback) => Promise<ExportResult>;
  progress: ExportProgress;
  isExporting: boolean;
  cancelExport: () => void;
  getSupportedFormats: () => ExportFormat[];
  getDefaultFileName: (format: ExportFormat) => string;
}

export function useExport(): UseExportReturn {
  const [progress, setProgress] = useState<ExportProgress>({
    isExporting: false,
    currentStep: '',
    progress: 0,
    totalSteps: 0,
  });

  const abortRef = useRef(false);

  const updateProgress = useCallback((step: string, current: number, total: number) => {
    setProgress({
      isExporting: true,
      currentStep: step,
      progress: current,
      totalSteps: total,
    });
  }, []);

  const exportData = useCallback(async (
    options: ExportOptions,
    data: unknown[],
    onProgress?: ExportCallback,
  ): Promise<ExportResult> => {
    abortRef.current = false;

    try {
      updateProgress('准备导出数据...', 0, 4);

      const visibleColumns = options.columns.filter(col => col.visible)
        .sort((a, b) => a.order - b.order);

      const processedData = data;

      if (onProgress) {
        onProgress({
          isExporting: true,
          currentStep: '处理数据...',
          progress: 1,
          totalSteps: 4,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      if (abortRef.current) {
        throw new Error('导出已取消');
      }

      let result: ExportResult;

      switch (options.format) {
        case ExportFormat.CSV:
          result = await exportToCSV(processedData, visibleColumns, options);
          break;
        case ExportFormat.EXCEL:
          result = await exportToExcel(processedData, visibleColumns, options);
          break;
        case ExportFormat.JSON:
          result = await exportToJSON(processedData, visibleColumns, options);
          break;
        case ExportFormat.PDF:
          result = await exportToPDF(processedData, visibleColumns, options);
          break;
        default:
          throw new Error(`不支持的导出格式: ${options.format}`);
      }

      if (onProgress) {
        onProgress({
          isExporting: false,
          currentStep: '完成',
          progress: 4,
          totalSteps: 4,
        });
      }

      setProgress({
        isExporting: false,
        currentStep: '完成',
        progress: 4,
        totalSteps: 4,
      });

      return {
        ...result,
        timestamp: Date.now(),
      };

    } catch (error) {
      setProgress({
        isExporting: false,
        currentStep: '失败',
        progress: 0,
        totalSteps: 0,
      });

      return {
        success: false,
        fileName: '',
        format: options.format,
        recordCount: 0,
        error: error instanceof Error ? error.message : '导出失败',
        timestamp: Date.now(),
      };
    }
  }, [updateProgress]);

  const cancelExport = useCallback(() => {
    abortRef.current = true;
  }, []);

  const getSupportedFormats = useCallback((): ExportFormat[] => {
    return Object.values(ExportFormat);
  }, []);

  const getDefaultFileName = useCallback((format: ExportFormat): string => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const formatMap: Record<ExportFormat, string> = {
      [ExportFormat.CSV]: 'csv',
      [ExportFormat.EXCEL]: 'xlsx',
      [ExportFormat.JSON]: 'json',
      [ExportFormat.PDF]: 'pdf',
    };
    return `data_export_${timestamp}.${formatMap[format]}`;
  }, []);

  const doExport = useCallback(async (options: ExportOptions): Promise<ExportResult> => {
    logger.log('Export called with options:', options);
    return exportData(options, [], undefined);
  }, [exportData]);

  return {
    doExport,
    export: exportData,
    progress,
    isExporting: progress.isExporting,
    cancelExport,
    getSupportedFormats,
    getDefaultFileName,
  };
}

async function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions,
): Promise<ExportResult> {
  const delimiter = options.csvConfig?.delimiter || ',';
  const encoding = options.csvConfig?.encoding || 'utf-8';
  const quoteFields = options.csvConfig?.quoteFields !== false;

  let csvContent = '';

  if (options.includeHeader !== false) {
    if (options.includeIndex) {
      csvContent += `序号${delimiter}`;
    }
    csvContent += columns.map(col => {
      const label = quoteFields ? `"${col.label}"` : col.label;
      return label.replace(new RegExp(delimiter, 'g'), '\\$&');
    }).join(delimiter);
    csvContent += '\n';
  }

  data.forEach((row, index) => {
    if (options.includeIndex) {
      csvContent += `${index + 1}${delimiter}`;
    }
    csvContent += columns.map(col => {
      let value = row[col.key];
      if (col.format && value != null) {
        value = col.format(value);
      }
      if (value == null) value = '';
      value = String(value);

      if (quoteFields || value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(delimiter);
    csvContent += '\n';
  });

  const blob = new Blob([csvContent], { type: `text/csv;charset=${encoding}` });
  downloadBlob(blob, options.fileName || getDefaultFileNameStatic(ExportFormat.CSV));

  return {
    success: true,
    fileName: options.fileName || getDefaultFileNameStatic(ExportFormat.CSV),
    format: ExportFormat.CSV,
    recordCount: data.length,
    fileSize: blob.size,
    timestamp: Date.now(),
  };
}

async function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions,
): Promise<ExportResult> {
  try {
    const ExcelJS = await import('exceljs');

    const worksheetData: any[][] = [];

    if (options.includeHeader !== false) {
      const headerRow: any[] = [];
      if (options.includeIndex) headerRow.push('序号');
      columns.forEach(col => headerRow.push(col.label));
      worksheetData.push(headerRow);
    }

    data.forEach((row, index) => {
      const dataRow: any[] = [];
      if (options.includeIndex) dataRow.push(index + 1);
      columns.forEach(col => {
        let value = row[col.key];
        if (col.format && value != null) {
          value = col.format(value);
        }
        dataRow.push(value ?? '');
      });
      worksheetData.push(dataRow);
    });

    const wb = new ExcelJS.default.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    worksheetData.forEach(row => ws.addRow(row));

    if (options.excelStyle?.freezePane) {
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    ws.columns = columns.map(col => ({
      header: col.label,
      key: col.key,
      width: col.width || 15,
    }));

    const excelBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, options.fileName || getDefaultFileNameStatic(ExportFormat.EXCEL));

    return {
      success: true,
      fileName: options.fileName || getDefaultFileNameStatic(ExportFormat.EXCEL),
      format: ExportFormat.EXCEL,
      recordCount: data.length,
      fileSize: blob.size,
      timestamp: Date.now(),
    };
  } catch {
    throw new Error('Excel导出失败，请检查exceljs库是否已安装');
  }
}

async function exportToJSON(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions,
): Promise<ExportResult> {
  const jsonData = data.map((row, index) => {
    const obj: Record<string, any> = {};
    if (options.includeIndex) {
      obj['序号'] = index + 1;
    }
    columns.forEach(col => {
      let value = row[col.key];
      if (col.format && value != null) {
        value = col.format(value);
      }
      obj[col.label] = value;
    });
    return obj;
  });

  const jsonContent = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, options.fileName || getDefaultFileNameStatic(ExportFormat.JSON));

  return {
    success: true,
    fileName: options.fileName || getDefaultFileNameStatic(ExportFormat.JSON),
    format: ExportFormat.JSON,
    recordCount: data.length,
    fileSize: blob.size,
    timestamp: Date.now(),
  };
}

/** 转义用户数据，避免破坏 HTML 结构 / 注入 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EXPORT_BRAND_GREEN = '#10B981';

async function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions,
): Promise<ExportResult> {
  const fileName = options.fileName || getDefaultFileNameStatic(ExportFormat.PDF);

  try {
    // ===== 构建 HTML 表格（由浏览器原生渲染中文，避免 jsPDF 内置字体缺 CJK 字形乱码）=====
    const tableHeaders: string[] = [];
    if (options.includeIndex) tableHeaders.push('序号');
    columns.forEach(col => tableHeaders.push(col.label));

    const headCells = tableHeaders
      .map(label => `<th>${escapeHtml(label)}</th>`)
      .join('');

    const bodyRows = data
      .map((row, index) => {
        const cells: string[] = [];
        if (options.includeIndex) cells.push(String(index + 1));
        columns.forEach(col => {
          let value = row[col.key];
          if (col.format && value != null) {
            value = col.format(value);
          }
          cells.push(escapeHtml(value ?? ''));
        });
        return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
      })
      .join('');

    const title = options.pdfConfig?.title;
    const subtitle = options.pdfConfig?.subtitle;
    const showPageNumbers = options.pdfConfig?.showPageNumbers !== false;

    const contentHtml = `
      <style>
        h1.pdf-title{color:${EXPORT_BRAND_GREEN};font-size:16pt;margin-bottom:0.3em;}
        p.pdf-subtitle{color:#64748b;font-size:12pt;margin-bottom:0.8em;}
        table.pdf-table{width:100%;border-collapse:collapse;font-size:9pt;}
        table.pdf-table th{background:${EXPORT_BRAND_GREEN};color:#fff;font-weight:bold;text-align:center;padding:4px 8px;border:1px solid #ccc;}
        table.pdf-table td{padding:3px 8px;border:1px solid #ccc;}
        table.pdf-table tbody tr:nth-child(even){background:#f5f5f5;}
        .pdf-footer{margin-top:18px;padding-top:6px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:8pt;}
        .pdf-footer .page-num::before{content:counter(page);}
      </style>
      ${title ? `<h1 class="pdf-title">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<p class="pdf-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <table class="pdf-table">
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${
        showPageNumbers
          ? `<div class="pdf-footer">第 <span class="page-num"></span> 页</div>`
          : ''
      }`;

    // 同步调用：exportHtmlAsPdf 内的 window.open 需处于用户手势调用栈内
    exportHtmlAsPdf(wrapPrintHtml(contentHtml, fileName), {
      title: fileName,
      onError: (message) => {
        logger.error('[useExport] PDF export failed:', message);
      },
    });

    return {
      success: true,
      fileName,
      format: ExportFormat.PDF,
      recordCount: data.length,
      // 方案C 由浏览器打印，无 Blob 体积；fileSize 记 0
      fileSize: 0,
      timestamp: Date.now(),
    };
  } catch {
    throw new Error('PDF导出失败，请检查浏览器是否允许弹出窗口');
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getDefaultFileNameStatic(format: ExportFormat): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const formatMap: Record<ExportFormat, string> = {
    [ExportFormat.CSV]: 'csv',
    [ExportFormat.EXCEL]: 'xlsx',
    [ExportFormat.JSON]: 'json',
    [ExportFormat.PDF]: 'pdf',
  };
  return `data_export_${timestamp}.${formatMap[format]}`;
}

export default useExport;
