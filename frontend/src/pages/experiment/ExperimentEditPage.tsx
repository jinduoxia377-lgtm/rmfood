/**
 * 实验编辑页面 — 专家级增强版
 * 功能：基本信息编辑 + 材料/设备管理 + 可视化参数编辑 + 目标管理 + 时间计划
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, FlaskConical, CalendarDays, Plus, X, Settings, Wrench, ClipboardList, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useExperiment } from '@/hooks/useQueries'
import { experimentApi } from '@/api/experiment'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Textarea, Card, CardContent, Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui/Common'
import { cn } from '@/lib/utils'
import type { ExperimentCreatePayload } from '@/api/experiment'

export default function ExperimentEditPage() {
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
      setError('请输入实验标题')
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
      setError(err?.response?.data?.detail || '保存失败')
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
    { key: 'basic' as const, label: '基本信息', icon: FlaskConical },
    { key: 'params' as const, label: '参数', icon: Settings },
    { key: 'materials' as const, label: '材料与设备', icon: ClipboardList },
  ]

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-neutral-500">实验不存在</p>
        <Link to="/experiments" className="text-primary-600 text-sm mt-2 inline-block">返回列表</Link>
      </div>
    )
  }

  const isEditable = experiment.status === 'planned' || experiment.status === 'in_progress'

  if (!isEditable) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-neutral-500">当前状态的实验不可编辑</p>
        <Link to={`/experiments/${experimentId}`} className="text-primary-600 text-sm mt-2 inline-block">返回详情</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/experiments/${experimentId}`)}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft size={16} />
          返回详情
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${formCompleteness.percent}%` }} />
            </div>
            <span className="text-xs text-neutral-400 font-medium">{formCompleteness.percent}%</span>
          </div>
          <Button
            onClick={handleSave}
            loading={saving}
            icon={<Save size={14} />}
            className="bg-primary-600 hover:bg-primary-700 shadow-primary-600/25"
          >
            保存修改
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 text-error-600 dark:text-error-400 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* 标签导航 */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 基本信息 */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                <FlaskConical size={18} />
                基本信息
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  实验标题 <span className="text-error-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="请输入实验标题"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">实验描述</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="请输入实验描述"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">实验方法</label>
                <Textarea
                  value={form.methodology}
                  onChange={(e) => updateField('methodology', e.target.value)}
                  placeholder="请输入实验方法"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 实验目标 */}
          <Card>
            <CardContent className="space-y-4">
              <div className="text-neutral-900 dark:text-white font-semibold">实验目标</div>

              {form.objectives && form.objectives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.objectives.map((obj, i) => (
                    <Badge key={i} variant="info" className="gap-1">
                      {obj}
                      <button onClick={() => removeObjective(i)} className="ml-0.5 hover:text-error-500">
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
                  placeholder="输入实验目标，按 Enter 添加"
                  className="flex-1"
                />
                <Button onClick={addObjective} disabled={!objectiveInput.trim()} variant="secondary" size="sm">
                  添加
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 时间计划 */}
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                <CalendarDays size={18} />
                时间计划
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    计划开始日期
                  </label>
                  <Input type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    计划结束日期
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
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
              <Settings size={18} />
              实验参数
            </div>

            {/* 参数表格 */}
            <div className="space-y-2">
              {(form.parameters ? Object.entries(form.parameters) : []).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg group">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 min-w-[120px] truncate">{key}</span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 flex-1 truncate">{String(value)}</span>
                  <button
                    onClick={() => removeParam(key)}
                    className="p-1 rounded text-neutral-400 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {(form.parameters ? Object.keys(form.parameters).length === 0 : true) && (
                <div className="text-center py-6 text-sm text-neutral-400">暂无参数，请在下方添加</div>
              )}
            </div>

            {/* 添加参数 */}
            <div className="flex gap-2">
              <Input
                value={paramKey}
                onChange={(e) => setParamKey(e.target.value)}
                placeholder="参数名"
                size="sm"
                className="flex-1"
              />
              <Input
                value={paramValue}
                onChange={(e) => setParamValue(e.target.value)}
                placeholder="参数值"
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
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                <FlaskConical size={18} className="text-violet-500" />
                实验材料
              </div>

              {(form.materials || []).map((mat: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg group">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input
                      value={mat.name || ''}
                      onChange={(e) => updateMaterial(idx, 'name', e.target.value)}
                      placeholder="材料名称"
                      size="sm"
                    />
                    <Input
                      value={mat.quantity || ''}
                      onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)}
                      placeholder="数量"
                      size="sm"
                    />
                    <Input
                      value={mat.unit || ''}
                      onChange={(e) => updateMaterial(idx, 'unit', e.target.value)}
                      placeholder="单位"
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={() => removeMaterial(idx)}
                    className="p-1 rounded text-neutral-400 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.materials || []).length === 0 && (
                <div className="text-center py-4 text-sm text-neutral-400">暂无材料，请在下方添加</div>
              )}

              <div className="flex gap-2">
                <Input
                  value={materialInput}
                  onChange={(e) => setMaterialInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial() } }}
                  placeholder="输入材料名称，按 Enter 添加"
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
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                <Wrench size={18} className="text-sky-500" />
                实验设备
              </div>

              {(form.equipment || []).map((eq: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-lg group">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex-1">{eq.name}</span>
                  <Badge variant={eq.status === 'available' ? 'success' : 'warning'} size="sm">
                    {eq.status === 'available' ? '可用' : '使用中'}
                  </Badge>
                  <button
                    onClick={() => removeEquipment(idx)}
                    className="p-1 rounded text-neutral-400 hover:text-error-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.equipment || []).length === 0 && (
                <div className="text-center py-4 text-sm text-neutral-400">暂无设备，请在下方添加</div>
              )}

              <div className="flex gap-2">
                <Input
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEquipment() } }}
                  placeholder="输入设备名称，按 Enter 添加"
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
      <div className="flex items-center justify-end gap-3 pt-2 pb-8">
        <Link to={`/experiments/${experimentId}`}>
          <Button variant="secondary">取消</Button>
        </Link>
        <Button
          onClick={handleSave}
          loading={saving}
          icon={<Save size={14} />}
          className="bg-primary-600 hover:bg-primary-700 shadow-primary-600/25"
        >
          保存修改
        </Button>
      </div>
    </div>
  )
}
