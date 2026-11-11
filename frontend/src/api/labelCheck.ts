/**
 * 配料表核查 API 客户端 — v2
 *
 * 字段与 `docs/label-check-v2-contract.md` 逐字对齐（唯一契约源）。
 * v2 在 v1 基础上「只增不改」：新增字段一律可选（`?`），读取处用 `??` 兜底，
 * 避免后端 v1 未就绪 / 字段漂移导致整页空白（历史 P0）。
 *
 * 🔒 走平台共享 axios 客户端（`@/api/client`）：自动注入 X-CSRF-Token + withCredentials，
 * 与全站其它 API 一致。此前的裸 fetch 不带 CSRF 头也不带 cookie，
 * 在真实浏览器里所有 POST 都会被后端 CSRF 中间件 403 拦截（端到端验证发现）。
 */
import api from '@/api/client';

/** 单条成分核查结果 */
export interface LabelIngredient {
  // ── v1 已有 ──
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

  // ── v2 新增（可选兜底） ──
  raw_name?: string;
  match_confidence?: number;
  match_method?: 'exact' | 'alias' | 'fuzzy' | 'none';
  aliases?: string[];
  risk_contribution?: number;
  is_compound?: boolean;
  sub_ingredients?: string[];
  /** v2 人群禁忌/安全提示（如白果「儿童慎用」、当归「孕妇慎用」、西红花「孕妇禁用」） */
  caution?: string;
}

/** 核查结果统计（v2 新增） */
export interface LabelCheckStats {
  total: number;
  matched: number;
  unmatched: number;
  allergen_count: number;
  compound_expanded: number;
}

/** 整体核查结果 */
export interface LabelCheckResult {
  // ── v1 已有 ──
  report_id: string;
  summary: string;
  ingredients: LabelIngredient[];
  category_counts: Record<string, number>;
  unknown_count: number;
  warning_count: number;
  allergen_ingredients: Array<{ name: string; group: string }>;
  disclaimer: string;

  // ── v2 新增（可选兜底） ──
  /**
   * 0-100 整数「目录比对提示分」（非安全评分，仅内部参考；禁用项一票置顶）。
   * 🔴 UI 不得称「安全评分」、不得展示「低/中/高风险」等定级措辞（契约 v2.1 红线修正）。
   */
  risk_score?: number;
  /** 需人工核实项数（unknown + note 级），UI 主展示此中性指标 */
  needs_review_count?: number;
  parse_warnings?: string[];
  stats?: LabelCheckStats;
}

/** 匹配方式 */
export type MatchMethod = 'exact' | 'alias' | 'fuzzy' | 'none';

/** 示例配料表模板（GET /templates） */
export interface LabelCheckTemplate {
  id: string;
  name: string;
  description: string;
  text: string;
  tag: string;
}

/** 内置目录规模统计（GET /directory-stats） */
export interface DirectoryStats {
  food_homology: number;
  new_food: number;
  additives: number;
  enrichers: number;
  prohibited: number;
  common_food: number;
  allergen_groups: number;
}

// 共享 axios 客户端的 baseURL 已是 `/api/v1`，故此处用相对路径 `/label-check`。
export const labelCheckApi = {
  /** 文本核查：提交配料表文本（OCR 或粘贴） */
  async checkText(text: string): Promise<{ success: boolean; data: LabelCheckResult }> {
    const r = await api.post<{ success: boolean; data: LabelCheckResult }>('/label-check', { text });
    return r.data;
  },

  /** 图片 OCR 核查：上传配料表图片，OCR 识别后返回核查报告 */
  async checkOcr(file: File): Promise<{
    success: boolean;
    ocr_text?: string;
    data?: LabelCheckResult;
    message?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const r = await api.post<{
      success: boolean;
      ocr_text?: string;
      data?: LabelCheckResult;
      message?: string;
    }>('/label-check/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  /** 成分列表核查 */
  async checkIngredients(
    ingredients: string[],
  ): Promise<{ success: boolean; data: LabelCheckResult }> {
    const r = await api.post<{ success: boolean; data: LabelCheckResult }>(
      '/label-check/ingredients',
      { ingredients },
    );
    return r.data;
  },

  /** v2 新增：示例配料表模板 */
  async getTemplates(): Promise<{ templates: LabelCheckTemplate[] }> {
    const r = await api.get<{ templates: LabelCheckTemplate[] }>('/label-check/templates');
    return r.data;
  },

  /** v2 新增：内置目录规模统计 */
  async getDirectoryStats(): Promise<DirectoryStats> {
    const r = await api.get<DirectoryStats>('/label-check/directory-stats');
    return r.data;
  },

  /** 健康检查 */
  async health(): Promise<{ status: string; service: string }> {
    const r = await api.get<{ status: string; service: string }>('/label-check/health');
    return r.data;
  },
};
