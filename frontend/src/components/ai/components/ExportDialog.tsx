import React, { useState, useEffect } from 'react';
import { ExportFormat, ExportScope } from '../../../types/export.types';
import type { ExportOptions, ExportColumn, ExportProgress, ExportResult } from '../../../types/export.types';

interface ExportDialogProps {
  isOpen: boolean;
  columns: ExportColumn[];
  totalRowCount: number;
  selectedRowCount?: number;
  filteredRowCount?: number;
  onExport: (options: ExportOptions) => Promise<ExportResult>;
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  columns,
  totalRowCount,
  selectedRowCount = 0,
  filteredRowCount = 0,
  onExport,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.EXCEL);
  const [scope, setScope] = useState<ExportScope>(ExportScope.ALL_DATA);
  const [fileName, setFileName] = useState('');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.filter(c => c.visible).map(c => c.key),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [progress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timestamp = new Date().toISOString().slice(0, 10);
      setFileName(`数据导出_${timestamp}`);
      setSelectedColumns(columns.filter(c => c.visible).map(c => c.key));
      setResult(null);
    }
  }, [isOpen, columns]);

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(k => k !== columnKey)
        : [...prev, columnKey],
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(columns.map(c => c.key));
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setResult(null);

    const options: ExportOptions = {
      format,
      scope,
      columns: columns.map(col => ({
        ...col,
        visible: selectedColumns.includes(col.key),
      })),
      fileName: fileName || undefined,
      includeHeader,
      includeIndex,
    };

    try {
      const exportResult = await onExport(options);
      setResult(exportResult);

      if (exportResult.success) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setResult({
        success: false,
        fileName: '',
        format,
        recordCount: 0,
        error: error instanceof Error ? error.message : '导出失败',
        timestamp: Date.now(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getScopeDescription = (): string => {
    switch (scope) {
      case ExportScope.ALL_DATA:
        return `共 ${totalRowCount} 条记录`;
      case ExportScope.CURRENT_PAGE:
        return `当前页数据`;
      case ExportScope.SELECTED_ROWS:
        return `已选 ${selectedRowCount} 条记录`;
      case ExportScope.FILTERED_DATA:
        return `筛选后 ${filteredRowCount} 条记录`;
      default:
        return '';
    }
  };

  const getFormatIcon = (fmt: ExportFormat): string => {
    switch (fmt) {
      case ExportFormat.CSV: return '📊';
      case ExportFormat.EXCEL: return '📗';
      case ExportFormat.JSON: return '{ }';
      case ExportFormat.PDF: return '📄';
      default: return '📁';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">导出数据</h3>
            <p className="mt-1 text-sm text-gray-600">选择导出格式和选项</p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                  {result.success ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? '导出成功！' : '导出失败'}
                  </p>
                  <p className={`mt-1 text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.success
                      ? `${result.fileName} (${(result.fileSize! / 1024).toFixed(1)} KB)`
                      : result.error
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              导出格式
            </label>
            <div className="grid grid-cols-4 gap-3">
              {Object.values(ExportFormat).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  disabled={isExporting}
                  className={`relative p-4 rounded-lg border-2 text-center transition-all ${
                    format === fmt
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  } disabled:opacity-50`}
                >
                  <span className="text-2xl mb-2 block">{getFormatIcon(fmt)}</span>
                  <span className="text-sm font-medium">{fmt.toUpperCase()}</span>
                  {format === fmt && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              导出范围
            </label>
            <div className="space-y-2">
              {[
                { value: ExportScope.ALL_DATA, label: '全部数据', desc: getScopeDescription(), available: true },
                { value: ExportScope.SELECTED_ROWS, label: '选中行', desc: `已选 ${selectedRowCount} 条`, available: selectedRowCount > 0 },
                { value: ExportScope.FILTERED_DATA, label: '筛选结果', desc: filteredRowCount > 0 ? `${filteredRowCount} 条` : '无筛选', available: filteredRowCount > 0 },
                { value: ExportScope.CURRENT_PAGE, label: '当前页', desc: '当前显示的数据', available: true },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    scope === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : option.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => option.available && setScope(option.value)}
                    disabled={!option.available || isExporting}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                    <span className="ml-2 text-xs text-gray-500">{option.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                选择列 ({selectedColumns.length}/{columns.length})
              </label>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  disabled={isExporting}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  全选
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllColumns}
                  disabled={isExporting}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  全不选
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                    selectedColumns.includes(col.key) ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => handleColumnToggle(col.key)}
                    disabled={isExporting}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文件名
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={isExporting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入文件名..."
              />
            </div>
            <div className="space-y-3 pt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  disabled={isExporting}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">包含表头</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeIndex}
                  onChange={(e) => setIncludeIndex(e.target.checked)}
                  disabled={isExporting}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">包含序号列</span>
              </label>
            </div>
          </div>
        </div>

        {isExporting && progress && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">{progress.currentStep}</span>
              <span className="text-sm text-blue-600">
                {progress.progress}/{progress.totalSteps}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.progress / progress.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedColumns.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                导出中...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                开始导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
