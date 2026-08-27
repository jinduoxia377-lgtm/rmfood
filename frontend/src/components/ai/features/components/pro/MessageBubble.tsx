/**
 * MessageBubble — 单条消息气泡组件
 *
 * 职责：
 * - 渲染单条消息（头像、时间戳、内容、操作栏）
 * - 支持编辑/撤回/点赞/点踩/复制/删除/引用
 * - 日期分隔线
 *
 * @version 1.0.0
 * @lastUpdated 2026-08-23
 */

import React, { useState, useCallback } from 'react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { detectMessageType, parseChartData } from './utils.tsx'
import MarkdownRenderer from './MarkdownRenderer'
import TypewriterText from './TypewriterText'
import ThinkingProcess from './ThinkingProcess'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import { detectStructuredContent } from '../structured/utils'
import EnhancedContentRenderer from './EnhancedContentRenderer'
import {
	Bot, Copy, Check, RefreshCw, Trash2,
	ThumbsUp, ThumbsDown, Pencil, Undo2, X,
	Link, Code, Image as ImageIcon, ExternalLink,
	FileText, AlertTriangle,
} from 'lucide-react'
import { userProfileManager } from '../../services/userProfileService'
import { logger } from '@/utils/safeLogger'

type Reaction = 'like' | 'dislike' | null

export interface MessageBubbleProps {
	msg: ChatMessage
	index: number
	allMessages: ChatMessage[]
	isStreaming: boolean
	reaction?: Reaction
	searchQuery?: string
	editingId: string | null
	editContent: string
	setEditContent: (v: string) => void
	onCopy: (id: string, content: string) => void
	onReaction: (msgId: string, type: 'like' | 'dislike') => void
	onEdit: (id: string, content: string) => void
	onRetract: (id: string) => void
	onDelete: (id: string) => void
	onReference: (msg: ChatMessage) => void
	onRegenerate: (id: string) => void
	copiedId?: string | null
	thinkingSteps?: Array<{ step: string; content: string; status: string; detail?: string }>
	isHighlighted?: boolean
	isSelected?: boolean
}

// ── 工具函数 ──────────────────────────────────────────────────────

function formatTime(ts: number): string {
	const d = new Date(ts)
	return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number): string {
	const d = new Date(ts)
	const today = new Date()
	const yesterday = new Date(today)
	yesterday.setDate(yesterday.getDate() - 1)
	if (d.toDateString() === today.toDateString()) return '今天'
	if (d.toDateString() === yesterday.toDateString()) return '昨天'
	return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function isNewDay(ts1: number, ts2: number): boolean {
	return new Date(ts1).toDateString() !== new Date(ts2).toDateString()
}

function tryExtractDomain(url: string): string | null {
	try {
		const { hostname } = new URL(url)
		return hostname.replace(/^www\./, '')
	} catch { return null }
}

function tryExtractTitle(url: string): string {
	try {
		const { pathname } = new URL(url)
		const segments = pathname.split('/').filter(Boolean)
		if (segments.length > 0) {
			return segments[segments.length - 1].replace(/\.[^.]+$/, '') || '链接预览'
		}
	} catch { /* ignore */ }
	return '链接预览'
}

function extractExtension(filename: string): string {
	const match = filename.match(/\.([^.]+)$/)
	return match ? match[1].toUpperCase() : 'FILE'
}

// ── 子组件 ────────────────────────────────────────────────────────

function LinkMessageCard({ url }: { url: string }) {
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

function CodeMessageBlock({ code }: { code: string }) {
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

function ImageMessageCard({ src }: { src: string }) {
	const [loaded, setLoaded] = useState(false)
	const [error, setError] = useState(false)
	return (
		<div className="chat-image-card">
			{!loaded && !error && (
				<div className="chat-image-placeholder">
					<ImageIcon className="w-8 h-8 animate-pulse" />
					<span className="text-xs mt-1">加载中...</span>
				</div>
			)}
			{error && (
				<div className="chat-image-error">
					<ImageIcon className="w-8 h-8" />
					<span className="text-xs">图片加载失败</span>
				</div>
			)}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={src}
				alt="message image"
				className={`w-full rounded-lg ${loaded ? 'block' : 'hidden'}`}
				loading="lazy"
				onLoad={() => setLoaded(true)}
				onError={() => setError(true)}
			/>
		</div>
	)
}

function FileMessageCard({ filename }: { filename: string }) {
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

// ── 消息内容渲染 ──────────────────────────────────────────────────

function renderMessageContent(
	msg: ChatMessage,
	index: number,
	allMessages: ChatMessage[],
	streaming: boolean,
) {
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

// ── 主组件 ────────────────────────────────────────────────────────

export function MessageBubble({
	msg,
	index,
	allMessages,
	isStreaming,
	reaction,
	searchQuery,
	editingId,
	editContent,
	setEditContent,
	onCopy,
	onReaction,
	copiedId,
	onEdit,
	onRetract,
	onDelete,
	onReference,
	onRegenerate,
	thinkingSteps,
	isHighlighted,
	isSelected,
}: MessageBubbleProps) {
	const startEdit = useCallback(() => onEdit?.(msg.id, msg.content), [msg.id, msg.content, onEdit])
	const confirmEdit = useCallback(() => {
		if (editingId === msg.id && editContent.trim()) onEdit?.(editingId, editContent.trim())
	}, [editingId, editContent, onEdit, msg.id])
	const cancelEdit = useCallback(() => {
		if (editingId === msg.id) onEdit?.(editingId, msg.content)
	}, [editingId, onEdit, msg.content, msg.id])

	const handleCopy = useCallback(() => onCopy(msg.id, msg.content), [msg.id, msg.content, onCopy])
	const handleReaction = useCallback(
		(type: 'like' | 'dislike') => {
			onReaction(msg.id, type)
			try {
				userProfileManager.recordBehavior({
					type: type === 'like' ? 'response_liked' : 'response_disliked',
					timestamp: Date.now(),
					metadata: { messageId: msg.id },
				})
			} catch (e) {
				logger.warn('[MessageBubble] Behavior recording failed:', e)
			}
		},
		[msg.id, onReaction],
	)

	const showDateSep = index === 0 || isNewDay(allMessages[index - 1]?.timestamp, msg.timestamp)

	return (
		<React.Fragment>
			{/* 日期分隔线 */}
			{showDateSep && (
				<div className="chat-date-separator" role="separator" aria-label="日期分隔">
					<span>{formatDate(msg.timestamp)}</span>
				</div>
			)}

			{/* 消息行 */}
			<div
				className={`chat-message-row${msg.role === 'user' ? ' user-row' : ''}${isHighlighted ? ' chat-highlighted' : ''}${isSelected ? ' chat-selected' : ''}`}
			>
				{/* 头像 */}
				<div className={msg.role === 'user' ? 'avatar-user' : 'avatar-ai'}>
					{msg.role === 'user' ? 'U' : (
						<>
							<Bot className="w-4 h-4" />
							<span
								className={`avatar-status-indicator ${isStreaming && index === allMessages.length - 1 ? 'avatar-status-thinking' : 'avatar-status-online'}`}
							/>
						</>
					)}
				</div>

				{/* 消息内容组 */}
				<div className="chat-message-group">
					<div className="chat-timestamp">{formatTime(msg.timestamp)}</div>

					{/* 气泡 */}
					{msg.isRetracted ? (
						<div className="chat-bubble-retracted">
							<span>消息已撤回</span>
							{msg.retractedAt && <span className="ml-2">{formatTime(msg.retractedAt)}</span>}
						</div>
					) : editingId === msg.id && msg.role === 'user' ? (
						<div className="chat-edit-overlay">
							<textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								aria-label="编辑消息"
								className="w-full min-h-[60px] max-h-[200px] px-3 py-2 rounded-lg surface-card border border-neutral-300 text-neutral-800 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit() }
									if (e.key === 'Escape') cancelEdit()
								}}
							/>
							<div className="chat-edit-actions">
								<button onClick={cancelEdit} className="cancel"><X className="w-3 h-3" /> 取消</button>
								<button onClick={confirmEdit} className="confirm"><Check className="w-3 h-3" /> 确认</button>
							</div>
						</div>
					) : (
						<div
							className={
								msg.error
									? 'chat-bubble-error'
									: msg.sendStatus === 'failed' && msg.role === 'user'
									? 'chat-bubble-user chat-bubble-failed'
									: msg.role === 'user'
									? 'chat-bubble-user'
									: 'chat-bubble-ai'
							}
						>
							{/* 发送状态 */}
							{msg.sendStatus === 'sending' && msg.role === 'user' && !msg.error ? (
								<div className="flex items-center gap-2.5">
									<RefreshCw className="w-3 h-3 animate-spin text-primary-500" />
									<span className="text-xs text-neutral-500">发送中...</span>
								</div>
							) : msg.error ? (
								<div className="flex items-center gap-2">
									<AlertTriangle className="w-3.5 h-3.5 text-error-500" />
									<span className="text-xs text-error-600">{msg.error}</span>
								</div>
							) : msg.role === 'assistant' && msg.isLoading ? (
								<div className="chat-typing-indicator">
									<span className="chat-typing-dot" />
									<span className="chat-typing-dot" />
									<span className="chat-typing-dot" />
								</div>
							) : msg.sendStatus === 'sending' ? null : (
								<>
									{msg.role === 'assistant' && thinkingSteps && thinkingSteps.length > 0 && (
										<div className="mb-2"><ThinkingProcess steps={thinkingSteps} isThinking={false} /></div>
									)}
									{renderMessageContent(msg, index, allMessages, isStreaming)}
								</>
							)}
						</div>
					)}
				</div>

				{/* 操作栏 */}
				{!msg.error && !msg.isLoading && msg.content && !msg.isRetracted && (
					<div className="chat-action-bar">
						{msg.role === 'user' && (
							<button onClick={startEdit} className="chat-action-btn" title="编辑" aria-label="编辑消息">
								<Pencil className="w-3.5 h-3.5" />
							</button>
						)}
						<button onClick={handleCopy} className="chat-action-btn" title="复制" aria-label="复制消息">
							{msg.id === (copiedId ?? (globalThis as any).__chatCopiedId)
								? <Check className="w-3.5 h-3.5 text-success-500" />
								: <Copy className="w-3.5 h-3.5" />}
						</button>
						{onReference && (
							<button onClick={() => onReference(msg)} className="chat-action-btn" title="引用" aria-label="引用消息">
								<span className="text-xs font-bold">↑</span>
							</button>
						)}
						{msg.role === 'assistant' && (
							<>
								<button
									onClick={() => handleReaction('like')}
									className={`chat-action-btn ${reaction === 'like' ? 'text-secondary-500' : ''}`}
									title="有用" aria-label="点赞"
								>
									<ThumbsUp className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => handleReaction('dislike')}
									className={`chat-action-btn ${reaction === 'dislike' ? 'text-error-500' : ''}`}
									title="没用" aria-label="点踩"
								>
									<ThumbsDown className="w-3.5 h-3.5" />
								</button>
								{onRegenerate && (
									<button onClick={() => onRegenerate(msg.id)} className="chat-action-btn" title="重新生成" aria-label="重新生成">
										<RefreshCw className="w-3 h-3" />
									</button>
								)}
							</>
						)}
						{msg.role === 'user' && onRetract && (
							<button onClick={() => onRetract(msg.id)} className="chat-action-btn" title="撤回" aria-label="撤回消息">
								<Undo2 className="w-3.5 h-3.5" />
							</button>
						)}
						{onDelete && !(msg.role === 'user' && onRetract) && (
							<button onClick={() => onDelete(msg.id)} className="chat-action-btn" title="删除" aria-label="删除消息">
								<Trash2 className="w-3.5 h-3.5" />
							</button>
						)}
					</div>
				)}
			</div>
		</React.Fragment>
	)
}
