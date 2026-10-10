/**
 * 报告导出组件
 *
 * 提供报告格式选择和一键下载功能
 */
'use client';

import React from 'react';
import { useReportExport, type ExportOptions } from '@/api/reportExport';
import { type ExplainabilityResult } from '@/api/explainability';
import { logger } from '@/utils/safeLogger';
import { BarChart3, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  report: ExplainabilityResult;
  formulaName: string;
  ingredients: Array<{ name: string; dosage_mg: number }>;
  targetEffects: string[];
}

type Format = 'docx' | 'pdf' | 'markdown';

const FORMAT_CONFIG: Record<Format, { label: string; icon: string; desc: string }> = {
  docx: { label: 'Word 文档', icon: '', desc: '可编辑的 Word 格式' },
  pdf: { label: 'PDF 文档', icon: '', desc: '标准 PDF 格式' },
  markdown: { label: 'Markdown', icon: '', desc: '源代码格式' },
};

export function ReportExportPanel({ report, formulaName, ingredients, targetEffects }: Props) {
  const { exportReport, exporting, error } = useReportExport();
  const [selectedFormat, setSelectedFormat] = React.useState<Format>('docx');
  const [exportedUrl, setExportedUrl] = React.useState<string | null>(null);

  const handleExport = async () => {
    try {
      const result = await exportReport({
        formula_name: formulaName,
        ingredients,
        target_effects: targetEffects,
        format: selectedFormat,
      }, selectedFormat);

      if (selectedFormat === 'markdown') {
        // Markdown 直接返回内容，保存到剪贴板
        const result = await exportReport({
          formula_name: formulaName,
          ingredients,
          target_effects: targetEffects,
          format: selectedFormat,
        }, selectedFormat) as { data?: { markdown?: string } };
        if (result.data?.markdown) {
          await navigator.clipboard.writeText(result.data.markdown);
          alert('Markdown 内容已复制到剪贴板');
        }
      } else {
        const result = await exportReport({
          formula_name: formulaName,
          ingredients,
          target_effects: targetEffects,
          format: selectedFormat,
        }, selectedFormat) as { url: string; filename: string };
        if (result.url) setExportedUrl(result.url);
      }
    } catch (err) {
      logger.error('报告导出失败:', err);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 bg-white dark:bg-neutral-800">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={28} className="text-accent-600" />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">导出报告</h3>
      </div>

      {/* 格式选择 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(Object.keys(FORMAT_CONFIG) as Format[]).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setSelectedFormat(fmt)}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              selectedFormat === fmt
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-300/20'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-accent-300'
            }`}
          >
            <div className="text-2xl mb-1">{FORMAT_CONFIG[fmt].icon}</div>
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {FORMAT_CONFIG[fmt].label}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {FORMAT_CONFIG[fmt].desc}
            </div>
          </button>
        ))}
      </div>

      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full py-3 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-600 text-white font-medium transition-colors disabled:cursor-not-allowed"
      >
        {exporting ? (<><Clock size={14} className='animate-spin' /> 生成中...</>) : `导出 ${FORMAT_CONFIG[selectedFormat].label}`}
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-error-50 dark:bg-error-300/20 border border-error-200 dark:border-error-800 text-sm text-error-600 dark:text-error-700">
          {error}
        </div>
      )}

      {/* 导出结果 */}
      {exportedUrl && (
        <a
          href={exportedUrl}
          download
          className="mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-success-300 dark:border-success-700 text-success-700 dark:text-success-700 font-medium hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
        >
          <CheckCircle2 size={14} className="text-success-500" /> 下载报告
        </a>
      )}
    </div>
  );
}
