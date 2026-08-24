/**
 * ChatMessages 工具函数
 *
 * 提取自原 ChatMessages.tsx 的辅助函数和子组件
 */

import React from 'react'
import { Link, ExternalLink, Code, FileText } from 'lucide-react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { detectStructuredContent } from '../structured/utils'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import MarkdownRenderer from './MarkdownRenderer'
import TypewriterText from './TypewriterText'
import EnhancedContentRenderer from './EnhancedContentRenderer'

// ── 类型定义 ──────────────────────────────────────────────────────

export type MessageType = 'text' | 'link' | 'code' | 'image' | 'file' | 'structured'

// ── 工具函数 ──────────────────────────────────────────────────────

/**
 * 自动检测消息内容类型
 * 检测优先级：图片 > 链接 > 文件 > 代码 > 文本
 */
export function detectMessageType(content: string): MessageType {
	if (!content || !content.trim()) return 'text'

	const trimmed = content.trim()

	// 图片检测
	if (
		/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed) ||
		/\.(png|jpeg|jpg|gif|webp|svg|bmp)(\?|$)/i.test(trimmed)
	) {
		return 'image'
	}

	// 链接检测
	if (/^https?:\/\/\S+$/i.test(trimmed)) return 'link'

	// 文件检测
	const filePattern = /\S+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|csv|txt|md|json|xml|yaml|yml)(\s|$)/i
	if (filePattern.test(trimmed) && !trimmed.includes('```')) return 'file'

	// 代码块检测
	const lines = trimmed.split('\n')
	const isCodeBlock = trimmed.startsWith('```') && trimmed.endsWith('```')
	const isIndentedCode = lines.length >= 3 && lines.every(line => line.trim() === '' || /^\s{2,}/.test(line))
	if (isCodeBlock || isIndentedCode) return 'code'

	return 'text'
}

/**
 * 解析内容中的图表数据分隔符
 * 格式: ...Markdown文本...
 * <!--DATA-->
 * {"chart_type":"score-cards","items":[...]}
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

export interface MessageRenderResult {
	type: 'text' | 'link' | 'code' | 'image' | 'file' | 'structured'
	content: React.ReactNode
}

// ── 渲染函数 ──────────────────────────────────────────────────────

/**
 * 根据消息类型渲染差异化内容
 * 在 MessageBubble 组件内部调用
 */
export function renderMessageContent(
	msg: ChatMessage,
	index: number,
	allMessages: ChatMessage[],
	streaming: boolean,
): React.ReactNode {
	// v2.1: AI消息优先检测结构化JSON内容
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
		case 'text':
		default:
			if (msg.role === 'assistant') {
				const parsed = parseChartData(msg.content)
				if (parsed) {
					const textEl = <MarkdownRenderer content={parsed.textContent} />
					let chartEl: React.ReactNode = null
					if (parsed.chartJson.chart_type === 'score-cards' && parsed.chartJson.items?.length) {
						chartEl = (
							<div className="mt-4 p-4 bg-neutral-700/50 rounded-xl border border-neutral-100">
								<h4 className="text-sm font-semibold text-neutral-700 mb-3">
									{parsed.chartJson.title || '评分概览'}
								</h4>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
									{parsed.chartJson.items.map((item: any, i: number) => (
										<div key={i} className="surface-card rounded-lg p-3 text-center border border-neutral-100 shadow-sm">
											<div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
												{item.value}{item.unit || ''}
											</div>
											<div className="text-xs text-neutral-500 mt-1 truncate">{item.label}</div>
										</div>
									))}
								</div>
							</div>
						)
					}
					return (
						<EnhancedContentRenderer content={parsed.textContent}>
							<div>{textEl}{chartEl}</div>
						</EnhancedContentRenderer>
					)
				}
			}

			const isLastAndNotStreaming = index === allMessages.length - 1 && !streaming
			if (isLastAndNotStreaming) {
				return (
					<EnhancedContentRenderer content={msg.content}>
						<TypewriterText content={msg.content} speed={20} chunkSize={5} />
					</EnhancedContentRenderer>
				)
			}
			return (
				<EnhancedContentRenderer content={msg.content}>
					<MarkdownRenderer content={msg.content} />
				</EnhancedContentRenderer>
			)
	}
}

// ── 子组件（导出供外部使用） ──────────────────────────────────────

export function LinkMessageCard({ url }: { url: string }) {
	const domain = tryExtractDomain(url)
	const domainInitial = domain ? domain.charAt(0).toUpperCase() : '?'
	return (
		<div className="chat-link-card">
			<div className="chat-link-card-header">
				<Link className="w-4 h-4 text-primary-500 flex-shrink-0" />
				{domain && (
					<span
						className="w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold bg-neutral-100 text-neutral-600"
						title={domain}
					>
						{domainInitial}
					</span>
				)}
			</div>
			<div className="chat-link-card-body">
				<div className="chat-link-card-title">{tryExtractTitle(url)}</div>
				<div className="chat-link-card-url text-xs opacity-60 truncate">{url}</div>
			</div>
			<a href={url} target="_blank" rel="noopener noreferrer" className="chat-link-card-action">
				<ExternalLink className="w-3.5 h-3.5" />
				打开链接
			</a>
		</div>
	)
}

export function CodeMessageBlock({ code }: { code: string }) {
	const cleanCode = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
	return (
		<div className="chat-code-block">
			<div className="chat-code-block-header">
				<Code className="w-3.5 h-3.5" />
				<span className="text-xs">代码</span>
			</div>
			<pre className="chat-code-block-content"><code>{cleanCode || code}</code></pre>
		</div>
	)
}

export function ImageMessageCard({ src }: { src: string }) {
	return (
		<div className="chat-image-card">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={src} alt="message image" className="w-full rounded-lg" loading="lazy" />
		</div>
	)
}

export function FileMessageCard({ filename }: { filename: string }) {
	const ext = extractExtension(filename)
	return (
		<div className="chat-file-card">
			<FileText className="w-5 h-5 text-primary-500" />
			<div className="chat-file-card-info">
				<div className="chat-file-card-name truncate">{filename}</div>
				<div className="chat-file-card-ext">{ext}</div>
			</div>
		</div>
	)
}

// ── 辅助函数 ──────────────────────────────────────────────────────

export function tryExtractDomain(url: string): string | null {
	try {
		const { hostname } = new URL(url)
		return hostname.replace(/^www\./, '')
	} catch { return null }
}

export function tryExtractTitle(url: string): string {
	try {
		const { pathname } = new URL(url)
		const segments = pathname.split('/').filter(Boolean)
		if (segments.length > 0) {
			return segments[segments.length - 1].replace(/\.[^.]+$/, '') || '链接预览'
		}
	} catch { /* ignore */ }
	return '链接预览'
}

export function extractExtension(filename: string): string {
	const match = filename.match(/\.([^.]+)$/)
	return match ? match[1].toUpperCase() : 'FILE'
}
