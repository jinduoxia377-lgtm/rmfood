import type { PersonalConstraints } from '../components/ConstraintPanel'

/**
 * P0 可信呈现·原则3「个性化必须真实」：把 ConstraintPanel 的个人约束
 * （过敏原/禁忌/体质/饮食/用药/烹饪）展开为后端 /ai/generate 接受的单层
 * snake_case constraints。空值/空数组不发送，避免用空值覆盖后端默认或伪装个性化。
 *
 * 供功效模式（GenerateTab）与聊天模式（GenerationInputPro.handleChatSend）
 * 共用，保证两条路径发给后端的约束语义完全一致。
 */
export function personalConstraintsToApi(
  c: PersonalConstraints | undefined | null,
): Record<string, unknown> {
  if (!c) return {}
  const out: Record<string, unknown> = {}
  if (c.ageGroup) out.age_group = c.ageGroup
  if (c.gender) out.gender = c.gender
  if (typeof c.weight === 'number' && c.weight > 0) out.weight = c.weight
  if (typeof c.height === 'number' && c.height > 0) out.height = c.height
  if (c.allergies?.length) out.allergies = c.allergies
  if (c.contraindications?.length) out.contraindications = c.contraindications
  if (c.dietaryRestrictions?.length) out.dietary_restrictions = c.dietaryRestrictions
  if (c.conditions?.length) out.conditions = c.conditions
  if (c.currentMedications?.length) out.current_medications = c.currentMedications
  if (c.cookingMethod) out.cooking_method = c.cookingMethod
  if (typeof c.cookingTime === 'number' && c.cookingTime > 0) out.cooking_time = c.cookingTime
  if (c.preferredFormat) out.preferred_format = c.preferredFormat
  return out
}
