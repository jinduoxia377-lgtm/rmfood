/**
 * 文档智能提取页面 — 完整功能版
 * CoA/PDS/SD 文本提取 + PDF解析 + 提取历史 + 结果对比
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText, Upload, AlertTriangle, CheckCircle2,
  FileCheck, Loader2, History, Trash2, Layers, Download,
} from 'lucide-react'
import { documentApi, documentArchiveApi, type DocumentType, type ExtractionResult, type ArchiveRecord } from '@/api/document'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui'

// ─── 本地存储 ────────────────────────────────────────────────
const HISTORY_KEY = 'rmfood_doc_history'
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] } }
const saveHistory = (items: any[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)))

// ─── 预填示例文本 ─────────────────────────────────────────────
const EXAMPLE_TEXTS: Record<DocumentType, string> = {
  coa: `检验报告
产品名称：黄芪多糖提取物
批号：HT2024001
规格：1kg/袋
检验项目：
1. 性状：淡黄色粉末
2. 鉴别： TLC对照，阳性
3. 含量测定：黄芪多糖≥95.0%（HPLC法）
4. 水分：≤5.0%（烘干失重法）
5. 灰分：≤5.0%
6. 重金属：铅≤2.0mg/kg，砷≤1.0mg/kg，汞≤0.5mg/kg
7. 微生物：细菌总数≤1000cfu/g，霉菌≤100cfu/g，酵母菌≤50cfu/g，大肠杆菌阴性，沙门氏菌阴性
结论：本品经检验，符合《中国药典》2020年版四部通则1185之规定，判定为合格。`,
  pds: `产品安全数据表（PDS）
产品名称：胶原蛋白肽粉
供应商：XX生物科技股份有限公司
产品编号：CP-2024-001
1. 成分信息
   - 主要成分：Ⅰ型胶原蛋白肽
   - 分子量：500-1000 Da
   - 蛋白质含量：≥90%
   - 水分：≤8%
2. 安全信息
   - 刺激性：无刺激性
   - 致敏性：低致敏性
   - 建议摄入量：每日5-10g
3. 储存条件
   - 储存温度：室温，避光
   - 有效期：24个月`,
  sd: `安全数据表（SDS）
化学品名称：柠檬酸
CAS号：77-92-9
1. 成分识别
   - 化学品名称：柠檬酸（Citric Acid）
   - 分子式：C6H8O7
   - 分子量：192.12 g/mol
2. 危险性识别
   - GHS分类：皮肤刺激类别2，严重眼损伤类别2
   - 信号词：警告
   - 危险说明：H315-H319
3. 急救措施
   - 皮肤接触：用大量水冲洗
   - 眼睛接触：用清水冲洗至少15分钟`,
}

// 置信度 → 设计令牌映射（阈值 0.85 / 0.6 → success / warning / danger）
const confClass = (conf: number) =>
  conf >= 0.85
    ? { card: 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/20 border-[var(--color-success-border)] dark:border-[var(--color-success-border)]', text: 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]', bar: 'bg-[var(--color-success-text)]' }
    : conf >= 0.6
      ? { card: 'bg-[var(--color-warning-container)] dark:bg-[var(--color-warning-container)]/20 border-[var(--color-warning-border)] dark:border-[var(--color-warning-border)]', text: 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]', bar: 'bg-[var(--color-warning-text)]' }
      : { card: 'bg-[var(--color-error-container)] dark:bg-[var(--color-error-container)]/20 border-[var(--color-error-border)] dark:border-[var(--color-error-border)]', text: 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]', bar: 'bg-[var(--color-error-text)]' }

export default function DocumentExtractPage() {
  const { t, i18n } = useTranslation()
  const { addToast } = useToast()
  const [docType, setDocType] = useState<DocumentType>('coa')
  const [textInput, setTextInput] = useState('')
  const [result, setResult] = useState<null | ExtractionResult>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [history, setHistory] = useState<any[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareResults, setCompareResults] = useState<ExtractionResult[]>([])
  const [archives, setArchives] = useState<ArchiveRecord[]>([])
  const [showArchives, setShowArchives] = useState(false)
  const [archivesLoading, setArchivesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [lastGeneratedCoaId, setLastGeneratedCoaId] = useState<number | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({})
  const [reviewed, setReviewed] = useState(false)
  const [reviewArchiveId, setReviewArchiveId] = useState<number | null>(null)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const docTypeLabel = (dt: DocumentType) => dt === 'coa' ? t('pages.document.coaType') : dt === 'pds' ? t('pages.document.pdsType') : t('pages.document.sdType')

  const handleTextExtract = async () => {
    if (!textInput.trim()) { addToast({ type: 'warning', message: t('pages.document.inputDocText') }); return }
    setLoading(true)
    try {
      const res = await documentApi.extractText(textInput, docType)
      // 后端返回 { status, data: ExtractionResult }，axios res.data 即该对象
      const data = (res.data as any)?.data ?? res.data
      setResult(data)
      // Save to history
      const count = Object.keys(data?.extracted_fields ?? {}).length
      const histItem = {
        id: Date.now(),
        type: docType,
        text: textInput.substring(0, 50) + (textInput.length > 50 ? '...' : ''),
        fields: count,
        confidence: data?.overall_confidence ?? 0,
        date: new Date().toLocaleDateString(i18n.language),
      }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
      addToast({ type: 'success', message: t('pages.document.extractedCount', { count }) })
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) })
    } finally { setLoading(false) }
  }

  const handleFileUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', docType)
    setLoading(true)
    setUploadedFileName(file.name)
    try {
      const res = await fetch('/api/v1/documents/extract', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.error ?? t('pages.document.uploadFailed'))
      const data = json.data
      setResult(data)
      const count = Object.keys(data?.extracted_fields ?? {}).length
      addToast({ type: 'success', message: t('pages.document.uploadedAuto', { name: file.name, count }) })
    } catch (e: any) {
      setUploadedFileName(null)
      addToast({ type: 'error', message: e.message ?? t('pages.document.uploadFailed') })
    } finally { setLoading(false) }
  }

  const overallConf = result ? result.overall_confidence : 0
  const conf = confClass(overallConf)

  const handleCompare = () => {
    if (result) {
      setCompareResults(prev => [...prev, result])
      addToast({ type: 'success', message: t('pages.document.addedToCompare', { count: compareResults.length + 1 }) })
    }
  }

  // ─── 备案：保存提取结果到后端数据库 ─────────────────────────
  const loadArchives = async () => {
    setArchivesLoading(true)
    try {
      const res = await documentArchiveApi.list({ limit: 50 })
      const data = (res.data as any)?.data ?? []
      setArchives(data)
    } catch {
      setArchives([])
    } finally {
      setArchivesLoading(false)
    }
  }

  const handleSaveArchive = async () => {
    if (!result) return
    setSaving(true)
    try {
      await documentArchiveApi.save({
        document_type: result.document_type,
        ingredient_id: (result as any)?.metadata?.ingredient_id ?? null,
        extracted_fields: result.extracted_fields,
        confidence_scores: result.confidence_scores,
        inspection_items: result.inspection_items,
        overall_confidence: result.overall_confidence,
        requires_review: result.requires_review,
        raw_text_preview: result.raw_text_preview,
      })
      addToast({ type: 'success', message: t('pages.document.archiveSaved') })
      await loadArchives()
    } catch (e: any) {
      addToast({ type: 'error', message: String(e?.message ?? e) })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteArchive = async (id: number) => {
    if (!window.confirm(t('pages.document.confirmDeleteArchive'))) return
    try {
      await documentArchiveApi.remove(id)
      setArchives(prev => prev.filter(a => a.id !== id))
      addToast({ type: 'success', message: t('pages.document.archiveDeleted') })
    } catch (e: any) {
      addToast({ type: 'error', message: String(e?.message ?? e) })
    }
  }

  const handleGeneratePeptideCoa = async (id: number) => {
    try {
      const res = await documentArchiveApi.toPeptideCoa(id)
      const coa = (res.data as any)?.data
      if (coa?.id) {
        setLastGeneratedCoaId(coa.id)
        addToast({ type: 'success', message: t('pages.document.peptideCoaGenerated', { id: coa.id }) })
      } else {
        addToast({ type: 'success', message: t('pages.document.peptideCoaGeneratedShort') })
      }
    } catch (e: any) {
      addToast({ type: 'error', message: String(e?.message ?? e) })
    }
  }

  // ─── 人工复核：修正低置信度字段值（结果 / 已备案记录） ───
  const openReview = () => {
    if (!result) return
    setReviewArchiveId(null)
    const draft: Record<string, string> = {}
    for (const [key, field] of Object.entries(result.extracted_fields)) {
      draft[key] = String(field.value ?? '')
    }
    setReviewDraft(draft)
    setReviewOpen(true)
  }

  const openArchiveReview = async (archiveId: number) => {
    try {
      const res = await documentArchiveApi.detail(archiveId)
      const detail = (res.data as any)?.data
      if (!detail?.extracted_fields) {
        addToast({ type: 'error', message: t('pages.document.cannotReadArchive') })
        return
      }
      setReviewArchiveId(archiveId)
      const draft: Record<string, string> = {}
      for (const [key, field] of Object.entries(detail.extracted_fields) as Array<[string, { value?: unknown }]>) {
        draft[key] = String((field as any)?.value ?? '')
      }
      setReviewDraft(draft)
      setReviewOpen(true)
    } catch (e: any) {
      addToast({ type: 'error', message: String(e?.message ?? e) })
    }
  }

  const confirmReview = async () => {
    if (reviewArchiveId != null) {
      // 备案记录复核：读取详情，更新后写回后端
      try {
        const res = await documentArchiveApi.detail(reviewArchiveId)
        const detail = (res.data as any)?.data
        if (!detail?.extracted_fields) {
          addToast({ type: 'error', message: t('pages.document.cannotReadArchive') })
          return
        }
        const updatedFields = { ...detail.extracted_fields }
        for (const [key, value] of Object.entries(reviewDraft)) {
          if (updatedFields[key]) {
            updatedFields[key] = { ...updatedFields[key], value }
          }
        }
        await documentArchiveApi.update(reviewArchiveId, {
          extracted_fields: updatedFields,
          confidence_scores: detail.confidence_scores ?? {},
          inspection_items: detail.inspection_items ?? [],
          overall_confidence: detail.overall_confidence ?? 0,
          requires_review: false, // 复核完成，清除复核标记
        })
        setReviewOpen(false)
        setReviewArchiveId(null)
        addToast({ type: 'success', message: t('pages.document.reviewDoneArchive') })
        await loadArchives()
      } catch (e: any) {
        addToast({ type: 'error', message: String(e?.message ?? e) })
      }
      return
    }

    // 当前提取结果复核：写回本地 result
    if (!result) return
    const updated: ExtractionResult = { ...result }
    updated.extracted_fields = { ...result.extracted_fields }
    for (const [key, value] of Object.entries(reviewDraft)) {
      if (updated.extracted_fields[key]) {
        updated.extracted_fields[key] = { ...updated.extracted_fields[key], value }
      }
    }
    setResult(updated)
    setReviewed(true)
    setReviewOpen(false)
    addToast({ type: 'success', message: t('pages.document.reviewDone') })
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 py-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <FileCheck size={20} className="text-white/80 shrink-0" />
                {t('pages.document.title')}
              </h1>
              <p className="mt-1 text-white/80 text-sm">{t('pages.document.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25 rounded-[var(--radius-pill)] transition-colors">
                  <History size={12} />{t('pages.document.history', { count: history.length })}
                </button>
              )}
              {compareResults.length > 0 && (
                <button onClick={() => setCompareMode(!compareMode)}
                  className={`flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium rounded-[var(--radius-pill)] transition-colors ${
                    compareMode ? 'bg-[var(--bg-secondary)]/30' : 'bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25'
                  }`}>
                  <Layers size={12} />{t('pages.document.compare', { count: compareResults.length })}
                </button>
              )}
              <button onClick={() => {
                if (!showArchives && archives.length === 0) loadArchives()
                setShowArchives(!showArchives)
              }}
                className={`flex items-center gap-1.5 px-[var(--space-apple-sm)] py-1.5 min-h-[44px] text-xs font-medium rounded-[var(--radius-pill)] transition-colors ${
                  showArchives ? 'bg-[var(--bg-secondary)]/30' : 'bg-[var(--bg-secondary)]/15 hover:bg-[var(--bg-secondary)]/25'
                }`}>
                <FileText size={12} />{t('pages.document.archive', { count: archives.length })}
              </button>
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">{t('pages.document.recentExtractionHistory')}</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-[var(--space-apple-sm)] py-1.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] text-xs border border-[var(--border-color)]">
                    <span className="font-mono text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]">{h.type.toUpperCase()}</span>
                    <span className="text-[var(--text-muted)]">{t('pages.document.fieldsCount', { count: h.fields })}</span>
                    <span className="text-[var(--text-muted)]">{t('pages.document.confidencePercent', { value: (h.confidence * 100).toFixed(0) })}</span>
                    <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)]">{h.date}</span>
                    <button onClick={() => {
                      const newHist = history.filter(x => x.id !== h.id)
                      setHistory(newHist)
                      saveHistory(newHist)
                    }} className="text-[var(--text-muted)] hover:text-[var(--color-error-text)] ml-1"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compare Panel */}
        {compareMode && compareResults.length > 0 && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t('pages.document.compareResults', { count: compareResults.length })}</div>
                <button onClick={() => { setCompareResults([]); setCompareMode(false) }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)]">{t('pages.document.clearCompare')}</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-apple-sm)]">
                {compareResults.map((cr, idx) => {
                  const c = cr.overall_confidence ?? 0
                  const cc = confClass(c)
                  const fieldCount = Object.keys(cr.extracted_fields ?? {}).length
                  return (
                    <div key={idx} className={`p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] border ${cc.card}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">{t('pages.document.resultItem', { id: idx + 1 })}</span>
                        <span className={`text-xs font-mono ${cc.text}`}>
                          {t('pages.document.confidence')} {c.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">{t('pages.document.fieldsExtracted', { count: fieldCount })}</div>
                      <div className="mt-2 w-full bg-[var(--border-color)] rounded-[var(--radius-pill)] h-1">
                        <div className={`h-1 rounded-[var(--radius-pill)] ${cc.bar}`}
                          style={{ width: `${c * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Archive Panel — 数据库备案记录 */}
        {showArchives && (
          <Card>
            <CardContent className="p-[var(--space-apple-md)]">
              <div className="flex items-center justify-between mb-[var(--space-apple-sm)]">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t('pages.document.archiveRecords', { count: archives.length })}</div>
                <div className="flex items-center gap-3">
                  {lastGeneratedCoaId && (
                    <button onClick={() => navigate('/database')} className="text-xs text-[var(--color-primary-text)] hover:underline">
                      {t('pages.document.viewGeneratedArchive')}
                    </button>
                  )}
                  <button onClick={() => { setShowArchives(false); setArchives([]) }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-muted)]">{t('pages.document.close')}</button>
                </div>
              </div>
              {archivesLoading ? (
                <p className="text-sm text-[var(--text-muted)] py-4 text-center">{t('pages.document.loading')}</p>
              ) : archives.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-4 text-center">{t('pages.document.noArchiveRecords')}</p>
              ) : (
                <div className="space-y-2">
                  {archives.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-[var(--space-apple-sm)] py-2.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
                      <span className="font-mono text-xs text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] w-12 shrink-0">{a.document_type.toUpperCase()}</span>
                      <span className="text-xs text-[var(--text-muted)]">#{a.id}</span>
                      <span className="text-xs text-[var(--text-primary)] font-medium truncate max-w-[180px]">{a.product_name || t('pages.document.unnamedDocument')}</span>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">{t('pages.document.fieldsCount', { count: a.field_count })}</span>
                      {typeof a.inspection_count === 'number' && a.inspection_count > 0 && (
                        <span className="text-xs text-[var(--text-muted)] shrink-0">{t('pages.document.inspectionCount', { count: a.inspection_count })}</span>
                      )}
                      <span className={`text-xs font-mono ${a.overall_confidence >= 0.85 ? 'text-[var(--color-success-text)]' : a.overall_confidence >= 0.6 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-error-text)]'}`}>
                        {t('pages.document.confidence')} {(a.overall_confidence * 100).toFixed(0)}%
                      </span>
                      {a.requires_review && (
                        <button onClick={() => openArchiveReview(a.id)}
                          className="text-xs text-[var(--color-warning-text)] hover:underline"
                          aria-label={`${t('pages.document.reviewArchiveTitle', { id: a.id })}`}>
                          {t('pages.document.requiresReview')}
                        </button>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">{a.created_at ? new Date(a.created_at).toLocaleDateString(i18n.language) : ''}</span>
                      <button onClick={() => handleGeneratePeptideCoa(a.id)}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-primary-text)] hover:underline"
                        aria-label={`${t('pages.document.generateQcArchive')} #${a.id}`}>
                        <FileCheck size={12} />{t('pages.document.generateQcArchive')}
                      </button>
                      <button onClick={() => handleDeleteArchive(a.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--color-error-text)] transition-colors"
                        aria-label={`${t('pages.document.confirmDeleteArchive')} #${a.id}`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="max-w-5xl space-y-[var(--space-apple-md)]">
          {/* 文档类型 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h2" className="text-sm font-semibold">{t('pages.document.docType')}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex gap-[var(--space-apple-sm)] flex-wrap">
                {(['coa', 'pds', 'sd'] as DocumentType[]).map(t => (
                  <button key={t} onClick={() => { setDocType(t); setTextInput(EXAMPLE_TEXTS[t] ?? '') }}
                    className={`px-[var(--space-apple-md)] py-2 min-h-[44px] inline-flex items-center rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-colors ${
                      docType === t
                        ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)] shadow-sm'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)]'
                    }`}>
                    {docTypeLabel(t)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 文档内容 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle as="h2" className="text-sm font-semibold flex items-center gap-2">
                  <FileText size={14} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />{t('pages.document.docContent')}
                </CardTitle>
                <button onClick={() => setTextInput(EXAMPLE_TEXTS[docType] ?? '')}
                  className="text-xs text-[var(--color-accent-text)] hover:text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)] dark:hover:text-[var(--color-accent-text)] transition-colors inline-flex items-center min-h-[44px] px-1 -mx-1">
                  {t('pages.document.fillExample')}
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-[var(--space-apple-sm)]">
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={t('pages.document.textareaPlaceholder')}
                rows={8}
                className="w-full px-[var(--space-apple-md)] py-[var(--space-apple-md)] text-sm rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-tertiary)] dark:text-[var(--text-primary)] resize-none focus:outline-none focus-visible:ring-0"
              />
              <div
                className={`border-2 border-dashed rounded-[var(--radius-Apple-sm)] p-5 text-center transition-colors ${
                  dragOver ? 'border-[var(--color-accent)] bg-[var(--color-accent-container)] dark:bg-[var(--color-accent-container)]/20' : 'border-[var(--border-color)]'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]) }}
              >
                <Upload className="mx-auto mb-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" size={24} />
                <p className="text-sm text-[var(--text-muted)]">{t('pages.document.dragFileHint')}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t('pages.document.supportedFormats')}</p>
                {uploadedFileName && (
                  <p className="text-xs text-[var(--color-success-text)] mt-1">{t('pages.document.uploaded', { name: uploadedFileName })}</p>
                )}
                <input ref={fileInputRef} id="file-input" type="file" accept=".pdf,.docx,.txt" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} aria-hidden="true" tabIndex={-1} />
                <label htmlFor="file-input" onClick={() => fileInputRef.current?.click()}
                  className="inline-block mt-2 px-[var(--space-apple-md)] py-1.5 text-sm bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-sm)] hover:bg-[var(--border-color)] dark:hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors">
                  {t('pages.document.selectFile')}
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-[var(--space-apple-sm)]">
            <Button variant="primary" onClick={handleTextExtract} disabled={loading}
              icon={loading ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
              className="flex-1 sm:flex-none px-6">
              {loading ? t('pages.document.extracting') : t('pages.document.startExtract')}
            </Button>
            {result && (
              <Button variant="outline" onClick={handleCompare}
                icon={<Layers size={14} />} className="flex-1 sm:flex-none px-5">
                {t('pages.document.addToCompare')}
              </Button>
            )}
            {result && (
              <Button variant="primary" onClick={handleSaveArchive} disabled={saving}
                icon={saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                className="flex-1 sm:flex-none px-5">
                {saving ? t('pages.document.saving') : t('pages.document.saveArchive')}
              </Button>
            )}
          </div>

          {/* 提取结果 */}
          {result && (
            <div className="space-y-[var(--space-apple-md)]">
              {/* 置信度总览 */}
              <div className={`rounded-[var(--radius-Apple-md)] p-[var(--space-apple-md)] border ${conf.card}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-apple-sm)]">
                    {overallConf >= 0.85
                      ? <CheckCircle2 className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" size={20} />
                      : <AlertTriangle className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" size={20} />}
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {t('pages.document.overallConfidence', { value: overallConf.toFixed(2) })}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {t('pages.document.fieldsFound', { found: result.metadata.total_fields_found, expected: result.metadata.total_fields_expected })}
                        {result.requires_review && (
                          <>
                            <span className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)] ml-2">{t('pages.document.requiresReview')}</span>
                            <button onClick={openReview} className="ml-2 text-xs text-[var(--color-primary-text)] underline underline-offset-2 hover:opacity-80">
                              {reviewed ? t('pages.document.reviewedEdit') : t('pages.document.goReview')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--text-muted)]">{result.document_type.toUpperCase()}</div>
                  </div>
                </div>
                {/* 进度条 */}
                <div className="mt-[var(--space-apple-sm)] w-full bg-[var(--border-color)] rounded-[var(--radius-pill)] h-2">
                  <div className={`h-2 rounded-[var(--radius-pill)] transition-all ${conf.bar}`} style={{ width: `${overallConf * 100}%` }} />
                </div>
              </div>

              {/* 检验明细（OCR 表格解析） */}
              {result.inspection_items && result.inspection_items.length > 0 && (
                <Card>
                  <CardHeader className="px-5 pt-5 pb-3">
                    <CardTitle as="h3" className="text-sm font-semibold">{t('pages.document.inspectionDetails', { count: result.inspection_items.length })}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-color)]">
                            <th className="py-2 pr-2 font-medium">{t('pages.document.thItem')}</th>
                            <th className="py-2 pr-2 font-medium">{t('pages.document.thStandard')}</th>
                            <th className="py-2 pr-2 font-medium">{t('pages.document.thResult')}</th>
                            <th className="py-2 font-medium">{t('pages.document.thJudgment')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {result.inspection_items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 pr-2 text-[var(--text-primary)] align-top">
                                {it.item || '—'}
                                {it.item_en && <div className="text-xs sm:text-[10px] text-[var(--text-muted)]/70 mt-0.5">{it.item_en}</div>}
                              </td>
                              <td className="py-2 pr-2 text-[var(--text-muted)] align-top">
                                {it.standard || '—'}
                                {it.standard_en && <div className="text-xs sm:text-[10px] text-[var(--text-muted)]/70 mt-0.5">{it.standard_en}</div>}
                              </td>
                              <td className="py-2 pr-2 text-[var(--text-muted)] align-top">
                                {it.result || '—'}
                                {it.result_en && <div className="text-xs sm:text-[10px] text-[var(--text-muted)]/70 mt-0.5">{it.result_en}</div>}
                              </td>
                              <td className="py-2 text-[var(--text-muted)] align-top">
                                {it.judgment || '—'}
                                {it.judgment_en && <div className="text-xs sm:text-[10px] text-[var(--text-muted)]/70 mt-0.5">{it.judgment_en}</div>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 字段明细 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h3" className="text-sm font-semibold">{t('pages.document.fieldDetails')}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => {
                      // Export results
                      const data = JSON.stringify(result, null, 2)
                      const blob = new Blob([data], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `extraction_${docType}_${Date.now()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                      addToast({ type: 'success', message: t('pages.document.exportedJson') })
                    }} icon={<Download size={12} />}>
                      {t('pages.document.exportJson')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  <div className="space-y-2">
                    {Object.entries(result.extracted_fields).map(([key, field]: [string, any]) => (
                      <div key={key} className="flex items-center gap-4 px-[var(--space-apple-sm)] py-2.5 bg-[var(--bg-tertiary)]/60 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
                        <span className="text-xs font-mono text-[var(--text-muted)] w-24 shrink-0">{key}</span>
                        <span className="text-sm text-[var(--text-primary)] flex-1">{String(field.value || '—')}</span>
                        <span className="text-xs text-[var(--text-muted)]">{field.label ?? key}</span>
                        <span className={`text-xs font-mono w-10 text-right ${
                          field.confidence >= 0.8 ? 'text-[var(--color-success-text)] dark:text-[var(--color-success-text)]' : field.confidence >= 0.6 ? 'text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]' : 'text-[var(--color-error-text)] dark:text-[var(--color-error-text)]'
                        }`}>
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    {Object.keys(result.extracted_fields).length === 0 && (
                      <div className="text-center py-4 space-y-1">
                        <p className="text-sm text-[var(--text-muted)]">{t('pages.document.noFields')}</p>
                        <p className="text-xs text-[var(--text-muted)]">{t('pages.document.noFieldsHint')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 人工复核弹窗：修正低置信度字段 */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reviewArchiveId != null ? t('pages.document.reviewArchiveTitle', { id: reviewArchiveId }) : t('pages.document.reviewTitle')}</DialogTitle>
            <DialogDescription>{t('pages.document.reviewDesc', { suffix: reviewArchiveId != null ? t('pages.document.reviewDescArchive') : t('pages.document.reviewDescResult') })}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 px-1">
            {result && Object.entries(result.extracted_fields).map(([key, field]: [string, any]) => {
              const low = field.confidence < 0.7
              return (
                <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-Apple-sm)] border ${
                  low
                    ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-container)]/40'
                    : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/40'
                }`}>
                  <div className="w-28 shrink-0">
                    <div className="text-xs font-medium text-[var(--text-primary)]">{field.label ?? key}</div>
                    <div className="text-xs sm:text-[10px] font-mono text-[var(--text-muted)]">{key}</div>
                  </div>
                  <input
                    value={reviewDraft[key] ?? ''}
                    onChange={(e) => setReviewDraft(prev => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 h-9 min-w-0 px-2 text-sm rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-0"
                    aria-label={t('pages.document.reviewFieldAria', { label: field.label ?? key })}
                  />
                  <span className={`text-xs font-mono w-12 text-right shrink-0 ${
                    low ? 'text-[var(--color-warning-text)]' : 'text-[var(--text-muted)]'
                  }`}>
                    {(field.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)}>{t('pages.document.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={confirmReview}>{t('pages.document.confirmReview')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
