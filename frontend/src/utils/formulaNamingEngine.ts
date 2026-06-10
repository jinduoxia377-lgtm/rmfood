import type { AIRecognizedFormula, RecognizedFormulaIngredient } from '@/types/ai.types'

const MIN_NAME_LENGTH = 4
const MAX_NAME_LENGTH = 20

const EFFICACY_KEYWORDS = [
  '补气', '补血', '健脾', '抗氧化', '安神', '助眠',
  '免疫调节', '抗疲劳', '降血糖', '降血脂', '美容', '减肥',
  '清热', '解毒', '润燥', '滋阴', '温阳', '活血', '化瘀',
  '消炎', '止痛', '止咳', '化痰', '平喘', '利水', '消肿',
  '健胃', '消食', '止泻', '固表', '敛汗', '涩精', '止血',
  '通络', '祛风', '散寒', '清热解毒', '益气养血', '滋补肝肾',
] as const

const GENERIC_INGREDIENTS = new Set([
  '水', '乙醇', '辅料', '溶剂', '填充剂', '载体', '基质',
  '防腐剂', '稳定剂', '色素', '香精', '增稠剂', '乳化剂',
])

let sequentialCounter = 0

export function generateFormulaName(
  formula: AIRecognizedFormula,
  existingNames: string[] = [],
): string {
  if (!formula) {
    return generateSequentialName(existingNames)
  }

  const name = tryOriginalName(formula, existingNames)
    || tryEfficacyBasedNaming(formula, existingNames)
    || tryIngredientBasedNaming(formula, existingNames)
    || generateSequentialName(existingNames)

  return truncateName(name)
}

function tryOriginalName(formula: AIRecognizedFormula, existingNames: string[]): string | null {
  const rawName = formula?.name
  if (!rawName?.trim()) {
    return null
  }
  if (rawName.includes('未命名')) {
    return null
  }
  const sanitized = sanitizeName(rawName.trim())
  if (!sanitized || sanitized.length < MIN_NAME_LENGTH) {
    return null
  }
  if (isNameDuplicate(sanitized, existingNames)) {
    return null
  }
  return sanitized
}

function tryEfficacyBasedNaming(formula: AIRecognizedFormula, existingNames: string[]): string | null {
  const textSources: string[] = []

  if (formula?.content && typeof formula.content === 'string') {
    textSources.push(formula.content)
  }
  if (formula?.metadata?.efficacy && typeof formula.metadata.efficacy === 'string') {
    textSources.push(formula.metadata.efficacy)
  }
  if (formula?.rawData?.description && typeof formula.rawData.description === 'string') {
    textSources.push(formula.rawData.description)
  }
  if (formula?.rawData?.title && typeof formula.rawData.title === 'string') {
    textSources.push(formula.rawData.title)
  }
  if (formula?.efficacy && typeof formula.efficacy === 'string') {
    textSources.push(formula.efficacy)
  }
  if (formula?.targetAudience && Array.isArray(formula.targetAudience)) {
    textSources.push(formula.targetAudience.join(' '))
  }

  const allKeywords: string[] = []
  for (const source of textSources) {
    const keywords = extractEfficacyKeywords(source)
    allKeywords.push(...keywords)
  }

  if (allKeywords.length === 0) {
    return null
  }

  const uniqueKeywords = [...new Set(allKeywords)]
  const efficacyPart = uniqueKeywords.slice(0, 2).join('')
  const candidate = `${efficacyPart}配方`

  if (isNameDuplicate(candidate, existingNames)) {
    return null
  }

  return candidate
}

function tryIngredientBasedNaming(formula: AIRecognizedFormula, existingNames: string[]): string | null {
  const ingredients = formula?.ingredients
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return null
  }

  const coreIngredients = extractCoreIngredients(ingredients, 3)
  if (coreIngredients.length === 0) {
    return null
  }

  const ingredientPart = coreIngredients.join('')
  const candidate = `${ingredientPart}配方`

  if (candidate.length < MIN_NAME_LENGTH || candidate.length > MAX_NAME_LENGTH) {
    return null
  }

  if (isNameDuplicate(candidate, existingNames)) {
    return null
  }

  return candidate
}

function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  let sanitized = name.trim()
  sanitized = sanitized.replace(/[^\u4e00-\u9fa5a-zA-Z0-9γ-ω\-]/g, '')
  sanitized = sanitized.replace(/[\-_]+/g, '')
  sanitized = sanitized.replace(/\s+/g, '')

  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_NAME_LENGTH)
  }

  return sanitized
}

function extractEfficacyKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }

  const foundKeywords: string[] = []

  for (const keyword of EFFICACY_KEYWORDS) {
    if (text.includes(keyword)) {
      foundKeywords.push(keyword)
    }
  }

  return foundKeywords
}

function extractCoreIngredients(ingredients: RecognizedFormulaIngredient[], maxCount = 3): string[] {
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return []
  }

  const coreNames: string[] = []

  for (let i = 0; i < ingredients.length && coreNames.length < maxCount; i++) {
    const ingredient = ingredients[i]
    if (!ingredient || typeof ingredient.name !== 'string') {
      continue
    }

    let name = ingredient.name.trim()
    if (!name) {
      continue
    }

    name = simplifyIngredientName(name)

    if (GENERIC_INGREDIENTS.has(name) || GENERIC_INGREDIENTS.has(name.toLowerCase())) {
      continue
    }

    if (name.length < 2 || name.length > 10) {
      continue
    }

    coreNames.push(name)
  }

  return coreNames
}

function simplifyIngredientName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  let simplified = name.trim()

  simplified = simplified.replace(/\s*\(.*?\)\s*/g, '')
  simplified = simplified.replace(/\s*\[.*?\]\s*/g, '')
  simplified = simplified.replace(/\d+(\.\d+)?%/, '')
  simplified = simplified.replace(/\d+(\.\d+)?\s*(mg|g|kg|ml|L|μl|ul)/gi, '')
  simplified = simplified.replace(/(纯度|纯|含量|浓度|规格|等级|型|剂).*/g, '')
  simplified = simplified.trim()

  return simplified
}

function generateSequentialName(existingNames: string[]): string {
  const maxAttempts = 1000

  for (let i = 0; i < maxAttempts; i++) {
    sequentialCounter++
    const num = String(sequentialCounter).padStart(3, '0')
    const candidate = `配方_${num}`

    if (!isNameDuplicate(candidate, existingNames)) {
      return candidate
    }
  }

  const fallbackNum = Date.now().toString().slice(-6)
  return `配方_${fallbackNum}`
}

function isNameDuplicate(name: string, existingNames: string[]): boolean {
  if (!name || !existingNames || !Array.isArray(existingNames)) {
    return false
  }

  const normalizedName = name.toLowerCase().trim()
  return existingNames.some(
    existing => existing?.toLowerCase().trim() === normalizedName,
  )
}

function truncateName(name: string): string {
  if (!name) {
    return generateSequentialName([])
  }

  if (name.length <= MAX_NAME_LENGTH) {
    return name
  }

  return name.substring(0, MAX_NAME_LENGTH)
}

export function resetSequentialCounter(): void {
  sequentialCounter = 0
}

export { sanitizeName, extractEfficacyKeywords, extractCoreIngredients }
