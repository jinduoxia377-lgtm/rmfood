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
    // 后端批量分析返回扁平结构：分子量等字段在顶层，而非仅嵌套在 result 内
    molecular_weight?: number;
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
    page?: number;
    page_size?: number;
  }): Promise<{
    total: number;
    page: number;
    page_size: number;
    peptides: DatabasePeptide[];
    activity_distribution: Record<string, number>;
    food_source_distribution: Record<string, number>;
  }> {
const response = await request.get(`${this.baseUrl}/database/search`, { params });

    const data = response.data;
    // 后端返回 { success, total, page, page_size, peptides }
    // 前端期望 { total, page, page_size, peptides, activity_distribution, food_source_distribution }
    return {
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      peptides: data.peptides || [],
      activity_distribution: {},
      food_source_distribution: {},
    };
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
    const data = response.data;
    // 后端返回 { success, statistics: { total_peptides, activities, food_sources } }
    // 前端期望 { total_peptides, activities, food_sources }
    return data.statistics || {};
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

  // ─── 高级分析（PepINVENT） ──────────────────────────────────

  /**
   * 深度分析（含二级结构预测、理化性质剖面、毒性模式等）
   */
  async deepAnalyze(sequence: string): Promise<{
    success: boolean;
    data: {
      sequence: string;
      basic_properties: Record<string, any>;
      secondary_structure: { predicted_sequence: string; percentages: Record<string, number> };
      physicochemical_profile: Record<string, any>;
      bioactivity_predictions: Record<string, any>;
      safety_assessment: Record<string, any>;
      overall_scores: Record<string, number>;
    };
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/analyze/deep', { sequence });
    return response.data;
  }

  /**
   * 批量深度分析
   */
  async batchDeepAnalyze(sequences: string[], maxConcurrent = 5): Promise<{
    task_id: string;
    status_url: string;
    message: string;
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/analyze/batch', {
      sequences,
      max_concurrent: maxConcurrent,
    });
    return response.data;
  }

  /**
   * 查询批量分析任务状态
   */
  async getBatchTaskStatus(taskId: string): Promise<{
    task_id: string;
    status: 'processing' | 'completed' | 'failed';
    total: number;
    completed: number;
    results?: Array<{
      sequence: string;
      basic_properties: Record<string, any>;
      secondary_structure: Record<string, any>;
      overall_scores: Record<string, number>;
      bioactivity_summary: Record<string, number>;
    }>;
    error?: string;
  }> {
    const response = await request.get(`/api/v1/ai/peptide/advanced/tasks/${taskId}`);
    return response.data;
  }

  /**
   * Pareto 多目标优化
   */
  async paretoOptimize(sequences: string[], objectives: string[], weights?: Record<string, number>): Promise<{
    success: boolean;
    data: {
      total_processed: number;
      pareto_frontier_size: number;
      pareto_points: Array<{ sequence: string; objectives: Record<string, number>; rank: number }>;
      diversity_metrics: Record<string, number>;
    };
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/optimize/pareto', {
      sequences, objectives, weights,
    });
    return response.data;
  }

  /**
   * 肽-药材协同分析
   */
  async synergyAnalysis(peptideSequences: string[], herbNames: string[]): Promise<{
    success: boolean;
    data: {
      synergies: Array<{ peptide: string; herb: string; synergy_score: number; mechanism: string }>;
      ranked_herbs: Array<{ name: string; score: number; reason: string }>;
    };
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/analyze/synergy', {
      peptide_sequences: peptideSequences,
      herb_names: herbNames,
    });
    return response.data;
  }

  /**
   * 溶解度预测（pH-温度依赖）
   */
  async predictSolubility(sequences: string[], phMin = 2, phMax = 10, temperature = 25): Promise<{
    success: boolean;
    data: {
      sequences_analyzed: number;
      predictions: Array<{
        sequence: string;
        ph_solubility: Array<{ ph: number; logS: number }>;
        best_ph: number;
        solubility_class: string;
        isoelectric_point: number;
      }>;
    };
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/predict/solubility', {
      sequences, ph_range_min: phMin, ph_range_max: phMax, temperature_celsius: temperature,
    });
    return response.data;
  }

  /**
   * 生成结构变体
   */
  async generateVariants(template: string, variantType = 'point', numVariants = 20): Promise<{
    success: boolean;
    data: {
      template: string;
      variant_type: string;
      total_generated: number;
      variants: Array<{
        sequence: string;
        edit_distance: number;
        similarity: number;
        molecular_weight: number;
        properties_changed: Record<string, string>;
      }>;
    };
  }> {
    const response = await request.post('/api/v1/ai/peptide/advanced/generate/variants', {
      template_sequence: template, variant_type: variantType, num_variants: numVariants,
    });
    return response.data;
  }

  /**
   * 水解模拟（后端读取查询参数，非 JSON body）
   */
  async simulateHydrolysis(sequence: string, enzymes = 'Pepsin,Trypsin'): Promise<
    Array<{ sequence: string; position: number; enzyme: string; bond_type: string; cleavage_site: string }>
  > {
    const params = new URLSearchParams({ sequence, enzymes });
    const response = await request.post(`/api/v1/peptide-structure/hydrolysis/simulate?${params}`);
    return response.data;
  }

  /**
   * 两序列比对（Needleman-Wunsch，后端读取查询参数）
   */
  async alignSequences(seq1: string, seq2: string, matrix = 'BLOSUM62'): Promise<{
    query_sequence: string;
    subject_sequence: string;
    alignment: string;
    match_line: string;
    identity: number;
    similarity: number;
    gaps: number;
    score: number;
    start_pos: number;
    end_pos: number;
  }> {
    const params = new URLSearchParams({ sequences: `${seq1},${seq2}`, matrix });
    const response = await request.post(`/api/v1/peptide-structure/evolution/align?${params}`);
    return response.data;
  }

  /**
   * 定量活性预测（后端读取查询参数，同步方法）
   */
  async predictQuantitative(sequence: string, model = 'QSAR'): Promise<{
    sequence: string;
    model: string;
    ace_inhibition: {
      sequence: string;
      predicted_ic50: number;
      ic50_unit: string;
      confidence_interval: { lower: number; upper: number };
      features: Record<string, number>;
    };
    antioxidant: {
      sequence: string;
      predicted_activity: number;
      activity_unit: string;
      confidence_interval: { lower: number; upper: number };
    };
  }> {
    const params = new URLSearchParams({ sequence, model });
    const response = await request.post(`/api/v1/peptide-structure/quantitative/predict?${params}`);
    return response.data;
  }
}

// ─── 单例导出 ────────────────────────────────────────────────

export const peptideStructureService = new PeptideStructureService();



