import type {
  Precaution,
  PrecautionSeverity,
  TriggerCondition,
  Ingredient,
} from '@/types/ai.types'
import { PRECAUTIONS_DATA } from '@/config/precautions.constants'

export interface EvaluationContext {
  ingredients: Ingredient[]
  formulaType?: string
  userGroups?: string[]
  totalDosage?: number
  hasAllergens?: boolean
}

export interface MatchedCondition {
  condition: TriggerCondition
  matched: boolean
  reason?: string
}

export interface EvaluatedPrecaution extends Precaution {
  matchedConditions: MatchedCondition[]
  ingredientNames: string[]
  evaluatedAt: Date
}

const SEVERITY_ORDER: Record<PrecautionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function loadPresetPrecautions(): Precaution[] {
  return PRECAUTIONS_DATA.filter((p) => {
    const isActive = (p as unknown as Record<string, unknown>).isActive !== false
    return isActive
  }).sort((a, b) => {
    const priorityA = Number((a as unknown as Record<string, unknown>).priority ?? 0) ?? 0
    const priorityB = Number((b as unknown as Record<string, unknown>).priority ?? 0) ?? 0
    return priorityB - priorityA
  })
}

function evaluateSingleCondition(
  condition: TriggerCondition,
  context: EvaluationContext,
): boolean {
  const { type, value } = condition

  switch (type) {
    case 'condition':
      if (typeof value === 'string') {
        const conditionValue = value.toLowerCase()
        if (context.userGroups) {
          return context.userGroups.some((group) =>
            group.toLowerCase().includes(conditionValue) ||
            conditionValue.includes(group.toLowerCase()),
          )
        }
        return context.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(conditionValue),
        )
      }
      return false

    case 'age_range':
      if (typeof value === 'object' && value !== null) {
        // Age range conditions would need user age data
        // For now, we'll match based on user groups containing age-related info
        if (context.userGroups) {
          const hasAgeInfo = context.userGroups.some((group) =>
            group.includes('儿童') || group.includes('老年') ||
            group.includes('未成年') || group.includes('成人'),
          )
          if (value.max !== undefined && value.max <= 18) {
            return context.userGroups.some((g) =>
              g.includes('儿童') || g.includes('未成年'),
            )
          }
          if (value.min !== undefined && value.min >= 65) {
            return context.userGroups.some((g) =>
              g.includes('老年') || g.includes('老人'),
            )
          }
          return hasAgeInfo
        }
      }
      return false

    case 'dosage_exceed':
      if (typeof value === 'number' && context.totalDosage !== undefined) {
        return context.totalDosage > value
      }
      // Also check individual ingredient dosages
      return context.ingredients.some((ing) => {
        if (typeof value === 'number') {
          return ing.amount > value
        }
        return false
      })

    case 'combination':
      if (typeof value === 'string') {
        const comboValue = value.toLowerCase()
        // Check if any ingredient name suggests this combination
        return context.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(comboValue) ||
          ing.efficacyTags?.some((tag) =>
            tag.toLowerCase().includes(comboValue),
          ),
        )
      }
      return false

    case 'duration':
      // Duration-based conditions would need usage history data
      // For now, return false as we don't have duration data in context
      return false

    default:
      return false
  }
}

function evaluateTriggerConditions(
  precautions: Precaution[],
  context: EvaluationContext,
): EvaluatedPrecaution[] {
  const evaluated: EvaluatedPrecaution[] = []

  for (const precaution of precautions) {
    const conditions = precaution.triggerConditions ?? []

    if (conditions.length === 0) {
      // No trigger conditions means always applicable (general precautions)
      evaluated.push({
        ...precaution,
        matchedConditions: [],
        ingredientNames: context.ingredients.map((ing) => ing.name),
        evaluatedAt: new Date(),
      })
      continue
    }

    const matchedConditions: MatchedCondition[] = []
    let allMatched = true
    let anyMatched = false

    for (const condition of conditions) {
      const isMatched = evaluateSingleCondition(condition, context)
      matchedConditions.push({
        condition,
        matched: isMatched,
        reason: isMatched ? `条件满足: ${condition.description}` : undefined,
      })

      if (isMatched) {
        anyMatched = true
      } else {
        allMatched = false
      }
    }

    // Default to OR logic unless specified otherwise
    const logic = (precaution as unknown as Record<string, unknown>).logic as string || 'OR'
    const shouldInclude = logic === 'AND' ? allMatched : anyMatched

    if (shouldInclude) {
      evaluated.push({
        ...precaution,
        matchedConditions: matchedConditions.filter((mc) => mc.matched),
        ingredientNames: context.ingredients.map((ing) => ing.name),
        evaluatedAt: new Date(),
      })
    }
  }

  return evaluated
}

export function evaluatePrecautions(
  context: EvaluationContext,
): EvaluatedPrecaution[] {
  const presetPrecautions = loadPresetPrecautions()
  const evaluated = evaluateTriggerConditions(presetPrecautions, context)

  // Sort by severity (critical first) then by priority
  evaluated.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (severityDiff !== 0) return severityDiff

    const priorityA = Number((a as unknown as Record<string, unknown>).priority ?? 0) ?? 0
    const priorityB = Number((b as unknown as Record<string, unknown>).priority ?? 0) ?? 0
    return priorityB - priorityA
  })

  return evaluated
}

export function getPrecautionIcon(severity: PrecautionSeverity): string {
  switch (severity) {
    case 'critical':
      return '🚨'
    case 'high':
      return '⚠️'
    case 'medium':
      return 'ℹ️'
    case 'low':
      return '💡'
    default:
      return 'ℹ️'
  }
}

export function getPrecautionColor(severity: PrecautionSeverity): string {
  switch (severity) {
    case 'critical':
      return '#cf1322'
    case 'high':
      return '#f5222d'
    case 'medium':
      return '#1890ff'
    case 'low':
      return '#52c41a'
    default:
      return '#1890ff'
  }
}

export function getPrecautionsForIngredient(
  ingredientName: string,
  allEvaluatedPrecautions: EvaluatedPrecaution[],
): EvaluatedPrecaution[] {
  return allEvaluatedPrecautions.filter((ep) =>
    ep.ingredientNames.some((name) =>
      name === ingredientName ||
      name.includes(ingredientName) ||
      ingredientName.includes(name),
    ),
  )
}
