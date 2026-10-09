/**
 * UserProfileSettingsPanel — 用户健康画像设置面板
 *
 * 展示和编辑从对话中自动提取的用户偏好：
 * - 健康目标
 * - 过敏原
 * - 饮食限制
 * - 中医体质
 *
 * 支持手动修正，修正后持久化到 localStorage
 */
import React, { useState, useEffect } from 'react'
import {
  HeartPulse, ShieldAlert, UtensilsCrossed, Scale,
  Check, X, Pencil, Save, RefreshCw,
} from 'lucide-react'
import { userPreferencesService } from '../services/userPreferencesService'
import { logger } from '@/utils/safeLogger'

interface UserProfileSettingsPanelProps {
  onClose: () => void
}

// ===== 选项定义 =====
const HEALTH_GOALS = [
  { key: 'blood_sugar_control', label: '血糖管理', icon: '🩸' },
  { key: 'blood_pressure_control', label: '血压管理', icon: '❤️' },
  { key: 'weight_management', label: '体重管理', icon: '⚖️' },
  { key: 'sleep_improvement', label: '改善睡眠', icon: '😴' },
  { key: 'immune_boost', label: '增强免疫', icon: '🛡️' },
  { key: 'antioxidant', label: '抗氧化', icon: '✨' },
  { key: 'liver_protection', label: '肝脏养护', icon: '🫁' },
  { key: 'digestive_health', label: '消化健康', icon: '🍚' },
  { key: 'anti_fatigue', label: '抗疲劳', icon: '⚡' },
] as const

const ALLERGENS = [
  { key: 'peanuts', label: '花生', icon: '🥜' },
  { key: 'shellfish', label: '海鲜/甲壳类', icon: '🦐' },
  { key: 'dairy', label: '乳制品', icon: '🥛' },
  { key: 'gluten', label: '麸质', icon: '🌾' },
  { key: 'soy', label: '大豆', icon: '🫘' },
  { key: 'eggs', label: '鸡蛋', icon: '🥚' },
  { key: 'tree_nuts', label: '坚果', icon: '🥥' },
  { key: 'sesame', label: '芝麻', icon: '🌰' },
  { key: 'mugwort', label: '菊科植物（苦瓜、桑叶等）', icon: '🌿' },
] as const

const DIET_RESTRICTIONS = [
  { key: 'vegetarian', label: '素食' },
  { key: 'vegan', label: '纯素' },
  { key: 'halal', label: '清真' },
  { key: 'low_sugar', label: '低糖' },
  { key: 'low_fat', label: '低脂' },
  { key: 'low_sodium', label: '低盐' },
  { key: 'no_alcohol', label: '禁酒' },
] as const

const CONSTITUTION_TYPES = [
  '平和质', '气虚质', '阳虚质', '阴虚质',
  '痰湿质', '湿热质', '血瘀质', '气郁质', '特禀质',
]

// ===== 组件 =====
function TagSelector<T extends string>({
  options,
  selected,
  onChange,
  iconMap,
  label,
}: {
  options: Array<{ key: T; label: string; icon?: string }>
  selected: T[]
  onChange: (selected: T[]) => void
  iconMap?: Record<T, string>
  label: string
}) {
  const [editing, setEditing] = useState(false)

  const toggle = (key: T) => {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">{label}</span>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1 text-[10px] text-primary-500 hover:text-primary-700 transition-colors"
        >
          {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {editing ? '完成' : '编辑'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selected.includes(opt.key)
          const icon = iconMap?.[opt.key] ?? ''
          return (
            <button
              key={opt.key}
              disabled={!editing}
              onClick={() => toggle(opt.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 ${
                isSelected
                  ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-600'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
              } ${editing ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
            >
              {icon && <span className="text-xs">{icon}</span>}
              {opt.label}
              {isSelected && <Check className="w-3 h-3 text-primary-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ConstitutionSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">中医体质倾向</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700
          bg-white dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300
          focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      >
        <option value="">未设置</option>
        {CONSTITUTION_TYPES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  )
}

export function UserProfileSettingsPanel({ onClose }: UserProfileSettingsPanelProps) {
  const profile = userPreferencesService.getUserProfile() ?? {}
  const [healthGoals, setHealthGoals] = useState<string[]>(profile.healthGoals ?? [])
  const [allergens, setAllergens] = useState<string[]>(profile.allergens ?? [])
  const [dietRestrictions, setDietRestrictions] = useState<string[]>(profile.dietRestrictions ?? [])
  const [constitutionType, setConstitutionType] = useState(profile.constitutionType ?? '')
  const [healthNotes, setHealthNotes] = useState(profile.healthNotes ?? '')
  const [saved, setSaved] = useState(false)

  // 同步远程自动提取的偏好
  useEffect(() => {
    const p = userPreferencesService.getUserProfile()
    if (p) {
      setHealthGoals(p.healthGoals ?? [])
      setAllergens(p.allergens ?? [])
      setDietRestrictions(p.dietRestrictions ?? [])
      setConstitutionType(p.constitutionType ?? '')
      setHealthNotes(p.healthNotes ?? '')
    }
  }, [])

  const handleSave = () => {
    userPreferencesService.setHealthGoals(healthGoals as any)
    userPreferencesService.setAllergens(allergens as any)
    userPreferencesService.setDietRestrictions(dietRestrictions as any)
    userPreferencesService.setConstitution(constitutionType, healthNotes)
    setSaved(true)
    logger.info('[UserProfileSettings] 偏好已保存:', { healthGoals, allergens, constitutionType })
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setHealthGoals([])
    setAllergens([])
    setDietRestrictions([])
    setConstitutionType('')
    setHealthNotes('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 面板 */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl
        border border-neutral-200 dark:border-neutral-700 overflow-hidden animate-fade-in-up">

        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary-500" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              我的健康画像
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* 健康目标 */}
          <TagSelector
            options={HEALTH_GOALS.map(g => ({ key: g.key as string, label: g.label, icon: g.icon }))}
            selected={healthGoals}
            onChange={v => setHealthGoals(v)}
            label="健康目标"
          />

          {/* 过敏原 */}
          <TagSelector
            options={ALLERGENS.map(a => ({ ...a }))}
            selected={allergens}
            onChange={v => setAllergens(v)}
            iconMap={{ mugwort: '🌿' }}
            label="过敏禁忌"
          />

          {/* 饮食限制 */}
          <TagSelector
            options={DIET_RESTRICTIONS.map(r => ({ key: r.key as string, label: r.label }))}
            selected={dietRestrictions}
            onChange={v => setDietRestrictions(v)}
            label="饮食限制"
          />

          {/* 中医体质 */}
          <ConstitutionSelect value={constitutionType} onChange={setConstitutionType} />

          {/* 健康备注 */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">健康状况备注</span>
            <textarea
              value={healthNotes}
              onChange={e => setHealthNotes(e.target.value)}
              placeholder="如：近期体检空腹血糖偏高，建议关注..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700
                bg-white dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300
                placeholder:text-neutral-300 dark:placeholder:text-neutral-600
                focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
            />
          </div>

          {/* 自动提取提示 */}
          <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30">
            <div className="flex items-center gap-1.5 mb-1">
              <HeartPulse className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-[10px] font-semibold text-primary-700 dark:text-primary-600">AI 自动提取</span>
            </div>
            <p className="text-[10px] text-primary-700/80 dark:text-primary-600/80 leading-relaxed">
              系统会从您的对话内容中自动学习健康偏好。您可以在这里查看和修正自动识别的结果。
              {profile.recentPreferences && (
                <span className="block mt-1 opacity-75">
                  最近一次提取：{new Date(profile.recentPreferences.extractedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重置
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-emerald-500
                text-white text-xs font-semibold hover:shadow-md active:scale-[0.98] transition-all"
            >
              {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {saved ? '已保存' : '保存修改'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfileSettingsPanel
