/**
 * Message Types - AI 对话消息类型定义 (v1.0)
 *
 * 定义了多种消息类型，用于不同分析结果的展示：
 * - 成分分析结果消息
 * - 多肽分析结果消息
 * - 配伍检测结果消息
 * - 配方推荐结果消息
 * - 安全性检测结果消息
 * - 协同作用分析结果消息
 *
 * @version 1.0.0
 * @created 2026-05-17
 * @author RMFOOD AI Team
 */

import type { IntentType } from './intentRecognizer'

/**
 * 基础消息类型
 */
export interface BaseMessageType {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  messageType?: 'text' | 'analysis' | 'recommendation' | 'error'
  intent?: IntentType
}

/**
 * 成分信息
 */
export interface IngredientInfo {
  name: string
  percentage?: number
  dosage?: string
  source?: string
  category?: string
  efficacy?: string[]
  precautions?: string[]
}

/**
 * 成分分析结果数据
 */
export interface IngredientAnalysisData {
  formulaName?: string
  ingredients: IngredientInfo[]
  totalCount: number
  categories: {
    name: string
    count: number
    percentage: number
  }[]
  mainEfficacies: string[]
  analysisDate: string
  confidence: number
}

/**
 * 成分分析结果消息
 */
export interface IngredientAnalysisMessage extends BaseMessageType {
  messageType: 'analysis'
  intent: 'ingredient_analysis'
  analysisData: IngredientAnalysisData
}

/**
 * 氨基酸信息
 */
export interface AminoAcidInfo {
  name: string
  code: string
  abbreviation: string
  percentage: number
  category: 'hydrophobic' | 'hydrophilic' | 'charged' | 'polar' | 'nonpolar'
}

/**
 * 多肽特性
 */
export interface PeptideProperties {
  molecularWeight?: number
  isoelectricPoint?: number
  hydrophobicity?: number
  charge?: number
  instabilityIndex?: number
  halfLife?: string
  GRAVY?: number
}

/**
 * 多肽分析结果数据
 */
export interface PeptideAnalysisData {
  sequence?: string
  length: number
  aminoAcids: AminoAcidInfo[]
  properties: PeptideProperties
  secondaryStructure?: {
    helix: number
    sheet: number
    coil: number
  }
  antigenicity?: number
  allergenicity?: string
  analysisDate: string
  confidence: number
}

/**
 * 多肽分析结果消息
 */
export interface PeptideAnalysisMessage extends BaseMessageType {
  messageType: 'analysis'
  intent: 'peptide_analysis'
  analysisData: PeptideAnalysisData
}

/**
 * 配伍关系类型
 */
export type CompatibilityType = 'synergy' | 'antagonism' | 'neutral' | 'toxicity' | 'unknown'

/**
 * 配伍关系信息
 */
export interface CompatibilityRelation {
  ingredient1: string
  ingredient2: string
  type: CompatibilityType
  description: string
  mechanism?: string
  severity?: 'high' | 'medium' | 'low'
}

/**
 * 配伍检测结果数据
 */
export interface CompatibilityCheckData {
  ingredients: string[]
  relations: CompatibilityRelation[]
  overallCompatibility: {
    score: number
    level: 'safe' | 'caution' | 'unsafe'
    summary: string
  }
  warnings: string[]
  recommendations: string[]
  analysisDate: string
  confidence: number
}

/**
 * 配伍检测结果消息
 */
export interface CompatibilityCheckMessage extends BaseMessageType {
  messageType: 'analysis'
  intent: 'compatibility_check'
  analysisData: CompatibilityCheckData
}

/**
 * 配方信息
 */
export interface FormulaInfo {
  name: string
  description: string
  ingredients: string[]
  efficacy: string[]
  indications: string[]
  dosage: string
  precautions: string[]
  source?: string
}

/**
 * 配方推荐结果数据
 */
export interface FormulaRecommendationData {
  query: string
  formulas: FormulaInfo[]
  totalCount: number
  matchScore: number
  recommendations: string[]
  analysisDate: string
  confidence: number
}

/**
 * 配方推荐结果消息
 */
export interface FormulaRecommendationMessage extends BaseMessageType {
  messageType: 'recommendation'
  intent: 'formula_recommendation'
  analysisData: FormulaRecommendationData
}

/**
 * 安全性等级
 */
export type SafetyLevel = 'safe' | 'low_risk' | 'medium_risk' | 'high_risk' | 'unknown'

/**
 * 安全性问题
 */
export interface SafetyIssue {
  type: string
  severity: SafetyLevel
  description: string
  affectedIngredients: string[]
  recommendation: string
}

/**
 * 安全性检测结果数据
 */
export interface SafetyCheckData {
  overallLevel: SafetyLevel
  score: number
  issues: SafetyIssue[]
  warnings: string[]
  safeDosageRange?: {
    min: number
    max: number
    unit: string
  }
  analysisDate: string
  confidence: number
}

/**
 * 安全性检测结果消息
 */
export interface SafetyCheckMessage extends BaseMessageType {
  messageType: 'analysis'
  intent: 'safety_check'
  analysisData: SafetyCheckData
}

/**
 * 协同作用信息
 */
export interface SynergyEffect {
  ingredient1: string
  ingredient2: string
  effect: string
  mechanism?: string
  enhancement?: number
  evidence?: string
}

/**
 * 协同作用分析结果数据
 */
export interface SynergyAnalysisData {
  ingredients: string[]
  effects: SynergyEffect[]
  overallScore: number
  summary: string
  recommendations: string[]
  analysisDate: string
  confidence: number
}

/**
 * 协同作用分析结果消息
 */
export interface SynergyAnalysisMessage extends BaseMessageType {
  messageType: 'analysis'
  intent: 'synergy_analysis'
  analysisData: SynergyAnalysisData
}

/**
 * 联合消息类型
 */
export type AnalysisMessage =
  | IngredientAnalysisMessage
  | PeptideAnalysisMessage
  | CompatibilityCheckMessage
  | FormulaRecommendationMessage
  | SafetyCheckMessage
  | SynergyAnalysisMessage

/**
 * 消息类型判断辅助函数
 */
export function isAnalysisMessage(message: BaseMessageType): message is AnalysisMessage {
  return message.messageType === 'analysis' || message.messageType === 'recommendation'
}

export function isIngredientAnalysis(message: BaseMessageType): message is IngredientAnalysisMessage {
  return isAnalysisMessage(message) && message.intent === 'ingredient_analysis'
}

export function isPeptideAnalysis(message: BaseMessageType): message is PeptideAnalysisMessage {
  return isAnalysisMessage(message) && message.intent === 'peptide_analysis'
}

export function isCompatibilityCheck(message: BaseMessageType): message is CompatibilityCheckMessage {
  return isAnalysisMessage(message) && message.intent === 'compatibility_check'
}

export function isFormulaRecommendation(message: BaseMessageType): message is FormulaRecommendationMessage {
  return isAnalysisMessage(message) && message.intent === 'formula_recommendation'
}

export function isSafetyCheck(message: BaseMessageType): message is SafetyCheckMessage {
  return isAnalysisMessage(message) && message.intent === 'safety_check'
}

export function isSynergyAnalysis(message: BaseMessageType): message is SynergyAnalysisMessage {
  return isAnalysisMessage(message) && message.intent === 'synergy_analysis'
}
