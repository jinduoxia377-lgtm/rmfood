/**
 * 标签生成页面 — 深度完善版
 * Code128 + QR 标签生成，模板预设，批量生成，真实批次集成
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Barcode, QrCode, Printer, Download, Package, TestTube,
  RefreshCw, CheckCircle2, AlertTriangle, Layers, Plus, Trash2, Eye,
  AlertCircle, CheckCircle,
} from 'lucide-react'
import { labelApi, type EntityType, type LabelSize, type OutputFormat } from '@/api/label'
import { batchApi } from '@/api/batch'
import { useToast } from '@/components/ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/Common'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@/components/ui'

// ─── 标签模板预设 ─────────────────────────────────────────────
const TEMPLATE_PRESETS: { name: string; entity_type: EntityType; label_size: LabelSize; barcode_type: 'code128' | 'qr' | 'both'; example_name: string; recommended: string }[] = [
  { name: '批记录标签', entity_type: 'batch', label_size: 'large', barcode_type: 'both', example_name: '', recommended: '生产批号管理（从列表选择）' },
  { name: '样品标签', entity_type: 'sample', label_size: 'medium', barcode_type: 'qr', example_name: 'Sample-001', recommended: '实验样品追踪' },
  { name: '原料标签', entity_type: 'ingredient', label_size: 'small', barcode_type: 'code128', example_name: '黄芪提取物', recommended: '中药材/辅料' },
  { name: '设备标签', entity_type: 'equipment', label_size: 'medium', barcode_type: 'qr', example_name: 'HPLC-001', recommended: '仪器设备管理' },
]

const ENTITY_TYPES: { value: EntityType; label: string; icon: any; desc: string }[] = [
  { value: 'batch', label: '批记录', icon: Package, desc: '生产批号管理' },
  { value: 'sample', label: '样品', icon: TestTube, desc: '实验样品追踪' },
  { value: 'ingredient', label: '原料', icon: Package, desc: '中药材/辅料' },
  { value: 'equipment', label: '设备', icon: AlertTriangle, desc: '仪器设备管理' },
]

const SIZE_OPTIONS: { value: LabelSize; label: string; dims: string; recommended: string }[] = [
  { value: 'small', label: '小号', dims: '20×10cm', recommended: '原料/小样' },
  { value: 'medium', label: '中号', dims: '40×20cm', recommended: '批记录/设备' },
  { value: 'large', label: '大号', dims: '60×30cm', recommended: '托盘/大宗' },
]

const FORMAT_OPTIONS: { value: OutputFormat; label: string; ext: string }[] = [
  { value: 'png', label: 'PNG', ext: 'png' },
  { value: 'svg', label: 'SVG', ext: 'svg' },
]

// ─── 本地存储 ────────────────────────────────────────────────
const HISTORY_KEY = 'rmfood_label_history'
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] } }
const saveHistory = (items: any[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)))

export default function LabelGeneratorPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [entityType, setEntityType] = useState<EntityType>('batch')
  const [entityName, setEntityName] = useState('')
  const [entityId, setEntityId] = useState('')
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png')
  const [barcodeType, setBarcodeType] = useState<'code128' | 'qr' | 'both'>('both')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [batchNames, setBatchNames] = useState('')
  const [batchResults, setBatchResults] = useState<string[]>([])
  const [genError, setGenError] = useState<string | null>(null)

  // 加载真实批次列表（仅当 entity_type 为 batch 时查询）
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches_for_labels'],
    queryFn: () => batchApi.list({ page: 1, page_size: 50 }),
    enabled: entityType === 'batch',
    staleTime: 30_000,
  })

  // 切换实体类型时清空之前的选择
  useEffect(() => {
    if (entityType !== 'batch') {
      setEntityId('')
      setEntityName('')
    }
  }, [entityType])

  // 从 URL 参数读取 entity_id（如 ?id=123）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('id')
    if (urlId && entityType === 'batch') {
      setEntityId(urlId)
      // 查找对应批次名称
      const found = batchesData?.items?.find((b: any) => String(b.id) === urlId)
      if (found?.batch_code) setEntityName(found.batch_code)
    }
  }, [entityType, batchesData])

  // 从批次列表中选择
  const handleSelectBatch = (batchId: number, batchCode: string) => {
    setEntityId(String(batchId))
    setEntityName(batchCode)
  }

  const applyTemplate = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setEntityType(preset.entity_type)
    setLabelSize(preset.label_size)
    setBarcodeType(preset.barcode_type)
    if (preset.example_name) setEntityName(preset.example_name)
    addToast({ type: 'success', message: `已应用「${preset.name}」模板` })
  }

  const handleGenerate = async (name: string) => {
    setGenError(null)
    if (!name.trim()) { addToast({ type: 'warning', message: '请输入实体名称' }); return }
    // 如果没有 entity_id，尝试从批次列表查找
    let resolvedId = parseInt(entityId)
    if (entityType === 'batch' && (!resolvedId || isNaN(resolvedId))) {
      const found = batchesData?.items?.find((b: any) => b.batch_code === name)
      if (found) resolvedId = found.id
      else if (!isNaN(resolvedId)) {
        // entityId 可能有值但 entityName 不同，直接用 entityId
      } else {
        addToast({ type: 'warning', message: '批记录模式需选择已有批次或输入批次名称' })
        return
      }
    }
    if (entityType === 'batch' && (!resolvedId || isNaN(resolvedId))) {
      addToast({ type: 'warning', message: '请先从批次列表选择一个批次，或填写实体ID' })
      return
    }

    setLoading(true)
    try {
      const res = await labelApi.generate({
        entity_type: entityType,
        entity_id: resolvedId || 1,
        entity_name: name,
        label_size: labelSize,
        format: barcodeType as any,
        output_format: outputFormat,
      })
      if (!(res instanceof Blob)) throw new Error('服务器返回无效响应')
      const url = URL.createObjectURL(res)
      if (!batchMode) setPreviewUrl(url)
      const histItem = { id: Date.now(), name, type: entityType, size: labelSize, format: outputFormat, date: new Date().toLocaleDateString('zh-CN') }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory); saveHistory(newHistory)
      if (batchMode) {
        setBatchResults(prev => [...prev, url])
        addToast({ type: 'success', message: `已生成标签：${name}` })
      } else {
        addToast({ type: 'success', message: `标签已生成（${outputFormat.toUpperCase()}）` })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? '标签生成失败'
      setGenError(msg)
      addToast({ type: 'error', message: msg })
    } finally { setLoading(false) }
  }

  const handlePreview = async () => {
    setGenError(null)
    const name = entityName.trim() || '预览'
    let resolvedId = parseInt(entityId)
    if (entityType === 'batch' && (!resolvedId || isNaN(resolvedId))) {
      const found = batchesData?.items?.find((b: any) => b.batch_code === name)
      resolvedId = found?.id ?? 1
    }
    setLoading(true)
    try {
      const data = await labelApi.preview({
        entity_type: entityType,
        entity_id: resolvedId || 1,
        entity_name: name,
        label_size: labelSize,
        format: barcodeType,
      })
      setPreviewUrl(data.data_url)
      addToast({ type: 'success', message: '预览已生成' })
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? '预览生成失败'
      setGenError(msg)
      addToast({ type: 'error', message: msg })
    } finally { setLoading(false) }
  }

  const handleBatchGenerate = async () => {
    if (!batchNames.trim()) { addToast({ type: 'warning', message: '请输入实体名称（每行一个）' }); return }
    const names = batchNames.split('\n').filter(n => n.trim())
    if (names.length === 0) return
    setBatchMode(true); setBatchResults([])
    for (const name of names) {
      await handleGenerate(name.trim())
    }
    setBatchMode(false)
  }

  const handleDownload = (url?: string) => {
    const targetUrl = url || previewUrl
    if (!targetUrl) return
    const a = document.createElement('a')
    a.href = targetUrl
    a.download = `label_${entityName}_${Date.now()}.${outputFormat}`
    a.click()
  }

  const handlePrint = () => {
    if (!previewUrl) return
    window.open(previewUrl, '_blank')?.print()
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-input bg-transparent text-neutral-900 dark:text-neutral-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <Barcode size={20} className="text-white/80 shrink-0" />
                标签生成器
              </h2>
              <p className="mt-1 text-white/80 text-sm">Code128 · QR · 模板预设 · 批量生成 · 打印下载</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-neutral-900/15 hover:bg-white dark:bg-neutral-900/25 rounded-full transition-colors">
                  <Layers size={12} />历史 ({history.length})
                </button>
              )}
              <button onClick={() => navigate('/batches')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-neutral-900/15 hover:bg-white dark:bg-neutral-900/25 rounded-full transition-colors">
                <Package size={12} />批记录管理
              </button>
            </div>
          </div>
        </div>

        {/* 历史记录 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">最近生成历史</div>
                <button onClick={() => { setHistory([]); saveHistory([]) }} className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-danger-500">清除全部</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs">
                    <span className="font-mono text-secondary-600 dark:text-secondary-400">{h.type}</span>
                    <span className="text-neutral-700 dark:text-neutral-300">{h.name}</span>
                    <span className="text-neutral-400 dark:text-neutral-500">· {h.size} · {h.format}</span>
                    <span className="text-neutral-300 dark:text-neutral-500">{h.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* 模板预设 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                <Layers size={14} className="text-secondary-500 dark:text-secondary-400" />
                快速模板
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TEMPLATE_PRESETS.map(p => (
                  <button key={p.name} onClick={() => applyTemplate(p)}
                    className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-950/20 dark:hover:border-secondary-700 text-left transition-colors">
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{p.name}</div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{p.recommended}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 配置面板 */}
            <div className="space-y-6">
              {/* 实体类型 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">实体类型</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {ENTITY_TYPES.map(t => (
                      <button key={t.value} onClick={() => setEntityType(t.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          entityType === t.value
                            ? 'border-secondary-400 bg-secondary-50 dark:bg-secondary-950/20 dark:border-secondary-700 text-secondary-700 dark:text-secondary-400'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                        }`}>
                        <t.icon size={14} />
                        <div className="text-left">
                          <div>{t.label}</div>
                          <div className="text-xs opacity-60">{t.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 实体信息 — 批次模式特殊处理 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">实体信息</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-3">
                  {entityType === 'batch' ? (
                    <div className="space-y-3">
                      {batchesLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : batchesData?.items?.length === 0 ? (
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-3">
                          暂无批记录，请先{' '}
                          <button onClick={() => navigate('/batches/new')} className="text-secondary-500 dark:text-secondary-400 hover:underline font-medium">创建批记录</button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">从现有批次中选择（或手动输入名称）</div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {batchesData?.items?.map((b: any) => (
                              <button
                                key={b.id}
                                onClick={() => handleSelectBatch(b.id, b.batch_code)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                  entityId === String(b.id)
                                    ? 'bg-secondary-50 dark:bg-secondary-950/20 border border-secondary-300 dark:border-secondary-700 text-secondary-700 dark:text-secondary-400'
                                    : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                <span className="font-mono text-xs text-primary-600 dark:text-primary-400">{b.batch_code}</span>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[180px]">{b.formula_name || b.formula_code}</span>
                                <span className="text-xs text-neutral-400 dark:text-neutral-500">{b.status}</span>
                              </button>
                            ))}
                          </div>
                          <div className="text-xs text-neutral-400 dark:text-neutral-500">共 {batchesData?.total ?? 0} 条批记录</div>
                        </>
                      )}
                      {/* 手动覆盖（可选） */}
                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">自定义名称（可选）</label>
                        <Input value={entityName} onChange={e => setEntityName(e.target.value)}
                          placeholder="留空则使用所选批次名称" className={inputClass} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">实体 ID（可选）</label>
                        <Input value={entityId} onChange={e => setEntityId(e.target.value)}
                          placeholder="用于数据库关联的数字 ID" className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">实体名称 *</label>
                        <Input value={entityName} onChange={e => setEntityName(e.target.value)}
                          placeholder={`例如：${entityType === 'sample' ? 'Sample-001' : entityType === 'ingredient' ? '黄芪提取物' : '设备编号'}`} className={inputClass} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 条码类型 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">条码类型</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="flex gap-2">
                    {(['code128', 'qr', 'both'] as const).map(t => (
                      <button key={t} onClick={() => setBarcodeType(t)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          barcodeType === t
                            ? 'border-secondary-400 bg-secondary-50 dark:bg-secondary-950/20 dark:border-secondary-700 text-secondary-700 dark:text-secondary-400'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                        }`}>
                        {t === 'code128' ? <Barcode size={14} className="mx-auto mb-1" /> : t === 'qr' ? <QrCode size={14} className="mx-auto mb-1" /> : <><Barcode size={12} /><QrCode size={12} /></>}
                        <div className="text-center">{t === 'code128' ? 'Code128' : t === 'qr' ? 'QR码' : '双码'}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 尺寸与格式 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">尺寸与格式</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  <div>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 block">标签尺寸</label>
                    <div className="grid grid-cols-3 gap-2">
                      {SIZE_OPTIONS.map(s => (
                        <button key={s.value} onClick={() => setLabelSize(s.value)}
                          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                            labelSize === s.value
                              ? 'border-secondary-400 bg-secondary-50 dark:bg-secondary-950/20 dark:border-secondary-700 text-secondary-700 dark:text-secondary-400'
                              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                          }`}>
                          <div>{s.label}</div>
                          <div className="text-xs text-neutral-400 dark:text-neutral-500">{s.dims}</div>
                          <div className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">{s.recommended}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-2 block">输出格式</label>
                    <div className="flex gap-2">
                      {FORMAT_OPTIONS.map(f => (
                        <button key={f.value} onClick={() => setOutputFormat(f.value)}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                            outputFormat === f.value
                              ? 'border-secondary-400 bg-secondary-50 dark:bg-secondary-950/20 dark:border-secondary-700 text-secondary-700 dark:text-secondary-400'
                              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-800'
                          }`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 批量生成 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                      <Layers size={14} className="text-secondary-500 dark:text-secondary-400" />
                      批量生成
                    </CardTitle>
                    <Button variant={batchMode ? 'secondary' : 'outline'} size="sm" onClick={() => setBatchMode(!batchMode)}
                      className="text-xs">
                      {batchMode ? '单标签模式' : '批量模式'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-3">
                  {batchMode ? (
                    <div className="space-y-3">
                      <textarea value={batchNames} onChange={e => setBatchNames(e.target.value)}
                        placeholder="每行一个名称：\nBATCH-2024-001\nBATCH-2024-002\nBATCH-2024-003"
                        rows={4}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                      <Button variant="secondary" onClick={handleBatchGenerate} disabled={loading || !batchNames.trim()}
                        className="w-full" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                        批量生成（{batchNames.split('\n').filter(n => n.trim()).length} 个）
                      </Button>
                      {batchResults.length > 0 && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">已生成 {batchResults.length} 个标签</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-2">开启批量模式后可一次生成多个标签</div>
                  )}
                </CardContent>
              </Card>

              {/* 生成按钮 */}
              {!batchMode && (
                <div className="space-y-2">
                  <Button variant="secondary" onClick={() => handleGenerate(entityName || entityType === 'batch' ? 'BATCH-TEST' : 'LABEL-TEST')}
                    disabled={loading || (entityType !== 'batch' && !entityName.trim())}
                    className="w-full py-3"
                    icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                    {loading ? '生成中...' : '生成标签'}
                  </Button>
                  <Button variant="outline" onClick={handlePreview} disabled={loading || (entityType !== 'batch' && !entityName.trim())}
                    className="w-full" icon={<Eye size={14} />}>
                    服务端预览
                  </Button>
                  {genError && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-danger-50 dark:bg-danger-950/20 rounded-lg text-xs text-danger-600 dark:text-danger-400 border border-danger-200 dark:border-danger-900">
                      <AlertCircle size={14} />{genError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 预览面板 */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-secondary-500 dark:text-secondary-400" />
                    标签预览
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  {previewUrl ? (
                    <div className="space-y-4">
                      <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center overflow-hidden border border-neutral-200 dark:border-neutral-700">
                        <img src={previewUrl} alt="标签预览" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => handleDownload()} className="flex-1" icon={<Download size={14} />}>
                          下载
                        </Button>
                        <Button variant="outline" onClick={handlePrint} className="flex-1" icon={<Printer size={14} />}>
                          打印
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-neutral-50 dark:bg-neutral-800/50 rounded-lg flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                      <Barcode size={32} className="mb-2 opacity-30" />
                      <p className="text-sm">配置参数后点击「生成标签」</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 生成信息 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    生成信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <div className="flex justify-between"><span>实体类型</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{entityType}</span></div>
                  <div className="flex justify-between"><span>实体名称</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{entityName || '—'}</span></div>
                  <div className="flex justify-between"><span>实体 ID</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{entityId || '—'}</span></div>
                  <div className="flex justify-between"><span>条码类型</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{barcodeType === 'both' ? 'Code128+QR' : barcodeType}</span></div>
                  <div className="flex justify-between"><span>尺寸</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{SIZE_OPTIONS.find(s => s.value === labelSize)?.dims}</span></div>
                  <div className="flex justify-between"><span>格式</span><span className="font-mono text-neutral-700 dark:text-neutral-300">{outputFormat.toUpperCase()}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
