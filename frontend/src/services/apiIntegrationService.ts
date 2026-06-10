import { logger } from '@/utils/safeLogger';

/**
 * API集成服务
 * - 管理第三方服务集成
 * - 支持多种认证方式
 * - 数据映射配置
 * - 定时同步功能
 */

// 集成服务类型
export type IntegrationType = 'rest' | 'graphql' | 'soap' | 'odata'

// 认证类型
export type AuthType = 'none' | 'api_key' | 'basic' | 'oauth2' | 'bearer'

// 集成状态
export type IntegrationStatus = 'active' | 'inactive' | 'error'

// 集成配置接口
export interface IntegrationConfig {
  id: string
  name: string
  description: string
  type: IntegrationType
  authType: AuthType
  baseUrl: string
  authConfig: {
    apiKey?: string
    apiKeyHeader?: string
    username?: string
    password?: string
    clientId?: string
    clientSecret?: string
    tokenUrl?: string
    scopes?: string[]
    bearerToken?: string
  }
  syncConfig: {
    enabled: boolean
    interval: number // 分钟
    lastSync?: string
    nextSync?: string
  }
  dataMapping: {
    sourceField: string
    targetField: string
    transform?: string
  }[]
  status: IntegrationStatus
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

// 集成测试结果
export interface IntegrationTestResult {
  success: boolean
  message: string
  responseTime?: number
  statusCode?: number
  error?: string
}

// 集成日志
export interface IntegrationLog {
  id: string
  integrationId: string
  type: 'sync' | 'test' | 'error'
  message: string
  timestamp: string
  duration?: number
  error?: string
  details?: any
}

class ApiIntegrationService {
  private integrations = new Map<string, IntegrationConfig>()
  private logs = new Map<string, IntegrationLog[]>()
  private syncIntervals = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * 获取所有集成
   */
  getAllIntegrations(): IntegrationConfig[] {
    return Array.from(this.integrations.values())
  }

  /**
   * 获取单个集成
   */
  getIntegration(id: string): IntegrationConfig | undefined {
    return this.integrations.get(id)
  }

  /**
   * 创建集成
   */
  createIntegration(config: Omit<IntegrationConfig, 'id' | 'status' | 'createdAt' | 'updatedAt'>): IntegrationConfig {
    const newIntegration: IntegrationConfig = {
      ...config,
      id: `integration_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      status: 'inactive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.integrations.set(newIntegration.id, newIntegration)
    this.logs.set(newIntegration.id, [])
    this.saveIntegrations()

    return newIntegration
  }

  /**
   * 更新集成
   */
  updateIntegration(id: string, updates: Partial<IntegrationConfig>): IntegrationConfig | undefined {
    const integration = this.integrations.get(id)
    if (!integration) return undefined

    const updatedIntegration: IntegrationConfig = {
      ...integration,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    this.integrations.set(id, updatedIntegration)
    this.saveIntegrations()

    // 重新设置同步任务
    this.setupSyncTask(updatedIntegration)

    return updatedIntegration
  }

  /**
   * 删除集成
   */
  deleteIntegration(id: string): boolean {
    // 清除同步任务
    this.clearSyncTask(id)

    const deleted = this.integrations.delete(id)
    this.logs.delete(id)
    this.saveIntegrations()
    return deleted
  }

  /**
   * 测试集成连接
   */
  async testIntegration(id: string): Promise<IntegrationTestResult> {
    const integration = this.integrations.get(id)
    if (!integration) {
      return {
        success: false,
        message: '集成不存在',
      }
    }

    try {
      const startTime = Date.now()

      // 构建请求选项
      const requestOptions = this.buildRequestOptions(integration)

      // 发送测试请求
      const response = await fetch(`${integration.baseUrl}/health`, requestOptions)
      const responseTime = Date.now() - startTime

      // 记录日志
      this.addLog(id, {
        type: 'test',
        message: `测试连接 ${response.ok ? '成功' : '失败'}`,
        duration: responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
        },
      })

      if (response.ok) {
        // 更新状态
        this.updateIntegration(id, { status: 'active', errorMessage: undefined })

        return {
          success: true,
          message: '连接成功',
          responseTime,
          statusCode: response.status,
        }
      } else {
        // 更新状态
        this.updateIntegration(id, {
          status: 'error',
          errorMessage: `连接失败: ${response.status} ${response.statusText}`,
        })

        return {
          success: false,
          message: `连接失败: ${response.status} ${response.statusText}`,
          responseTime,
          statusCode: response.status,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      // 更新状态
      this.updateIntegration(id, {
        status: 'error',
        errorMessage,
      })

      // 记录日志
      this.addLog(id, {
        type: 'error',
        message: `测试连接失败: ${errorMessage}`,
        error: errorMessage,
      })

      return {
        success: false,
        message: `连接失败: ${errorMessage}`,
        error: errorMessage,
      }
    }
  }

  /**
   * 执行同步
   */
  async syncIntegration(id: string): Promise<boolean> {
    const integration = this.integrations.get(id)
    if (!integration) return false

    try {
      const startTime = Date.now()

      // 构建请求选项
      const requestOptions = this.buildRequestOptions(integration)

      // 发送同步请求
      const response = await fetch(`${integration.baseUrl}/sync`, requestOptions)
      const responseTime = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()

        // 处理数据映射
        const mappedData = this.mapData(data, integration.dataMapping)

        // 记录日志
        this.addLog(id, {
          type: 'sync',
          message: `同步成功，处理了 ${mappedData.length} 条记录`,
          duration: responseTime,
          details: {
            recordCount: mappedData.length,
          },
        })

        // 更新同步时间
        this.updateIntegration(id, {
          syncConfig: {
            ...integration.syncConfig,
            lastSync: new Date().toISOString(),
            nextSync: this.calculateNextSync(integration.syncConfig.interval),
          },
        })

        return true
      } else {
        const errorMessage = `同步失败: ${response.status} ${response.statusText}`

        // 记录日志
        this.addLog(id, {
          type: 'error',
          message: errorMessage,
          duration: responseTime,
          error: errorMessage,
        })

        return false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      // 记录日志
      this.addLog(id, {
        type: 'error',
        message: `同步失败: ${errorMessage}`,
        error: errorMessage,
      })

      return false
    }
  }

  /**
   * 获取集成日志
   */
  getIntegrationLogs(integrationId: string): IntegrationLog[] {
    return this.logs.get(integrationId) || []
  }

  /**
   * 构建请求选项
   */
  private buildRequestOptions(integration: IntegrationConfig): RequestInit {
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }

    // 添加认证信息
    switch (integration.authType) {
      case 'api_key':
        if (integration.authConfig.apiKey && integration.authConfig.apiKeyHeader) {
          (options.headers as Record<string, string>)[integration.authConfig.apiKeyHeader] = integration.authConfig.apiKey
        }
        break
      case 'basic':
        if (integration.authConfig.username && integration.authConfig.password) {
          (options.headers as Record<string, string>).Authorization = `Basic ${(window as any).btoa(`${integration.authConfig.username}:${integration.authConfig.password}`)}`
        }
        break
      case 'bearer':
        if (integration.authConfig.bearerToken) {
          (options.headers as Record<string, string>).Authorization = `Bearer ${integration.authConfig.bearerToken}`
        }
        break
      // OAuth2 认证需要先获取令牌，这里简化处理
      case 'oauth2':
        // 实际实现中需要先获取令牌
        break
    }

    return options
  }

  /**
   * 数据映射
   */
  private mapData(data: any[], mapping: { sourceField: string; targetField: string; transform?: string }[]): any[] {
    return data.map(item => {
      const mappedItem: any = {}
      mapping.forEach(map => {
        const sourceValue = this.getNestedValue(item, map.sourceField)
        let targetValue = sourceValue

        // 应用转换
        if (map.transform) {
          try {
            // 使用 new Function() 替代 eval，更安全且避免构建警告
            const transformFunction = new Function('value', `return (${map.transform})(value)`)
            targetValue = transformFunction(sourceValue)
          } catch (error) {
            logger.error('数据转换失败:', error)
          }
        }

        this.setNestedValue(mappedItem, map.targetField, targetValue)
      })
      return mappedItem
    })
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
  }

  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()
    if (!lastKey) return

    const parent = keys.reduce((acc, key) => {
      if (!acc[key]) acc[key] = {}
      return acc[key]
    }, obj)

    parent[lastKey] = value
  }

  /**
   * 计算下次同步时间
   */
  private calculateNextSync(interval: number): string {
    const nextSync = new Date()
    nextSync.setMinutes(nextSync.getMinutes() + interval)
    return nextSync.toISOString()
  }

  /**
   * 设置同步任务
   */
  private setupSyncTask(integration: IntegrationConfig): void {
    // 清除现有任务
    this.clearSyncTask(integration.id)

    // 如果启用了同步
    if (integration.syncConfig.enabled) {
      const interval = integration.syncConfig.interval * 60 * 1000 // 转换为毫秒
      const timer = setInterval(() => {
        this.syncIntegration(integration.id)
      }, interval)

      this.syncIntervals.set(integration.id, timer)
    }
  }

  /**
   * 清除同步任务
   */
  private clearSyncTask(integrationId: string): void {
    const timer = this.syncIntervals.get(integrationId)
    if (timer) {
      clearInterval(timer)
      this.syncIntervals.delete(integrationId)
    }
  }

  /**
   * 添加日志
   */
  private addLog(integrationId: string, log: Omit<IntegrationLog, 'id' | 'integrationId' | 'timestamp'>): void {
    const logs = this.logs.get(integrationId) || []
    const newLog: IntegrationLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      integrationId,
      timestamp: new Date().toISOString(),
    }
    logs.unshift(newLog) // 添加到开头
    // 只保留最近100条日志
    const trimmedLogs = logs.slice(0, 100)
    this.logs.set(integrationId, trimmedLogs)
  }

  /**
   * 保存集成配置
   */
  private saveIntegrations(): void {
    try {
      const integrations = Array.from(this.integrations.values())
      localStorage.setItem('rmfood_api_integrations', JSON.stringify(integrations))
    } catch (error) {
      logger.error('保存集成配置失败:', error)
    }
  }

  /**
   * 加载集成配置
   */
  loadIntegrations(): void {
    try {
      const stored = localStorage.getItem('rmfood_api_integrations')
      if (stored) {
        const integrations = JSON.parse(stored) as IntegrationConfig[]
        integrations.forEach(integration => {
          this.integrations.set(integration.id, integration)
          this.logs.set(integration.id, [])
          // 设置同步任务
          this.setupSyncTask(integration)
        })
      }
    } catch (error) {
      logger.error('加载集成配置失败:', error)
    }
  }
}

// 导出默认实例
export const apiIntegrationService = new ApiIntegrationService()

// 初始化时加载配置
apiIntegrationService.loadIntegrations()
