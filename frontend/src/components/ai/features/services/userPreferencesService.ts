import { logger } from '@/utils/safeLogger'
import { storageService } from './storageService'

export type HotkeyAction =
  | 'sendMessage'
  | 'newLine'
  | 'toggleDeepThinking'
  | 'toggleSmartSearch'
  | 'clearInput'

export interface HotkeyConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

export interface InputBehaviorConfig {
  autoFocus: boolean
  autoResize: boolean
  minHeight: number
  maxHeight: number
  enterToSend: boolean
  showCharCount: boolean
  showSuggestions: boolean
}

/**
 * 用户健康画像相关类型
 */
export type HealthGoal =
  | 'blood_sugar_control'    // 控血糖
  | 'blood_pressure_control' // 控血压
  | 'weight_management'      // 体重管理
  | 'sleep_improvement'      // 改善睡眠
  | 'immune_boost'           // 增强免疫
  | 'antioxidant'            // 抗氧化
  | 'liver_protection'       // 护肝
  | 'digestive_health'       // 消化健康
  | 'anti_fatigue'           // 抗疲劳
  | 'other'

export type AllergenType =
  | 'peanuts'
  | 'shellfish'
  | 'dairy'
  | 'gluten'
  | 'soy'
  | 'eggs'
  | 'tree_nuts'
  | 'sesame'
  | 'mugwort'        // 菊科植物（苦瓜、桑叶过敏源）
  | 'other'

export type DietRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'low_sugar'
  | 'low_fat'
  | 'low_sodium'
  | 'no_alcohol'

export interface UserProfileContext {
  /** 健康目标列表 */
  healthGoals?: HealthGoal[]
  /** 过敏原列表 */
  allergens?: AllergenType[]
  /** 饮食限制 */
  dietRestrictions?: DietRestriction[]
  /** 年龄范围 */
  ageRange?: 'under_18' | '18_30' | '31_50' | '51_70' | 'over_70'
  /** 体质倾向（中医体质） */
  constitutionType?: string
  /** 特殊健康状况备注 */
  healthNotes?: string
  /** 最近一次对话提取的偏好摘要 */
  recentPreferences?: {
    targetedCondition?: string
    preferredIngredients?: string[]
    avoidedIngredients?: string[]
    dosagePreference?: string
    extractedAt: number
  }
}

export interface UserPreferences {
  hotkeys: Partial<Record<HotkeyAction, HotkeyConfig>>
  inputBehavior: InputBehaviorConfig
  theme?: 'light' | 'dark' | 'system'
  /** 用户健康画像上下文 */
  userProfile?: UserProfileContext
}

const STORAGE_KEY = 'user-preferences'
const CURRENT_VERSION = 1

const DEFAULT_HOTKEYS: Partial<Record<HotkeyAction, HotkeyConfig>> = {
  sendMessage: { key: 'Enter' },
  newLine: { key: 'Enter', shift: true },
  toggleDeepThinking: { key: 'D', ctrl: true },
  toggleSmartSearch: { key: 'S', ctrl: true },
  clearInput: { key: 'Escape' },
}

const DEFAULT_INPUT_BEHAVIOR: InputBehaviorConfig = {
  autoFocus: true,
  autoResize: true,
  minHeight: 40,
  maxHeight: 160,
  enterToSend: true,
  showCharCount: true,
  showSuggestions: true,
}

const DEFAULT_PREFERENCES: UserPreferences = {
  hotkeys: DEFAULT_HOTKEYS,
  inputBehavior: DEFAULT_INPUT_BEHAVIOR,
  theme: 'system',
}

export class UserPreferencesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserPreferencesError'
  }
}

export class UserPreferencesService {
  private preferences: UserPreferences | null = null
  private listeners: ((preferences: UserPreferences) => void)[] = []

  constructor() {
    this.loadPreferences()
  }

  private loadPreferences(): void {
    try {
      const stored = storageService.get<UserPreferences>(STORAGE_KEY)
      if (stored) {
        this.preferences = this.mergeWithDefaults(stored)
        logger.info('[UserPreferencesService] 从存储加载偏好设置成功')
      } else {
        this.preferences = { ...DEFAULT_PREFERENCES }
        logger.info('[UserPreferencesService] 使用默认偏好设置')
      }
    } catch (error) {
      logger.error('[UserPreferencesService] 加载偏好设置失败，使用默认值:', error)
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
  }

  private mergeWithDefaults(partial: Partial<UserPreferences>): UserPreferences {
    return {
      ...DEFAULT_PREFERENCES,
      ...partial,
      hotkeys: { ...DEFAULT_PREFERENCES.hotkeys, ...partial.hotkeys },
      inputBehavior: { ...DEFAULT_PREFERENCES.inputBehavior, ...partial.inputBehavior },
      userProfile: partial.userProfile
        ? { ...((DEFAULT_PREFERENCES.userProfile ?? {} as UserProfileContext)), ...partial.userProfile }
        : this.preferences?.userProfile ?? undefined,
    }
  }

  private savePreferences(): void {
    if (!this.preferences) {
      throw new UserPreferencesError('偏好设置未初始化')
    }

    try {
      storageService.set(STORAGE_KEY, this.preferences)
      logger.info('[UserPreferencesService] 偏好设置保存成功')
      this.notifyListeners()
    } catch (error) {
      logger.error('[UserPreferencesService] 保存偏好设置失败:', error)
      throw new UserPreferencesError('保存偏好设置失败')
    }
  }

  private notifyListeners(): void {
    if (!this.preferences) return
    this.listeners.forEach(listener => {
      try {
        listener(this.preferences!)
      } catch (error) {
        logger.error('[UserPreferencesService] 通知监听器失败:', error)
      }
    })
  }

  getPreferences(): UserPreferences {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return { ...this.preferences }
  }

  setHotkey(action: HotkeyAction, config: HotkeyConfig): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys[action] = { ...config }
    this.savePreferences()
  }

  getHotkey(action: HotkeyAction): HotkeyConfig | undefined {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    const config = this.preferences.hotkeys[action]
    return config ? { ...config } : undefined
  }

  resetHotkey(action: HotkeyAction): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys[action] = DEFAULT_PREFERENCES.hotkeys[action]
    this.savePreferences()
  }

  resetAllHotkeys(): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.hotkeys = { ...DEFAULT_HOTKEYS }
    this.savePreferences()
  }

  setInputBehavior(config: Partial<InputBehaviorConfig>): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.inputBehavior = { ...this.preferences.inputBehavior, ...config }
    this.savePreferences()
  }

  getInputBehavior(): InputBehaviorConfig {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return { ...this.preferences.inputBehavior }
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    this.preferences.theme = theme
    this.savePreferences()
  }

  getTheme(): 'light' | 'dark' | 'system' {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return this.preferences.theme || 'system'
  }

  resetAll(): void {
    this.preferences = { ...DEFAULT_PREFERENCES }
    this.savePreferences()
    logger.info('[UserPreferencesService] 所有偏好设置已重置为默认值')
  }

  subscribe(listener: (preferences: UserPreferences) => void): () => void {
    this.listeners.push(listener)
    if (this.preferences) {
      try {
        listener(this.preferences)
      } catch (error) {
        logger.error('[UserPreferencesService] 初始通知监听器失败:', error)
      }
    }

    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  exportPreferences(): string {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    return JSON.stringify(this.preferences, null, 2)
  }

  importPreferences(jsonString: string): void {
    try {
      const imported = JSON.parse(jsonString)
      this.preferences = this.mergeWithDefaults(imported)
      this.savePreferences()
      logger.info('[UserPreferencesService] 偏好设置导入成功')
    } catch (error) {
      logger.error('[UserPreferencesService] 导入偏好设置失败:', error)
      throw new UserPreferencesError('导入的偏好设置格式无效')
    }
  }

  validateHotkey(config: HotkeyConfig): boolean {
    if (!config.key || config.key.trim().length === 0) {
      return false
    }
    return true
  }

  /**
   * 获取用户健康画像上下文
   */
  getUserProfile(): UserProfileContext | undefined {
    return this.preferences?.userProfile
  }

  /**
   * 设置健康目标
   */
  setHealthGoals(goals: HealthGoal[]): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    if (!this.preferences.userProfile) {
      this.preferences.userProfile = {} as UserProfileContext
    }
    this.preferences.userProfile.healthGoals = goals
    this.savePreferences()
  }

  /**
   * 设置过敏原
   */
  setAllergens(allergens: AllergenType[]): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    if (!this.preferences.userProfile) {
      this.preferences.userProfile = {} as UserProfileContext
    }
    this.preferences.userProfile.allergens = allergens
    this.savePreferences()
  }

  /**
   * 设置饮食限制
   */
  setDietRestrictions(restrictions: DietRestriction[]): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    if (!this.preferences.userProfile) {
      this.preferences.userProfile = {} as UserProfileContext
    }
    this.preferences.userProfile.dietRestrictions = restrictions
    this.savePreferences()
  }

  /**
   * 设置体质倾向与健康备注
   */
  setConstitution(constitutionType: string, healthNotes?: string): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    if (!this.preferences.userProfile) {
      this.preferences.userProfile = {} as UserProfileContext
    }
    this.preferences.userProfile.constitutionType = constitutionType
    if (healthNotes !== undefined) {
      this.preferences.userProfile.healthNotes = healthNotes
    }
    this.savePreferences()
  }

  /**
   * 从对话内容中自动提取偏好并更新画像
   */
  extractAndSavePreferencesFromContent(content: string): void {
    if (!this.preferences) {
      this.preferences = { ...DEFAULT_PREFERENCES }
    }
    if (!this.preferences.userProfile) {
      this.preferences.userProfile = {} as UserProfileContext
    }

    // 提取健康目标
    const goalMappings: Array<{ pattern: RegExp; goal: HealthGoal }> = [
      { pattern: /血糖|高血糖|糖尿病/i, goal: 'blood_sugar_control' },
      { pattern: /血压|高血压/i, goal: 'blood_pressure_control' },
      { pattern: /减肥|体重|瘦身/i, goal: 'weight_management' },
      { pattern: /睡眠|失眠|助眠/i, goal: 'sleep_improvement' },
      { pattern: /免疫|增强免疫/i, goal: 'immune_boost' },
      { pattern: /抗氧化|抗衰老/i, goal: 'antioxidant' },
      { pattern: /护肝|肝脏/i, goal: 'liver_protection' },
      { pattern: /消化|肠胃/i, goal: 'digestive_health' },
      { pattern: /疲劳|精力/i, goal: 'anti_fatigue' },
    ]

    const detectedGoals: HealthGoal[] = []
    for (const { pattern, goal } of goalMappings) {
      if (pattern.test(content)) {
        detectedGoals.push(goal)
      }
    }
    if (detectedGoals.length > 0) {
      this.preferences.userProfile.healthGoals = [...new Set([...(this.preferences.userProfile.healthGoals ?? []), ...detectedGoals])]
    }

    // 提取过敏相关信息
    const allergenMappings: Array<{ pattern: RegExp; allergen: AllergenType }> = [
      { pattern: /菊科|苦瓜|桑叶过敏/i, allergen: 'mugwort' },
      { pattern: /花生过敏/i, allergen: 'peanuts' },
      { pattern: /海鲜|虾蟹/i, allergen: 'shellfish' },
      { pattern: /乳糖|牛奶/i, allergen: 'dairy' },
    ]

    const detectedAllergens: AllergenType[] = []
    for (const { pattern, allergen } of allergenMappings) {
      if (pattern.test(content)) {
        detectedAllergens.push(allergen)
      }
    }
    if (detectedAllergens.length > 0) {
      this.preferences.userProfile.allergens = [...new Set([...(this.preferences.userProfile.allergens ?? []), ...detectedAllergens])]
    }

    // 记录最近偏好摘要
    this.preferences.userProfile.recentPreferences = {
      targetedCondition: detectedGoals[0] ?? 'other',
      preferredIngredients: [],
      avoidedIngredients: detectedAllergens,
      dosagePreference: 'standard',
      extractedAt: Date.now(),
    }

    this.savePreferences()
    logger.info('[UserPreferencesService] 从对话内容提取并保存偏好:', {
      goals: detectedGoals,
      allergens: detectedAllergens,
    })
  }

  /**
   * 生成用于AI请求的偏好摘要文本
   */
  generatePromptSummary(): string {
    const profile = this.preferences?.userProfile
    if (!profile) return ''

    const parts: string[] = []

    if (profile.healthGoals && profile.healthGoals.length > 0) {
      const goalLabels: Record<HealthGoal, string> = {
        blood_sugar_control: '高血糖/血糖管理',
        blood_pressure_control: '高血压/血压管理',
        weight_management: '体重管理',
        sleep_improvement: '改善睡眠',
        immune_boost: '增强免疫',
        antioxidant: '抗氧化/抗衰老',
        liver_protection: '肝脏养护',
        digestive_health: '消化健康',
        anti_fatigue: '抗疲劳/提升精力',
        other: '其他健康目标',
      }
      parts.push(`健康目标: ${profile.healthGoals.map(g => goalLabels[g]).join('、')}`)
    }

    if (profile.allergens && profile.allergens.length > 0) {
      const allergenLabels: Record<AllergenType, string> = {
        peanuts: '花生',
        shellfish: '海鲜/甲壳类',
        dairy: '乳制品',
        gluten: '麸质',
        soy: '大豆',
        eggs: '鸡蛋',
        tree_nuts: '坚果',
        sesame: '芝麻',
        mugwort: '菊科植物（苦瓜、桑叶等）',
        other: '其他',
      }
      parts.push(`过敏禁忌: ${profile.allergens.map(a => allergenLabels[a]).join('、')}`)
    }

    if (profile.dietRestrictions && profile.dietRestrictions.length > 0) {
      const restrictionLabels: Record<DietRestriction, string> = {
        vegetarian: '素食',
        vegan: '纯素',
        halal: '清真',
        kosher: '洁食',
        low_sugar: '低糖',
        low_fat: '低脂',
        low_sodium: '低盐',
        no_alcohol: '禁酒',
      }
      parts.push(`饮食限制: ${profile.dietRestrictions.map(r => restrictionLabels[r]).join('、')}`)
    }

    if (profile.constitutionType) {
      parts.push(`体质倾向: ${profile.constitutionType}`)
    }

    if (profile.healthNotes) {
      parts.push(`健康状况备注: ${profile.healthNotes}`)
    }

    return parts.join('；')
  }
}

export const userPreferencesService = new UserPreferencesService()
export default userPreferencesService
