/**
 * 统一模型调用接口层 (类型安全版本)
 * 标准化各模型的调用方式，支持模型配置管理、状态监控和错误处理
 */
import api from './client'
import { logger } from '@/utils/safeLogger'
import type { AICandidate, SafetyCheckResult, SynergyResult } from '@/types'
import type { TokenUsage } from '@/types/api'

// 模型类型定义 - 扩展自 API 类型
export type ModelType = 'formula_gpt' | 'synergy_net' | 'safety_checker' | 'taste_predictor' | 'stability_model' | 'peptide_scorer' | 'llm'

// 模型配置类型 - 使用更严格的类型
export interface ModelConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
  concurrencyLimit: number
  temperature?: number
  maxTokens?: number
}

// 模型状态类型 - 与后端 API 返回的数据结构匹配
export interface ModelStatus {
  status: 'active' | 'inactive' | 'error' | 'unconfigured'
  provider: string
  model: string
  version?: string
  mode?: string
  lastChecked?: string
  error?: string
  note?: string
  base_url?: string
}

// 模型调用参数类型 - 类型安全
export interface FormulaGPTInput {
  targetEffects?: string[]
  target_effects?: string[]
  constraints?: Record<string, unknown>
  useLlm?: boolean
  use_llm?: boolean
}

export interface SynergyNetInput {
  herbNames?: string[]
  herb_names?: string[]
  peptideSequences?: string[]
  peptide_sequences?: string[]
}

export interface SafetyCheckerInput {
  ingredientNames?: string[]
  ingredient_names?: string[]
  peptideSequences?: string[]
  peptide_sequences?: string[]
}

export interface TastePredictorInput {
  ingredients: {
    name: string
    dosage: string
    role: string
  }[]
}

export interface StabilityModelInput {
  ingredients: {
    name: string
    dosage: string
  }[]
  storageTemp?: number
  storage_temp?: number
}

export interface PeptideScorerInput {
  sequences: string[]
  targetActivity?: string
  target_activity?: string
}

// 统一的模型输入类型
export type ModelInput =
  | FormulaGPTInput
  | SynergyNetInput
  | SafetyCheckerInput
  | TastePredictorInput
  | StabilityModelInput
  | PeptideScorerInput

// 模型调用参数类型 - 类型安全
export interface ModelCallParams<T extends ModelInput = ModelInput> {
  modelType: ModelType
  input: T
  options?: GenerationOptions
}

// 生成选项
export interface GenerationOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

// 模型响应类型 - 类型安全
export interface ModelResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  modelType: ModelType
  provider: string
  latency: number
  timestamp: string
  usage?: TokenUsage
}

// 导入统一配置管理模块
import { ConfigManager as GlobalConfigManager } from '@/utils/configManager'

// 模型配置管理
export class ModelConfigManager {
  static getConfigs(): Record<ModelType, ModelConfig> {
    try {
      const configs: Record<ModelType, ModelConfig> = {
        formula_gpt: GlobalConfigManager.getModelConfig('formula_gpt'),
        synergy_net: GlobalConfigManager.getModelConfig('synergy_net'),
        safety_checker: GlobalConfigManager.getModelConfig('safety_checker'),
        taste_predictor: GlobalConfigManager.getModelConfig('taste_predictor'),
        stability_model: GlobalConfigManager.getModelConfig('stability_model'),
        peptide_scorer: GlobalConfigManager.getModelConfig('peptide_scorer'),
        llm: GlobalConfigManager.getModelConfig('llm'),
      }
      return configs
    } catch (error) {
      logger.error('获取模型配置失败', error)
      return this.getDefaultConfigs()
    }
  }

  static getConfig(modelType: ModelType): ModelConfig {
    return GlobalConfigManager.getModelConfig(modelType)
  }

  static setConfig(modelType: ModelType, config: Partial<ModelConfig>): void {
    const currentConfig = GlobalConfigManager.getModelConfig(modelType)
    GlobalConfigManager.setModelConfig(modelType, { ...currentConfig, ...config })
  }

  static resetConfig(modelType: ModelType): void {
    GlobalConfigManager.resetModelConfig(modelType)
  }

  private static getDefaultConfigs(): Record<ModelType, ModelConfig> {
    return {
      formula_gpt: this.getDefaultConfig('formula_gpt'),
      synergy_net: this.getDefaultConfig('synergy_net'),
      safety_checker: this.getDefaultConfig('safety_checker'),
      taste_predictor: this.getDefaultConfig('taste_predictor'),
      stability_model: this.getDefaultConfig('stability_model'),
      peptide_scorer: this.getDefaultConfig('peptide_scorer'),
      llm: this.getDefaultConfig('llm'),
    }
  }

  private static getDefaultConfig(_modelType: ModelType): ModelConfig {
    return {
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      timeout: 30000,
      maxRetries: 3,
      concurrencyLimit: 3,
    }
  }
}

// 请求队列管理
export class RequestQueue {
  private static queues: Record<ModelType, (() => Promise<unknown>)[]> = {
    formula_gpt: [],
    synergy_net: [],
    safety_checker: [],
    taste_predictor: [],
    stability_model: [],
    peptide_scorer: [],
    llm: [],
  }

  private static running: Record<ModelType, number> = {
    formula_gpt: 0,
    synergy_net: 0,
    safety_checker: 0,
    taste_predictor: 0,
    stability_model: 0,
    peptide_scorer: 0,
    llm: 0,
  }

  static async enqueue<T = unknown>(modelType: ModelType, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queues[modelType].push(async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.running[modelType]--
          this.processQueue(modelType)
        }
      })

      this.processQueue(modelType)
    })
  }

  /** 清空指定模型类型的请求队列 */
  static clearQueue(modelType: ModelType): void {
    this.queues[modelType] = []
  }

  private static processQueue(modelType: ModelType): void {
    const config = ModelConfigManager.getConfig(modelType)
    const concurrencyLimit = config.concurrencyLimit

    while (
      this.queues[modelType].length > 0 &&
      this.running[modelType] < concurrencyLimit
    ) {
      this.running[modelType]++
      const task = this.queues[modelType].shift()
      if (task) {
        task()
      }
    }
  }
}

// 调用日志记录
export interface CallLogEntry {
  modelType: ModelType
  params: string
  response: string
  latency: number
  timestamp: string
}

export class ModelCallLogger {
  private static STORAGE_KEY = 'rmfood_model_call_logs'
  private static MAX_LOGS = 1000

  static log(
    modelType: ModelType,
    params: ModelCallParams,
    response: ModelResponse,
    latency: number,
  ): void {
    try {
      const logs = this.getLogs()
      logs.unshift({
        modelType,
        params: JSON.stringify(params),
        response: JSON.stringify(response),
        latency,
        timestamp: new Date().toISOString(),
      })

      // 限制日志数量
      const trimmedLogs = logs.slice(0, this.MAX_LOGS)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedLogs))
    } catch (error) {
      logger.warn('存储调用日志失败', error)
    }
  }

  static getLogs(): CallLogEntry[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      logger.error('读取调用日志失败', error)
      return []
    }
  }

  static clearLogs(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      logger.warn('清除调用日志失败', error)
    }
  }
}

// 统一模型客户端
export class ModelClient {
  /**
   * 获取所有模型状态
   */
  static async getModelStatus(): Promise<Record<string, ModelStatus>> {
    try {
      const response = await api.get<Record<string, ModelStatus>>('/ai/models/status', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      return response.data
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError.response?.status === 401) {
          logger.warn('[ModelClient] 未登录状态，跳过模型状态获取')
        } else {
          logger.error('获取模型状态失败', error)
        }
      } else {
        logger.error('获取模型状态失败', error)
      }

      // 返回默认状态
      return {
        llm: { status: 'unconfigured', provider: 'unknown', model: 'unknown', note: '无法获取模型状态' },
        formula_gpt: { status: 'inactive', provider: 'local', model: 'rule-based', note: '规则引擎模式' },
        synergy_net: { status: 'inactive', provider: 'local', model: 'rule-based', note: '规则引擎模式' },
        safety_checker: { status: 'inactive', provider: 'local', model: 'rule_engine', note: '规则引擎模式' },
        taste_predictor: { status: 'inactive', provider: 'local', model: 'rule_based', note: '规则引擎模式' },
        stability_model: { status: 'inactive', provider: 'local', model: 'simulation', note: '模拟预测模式' },
        peptide_scorer: { status: 'inactive', provider: 'local', model: 'heuristic', note: '启发式评分' },
      }
    }
  }

  /**
   * 调用模型（通用方法）
   */
  static async callModel<T = unknown>(params: ModelCallParams): Promise<ModelResponse<T>> {
    const startTime = Date.now()
    const { modelType, input, options } = params

    try {
      // 检查模型配置
      const config = ModelConfigManager.getConfig(modelType)

      logger.debug(`调用模型: ${modelType}`, { input, options })

      // 根据模型类型调用不同的 API
      let responseData: T
      switch (modelType) {
        case 'formula_gpt':
          responseData = await this.callFormulaGPT(input as FormulaGPTInput, options) as T
          break
        case 'synergy_net':
          responseData = await this.callSynergyNet(input as SynergyNetInput, options) as T
          break
        case 'safety_checker':
          responseData = await this.callSafetyChecker(input as SafetyCheckerInput, options) as T
          break
        case 'taste_predictor':
          responseData = await this.callTastePredictor(input as TastePredictorInput, options) as T
          break
        case 'stability_model':
          responseData = await this.callStabilityModel(input as StabilityModelInput, options) as T
          break
        case 'peptide_scorer':
          responseData = await this.callPeptideScorer(input as PeptideScorerInput, options) as T
          break
        default:
          throw new Error(`未知的模型类型: ${modelType}`)
      }

      const latency = Date.now() - startTime
      const response: ModelResponse<T> = {
        success: true,
        data: responseData,
        modelType,
        provider: config.baseUrl || 'DeepSeek',
        latency,
        timestamp: new Date().toISOString(),
      }

      // 记录调用日志
      ModelCallLogger.log(modelType, params, response, latency)

      logger.info(`模型调用成功: ${modelType}`, { latency })

      return response
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '模型调用失败'
      const latency = Date.now() - startTime

      logger.error(`模型调用失败: ${modelType}`, { error, latency })

      const response: ModelResponse<T> = {
        success: false,
        error: errorMessage,
        modelType,
        provider: 'DeepSeek',
        latency,
        timestamp: new Date().toISOString(),
      }

      // 记录错误日志
      ModelCallLogger.log(modelType, params, response, latency)

      return response
    }
  }

  /**
   * 调用 FormulaGPT - 配方生成
   */
  private static async callFormulaGPT(
    input: FormulaGPTInput,
    options?: GenerationOptions,
  ): Promise<{ candidates: AICandidate[]; total: number; generator: string }> {
    return RequestQueue.enqueue('formula_gpt', async () => {
      const response = await api.post<{ candidates: AICandidate[]; total: number; generator: string }>(
        '/ai/generate',
        {
          target_effects: input.targetEffects || input.target_effects,
          constraints: input.constraints,
          use_llm: input.useLlm ?? false,
          description: (input.targetEffects || input.target_effects)?.length > 0
            ? `基于${(input.targetEffects || input.target_effects).join('、')}功效需求，生成中药配方方案`
            : undefined,
          ...options,
        },
      )
      return response.data
    })
  }

  /**
   * 调用 SynergyNet - 协同分析
   */
  private static async callSynergyNet(
    input: SynergyNetInput,
    _options?: GenerationOptions,
  ): Promise<SynergyResult> {
    return RequestQueue.enqueue('synergy_net', async () => {
      const response = await api.post<SynergyResult>(
        '/ai/synergy-analysis',
        {
          herb_names: input.herbNames || input.herb_names,
          peptide_sequences: input.peptideSequences || input.peptide_sequences,
        },
      )
      return response.data
    })
  }

  /**
   * 调用 SafetyChecker - 安全检查
   */
  private static async callSafetyChecker(
    input: SafetyCheckerInput,
    _options?: GenerationOptions,
  ): Promise<SafetyCheckResult> {
    return RequestQueue.enqueue('safety_checker', async () => {
      const response = await api.post<SafetyCheckResult>(
        '/ai/safety-check',
        {
          ingredient_names: input.ingredientNames || input.ingredient_names,
          peptide_sequences: input.peptideSequences || input.peptide_sequences,
        },
      )
      return response.data
    })
  }

  /**
   * 调用 TastePredictor - 口感预测
   */
  private static async callTastePredictor(
    input: TastePredictorInput,
    _options?: GenerationOptions,
  ): Promise<unknown> {
    return RequestQueue.enqueue('taste_predictor', async () => {
      const response = await api.post('/ai/taste-predict', {
        ingredients: input.ingredients,
      })
      return response.data
    })
  }

  /**
   * 调用 StabilityModel - 稳定性评估
   */
  private static async callStabilityModel(
    input: StabilityModelInput,
    _options?: GenerationOptions,
  ): Promise<unknown> {
    return RequestQueue.enqueue('stability_model', async () => {
      const response = await api.post('/ai/stability', {
        ingredients: input.ingredients,
        storage_temp: input.storageTemp ?? input.storage_temp ?? 25,
      })
      return response.data
    })
  }

  /**
   * 调用 PeptideScorer - 多肽评分
   */
  private static async callPeptideScorer(
    input: PeptideScorerInput,
    _options?: GenerationOptions,
  ): Promise<unknown> {
    return RequestQueue.enqueue('peptide_scorer', async () => {
      const response = await api.post('/ai/peptide-score', {
        sequences: input.sequences,
        target_activity: input.targetActivity ?? 'ACE_inhibitory',
      })
      return response.data
    })
  }

  /**
   * 批量调用模型
   */
  static async batchCallModels(calls: ModelCallParams[]): Promise<ModelResponse[]> {
    const promises = calls.map(call => this.callModel(call))
    return Promise.all(promises)
  }

  /**
   * 取消所有待处理的请求
   */
  static cancelAllRequests(): void {
    // Access via static public method since queues is private
    const modelTypes: ModelType[] = ['formula_gpt', 'synergy_net', 'safety_checker', 'taste_predictor', 'stability_model', 'peptide_scorer', 'llm']
    modelTypes.forEach(modelType => {
      RequestQueue.clearQueue(modelType)
    })

    logger.info('已取消所有待处理的请求')
  }
}

// 导出默认实例
export default ModelClient

// ═══ Phase 1 Enhancement: Request Deduplication & Smart Cache ═══

/**
 * 请求去重管理器
 * 相同内容 + 时间窗口内不重复发送，避免用户双击等导致重复请求
 */
class RequestDeduplicator {
  private pending = new Map<string, AbortController>()
  private readonly WINDOW_MS = 30000 // 30 秒时间窗口

  /**
   * 获取或创建去重控制器
   * @param key 去重键 (内容前缀 + 时间窗口)
   * @returns 已存在的 controller 或新创建的
   */
  getOrCreate(key: string): { controller: AbortController; isNew: boolean } {
    const existing = this.pending.get(key)
    if (existing && !existing.signal.aborted) {
      return { controller: existing, isNew: false }
    }

    const controller = new AbortController()
    this.pending.set(key, controller)

    // 自动清理：窗口期过后移除
    setTimeout(() => this.pending.delete(key), this.WINDOW_MS)

    return { controller, isNew: true }
  }

  /** 取消指定 key 的请求 */
  abort(key: string): void {
    const ctrl = this.pending.get(key)
    if (ctrl && !ctrl.signal.aborted) {
      ctrl.abort()
      this.pending.delete(key)
    }
  }

  /** 清理所有待处理请求 */
  clearAll(): void {
    for (const [, ctrl] of this.pending) {
      if (!ctrl.signal.aborted) ctrl.abort()
    }
    this.pending.clear()
  }
}

/** 全局单例 */
export const requestDeduplicator = new RequestDeduplicator()

/**
 * 模型状态缓存 — 减少对 /models/status 的频繁轮询
 * TTL: 15 秒 (平衡实时性和性能)
 */
class ModelStatusCache {
  private cached: Record<string, ModelStatus> | null = null
  private fetchedAt = 0
  private readonly TTL_MS = 15000

  get(): Record<string, ModelStatus> | null {
    if (this.cached && Date.now() - this.fetchedAt < this.TTL_MS) {
      return this.cached
    }
    return null // 缓存过期或不存在
  }

  set(data: Record<string, ModelStatus>): void {
    this.cached = data
    this.fetchedAt = Date.now()
  }

  invalidate(): void {
    this.cached = null
    this.fetchedAt = 0
  }
}

export const modelStatusCache = new ModelStatusCache()
