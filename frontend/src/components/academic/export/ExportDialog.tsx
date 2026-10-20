/**
 * 导出对话框组件
 * 支持多种格式导出学术报告
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  FileText,
  FileCode,
  Table,
  FileImage,
  Download,
  Loader2,
} from 'lucide-react';
import type { ExportFormat } from '@/services/academicExportService';
import type { CitationStyle } from '@/services/citationFormatter';
import { CITATION_STYLES } from '@/services/citationFormatter';
import { AcademicExportService } from '@/services/academicExportService';
import type { AcademicReport } from '@/services/academicReportService';
import { logger } from '@/utils/safeLogger';


interface ExportDialogProps {
  report: AcademicReport;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'markdown', label: 'Markdown', icon: <FileText className="w-5 h-5" />, description: '纯文本格式，适合版本控制和文档编辑' },
  { value: 'html', label: 'HTML', icon: <FileCode className="w-5 h-5" />, description: '网页格式，保留样式和布局' },
  { value: 'word', label: 'Word', icon: <Table className="w-5 h-5" />, description: 'Microsoft Word 格式，适合编辑和打印' },
  { value: 'pdf', label: 'PDF', icon: <FileImage className="w-5 h-5" />, description: '便携式文档格式，适合分享和归档' },
];

export function ExportDialog({ report }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [selectedCitationStyle, setSelectedCitationStyle] = useState<CitationStyle>('gb-t-7714-2015');
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const exportService = new AcademicExportService(report);

      if (selectedFormat === 'pdf') {
        const result = await exportService.exportToPdf({
          format: selectedFormat,
          citationStyle: selectedCitationStyle,
          includeReferences: true,
        });

        if (result.success && result.data) {
          AcademicExportService.downloadBlob(result.data, result.filename);
          setShowSuccess(true);
        }
      } else {
        const result = await exportService.export({
          format: selectedFormat,
          citationStyle: selectedCitationStyle,
          includeReferences: true,
        });

        if (result.success && result.data) {
          AcademicExportService.downloadBlob(result.data, result.filename);
          setShowSuccess(true);
        }
      }
    } catch (error) {
      logger.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  }, [report, selectedFormat, selectedCitationStyle]);

  const handleReset = useCallback(() => {
    setShowSuccess(false);
    setSelectedFormat('markdown');
    setSelectedCitationStyle('gb-t-7714-2015');
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setShowSuccess(false);
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        导出报告
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold">导出学术报告</h2>
              <button
                onClick={() => handleOpenChange(false)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {showSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">导出成功！</h3>
                  <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-4">文件已开始下载</p>
                  <button onClick={handleReset} className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                    继续导出
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-3">选择导出格式</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {FORMAT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSelectedFormat(option.value)}
                          className={`
                            p-4 rounded-lg border-2 transition-all duration-200 text-left
                            ${selectedFormat === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:border-neutral-700'
                            }
                          `}
                        >
                          <div className={`mb-2 ${selectedFormat === option.value ? 'text-primary' : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'}`}>
                            {option.icon}
                          </div>
                          <div className={`font-medium text-sm ${selectedFormat === option.value ? 'text-primary' : 'text-neutral-900 dark:text-neutral-100'}`}>
                            {option.label}
                          </div>
                          <div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1">
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-3">参考文献格式</label>
                    <select
                      value={selectedCitationStyle}
                      onChange={(e) => setSelectedCitationStyle(e.target.value as CitationStyle)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white dark:bg-neutral-800"
                    >
                      {CITATION_STYLES.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label} - {style.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          导出中...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          导出
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
