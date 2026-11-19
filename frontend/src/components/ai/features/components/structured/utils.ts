/**
 * Structured Content Block Renderer — 工具函数
 */
import type { StructuredContent, BlockType } from './types'
import { logger } from '@/utils/safeLogger'

/**
 * 尝试补全截断/残缺的 JSON（后端流式输出可能被截断，或 LLM 直接产出缺括号的畸形 JSON）。
 *
 * 背景：旧实现在补全时先追加闭合大括号/方括号、最后才补未闭合字符串引号，
 * 导致当 JSON 在「字符串中间」被截断（如尾部为 `"status`、`"AKT1/NF`）时，
 * 追加的 `}`/`]` 被吞进未闭合的字符串字面量里，修复结果仍是非法 JSON，永远返回 null，
 * 于是前端只能显示「该历史消息为不完整的 JSON 数据」警告 —— 这是用户每次对话
 * 都能看到该提示的根因（证据：chat_messages 中 role='assistant' 且 content LIKE
 * '```json%' 的最近 25 条里有 7 条未闭合，如 id=963 尾缀 `"status`）。
 *
 * 修复策略（按优先级）：
 *   1) 已可解析 → 直接返回。
 *   2) 端部修复：先闭合未闭合字符串 `"`（若是未闭合 key 则补 `: null`；
 *      若截断在冒号后则补 ` null`），再去尾逗号，最后逆序闭合未配对括号。
 *   3) 端部修复 + 自动补插缺失括号（LLM 偶发在数组/对象闭合处漏掉 `]`/`}`）。
 *   4) 最长有效前缀（从后向前枚举 `}` 位置，找到可解析且含 blocks 的最长前缀）。
 * 全部失败返回 null，由调用方降级为 Markdown 渲染（不再显示「不完整 JSON」警告）。
 *
 * 成功返回补全后的 JSON 字符串；失败返回 null。
 */
export function repairTruncatedJson(content: string): string | null {
  return repairTruncatedJsonDetailed(content).repaired
}

/**
 * repairTruncatedJsonDetailed — repairTruncatedJson 的「带截断信号」版本。
 *
 * 背景：repairTruncatedJson 只回答「能否补全」，无法区分两种情况：
 *   - 「本来完整」：内容首查即可 JSON.parse，无需任何补全；
 *   - 「被截断/残缺后补全」：首查失败，靠闭括号/闭引号/补前缀才修复成功。
 * 后端续写修复上线后多数配方卡是完整的，若对「本来完整」的内容也弹
 * replyInterrupted 警告，会造成误报、误导用户去点「重新生成」。
 *
 * 返回 { repaired, wasTruncated }：
 *   - repaired: 与 repairTruncatedJson 完全一致的补全结果（null 表示无法修复）；
 *   - wasTruncated: true 仅当「首查解析失败、确实做了补全」时成立。
 *
 * 向后兼容：repairTruncatedJson 保持原签名/返回值不变，内部改为委托本函数，
 * 因此既有调用方与测试（repairTruncatedJson.test.ts / formulaStructuredFallback.test.ts）
 * 行为完全不变。
 */
export function repairTruncatedJsonDetailed(content: string): { repaired: string | null; wasTruncated: boolean } {
  if (!content) return { repaired: null, wasTruncated: false }
  // 提取首个 JSON 主体（以 { 或 [ 开头，跳过 ```json 开标签）
  const start = content.search(/\{|\[/)
  if (start < 0) return { repaired: null, wasTruncated: false }
  const jsonText = content.slice(start)

  // 1) 已可解析 →「本来完整」，未发生截断
  try {
    JSON.parse(jsonText)
    return { repaired: jsonText, wasTruncated: false }
  } catch {
    // 截断或残缺 → 尝试修复
  }

  // 2) 端部修复（正确顺序：先闭字符串，再补 key 值/尾逗号，最后逆序闭括号）
  const endRepaired = endRepairJson(jsonText, false)
  if (endRepaired) return { repaired: endRepaired, wasTruncated: true }

  // 3) 端部修复 + 自动补插缺失括号（LLM 漏闭合 `]`/`}`）
  const autoRepaired = endRepairJson(jsonText, true)
  if (autoRepaired) return { repaired: autoRepaired, wasTruncated: true }

  // 4) 最长有效前缀（内部缺陷：截断到最后一个完整可解析的 blocks 前缀）
  const longestPrefix = longestValidPrefix(jsonText)
  if (longestPrefix) return { repaired: longestPrefix, wasTruncated: true }

  return { repaired: null, wasTruncated: false }
}

/** 判断当前打开的字符串是否处于「对象的 key 位置」（key 紧跟 `{` 或 `,`，且栈顶为 `{`）。 */
function isKeyPosition(prev: string | null, stack: string[]): boolean {
  return (prev === null || prev === '{' || prev === ',') && stack.length > 0 && stack[stack.length - 1] === '{'
}

/**
 * 端部修复：用状态机扫描，结束时按正确顺序补全。
 * autoInsert=true 时，遇到不匹配的闭合括号会先补插缺失括号（封顶 10 次），
 * 并在「对象闭合后紧跟 , 但外层对象未闭合」处补 `}`，
 * 用于修复 LLM 漏闭合 `]`/`}` 的内部缺陷（证据 id=899/923）。
 */
function endRepairJson(body: string, autoInsert: boolean): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false
  let lastNonspace: string | null = null
  let openQuotePrev: string | null = null
  let stringIsKey = false
  let lastClosedKey = false
  let auto = 0
  const out: string[] = []

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inString) {
      if (escaped) { escaped = false; out.push(ch); continue }
      if (ch === '\\') { escaped = true; out.push(ch); continue }
      if (ch === '"') { inString = false; lastClosedKey = isKeyPosition(openQuotePrev, stack); out.push(ch); continue }
      // P0-4（本任务）：截断常发生在字符串值中途，末尾可能残留原始换行符；
      // JSON 字符串字面量不允许未转义的换行。将其转义为 \\n / \\r，
      // 避免补全闭合引号后因 Bad control character 解析失败（证据 id=811）。
      if (ch === '\n') { out.push('\\n'); continue }
      if (ch === '\r') { out.push('\\r'); continue }
      out.push(ch)
      continue
    }
    if (ch === '"') {
      inString = true
      openQuotePrev = lastNonspace
      stringIsKey = isKeyPosition(openQuotePrev, stack)
      out.push(ch)
      continue
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch)
      out.push(ch)
      lastNonspace = ch
      continue
    }
    if (ch === '}' || ch === ']') {
      const openCh = ch === '}' ? '{' : '['
      if (stack.length > 0 && stack[stack.length - 1] === openCh) {
        stack.pop()
        out.push(ch)
        lastNonspace = ch
      } else if (autoInsert && auto < 10 && stack.length > 0) {
        // 自动补插缺失括号：先闭合栈顶（数组→`]`，对象→`}`），再消费当前字符
        const miss = stack[stack.length - 1] === '[' ? ']' : '}'
        out.push(miss)
        stack.pop()
        auto++
        if (stack.length > 0 && stack[stack.length - 1] === openCh) {
          stack.pop()
          out.push(ch)
          lastNonspace = ch
        } else if (stack.length > 0) {
          const miss2 = stack[stack.length - 1] === '[' ? ']' : '}'
          out.push(miss2)
          stack.pop()
          auto++
          if (stack.length > 0 && stack[stack.length - 1] === openCh) {
            stack.pop()
            out.push(ch)
            lastNonspace = ch
          } else {
            out.push(ch)
            lastNonspace = ch
          }
        } else {
          out.push(ch)
          lastNonspace = ch
        }
      } else {
        // 括号不匹配且无法自动修复 → 放弃
        return null
      }
      continue
    }
    // P0-4（本任务）：LLM 偶发在「对象闭合后紧跟 , 但外层对象未闭合」处漏掉 `}`，
    // 典型如 `...]}]},`（edges 数组闭合后本应再补 `}` 却直接逗号进入下一 block）。
    // 此时栈顶是 `{` 且刚闭合的是 `}`，自动补插缺失的 `}`（证据 id=923）。
    if (
      autoInsert &&
      auto < 10 &&
      ch === ',' &&
      stack.length > 0 &&
      stack[stack.length - 1] === '{' &&
      lastNonspace === '}'
    ) {
      out.push('}')
      stack.pop()
      auto++
    }
    out.push(ch)
    if (!/\s/.test(ch)) lastNonspace = ch
  }

  let repaired = out.join('')
  // ① 闭合未闭合字符串（若为未闭合 key 则补 `: null`；截断在冒号后补 ` null`）
  if (inString) {
    if (escaped) repaired = repaired.slice(0, -1) // 剥离孤立反斜杠，避免转义吞掉闭合引号
    repaired += '"'
    if (stringIsKey) repaired += ': null'
  } else if (lastNonspace === ':') {
    repaired += ' null'
  } else if (lastNonspace === '"' && lastClosedKey) {
    repaired += ': null'
  }
  // ② 去除尾部逗号/空白
  repaired = repaired.replace(/[\s,]+$/, '')
  // ③ 逆序闭合未配对括号
  repaired += stack.slice().reverse().map(o => (o === '{' ? '}' : ']')).join('')

  try {
    JSON.parse(repaired)
    return repaired
  } catch {
    return null
  }
}

/**
 * 最长有效前缀：从后向前枚举 `}` 位置（封顶 300 个候选），
 * 找到第一个可解析且含非空 blocks 的前缀。用于内部结构性缺陷
 * （如 LLM 在数组/对象闭合处漏掉 `]`/`}`，导致整体无法解析）。
 */
function longestValidPrefix(body: string, cap = 300): string | null {
  const positions: number[] = []
  for (let i = body.length - 1; i >= 0 && positions.length < cap; i--) {
    if (body[i] === '}') positions.push(i)
  }
  for (const i of positions) {
    const prefix = body.slice(0, i + 1)
    try {
      const parsed = JSON.parse(prefix)
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { blocks?: unknown[] }).blocks) && (parsed as { blocks: unknown[] }).blocks.length > 0) {
        return prefix
      }
    } catch {
      // 尝试更短前缀
    }
  }
  return null
}

/**
 * recoverBlocksFromBrokenJson — 从「整体无法解析的畸形 JSON」中逐块恢复配方卡。
 *
 * P0-4（本任务）：LLM 偶发在 JSON 内部漏闭括号（如 callout.details 数组少一个 `}`），
 * 导致 repairTruncatedJson 也无法整体修复（证据 id=875）。此时不再降级为纯文本，
 * 而是：
 *   1. 定位正文中每个 `"type":` 前的 `{` 起点；
 *   2. 用括号匹配器找出每个 block 的完整闭合区间；
 *   3. 逐个 JSON.parse，把可解析且含合法 type/data 的 block 收集起来；
 *   4. 重新组装 { responseType, title, blocks } 结构化配方卡。
 *
 * 这样即使个别 block 畸形（被丢弃），其余完整 block 仍能渲染为配方卡，
 * 用户看到的是「配方卡（部分区块缺失）」而非「纯文本 + 误导提示」。
 *
 * @param content 消息原始内容（可能以 ```json 开头）
 * @returns 重组后的结构化配方卡；无可解析 block 时返回 null。
 */
export function recoverBlocksFromBrokenJson(content: string): StructuredContent | null {
  if (!content) return null
  const start = content.search(/\{|\[/)
  if (start < 0) return null
  const jsonText = content.slice(start)

  // 快速路径：整体已可解析 → 直接交给常规解析
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (parsed && Array.isArray(parsed.blocks) && (parsed.blocks as unknown[]).length > 0) {
      return parsed as unknown as StructuredContent
    }
  } catch {
    // 走块级恢复
  }

  // 定位所有 `"type":` 前的 `{` 起点
  const blockStarts: number[] = []
  const typeRe = /"type"\s*:/g
  let m: RegExpExecArray | null
  while ((m = typeRe.exec(jsonText)) !== null) {
    let brace = m.index
    while (brace >= 0 && jsonText[brace] !== '{') brace--
    if (brace >= 0 && !blockStarts.includes(brace)) blockStarts.push(brace)
  }
  blockStarts.sort((a, b) => a - b)

  const validTypes = new Set<BlockType>([
    'header', 'data-table', 'chart', 'list',
    'callout', 'metrics', 'divider',
    'ingredient-detail', 'synergy-chart', 'timeline',
  ])
  const blocks: Array<Record<string, unknown>> = []
  for (const blockStart of blockStarts) {
    const blockEnd = findJsonBlockEnd(jsonText, blockStart)
    if (blockEnd < 0) continue
    const blockStr = jsonText.slice(blockStart, blockEnd + 1)
    try {
      const b = JSON.parse(blockStr) as Record<string, unknown>
      if (
        b && typeof b === 'object' &&
        typeof b.type === 'string' &&
        validTypes.has(b.type as BlockType) &&
        b.data && typeof b.data === 'object'
      ) {
        blocks.push(b)
      }
    } catch {
      // 该 block 畸形，丢弃
    }
  }
  if (blocks.length === 0) return null

  // 提取 title（在整体文本中找第一个 "title" 字符串值）
  const titleMatch = jsonText.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  let title: string | undefined
  if (titleMatch) {
    try { title = JSON.parse('"' + titleMatch[1] + '"') as string } catch { title = undefined }
  }

  return {
    responseType: 'recommendation',
    title,
    blocks: blocks as unknown as StructuredContent['blocks'],
  }
}

/** 从给定起点（'{' 或 '['）找到匹配的闭合 `}`/`]` 下标；未闭合返回 -1。 */
function findJsonBlockEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') { depth++; continue }
    if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * degradeJsonToMarkdown — 把「无法修复的残缺 ```json」降级为可读 Markdown。
 *
 * P0-4（本任务）：当 repairTruncatedJson 与 recoverBlocksFromBrokenJson 都无法修复
 * （极端畸形）时，不再让用户看到「不完整的 JSON 数据」空白警告，而是把 ```json
 * 开标签降级为普通 ``` 代码块，交给 MarkdownRenderer 渲染原始文本，保留可读性。
 *
 * 返回降级后的 Markdown 文本；若内容不适合降级（无 ```json 标记）返回 null。
 */
export function degradeJsonToMarkdown(content: string): string | null {
  if (!content || !content.includes('```json')) return null
  // 仅替换第一个 ```json 开标签（该消息以配方卡 JSON 开头）
  const firstFence = content.indexOf('```json')
  if (firstFence < 0) return null
  const degraded = content.slice(0, firstFence) + '```' + content.slice(firstFence + '```json'.length)
  return degraded || null
}

/**
 * 规范化 CalloutData：兼容 style（LLM 常用）→ variant（类型定义）字段映射
 */
function normalizeCallout(block: { type: string; data: unknown }): { type: string; data: unknown } {
  const data = (block.data as Record<string, unknown>) || {}
  if (block.type === 'callout') {
    // LLM 可能输出 style 而非 variant
    if (data.style && !data.variant) {
      data.variant = data.style as string
    }
    // 确保 style 字段也保留（渲染层读取）
    if (data.variant && !data.style) {
      data.style = data.variant as string
    }
    return { ...block, data }
  }
  return block
}

/**
 * 规范化 ListItem：兼容平铺字符串数组 → 结构化 ListItem 对象
 */
function normalizeList(block: { type: string; data: unknown }): { type: string; data: unknown } {
  const data = (block.data as Record<string, unknown>) || {}
  if (block.type === 'list') {
    // LLM 可能直接输出字符串数组而非 ListItem[]
    if (Array.isArray(data.items) && data.items.length > 0 && typeof data.items[0] === 'string') {
      data.items = (data.items as string[]).map(text => ({ label: text }))
    }
    // 若无 variant，根据内容推断
    if (!data.variant) {
      const items = data.items as Array<{ label?: string; description?: string } | string>
      const hasDescriptions = items.some(item => {
        if (typeof item === 'string') return false
        return !!item.description
      })
      data.variant = hasDescriptions ? 'analysis' : 'bullet'
    }
    return { ...block, data }
  }
  return block
}

/**
 * 检测消息内容是否为结构化JSON
 *
 * 支持两种格式：
 * 1. 纯JSON：以 { 开头的内容
 * 2. Markdown代码块中的JSON：```json ... ```
 *
 * 在解析后对 block 数据做归一化处理，兼容 LLM 常见变体。
 *
 * @param content 消息内容字符串
 * @returns 解析成功返回 StructuredContent, 失败返回 null
 */
export function detectStructuredContent(content: string): StructuredContent | null {
  if (!content) {
    logger.warn('[detectStructured] empty content')
    return null
  }
  const trimmed = content.trim()
  logger.debug(`[detectStructured] content length=${trimmed.length}, starts="${trimmed[0]}", ends="${trimmed[trimmed.length - 1]}"`)

  // 快速短路 — 纯文本消息不尝试解析
  if (trimmed.length < 10) {
    logger.debug('[detectStructured] too short (<10), returning null')
    return null
  }

  let jsonStr: string | null = null
  let strategy = 'none'

  // ── 策略1: 从 ```json ... ``` 代码块中提取（处理嵌套大括号）──
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim()
    const lastBrace = candidate.lastIndexOf('}')
    if (lastBrace >= 0 && candidate.startsWith('{') && candidate[lastBrace] === '}') {
      jsonStr = candidate.slice(0, lastBrace + 1)
      strategy = 'code-block'
    }
  }

  // ── 策略2: 内容以 { 开头 → 找最后一个匹配的 } ──
  if (!jsonStr && trimmed[0] === '{') {
    const lastBrace = trimmed.lastIndexOf('}')
    if (lastBrace > 0) {
      jsonStr = trimmed.slice(0, lastBrace + 1)
      strategy = 'starts-brace'
    }
  }

  // ── 策略3: 全文就是一段JSON（无代码块包裹）──
  if (!jsonStr && trimmed.startsWith('{') && trimmed.endsWith('}')) {
    jsonStr = trimmed
    strategy = 'full-text'
  }

  // ── 策略4: 扫描内容中第一个 { 到最后一个 } 的区间 ──
  if (!jsonStr) {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = trimmed.slice(firstBrace, lastBrace + 1)
      strategy = 'scan-braces'
    }
  }

  logger.debug(`[detectStructured] strategy=${strategy}, jsonStr.length=${jsonStr ? jsonStr.length : 0}`)

  if (!jsonStr) {
    logger.debug('[detectStructured] no JSON found, returning null')
    return null
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    logger.debug(`[detectStructured] JSON parse OK, keys=${Object.keys(parsed).join(',')}, blocks=${Array.isArray(parsed.blocks) ? parsed.blocks.length : 0}`)

    // 验证核心结构
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.blocks)) return null

    // 验证每个 block 都有 type 字段
    const validTypes = new Set<BlockType>([
      'header', 'data-table', 'chart', 'list',
      'callout', 'metrics', 'divider',
      'ingredient-detail', 'synergy-chart', 'timeline',
    ])

    for (const block of parsed.blocks) {
      if (!block || typeof block !== 'object') return null
      if (!block.type || typeof block.type !== 'string') return null
      if (!validTypes.has(block.type as BlockType)) return null
    }

    // ── 归一化：兼容 LLM 常见字段变体 ──
    const normalizedBlocks = parsed.blocks.map((block: { type: string; data: unknown }) => {
      const n = normalizeCallout(block)
      return normalizeList(n)
    })

    // 兼容 LLM 未输出 responseType 的情况，自动补全默认值
    const structured: StructuredContent = {
      responseType: (parsed.responseType as StructuredContent['responseType']) ?? 'general',
      title: (parsed.title as string) || undefined,
      blocks: normalizedBlocks as unknown as StructuredContent['blocks'],
    }
    return structured
  } catch {
    // JSON 解析失败 → 不是结构化内容
    return null
  }
}

/**
 * 兜底提取结构化 JSON（当 detectStructuredContent 因格式差异返回 null 时使用）。
 *
 * 与 detectStructuredContent 的区别：
 * - 不要求 JSON 位于内容最开头（允许前后有少量说明文字）；
 * - 对 block type 做「白名单过滤」而非「整体拒绝」——未知类型块被丢弃，
 *   只要剩余合法块非空就返回结构化内容，避免在对话中裸显示 JSON。
 */
export function extractStructuredFallback(content: string): StructuredContent | null {
  if (!content) return null
  const trimmed = content.trim()
  if (trimmed.length < 10) return null

  let jsonStr: string | null = null
  // 1) ```json 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim()
    const lastBrace = candidate.lastIndexOf('}')
    if (lastBrace >= 0 && candidate.startsWith('{')) {
      jsonStr = candidate.slice(0, lastBrace + 1)
    }
  }
  // 2) 扫描第一个 { 到最后一个 }
  if (!jsonStr) {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = trimmed.slice(firstBrace, lastBrace + 1)
    }
  }
  if (!jsonStr) return null

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    // 情况 A：标准 blocks 协议
    if (Array.isArray(parsed.blocks)) {
      const validTypes = new Set<BlockType>([
        'header', 'data-table', 'chart', 'list',
        'callout', 'metrics', 'divider',
        'ingredient-detail', 'synergy-chart', 'timeline',
      ])
      const blocks = (parsed.blocks as Array<Record<string, unknown>>).filter(
        (b): b is Record<string, unknown> & { type: BlockType; data: unknown } =>
          !!b && typeof b === 'object' && typeof b.type === 'string' && validTypes.has(b.type as BlockType),
      )
      if (blocks.length === 0) return null

      const normalizedBlocks = blocks.map((block) => {
        const n = normalizeCallout(block as { type: string; data: unknown })
        return normalizeList(n)
      })

      return {
        responseType: (parsed.responseType as StructuredContent['responseType']) ?? 'recommendation',
        title: (parsed.title as string) || undefined,
        blocks: normalizedBlocks as unknown as StructuredContent['blocks'],
      }
    }

    // 情况 B：LLM 输出旧格式配方 JSON（配方名称/配方组分/成分列表…）→ 转换为专业配方卡 blocks
    const legacyBlocks = convertLegacyFormulaBlocks(parsed)
    if (legacyBlocks) {
      return {
        responseType: 'recommendation',
        title: (parsed['配方名称'] || parsed['product_name'] || parsed['name']) as string | undefined,
        blocks: legacyBlocks,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * 将 LLM 偶尔输出的「旧格式配方 JSON」转换为专业配方设计卡 blocks。
 * 兼容中文键（配方名称/配方组分…）与英文键（product_name/ingredients…）两种变体，
 * 避免前端裸显示 JSON。
 */
function convertLegacyFormulaBlocks(parsed: Record<string, unknown>): Array<{ type: BlockType; data: unknown }> | null {
  // 中文键 + 英文键（LLM 常见变体，尽量宽匹配）
  const name = (parsed['配方名称'] || parsed['product_name'] || parsed['name'] || parsed['方案名称']) as string | undefined
  const audience = (parsed['适用人群'] || parsed['target_audience'] || parsed['适合人群']) as string | undefined
  const goals = (parsed['健康目标'] || parsed['target_health_goals']) as Array<string> | undefined
  const efficacy =
    (parsed['核心功效'] || parsed['核心目标'] || parsed['核心原理'] || parsed['formula_rationale'] || parsed['efficacy'] || parsed['description'] || parsed['作用原理']) as string | undefined
  const ingredientsRaw =
    parsed['配方组分'] || parsed['主配方_单人份_500ml水'] || parsed['主配方'] || parsed['配料表'] || parsed['配方成分'] ||
    parsed['成分列表'] || parsed['成分'] || parsed['原料组成'] || parsed['材料'] || parsed['用料表'] || parsed['组分列表'] ||
    parsed['ingredients'] || parsed['components'] || parsed['composition'] || parsed['raw_materials'] || parsed['herbal_components']
  const steps =
    (parsed['制备建议'] || parsed['制备工艺'] || parsed['制备方法'] || parsed['做法'] || parsed['preparation_instructions'] || parsed['preparation'] || parsed['usage']) as string | undefined
  const taboosRaw =
    parsed['安全与禁忌'] || parsed['禁忌排除说明'] || parsed['注意事项与禁忌'] || parsed['注意事项'] || parsed['禁忌'] ||
    parsed['contraindications_and_warnings'] || parsed['contraindications'] || parsed['taboos'] || parsed['warnings']
  const compliance =
    (parsed['合规说明'] || parsed['安全依据'] || parsed['regulatory_compliance'] || parsed['compliance'] || parsed['safety_basis']) as string | undefined
  const specialGroups = (parsed['特殊人群提示'] || parsed['特殊人群']) as string | undefined
  const dailyCheck = (parsed['每日用量上限校验'] || parsed['每日用量'] || parsed['用量限制']) as string | undefined

  if (!name && !ingredientsRaw) return null

  const blocks: Array<{ type: BlockType; data: unknown }> = []
  const meta: Array<{ label: string; value: string }> = []
  if (audience) meta.push({ label: '适用人群', value: audience })
  if (Array.isArray(goals) && goals.length > 0) meta.push({ label: '健康目标', value: goals.join('、') })
  if (name || efficacy || meta.length > 0) {
    blocks.push({
      type: 'header',
      data: {
        title: name || '配方方案',
        description: efficacy || '',
        level: 1,
        metadata: meta,
      },
    })
  }

  // 配方组成：兼容数组（[{原料,用量}]）与字符串（多行文本）两种形态
  const tableRows = parseIngredientRows(ingredientsRaw)
  if (tableRows.length > 0) {
    // 优先展示专业六列（角色/成分/用量/性味归经/功效成分/作用机理），旧格式缺失的字段留空
    const hasProfessionalFields = tableRows.some(r => r.nature_flavor || r.active_compound || r.mechanism)
    blocks.push({
      type: 'data-table',
      data: {
        title: '配方组成',
        columns: hasProfessionalFields
          ? [
              { key: 'role', label: '角色' },
              { key: 'name', label: '成分' },
              { key: 'dosage', label: '用量' },
              { key: 'nature_flavor', label: '性味归经' },
              { key: 'active_compound', label: '功效成分' },
              { key: 'mechanism', label: '作用机理' },
            ]
          : [
              { key: 'role', label: '角色' },
              { key: 'name', label: '成分' },
              { key: 'dosage', label: '用量' },
            ],
        rows: tableRows,
      },
    })
  }
  if (typeof steps === 'string' && steps.trim()) {
    blocks.push({
      type: 'list',
      data: { title: '制备建议', variant: 'number', items: steps.split(/[；;\n]/).map(s => ({ label: s.trim() })).filter(i => i.label) },
    })
  }
  if (Array.isArray(taboosRaw) && taboosRaw.length > 0) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '安全与禁忌', content: taboosRaw.join('；') },
    })
  }
  if (typeof taboosRaw === 'string' && taboosRaw.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '安全与禁忌', content: taboosRaw },
    })
  }
  if (typeof specialGroups === 'string' && specialGroups.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '特殊人群提示', content: specialGroups },
    })
  }
  if (typeof dailyCheck === 'string' && dailyCheck.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'info', title: '每日用量上限校验', content: dailyCheck },
    })
  }
  if (typeof compliance === 'string' && compliance.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'info', title: '合规说明', content: compliance },
    })
  }
  return blocks.length > 0 ? blocks : null
}

/** 解析配方组成：数组（对象）或字符串（多行「原料 用量」）→ data-table rows */
function parseIngredientRows(raw: unknown): Array<Record<string, string>> {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        role: String(item['角色'] || item['role'] || item['君臣佐使'] || ''),
        name: String(item['原料'] || item['成分'] || item['name'] || item['ingredient'] || item['材料'] || ''),
        dosage: String(item['剂量'] || item['用量'] || item['dosage'] || item['amount'] || ''),
        nature_flavor: String(item['性味归经'] || item['nature_flavor'] || item['性味'] || ''),
        active_compound: String(item['功效成分'] || item['active_compound'] || item['活性成分'] || ''),
        mechanism: String(item['作用机理'] || item['mechanism'] || item['机理'] || item['药理'] || ''),
        basis: String(item['依据'] || item['basis'] || item['rationale'] || item['说明'] || ''),
      }))
      .filter(r => r.name)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n;；]/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // 支持「黄芪 10g」「黄芪：10g」「黄芪10g」等形态
        const m = line.match(/^([^：:\s]+)\s*[：:]\s*(.+)$/) || line.match(/^([^\s]+)\s*(.+)$/) || line.match(/^([\u4e00-\u9fa5A-Za-z]+)([\d.]+[gG克毫升mlML]*)$/)
        if (m) {
          return { role: '', name: m[1].trim(), dosage: (m[2] || '').trim(), nature_flavor: '', active_compound: '', mechanism: '', basis: '' }
        }
        return { role: '', name: line, dosage: '', nature_flavor: '', active_compound: '', mechanism: '', basis: '' }
      })
      .filter(r => r.name)
  }
  return []
}

/**
 * 安全获取 block 数据，避免空指针
 */
export function safeBlockData<T>(data: T | undefined | null, fallback: T): T {
  return data ?? fallback
}

/**
 * 格式化数值为百分比字符串
 */
export function formatPercent(value: number, decimals = 0): string {
  return (value * 100).toFixed(decimals) + '%'
}

/**
 * 统一的结构化内容解析入口（多级兜底）。
 *
 * 这是「渲染」与「数据捕获」共用的唯一解析口径 —— 与 MessageBubble.renderMessageContent
 * 的五级 blocks 解析链一致，保证「能渲染成结构化卡的消息」就「能被数据捕获」。
 *
 * 逐级尝试，返回首个非 null 的 StructuredContent：
 *   1. detectStructuredContent       —— 标准 blocks JSON
 *   2. extractStructuredFallback     —— 带前后说明文字 / 旧格式 / 未知 block 白名单过滤
 *   3. repairTruncatedJson + 再解析  —— 流式截断/漏闭括号
 *   4. recoverBlocksFromBrokenJson   —— 整体畸形但可逐块恢复
 *
 * 全部失败返回 null（调用方再走 markdown/文本兜底）。
 *
 * 背景：此前 useChatMessages 的配方捕获只用第 1 级 detectStructuredContent，
 * 而消息渲染用完整五级链，导致「卡片渲染成结构化、面板却空」的不对称缺陷。
 */
export function resolveStructuredContent(content: string): StructuredContent | null {
  if (!content) return null

  // 第 1 级：标准 blocks JSON
  const standard = detectStructuredContent(content)
  if (standard) return standard

  // 第 2 级：带前后杂讯 / 旧格式 / 白名单过滤
  const fallback = extractStructuredFallback(content)
  if (fallback) return fallback

  // 第 3 级：截断/漏括号修复后重解析
  const repairedContent = repairTruncatedJson(content)
  if (repairedContent) {
    const repaired =
      extractStructuredFallback(repairedContent) ?? detectStructuredContent(repairedContent)
    if (repaired) return repaired
  }

  // 第 4 级：整体畸形但可逐块恢复
  const recovered = recoverBlocksFromBrokenJson(content)
  if (recovered) return recovered

  return null
}
