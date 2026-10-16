/**
 * 配料表核查 API 客户端
 */

export interface LabelIngredient {
  name: string;
  category: string;
  category_label: string;
  level: 'info' | 'note' | 'warning';
  message: string;
  allergen: boolean;
  allergen_group?: string;
  max_dosage_mg_per_day?: number;
  function?: string;
  max_usage?: string;
  source?: string;
}

export interface LabelCheckResult {
  report_id: string;
  summary: string;
  ingredients: LabelIngredient[];
  category_counts: Record<string, number>;
  unknown_count: number;
  warning_count: number;
  allergen_ingredients: Array<{ name: string; group: string }>;
  disclaimer: string;
}

const BASE = '/api/v1/label-check';

export const labelCheckApi = {
  /** 文本核查：提交配料表文本（OCR 或粘贴） */
  checkText(text: string): Promise<{ success: boolean; data: LabelCheckResult }> {
    return fetch(`${BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(r => r.json());
  },

  /** 图片 OCR 核查：上传配料表图片，OCR 识别后返回核查报告 */
  checkOcr(file: File): Promise<{
    success: boolean;
    ocr_text?: string;
    data?: LabelCheckResult;
    message?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/ocr`, {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },

  /** 成分列表核查 */
  checkIngredients(
    ingredients: string[],
  ): Promise<{ success: boolean; data: LabelCheckResult }> {
    return fetch(`${BASE}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients }),
    }).then(r => r.json());
  },

  /** 健康检查 */
  health(): Promise<{ status: string; service: string }> {
    return fetch(`${BASE}/health`).then(r => r.json());
  },
};