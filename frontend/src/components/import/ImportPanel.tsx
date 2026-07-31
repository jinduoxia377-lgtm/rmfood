/**
 * ImportPanel — 数据导入面板
 *
 * 多步骤向导：上传 → 预览 → 字段映射 → 执行 → 结果
 */
'use client'

import { useCallback, useRef, useState } from 'react'
import { useImportEngine, type ImportStep } from '@/hooks/useImportEngine'
import type { FieldMappingConfig } from '@/api/import'

// ── Step indicators ──────────────────────────────────────────────

const STEPS = [
  { key: 'upload', label: '上传文件', icon: '📁' },
  { key: 'preview', label: '数据预览', icon: '👁️' },
  { key: 'mapping', label: '字段映射', icon: '🔗' },
  { key: 'running', label: '导入中', icon: '⚙️' },
  { key: 'done', label: '完成', icon: '✅' },
] as const

type StepKey = (typeof STEPS)[number]['key']

function StepIndicator({ currentStep }: { currentStep: ImportStep }) {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep)

  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => {
        const isActive = s.key === currentStep
        const isDone = i < currentIndex
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30'
                  : isDone
                    ? 'bg-green-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400'
              }`}
            >
              {isDone ? '✓' : s.icon}
            </div>
            <span className={`text-[10px] hidden sm:block ${isActive ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-neutral-400'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 mx-1 ${isDone ? 'bg-green-500' : 'bg-neutral-200 dark:bg-neutral-600'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Upload Step ──────────────────────────────────────────────────

function UploadStep({
  file,
  onFileSelect,
  onUpload,
}: {
  file: File | null
  onFileSelect: (f: File) => void
  onUpload: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [delimiter, setDelimiter] = useState('auto')
  const [fileType, setFileType] = useState('csv')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFileSelect(f)
  }, [onFileSelect])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFileSelect(f)
  }, [onFileSelect])

  const handleUpload = useCallback(() => {
    if (file) onUpload()
  }, [file, onUpload])

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10 scale-[1.02]'
            : 'border-neutral-200 dark:border-neutral-600 hover:border-orange-300 dark:hover:border-orange-700'
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv,.tsv,.json,.jsonl" className="hidden" onChange={handleFileChange} />
        <div className="text-3xl mb-2">{dragOver ? '📂' : '📥'}</div>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 font-medium">
          {dragOver ? '松开文件开始上传' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="text-[10px] text-neutral-400 mt-1">支持 CSV、TSV、JSON、JSONL</p>
      </div>

      {/* File info */}
      {file && (
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-sm">📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{file.name}</p>
            <p className="text-[10px] text-neutral-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFileSelect(null as any) }}
            className="text-neutral-400 hover:text-red-500 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Config */}
      {file && (
        <div className="flex gap-3">
          <select
            value={fileType}
            onChange={e => setFileType(e.target.value)}
            className="flex-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5"
          >
            <option value="csv">CSV / TSV</option>
            <option value="json">JSON / JSONL</option>
          </select>
          {fileType === 'csv' && (
            <select
              value={delimiter}
              onChange={e => setDelimiter(e.target.value)}
              className="flex-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5"
            >
              <option value="auto">自动检测分隔符</option>
              <option value=",">逗号 (,)</option>
              <option value="\t">制表符 (Tab)</option>
              <option value=";">分号 (;)</option>
            </select>
          )}
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!file}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:from-orange-600 hover:to-amber-600 transition-all shadow-md shadow-orange-200 dark:shadow-orange-900/20"
      >
        上传并继续
      </button>
    </div>
  )
}

// ── Preview Step ─────────────────────────────────────────────────

function PreviewStep({ data, totalRows }: { data: Record<string, unknown>[]; totalRows: number }) {
  if (!data.length) return <p className="text-xs text-neutral-400 text-center py-4">暂无预览数据</p>

  const columns = Object.keys(data[0]).slice(0, 8)

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">共 {totalRows.toLocaleString()} 行，显示前 {Math.min(data.length, 10)} 行</p>
      <div className="overflow-auto max-h-[280px] custom-scrollbar rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-[10px]">
          <thead className="bg-slate-50 dark:bg-neutral-700/50 sticky top-0 z-10">
            <tr>{columns.map(c => (
              <th key={c} className="px-2 py-1.5 text-left font-semibold text-neutral-500 border-b border-neutral-200 dark:border-neutral-600 whitespace-nowrap">{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-700/20">
                {columns.map(c => (
                  <td key={c} className="px-2 py-1 text-neutral-600 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700/30 truncate max-w-[140px]">
                    {String(row[c] ?? '').slice(0, 40)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Mapping Step ─────────────────────────────────────────────────

function MappingStep({
  columns,
  targetTable,
  idField,
  mappings,
  onTargetChange,
  onIdFieldChange,
  onMappingsChange,
}: {
  columns: string[]
  targetTable: string
  idField: string
  mappings: FieldMappingConfig[]
  onTargetChange: (t: string) => void
  onIdFieldChange: (f: string) => void
  onMappingsChange: (m: FieldMappingConfig[]) => void
}) {
  // Available target columns for the target table
  const TARGET_COLUMNS = [
    'external_id', 'sku', 'brand', 'product_name', 'product_line',
    'category', 'sub_category', 'formulation_type',
    'effects', 'target_population',
    'full_ingredients', 'key_ingredients',
    'price', 'currency', 'package_size',
    'volume_ml', 'weight_g',
    'sales_channels', 'image_urls',
    'allergens_tags', 'additives_tags', 'traces_tags',
    'source', 'data_quality',
  ]

  const addMapping = () => {
    onMappingsChange([...mappings, { source: '', target: '' }])
  }

  const updateMapping = (idx: number, field: keyof FieldMappingConfig, value: string | boolean | undefined) => {
    const next = [...mappings]
    next[idx] = { ...next[idx], [field]: value }
    onMappingsChange(next)
  }

  const removeMapping = (idx: number) => {
    onMappingsChange(mappings.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      {/* Target config */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">目标表</label>
          <select
            value={targetTable}
            onChange={e => onTargetChange(e.target.value)}
            className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5"
          >
            <option value="retail_products">retail_products (零售产品)</option>
            <option value="food_materials">food_materials (食品原料)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-1">唯一标识字段</label>
          <select
            value={idField}
            onChange={e => onIdFieldChange(e.target.value)}
            className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5"
          >
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Mapping rules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-neutral-500">字段映射规则</label>
          <button onClick={addMapping} className="text-[10px] text-orange-500 hover:text-orange-600 font-medium">+ 添加映射</button>
        </div>

        {mappings.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={m.source}
              onChange={e => updateMapping(i, 'source', e.target.value)}
              className="flex-1 text-[10px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-1.5 py-1"
            >
              <option value="">— 源列 —</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-neutral-300">→</span>
            <select
              value={m.target}
              onChange={e => updateMapping(i, 'target', e.target.value)}
              className="flex-1 text-[10px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-1.5 py-1"
            >
              <option value="">— 目标字段 —</option>
              {TARGET_COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => removeMapping(i)} className="text-neutral-300 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}

        {!mappings.length && (
          <p className="text-[10px] text-neutral-400 text-center py-2">添加映射规则以将源列映射到目标字段</p>
        )}
      </div>
    </div>
  )
}

// ── Progress Step ────────────────────────────────────────────────

function ProgressStep({ progress, errorMessage }: { progress: ImportProgress | null; errorMessage: string | null }) {
  if (!progress) return null

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-neutral-500">
          <span>处理进度</span>
          <span>{progress.progressPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500"
            style={{ width: `${progress.progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="总行数" value={progress.totalRows.toLocaleString()} color="neutral" />
        <StatCard label="成功" value={(progress.insertedRows + progress.updatedRows).toLocaleString()} color="green" />
        <StatCard label="错误" value={progress.errorRows.toLocaleString()} color={progress.errorRows > 0 ? 'red' : 'green'} />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    neutral: 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  }
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${colors[color] || colors.neutral}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export function ImportPanel({ onClose }: { onClose: () => void }) {
  const {
    step, task, uploadResponse, previewData, errors, progress, file, errorMessage,
    setFile, uploadFile, fetchPreview, runImport, refreshTask, cancelTask, clear, goToStep,
  } = useImportEngine()

  // Local state for mapping UI
  const [targetTable, setTargetTable] = useState('retail_products')
  const [idField, setIdField] = useState('external_id')
  const [mappings, setMappings] = useState<FieldMappingConfig[]>([])
  const [delimiter, setDelimiter] = useState('auto')
  const [fileType, setFileType] = useState('csv')

  // Polling for running imports
  const pollingRef = useRef<ReturnType<typeof setInterval>>()

  // Start polling when running
  if (step === 'running' && uploadResponse?.task_id) {
    if (!pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        await refreshTask()
      }, 2000)
    }
  }

  // Cleanup polling
  if (step !== 'running' && pollingRef.current) {
    clearInterval(pollingRef.current)
    pollingRef.current = undefined
  }

  const handleUpload = useCallback(() => {
    uploadFile(fileType, delimiter)
  }, [fileType, delimiter, uploadFile])

  const handleRun = useCallback(() => {
    if (mappings.length === 0) return
    runImport(targetTable, idField, mappings)
  }, [targetTable, idField, mappings, runImport])

  const handleBack = useCallback(() => {
    if (step === 'preview') goToStep('upload')
    else if (step === 'mapping') goToStep('preview')
    else if (step === 'done' || step === 'error') clear()
  }, [step, goToStep, clear])

  // Derive columns from preview data
  const columns = previewData?.length ? Object.keys(previewData[0]) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-[560px] max-h-[90vh] overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-b border-orange-100/50 dark:border-orange-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">📥</span>
            <span className="text-sm font-bold text-orange-700 dark:text-orange-300">数据导入向导</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-800/30 text-neutral-400 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <StepIndicator currentStep={step} />

          {step === 'upload' && (
            <UploadStep
              file={file}
              onFileSelect={setFile}
              onUpload={handleUpload}
            />
          )}

          {step === 'preview' && uploadResponse && (
            <div className="space-y-4">
              <PreviewStep data={previewData || []} totalRows={task?.total_rows || 0} />
              <div className="flex gap-2">
                <button
                  onClick={() => fetchPreview(10)}
                  className="flex-1 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  🔄 刷新预览
                </button>
                <button
                  onClick={() => goToStep('mapping')}
                  disabled={!previewData?.length}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold disabled:opacity-40 hover:from-orange-600 hover:to-amber-600 transition-all"
                >
                  下一步 → 字段映射
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <MappingStep
                columns={columns}
                targetTable={targetTable}
                idField={idField}
                mappings={mappings}
                onTargetChange={setTargetTable}
                onIdFieldChange={setIdField}
                onMappingsChange={setMappings}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => goToStep('preview')}
                  className="flex-1 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                >
                  ← 上一步
                </button>
                <button
                  onClick={handleRun}
                  disabled={mappings.length === 0}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold disabled:opacity-40 hover:from-orange-600 hover:to-amber-600 transition-all"
                >
                  🚀 开始导入
                </button>
              </div>
            </div>
          )}

          {(step === 'running' || step === 'done' || step === 'error') && (
            <ProgressStep progress={progress} errorMessage={errorMessage} />
          )}
        </div>

        {/* Footer */}
        {step !== 'idle' && step !== 'running' && (
          <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-700 flex gap-2 shrink-0">
            {(step === 'preview' || step === 'mapping') && (
              <button
                onClick={() => goToStep(step === 'preview' ? 'upload' : 'preview')}
                className="flex-1 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                ← 返回
              </button>
            )}
            {(step === 'done' || step === 'error') && (
              <button
                onClick={clear}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold hover:from-orange-600 hover:to-amber-600 transition-all"
              >
                关闭
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function taskId(resp: UploadResponse | null): string {
  return resp?.task_id || ''
}
