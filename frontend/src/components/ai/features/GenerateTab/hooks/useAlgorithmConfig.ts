/**
 * useAlgorithmConfig - 算法配置管理 Hook
 * 
 * @description 管理遗传算法参数配置，支持预设场景和自定义参数
 * @version 1.0.0
 */
import { useCallback, useMemo } from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'
import { logger } from '@/utils/safeLogger'

export type AlgorithmStrategy = 'ga' | 'nsga2' | 'hybrid' | 'auto'
export type PresetMode = 'balanced' | 'cost_first' | 'efficacy_first' | 'safety_first' | 'synergy_focused' | null
export type TastePreference = 'balanced' | 'sweet_enhanced' | 'bitter_reduced' | 'custom'

export interface AlgorithmConfig {
  strategy: AlgorithmStrategy
  preset: PresetMode
  populationSize: number
  generations: number
  mutationRate: number
  crossoverRate: number
  eliteRatio: number
  tournamentSize: number
  tastePreference: TastePreference
  customTasteRatios?: Record<string, number>
}

export interface ConstraintConfig {
  ageGroup: 'children' | 'adult' | 'elderly' | 'pregnant'
  gender?: 'male' | 'female'
  weight?: number  // kg
  height?: number  // cm
  allergies: string[]
  contraindications: string[]
  dietaryRestrictions: string[]
  conditions: string[]
  currentMedications: string[]
  cookingMethod: 'decoction' | 'tea' | 'soup' | 'paste' | 'powder'
  cookingTime?: number
}

// 默认配置
const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfig = {
  strategy: 'auto',
  preset: 'balanced',
  populationSize: 50,
  generations: 40,
  mutationRate: 0.15,
  crossoverRate: 0.85,
  eliteRatio: 0.15,
  tournamentSize: 5,
  tastePreference: 'balanced',
}

const DEFAULT_CONSTRAINT_CONFIG: ConstraintConfig = {
  ageGroup: 'adult',
  allergies: [],
  contraindications: [],
  dietaryRestrictions: [],
  conditions: [],
  currentMedications: [],
  cookingMethod: 'decoction',
}

// 预设场景参数映射
const PRESET_PARAMS: Record<string, Partial<AlgorithmConfig>> = {
  balanced: {
    populationSize: 50,
    generations: 40,
    eliteRatio: 0.15,
  },
  cost_first: {
    populationSize: 60,
    generations: 50,
    eliteRatio: 0.2,
  },
  efficacy_first: {
    populationSize: 80,
    generations: 60,
    eliteRatio: 0.1,
  },
  safety_first: {
    populationSize: 60,
    generations: 50,
    eliteRatio: 0.25,
  },
  synergy_focused: {
    populationSize: 70,
    generations: 55,
    eliteRatio: 0.15,
  },
}

export function useAlgorithmConfig() {
  const [config, setConfig] = usePersistentState<AlgorithmConfig>(
    'rmfood:generate:algorithmConfig',
    DEFAULT_ALGORITHM_CONFIG,
  )
  
  const [constraints, setConstraints] = usePersistentState<ConstraintConfig>(
    'rmfood:generate:constraints',
    DEFAULT_CONSTRAINT_CONFIG,
  )

  const applyPreset = useCallback((preset: PresetMode) => {
    if (!preset) return
    
    const presetParams = PRESET_PARAMS[preset]
    if (presetParams) {
      setConfig(prev => ({ ...prev, preset, ...presetParams }))
      logger.info('应用预设场景', { preset })
    }
  }, [setConfig])

  const updateConfig = useCallback((updates: Partial<AlgorithmConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [setConfig])

  const updateConstraints = useCallback((updates: Partial<ConstraintConfig>) => {
    setConstraints(prev => ({ ...prev, ...updates }))
  }, [setConstraints])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_ALGORITHM_CONFIG)
    setConstraints(DEFAULT_CONSTRAINT_CONFIG)
    logger.info('重置算法配置')
  }, [setConfig, setConstraints])

  // 构建 API 请求参数
  const toApiParams = useMemo(() => {
    return {
      // 算法参数
      population_size: config.populationSize,
      generations: config.generations,
      mutation_rate: config.mutationRate,
      crossover_rate: config.crossoverRate,
      elite_ratio: config.eliteRatio,
      tournament_size: config.tournamentSize,
      strategy: config.strategy,
      
      // 约束条件
      constraints: {
        age_group: constraints.ageGroup,
        allergies: constraints.allergies,
        contraindications: constraints.contraindications,
        conditions: constraints.conditions,
        cooking_method: constraints.cookingMethod,
        taste_preference: config.tastePreference,
      },
    }
  }, [config, constraints])

  return {
    config,
    constraints,
    setConfig,
    setConstraints,
    applyPreset,
    updateConfig,
    updateConstraints,
    resetConfig,
    toApiParams,
  }
}

// 导出存储键常量
export const ALGORITHM_STORAGE_KEYS = {
  ALGORITHM_CONFIG: 'rmfood:generate:algorithmConfig',
  ALGORITHM_CONSTRAINTS: 'rmfood:generate:constraints',
} as const
