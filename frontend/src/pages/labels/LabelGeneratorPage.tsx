/**
 * 标签生成页面 — 深度完善版
 * Code128 + QR 标签生成，模板预设，批量生成，真实批次集成
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Barcode, QrCode, Printer, Download, Package, TestTube,
  RefreshCw, CheckCircle2, AlertTriangle, Layers, Eye,
  AlertCircle,
} from 'lucide-react'
import { labelApi, type EntityType, type LabelSize, type OutputFormat } from '@/api/label'
import { batchApi } from '@/api/batch'
import { useToast } from '@/components/ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/Common'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'

// ─── 标签模板预设 ─────────────────────────────────────────────
const TEMPLATE_PRESETS: { nameKey: string; recommendedKey: string; entity_type: EntityType; label_size: LabelSize; barcode_type: 'code128' | 'qr' | 'both'; example_name: string }[] = [
  { nameKey: 'pages.label.templates.batchLabel', recommendedKey: 'pages.label.templates.batchRecommended', entity_type: 'batch', label_size: 'large', barcode_type: 'both', example_name: '' },
  { nameKey: 'pages.label.templates.sampleLabel', recommendedKey: 'pages.label.templates.sampleRecommended', entity_type: 'sample', label_size: 'medium', barcode_type: 'qr', example_name: 'Sample-001' },
  { nameKey: 'pages.label.templates.ingredientLabel', recommendedKey: 'pages.label.templates.ingredientRecommended', entity_type: 'ingredient', label_size: 'small', barcode_type: 'code128', example_name: '黄芪提取物' },
  { nameKey: 'pages.label.templates.equipmentLabel', recommendedKey: 'pages.label.templates.equipmentRecommended', entity_type: 'equipment', label_size: 'medium', barcode_type: 'qr', example_name: 'HPLC-001' },
]

const ENTITY_TYPES: { value: EntityType; labelKey: string; icon: any; descKey: string }[] = [
  { value: 'batch', labelKey: 'pages.label.entityTypes.batch', icon: Package, descKey: 'pages.label.entityTypes.batchDesc' },
  { value: 'sample', labelKey: 'pages.label.entityTypes.sample', icon: TestTube, descKey: 'pages.label.entityTypes.sampleDesc' },
  { value: 'ingredient', labelKey: 'pages.label.entityTypes.ingredient', icon: Package, descKey: 'pages.label.entityTypes.ingredientDesc' },
  { value: 'equipment', labelKey: 'pages.label.entityTypes.equipment', icon: AlertTriangle, descKey: 'pages.label.entityTypes.equipmentDesc' },
]

const SIZE_OPTIONS: { value: LabelSize; labelKey: string; dims: string; recommendedKey: string }[] = [
  { value: 'small', labelKey: 'pages.label.sizes.small', dims: '20×10cm', recommendedKey: 'pages.label.sizes.smallRecommended' },
  { value: 'medium', labelKey: 'pages.label.sizes.medium', dims: '40×20cm', recommendedKey: 'pages.label.sizes.mediumRecommended' },
  { value: 'large', labelKey: 'pages.label.sizes.large', dims: '60×30cm', recommendedKey: 'pages.label.sizes.largeRecommended' },
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
  const { t, i18n } = useTranslation()
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntityId('')
       
      setEntityName('')
    }
  }, [entityType])

  // 从 URL 参数读取 entity_id（如 ?id=123）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlId = params.get('id')
    if (urlId && entityType === 'batch') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    addToast({ type: 'success', message: t('pages.label.templateApplied', { name: t(preset.nameKey) }) })
  }

  const handleGenerate = async (name: string) => {
    setGenError(null)
    if (!name.trim()) { addToast({ type: 'warning', message: t('pages.label.toastInputName') }); return }
    // 如果没有 entity_id，尝试从批次列表查找
    let resolvedId = parseInt(entityId)
    if (entityType === 'batch' && (!resolvedId || isNaN(resolvedId))) {
      const found = batchesData?.items?.find((b: any) => b.batch_code === name)
      if (found) resolvedId = found.id
      else if (!isNaN(resolvedId)) {
        // entityId 可能有值但 entityName 不同，直接用 entityId
      } else {
        addToast({ type: 'warning', message: t('pages.label.toastSelectBatch') })
        return
      }
    }
    if (entityType === 'batch' && (!resolvedId || isNaN(resolvedId))) {
      addToast({ type: 'warning', message: t('pages.label.toastSelectBatchId') })
      return
    }

    setLoading(true)
    try {
      const res = await labelApi.generate({
        entity_type: entityType,
        entity_id: resolvedId || 1,
        entity_name: name,
        label_size: labelSize,
        format: barcodeType,
        output_format: outputFormat,
      })
      if (!(res instanceof Blob)) throw new Error(t('pages.label.genFailed'))
      const url = URL.createObjectURL(res)
      if (!batchMode) setPreviewUrl(url)
      const histItem = { id: Date.now(), name, type: entityType, size: labelSize, format: outputFormat, date: new Date().toLocaleDateString(i18n.language) }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory); saveHistory(newHistory)
      if (batchMode) {
        setBatchResults(prev => [...prev, url])
        addToast({ type: 'success', message: t('pages.label.toastGenerated', { name }) })
      } else {
        addToast({ type: 'success', message: t('pages.label.toastGeneratedOk', { format: outputFormat.toUpperCase() }) })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? t('pages.label.genFailed')
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
      addToast({ type: 'success', message: t('pages.label.toastPreviewReady') })
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? t('pages.label.previewFailed')
      setGenError(msg)
      addToast({ type: 'error', message: msg })
    } finally { setLoading(false) }
  }

  const handleBatchGenerate = async () => {
    if (!batchNames.trim()) { addToast({ type: 'warning', message: t('pages.label.toastBatchNamesRequired') }); return }
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

  const inputClass = 'w-full px-[var(--space-apple-sm)] py-2 text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-transparent text-[var(--text-primary)] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <Barcode size={20} className="text-white/80 shrink-0" />
                {t('pages.label.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm">{t('pages.label.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] transition-colors">
                  <Layers size={12} />{t('pages.label.history', { count: history.length })}
                </button>
              )}
              <button onClick={() => navigate('/batches')}
                className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] transition-colors">
                <Package size={12} />{t('pages.label.batchManagement')}
              </button>
            </div>
          </div>
        </div>

        {/* 历史记录 */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t('pages.label.recentHistory')}</div>
                <button onClick={() => { setHistory([]); saveHistory([]) }} className="text-xs text-[var(--text-muted)] hover:text-danger-500">{t('pages.label.clearAll')}</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs">
                    <span className="font-mono text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]">{h.type}</span>
                    <span className="text-[var(--text-primary)]">{h.name}</span>
                    <span className="text-[var(--text-muted)]">· {h.size} · {h.format}</span>
                    <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)]">{h.date}</span>
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
                <Layers size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                {t('pages.label.quickTemplates')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[var(--space-apple-sm)]">
                {TEMPLATE_PRESETS.map(p => (
                  <button key={p.nameKey} onClick={() => applyTemplate(p)}
                    className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] hover:border-[var(--color-secondary)] hover:bg-[var(--color-secondary-container)] dark:hover:bg-[var(--color-secondary-container)]/20 dark:hover:border-[var(--color-secondary)] text-left transition-colors">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{t(p.nameKey)}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{t(p.recommendedKey)}</div>
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
                  <CardTitle as="h2" className="text-sm font-semibold">{t('pages.label.entityType')}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ENTITY_TYPES.map(item => (
                      <button key={item.value} onClick={() => setEntityType(item.value)}
                        className={`flex items-center gap-2 px-[var(--space-apple-sm)] py-2.5 rounded-[var(--radius-Apple-sm)] border text-sm transition-colors ${
                          entityType === item.value
                            ? 'border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 dark:border-[var(--color-secondary)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]'
                        }`}>
                        <item.icon size={14} />
                        <div className="text-left">
                          <div>{t(item.labelKey)}</div>
                          <div className="text-xs opacity-60">{t(item.descKey)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 实体信息 — 批次模式特殊处理 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">{t('pages.label.entityInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                  {entityType === 'batch' ? (
                    <div className="space-y-[var(--space-apple-sm)]">
                      {batchesLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : batchesData?.items?.length === 0 ? (
                        <div className="text-sm text-[var(--text-muted)] text-center py-[var(--space-apple-md)]">
                          {t('pages.label.noBatchesHint')}{' '}
                          <button onClick={() => navigate('/batches/new')} className="text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)] hover:underline font-medium min-h-[44px] inline-flex items-center px-1 -mx-1">{t('pages.label.createBatch')}</button>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-[var(--text-muted)]">{t('pages.label.batchSelectHint')}</div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {batchesData?.items?.map((b: any) => (
                              <button
                                key={b.id}
                                onClick={() => handleSelectBatch(b.id, b.batch_code)}
                                className={`w-full flex items-center justify-between px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm transition-colors ${
                                  entityId === String(b.id)
                                    ? 'bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 border border-[var(--color-secondary-border)] dark:border-[var(--color-secondary)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                                    : 'border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                }`}
                              >
                                <span className="font-mono text-xs text-[var(--color-primary-text)]">{b.batch_code}</span>
                                <span className="text-xs text-[var(--text-muted)] truncate max-w-[180px]">{b.formula_name || b.formula_code}</span>
                                <span className="text-xs text-[var(--text-muted)]">{b.status}</span>
                              </button>
                            ))}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{t('pages.label.totalBatches', { count: batchesData?.total ?? 0 })}</div>
                        </>
                      )}
                      {/* 手动覆盖（可选） */}
                      <div className="pt-2 border-t border-[var(--border-color)]">
                        <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.label.customName')}</label>
                        <Input value={entityName} onChange={e => setEntityName(e.target.value)}
                          placeholder={t('pages.label.customNamePlaceholder')} className={inputClass} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-[var(--space-apple-sm)]">
                      <div>
                        <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.label.entityId')}</label>
                        <Input value={entityId} onChange={e => setEntityId(e.target.value)}
                          placeholder={t('pages.label.entityIdPlaceholder')} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)] mb-1 block">{t('pages.label.entityName')}</label>
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
                  <CardTitle as="h2" className="text-sm font-semibold">{t('pages.label.barcodeType')}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                  <div className="flex gap-2">
                    {(['code128', 'qr', 'both'] as const).map(bt => (
                      <button key={bt} onClick={() => setBarcodeType(bt)}
                        className={`flex-1 px-[var(--space-apple-sm)] py-2 min-h-[44px] inline-flex items-center justify-center text-sm rounded-[var(--radius-Apple-sm)] border transition-colors ${
                          barcodeType === bt
                            ? 'border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 dark:border-[var(--color-secondary)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]'
                        }`}>
                        {bt === 'code128' ? <Barcode size={14} className="mx-auto mb-1" /> : bt === 'qr' ? <QrCode size={14} className="mx-auto mb-1" /> : <><Barcode size={12} /><QrCode size={12} /></>}
                        <div className="text-center">{bt === 'code128' ? 'Code128' : bt === 'qr' ? t('pages.label.qrCode') : t('pages.label.bothCodes')}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 尺寸与格式 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold">{t('pages.label.sizeAndFormat')}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-2 block">{t('pages.label.labelSize')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2">
                      {SIZE_OPTIONS.map(s => (
                        <button key={s.value} onClick={() => setLabelSize(s.value)}
                          className={`px-[var(--space-apple-sm)] py-2 text-sm rounded-[var(--radius-Apple-sm)] border transition-colors ${
                            labelSize === s.value
                              ? 'border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 dark:border-[var(--color-secondary)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                              : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]'
                          }`}>
                          <div>{t(s.labelKey)}</div>
                          <div className="text-xs text-[var(--text-muted)]">{s.dims}</div>
                          <div className="text-xs text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)] mt-0.5">{t(s.recommendedKey)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-2 block">{t('pages.label.outputFormat')}</label>
                    <div className="flex gap-2">
                      {FORMAT_OPTIONS.map(f => (
                        <button key={f.value} onClick={() => setOutputFormat(f.value)}
                          className={`flex-1 px-[var(--space-apple-sm)] py-2 min-h-[44px] inline-flex items-center justify-center text-sm rounded-[var(--radius-Apple-sm)] border transition-colors ${
                            outputFormat === f.value
                              ? 'border-[var(--color-secondary)] bg-[var(--color-secondary-container)] dark:bg-[var(--color-secondary-container)]/20 dark:border-[var(--color-secondary)] text-[var(--color-secondary-text)] dark:text-[var(--color-secondary-text)]'
                              : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)]'
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
                      <Layers size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                      {t('pages.label.batchGenerate')}
                    </CardTitle>
                    <Button variant={batchMode ? 'secondary' : 'outline'} size="sm" onClick={() => setBatchMode(!batchMode)}
                      className="text-xs">
                      {batchMode ? t('pages.label.singleMode') : t('pages.label.batchMode')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
                  {batchMode ? (
                    <div className="space-y-[var(--space-apple-sm)]">
                      <textarea value={batchNames} onChange={e => setBatchNames(e.target.value)}
                        placeholder={t('pages.label.batchNamesPlaceholder')}
                        rows={4}
                        className="w-full px-[var(--space-apple-sm)] py-2 text-sm rounded-[var(--radius-Apple-sm)] border border-input bg-[var(--bg-tertiary)] text-[var(--text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                      <Button variant="secondary" onClick={handleBatchGenerate} disabled={loading || !batchNames.trim()}
                        className="w-full" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                        {t('pages.label.batchGenerateBtn', { count: batchNames.split('\n').filter(n => n.trim()).length })}
                      </Button>
                      {batchResults.length > 0 && (
                        <div className="text-xs text-[var(--text-muted)]">{t('pages.label.generatedCount', { count: batchResults.length })}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text-muted)] text-center py-2">{t('pages.label.batchModeHint')}</div>
                  )}
                </CardContent>
              </Card>

              {/* 生成按钮 */}
              {!batchMode && (
                <div className="space-y-2">
                  <Button variant="secondary" onClick={() => handleGenerate(entityName || entityType === 'batch' ? 'BATCH-TEST' : 'LABEL-TEST')}
                    disabled={loading || (entityType !== 'batch' && !entityName.trim())}
                    className="w-full py-[var(--space-apple-md)]"
                    icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
                    {loading ? t('pages.label.generating') : t('pages.label.generateLabel')}
                  </Button>
                  <Button variant="outline" onClick={handlePreview} disabled={loading || (entityType !== 'batch' && !entityName.trim())}
                    className="w-full" icon={<Eye size={14} />}>
                    {t('pages.label.serverPreview')}
                  </Button>
                  {genError && (
                    <div className="flex items-center gap-2 px-[var(--space-apple-sm)] py-2 bg-danger-50 dark:bg-danger-950/20 rounded-[var(--radius-Apple-sm)] text-xs text-danger-600 dark:text-danger-600 border border-danger-200 dark:border-danger-900">
                      <AlertCircle size={14} />{genError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 预览面板 */}
            <div className="space-y-[var(--space-apple-md)]">
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[var(--color-secondary-text)]0 dark:text-[var(--color-secondary-text)]" />
                    {t('pages.label.labelPreview')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-md)]">
                  {previewUrl ? (
                    <div className="space-y-[var(--space-apple-md)]">
                      <div className="aspect-video bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] flex items-center justify-center overflow-hidden border border-[var(--border-color)]">
                        <img src={previewUrl} alt={t('pages.label.previewAlt')} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex gap-[var(--space-apple-sm)]">
                        <Button variant="outline" onClick={() => handleDownload()} className="flex-1" icon={<Download size={14} />}>
                          {t('pages.label.download')}
                        </Button>
                        <Button variant="outline" onClick={handlePrint} className="flex-1" icon={<Printer size={14} />}>
                          {t('pages.label.print')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] flex flex-col items-center justify-center text-[var(--text-muted)] border border-[var(--border-color)]">
                      <Barcode size={32} className="mb-2 opacity-30" />
                      <p className="text-sm">{t('pages.label.previewEmptyHint')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 生成信息 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <CardTitle as="h3" className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    {t('pages.label.genInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex justify-between"><span>{t('pages.label.entityTypeInfo')}</span><span className="font-mono text-[var(--text-primary)]">{entityType}</span></div>
                  <div className="flex justify-between"><span>{t('pages.label.entityNameInfo')}</span><span className="font-mono text-[var(--text-primary)]">{entityName || '—'}</span></div>
                  <div className="flex justify-between"><span>{t('pages.label.entityIdInfo')}</span><span className="font-mono text-[var(--text-primary)]">{entityId || '—'}</span></div>
                  <div className="flex justify-between"><span>{t('pages.label.barcodeTypeInfo')}</span><span className="font-mono text-[var(--text-primary)]">{barcodeType === 'both' ? 'Code128+QR' : barcodeType}</span></div>
                  <div className="flex justify-between"><span>{t('pages.label.sizeInfo')}</span><span className="font-mono text-[var(--text-primary)]">{SIZE_OPTIONS.find(s => s.value === labelSize)?.dims}</span></div>
                  <div className="flex justify-between"><span>{t('pages.label.formatInfo')}</span><span className="font-mono text-[var(--text-primary)]">{outputFormat.toUpperCase()}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
