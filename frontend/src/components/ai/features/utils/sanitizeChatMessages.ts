import type { ChatMessage } from '../types'

/**
 * 历史消息一次性清理：过滤 v12 精简前遗留在 localStorage 的"脚手架污染"消息。
 *
 * 背景：早期版本把增强 Prompt（含系统提示词/意图分析/记忆摘要/JSON 输出模板）
 * 直接作为用户可见内容渲染并持久化，另有 React "Invalid hook call" 失败气泡残留。
 * v12 起已改为"发送增强内容、显示原始文本"，但旧数据仍会污染界面。
 */

// 用户/AI 内容中出现即判定为脚手架泄漏
const SCAFFOLD_MARKERS = [
  '[场景识别]',
  '[意图分析]',
  '[记忆摘要]',
  '[多轮对话]',
  '[用户输入]',
  '[近期对话]',
  '【输出格式要求】',
  '[object Object]',
] as const

// error 字段中出现即判定为 React 运行时错误气泡
const RUNTIME_ERROR_MARKERS = [
  'Invalid hook call',
  'Rules of Hooks',
  'Minified React error',
  'react.dev',
] as const

// 完整系统提示词特征：三个标题同时出现才判定，避免误伤正常问答
const SYSTEM_PROMPT_SIGNATURE = ['核心能力', '回复规范', '禁止行为'] as const

function isSystemPromptLeak(text: string): boolean {
  return SYSTEM_PROMPT_SIGNATURE.every((sig) => text.includes(sig))
}

function isPolluted(message: ChatMessage): boolean {
  const content = message.content ?? ''
  const error = message.error ?? ''

  if (SCAFFOLD_MARKERS.some((m) => content.includes(m))) return true
  if (isSystemPromptLeak(content)) return true
  if (error && RUNTIME_ERROR_MARKERS.some((m) => error.includes(m))) return true

  return false
}

export interface SanitizeResult {
  messages: ChatMessage[]
  removedCount: number
}

/**
 * 过滤污染消息，返回清理后的消息数组与移除数量。
 */
export function sanitizeChatMessages(messages: ChatMessage[]): SanitizeResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: messages ?? [], removedCount: 0 }
  }

  const cleaned = messages
  .filter((m) => !isPolluted(m))
  .map(m => ({
    ...m,
    content: m.role === 'assistant' ? stripJsonWrapper(m.content || '') : m.content
  })).map((m) => {
    // 清理旧格式消息内容
    if (m.role === 'assistant' && m.content) {
      const stripped = stripJsonWrapper(m.content)
      if (stripped !== m.content) {
        return { ...m, content: stripped }
      }
    }
    return m
  })
  
  return { messages: cleaned, removedCount: messages.length - cleaned.length }
}


// 过滤污染消息，返回清理后的消息数组与移除数量。

/**
 * 清理消息内容：检测并剥离 ```json ... ``` 包装（旧格式遗留）
 * 将原始 JSON 字符串中的结构化内容提取出来，便于前端正确渲染
 */
function stripJsonWrapper(content: string): string {
  if (!content) return content
  const trimmed = content.trim()
  // 如果内容以 ```json 开头且以 ``` 结尾，提取内部 JSON
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?\s*```$/)
  if (match) {
    return match[1].trim()
  }
  return content
}

/**
 * 检测消息是否为旧版 thinking_engine 输出的原始 Markdown（非结构化）
 * 这类消息会被渲染为普通文本，不会显示结构化 block
 */
function isOldFormatMessage(msg: ChatMessage): boolean {
  if (msg.role !== 'assistant') return false
  const content = msg.content ?? ''
  // 旧格式特征：包含 thinking_engine 输出标记或纯 Markdown 无 JSON 包装
  const hasThinkingMarkers = /\[思考步骤\]|\[Step \d+\]/.test(content)
  const hasRawMarkdown = content.startsWith('#') && !content.includes('```json')
  return hasThinkingMarkers || hasRawMarkdown
}

