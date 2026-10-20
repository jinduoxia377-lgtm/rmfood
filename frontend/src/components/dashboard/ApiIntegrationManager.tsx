/**
 * API集成管理组件
 * - 管理第三方服务集成
 * - 支持多种认证方式
 * - 数据映射配置
 * - 测试和监控集成状态
 */
import { useState, useEffect } from 'react'
import { Settings, Plus, Edit, Trash2, TestTube, AlertCircle, CheckCircle2, RefreshCw, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger, Badge, Textarea } from '@/components/ui'
import { apiIntegrationService, type IntegrationConfig, type IntegrationTestResult, type IntegrationType, type AuthType, type IntegrationStatus } from '@/services/apiIntegrationService'
import { logger } from '@/utils/safeLogger';


interface ApiIntegrationManagerProps {
  className?: string
}

export function ApiIntegrationManager({ className }: ApiIntegrationManagerProps) {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([])
  const [activeTab, setActiveTab] = useState('list')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null)
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    description: '',
    type: 'rest' as IntegrationType,
    authType: 'none' as AuthType,
    baseUrl: '',
    authConfig: {
      apiKey: '',
      apiKeyHeader: 'X-API-Key',
      username: '',
      password: '',
      clientId: '',
      clientSecret: '',
      tokenUrl: '',
      scopes: [] as string[],
      bearerToken: '',
    },
    syncConfig: {
      enabled: false,
      interval: 60,
    },
    dataMapping: [
      { sourceField: '', targetField: '', transform: '' },
    ],
  })

  useEffect(() => {
    // 加载集成配置
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntegrations(apiIntegrationService.getAllIntegrations())
  }, [])

  const handleCreateIntegration = () => {
    apiIntegrationService.createIntegration(newIntegration)
    setIntegrations(apiIntegrationService.getAllIntegrations())
    setIsCreateDialogOpen(false)
    // 重置表单
    setNewIntegration({
      name: '',
      description: '',
      type: 'rest' as IntegrationType,
      authType: 'none' as AuthType,
      baseUrl: '',
      authConfig: {
        apiKey: '',
        apiKeyHeader: 'X-API-Key',
        username: '',
        password: '',
        clientId: '',
        clientSecret: '',
        tokenUrl: '',
        scopes: [],
        bearerToken: '',
      },
      syncConfig: {
        enabled: false,
        interval: 60,
      },
      dataMapping: [
        { sourceField: '', targetField: '', transform: '' },
      ],
    })
  }

  const handleEditIntegration = () => {
    if (editingIntegration) {
      apiIntegrationService.updateIntegration(editingIntegration.id, editingIntegration)
      setIntegrations(apiIntegrationService.getAllIntegrations())
      setIsEditDialogOpen(false)
      setEditingIntegration(null)
    }
  }

  const handleDeleteIntegration = (id: string) => {
    if (confirm('确定要删除这个集成吗？')) {
      apiIntegrationService.deleteIntegration(id)
      setIntegrations(apiIntegrationService.getAllIntegrations())
    }
  }

  const handleTestIntegration = async (id: string) => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await apiIntegrationService.testIntegration(id)
      setTestResult(result)
      setIntegrations(apiIntegrationService.getAllIntegrations())
    } catch (error) {
      logger.error('测试集成失败:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSyncIntegration = async (id: string) => {
    try {
      await apiIntegrationService.syncIntegration(id)
      setIntegrations(apiIntegrationService.getAllIntegrations())
    } catch (error) {
      logger.error('同步集成失败:', error)
    }
  }

  const handleAddMapping = () => {
    setNewIntegration(prev => ({
      ...prev,
      dataMapping: [...prev.dataMapping, { sourceField: '', targetField: '', transform: '' }],
    }))
  }

  const handleRemoveMapping = (index: number) => {
    setNewIntegration(prev => ({
      ...prev,
      dataMapping: prev.dataMapping.filter((_, i) => i !== index),
    }))
  }

  const handleAddEditMapping = () => {
    if (editingIntegration) {
      setEditingIntegration(prev => prev ? {
        ...prev,
        dataMapping: [...prev.dataMapping, { sourceField: '', targetField: '', transform: '' }],
      } : null)
    }
  }

  const handleRemoveEditMapping = (index: number) => {
    if (editingIntegration) {
      setEditingIntegration(prev => prev ? {
        ...prev,
        dataMapping: prev.dataMapping.filter((_, i) => i !== index),
      } : null)
    }
  }

  const getStatusColor = (status: IntegrationStatus) => {
    switch (status) {
      case 'active':
        return 'text-success-700 dark:text-success-600'
      case 'inactive':
        return 'text-neutral-500 dark:text-neutral-400'
      case 'error':
        return 'text-error-600 dark:text-error-600'
    }
  }

  const getStatusText = (status: IntegrationStatus) => {
    switch (status) {
      case 'active':
        return '活跃'
      case 'inactive':
        return '未激活'
      case 'error':
        return '错误'
    }
  }

  const getTypeIcon = (type: IntegrationType) => {
    switch (type) {
      case 'rest':
        return '🌐'
      case 'graphql':
        return '⚡'
      case 'soap':
        return '🧼'
      case 'odata':
        return '📊'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-secondary-600 dark:text-secondary-700" />
            <CardTitle as="h2" className="text-sm font-semibold">API集成管理</CardTitle>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            添加集成
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-1 sm:grid-cols-2">
            <TabsTrigger value="list">集成列表</TabsTrigger>
            <TabsTrigger value="monitor">监控状态</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {/* 集成列表 */}
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {integrations.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    暂无API集成，请点击右上角添加
                  </p>
                </div>
              ) : (
                integrations.map((integration) => (
                  <div key={integration.id} className="py-3 px-4 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(integration.type)}</span>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {integration.name}
                        </p>
                        <Badge className={getStatusColor(integration.status)} size="sm">
                          {getStatusText(integration.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-1">
                        {integration.baseUrl}
                      </p>
                      {integration.errorMessage && (
                        <p className="text-xs text-error-500 mt-1">
                          错误: {integration.errorMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          认证: {integration.authType}
                        </span>
                        <span className="text-xs text-neutral-300 dark:text-neutral-400">·</span>
                        <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                          同步: {integration.syncConfig.enabled ? `${integration.syncConfig.interval}分钟` : '禁用'}
                        </span>
                        {integration.syncConfig.lastSync && (
                          <>
                            <span className="text-xs text-neutral-300 dark:text-neutral-400">·</span>
                            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                              上次同步: {new Date(integration.syncConfig.lastSync).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<TestTube size={14} />}
                        onClick={() => handleTestIntegration(integration.id)}
                        disabled={isTesting}
                      >
                        测试
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        onClick={() => handleSyncIntegration(integration.id)}
                      >
                        同步
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Edit size={14} />}
                        onClick={() => {
                          setEditingIntegration(integration)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleDeleteIntegration(integration.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="monitor" className="mt-4">
            {/* 监控状态 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">集成状态监控</h4>
              <div className="grid grid-cols-1 gap-4">
                {integrations.map((integration) => (
                  <div key={integration.id} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(integration.type)}</span>
                        <h5 className="text-sm font-medium">{integration.name}</h5>
                        <Badge className={getStatusColor(integration.status)} size="sm">
                          {getStatusText(integration.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {integration.syncConfig.enabled && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                            <Clock size={12} />
                            下次同步: {integration.syncConfig.nextSync ? new Date(integration.syncConfig.nextSync).toLocaleTimeString() : '计算中'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                      <p>URL: {integration.baseUrl}</p>
                      <p>认证: {integration.authType}</p>
                      {integration.syncConfig.lastSync && (
                        <p>上次同步: {new Date(integration.syncConfig.lastSync).toLocaleString()}</p>
                      )}
                      {integration.errorMessage && (
                        <p className="text-error-500">错误: {integration.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 创建集成对话框 */}
        {isCreateDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">添加API集成</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label>集成名称</label>
                  <Input
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入集成名称"
                  />
                </div>
                <div>
                  <label>集成类型</label>
                  <Select
                    value={newIntegration.type}
                    onChange={(v) => setNewIntegration(prev => ({ ...prev, type: v as IntegrationType }))}
                  >
                    <option value="rest">REST API</option>
                    <option value="graphql">GraphQL</option>
                    <option value="soap">SOAP</option>
                    <option value="odata">OData</option>
                  </Select>
                </div>
              </div>

              <div>
                <label>描述</label>
                <Textarea
                  value={newIntegration.description}
                  onChange={(e) => setNewIntegration(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="输入集成描述"
                />
              </div>

              <div>
                <label>基础URL</label>
                <Input
                  value={newIntegration.baseUrl}
                  onChange={(e) => setNewIntegration(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="输入API基础URL"
                />
              </div>

              <div>
                <label>认证类型</label>
                <Select
                  value={newIntegration.authType}
                  onChange={(v) => setNewIntegration(prev => ({ ...prev, authType: v as AuthType }))}
                >
                  <option value="none">无认证</option>
                  <option value="api_key">API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="oauth2">OAuth 2.0</option>
                </Select>
              </div>

              {/* 认证配置 */}
              {newIntegration.authType === 'api_key' && (
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">API Key 配置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label>API Key</label>
                      <Input
                        value={newIntegration.authConfig.apiKey}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, apiKey: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <label>Header 名称</label>
                      <Input
                        value={newIntegration.authConfig.apiKeyHeader}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, apiKeyHeader: e.target.value },
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {newIntegration.authType === 'basic' && (
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">Basic Auth 配置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label>用户名</label>
                      <Input
                        value={newIntegration.authConfig.username}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, username: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <label>密码</label>
                      <Input
                        type="password"
                        value={newIntegration.authConfig.password}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, password: e.target.value },
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {newIntegration.authType === 'bearer' && (
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">Bearer Token 配置</h4>
                  <div>
                    <label>Token</label>
                    <Input
                      value={newIntegration.authConfig.bearerToken}
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        authConfig: { ...prev.authConfig, bearerToken: e.target.value },
                      }))}
                    />
                  </div>
                </div>
              )}

              {newIntegration.authType === 'oauth2' && (
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">OAuth 2.0 配置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label>Client ID</label>
                      <Input
                        value={newIntegration.authConfig.clientId}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, clientId: e.target.value },
                        }))}
                      />
                    </div>
                    <div>
                      <label>Client Secret</label>
                      <Input
                        type="password"
                        value={newIntegration.authConfig.clientSecret}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, clientSecret: e.target.value },
                        }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label>Token URL</label>
                      <Input
                        value={newIntegration.authConfig.tokenUrl}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, tokenUrl: e.target.value },
                        }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label>Scopes (逗号分隔)</label>
                      <Input
                        value={(newIntegration.authConfig.scopes || []).join(', ')}
                        onChange={(e) => setNewIntegration(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, scopes: e.target.value.split(',').map(s => s.trim()) },
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-200 dark:border-neutral-700 my-4" />

              {/* 同步配置 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label>自动同步</label>
                  <input
                    type="checkbox"
                    checked={newIntegration.syncConfig.enabled}
                    onChange={(e) => setNewIntegration(prev => ({
                      ...prev,
                      syncConfig: { ...prev.syncConfig, enabled: e.target.checked },
                    }))}
                    className="rounded"
                  />
                </div>
                {newIntegration.syncConfig.enabled && (
                  <div>
                    <label>同步间隔 (分钟)</label>
                    <Input
                      type="number"
                      min="1"
                      value={newIntegration.syncConfig.interval}
                      onChange={(e) => setNewIntegration(prev => ({
                        ...prev,
                        syncConfig: { ...prev.syncConfig, interval: parseInt(e.target.value) || 60 },
                      }))}
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-700 my-4" />

              {/* 数据映射 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label>数据映射</label>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={handleAddMapping}
                  >
                    添加映射
                  </Button>
                </div>
                {newIntegration.dataMapping.map((mapping, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <Input
                      value={mapping.sourceField}
                      onChange={(e) => {
                        const newMappings = [...newIntegration.dataMapping]
                        newMappings[index].sourceField = e.target.value
                        setNewIntegration(prev => ({ ...prev, dataMapping: newMappings }))
                      }}
                      placeholder="源字段"
                    />
                    <Input
                      value={mapping.targetField}
                      onChange={(e) => {
                        const newMappings = [...newIntegration.dataMapping]
                        newMappings[index].targetField = e.target.value
                        setNewIntegration(prev => ({ ...prev, dataMapping: newMappings }))
                      }}
                      placeholder="目标字段"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={mapping.transform}
                        onChange={(e) => {
                          const newMappings = [...newIntegration.dataMapping]
                          newMappings[index].transform = e.target.value
                          setNewIntegration(prev => ({ ...prev, dataMapping: newMappings }))
                        }}
                        placeholder="转换函数"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleRemoveMapping(index)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleCreateIntegration}>
                  创建
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑集成对话框 */}
        {isEditDialogOpen && editingIntegration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">编辑API集成</h3>
            {editingIntegration && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label>集成名称</label>
                    <Input
                      value={editingIntegration.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingIntegration(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="输入集成名称"
                    />
                  </div>
                  <div>
                    <label>集成类型</label>
                    <Select
                      value={editingIntegration.type}
                      onChange={(v) => setEditingIntegration(prev => prev ? { ...prev, type: v as IntegrationType } : null)}
                    >
                      <option value="rest">REST API</option>
                      <option value="graphql">GraphQL</option>
                      <option value="soap">SOAP</option>
                      <option value="odata">OData</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label>描述</label>
                  <Textarea
                    value={editingIntegration.description}
                    onChange={(e) => setEditingIntegration(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="输入集成描述"
                  />
                </div>

                <div>
                  <label>基础URL</label>
                  <Input
                    value={editingIntegration.baseUrl}
                    onChange={(e) => setEditingIntegration(prev => prev ? { ...prev, baseUrl: e.target.value } : null)}
                    placeholder="输入API基础URL"
                  />
                </div>

                <div>
                  <label>认证类型</label>
                  <Select
                    value={editingIntegration.authType}
                    onChange={(v) => setEditingIntegration(prev => prev ? { ...prev, authType: v as AuthType } : null)}
                  >
                    <option value="none">无认证</option>
                    <option value="api_key">API Key</option>
                    <option value="basic">Basic Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="oauth2">OAuth 2.0</option>
                  </Select>
                </div>

                {/* 认证配置 */}
                {editingIntegration.authType === 'api_key' && (
                  <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <h4 className="text-sm font-medium mb-2">API Key 配置</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label>API Key</label>
                        <Input
                          value={editingIntegration.authConfig.apiKey || ''}
                          onChange={(e) => setEditingIntegration(prev => prev ? ({
                            ...prev,
                            authConfig: { ...prev.authConfig, apiKey: e.target.value },
                          }) : null)}
                        />
                      </div>
                      <div>
                        <label>Header 名称</label>
                        <Input
                          value={editingIntegration.authConfig.apiKeyHeader || ''}
                          onChange={(e) => setEditingIntegration(prev => prev ? ({
                            ...prev,
                            authConfig: { ...prev.authConfig, apiKeyHeader: e.target.value },
                          }) : null)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 其他认证类型配置... */}

                <div className="border-t border-neutral-200 dark:border-neutral-700 my-4" />

                {/* 同步配置 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label>自动同步</label>
                    <input
                      type="checkbox"
                      checked={editingIntegration.syncConfig.enabled}
                      onChange={(e) => setEditingIntegration(prev => prev ? ({
                        ...prev,
                        syncConfig: { ...prev.syncConfig, enabled: e.target.checked },
                      }) : null)}
                      className="rounded"
                    />
                  </div>
                  {editingIntegration.syncConfig.enabled && (
                    <div>
                      <label>同步间隔 (分钟)</label>
                      <Input
                        type="number"
                        min="1"
                        value={editingIntegration.syncConfig.interval}
                        onChange={(e) => setEditingIntegration(prev => prev ? ({
                          ...prev,
                          syncConfig: { ...prev.syncConfig, interval: parseInt(e.target.value) || 60 },
                        }) : null)}
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-700 my-4" />

                {/* 数据映射 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label>数据映射</label>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={handleAddEditMapping}
                    >
                      添加映射
                    </Button>
                  </div>
                  {editingIntegration.dataMapping.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                      <Input
                        value={mapping.sourceField}
                        onChange={(e) => {
                          if (editingIntegration) {
                            const newMappings = [...editingIntegration.dataMapping]
                            newMappings[index].sourceField = e.target.value
                            setEditingIntegration({ ...editingIntegration, dataMapping: newMappings })
                          }
                        }}
                        placeholder="源字段"
                      />
                      <Input
                        value={mapping.targetField}
                        onChange={(e) => {
                          if (editingIntegration) {
                            const newMappings = [...editingIntegration.dataMapping]
                            newMappings[index].targetField = e.target.value
                            setEditingIntegration({ ...editingIntegration, dataMapping: newMappings })
                          }
                        }}
                        placeholder="目标字段"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={mapping.transform || ''}
                          onChange={(e) => {
                            if (editingIntegration) {
                              const newMappings = [...editingIntegration.dataMapping]
                              newMappings[index].transform = e.target.value
                              setEditingIntegration({ ...editingIntegration, dataMapping: newMappings })
                            }
                          }}
                          placeholder="转换函数"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => handleRemoveEditMapping(index)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleEditIntegration}>
                  保存
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 测试结果对话框 */}
        {testResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">测试结果</h3>
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-success-50 dark:bg-success-300/20 border-success-200 dark:border-success-800' : 'bg-error-50 dark:bg-error-300/20 border-error-200 dark:border-error-800'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 size={24} className="text-success-700 dark:text-success-600" />
                    ) : (
                      <AlertCircle size={24} className="text-error-600 dark:text-error-600" />
                    )}
                    <h4 className={`text-lg font-medium ${testResult.success ? 'text-success-800 dark:text-success-600' : 'text-error-800 dark:text-error-600'}`}>
                      {testResult.success ? '测试成功' : '测试失败'}
                    </h4>
                  </div>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {testResult.message}
                  </p>
                  {testResult.responseTime && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      响应时间: {testResult.responseTime}ms
                    </p>
                  )}
                  {testResult.statusCode && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      状态码: {testResult.statusCode}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="mt-1 text-xs text-error-500 dark:text-error-600">
                      错误: {testResult.error}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="primary" onClick={() => setTestResult(null)}>
                  关闭
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
