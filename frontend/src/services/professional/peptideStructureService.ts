/**
 * 肽链结构分析 API 服务
 * 支持：完整分析、结构转换、历史记录、数据库查询、对比分析
 */

import { request } from '@/utils/request';

// ─── 类型定义 ───────────────────────────────────────────────

export interface PeptideAnalysisResult {
  sequence: string;
  smiles?: string;
  selfies?: string;
  molecular_weight: number;
  isoelectric_point: number;
  hydrophobicity: number;
  ace_inhibition: ActivityScore;
  antioxidant: ActivityScore;
  antimicrobial: ActivityScore;
  safety: SafetyInfo;
  taste: TasteInfo;
  source: SourceInfo;
  analysis_time: string;
  method?: string;
}

export interface ActivityScore {
  score: number;
  level: 'high' | 'medium' | 'low' | 'none';
  details?: Record<string, any>;
}

export interface SafetyInfo {
  food_score: number;
  is_allergen: boolean;
  is_toxic: boolean;
  digestibility: string;
}

export interface TasteInfo {
  bitterness: number;
  umami: number;
}

export interface SourceInfo {
  food?: string;
  database?: string;
  references: string[];
}

export interface BatchAnalyzeResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    sequence: string;
    success: boolean;
    result?: PeptideAnalysisResult;
    error?: string;
  }>;
}

export interface HistoryRecord {
  id: number;
  sequence: string;
  molecular_weight: number;
  food_safety_score: number;
  ace_inhibition_score: number;
  antioxidant_score: number;
  antimicrobial_score: number;
  is_allergen: boolean;
  is_toxic: boolean;
  digestibility: string;
  created_at: string;
}

export interface HistoryStatistics {
  total_analyses: number;
  avg_food_score: number;
  avg_molecular_weight: number;
  avg_ace_inhibition: number;
  avg_antioxidant: number;
  avg_antimicrobial: number;
  allergen_count: number;
  toxic_count: number;
  latest_analysis: string;
  score_distribution: Array<{ bin: number; count: number }>;
}

export interface DatabasePeptide {
  sequence: string;
  source_protein?: string;
  source_organism?: string;
  activity_type?: string;
  activity_value?: number;
  activity_unit?: string;
  molecular_weight?: number;
  hydrolysis_enzyme?: string;
  database_id?: string;
  literature_doi?: string;
  food_source?: string;
  source_database: string;
}

// ─── 服务类 ─────────────────────────────────────────────────

export class PeptideStructureService {
  private baseUrl = '/api/v1/peptide-structure';
  private initialized = false;

  // 初始化 CSRF Token
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const response = await request.get('/csrf-token');
      this.initialized = true;
    } catch (error) {
      console.warn('CSRF token initialization failed:', error);
    }
  }

  // ─── 序列转换 ──────────────────────────────────────────────

  /**
   * 序列转 SMILES
   */
  async sequenceToSmiles(params: {
    sequence: string;
    n_terminal?: string;
    c_terminal?: string;
    unusual_aaminos?: Array<{ position: number; name: string }>;
    intrachain_bonds?: Array<{ type: string; residues: string[] }>;
    output_format?: 'smiles' | 'selfies';
  }): Promise<{
    success: boolean;
    sequence: string;
    smiles?: string;
    selfies?: string;
    molecular_weight?: number;
  }> {
    const response = await request.post(`${this.baseUrl}/sequence-to-smiles`, params);
    return response.data;
  }

  /**
   * SMILES 转序列
   */
  async smilesToSequence(params: {
    smiles: string;
    format_type?: 'smiles' | 'selfies';
  }): Promise<{
    success: boolean;
    sequence?: string;
    is_cyclic?: boolean;
    cyclization?: string;
  }> {
    const response = await request.post(`${this.baseUrl}/smiles-to-sequence`, params);
    return response.data;
  }

  // ─── 活性预测 ──────────────────────────────────────────────

  /**
   * 单序列完整分析
   */
  async analyzePeptide(sequence: string, options?: {
    n_terminal?: string;
    c_terminal?: string;
    unusual_aaminos?: Array<{ position: number; name: string }>;
  }): Promise<PeptideAnalysisResult> {
    const response = await request.post(`${this.baseUrl}/analyze`, {
      sequence: sequence.toUpperCase(),
      ...options,
    });
    return response.data;
  }

  /**
   * 批量分析（最多50条）
   */
  async batchAnalyze(sequences: string[]): Promise<BatchAnalyzeResult> {
    const response = await request.post(`${this.baseUrl}/batch-analyze`, {
      sequences: sequences.map(s => s.toUpperCase()),
    });
    return response.data;
  }

  // ─── 历史记录 ──────────────────────────────────────────────

  /**
   * 查询历史记录
   */
  async getHistory(params?: {
    page?: number;
    page_size?: number;
    sequence?: string;
    min_score?: number;
    max_score?: number;
    is_allergen?: boolean;
    is_toxic?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<{
    total: number;
    page: number;
    page_size: number;
    items: HistoryRecord[];
  }> {
    const response = await request.get(`${this.baseUrl}/history`, { params });
    return response.data;
  }

  /**
   * 获取统计信息
   */
  async getHistoryStatistics(): Promise<HistoryStatistics> {
    const response = await request.get(`${this.baseUrl}/history/statistics`);
    return response.data;
  }

  /**
   * 删除历史记录
   */
  async deleteHistory(id: number): Promise<{ success: boolean; message: string }> {
    const response = await request.delete(`${this.baseUrl}/history/${id}`);
    return response.data;
  }

  // ─── 数据库查询 ────────────────────────────────────────────

  /**
   * 搜索食品肽数据库
   */
  async searchDatabase(params: {
    sequence?: string;
    activity_type?: string;
    min_value?: number;
    max_value?: number;
    food_source?: string;
  }): Promise<{
    total: number;
    peptides: DatabasePeptide[];
    activity_distribution: Record<string, number>;
    food_source_distribution: Record<string, number>;
  }> {
    const response = await request.get(`${this.baseUrl}/database/search`, { params });
    return response.data;
  }

  /**
   * 获取数据库统计
   */
  async getDatabaseStatistics(): Promise<{
    total_peptides: number;
    activities: Record<string, number>;
    food_sources: Record<string, number>;
  }> {
    const response = await request.get(`${this.baseUrl}/database/statistics`);
    return response.data;
  }

  // ─── 模型状态 ──────────────────────────────────────────────

  /**
   * 获取 ML 模型状态
   */
  async getModelStatus(): Promise<{
    peptide_ranker: { available: boolean; method: string; training_samples: number };
    bpfun: { available: boolean; method: string; training_samples: number };
    antioxidant: { available: boolean; method: string };
    safety: { available: boolean; method: string };
  }> {
    const response = await request.get(`${this.baseUrl}/model-status`);
    return response.data;
  }

  // ─── 氨基酸信息 ────────────────────────────────────────────

  /**
   * 获取支持的非天然氨基酸列表
   */
  async getSupportedAAs(): Promise<{
    count: number;
    amino_acids: Array<{
      three_letter: string;
      one_letter: string;
      name: string;
      smiles: string;
      molecular_weight: number;
    }>;
  }> {
    const response = await request.get(`${this.baseUrl}/supported-aas`);
    return response.data;
  }

  /**
   * 注册自定义氨基酸
   */
  async registerCustomAA(params: {
    name: string;
    smiles: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await request.post(`${this.baseUrl}/register-custom-aa`, params);
    return response.data;
  }

  // ─── 对比分析 ──────────────────────────────────────────────

  /**
   * 对比多个序列的分析结果
   */
  async compareSequences(sequences: string[]): Promise<{
    comparison: Array<{
      sequence: string;
      molecular_weight: number;
      food_safety_score: number;
      ace_inhibition: number;
      antioxidant: number;
      antimicrobial: number;
      is_allergen: boolean;
      is_toxic: boolean;
    }>;
    best_sequence: string;
    ranking: string[];
  }> {
    const results = await Promise.all(
      sequences.map(seq => this.analyzePeptide(seq))
    );
    
    // 计算排名
    const scoredResults = results.map(r => ({
      sequence: r.sequence,
      score: r.safety.food_score,
      ace: r.ace_inhibition.score,
      antiox: r.antioxidant.score,
      amp: r.antimicrobial.score,
    }));
    
    // 按综合评分排序
    scoredResults.sort((a, b) => b.score - a.score);
    
    return {
      comparison: scoredResults.map(r => ({
        sequence: r.sequence,
        molecular_weight: results.find(x => x.sequence === r.sequence)?.molecular_weight || 0,
        food_safety_score: r.score,
        ace_inhibition: r.ace,
        antioxidant: r.antiox,
        antimicrobial: r.amp,
        is_allergen: results.find(x => x.sequence === r.sequence)?.safety.is_allergen || false,
        is_toxic: results.find(x => x.sequence === r.sequence)?.safety.is_toxic || false,
      })),
      best_sequence: scoredResults[0]?.sequence || '',
      ranking: scoredResults.map(r => r.sequence),
    };
  }
}

// ─── 单例导出 ────────────────────────────────────────────────

export const peptideStructureService = new PeptideStructureService();
