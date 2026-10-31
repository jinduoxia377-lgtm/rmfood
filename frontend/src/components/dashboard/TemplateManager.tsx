/**
 * 仪表板模板管理组件
 * - 导入/导出仪表板模板
 * - 管理保存的模板
 * - 应用模板到仪表板
 */
import { useState, useRef, useEffect } from 'react'
import { Download, Upload, Save, Trash2, CheckCircle2, FileText, Share2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'
import type { DashboardLayout } from '@/config/dashboard'
import DashboardConfigManager from '@/config/dashboard'
import { logger } from '@/utils/safeLogger';


interface TemplateManagerProps {
  currentLayout: DashboardLayout
  onUpdate: (layout: DashboardLayout) => void
  className?: string
}

interface DashboardTemplate {
  id: string
  name: string
  description: string
  layout: DashboardLayout
  createdAt: string
  updatedAt: string
}

export function TemplateManager({ currentLayout, onUpdate, className }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([])
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 挂载时从 localStorage 加载已保存的模板
  useEffect(() => {
    const savedTemplates = localStorage.getItem('rmfood_dashboard_templates')
    if (savedTemplates) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTemplates(JSON.parse(savedTemplates))
      } catch (error) {
        logger.error('Error loading templates:', error)
      }
    }
  }, [])

  const saveTemplates = (newTemplates: DashboardTemplate[]) => {
    setTemplates(newTemplates)
    localStorage.setItem('rmfood_dashboard_templates', JSON.stringify(newTemplates))
  }

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return

    const newTemplate: DashboardTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      layout: currentLayout,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updatedTemplates = [...templates, newTemplate]
    saveTemplates(updatedTemplates)
    setIsSaveDialogOpen(false)
    setTemplateName('')
    setTemplateDescription('')
  }

  const handleApplyTemplate = (template: DashboardTemplate) => {
    const newLayout = {
      ...template.layout,
      id: currentLayout.id,
      name: currentLayout.name,
      isDefault: currentLayout.isDefault,
    }
    onUpdate(newLayout)
    DashboardConfigManager.saveLayout(newLayout)
  }

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId)
    saveTemplates(updatedTemplates)
  }

  const handleExportTemplate = (template: DashboardTemplate) => {
    const templateData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      template,
    }

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name}_template.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCurrent = () => {
    const templateData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      template: {
        id: `template_${Date.now()}`,
        name: currentLayout.name,
        description: 'Exported dashboard layout',
        layout: currentLayout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentLayout.name}_template.json`
    a.click()
    URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
  }

  const handleImportTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)

        if (!data.template?.layout) {
          setImportError('无效的模板文件格式')
          return
        }

        const importedTemplate: DashboardTemplate = {
          id: `template_${Date.now()}`,
          name: data.template.name,
          description: data.template.description || 'Imported template',
          layout: data.template.layout,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        const updatedTemplates = [...templates, importedTemplate]
        saveTemplates(updatedTemplates)
        setImportError('')
        setIsImportDialogOpen(false)

        // 重置文件输入
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error) {
        setImportError('导入失败：文件格式错误')
        logger.error('Error importing template:', error)
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-secondary-600 dark:text-secondary-700" />
            <CardTitle as="h2" className="text-sm font-semibold">模板管理</CardTitle>
          </div>
          <Badge size="sm">{templates.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={16} />}
            onClick={() => setIsSaveDialogOpen(true)}
          >
            保存为模板
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={16} />}
            onClick={() => setIsImportDialogOpen(true)}
          >
            导入模板
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => setIsExportDialogOpen(true)}
          >
            导出当前布局
          </Button>
        </div>

        {/* 模板列表 */}
        <div className="mt-4 border rounded-lg">
          {templates.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                暂无保存的模板
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="py-3 px-4 border-b last:border-b-0 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      {template.name}
                    </p>
                    <Badge size="sm">
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      卡片数量: {template.layout.cards.length}
                    </span>
                    <span className="text-xs text-neutral-300 dark:text-neutral-400">·</span>
                    <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      最后更新: {new Date(template.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 size={14} />}
                    onClick={() => handleApplyTemplate(template)}
                  >
                    应用
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download size={14} />}
                    onClick={() => handleExportTemplate(template)}
                  >
                    导出
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 导入模板对话框 */}
        {isImportDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">导入模板</h3>
              {importError && (
                <div className="p-3 rounded-lg bg-error-50 dark:bg-error-300/15 border border-error-200 dark:border-error-800/30 mb-4">
                  <h4 className="text-sm font-medium text-error-800 dark:text-error-600 mb-1">导入失败</h4>
                  <p className="text-xs text-error-600 dark:text-error-600">{importError}</p>
                </div>
              )}
              <div className="space-y-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  选择JSON格式的模板文件进行导入
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplate}
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg" aria-label="选择文件" />
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsImportDialogOpen(false)}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 导出当前布局对话框 */}
        {isExportDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">导出当前布局</h3>
              <div className="space-y-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  将当前仪表板布局导出为JSON模板文件
                </p>
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <FileText size={24} className="text-secondary-600 dark:text-secondary-700" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {currentLayout.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        包含 {currentLayout.cards.length} 个卡片
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsExportDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleExportCurrent}>
                  导出
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 保存为模板对话框 */}
        {isSaveDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">保存为模板</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">模板名称</label>
                  <Input
                    placeholder="输入模板名称"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">描述（可选）</label>
                  <Input
                    placeholder="输入模板描述"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                  />
                </div>
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <Share2 size={24} className="text-secondary-600 dark:text-secondary-700" />
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        当前布局
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        包含 {currentLayout.cards.length} 个卡片
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsSaveDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 使用提示 */}
        <div className="mt-4 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-300/15 border border-secondary-100 dark:border-secondary-800/30">
          <div className="flex items-start gap-3">
            <FileText size={18} className="text-secondary-600 dark:text-secondary-700 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-secondary-800 dark:text-secondary-700 mb-1">模板管理提示</h4>
              <ul className="text-xs text-secondary-600 dark:text-secondary-700 space-y-1">
                <li>• 保存当前布局为模板，方便后续快速应用</li>
                <li>• 导入/导出模板，实现布局的备份和分享</li>
                <li>• 应用模板会覆盖当前仪表板布局</li>
                <li>• 模板文件为JSON格式，可手动编辑调整</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
