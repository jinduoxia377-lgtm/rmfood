/**
 * 实验编辑页面
 * 编辑实验信息，支持修改标题、描述、方法、时间等
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, FlaskConical, CalendarDays } from 'lucide-react'
import { useExperiment } from '@/hooks/useQueries'
import { experimentApi } from '@/api/experiment'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Textarea, Card, CardContent, Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui/Common'
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
    parameters: undefined,
    materials: undefined,
    equipment: undefined,
    start_date: '',
    end_date: '',
  })

  const [objectiveInput, setObjectiveInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (experiment) {
      setForm({
        title: experiment.title,
        description: experiment.description || '',
        formula_id: experiment.formula_id || undefined,
        objectives: experiment.objectives || [],
        methodology: experiment.methodology || '',
        parameters: experiment.parameters || undefined,
        materials: experiment.materials || undefined,
        equipment: experiment.equipment || undefined,
        start_date: experiment.start_date ? experiment.start_date.slice(0, 10) : '',
        end_date: experiment.end_date ? experiment.end_date.slice(0, 10) : '',
      })
    }
  }, [experiment])

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('请输入实验标题')
      return
    }
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

  const addObjective = () => {
    const trimmed = objectiveInput.trim()
    if (trimmed && !form.objectives?.includes(trimmed)) {
      setForm((prev) => ({ ...prev, objectives: [...(prev.objectives || []), trimmed] }))
      setObjectiveInput('')
    }
  }

  const removeObjective = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      objectives: (prev.objectives || []).filter((_, i) => i !== idx),
    }))
  }

  const updateField = <K extends keyof ExperimentCreatePayload>(key: K, value: ExperimentCreatePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-slate-500">实验不存在</p>
        <Link to="/experiments" className="text-primary-600 text-sm mt-2 inline-block">返回列表</Link>
      </div>
    )
  }

  if (experiment.status !== 'planned' && experiment.status !== 'in_progress') {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-slate-500">当前状态的实验不可编辑</p>
        <Link to={`/experiments/${experimentId}`} className="text-primary-600 text-sm mt-2 inline-block">
          返回详情
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/experiments/${experimentId}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
          返回详情
        </button>
        <Button
          onClick={handleSave}
          loading={saving}
          icon={<Save size={14} />}
          className="bg-violet-600 hover:bg-violet-700 shadow-violet-600/25"
        >
          保存修改
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <FlaskConical size={18} />
            基本信息
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              实验标题 <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="请输入实验标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              实验描述
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="请输入实验描述"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              实验方法
            </label>
            <Textarea
              value={form.methodology}
              onChange={(e) => updateField('methodology', e.target.value)}
              placeholder="请输入实验方法"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 实验目标 */}
      <Card>
        <CardContent className="space-y-4">
          <div className="text-slate-900 dark:text-white font-semibold">实验目标</div>

          {form.objectives && form.objectives.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.objectives.map((obj, i) => (
                <Badge key={i} variant="info">
                  {obj}
                  <button onClick={() => removeObjective(i)} className="ml-0.5 hover:text-red-500">x</button>
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
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <CalendarDays size={18} />
            时间计划
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">计划开始日期</label>
              <Input type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">计划结束日期</label>
              <Input type="date" value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 实验参数 (JSON) */}
      <Card>
        <CardContent className="space-y-4">
          <div className="text-slate-900 dark:text-white font-semibold">实验参数 (JSON)</div>
          <Textarea
            value={form.parameters ? JSON.stringify(form.parameters, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : undefined
                updateField('parameters', parsed)
              } catch { /* 忽略 */ }
            }}
            placeholder='{"temperature": 37, "ph": 7.0}'
            rows={4}
            className="font-mono"
          />
        </CardContent>
      </Card>

      {/* 底部保存按钮 */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-8">
        <Link to={`/experiments/${experimentId}`}>
          <Button variant="secondary">取消</Button>
        </Link>
        <Button
          onClick={handleSave}
          loading={saving}
          icon={<Save size={14} />}
          className="bg-violet-600 hover:bg-violet-700 shadow-violet-600/25"
        >
          保存修改
        </Button>
      </div>
    </div>
  )
}
