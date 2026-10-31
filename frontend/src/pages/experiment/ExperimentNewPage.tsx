/**
 * 新建实验页面 — 科学设计增强版
 * 功能：实验类型分类 + 参数模板 + 材料/设备管理 + 对照组设计 + AI方案建议 + 预算估算
 * 设计对齐：参照仪表盘 bg-grid 背景 + rounded-[var(--radius-Apple-md)] 横幅 + ghost 操作栏
 */
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Save, FlaskConical, CalendarDays, DollarSign, AlertCircle,
  CheckCircle2, Lightbulb, X, Thermometer, Target, Shield, TestTube,
  Settings, Utensils, FileText, Beaker, TestTube2, ClipboardList,
  Brain, Sparkles, Plus, Trash2, ShieldCheck, FlaskRound,
  Scale, ListChecks, Clock,
} from 'lucide-react'
import { useCreateExperiment, useFormulas } from '@/hooks/useQueries'
import { Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { ExperimentCreatePayload } from '@/api/experiment'

// ── 实验类型 ──
const EXPERIMENT_TYPES = [
  { value: 'stability', labelKey: 'pages.experimentForm.typeStability', descKey: 'pages.experimentForm.typeStabilityDesc', icon: Thermometer, color: 'bg-secondary-surface' },
  { value: 'efficacy', labelKey: 'pages.experimentForm.typeEfficacy', descKey: 'pages.experimentForm.typeEfficacyDesc', icon: Target, color: 'bg-primary-surface' },
  { value: 'safety', labelKey: 'pages.experimentForm.typeSafety', descKey: 'pages.experimentForm.typeSafetyDesc', icon: Shield, color: 'bg-warning-surface' },
  { value: 'composition', labelKey: 'pages.experimentForm.typeComposition', descKey: 'pages.experimentForm.typeCompositionDesc', icon: TestTube, color: 'bg-accent-surface' },
  { value: 'process', labelKey: 'pages.experimentForm.typeProcess', descKey: 'pages.experimentForm.typeProcessDesc', icon: Settings, color: 'bg-neutral-600' },
  { value: 'taste', labelKey: 'pages.experimentForm.typeTaste', descKey: 'pages.experimentForm.typeTasteDesc', icon: Utensils, color: 'bg-danger-surface' },
  { value: 'other', labelKey: 'pages.experimentForm.typeOther', descKey: 'pages.experimentForm.typeOtherDesc', icon: FileText, color: 'bg-[var(--bg-tertiary)]' },
]

// ── 参数模板 ──
const PARAM_TEMPLATES: Record<string, { key: string; label: string; default_value: string }[]> = {
  stability: [
    { key: 'temperature', label: '储存温度 (°C)', default_value: '25' },
    { key: 'humidity', label: '相对湿度 (%)', default_value: '60' },
    { key: 'light_condition', label: '光照条件', default_value: '避光' },
    { key: 'test_interval_days', label: '检测间隔 (天)', default_value: '30' },
  ],
  efficacy: [
    { key: 'sample_size', label: '样本量', default_value: '30' },
    { key: 'control_group', label: '对照组', default_value: '空白对照' },
    { key: 'duration_weeks', label: '实验周期 (周)', default_value: '8' },
  ],
  safety: [
    { key: 'animal_model', label: '动物模型', default_value: 'SPF级小鼠' },
    { key: 'dose_groups', label: '剂量分组', default_value: '低/中/高' },
    { key: 'observation_days', label: '观察周期 (天)', default_value: '28' },
  ],
  composition: [
    { key: 'target_compound', label: '目标化合物', default_value: '' },
    { key: 'method', label: '检测方法', default_value: 'HPLC' },
    { key: 'replicates', label: '平行样数', default_value: '3' },
  ],
  process: [
    { key: 'temperature_range', label: '温度范围 (°C)', default_value: '' },
    { key: 'time_range', label: '时间范围 (min)', default_value: '' },
    { key: 'ph_range', label: 'pH 范围', default_value: '' },
  ],
  taste: [
    { key: 'panel_size', label: '评价人数', default_value: '10' },
    { key: 'scale_type', label: '评分标度', default_value: '9分制' },
    { key: 'attributes', label: '评价指标', default_value: '甜度/苦度/涩度/整体接受度' },
  ],
}

// ── 对照组设计 ──
const CONTROL_GROUPS = [
  { value: 'blank', labelKey: 'pages.experimentForm.controlBlank', descKey: 'pages.experimentForm.controlBlankDesc' },
  { value: 'positive', labelKey: 'pages.experimentForm.controlPositive', descKey: 'pages.experimentForm.controlPositiveDesc' },
  { value: 'vehicle', labelKey: 'pages.experimentForm.controlVehicle', descKey: 'pages.experimentForm.controlVehicleDesc' },
  { value: 'dose', labelKey: 'pages.experimentForm.controlDose', descKey: 'pages.experimentForm.controlDoseDesc' },
  { value: 'none', labelKey: 'pages.experimentForm.controlNone', descKey: 'pages.experimentForm.controlNoneDesc' },
]

// ── 功效目标 ──
const EFFICACY_TARGETS = [
  { value: 'anti_inflammatory', labelKey: 'pages.experimentForm.efficacyAntiInflammatory' },
  { value: 'antioxidant', labelKey: 'pages.experimentForm.efficacyAntioxidant' },
  { value: 'immune_boost', labelKey: 'pages.experimentForm.efficacyImmuneBoost' },
  { value: 'anti_diabetic', labelKey: 'pages.experimentForm.efficacyAntiDiabetic' },
  { value: 'anti_hypertensive', labelKey: 'pages.experimentForm.efficacyAntiHypertensive' },
  { value: 'hepatoprotective', labelKey: 'pages.experimentForm.efficacyHepatoprotective' },
  { value: 'gastroprotective', labelKey: 'pages.experimentForm.efficacyGastroprotective' },
  { value: 'anti_fatigue', labelKey: 'pages.experimentForm.efficacyAntiFatigue' },
  { value: 'improve_sleep', labelKey: 'pages.experimentForm.efficacyImproveSleep' },
  { value: 'bone_health', labelKey: 'pages.experimentForm.efficacyBoneHealth' },
  { value: 'skin_health', labelKey: 'pages.experimentForm.efficacySkinHealth' },
  { value: 'other', labelKey: 'pages.experimentForm.efficacyOther' },
]

// ── 样本量推荐 ──
function recommendSampleSize(type: string): { min: number; recommended: number; rationale: string } | null {
  const map: Record<string, { min: number; recommended: number; rationale: string }> = {
    efficacy: { min: 20, recommended: 30, rationale: '功效验证通常需 n≥20 以保证统计功效 (power) ≥0.80' },
    safety: { min: 6, recommended: 12, rationale: '急性毒性试验每组至少 6 只，亚慢性需 12-24 只' },
    stability: { min: 3, recommended: 6, rationale: '稳定性试验每条件至少 3 个平行样' },
    composition: { min: 3, recommended: 3, rationale: 'HPLC/UV 测定常规 3 次平行' },
    taste: { min: 8, recommended: 12, rationale: '感官评价至少 8 人，推荐 12 人以保证统计显著性' },
    process: { min: 3, recommended: 5, rationale: '工艺优化至少 3 次重复验证' },
  }
  return map[type] ?? null
}

export default function ExperimentNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const createMut = useCreateExperiment()

  // 从 URL 参数自动关联配方
  const preselectedFormulaId = searchParams.get('formula_id')
  const [selectedType, setSelectedType] = useState('')
  const [form, setForm] = useState<ExperimentCreatePayload>({
    title: '',
    description: '',
    formula_id: preselectedFormulaId ? Number(preselectedFormulaId) : undefined,
    objectives: [],
    methodology: '',
    start_date: '',
    end_date: '',
    parameters: {},
    materials: [],
    equipment: [],
  })

  const [objectiveInput, setObjectiveInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showControls, setShowControls] = useState(false)

  // 材料/设备
  const [materialInput, setMaterialInput] = useState({ name: '', quantity: '', unit: '' })
  const [equipmentInput, setEquipmentInput] = useState({ name: '', quantity: '', unit: '' })

  // 科学设计
  const [controlGroup, setControlGroup] = useState('blank')
  const [efficacyTargets, setEfficacyTargets] = useState<string[]>([])

  // 关联配方搜索（防抖 300ms，避免每次按键触发 API）
  const [formulaSearch, setFormulaSearch] = useState('')
  const [debouncedFormulaSearch, setDebouncedFormulaSearch] = useState('')
  const [showAllFormulas, setShowAllFormulas] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFormulaSearch(formulaSearch), 300)
    return () => clearTimeout(timer)
  }, [formulaSearch])
  const { data: formulaData } = useFormulas({ search: debouncedFormulaSearch, page_size: 10 })
  const formulas = (formulaData as { items?: unknown[] })?.items ?? []

  // 关联配方详情（用于提取成分信息）
  const [selectedFormulaDetail, setSelectedFormulaDetail] = useState<any>(null)

  // 预算估算
  const estimatedCost = useMemo(() => {
    const base = { stability: 15000, efficacy: 25000, safety: 35000, composition: 8000, process: 12000, taste: 5000, other: 10000 }
    return base[selectedType as keyof typeof base] || 0
  }, [selectedType])

  // 样本量推荐
  const sampleSizeRec = useMemo(() => recommendSampleSize(selectedType), [selectedType])

  // 参数模板
  const paramTemplate = PARAM_TEMPLATES[selectedType] || []

  const handleSelectType = (type: string) => {
    setSelectedType(type)
    const template = PARAM_TEMPLATES[type] || []
    const params: Record<string, string> = {}
    template.forEach((t) => { params[t.key] = t.default_value })
    setForm({ ...form, parameters: params })
  }

  const handleAddObjective = () => {
    const trimmed = objectiveInput.trim()
    if (trimmed && !form.objectives?.includes(trimmed)) {
      setForm({ ...form, objectives: [...(form.objectives || []), trimmed] })
      setObjectiveInput('')
    }
  }

  const handleRemoveObjective = (idx: number) => {
    setForm({ ...form, objectives: form.objectives?.filter((_, i) => i !== idx) })
  }

  const updateParam = (key: string, value: string) => {
    setForm({ ...form, parameters: { ...form.parameters, [key]: value } })
  }

  // 材料/设备操作
  const handleAddMaterial = () => {
    if (!materialInput.name.trim()) return
    const mat = { ...form.materials, ...{ name: materialInput.name.trim(), quantity: materialInput.quantity.trim() || undefined, unit: materialInput.unit.trim() || undefined } }
    setForm({ ...form, materials: [...(form.materials || []), mat] })
    setMaterialInput({ name: '', quantity: '', unit: '' })
  }

  const handleRemoveMaterial = (idx: number) => {
    setForm({ ...form, materials: (form.materials || []).filter((_, i) => i !== idx) })
  }

  const handleAddEquipment = () => {
    if (!equipmentInput.name.trim()) return
    const eq = { ...form.equipment, ...{ name: equipmentInput.name.trim(), quantity: equipmentInput.quantity.trim() || undefined, unit: equipmentInput.unit.trim() || undefined } }
    setForm({ ...form, equipment: [...(form.equipment || []), eq] })
    setEquipmentInput({ name: '', quantity: '', unit: '' })
  }

  const handleRemoveEquipment = (idx: number) => {
    setForm({ ...form, equipment: (form.equipment || []).filter((_, i) => i !== idx) })
  }

  const toggleEfficacyTarget = (target: string) => {
    setEfficacyTargets(prev =>
      prev.includes(target) ? prev.filter(t => t !== target) : [...prev, target]
    )
  }

  const handleSelectFormula = (f: any) => {
    setForm({ ...form, formula_id: f.id })
    setFormulaSearch('')
    setShowAllFormulas(false)
    setSelectedFormulaDetail(f)
    // 自动提取功效目标
    if (f.target_effects?.length > 0) {
      setEfficacyTargets(f.target_effects.filter((e: string) => EFFICACY_TARGETS.some(et => et.value === e)).slice(0, 5))
    }
    addToast({ type: 'info', message: t('pages.experimentForm.linkedFormulaToast', { name: f.name }) })
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.title.trim()) newErrors.title = t('pages.experimentForm.titleRequired')
    if (!selectedType) newErrors.type = t('pages.experimentForm.typeRequired')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      const experiment = await createMut.mutateAsync({
        ...form,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      })
      addToast({ type: 'success', message: t('pages.experimentForm.createSuccess') })
      navigate(`/experiments/${experiment.id}`)
    } catch {
      addToast({ type: 'error', message: t('pages.experimentForm.createFailed') })
    }
  }

  const formCompleteness = useMemo(() => {
    let filled = 0
    const total = 7
    if (form.title.trim()) filled++
    if (selectedType) filled++
    if (form.objectives && form.objectives.length > 0) filled++
    if (form.methodology?.trim()) filled++
    if (form.start_date && form.end_date) filled++
    if (form.formula_id) filled++
    if (form.materials && form.materials.length > 0) filled++
    return { filled, total, percent: Math.round((filled / total) * 100) }
  }, [form, selectedType])

  // AI 方案建议摘要
  const aiSuggestion = useMemo(() => {
    if (!selectedType) return null
    const suggestions: string[] = []
    const typeLabel = t(EXPERIMENT_TYPES.find(x => x.value === selectedType)?.labelKey || 'pages.experimentForm.typeOther')
    suggestions.push(t('pages.experimentForm.suggestionType', { type: typeLabel }))

    if (sampleSizeRec) {
      suggestions.push(t('pages.experimentForm.suggestionSampleSize', { min: sampleSizeRec.min, recommended: sampleSizeRec.recommended, rationale: sampleSizeRec.rationale }))
    }

    if (controlGroup !== 'none') {
      const cg = CONTROL_GROUPS.find(c => c.value === controlGroup)
      suggestions.push(t('pages.experimentForm.suggestionControlGroup', { group: cg ? t(cg.labelKey) : '' }))
    }

    if (efficacyTargets.length > 0) {
      const names = efficacyTargets.map(x => t(EFFICACY_TARGETS.find(e => e.value === x)?.labelKey || 'pages.experimentForm.efficacyOther')).join('、')
      suggestions.push(t('pages.experimentForm.suggestionEfficacy', { names }))
    }

    if (form.formula_id) {
      suggestions.push(t('pages.experimentForm.linkedFormulaSuggestion'))
    }

    return suggestions.length > 0 ? suggestions : null
  }, [selectedType, sampleSizeRec, controlGroup, efficacyTargets, form.formula_id, t])

  // 实验方案摘要预览
  const summaryPreview = useMemo(() => {
    const items: { label: string; value: string }[] = []
    const typeName = EXPERIMENT_TYPES.find(x => x.value === selectedType)
    if (form.title.trim()) items.push({ label: t('pages.experimentForm.summaryLabelTitle'), value: form.title })
    if (typeName) items.push({ label: t('pages.experimentForm.summaryLabelType'), value: t(typeName.labelKey) })
    if (form.objectives?.length) items.push({ label: t('pages.experimentForm.summaryLabelObjective'), value: form.objectives.join('；') })
    if (form.methodology?.trim()) items.push({ label: t('pages.experimentForm.summaryLabelMethod'), value: form.methodology.slice(0, 80) + (form.methodology.length > 80 ? '…' : '') })
    if (form.start_date) items.push({ label: t('pages.experimentForm.summaryLabelStart'), value: form.start_date })
    if (form.end_date) items.push({ label: t('pages.experimentForm.summaryLabelEnd'), value: form.end_date })
    if (form.materials?.length) items.push({ label: t('pages.experimentForm.summaryLabelMaterials'), value: `${form.materials.length} 项` })
    if (form.equipment?.length) items.push({ label: t('pages.experimentForm.summaryLabelEquipment'), value: `${form.equipment.length} 项` })
    if (controlGroup !== 'none') items.push({ label: t('pages.experimentForm.summaryLabelControlGroup'), value: t(CONTROL_GROUPS.find(c => c.value === controlGroup)?.labelKey || 'pages.experimentForm.controlBlank') })
    if (efficacyTargets.length > 0) items.push({ label: t('pages.experimentForm.summaryLabelEfficacy'), value: efficacyTargets.map(x => t(EFFICACY_TARGETS.find(e => e.value === x)?.labelKey || 'pages.experimentForm.efficacyOther')).join('、') })
    return items
  }, [form, selectedType, controlGroup, efficacyTargets, t])

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-[var(--space-apple-md)] sm:px-6 lg:px-8 space-y-[var(--space-apple-md)] py-[var(--space-apple-lg)]">

        {/* ── 欢迎横幅（surface-primary 实底，对齐 DashboardPage） ── */}
        <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] bg-[var(--bg-secondary)]/20">
                <FlaskRound size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.experimentForm.titleNew')}</h1>
                <p className="text-sm white/80 text-white/80 mt-0.5">{t('pages.experimentForm.subtitleNew')}</p>
              </div>
            </div>
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold">{formCompleteness.percent}%</span>
                <span className="text-xs text-white/70">{t('pages.experimentForm.formProgress')}</span>
              </div>
              <div className="w-32 h-2 bg-[var(--bg-secondary)]/20 rounded-[var(--radius-pill)] overflow-hidden">
                <div className="h-full bg-[var(--color-accent)] rounded-[var(--radius-pill)] transition-all duration-500" style={{ width: `${formCompleteness.percent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── 快速操作栏 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/experiments" className="flex items-center gap-1.5 min-h-[44px] px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
            <ArrowLeft size={14} /> {t('pages.experimentForm.backToList')}
          </Link>
          <Link to="/experiments/calendar" className="flex items-center gap-1.5 min-h-[44px] px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
            <CalendarDays size={14} /> {t('pages.experimentForm.calendar')}
          </Link>
          <button type="button" onClick={() => setShowControls(!showControls)} className="flex items-center gap-1.5 min-h-[44px] px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
            <ListChecks size={14} /> {showControls ? t('pages.experimentForm.collapseDesign') : t('pages.experimentForm.toggleDesign')}
          </button>
          {form.formula_id && (
            <Link to={`/formulas/${form.formula_id}`} className="flex items-center gap-1.5 min-h-[44px] px-[var(--space-apple-sm)] py-2 rounded-[var(--radius-Apple-sm)] text-sm text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] hover:bg-[var(--color-primary-container)] dark:hover:bg-[var(--color-primary-container)]/20 transition-colors">
              <FlaskConical size={14} /> {t('pages.experimentForm.viewLinkedFormula')}
            </Link>
          )}
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {formCompleteness.filled}/{formCompleteness.total} {t('pages.experimentForm.filledCount')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-[var(--space-apple-md)]">

          {/* ── 实验类型选择 ── */}
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <FlaskConical size={18} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                {t('pages.experimentForm.typeLabel')}
                <span className="text-[var(--color-error-text)] text-sm">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errors.type && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-error-text)] mb-[var(--space-apple-sm)]">
                  <AlertCircle size={14} />{errors.type}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {EXPERIMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleSelectType(type.value)}
                    className={cn(
                      'relative p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border text-left transition-all group',
                      selectedType === type.value
                        ? 'border-[var(--color-primary-border)] dark:border-[var(--color-primary)] bg-[var(--color-primary-container)] shadow-sm'
                        : 'border-[var(--border-color)] hover:border-[var(--color-primary-border)] dark:hover:border-[var(--color-primary)]/50',
                    )}
                  >
                    <div className={cn(
                      'inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-Apple-sm)] mb-2',
                      type.color,
                      selectedType !== type.value && 'opacity-60 group-hover:opacity-80',
                    )}>
                      <type.icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t(type.labelKey)}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">{t(type.descKey)}</p>
                    {selectedType === type.value && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 size={14} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── 基本信息 ── */}
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <ClipboardList size={18} className="text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]" />
                {t('pages.experimentForm.basicInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    {t('pages.experimentForm.experimentTitle')} <span className="text-[var(--color-error-text)]">*</span>
                  </label>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((p) => ({ ...p, title: '' })) }}
                    placeholder={t('pages.experimentForm.titlePlaceholderExample')}
                    error={errors.title}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    {t('pages.experimentForm.experimentCode')} <span className="text-xs text-[var(--text-muted)]">{t('pages.experimentForm.autoGenerated')}</span>
                  </label>
                  {/* eslint-disable-next-line react-hooks/purity -- 实验编号一次性生成 */}
                  <Input value={`RMF-EXP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`} readOnly className="bg-[var(--bg-tertiary)]/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t('pages.experimentForm.experimentDescription')}</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('pages.experimentForm.descriptionPlaceholder')}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t('pages.experimentForm.methodology')}</label>
                <Textarea
                  value={form.methodology}
                  onChange={(e) => setForm({ ...form, methodology: e.target.value })}
                  placeholder={t('pages.experimentForm.methodologyPlaceholder')}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 科学设计区域 ── */}
          {showControls && (

            <div className="space-y-[var(--space-apple-md)]">

              {/* 功效目标 */}
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center gap-2 text-sm">
                    <Target size={16} className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                    功效目标选择
                    <span className="text-xs text-[var(--text-muted)] font-normal">（可多选）</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {EFFICACY_TARGETS.map((target) => (
                      <button
                        key={target.value}
                        type="button"
                        onClick={() => toggleEfficacyTarget(target.value)}
                        className={cn(
                          'px-[var(--space-apple-sm)] py-1.5 rounded-[var(--radius-Apple-sm)] text-sm border transition-all',
                          efficacyTargets.includes(target.value)
                            ? 'bg-[var(--color-success-container)] dark:bg-[var(--color-success-container)]/30 border-[var(--color-success-border)] dark:border-[var(--color-success)] text-[var(--color-success-text)] dark:text-[var(--color-success-text)]'
                            : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--color-success-border)] dark:hover:border-[var(--color-success)]/50',
                        )}
                      >
                        {t(target.labelKey)}
                      </button>
                    ))}
                  </div>
                  {efficacyTargets.length > 0 && (
                    <div className="mt-2 text-xs text-[var(--color-success-text)] dark:text-[var(--color-success-text)] flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {t('pages.experimentForm.selectedEfficacyTargets', { count: efficacyTargets.length })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 对照组设计 */}
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center gap-2 text-sm">
                    <Scale size={16} className="text-info-600 dark:text-info-700" />
                    {t('pages.experimentForm.controls')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {CONTROL_GROUPS.map((cg) => (
                      <button
                        key={cg.value}
                        type="button"
                        onClick={() => setControlGroup(cg.value)}
                        className={cn(
                          'p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border text-left transition-all',
                          controlGroup === cg.value
                            ? 'border-info-300 dark:border-info-700 bg-info-50 dark:bg-info-900/20'
                            : 'border-[var(--border-color)] hover:border-info-200 dark:hover:border-info-800/50',
                        )}
                      >
                        <p className="text-sm font-medium text-[var(--text-primary)]">{t(cg.labelKey)}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{t(cg.descKey)}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 材料清单 */}
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center gap-2">
                    <Beaker size={18} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                    {t('pages.experimentForm.materialList')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-[var(--space-apple-sm)]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-cols-4 gap-2">
                    <Input value={materialInput.name} onChange={(e) => setMaterialInput({ ...materialInput, name: e.target.value })} placeholder={t('pages.experimentForm.materialNamePlaceholder')} className="col-span-2 sm:col-span-1" size="sm" />
                    <Input value={materialInput.quantity} onChange={(e) => setMaterialInput({ ...materialInput, quantity: e.target.value })} placeholder={t('pages.experimentForm.quantityPlaceholder')} size="sm" />
                    <Input value={materialInput.unit} onChange={(e) => setMaterialInput({ ...materialInput, unit: e.target.value })} placeholder={t('pages.experimentForm.unitPlaceholder')} size="sm" />
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddMaterial} disabled={!materialInput.name.trim()}>
                      <Plus size={14} /> {t('pages.experimentForm.add')}
                    </Button>
                  </div>
                  {form.materials && form.materials.length > 0 && (
                    <div className="space-y-1.5">
                      {form.materials.map((m, i) => (
                        <div key={i} className="flex items-center justify-between px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] text-sm">
                          <span className="font-medium text-neutral-800 dark:text-[var(--text-primary)]">{m.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{m.quantity}{m.unit && ` ${m.unit}`}</span>
                          <button type="button" onClick={() => handleRemoveMaterial(i)} className="p-1 rounded hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20 text-[var(--color-error-text)] transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 设备清单 */}
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center gap-2">
                    <TestTube2 size={18} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                    {t('pages.experimentForm.equipmentList')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-[var(--space-apple-sm)]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-cols-4 gap-2">
                    <Input value={equipmentInput.name} onChange={(e) => setEquipmentInput({ ...equipmentInput, name: e.target.value })} placeholder={t('pages.experimentForm.equipmentNamePlaceholder')} className="col-span-2 sm:col-span-1" size="sm" />
                    <Input value={equipmentInput.quantity} onChange={(e) => setEquipmentInput({ ...equipmentInput, quantity: e.target.value })} placeholder={t('pages.experimentForm.quantityPlaceholder')} size="sm" />
                    <Input value={equipmentInput.unit} onChange={(e) => setEquipmentInput({ ...equipmentInput, unit: e.target.value })} placeholder={t('pages.experimentForm.unitPlaceholder')} size="sm" />
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddEquipment} disabled={!equipmentInput.name.trim()}>
                      <Plus size={14} /> {t('pages.experimentForm.add')}
                    </Button>
                  </div>
                  {form.equipment && form.equipment.length > 0 && (
                    <div className="space-y-1.5">
                      {form.equipment.map((e, i) => (
                        <div key={i} className="flex items-center justify-between px-[var(--space-apple-sm)] py-2 bg-[var(--bg-tertiary)]/50 rounded-[var(--radius-Apple-sm)] text-sm">
                          <span className="font-medium text-neutral-800 dark:text-[var(--text-primary)]">{e.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{e.quantity}{e.unit && ` ${e.unit}`}</span>
                          <button type="button" onClick={() => handleRemoveEquipment(i)} className="p-1 rounded hover:bg-[var(--color-error-container)] dark:hover:bg-[var(--color-error-container)]/20 text-[var(--color-error-text)] transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          )}

          {/* ── 参数模板 ── */}
          {selectedType && paramTemplate.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle as="h3" className="flex items-center gap-2 text-sm">
                  <Lightbulb size={16} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                  {t(EXPERIMENT_TYPES.find((x) => x.value === selectedType)?.labelKey || 'pages.experimentForm.typeOther')}{t('pages.experimentForm.paramTemplateSuffix')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-apple-sm)]">
                  {paramTemplate.map((param) => (
                    <div key={param.key}>
                      <label className="text-xs text-[var(--text-muted)] mb-1 block">{param.label}</label>
                      <Input
                        value={(form.parameters as Record<string, string>)?.[param.key] || ''}
                        onChange={(e) => updateParam(param.key, e.target.value)}
                        placeholder={param.default_value || '请输入'}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
                {sampleSizeRec && (
                  <div className="mt-[var(--space-apple-sm)] p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-sm)] bg-info-50 dark:bg-info-900/20 text-sm flex items-start gap-2">
                    <ShieldCheck size={14} className="text-info-600 dark:text-info-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-info-700 dark:text-info-700">{t('pages.experimentForm.sampleSizeSuggestion')}</span>
                      <span className="text-info-600 dark:text-info-700">{t('pages.experimentForm.sampleSizeAtLeast', { min: sampleSizeRec.min, recommended: sampleSizeRec.recommended })}</span>
                      <p className="text-xs text-info-600 dark:text-info-700 dark:text-info-700 mt-0.5">{sampleSizeRec.rationale}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 关联配方 ── */}
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <FlaskConical size={18} className="text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]" />
                {t('pages.experimentForm.linkedFormula')}
              </CardTitle>
              <p className="text-sm text-[var(--text-muted)] mt-1">{t('pages.experimentForm.linkedFormulaDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <Input
                value={formulaSearch}
                onChange={(e) => { setFormulaSearch(e.target.value); setShowAllFormulas(false) }}
                placeholder={t('pages.experimentForm.searchFormulaPlaceholder')}
                prefix={<FlaskConical size={16} />}
              />

              {(!formulaSearch || formulas.length === 0) && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    {formulaSearch ? t('pages.experimentForm.noMatchingFormula') : t('pages.experimentForm.searchPrompt')}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setFormulaSearch(''); setShowAllFormulas(true) }}
                    className="text-xs text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] hover:underline font-medium min-h-[44px] inline-flex items-center px-1 -mx-1"
                  >
                    {t('pages.experimentForm.browseAll')}
                  </button>
                </div>
              )}

              {(formulaSearch || showAllFormulas) && formulas.length > 0 && (
                <div className="border border-[var(--border-color)] rounded-[var(--radius-Apple-sm)] max-h-40 overflow-auto">
                  {formulas.map((f: any) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectFormula(f)}
                      className={cn(
                        'w-full text-left px-[var(--space-apple-sm)] py-2 text-sm hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors',
                        form.formula_id === f.id
                          ? 'bg-[var(--color-primary-container)] text-[var(--color-primary-text)]'
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      <span className="font-medium">{f.name}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{f.code}</span>
                    </button>
                  ))}
                </div>
              )}

              {form.formula_id && selectedFormulaDetail && (
                <div className="flex items-center justify-between px-[var(--space-apple-sm)] py-2.5 bg-[var(--color-primary-container)] rounded-[var(--radius-Apple-sm)]">
                  <span className="text-sm text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)] font-medium">
                    <FlaskConical size={12} className="inline mr-1" />
                    {selectedFormulaDetail.name}
                    {selectedFormulaDetail.code && <span className="ml-1 text-xs opacity-70">({selectedFormulaDetail.code})</span>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setForm({ ...form, formula_id: undefined }); setSelectedFormulaDetail(null) }}
                    className="text-[var(--color-error-text)] hover:text-[var(--color-error-text)] min-h-[44px]"
                  >
                    {t('pages.experimentForm.cancelLink')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 实验目标 ── */}
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2">
                <Target size={18} className="text-[var(--color-success-text)] dark:text-[var(--color-success-text)]" />
                {t('pages.experimentForm.objectives')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-[var(--space-apple-md)]">
              <div className="flex gap-2">
                <Input
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjective())}
                  placeholder={t('pages.experimentForm.objectivePlaceholder')}
                  className="flex-1"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddObjective}>
                  <Plus size={14} /> {t('pages.experimentForm.add')}
                </Button>
              </div>
              {form.objectives && form.objectives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.objectives.map((obj, i) => (
                    <Badge key={i} variant="info" className="group">
                      {obj}
                      <button
                        type="button"
                        onClick={() => handleRemoveObjective(i)}
                        className="ml-1 opacity-0 group-hover:opacity-100 hover:text-[var(--color-error-text)] transition-all"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 时间计划 + 预算 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle as="h3" className="flex items-center gap-2">
                  <Clock size={18} className="text-[var(--text-muted)]" />
                  {t('pages.experimentForm.schedule')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-[var(--space-apple-md)]">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t('pages.experimentForm.startDate')}</label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{t('pages.experimentForm.endDate')}</label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
                {form.start_date && form.end_date && (
                  <div className="text-xs text-[var(--text-muted)]">
                    {t('pages.experimentForm.estimatedDuration')}{(() => {
                      const d1 = new Date(form.start_date)
                      const d2 = new Date(form.end_date)
                      const days = Math.ceil((d2.getTime() - d1.getTime()) / 86400000)
                      if (days < 0) return '日期错误'
                      if (days < 30) return `${days} 天`
                      return `${Math.floor(days / 30)} 个月`
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedType && (
              <Card>
                <CardHeader>
                  <CardTitle as="h3" className="flex items-center gap-2">
                    <DollarSign size={18} className="text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]" />
                    {t('pages.experimentForm.budgetEstimate')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-[var(--space-apple-md)]">
                  <div className="text-center py-[var(--space-apple-md)]">
                    <p className="text-3xl font-bold text-[var(--color-warning-text)] dark:text-[var(--color-warning-text)]">
                      ¥{estimatedCost.toLocaleString()}
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                      {t(EXPERIMENT_TYPES.find((x) => x.value === selectedType)?.labelKey || 'pages.experimentForm.typeOther')}{t('pages.experimentForm.referenceCostSuffix')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {form.materials && form.materials.length > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>{t('pages.experimentForm.materialsCount', { count: form.materials.length })}</span>
                        <span>{t('pages.experimentForm.purchaseOnDemand')}</span>
                      </div>
                    )}
                    {form.equipment && form.equipment.length > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span>{t('pages.experimentForm.equipmentCount', { count: form.equipment.length })}</span>
                        <span>{t('pages.experimentForm.useExisting')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)]">
                      <span>{t('pages.experimentForm.costDisclaimer')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── AI 方案建议 + 方案摘要 ── */}
          {(aiSuggestion || summaryPreview.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {aiSuggestion && (
                <Card>
                  <CardHeader>
                    <CardTitle as="h3" className="flex items-center gap-2">
                      <Brain size={18} className="text-[var(--color-accent-text)] dark:text-[var(--color-accent-text)]" />
                      {t('pages.experimentForm.aiSuggestionsTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {aiSuggestion.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Sparkles size={14} className="text-[var(--color-accent-text)] shrink-0 mt-0.5" />
                          <span className="text-[var(--text-primary)]">{s}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {summaryPreview.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle as="h3" className="flex items-center gap-2">
                      <FileText size={18} className="text-[var(--color-primary-text)] dark:text-[var(--color-primary-text)]" />
                      {t('pages.experimentForm.experimentSummary')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {summaryPreview.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-[var(--text-muted)] dark:text-[var(--text-muted)] shrink-0 w-14">{item.label}</span>
                          <span className="text-[var(--text-primary)] break-all">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── 提交 ── */}
          <div className="flex items-center justify-between pt-2">
            <Link
              to="/experiments"
              className="px-[var(--space-apple-md)] py-2 min-h-[44px] inline-flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-white transition-colors"
            >
              {t('pages.experimentForm.cancelForm')}
            </Link>
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    title: '', description: '', formula_id: undefined, objectives: [],
                    methodology: '', start_date: '', end_date: '', parameters: {}, materials: [], equipment: [],
                  })
                  setSelectedType('')
                  setEfficacyTargets([])
                  setControlGroup('blank')
                  setErrors({})
                  addToast({ type: 'info', message: t('pages.experimentForm.formResetToast') })
                }}
              >
                {t('pages.experimentForm.resetForm')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={<Save size={16} />}
                loading={createMut.isPending}
                disabled={!form.title.trim() || !selectedType}
              >
                {t('pages.experimentForm.saveExperiment')}
              </Button>
            </div>
          </div>

          {createMut.isError && (
            <div className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] bg-[var(--color-error-container)] text-[var(--color-error-text)] dark:text-[var(--color-error-text)] text-sm">
              {t('pages.experimentForm.createFailed')}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
