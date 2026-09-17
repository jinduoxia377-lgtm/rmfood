/**
 * 新建实验页面 — Phase 6 专业增强版
 * 实验类型分类 + 参数模板 + 预算估算 + 表单验证
 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, FlaskConical, CalendarDays, DollarSign, AlertCircle, CheckCircle2, Lightbulb, X, Microscope, Target, Shield, TestTube, Settings, Wine, FileText } from 'lucide-react'
import { useCreateExperiment, useFormulas } from '@/hooks/useQueries'
import { Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle, PageHeader, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ExperimentCreatePayload } from '@/api/experiment'

// ── 实验类型 ──
const EXPERIMENT_TYPES = [
  { value: 'stability', label: '稳定性实验', desc: '检测配方在不同条件下的稳定性', icon: Microscope, color: 'from-sky-500 to-blue-600' },
  { value: 'efficacy', label: '功效验证实验', desc: '验证配方的目标功效', icon: Target, color: 'from-primary-500 to-teal-600' },
  { value: 'safety', label: '安全毒理学', desc: '急性/亚慢性毒性试验', icon: Shield, color: 'from-amber-500 to-orange-600' },
  { value: 'composition', label: '成分分析', desc: '配方成分含量测定', icon: TestTube, color: 'from-violet-500 to-purple-600' },
  { value: 'process', label: '工艺优化', desc: '制备工艺参数优化', icon: Settings, color: 'from-slate-500 to-slate-600' },
  { value: 'taste', label: '感官评价', desc: '口感/色泽/气味等感官指标', icon: Wine, color: 'from-pink-500 to-rose-600' },
  { value: 'other', label: '其他', desc: '其他类型的实验', icon: FileText, color: 'from-gray-400 to-gray-500' },
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

export default function ExperimentNewPage() {
  const navigate = useNavigate()
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
  })

  const [objectiveInput, setObjectiveInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 参数模板值
  const paramTemplate = PARAM_TEMPLATES[selectedType] || []

  // 关联配方搜索
  const [formulaSearch, setFormulaSearch] = useState('')
  const { data: formulaData } = useFormulas({ search: formulaSearch, page_size: 10 })
  const formulas = (formulaData as { items?: unknown[] })?.items ?? []

  // 预算估算
  const estimatedCost = useMemo(() => {
    const base = { stability: 15000, efficacy: 25000, safety: 35000, composition: 8000, process: 12000, taste: 5000, other: 10000 }
    return base[selectedType as keyof typeof base] || 0
  }, [selectedType])

  const handleSelectType = (type: string) => {
    setSelectedType(type)
    // 初始化参数模板
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.title.trim()) newErrors.title = '请输入实验标题'
    if (!selectedType) newErrors.type = '请选择实验类型'
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
      navigate(`/experiments/${experiment.id}`)
    } catch {
      // error handled by mutation
    }
  }

  const formCompleteness = useMemo(() => {
    let filled = 0
    const total = 5
    if (form.title.trim()) filled++
    if (selectedType) filled++
    if (form.objectives && form.objectives.length > 0) filled++
    if (form.methodology?.trim()) filled++
    if (form.start_date && form.end_date) filled++
    return { filled, total, percent: Math.round((filled / total) * 100) }
  }, [form, selectedType])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/experiments"
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <PageHeader title="新建实验" description="创建一个新的实验计划" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${formCompleteness.percent}%` }} />
          </div>
          <span className="text-xs text-neutral-400 font-medium">{formCompleteness.percent}%</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 实验类型选择 */}
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <FlaskConical size={18} className="text-violet-500" />
              实验类型
              <span className="text-error-500 text-sm">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errors.type && (
              <div className="flex items-center gap-2 text-sm text-error-500 mb-3">
                <AlertCircle size={14} />{errors.type}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPERIMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleSelectType(type.value)}
                  className={cn(
                    'relative p-3 rounded-xl border text-left transition-all',
                    selectedType === type.value
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
                  )}
                >
                  <span className="text-lg"><type.icon className="w-5 h-5" /></span>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white mt-1">{type.label}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-tight">{type.desc}</p>
                  {selectedType === type.value && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 size={14} className="text-violet-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 基本信息 */}
        <Card>
          <CardContent className="space-y-5">
            <h2 className="font-semibold text-neutral-900 dark:text-white">基本信息</h2>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                实验标题 <span className="text-error-500">*</span>
              </label>
              <Input
                required
                value={form.title}
                onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((p) => ({ ...p, title: '' })) }}
                placeholder="输入实验标题"
                error={errors.title}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">实验描述</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要描述实验目的和背景..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">实验方法</label>
              <Textarea
                value={form.methodology}
                onChange={(e) => setForm({ ...form, methodology: e.target.value })}
                placeholder="描述实验方法、步骤和技术路线..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* 实验参数模板 */}
        {selectedType && paramTemplate.length > 0 && (
          <Card className="!border-violet-200 dark:!border-violet-800/50">
            <CardHeader>
              <CardTitle as="h3" className="flex items-center gap-2 text-sm">
                <Lightbulb size={16} className="text-warning-500" />
                {EXPERIMENT_TYPES.find((t) => t.value === selectedType)?.label}参数模板
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paramTemplate.map((param) => (
                  <div key={param.key}>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">{param.label}</label>
                    <Input
                      value={(form.parameters as Record<string, string>)?.[param.key] || ''}
                      onChange={(e) => updateParam(param.key, e.target.value)}
                      placeholder={param.default_value || '请输入'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 关联配方 */}
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-semibold text-neutral-900 dark:text-white">关联配方</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">可选：将实验关联到已有配方</p>

            <Input
              value={formulaSearch}
              onChange={(e) => setFormulaSearch(e.target.value)}
              placeholder="搜索配方名称..."
              prefix={<FlaskConical size={16} />}
            />

            {formulaSearch && formulas.length > 0 && (
              <div className="border border-neutral-200 dark:border-neutral-600 rounded-lg max-h-40 overflow-auto">
                {formulas.map((f: any) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, formula_id: f.id })
                      setFormulaSearch('')
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors',
                      form.formula_id === f.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'text-neutral-700 dark:text-neutral-300',
                    )}
                  >
                    <span className="font-medium">{f.name}</span>
                    <span className="ml-2 text-xs text-neutral-400">{f.code}</span>
                  </button>
                ))}
              </div>
            )}

            {form.formula_id && (
              <div className="flex items-center justify-between px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <span className="text-sm text-primary-700 dark:text-primary-400 font-medium">
                  已关联配方 ID: {form.formula_id}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, formula_id: undefined })}
                  className="text-error-500 hover:text-error-600"
                >
                  取消关联
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 实验目标 */}
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-semibold text-neutral-900 dark:text-white">实验目标</h2>
            <div className="flex gap-2">
              <Input
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddObjective())}
                placeholder="输入实验目标后回车添加"
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAddObjective}>
                添加
              </Button>
            </div>
            {form.objectives && form.objectives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.objectives.map((obj, i) => (
                  <Badge key={i} variant="info">
                    {obj}
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(i)}
                      className="ml-1 hover:text-error-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 时间计划 + 预算 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-neutral-500" />
                <h2 className="font-semibold text-neutral-900 dark:text-white">时间计划</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">计划开始日期</label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">计划结束日期</label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedType && (
            <Card className="!border-amber-200 dark:!border-amber-800/50">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign size={18} className="text-warning-500" />
                  <h2 className="font-semibold text-neutral-900 dark:text-white">预算估算</h2>
                </div>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-warning-600 dark:text-warning-400">
                    ¥{estimatedCost.toLocaleString()}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {EXPERIMENT_TYPES.find((t) => t.value === selectedType)?.label}参考费用
                  </p>
                  <p className="text-xs text-neutral-400 mt-2">实际费用以合同为准，仅供参考</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 提交 */}
        <div className="flex items-center justify-between pt-2">
          <Link
            to="/experiments"
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            取消
          </Link>
          <Button
            type="submit"
            icon={<Save size={16} />}
            loading={createMut.isPending}
            disabled={!form.title.trim() || !selectedType}
            className="bg-primary-600 hover:bg-primary-700 shadow-primary-600/25"
          >
            创建实验
          </Button>
        </div>

        {createMut.isError && (
          <div className="px-4 py-3 rounded-lg bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 text-sm">
            创建失败，请检查表单信息后重试
          </div>
        )}
      </form>
    </div>
  )
}
