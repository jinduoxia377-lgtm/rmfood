/**
 * 报告导出 API 客户端
 */

export interface ExportOptions {
  format: 'docx' | 'pdf' | 'markdown';
  formula_name: string;
  ingredients: Array<{ name: string; dosage_mg: number }>;
  target_effects: string[];
  optimization_constraints?: Record<string, unknown>;
}

export interface ExportResponse {
  success: boolean;
  data?: {
    markdown?: string;
    formula_name?: string;
  };
  url?: string;
  filename?: string;
}

const BASE_URL = '/api/v1/reports';

export const reportExportApi = {
  /** 导出为 DOCX */
  exportDocx(opts: ExportOptions): Promise<{ url: string; filename: string }> {
    const params = new URLSearchParams({
      formula_name: opts.formula_name,
      ingredients: JSON.stringify(opts.ingredients),
      target_effects: JSON.stringify(opts.target_effects),
    });
    if (opts.optimization_constraints) {
      params.append('optimization_constraints', JSON.stringify(opts.optimization_constraints));
    }
    return fetch(`${BASE_URL}/explainability/docx?${params}`, {
      method: 'POST',
      headers: { 'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    }).then(r => {
      if (!r.ok) throw new Error(`导出失败: ${r.status}`);
      const filename = r.headers.get('content-disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `${opts.formula_name}.docx`;
      return { url: `/api/v1/reports/explainability/docx?${params}`, filename };
    });
  },

  /** 导出为 PDF */
  exportPdf(opts: ExportOptions): Promise<{ url: string; filename: string }> {
    const params = new URLSearchParams({
      formula_name: opts.formula_name,
      ingredients: JSON.stringify(opts.ingredients),
      target_effects: JSON.stringify(opts.target_effects),
    });
    if (opts.optimization_constraints) {
      params.append('optimization_constraints', JSON.stringify(opts.optimization_constraints));
    }
    return fetch(`${BASE_URL}/explainability/pdf?${params}`, {
      method: 'POST',
      headers: { 'Accept': 'application/pdf' },
    }).then(r => {
      if (!r.ok) throw new Error(`导出失败: ${r.status}`);
      const filename = r.headers.get('content-disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `${opts.formula_name}.pdf`;
      return { url: `/api/v1/reports/explainability/pdf?${params}`, filename };
    });
  },

  /** 导出为 Markdown（直接获取内容） */
  exportMarkdown(opts: ExportOptions): Promise<ExportResponse> {
    const params = new URLSearchParams({
      formula_name: opts.formula_name,
      ingredients: JSON.stringify(opts.ingredients),
      target_effects: JSON.stringify(opts.target_effects),
    });
    if (opts.optimization_constraints) {
      params.append('optimization_constraints', JSON.stringify(opts.optimization_constraints));
    }
    return fetch(`${BASE_URL}/explainability/markdown?${params}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    }).then(r => r.json());
  },

  /** 获取可用报告模板 */
  listTemplates(): Promise<{ success: boolean; templates: Array<{ id: string; name: string; format: string }> }> {
    return fetch(`${BASE_URL}/templates`).then(r => r.json());
  },
};

/**
 * 报告下载 Hook
 */
import { useState, useCallback } from 'react';

export function useReportExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportReport = useCallback(async (
    opts: ExportOptions,
    format: 'docx' | 'pdf' | 'markdown' = 'docx',
  ) => {
    setExporting(true);
    setError(null);
    try {
      if (format === 'markdown') {
        return await reportExportApi.exportMarkdown(opts);
      } else if (format === 'pdf') {
        return await reportExportApi.exportPdf(opts);
      } else {
        return await reportExportApi.exportDocx(opts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportReport, exporting, error };
}
