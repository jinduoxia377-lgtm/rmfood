/**
 * 文档智能提取页面 — 完整功能版
 * CoA/PDS/SD 文本提取 + PDF解析 + 提取历史 + 结果对比
 * 主题系统：对齐 Dashboard 设计系统规范（bg-grid + brand banner + Card/Button + design tokens）
 */
import { useState, useRef } from 'react'
import {
  FileText, Upload, AlertTriangle, CheckCircle2,
  FileCheck, Loader2, History, Trash2, Layers, Download,
} from 'lucide-react'
import { documentApi, type DocumentType, type ExtractionResult } from '@/api/document'
import { useToast } from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'

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
    ? { card: 'bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900', text: 'text-success-500 dark:text-success-400', bar: 'bg-success-500' }
    : conf >= 0.6
      ? { card: 'bg-warning-50 dark:bg-warning-950/20 border-warning-200 dark:border-warning-900', text: 'text-warning-500 dark:text-warning-400', bar: 'bg-warning-500' }
      : { card: 'bg-danger-50 dark:bg-danger-950/20 border-danger-200 dark:border-danger-900', text: 'text-danger-500 dark:text-danger-400', bar: 'bg-danger-500' }

export default function DocumentExtractPage() {
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const docTypeLabel = (t: DocumentType) => t === 'coa' ? 'CoA 检验报告' : t === 'pds' ? 'PDS 产品说明书' : 'SDS 安全数据表'

  const handleTextExtract = async () => {
    if (!textInput.trim()) { addToast({ type: 'warning', message: '请输入文档文本' }); return }
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
        date: new Date().toLocaleDateString('zh-CN'),
      }
      const newHistory = [histItem, ...history].slice(0, 20)
      setHistory(newHistory)
      saveHistory(newHistory)
      addToast({ type: 'success', message: `已提取 ${count} 个字段` })
    } catch (e: any) {
      addToast({ type: 'error', message: String(e) })
    } finally { setLoading(false) }
  }

  const handleFileUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', docType)
    setLoading(true)
    try {
      const res = await fetch('/api/v1/documents/extract', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      if (json.status === 'error') throw new Error(json.error ?? '提取失败')
      const data = json.data
      setResult(data)
      const count = Object.keys(data?.extracted_fields ?? {}).length
      addToast({ type: 'success', message: `上传成功，识别 ${count} 个字段` })
    } catch (e: any) {
      addToast({ type: 'error', message: e.message ?? '上传失败' })
    } finally { setLoading(false) }
  }

  const overallConf = result ? result.overall_confidence : 0
  const conf = confClass(overallConf)

  const handleCompare = () => {
    if (result) {
      setCompareResults(prev => [...prev, result])
      addToast({ type: 'success', message: `已添加到对比队列（共${compareResults.length + 1}个结果）` })
    }
  }

  return (
    <div className="min-h-screen bg-grid" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* 页头横幅 — 对齐 Dashboard 品牌横幅规范 */}
        <div className="surface-primary rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold leading-snug tracking-tight flex items-center gap-2">
                <FileCheck size={20} className="text-white/80 shrink-0" />
                文档智能提取
              </h2>
              <p className="mt-1 text-white/80 text-sm">CoA / PDS / SDS 结构化字段提取 · 置信度评分 · 提取历史管理</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 rounded-full transition-colors">
                  <History size={12} />历史记录 ({history.length})
                </button>
              )}
              {compareResults.length > 0 && (
                <button onClick={() => setCompareMode(!compareMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    compareMode ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
                  }`}>
                  <Layers size={12} />对比 ({compareResults.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">最近提取历史</div>
              <div className="flex gap-2 flex-wrap">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg text-xs border border-neutral-200 dark:border-neutral-700">
                    <span className="font-mono text-accent-600 dark:text-accent-400">{h.type.toUpperCase()}</span>
                    <span className="text-neutral-400 dark:text-neutral-500">{h.fields}字段</span>
                    <span className="text-neutral-400 dark:text-neutral-500">· 置信度 {(h.confidence * 100).toFixed(0)}%</span>
                    <span className="text-neutral-300 dark:text-neutral-500">{h.date}</span>
                    <button onClick={() => {
                      const newHist = history.filter(x => x.id !== h.id)
                      setHistory(newHist)
                      saveHistory(newHist)
                    }} className="text-neutral-400 hover:text-danger-500 dark:hover:text-danger-400 ml-1"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compare Panel */}
        {compareMode && compareResults.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">对比结果（{compareResults.length}个）</div>
                <button onClick={() => { setCompareResults([]); setCompareMode(false) }} className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300">清除对比</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {compareResults.map((cr, idx) => {
                  const c = cr.overall_confidence ?? 0
                  const cc = confClass(c)
                  const fieldCount = Object.keys(cr.extracted_fields ?? {}).length
                  return (
                    <div key={idx} className={`p-3 rounded-lg border ${cc.card}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">结果 #{idx + 1}</span>
                        <span className={`text-xs font-mono ${cc.text}`}>
                          置信度 {c.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{fieldCount} 个字段已提取</div>
                      <div className="mt-2 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
                        <div className={`h-1 rounded-full ${cc.bar}`}
                          style={{ width: `${c * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="max-w-5xl space-y-4">
          {/* 文档类型 */}
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle as="h2" className="text-sm font-semibold">文档类型</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex gap-3 flex-wrap">
                {(['coa', 'pds', 'sd'] as DocumentType[]).map(t => (
                  <button key={t} onClick={() => { setDocType(t); setTextInput(EXAMPLE_TEXTS[t] ?? '') }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      docType === t
                        ? 'bg-accent-container text-accent-main shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
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
                  <FileText size={14} className="text-accent-500 dark:text-accent-400" />文档内容
                </CardTitle>
                <button onClick={() => setTextInput(EXAMPLE_TEXTS[docType] ?? '')}
                  className="text-xs text-accent-500 hover:text-accent-600 dark:text-accent-400 dark:hover:text-accent-300 transition-colors">
                  填入示例文本
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-3">
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={"请粘贴 CoA/PDS/SDS 文档内容...\n\n示例：\n批号: HT2024001\n产品名称: 黄芪多糖\n含量测定: 98.5%\n水分: 4.2%\n结论: PASS"}
                rows={8}
                className="w-full px-4 py-3 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-100 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 dark:ring-accent-400"
              />
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
                  dragOver ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/20' : 'border-neutral-200 dark:border-neutral-700'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]) }}
              >
                <Upload className="mx-auto mb-2 text-neutral-400" size={24} />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">拖拽文件至此，或点击下方按钮选择</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">支持 PDF、DOCX、TXT（PDF需含文本层）</p>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                <label htmlFor="file-input"
                  className="inline-block mt-2 px-4 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer transition-colors">
                  选择文件
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button variant="primary" onClick={handleTextExtract} disabled={loading}
              icon={loading ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
              className="flex-1 sm:flex-none px-6">
              {loading ? '提取中...' : '开始提取'}
            </Button>
            {result && (
              <Button variant="outline" onClick={handleCompare}
                icon={<Layers size={14} />} className="flex-1 sm:flex-none px-5">
                添加到对比
              </Button>
            )}
          </div>

          {/* 提取结果 */}
          {result && (
            <div className="space-y-4">
              {/* 置信度总览 */}
              <div className={`rounded-xl p-4 border ${conf.card}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {overallConf >= 0.85
                      ? <CheckCircle2 className="text-success-500 dark:text-success-400" size={20} />
                      : <AlertTriangle className="text-warning-500 dark:text-warning-400" size={20} />}
                    <div>
                      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        整体置信度：{overallConf.toFixed(2)}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        发现 {result.metadata.total_fields_found} / {result.metadata.total_fields_expected} 个字段
                        {result.requires_review && <span className="text-warning-600 dark:text-warning-400 ml-2">⚠ 需人工复核</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-400 dark:text-neutral-500">{result.document_type.toUpperCase()}</div>
                  </div>
                </div>
                {/* 进度条 */}
                <div className="mt-3 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${conf.bar}`} style={{ width: `${overallConf * 100}%` }} />
                </div>
              </div>

              {/* 字段明细 */}
              <Card>
                <CardHeader className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle as="h3" className="text-sm font-semibold">提取字段明细</CardTitle>
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
                      addToast({ type: 'success', message: '结果已导出为 JSON' })
                    }} icon={<Download size={12} />}>
                      导出 JSON
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 space-y-2">
                  <div className="space-y-2">
                    {Object.entries(result.extracted_fields).map(([key, field]: [string, any]) => (
                      <div key={key} className="flex items-center gap-4 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 w-24 shrink-0">{key}</span>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">{String(field.value || '—')}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{field.label ?? key}</span>
                        <span className={`text-xs font-mono w-10 text-right ${
                          field.confidence >= 0.8 ? 'text-success-500 dark:text-success-400' : field.confidence >= 0.6 ? 'text-warning-500 dark:text-warning-400' : 'text-danger-500 dark:text-danger-400'
                        }`}>
                          {(field.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    {Object.keys(result.extracted_fields).length === 0 && (
                      <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">未识别到任何字段，请检查文档格式</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
