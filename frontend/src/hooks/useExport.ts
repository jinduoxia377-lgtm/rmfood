import { logger } from '@/utils/safeLogger'
import { useState, useCallback, useRef } from 'react';
import { ExportFormat, ExportScope } from '../types/export.types';
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
    const startTime = Date.now();

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
  } catch (error) {
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

async function exportToPDF(
  data: any[],
  columns: ExportColumn[],
  options: ExportOptions,
): Promise<ExportResult> {
  try {
    const jsPDF = await import('jspdf');
    const jspdfAutoTable = await import('jspdf-autotable');

    const doc = new jsPDF.default({
      orientation: options.pdfConfig?.orientation || 'portrait',
      unit: 'mm',
      format: options.pdfConfig?.pageSize || 'A4',
    });

    if (options.pdfConfig?.title) {
      doc.setFontSize(16);
      doc.text(options.pdfConfig.title, 14, 20);
    }

    if (options.pdfConfig?.subtitle) {
      doc.setFontSize(12);
      doc.text(options.pdfConfig.subtitle, 14, 28);
    }

    const tableData = data.map((row, index) => {
      const rowData: any[] = [];
      if (options.includeIndex) rowData.push(index + 1);
      columns.forEach(col => {
        let value = row[col.key];
        if (col.format && value != null) {
          value = col.format(value);
        }
        rowData.push(String(value ?? ''));
      });
      return rowData;
    });

    const tableHeaders: string[] = [];
    if (options.includeIndex) tableHeaders.push('序号');
    columns.forEach(col => tableHeaders.push(col.label));

    (doc as unknown as Record<string, unknown>).autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: options.pdfConfig?.title ? 35 : 20,
      styles: {
        fontSize: options.pdfConfig ? 9 : 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: options.pdfConfig?.margins || { top: 20, right: 15, bottom: 20, left: 15 },
    });

    if (options.pdfConfig?.showPageNumbers !== false) {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `第 ${i} 页 / 共 ${pageCount} 页`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' },
        );
      }
    }

    const pdfBlob = doc.output('blob');
    downloadBlob(pdfBlob, options.fileName || getDefaultFileNameStatic(ExportFormat.PDF));

    return {
    success: true,
    fileName: options.fileName || getDefaultFileNameStatic(ExportFormat.PDF),
    format: ExportFormat.PDF,
    recordCount: data.length,
    fileSize: pdfBlob.size,
    timestamp: Date.now(),
  };
  } catch (error) {
    throw new Error('PDF导出需要安装jspdf和jspdf-autotable库');
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
