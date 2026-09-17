/**
 * 数据导出管理组件
 * - 支持多种格式导出
 * - 配置导出选项
 * - 管理导出任务
 * - 查看导出历史
 */
import { useState, useEffect } from 'react'
import { Download, FileText, Table, FileJson, Image, Clock, CheckCircle2, AlertCircle, Trash2, Settings } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Input, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { exportService, type ExportFormat, type ExportOptions, type ExportTask } from '@/services/exportService'
import { logger } from '@/utils/safeLogger';


interface ExportManagerProps {
  data?: any[]
  className?: string
}

export function ExportManager({ data, className }: ExportManagerProps) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<string>('csv')
  const [exportFilename, setExportFilename] = useState(`导出数据_${new Date().toISOString().slice(0, 10)}`)
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([])
  const [activeTab, setActiveTab] = useState('export')
  const [exportOptions, setExportOptions] = useState({
    csvOptions: {
      delimiter: ',',
      encoding: 'utf-8',
    },
    excelOptions: {
      sheetName: '数据',
      includeHeaders: true,
    },
    pdfOptions: {
      pageSize: 'a4',
      orientation: 'portrait',
      marginTop: 10,
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
    },
    pngOptions: {
      scale: 2,
      quality: 0.9,
      backgroundColor: 'var(--card-bg-solid, #ffffff)',
    },
    jsonOptions: {
      indent: 2,
      filterFields: [],
    },
  })

  // 模拟数据（如果没有提供）
  const mockData = data || [
    { id: 1, name: '配方A', status: 'draft', created_at: '2024-01-01' },
    { id: 2, name: '配方B', status: 'approved', created_at: '2024-01-02' },
    { id: 3, name: '配方C', status: 'pending_review', created_at: '2024-01-03' },
    { id: 4, name: '配方D', status: 'rejected', created_at: '2024-01-04' },
    { id: 5, name: '配方E', status: 'approved', created_at: '2024-01-05' },
  ]

  // 列配置
  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: '名称' },
    { key: 'status', label: '状态' },
    { key: 'created_at', label: '创建时间' },
  ]

  useEffect(() => {
    // 定期更新任务状态
    const interval = setInterval(() => {
      setExportTasks(exportService.getHistory() as unknown as ExportTask[])
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleExport = async () => {
    const options = {
      format: exportFormat as ExportFormat,
      filename: `${exportFilename}.${exportFormat}`,
      columns: columns as unknown,
      ...exportOptions,
    } as ExportOptions

    try {
      await exportService.export(mockData, options)
      setIsExportDialogOpen(false)
      // 重置表单
      setExportFormat('csv')
      setExportFilename(`导出数据_${new Date().toISOString().slice(0, 10)}`)
    } catch (error) {
      logger.error('导出失败:', error)
    }
  }

  const handleClearTasks = () => {
    exportService.clearHistory()
    setExportTasks([])
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv':
        return <FileText size={16} />
      case 'xlsx':
        return <Table size={16} />
      case 'pdf':
        return <FileText size={16} />
      case 'json':
        return <FileJson size={16} />
      case 'png':
        return <Image size={16} />
      default:
        return <FileText size={16} />
    }
  }

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'csv':
        return 'text-success-600 dark:text-success-400'
      case 'xlsx':
        return 'text-secondary-600 dark:text-secondary-400'
      case 'pdf':
        return 'text-error-600 dark:text-error-400'
      case 'json':
        return 'text-warning-600 dark:text-warning-400'
      case 'png':
        return 'text-accent-600 dark:text-accent-400'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success-600 dark:text-success-400'
      case 'processing':
        return 'text-secondary-600 dark:text-secondary-400'
      case 'failed':
        return 'text-error-600 dark:text-error-400'
      case 'pending':
        return 'text-warning-600 dark:text-warning-400'
      default:
        return 'text-neutral-600 dark:text-neutral-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'processing':
        return '处理中'
      case 'failed':
        return '失败'
      case 'pending':
        return '等待中'
      default:
        return status
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download size={20} className="text-secondary-600 dark:text-secondary-400" />
            <CardTitle as="h3" className="text-sm font-semibold">数据导出</CardTitle>
          </div>
          <Badge size="sm">{exportTasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="export" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="export">导出配置</TabsTrigger>
            <TabsTrigger value="history">导出历史</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-4">
            {/* 导出配置 */}
            <div className="space-y-4">
              <div>
                <label>导出格式</label>
                <Select value={exportFormat} onChange={(v) => setExportFormat(v)}>
                  <option value="csv">CSV (逗号分隔值)</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="pdf">PDF (文档)</option>
                  <option value="json">JSON (数据结构)</option>
                  <option value="png">PNG (截图)</option>
                </Select>
              </div>

              <div>
                <label>文件名</label>
                <Input
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  placeholder="输入导出文件名"
                />
              </div>

              {/* 格式特定选项 */}
              {exportFormat === 'csv' && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">CSV 选项</h4>
                  <div className="space-y-2">
                    <div>
                      <label>分隔符</label>
                      <Select
                        value={exportOptions.csvOptions.delimiter}
                        onChange={(v) => setExportOptions(prev => ({
                          ...prev,
                          csvOptions: { ...prev.csvOptions, delimiter: v },
                        }))}
                      >
                        <option value=",">逗号 (,)</option>
                        <option value=";">分号 (;)</option>
                        <option value="\t">制表符 (Tab)</option>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {exportFormat === 'xlsx' && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">Excel 选项</h4>
                  <div className="space-y-2">
                    <div>
                      <label>工作表名称</label>
                      <Input
                        value={exportOptions.excelOptions.sheetName}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          excelOptions: { ...prev.excelOptions, sheetName: e.target.value },
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {exportFormat === 'pdf' && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">PDF 选项</h4>
                  <div className="space-y-2">
                    <div>
                      <label>页面大小</label>
                      <Select
                        value={exportOptions.pdfOptions.pageSize}
                        onChange={(v) => setExportOptions(prev => ({
                          ...prev,
                          pdfOptions: { ...prev.pdfOptions, pageSize: v },
                        }))}
                      >
                        <option value="a4">A4</option>
                        <option value="letter">Letter</option>
                      </Select>
                    </div>
                    <div>
                      <label>页面方向</label>
                      <Select
                        value={exportOptions.pdfOptions.orientation}
                        onChange={(v) => setExportOptions(prev => ({
                          ...prev,
                          pdfOptions: { ...prev.pdfOptions, orientation: v },
                        }))}
                      >
                        <option value="portrait">纵向</option>
                        <option value="landscape">横向</option>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {exportFormat === 'png' && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">PNG 选项</h4>
                  <div className="space-y-2">
                    <div>
                      <label>缩放比例: {exportOptions.pngOptions.scale}x</label>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={exportOptions.pngOptions.scale}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          pngOptions: { ...prev.pngOptions, scale: parseFloat(e.target.value) },
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {exportFormat === 'json' && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-sm font-medium mb-2">JSON 选项</h4>
                  <div className="space-y-2">
                    <div>
                      <label>缩进空格: {exportOptions.jsonOptions.indent}</label>
                      <input
                        type="range"
                        min="0"
                        max="4"
                        step="1"
                        value={exportOptions.jsonOptions.indent}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          jsonOptions: { ...prev.jsonOptions, indent: parseInt(e.target.value) },
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="sm"
                icon={<Download size={16} />}
                onClick={() => setIsExportDialogOpen(true)}
              >
                开始导出
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {/* 导出历史 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">导出任务历史</h4>
                {exportTasks.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={handleClearTasks}
                  >
                    清空历史
                  </Button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                {exportTasks.length === 0 ? (
                  <div className="py-4">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
                      暂无导出任务
                    </p>
                  </div>
                ) : (
                  exportTasks.map((task) => (
                    <div key={task.id} className="py-3 px-4 border-b last:border-b-0 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={getFormatColor(task.format)}>
                            {getFormatIcon(task.format)}
                          </div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                            {task.filename}
                          </p>
                          <Badge className={getStatusColor(task.status)} size="sm">
                            {getStatusText(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock size={14} className="text-neutral-400" />
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {new Date(task.createdAt).toLocaleString()}
                          </span>
                          {task.completedAt && (
                            <>
                              <span className="text-xs text-neutral-300 dark:text-neutral-600">·</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                完成于 {new Date(task.completedAt).toLocaleTimeString()}
                              </span>
                            </>
                          )}
                        </div>
                        {task.error && (
                          <p className="text-xs text-error-500 mt-1">
                            错误: {task.error}
                          </p>
                        )}
                      </div>
                      <div>
                        {task.status === 'completed' && task.downloadUrl && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Download size={14} />}
                            onClick={() => {
                              const link = document.createElement('a')
                              link.href = task.downloadUrl as string
                              link.download = task.filename
                              link.click()
                            }}
                          >
                            下载
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 导出确认对话框 */}
        {isExportDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">确认导出</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600">
                  <div className="flex items-center gap-3">
                    <div className={getFormatColor(exportFormat)}>
                      {getFormatIcon(exportFormat)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {exportFilename}.{exportFormat}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        包含 {mockData.length} 条记录
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  确定要导出数据吗？
                </p>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <Button variant="secondary" onClick={() => setIsExportDialogOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleExport}>
                  确认导出
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
