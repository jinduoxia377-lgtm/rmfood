/**
 * useModelStore — 模型选择状态管理
 *
 * 管理当前选中的模型、可用模型列表、以及模型选择持久化。
 * 与 scenarioStore 模式一致：写单例 + Zustand 双写桥接。
 */
import { create } from 'zustand'
import api from '@/api/client'
import { logger } from '@/utils/safeLogger'

// ── 模型元数据（前端显示配置） ──────────────────────────────────────
export interface ModelMeta {
  id: string
  label: string
  descKey?: string
  color: string
}

/** 提供商→默认模型映射（与后端 PROVIDER_DEFAULTS 保持一致） */
export const PROVIDER_DEFAULTS: Record<string, { base_url: string; model: string }> = {
  deepseek: { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  zhipu: { base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
}

/** 模型 ID → 显示元数据映射（动态拉取时补充） */
export const MODEL_META: Record<string, Omit<ModelMeta, 'id'>> = {
  'deepseek-chat': { label: 'DeepSeek', descKey: 'modelDeepDesc', color: 'text-success-500' },
  'gpt-4o-mini': { label: 'GPT-4o Mini', descKey: 'modelGptDesc', color: 'text-secondary-500' },
  'glm-4-flash': { label: 'GLM-4 Flash', descKey: 'modelGlmDesc', color: 'text-accent-500' },
  'qwen-turbo': { label: 'Qwen-Turbo', descKey: 'modelQwenDesc', color: 'text-warning-500' },
}

/** 为未知模型生成默认元数据 */
export function getModelMeta(modelId: string): ModelMeta {
  const known = MODEL_META[modelId]
  if (known) return { id: modelId, ...known }
  // 尝试从 provider 默认值中匹配
  for (const [provider, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    if (defaults.model === modelId) {
      const label = modelId.split('-').pop() || modelId
      return { id: modelId, label, color: 'text-success-500' }
    }
  }
  // 回退：直接使用 modelId 作为标签，并附带通用描述 key（三语已提供 modelGenericDesc）
  const label = modelId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return { id: modelId, label, descKey: 'modelGenericDesc', color: 'text-neutral-500' }
}

const STORAGE_KEY = 'rmfood_selected_model'

function loadPersistedModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function persistModel(model: string): void {
  try {
    if (model) localStorage.setItem(STORAGE_KEY, model)
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* 存储不可用时静默降级 */ }
}

// ── 模型列表缓存（localStorage，10 分钟有效期）──────────────────────────
// /ai/models/list 依赖上游 LLM 提供商（经后端代理），偶发 502 Bad Gateway。
// 缓存成功结果可让缓存期内完全跳过该调用，从根上消除重复 502。
const MODELS_CACHE_KEY = 'rmfood_models_list_cache'
/** 缓存有效期：10 分钟，超时后重新尝试获取 */
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000
/** 模型接口请求超时（毫秒）：避免网关挂起时无限等待 */
const MODELS_FETCH_TIMEOUT = 10_000
/** 模型列表重试延迟（毫秒）：仅对 5xx/网络错误重试一次 */
const MODELS_RETRY_DELAY_MS = 1_000

interface ModelsCacheEntry {
  models: string[]
  fetchedAt: number
}

function readModelsCache(): ModelsCacheEntry | null {
  try {
    const raw = localStorage.getItem(MODELS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ModelsCacheEntry>
    if (!Array.isArray(parsed.models) || parsed.models.length === 0) return null
    if (typeof parsed.fetchedAt !== 'number') return null
    return { models: parsed.models, fetchedAt: parsed.fetchedAt }
  } catch {
    return null
  }
}

function writeModelsCache(models: string[]): void {
  try {
    const entry: ModelsCacheEntry = { models, fetchedAt: Date.now() }
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(entry))
  } catch { /* 存储不可用时静默降级 */ }
}

function isCacheFresh(entry: ModelsCacheEntry | null): boolean {
  return entry !== null && Date.now() - entry.fetchedAt < MODELS_CACHE_TTL_MS
}

/**
 * 判断模型接口错误是否可重试：
 * - 502/503/504（网关/上游错误）→ 可重试
 * - 401/403（未认证/权限不足）→ 不重试：重试无意义，令牌刷新由 auth 流程负责
 * - 其他 4xx → 确定性错误，不重试
 * - 无响应（网络中断/超时）→ 可重试
 */
function isRetryableModelError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status) return status >= 500
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 拉取可用模型列表：仅对 5xx/网络错误重试一次，401/403 直接失败。 */
async function fetchModelList(provider: string): Promise<{ models?: string[] }> {
  const call = async (): Promise<{ models?: string[] }> => {
    const listResp = await api.post<any>('/ai/models/list', {
      provider,
      api_key: '',
      base_url: '',
    }, { timeout: MODELS_FETCH_TIMEOUT })
    return listResp.data || listResp
  }

  try {
    return await call()
  } catch (err) {
    if (!isRetryableModelError(err)) throw err
    logger.debug('[ModelStore] models/list 瞬时失败，准备重试一次', {
      status: (err as { response?: { status?: number } })?.response?.status,
    })
    await sleep(MODELS_RETRY_DELAY_MS)
    return call()
  }
}

// ── Store 定义 ─────────────────────────────────────────────────────
interface ModelState {
  /** 当前选中的模型 ID（空字符串 = 使用后端默认） */
  selectedModel: string
  /** 后端返回的可用模型列表 */
  availableModels: string[]
  /** 当前后端实际使用的模型 */
  backendModel: string
  /** 后端提供商 */
  backendProvider: string
  /** 模型加载状态 */
  isLoading: boolean
  /** 设置选中的模型（持久化到 localStorage） */
  setSelectedModel: (model: string) => void
  /** 从后端拉取可用模型列表 */
  fetchModels: () => Promise<void>
}

export const useModelStore = create<ModelState>((set, _get) => ({
  selectedModel: loadPersistedModel(),
  availableModels: [],
  backendModel: '',
  backendProvider: '',
  isLoading: false,

  setSelectedModel: (model) => {
    persistModel(model)
    set({ selectedModel: model })
  },

  fetchModels: async () => {
    set({ isLoading: true })
    try {
      // 1. 获取当前模型状态
      const statusResp = await api.get<any>('/ai/models/status', { timeout: MODELS_FETCH_TIMEOUT })
      const statusData = statusResp.data || statusResp
      const backendModel = statusData?.llm?.model || ''
      const backendProvider = statusData?.llm?.provider || ''

      // 2. 拉取可用模型列表（通过后端代理，密钥不出后端）
      //    缓存有效期（10 分钟）内直接复用，完全跳过 /ai/models/list，
      //    从根上消除重复 502 与控制台噪声。
      const cached = readModelsCache()
      let availableModels: string[] = []

      if (cached && isCacheFresh(cached)) {
        availableModels = cached.models
        logger.debug('[ModelStore] 使用缓存模型列表，跳过 /ai/models/list', {
          count: availableModels.length,
          cacheAgeMs: Date.now() - cached.fetchedAt,
        })
      } else {
        try {
          const listData = await fetchModelList(backendProvider)
          availableModels = listData?.models || []
          if (availableModels.length > 0) writeModelsCache(availableModels)
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status
          if (cached && cached.models.length > 0) {
            // 陈旧缓存兜底：比「只有后端当前模型」信息更丰富
            availableModels = cached.models
            logger.debug('[ModelStore] models/list 失败，使用陈旧缓存列表', {
              status, cacheAgeMs: Date.now() - cached.fetchedAt, count: availableModels.length,
            })
          } else {
            // models/list 失败且无缓存时降级：使用后端当前模型 + 已知提供商默认模型
            availableModels = [backendModel].filter(Boolean)
            for (const defaults of Object.values(PROVIDER_DEFAULTS)) {
              if (!availableModels.includes(defaults.model)) {
                availableModels.push(defaults.model)
              }
            }
            logger.debug('[ModelStore] models/list 失败且无缓存，降级为提供商默认模型', { status })
          }
        }
      }

      // 3. 确保当前选中模型在可用列表中
      const persisted = loadPersistedModel()
      const selectedModel = persisted && availableModels.includes(persisted)
        ? persisted
        : (backendModel || availableModels[0] || '')

      set({
        selectedModel,
        availableModels,
        backendModel,
        backendProvider,
        isLoading: false,
      })

      // 4. 如果没有持久化选择，保存当前后端模型
      if (!persisted && selectedModel) {
        persistModel(selectedModel)
      }
    } catch (e) {
      // 静默降级：用 logger.debug 而非 console.warn，避免重复 502 刷爆控制台。
      // 若有缓存的模型列表则一并降级使用，避免模型选择器完全空白。
      const cached = readModelsCache()
      logger.debug('[ModelStore] 拉取模型状态失败，降级为缓存/后端默认模型', {
        status: (e as { response?: { status?: number } })?.response?.status,
        error: e instanceof Error ? e.message : String(e),
      })
      set({
        selectedModel: loadPersistedModel(),
        availableModels: cached?.models ?? [],
        isLoading: false,
      })
    }
  },
}))