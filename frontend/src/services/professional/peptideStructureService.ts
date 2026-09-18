/**
 * RMFOODFP 肽链结构分析 - TypeScript 类型定义和服务
 * 使用项目统一的 axios 客户端（自动处理 CSRF）
 */
import api from '@/api/client';

export interface SequenceToSmilesRequest {
  /** 肽序列 */
  sequence: string;
  /** N端修饰（如 "ACT" 乙酰化）*/
  n_terminal?: string;
  /** C端修饰（如 "AMD" 酰胺化）*/
  c_terminal?: string;
  /** 非天然氨基酸列表 */
  unusual_aaminos?: Array<{
    position: number;
    name: string;
  }>;
  /** 链内键列表 */
  intrachain_bonds?: Array<{
    type: string;
    residues: string[];
  }>;
  /** 输出格式: "smiles" 或 "selfies" */
  output_format?: string;
}

export interface SMILESResult {
  success: boolean;
  sequence: string;
  smiles?: string;
  selfies?: string;
  error_message?: string;
}

export interface SequenceResult {
  success: boolean;
  sequence?: string;
  is_cyclic: boolean;
  cyclization?: string;
  unsupported_reason?: string;
}

export interface PeptideAnalysisResult {
  sequence: string;
  smiles?: string;
  selfies?: string;
  molecular_weight: number;
  isoelectric_point: number;
  hydrophobicity: number;
  ace_inhibition: {
    score: number;
    level: string;
  };
  antioxidant: {
    score: number;
    level: string;
  };
  antimicrobial: {
    score: number;
    level: string;
  };
  safety: {
    food_score: number;
    is_allergen: boolean;
    is_toxic: boolean;
    digestibility: string;
  };
  taste: {
    bitterness: number;
    umami: number;
  };
  source: {
    food?: string;
    database?: string;
    references: string[];
  };
  analysis_time: string;
}

export interface SupportedAA {
  [key: string]: string;  // {名称: SMILES}
}

/**
 * 肽链结构分析 API 服务
 */
export class PeptideStructureService {
  /**
   * 序列转 SMILES
   */
  async sequenceToSmiles(req: SequenceToSmilesRequest): Promise<SMILESResult> {
    const response = await api.post<SMILESResult>('/peptide-structure/sequence-to-smiles', req);
    return response.data;
  }

  /**
   * SMILES 转序列
   */
  async smilesToSequence(smiles: string, formatType: string = 'smiles'): Promise<SequenceResult> {
    const response = await api.post<SequenceResult>('/peptide-structure/smiles-to-sequence', {
      smiles,
      format_type: formatType,
    });
    return response.data;
  }

  /**
   * 获取支持的非天然氨基酸列表
   */
  async getSupportedAAs(): Promise<{ count: number; amino_acids: SupportedAA }> {
    const response = await api.get<{ count: number; amino_acids: SupportedAA }>('/peptide-structure/supported-aas');
    return response.data;
  }

  /**
   * 食品肽完整分析
   */
  async analyzePeptide(sequence: string): Promise<PeptideAnalysisResult> {
    const response = await api.post<PeptideAnalysisResult>('/peptide-structure/analyze', {
      sequence,
    });
    return response.data;
  }

  /**
   * 注册自定义非天然氨基酸
   */
  async registerCustomAA(name: string, smiles: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/peptide-structure/register-custom-aa',
      { name, smiles }
    );
    return response.data;
  }
}

// 导出单例
export const peptideStructureService = new PeptideStructureService();
