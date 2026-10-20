/**
 * 实验编辑页面 — 专家级增强版
 * 功能：基本信息编辑 + 材料/设备管理 + 可视化参数编辑 + 目标管理 + 时间计划
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, FlaskConical, CalendarDays, Plus, X, Settings, Wrench, ClipboardList, Trash2, AlertCircle } from 'lucide-react'
import { useExperiment } from '@/hooks/useQueries'
import { experimentApi } from '@/api/experiment'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Textarea, Card, CardContent, Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import type { ExperimentCreatePayload } from '@/api/experiment'

export default function ExperimentEditPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const experimentId = Number(id)

  const { data: experiment, isLoading } = useExperiment(experimentId)

  const [form, setForm] = useState<ExperimentCreatePayload>({
    title: '',
    description: '',
    formula_id: undefined,
    objectives: [],
    methodology: '',
    parameters: {},
    materials: [],
    equipment: [],
    start_date: '',
    end_date: '',
  })

  const [objectiveInput, setObjectiveInput] = useState('')
  const [materialInput, setMaterialInput] = useState('')
  const [equipmentInput, setEquipmentInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'params' | 'materials'>('basic')

  // 参数编辑状态
  const [paramKey, setParamKey] = useState('')
  const [paramValue, setParamValue] = useState('')

  useEffect(() => {
    if (experiment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        title: experiment.title,
        description: experiment.description || '',
        formula_id: experiment.formulaId || undefined,
        objectives: experiment.objectives || [],
        methodology: experiment.methodology || '',
        parameters: (experiment.parameters || {}) as Record<string, unknown>,
        materials: experiment.materials || [],
        equipment: experiment.equipment || [],
        start_date: experiment.start_date ? experiment.start_date.slice(0, 10) : '',
        end_date: experiment.end_date ? experiment.end_date.slice(0, 10) : '',
      })
    }
  }, [experiment])

  const updateField = <K extends keyof ExperimentCreatePayload>(key: K, value: ExperimentCreatePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const addObjective = () => {
    const trimmed = objectiveInput.trim()
    if (trimmed && !(form.objectives || []).includes(trimmed)) {
      updateField('objectives', [...(form.objectives || []), trimmed])
      setObjectiveInput('')
    }
  }

  const removeObjective = (idx: number) => {
    updateField('objectives', (form.objectives || []).filter((_, i) => i !== idx))
  }

  const addMaterial = () => {
    const trimmed = materialInput.trim()
    if (trimmed) {
      updateField('materials', [...(form.materials || []), { name: trimmed, quantity: '', unit: '' }])
      setMaterialInput('')
    }
  }

  const removeMaterial = (idx: number) => {
    updateField('materials', (form.materials || []).filter((_, i) => i !== idx))
  }

  const updateMaterial = (idx: number, field: string, value: string) => {
    const materials = [...(form.materials || [])]
    materials[idx] = { ...materials[idx], [field]: value }
    updateField('materials', materials)
  }

  const addEquipment = () => {
    const trimmed = equipmentInput.trim()
    if (trimmed) {
      updateField('equipment', [...(form.equipment || []), { name: trimmed, quantity: '', unit: '个' }])
      setEquipmentInput('')
    }
  }

  const removeEquipment = (idx: number) => {
    updateField('equipment', (form.equipment || []).filter((_, i) => i !== idx))
  }

  const addParam = () => {
    if (!paramKey.trim()) return
    const params = { ...(form.parameters || {}) }
    params[paramKey.trim()] = paramValue
    updateField('parameters', params)
    setParamKey('')
    setParamValue('')
  }

  const removeParam = (key: string) => {
    const params = { ...(form.parameters || {}) }
    delete params[key]
    updateField('parameters', params)
  }

  const validate = (): boolean => {
    if (!form.title.trim()) {
      setError(t('pages.experimentForm.titleRequired'))
      return false
    }
    setError('')
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await experimentApi.update(experimentId, form)
      qc.invalidateQueries({ queryKey: ['experiment', experimentId] })
      qc.invalidateQueries({ queryKey: ['experiments'] })
      navigate(`/experiments/${experimentId}`)
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('pages.experimentForm.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const formCompleteness = (() => {
    let filled = 0
    const total = 7
    if (form.title.trim()) filled++
    if (form.description?.trim()) filled++
    if (form.objectives && form.objectives.length > 0) filled++
    if (form.methodology?.trim()) filled++
    if (form.parameters && Object.keys(form.parameters).length > 0) filled++
    if (form.materials && form.materials.length > 0) filled++
    if (form.start_date && form.end_date) filled++
    return { filled, total, percent: Math.round((filled / total) * 100) }
  })()

  const tabs = [
    { key: 'basic' as const, labelKey: 'pages.experimentForm.basicInfo', icon: FlaskConical },
    { key: 'params' as const, labelKey: 'pages.experimentForm.params', icon: Settings },
    { key: 'materials' as const, labelKey: 'pages.experimentForm.materialsEquipment', icon: ClipboardList },
  ]

  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-[var(--space-apple-md)]">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-[1600px] mx-auto text-center py-20">
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentForm.experimentNotExist')}</p>
        <Link to="/experiments" className="text-[var(--color-primary-text)] text-sm mt-2 inline-block">{t('pages.experimentForm.backToList')}</Link>
      </div>
    )
  }

  const isEditable = experiment.status === 'planned' || experiment.status === 'in_progress'

  if (!isEditable) {
    return (
      <div className="max-w-[1600px] mx-auto text-center py-20">
        <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentForm.notEditable')}</p>
        <Link to={`/experiments/${experimentId}`} className="text-[var(--color-primary-text)] text-sm mt-2 inline-block">{t('pages.experimentForm.backToDetail')}</Link>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        {/* A-47：这一页原本完全没有 h1 —— 只有「返回详情」和「保存修改」两个按钮，
            屏幕阅读器用户进入后拿不到任何页面主题。补一个可见的 h1 作为页面标题。 */}
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <button
            onClick={() => navigate(`/experiments/${experimentId}`)}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            {t('pages.experimentForm.backToDetail')}
          </button>
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-[var(--text-primary)]">{t('pages.experimentForm.titleEdit')}</h1>
        </div>
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-[var(--radius-pill)] overflow-hidden">
              <div className="h-full bg-[var(--color-primary-container)]0 rounded-[var(--radius-pill)] transition-all duration-500" style={{ width: `${formCompleteness.percent}%` }} />
            </div>
            <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">{formCompleteness.percent}%</span>
          </div>
          <Button
            onClick={handleSave}
            loading={saving}
            icon={<Save size={14} />}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)] shadow-primary-600/25"
          >
            {t('pages.experimentForm.saveChanges')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] border border-[var(--color-error-border)] dark:border-[var(--color-error)] text-[var(--color-error-text)] dark:text-[var(--color-error-text)] text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* 标签导航 */}
      <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-Apple-md)] p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-[var(--bg-secondary)] dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon size={14} />
              {t(tab.labelKey)}
            </button>
          )
        })}
      </div>

      {/* 基本信息 */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                <FlaskConical size={18} />
                {t('pages.experimentForm.basicInfo')}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t('pages.experimentForm.experimentTitle')} <span className="text-[var(--color-error-text)]0">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={t('pages.experimentForm.experimentTitlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('pages.experimentForm.experimentDescription')}</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder={t('pages.experimentForm.experimentDescriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('pages.experimentForm.methodology')}</label>
                <Textarea
                  value={form.methodology}
                  onChange={(e) => updateField('methodology', e.target.value)}
                  placeholder={t('pages.experimentForm.methodologyPlaceholder')}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 实验目标 */}
          <Card>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <div className="text-[var(--text-primary)] font-semibold">{t('pages.experimentForm.objectives')}</div>

              {form.objectives && form.objectives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.objectives.map((obj, i) => (
                    <Badge key={i} variant="info" className="gap-1">
                      {obj}
                      <button onClick={() => removeObjective(i)} className="ml-0.5 hover:text-[var(--color-error-text)]0">
                        <X size={10} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObjective() } }}
                  placeholder={t('pages.experimentForm.objectivePlaceholder')}
                  className="flex-1"
                />
                <Button onClick={addObjective} disabled={!objectiveInput.trim()} variant="secondary" size="sm">
                  {t('pages.experimentForm.add')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 时间计划 */}
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                <CalendarDays size={18} />
                {t('pages.experimentForm.schedule')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    {t('pages.experimentForm.startDate')}
                  </label>
                  <Input type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    {t('pages.experimentForm.endDate')}
                  </label>
                  <Input type="date" value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 参数编辑 */}
      {activeTab === 'params' && (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
              <Settings size={18} />
              {t('pages.experimentForm.params')}
            </div>

            {/* 参数表格 */}
            <div className="space-y-2">
              {(form.parameters ? Object.entries(form.parameters) : []).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] group">
                  <span className="text-sm font-medium text-[var(--text-primary)] min-w-[120px] truncate">{key}</span>
                  <span className="text-sm text-[var(--text-muted)] flex-1 truncate">{String(value)}</span>
                  <button
                    onClick={() => removeParam(key)}
                    className="p-1 rounded text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {(form.parameters ? Object.keys(form.parameters).length === 0 : true) && (
                <div className="text-center py-[var(--space-apple-lg)] text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentForm.noParams')}</div>
              )}
            </div>

            {/* 添加参数 */}
            <div className="flex gap-2">
              <Input
                value={paramKey}
                onChange={(e) => setParamKey(e.target.value)}
                placeholder={t('pages.experimentForm.paramName')}
                size="sm"
                className="flex-1"
              />
              <Input
                value={paramValue}
                onChange={(e) => setParamValue(e.target.value)}
                placeholder={t('pages.experimentForm.paramValue')}
                size="sm"
                className="flex-1"
              />
              <Button size="sm" onClick={addParam} disabled={!paramKey.trim()} variant="secondary">
                <Plus size={14} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 材料与设备 */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* 材料管理 */}
          <Card>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                <FlaskConical size={18} className="text-[var(--color-accent-text)]0" />
                {t('pages.experimentForm.experimentMaterials')}
              </div>

              {(form.materials || []).map((mat: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] group">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={mat.name || ''}
                      onChange={(e) => updateMaterial(idx, 'name', e.target.value)}
                      placeholder={t('pages.experimentForm.materialNamePlaceholder')}
                      size="sm"
                    />
                    <Input
                      value={mat.quantity || ''}
                      onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)}
                      placeholder={t('pages.experimentForm.quantityPlaceholder')}
                      size="sm"
                    />
                    <Input
                      value={mat.unit || ''}
                      onChange={(e) => updateMaterial(idx, 'unit', e.target.value)}
                      placeholder={t('pages.experimentForm.unitPlaceholder')}
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={() => removeMaterial(idx)}
                    className="p-1 rounded text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.materials || []).length === 0 && (
                <div className="text-center py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentForm.noMaterials')}</div>
              )}

              <div className="flex gap-2">
                <Input
                  value={materialInput}
                  onChange={(e) => setMaterialInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial() } }}
                  placeholder={t('pages.experimentForm.materialPlaceholder')}
                  className="flex-1"
                />
                <Button onClick={addMaterial} disabled={!materialInput.trim()} variant="secondary" size="sm">
                  <Plus size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 设备管理 */}
          <Card>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                <Wrench size={18} className="text-info-500" />
                {t('pages.experimentForm.experimentEquipment')}
              </div>

              {(form.equipment || []).map((eq: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-[var(--space-apple-sm)] bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] group">
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{eq.name}</span>
                  <Badge variant={eq.status === 'available' ? 'success' : 'warning'} size="sm">
                    {eq.status === 'available' ? t('pages.experimentForm.equipmentStatusAvailable') : t('pages.experimentForm.equipmentStatusInUse')}
                  </Badge>
                  <button
                    onClick={() => removeEquipment(idx)}
                    className="p-1 rounded text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-[var(--color-error-text)]0 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.equipment || []).length === 0 && (
                <div className="text-center py-4 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{t('pages.experimentForm.noEquipment')}</div>
              )}

              <div className="flex gap-2">
                <Input
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEquipment() } }}
                  placeholder={t('pages.experimentForm.equipmentPlaceholder')}
                  className="flex-1"
                />
                <Button onClick={addEquipment} disabled={!equipmentInput.trim()} variant="secondary" size="sm">
                  <Plus size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 底部保存按钮 */}
      <div className="flex items-center justify-end gap-[var(--space-apple-sm)] pt-2 pb-8">
        <Link to={`/experiments/${experimentId}`}>
          <Button variant="secondary">{t('pages.experimentForm.cancelForm')}</Button>
        </Link>
        <Button
          onClick={handleSave}
          loading={saving}
          icon={<Save size={14} />}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)] shadow-primary-600/25"
        >
          {t('pages.experimentForm.saveChanges')}
        </Button>
      </div>
    </div>
  )
}
