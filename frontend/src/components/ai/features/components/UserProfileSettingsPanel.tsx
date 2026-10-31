/**
 * UserProfileSettingsPanel — 用户健康画像设置面板
 *
 * 展示和编辑从对话中自动提取的用户偏好：
 * - 健康目标
 * - 过敏原
 * - 饮食限制
 * - 中医体质
 * - 年龄范围
 * - 健康备注
 * - 最近提取记录
 *
 * 支持手动修正，修正后持久化到 localStorage
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  HeartPulse, Scale, Droplets, Moon, Shield, Sparkles,
  Activity, Salad, Zap, Nut, Fish, Milk, Wheat, Bean, Egg, CircleDot, Flower2, Leaf,
  Info,
  Check, X, Pencil, Save, RefreshCw,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { userPreferencesService, type HealthGoal, type AllergenType, type DietRestriction } from '../services/userPreferencesService'
import { eventBus } from '../services/eventBus'
import { logger } from '@/utils/safeLogger'

interface UserProfileSettingsPanelProps {
  onClose: () => void
}

// ===== 选项定义 =====
const HEALTH_GOALS: Array<{ key: HealthGoal; label: string; icon: LucideIcon }> = [
  { key: 'blood_sugar_control', label: '血糖管理', icon: Droplets },
  { key: 'blood_pressure_control', label: '血压管理', icon: HeartPulse },
  { key: 'weight_management', label: '体重管理', icon: Scale },
  { key: 'sleep_improvement', label: '改善睡眠', icon: Moon },
  { key: 'immune_boost', label: '增强免疫', icon: Shield },
  { key: 'antioxidant', label: '抗氧化', icon: Sparkles },
  { key: 'liver_protection', label: '肝脏养护', icon: Activity },
  { key: 'digestive_health', label: '消化健康', icon: Salad },
  { key: 'anti_fatigue', label: '抗疲劳', icon: Zap },
]

const ALLERGENS: Array<{ key: AllergenType; label: string; icon: LucideIcon }> = [
  { key: 'peanuts', label: '花生', icon: Nut },
  { key: 'shellfish', label: '海鲜/甲壳类', icon: Fish },
  { key: 'dairy', label: '乳制品', icon: Milk },
  { key: 'gluten', label: '麸质', icon: Wheat },
  { key: 'soy', label: '大豆', icon: Bean },
  { key: 'eggs', label: '鸡蛋', icon: Egg },
  { key: 'tree_nuts', label: '坚果', icon: CircleDot },
  { key: 'sesame', label: '芝麻', icon: Flower2 },
  { key: 'mugwort', label: '菊科植物（苦瓜、桑叶等）', icon: Leaf },
]

const DIET_RESTRICTIONS: Array<{ key: DietRestriction; label: string }> = [
  { key: 'vegetarian', label: '素食' },
  { key: 'vegan', label: '纯素' },
  { key: 'halal', label: '清真' },
  { key: 'kosher', label: '洁食' },
  { key: 'low_sugar', label: '低糖' },
  { key: 'low_fat', label: '低脂' },
  { key: 'low_sodium', label: '低盐' },
  { key: 'no_alcohol', label: '禁酒' },
]

const CONSTITUTION_TYPES = [
  '平和质', '气虚质', '阳虚质', '阴虚质',
  '痰湿质', '湿热质', '血瘀质', '气郁质', '特禀质',
]

const AGE_RANGES: Array<{ key: 'under_18' | '18_30' | '31_50' | '51_70' | 'over_70'; label: string }> = [
  { key: 'under_18', label: '18岁以下' },
  { key: '18_30', label: '18-30岁' },
  { key: '31_50', label: '31-50岁' },
  { key: '51_70', label: '51-70岁' },
  { key: 'over_70', label: '70岁以上' },
]

// ===== 子组件 =====
function TagSelector<T extends string>({
  options,
  selected,
  onChange,
  label,
}: {
  options: Array<{ key: T; label: string; icon?: LucideIcon }>
  selected: T[]
  onChange: (selected: T[]) => void
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
          className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 transition-colors"
        >
          {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
          {editing ? '完成' : '编辑'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selected.includes(opt.key)
          return (
            <button
              key={opt.key}
              disabled={!editing}
              onClick={() => toggle(opt.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                isSelected
                  ? 'bg-primary-100 dark:bg-primary-300/25 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-700'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
              } ${editing ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}
            >
              {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
              {opt.label}
              {isSelected && <Check className="w-3 h-3 text-primary-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ===== 主组件 =====
export function UserProfileSettingsPanel({ onClose }: UserProfileSettingsPanelProps) {
  // 响应式 profile：保存修改 / 自动提取 / 重置后都会刷新，驱动「最近提取记录」实时更新
  const [profile, setProfile] = useState(() => userPreferencesService.getUserProfile() ?? {})

  // 类型安全的 state
  const [healthGoals, setHealthGoals] = useState<HealthGoal[]>(profile.healthGoals ?? [])
  const [allergens, setAllergens] = useState<AllergenType[]>(profile.allergens ?? [])
  const [dietRestrictions, setDietRestrictions] = useState<DietRestriction[]>(profile.dietRestrictions ?? [])
  const [constitutionType, setConstitutionType] = useState(profile.constitutionType ?? '')
  const [healthNotes, setHealthNotes] = useState(profile.healthNotes ?? '')
  const [ageRange, setAgeRange] = useState<'under_18' | '18_30' | '31_50' | '51_70' | 'over_70' | ''>(profile.ageRange ?? '')
  const [saved, setSaved] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // 面板为条件渲染，挂载时表单 state 已通过 useState 惰性初始化从服务读取最新数据，
  // 因此无需额外的挂载同步 effect；后续数据变化由保存/重置/自动提取事件驱动刷新。

  // P1-4: 监听自动提取事件，同步本地 state
  useEffect(() => {
    const unsub = eventBus.subscribe('profile:auto-extracted', (result) => {
      const parts: string[] = []
      if (result.goals.length > 0) parts.push(`健康目标: ${result.goals.join('、')}`)
      if (result.allergens.length > 0) parts.push(`过敏原: ${result.allergens.join('、')}`)
      const message = `已从对话中自动提取: ${parts.join('，')}`
      logger.info('[UserProfileSettingsPanel] 自动提取通知:', message)
      // 同步更新本地 state
      const p = userPreferencesService.getUserProfile()
      if (p) {
        setProfile(p)
        setHealthGoals(p.healthGoals ?? [])
        setAllergens(p.allergens ?? [])
      }
    })
    return unsub
  }, [])

  // P1-7: 保存验证
  const handleSave = useCallback(() => {
    // 验证：不允许同时选择素食和纯素（矛盾）
    if (dietRestrictions.includes('vegetarian') && dietRestrictions.includes('vegan')) {
      setValidationError('「素食」和「纯素」不能同时选择，请保留一个')
      return
    }
    // 验证：过敏原数量不应超过合理范围（防止误操作）
    if (allergens.length > 6) {
      setValidationError('过敏原数量异常（超过6项），请检查是否有误选')
      return
    }

    setValidationError(null)
    userPreferencesService.setHealthGoals(healthGoals)
    userPreferencesService.setAllergens(allergens)
    userPreferencesService.setDietRestrictions(dietRestrictions)
    userPreferencesService.setConstitution(constitutionType, healthNotes)
    if (ageRange) {
      userPreferencesService.setAgeRange(ageRange)
    }
    // 刷新响应式 profile，驱动「最近提取记录」等区域实时更新
    setProfile(userPreferencesService.getUserProfile() ?? {})
    setSaved(true)
    logger.info('[UserProfileSettings] 偏好已保存:', { healthGoals, allergens, constitutionType, ageRange })
    setTimeout(() => setSaved(false), 2000)
  }, [healthGoals, allergens, dietRestrictions, constitutionType, healthNotes, ageRange])

  const handleReset = () => {
    if (!window.confirm('确定要重置健康画像吗？此操作将清空所有健康目标、过敏原、饮食限制、体质倾向与健康备注。')) return

    // 立即持久化清空健康画像（仅清空 userProfile，不影响快捷键/输入行为/主题等其它偏好）
    userPreferencesService.resetUserProfile()

    setHealthGoals([])
    setAllergens([])
    setDietRestrictions([])
    setConstitutionType('')
    setHealthNotes('')
    setAgeRange('')
    setProfile(userPreferencesService.getUserProfile() ?? {})
    setValidationError(null)
    setSaved(false)
    logger.info('[UserProfileSettings] 健康画像已重置并持久化')
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
            <X className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* 年龄范围 */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">年龄范围</span>
            <div className="flex flex-wrap gap-1.5">
              {AGE_RANGES.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAgeRange(ageRange === opt.key ? '' : opt.key)}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    ageRange === opt.key
                      ? 'bg-primary-100 dark:bg-primary-300/25 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-700'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-primary-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 健康目标 */}
          <TagSelector
            options={HEALTH_GOALS}
            selected={healthGoals}
            onChange={v => setHealthGoals(v)}
            label="健康目标"
          />

          {/* 过敏原 */}
          <TagSelector
            options={ALLERGENS}
            selected={allergens}
            onChange={v => setAllergens(v)}
            label="过敏禁忌"
          />

          {/* 饮食限制 */}
          <TagSelector
            options={DIET_RESTRICTIONS}
            selected={dietRestrictions}
            onChange={v => setDietRestrictions(v)}
            label="饮食限制"
          />

          {/* 中医体质 */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">中医体质倾向</span>
            <select
              value={constitutionType}
              onChange={e => setConstitutionType(e.target.value)}
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

          {/* 健康备注 */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">健康状况备注</span>
            <textarea
              value={healthNotes}
              onChange={e => setHealthNotes(e.target.value)}
              placeholder="如：近期体检空腹血糖偏高，建议关注..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700
                bg-white dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300
                placeholder:text-neutral-300 dark:placeholder:text-neutral-600
                focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
            />
            <span className="text-[10px] text-neutral-400">{healthNotes.length}/500</span>
          </div>

          {/* 最近提取记录 */}
          {profile.recentPreferences && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 mb-1">
                <Bell className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">最近提取记录</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                时间：{new Date(profile.recentPreferences.extractedAt).toLocaleString('zh-CN')}
                {profile.recentPreferences.targetedCondition && profile.recentPreferences.targetedCondition !== 'other' && (
                  <span className="block mt-0.5">目标：{profile.recentPreferences.targetedCondition}</span>
                )}
                {profile.recentPreferences.avoidedIngredients && profile.recentPreferences.avoidedIngredients.length > 0 && (
                  <span className="block mt-0.5">规避：{profile.recentPreferences.avoidedIngredients.join('、')}</span>
                )}
              </p>
            </div>
          )}

          {/* 自动提取提示 */}
          <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-300/15 border border-primary-100 dark:border-primary-800/30">
            <div className="flex items-center gap-1.5 mb-1">
              <HeartPulse className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-xs font-semibold text-primary-700 dark:text-primary-700">AI 自动提取</span>
            </div>
            <p className="text-xs text-primary-700/80 dark:text-primary-700/80 leading-relaxed">
              系统会从您的对话内容中自动学习健康偏好。您可以在这里查看和修正自动识别的结果。
            </p>
          </div>

          {/* 数据存储说明 */}
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">数据存储说明</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              健康画像数据仅保存在本机浏览器中，清除浏览器数据后需重新设置。
            </p>
          </div>

          {/* 验证错误 */}
          {validationError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
            </div>
          )}
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
              disabled={!!validationError}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-success-surface-deep)]
                text-white text-xs font-semibold hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
