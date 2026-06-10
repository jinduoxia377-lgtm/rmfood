/**
 * Stability Types - 稳定性评估数据模型
 *
 * 用于化学稳定性、物理稳定性和保质期预测的数据结构定义
 * 基于 Arrhenius 方程和 Q10 法则的货架寿命预测模型
 */

export interface StabilityDataPoint {
  /** 时间点 (天/月/年) */
  time: number
  /** 时间单位 */
  timeUnit: 'day' | 'month' | 'year'
  /** 有效成分含量 (%) */
  potency: number
  /** 杂质含量 (ppm) */
  impurities: number
  /** pH 值 */
  ph?: number
  /** 水分含量 (%) */
  moisture?: number
}

/** 储存条件配置 */
export interface StorageCondition {
  temperature: number
  humidity: number
  lightExposure: 'dark' | 'ambient' | 'bright'
  packaging: 'sealed' | 'semi-permeable' | 'open'
}

/** 稳定性评估结果 */
export interface StabilityAssessment {
  /** 综合稳定性评分 (0-100) */
  score: number
  /** 预测保质期 (天) */
  shelfLifeDays: number
  /** 主要降解途径 */
  degradationPathway: string[]
  /** 关键影响因素 */
  criticalFactors: string[]
  /** 储存建议 */
  storageRecommendations: string[]
  /** 时间序列数据 */
  timeSeriesData: StabilityDataPoint[]
  /** 各因素贡献分析 */
  factorContributions: FactorContribution[]
}

/** 因素贡献度 */
export interface FactorContribution {
  factor: string
  impact: number
  description: string
}

/** Arrhenius 参数 */
export interface ArrheniusParams {
  /** 频率因子 (s^-1) */
  A: number
  /** 活化能 (J/mol) */
  Ea: number
  /** 气体常数 (8.314 J/(mol·K)) */
  R?: number
}

// const DEFAULT_ARRHENIUS_PARAMS: Required<ArrheniusParams> = {
//   A: 1e10,
//   Ea: 75000,
//   R: 8.314
// }
