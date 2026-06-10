/**
 * NLP配置初始化入口
 *
 * 负责注册所有NLP配置的加载器，并在应用启动时预加载关键配置
 */

import { logger } from '@/utils/safeLogger'
import { getNLPConfigService, type NLPConfigService } from './nlpConfigService'

// 配置文件路径常量
const CONFIG_PATHS = {
  textNormalization: '/config/nlp/textNormalization.json',
  functionalPatterns: '/config/nlp/functionalPatterns.json',
  targetAudienceTerms: '/config/nlp/targetAudienceTerms.json',
  regulatoryPatterns: '/config/nlp/regulatoryPatterns.json',
} as const

/**
 * 初始化所有NLP配置
 */
export async function initializeNLPConfigs(options?: {
  preLoad?: boolean[]
  basePath?: string
}): Promise<NLPConfigService> {
  const configService = getNLPConfigService()
  const basePath = options?.basePath || ''

  logger.log('[NLPConfig] 🚀 开始初始化NLP配置...')

  // 注册文本规范化配置加载器
  configService.registerLoader('textNormalization', async () => {
    return loadJSONConfig(`${basePath}${CONFIG_PATHS.textNormalization}`)
  })

  // 注册功能宣称模式配置加载器
  configService.registerLoader('functionalPatterns', async () => {
    return loadJSONConfig(`${basePath}${CONFIG_PATHS.functionalPatterns}`)
  })

  // 注册目标人群术语配置加载器
  configService.registerLoader('targetAudienceTerms', async () => {
    return loadJSONConfig(`${basePath}${CONFIG_PATHS.targetAudienceTerms}`)
  })

  // 注册法规模式配置加载器
  configService.registerLoader('regulatoryPatterns', async () => {
    return loadJSONConfig(`${basePath}${CONFIG_PATHS.regulatoryPatterns}`)
  })

  // 预加载关键配置（可选）
  if (options?.preLoad) {
    try {
      const preLoadPromises: Promise<any>[] = []

      if (options.preLoad[0] !== false) {
        preLoadPromises.push(configService.getConfig('textNormalization'))
      }
      if (options.preLoad[1] !== false) {
        preLoadPromises.push(configService.getConfig('functionalPatterns'))
      }

      if (preLoadPromises.length > 0) {
        await Promise.all(preLoadPromises)
        logger.log('[NLPConfig] ✅ 关键配置预加载完成')
      }

    } catch (error) {
      logger.warn('[NLPConfig] ⚠️ 部分配置预加载失败，将在使用时按需加载:', error)
    }
  }

  logger.log(`[NLPConfig] ✅ NLP配置初始化完成，已注册 ${configService.getRegisteredKeys().length} 个配置`)

  return configService
}

/**
 * 加载JSON配置文件的辅助函数
 */
async function loadJSONConfig<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data as T

  } catch (error) {
    logger.error(`[NLPConfig] ❌ 加载配置失败: ${url}`, error)
    throw error
  }
}

/**
 * 获取已注册的配置键列表
 */
export function getRegisteredNLPConfigs(): string[] {
  return getNLPConfigService().getRegisteredKeys()
}

/**
 * 检查特定配置是否可用
 */
export async function isNLPConfigAvailable(key: string): Promise<boolean> {
  try {
    await getNLPConfigService().getConfig(key)
    return true
  } catch {
    return false
  }
}
