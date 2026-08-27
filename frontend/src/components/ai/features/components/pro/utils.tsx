/**
 * ChatMessages 工具函数
 *
 * 从原 ChatMessages.tsx 提取的辅助函数和子组件
 */

import React from 'react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { detectStructuredContent } from '../structured/utils'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import MarkdownRenderer from './MarkdownRenderer'

export type MessageType = 'text' | 'link' | 'code' | 'image' | 'file'

/**
 * 自动检测消息内容类型
 */
export function detectMessageType(content: string): MessageType {
	if (!content || !content.trim()) return 'text'
	const trimmed = content.trim()
	if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed) || /\.(png|jpeg|jpg|gif|webp|svg|bmp)(\?|$)/i.test(trimmed)) {
		return 'image'
	}
	if (/^https?:\/\/\S+$/i.test(trimmed)) return 'link'
	const filePattern = /\S+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|csv|txt|md|json|xml|yaml|yml)(\s|$)/i
	if (filePattern.test(trimmed) && !trimmed.includes('```')) return 'file'
	const lines = trimmed.split('\n')
	const isCodeBlock = trimmed.startsWith('```') && trimmed.endsWith('```')
	const isIndentedCode = lines.length >= 3 && lines.every(line => line.trim() === '' || /^\s{2,}/.test(line))
	if (isCodeBlock || isIndentedCode) return 'code'
	return 'text'
}

/**
 * 解析内容中的图表数据分隔符
 */
export function parseChartData(content: string): { textContent: string; chartJson: any } | null {
	const marker = '<!--DATA-->'
	const idx = content.indexOf(marker)
	if (idx === -1) return null
	const textContent = content.substring(0, idx).trim()
	const jsonStr = content.substring(idx + marker.length).trim()
	try {
		return { textContent, chartJson: JSON.parse(jsonStr) }
	} catch {
		return null
	}
}

/**
 * 渲染消息内容
 */
export function renderMessageContent(
	msg: ChatMessage,
	index: number,
	allMessages: ChatMessage[],
	streaming: boolean,
): React.ReactNode {
	if (msg.role === 'assistant') {
		const structured = detectStructuredContent(msg.content)
		if (structured) {
			return <StructuredMessageRenderer content={structured} />
		}
	}
	const type = msg.messageType || detectMessageType(msg.content)
	switch (type) {
		case 'link':
			return <LinkMessageCard url={msg.content.trim()} />
		case 'code':
			return <CodeMessageBlock code={msg.content} />
		case 'image':
			return <ImageMessageCard src={msg.content.trim()} />
		case 'file':
			return <FileMessageCard filename={msg.content.trim()} />
		default:
			return <MarkdownRenderer content={msg.content} />
	}
}

export function LinkMessageCard({ url }: { url: string }) {
	return <div className="chat-link-card">{url}</div>
}
export function CodeMessageBlock({ code }: { code: string }) {
	return <pre><code>{code}</code></pre>
}
export function ImageMessageCard({ src }: { src: string }) {
	return <img src={src} alt="image" className="w-full rounded" />
}
export function FileMessageCard({ filename }: { filename: string }) {
	return <div className="chat-file-card">{filename}</div>
}

export function tryExtractDomain(url: string): string | null {
	try {
		return new URL(url).hostname
	} catch {
		return null
	}
}
export function tryExtractTitle(url: string): string {
	try {
		const segments = new URL(url).pathname.split('/').filter(Boolean)
		return segments[segments.length - 1]?.replace(/\.[^.]+$/, '') || '链接'
	} catch {
		return '链接'
	}
}
export function extractExtension(filename: string): string {
	const match = filename.match(/\.([^.]+)$/)
	return match ? match[1].toUpperCase() : 'FILE'
}
