import React, { useState, useCallback } from 'react'
import { Shield, AlertTriangle, Users, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Input, Badge } from '@/components/ui'

// ─── 类型定义 ───

export type AgeGroup = 'children' | 'adult' | 'elderly' | 'pregnant'
export type Gender = 'male' | 'female'
export type CookingMethod = 'decoction' | 'tea' | 'soup' | 'paste' | 'powder'

export interface PersonalConstraints {
  // 人群信息
  ageGroup: AgeGroup
  gender?: Gender
  weight?: number  // kg
  height?: number  // cm

  // 禁忌信息
  allergies: string[]
  contraindications: string[]  // 禁用药材
  dietaryRestrictions: string[]

  // 健康状况
  conditions: string[]
  currentMedications: string[]

  // 烹饪偏好
  cookingMethod: CookingMethod
  cookingTime?: number  // 分钟
  preferredFormat?: 'tablet' | 'powder' | 'tea' | 'soup' | 'paste'
}

export interface ConstraintPanelProps {
  constraints?: Partial<PersonalConstraints>
  onChange: (constraints: PersonalConstraints) => void
  className?: string
}

// ─── 常量定义 ───

const AGE_GROUP_OPTIONS = [
  { value: 'children', label: '儿童(3-12岁)', icon: '👶' },
  { value: 'adult', label: '成人', icon: '🧑' },
  { value: 'elderly', label: '老人(60岁+)', icon: '👴' },
  { value: 'pregnant', label: '孕妇', icon: '🤰' },
]

const COOKING_METHOD_OPTIONS = [
  { value: 'decoction', label: '煎煮', desc: '传统水煎' },
  { value: 'tea', label: '代茶饮', desc: '冲泡饮用' },
  { value: 'soup', label: '汤剂', desc: '炖汤食用' },
  { value: 'paste', label: '膏方', desc: '浓缩膏滋' },
  { value: 'powder', label: '粉剂', desc: '研磨冲服' },
]

const ALLERGY_PRESETS = [
  '花粉', '海鲜', '坚果', '牛奶', '鸡蛋', '小麦', '大豆', '花生',
]

const CONDITION_PRESETS = [
  '高血压', '糖尿病', '高血脂', '肝病', '肾病', '胃病',
  '哮喘', '过敏史', '手术史', '肿瘤史',
]

// ─── 子组件 ───

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const addTag = useCallback(() => {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }, [input, tags, onChange])

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag))
    },
    [tags, onChange],
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="px-2 py-0.5 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
            onClick={() => removeTag(tag)}
          >
            {tag}
            <span className="ml-1">×</span>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 px-2 text-xs" onClick={addTag}>
          添加
        </Button>
      </div>
    </div>
  )
}

function PresetSelector({
  options,
  selected,
  onChange,
}: {
  options: Array<{ value: string; label: string; icon?: string }>
  selected: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-2 rounded-lg text-left transition-all border',
            selected === opt.value
              ? 'bg-primary/10 border-primary'
              : 'bg-muted border-transparent hover:border-muted-foreground/30',
          )}
        >
          <div className="flex items-center gap-1.5">
            {opt.icon && <span className="text-sm">{opt.icon}</span>}
            <span
              className={cn(
                'text-xs font-medium',
                selected === opt.value ? 'text-primary' : 'text-foreground',
              )}
            >
              {opt.label}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── 主组件 ───

export function ConstraintPanel({
  constraints = {} as Partial<PersonalConstraints>,
  onChange,
  className,
}: ConstraintPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateConstraint = useCallback(
    <K extends keyof PersonalConstraints>(key: K, value: PersonalConstraints[K]) => {
      onChange({ ...constraints, [key]: value } as PersonalConstraints)
    },
    [constraints, onChange],
  )

  const hasActiveConstraints = Object.values(constraints).some(
    (v) => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null,
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-warning-500 to-error-500 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">个性化约束</h3>
            <p className="text-xs text-muted-foreground">
              {hasActiveConstraints ? '已设置约束条件' : '设置个人禁忌与偏好'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Users className="w-3.5 h-3.5 mr-1" />
          {isExpanded ? '收起' : '设置'}
        </Button>
      </div>

      {/* 人群选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          目标人群
        </label>
        <PresetSelector
          options={AGE_GROUP_OPTIONS}
          selected={constraints.ageGroup || 'adult'}
          onChange={(v) => updateConstraint('ageGroup', v as AgeGroup)}
        />
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t">
          {/* 过敏原 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              过敏原（点击标签快速添加）
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ALLERGY_PRESETS.map((allergy) => (
                <button
                  key={allergy}
                  onClick={() => {
                    const current = constraints.allergies || []
                    if (current.includes(allergy)) {
                      updateConstraint(
                        'allergies',
                        current.filter((a) => a !== allergy),
                      )
                    } else {
                      updateConstraint('allergies', [...current, allergy])
                    }
                  }}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs border transition-all',
                    (constraints.allergies || []).includes(allergy)
                      ? 'bg-error/10 border-error text-error'
                      : 'bg-muted border-transparent hover:border-muted-foreground/30',
                  )}
                >
                  {allergy}
                </button>
              ))}
            </div>
            <TagInput
              tags={constraints.allergies || []}
              onChange={(v) => updateConstraint('allergies', v)}
              placeholder="添加其他过敏原..."
            />
          </div>

          {/* 健康状况 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              健康状况
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CONDITION_PRESETS.map((condition) => (
                <button
                  key={condition}
                  onClick={() => {
                    const current = constraints.conditions || []
                    if (current.includes(condition)) {
                      updateConstraint(
                        'conditions',
                        current.filter((c) => c !== condition),
                      )
                    } else {
                      updateConstraint('conditions', [...current, condition])
                    }
                  }}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs border transition-all',
                    (constraints.conditions || []).includes(condition)
                      ? 'bg-warning/10 border-warning text-warning'
                      : 'bg-muted border-transparent hover:border-muted-foreground/30',
                  )}
                >
                  {condition}
                </button>
              ))}
            </div>
            <TagInput
              tags={constraints.conditions || []}
              onChange={(v) => updateConstraint('conditions', v)}
              placeholder="添加其他健康状况..."
            />
          </div>

          {/* 烹饪方式 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5" />
              烹饪方式
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COOKING_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateConstraint('cookingMethod', opt.value as CookingMethod)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-left transition-all border',
                    constraints.cookingMethod === opt.value
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted border-transparent hover:border-muted-foreground/30',
                  )}
                >
                  <div
                    className={cn(
                      'text-xs font-medium',
                      constraints.cookingMethod === opt.value
                        ? 'text-primary'
                        : 'text-foreground',
                    )}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 禁用药材 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              禁用药材（手动输入）
            </label>
            <TagInput
              tags={constraints.contraindications || []}
              onChange={(v) => updateConstraint('contraindications', v)}
              placeholder="如：附子、藜芦..."
            />
          </div>

          {/* 快捷操作 */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                onChange({
                  ageGroup: 'adult',
                  allergies: [],
                  contraindications: [],
                  dietaryRestrictions: [],
                  conditions: [],
                  currentMedications: [],
                  cookingMethod: 'decoction',
                })
              }
            >
              重置约束
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() =>
                onChange({
                  ageGroup: 'children',
                  allergies: [],
                  contraindications: [],
                  dietaryRestrictions: [],
                  conditions: [],
                  currentMedications: [],
                  cookingMethod: 'soup',
                })
              }
            >
              儿童模式
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export types for convenience (already exported at top of file)
