/**
 * 剂量解析与克归一化（P2-10）
 *
 * 背景：结构化输出中 dosage 为字符串且无单位约束，历史 parseDosage 仅用正则
 * 提取数字、不处理单位，导致 "500mg" 被当作 500g、"1kg" 被当作 1g。
 *
 * 本工具统一剂量单位并归一化为克（g）：
 * - g / 克 / 克重        → 直接保留
 * - mg / 毫克            → ÷1000
 * - kg                   → ×1000
 * - ml / 毫升            → 液体按密度≈1g/ml 折算为克（配方展示/校验用途）
 * - 斤 / 两              → 市制单位换算（1斤=500g，1两=50g）
 * - 无单位数字           → 默认按克处理（与后端一致）
 * - 区间（"10-15g"）      → 取上限，与历史行为一致
 *
 * 单位无法识别或数值非法时返回 null，由调用方降级（不阻断保存流程）。
 */

/** 单位 → 克换算系数 */
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  克: 1,
  克重: 1,
  mg: 0.001,
  毫克: 0.001,
  kg: 1000,
  ml: 1,
  毫升: 1,
  斤: 500,
  两: 50,
}

/** 合法单位的正则（按最长优先匹配中文单位） */
const UNIT_PATTERN = /(克重|毫克|毫升|克|mg|kg|ml|斤|两|g)/

/**
 * 解析剂量字符串并归一化为克（g）。
 *
 * @param raw 原始剂量字符串（如 "10g" / "500mg" / "1kg" / "10-15克" / "约15克" / "10ml" / "10"）
 * @returns 归一化克数；无法识别单位/数值非法/空输入时返回 null
 */
export function parseDosageToGrams(raw: string | null | undefined): number | null {
  if (!raw) return null
  // 去掉常见口头修饰词与空白，便于统一解析
  const text = String(raw).trim().toLowerCase().replace(/[约左右上下大概\s]/g, '')
  if (!text) return null

  // 区间（"10-15g" / "10~15克" / "10至15克"）：取上限值及其单位
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)(克重|毫克|毫升|克|mg|kg|ml|斤|两|g)?/)
  let numStr: string | undefined
  let unit = ''
  if (rangeMatch) {
    numStr = rangeMatch[2]
    unit = rangeMatch[3] || ''
  } else {
    // 非区间形式：数值必须出现在开头（修饰词已在上方剥离），排除 "-5g"、"十克" 等
    if (!/^\d/.test(text)) return null
    const simpleMatch = text.match(/(\d+(?:\.\d+)?)(克重|毫克|毫升|克|mg|kg|ml|斤|两|g)?/)
    if (!simpleMatch) return null
    numStr = simpleMatch[1]
    unit = simpleMatch[2] || ''
  }

  const value = parseFloat(numStr)
  if (!Number.isFinite(value) || value < 0) return null

  // 数值+单位之后若还残留未知文本（如 "10oz"、"10克每天"），判定为非法单位
  const numEnd = text.indexOf(numStr) + numStr.length
  const after = text.slice(numEnd)
  const remainder = after.replace(UNIT_PATTERN, '').trim()
  if (remainder.length > 0) return null

  const factor = UNIT_TO_GRAMS[unit]
  // 无单位 → 默认按克
  if (factor === undefined) return value
  return value * factor
}

/**
 * 克归一化的非空版本：非法/空输入时返回 0。
 * 供历史调用方（保存链路 dosage_g、展示用量等）直接替换，保持签名兼容。
 */
export function parseDosageToGramsOrZero(raw: string | null | undefined): number {
  return parseDosageToGrams(raw) ?? 0
}