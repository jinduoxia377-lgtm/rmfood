/**
 * 食源性多肽COA（Certificate of Analysis）前端服务
 */
import api from '@/api/client';
import type { PaginatedResponse } from '@/types';

// ─── 类型定义 ───────────────────────────────────────────────

export interface COATestItem {
  id?: number;
  category: 'sensory' | 'chemical' | 'microbial' | 'packaging';
  item_name: string;
  item_name_en?: string;
  standard: string;
  result?: string;
  unit?: string;
  judgment?: '符合' | '不符合' | '待判定';
  remark?: string;
  sort_order: number;
}

export interface PeptideBatchCOA {
  id: number;
  peptide_id?: number;
  product_name_cn: string;
  product_name_en?: string;
  product_type: string;
  product_code?: string;
  spec?: string;
  batch_no: string;
  mfg_date?: string;
  expiry_date?: string;
  production_line?: string;
  gb_standard?: string;
  enterprise_standard?: string;
  inspection_basis?: string;
  test_conclusion: '合格' | '不合格' | '待检';
  qualified: boolean;
  coa_pdf_url?: string;
  coa_word_url?: string;
  test_report_image_url?: string;
  tested_by?: string;
  checked_by?: string;
  approved_by?: string;
  supplier_name?: string;
  supplier_batch_ref?: string;
  test_items?: COATestItem[];
  latest_item_judgment?: string;
  created_at: string;
  updated_at: string;
}

export interface COAListResponse {
  items: PeptideBatchCOA[];
  total: number;
  page: number;
  page_size: number;
}

export interface COAStats {
  total: number;
  qualified: number;
  unqualified: number;
  pending: number;
  peptide_types: number;
  total_batches: number;
  qualified_rate: number;
}

// ─── API Service ────────────────────────────────────────────

const PREFIX = '/api/v1/coa';

export const coaService = {
  async create(data: Partial<PeptideBatchCOA> & { test_items?: COATestItem[] }) {
    const resp = await api.post(PREFIX, data);
    return resp.data;
  },

  async list(params?: {
    page?: number;
    page_size?: number;
    peptide_id?: number;
    batch_no?: string;
    product_name_cn?: string;
    gb_standard?: string;
    test_conclusion?: string;
    qualified?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) {
    const resp = await api.get<PaginatedResponse<PeptideBatchCOA>>(PREFIX, { params });
    return resp.data;
  },

  async get(coaId: number) {
    const resp = await api.get(`${PREFIX}/${coaId}`);
    return resp.data;
  },

  async update(coaId: number, data: Partial<PeptideBatchCOA>) {
    const resp = await api.put(`${PREFIX}/${coaId}`, data);
    return resp.data;
  },

  async updateTestItems(coaId: number, items: COATestItem[]) {
    const resp = await api.put(`${PREFIX}/${coaId}/test-items`, items);
    return resp.data;
  },

  async delete(coaId: number) {
    const resp = await api.delete(`${PREFIX}/${coaId}`);
    return resp.data;
  },

  async getByPeptide(peptideId: number) {
    const resp = await api.get(`${PREFIX}/by-peptide/${peptideId}`);
    return resp.data;
  },

  async getByBatchNo(batchNo: string) {
    const resp = await api.get(`${PREFIX}/by-batch/${batchNo}`);
    return resp.data;
  },

  async batchImport(data: Partial<PeptideBatchCOA>[]) {
    const resp = await api.post(`${PREFIX}/batch/import`, data);
    return resp.data;
  },

  async getStats() {
    const resp = await api.get(`${PREFIX}/stats/summary`);
    return resp.data;
  },

  /** 生成并下载 Word 文档 */
  async generateWord(coaId: number): Promise<Blob> {
    const resp = await api.get(`${PREFIX}/${coaId}/download/word`, { responseType: 'blob' });
    return resp.data as Blob;
  },

  /** 生成并下载 PDF 文档 */
  async generatePdf(coaId: number): Promise<Blob> {
    const resp = await api.get(`${PREFIX}/${coaId}/download/pdf`, { responseType: 'blob' });
    return resp.data as Blob;
  },
};

// ─── 工具函数 ───────────────────────────────────────────────

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    sensory: '感官要求',
    chemical: '理化指标',
    microbial: '微生物指标',
    packaging: '包装标签',
  };
  return labels[category] || category;
}

export function isCOAQualified(coa: PeptideBatchCOA): boolean {
  return coa.qualified && coa.test_conclusion === '合格';
}

export function calcQualifiedRate(stats: COAStats): string {
  if (stats.total === 0) return '0%';
  return `${((stats.qualified / stats.total) * 100).toFixed(1)}%`;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export function groupTestItemsByCategory(
  items?: COATestItem[]
): Record<string, COATestItem[]> {
  const groups: Record<string, COATestItem[]> = {};
  const categories: Array<'sensory' | 'chemical' | 'microbial' | 'packaging'> =
    ['sensory', 'chemical', 'microbial', 'packaging'];
  for (const cat of categories) {
    groups[cat] = items?.filter(item => item.category === cat) || [];
  }
  return groups;
}
