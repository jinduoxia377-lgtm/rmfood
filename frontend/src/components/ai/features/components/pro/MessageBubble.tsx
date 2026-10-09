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
import ReasoningRow, { type ReasoningStep } from './ReasoningRow'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import { detectStructuredContent } from '../structured/utils'
import EnhancedContentRenderer from './EnhancedContentRenderer'
import {
	Leaf, Copy, Check, RefreshCw, Trash2,
	ThumbsUp, ThumbsDown, Pencil, Undo2, X,
	Link, Code, Image as ImageIcon, ExternalLink,
	FileText, AlertTriangle, MoreHorizontal,
	GitBranch, Share2,
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
	onForkMessage?: (messageId: string) => void
	onDetails?: (call: { id: string; name: string; args: Record<string, unknown>; status: 'running' | 'completed' | 'error'; durationMs?: number }) => void
	onStructureSave?: (messageId: string, content: string) => void
	onStructureShare?: (messageId: string, content: string) => void
	copiedId?: string | null
	thinkingSteps?: Array<{ step: string; content: string; status: string; detail?: string }>
	isHighlighted?: boolean
	isSelected?: boolean
	/** 子智能体委托状态（Task 6） */
	delegationProgress?: {
		taskId: string
		subtasks: Array<{ id: string; description: string; status: 'pending' | 'running' | 'completed' | 'failed'; error?: string }>
	}
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
		<div className="group/link relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900/50 hover:shadow-md transition-all duration-200">
			{/* 顶部装饰条 */}
			<div className="h-1 bg-gradient-to-r from-primary-500 to-indigo-500 opacity-0 group-hover/link:opacity-100 transition-opacity duration-200" />
			<div className="p-3.5">
				<div className="flex items-center gap-2 mb-2">
					<div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
						<Link className="w-3.5 h-3.5 text-primary-700 dark:text-primary-600" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
							{tryExtractTitle(url)}
						</div>
						<div className="text-xs text-neutral-400 dark:text-neutral-400 truncate flex items-center gap-1">
							{domain && (
								<span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
									{domainInitial}
								</span>
							)}
							{domain}
						</div>
					</div>
				</div>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-600 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
				>
					<ExternalLink className="w-3 h-3" />
					打开链接
				</a>
			</div>
		</div>
	)
}

function CodeMessageBlock({ code }: { code: string }) {
	const cleanCode = code.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
	return (
		<div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-900 dark:bg-neutral-950 shadow-sm">
			<div className="flex items-center justify-between px-4 py-2 bg-neutral-800 dark:bg-neutral-900 border-b border-neutral-700">
				<div className="flex items-center gap-2">
					<Code className="w-3.5 h-3.5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" />
					<span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-medium">代码</span>
				</div>
				<div className="flex gap-1.5">
					<div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
					<div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
					<div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
				</div>
			</div>
			<pre className="p-4 overflow-x-auto text-sm">
				<code className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] font-mono">{cleanCode || code}</code>
			</pre>
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
	const extColors: Record<string, string> = {
		PDF: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
		DOC: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
		DOCX: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
		XLS: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
		XLSX: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
		PNG: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
		JPG: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
		MP4: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
		ZIP: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
	}
	const colorClass = extColors[ext] || 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
	return (
		<div className="group/file flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all duration-200">
			<div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
				<FileText className="w-5 h-5" />
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
					{filename}
				</div>
				<div className="text-xs text-neutral-400 dark:text-neutral-400 mt-0.5">
					{ext} 格式文件
				</div>
			</div>
			<span className="text-xs font-mono px-2 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
				{ext}
			</span>
		</div>
	)
}

// ── 消息内容渲染 ──────────────────────────────────────────────────

/**
 * 判断内容是否"看起来像"结构化 JSON（即使不完整）
 * 用于流式阶段：避免中间状态展示原始 JSON 文本
 */
function isLikelyStructured(content: string): boolean {
	if (!content || content.length < 20) return false
	const trimmed = content.trim()
	// 必须以 { 开头
	if (trimmed[0] !== '{') return false
	// 包含 blocks 关键字，且括号平衡（至少闭合一次）
	const hasBlocks = trimmed.includes('"blocks"')
	const hasClosingBrace = trimmed.lastIndexOf('}') >= 0
	const braceDiff = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length
	// 未闭合但有 blocks 关键字 → 结构化内容在流式生成中
	return hasBlocks && (braceDiff >= 0 && braceDiff <= 3)
}

function renderMessageContent(
	msg: ChatMessage,
	index: number,
	allMessages: ChatMessage[],
	streaming: boolean,
) {
	// ── 结构化内容优先检测 ──
	if (msg.role === 'assistant') {
		const structured = detectStructuredContent(msg.content)
		console.log('[MessageBubble] detectStructured:', structured ? `OK (${structured.blocks.length} blocks)` : 'NULL', '| content preview:', msg.content.substring(0, 60))
		if (structured) {
			return <StructuredMessageRenderer content={structured} />
		}
		// 流式中：内容像结构化 JSON 但未完成 → 显示加载占位，避免展示原始 JSON
		if (streaming && isLikelyStructured(msg.content)) {
			return (
				<div className="flex items-center gap-2 py-3 text-xs text-neutral-400 dark:text-neutral-400">
					<RefreshCw className="w-3 h-3 animate-spin" />
					正在生成配方方案…
				</div>
			)
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
											<div className="text-2xl font-bold text-primary-700 dark:text-primary-600">
												{item.value}{item.unit || ''}
											</div>
											<div className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-1 truncate">{item.label}</div>
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
	onForkMessage,
	onDetails,
	onStructureSave,
	onStructureShare,
	thinkingSteps,
	isHighlighted,
	isSelected,
	delegationProgress,
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

	const showDateSep = index > 0 && isNewDay(allMessages[index - 1]?.timestamp, msg.timestamp)

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
					{msg.role === 'user' ? (
						<span className="avatar-letter">U</span>
					) : (
						<>
							<Leaf className="w-4 h-4" />
							<span
								className={`avatar-status-indicator ${isStreaming && index === allMessages.length - 1 ? 'avatar-status-thinking' : 'avatar-status-online'}`}
							/>
						</>
					)}
				</div>

				{/* 消息内容组 */}
				<div className="chat-message-group">
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
								className="w-full min-h-[60px] max-h-[200px] px-3 py-2 rounded-lg surface-card border border-neutral-300 dark:border-neutral-700 text-neutral-800 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
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
									<span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">发送中...</span>
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
									{/* Task 6: 子智能体委托进度 */}
									{delegationProgress && delegationProgress.subtasks.length > 0 && (
										<div className="mb-2 p-2 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800/30">
											<div className="flex items-center gap-1.5 mb-1.5">
												<RefreshCw className={`w-3 h-3 text-primary-500 ${delegationProgress.subtasks.some(s => s.status === 'running') ? 'animate-spin' : ''}`} />
												<span className="text-xs font-medium text-primary-700 dark:text-primary-600">子任务执行中</span>
											</div>
											<div className="space-y-0.5">
												{delegationProgress.subtasks.map(st => (
													<div key={st.id} className="flex items-center gap-1.5 text-xs">
														{st.status === 'completed' && <Check className="w-3 h-3 text-success-500 flex-shrink-0" />}
														{st.status === 'running' && <RefreshCw className="w-3 h-3 text-primary-500 animate-spin flex-shrink-0" />}
														{st.status === 'failed' && <AlertTriangle className="w-3 h-3 text-error-500 flex-shrink-0" />}
														{st.status === 'pending' && <div className="w-3 h-3 rounded-full border-2 border-neutral-300 dark:border-neutral-600 flex-shrink-0" />}
														<span className={st.status === 'completed' ? 'text-success-600 dark:text-success-600' : st.status === 'running' ? 'text-primary-700 dark:text-primary-600' : st.status === 'failed' ? 'text-error-600 dark:text-error-600' : 'text-neutral-500'}>
															{st.description}
														</span>
														{st.status === 'failed' && <span className="text-error-400 truncate">{st.error}</span>}
													</div>
												))}
											</div>
										</div>
									)}
									{msg.role === 'assistant' && thinkingSteps && thinkingSteps.length > 0 && (
										<ReasoningRow
											steps={thinkingSteps as ReasoningStep[]}
											isThinking={isStreaming && index === allMessages.length - 1}
										/>
									)}
									{msg.role === 'assistant' && (
								<div style={{fontSize:10,color:"#ff0",padding:"2px 4px",background:"#333",borderRadius:2,marginBottom:4}}>
									{(() => { const _s=detectStructuredContent(msg.content); return _s ? `struct:${_s.blocks.length}blks` : 'NO_STRUCT'; })()}
								</div>
							)}
							{renderMessageContent(msg, index, allMessages, isStreaming)}
								</>
							)}
						</div>
					)}
				</div>

				{/* 操作栏 — DSH 极简风格：时间 + 核心操作，hover 显示 */}
				{!msg.error && !msg.isLoading && msg.content && !msg.isRetracted && (
					<div className="chat-action-bar">
						<span className="chat-action-time">{formatTime(msg.timestamp)}</span>
						<button onClick={handleCopy} className="chat-action-btn" title="复制">
							{(msg.id === (copiedId ?? (globalThis as unknown as { __chatCopiedId?: string }).__chatCopiedId))
								? <Check className="w-3 h-3 text-emerald-500" />
								: <Copy className="w-3 h-3" />}
						</button>
						{msg.role === 'user' && (
							<button onClick={startEdit} className="chat-action-btn" title="编辑">
								<Pencil className="w-3 h-3" />
							</button>
						)}
						{msg.role === 'user' && onRetract && (
							<button onClick={() => onRetract(msg.id)} className="chat-action-btn" title="撤回">
								<Undo2 className="w-3 h-3" />
							</button>
						)}
						{msg.role === 'assistant' && onRegenerate && (
							<button onClick={() => onRegenerate(msg.id)} className="chat-action-btn" title="重新生成">
								<RefreshCw className="w-3 h-3" />
							</button>
						)}
						{onForkMessage && (
							<button onClick={() => onForkMessage(msg.id)} className="chat-action-btn" title="从此处分支">
								<GitBranch className="w-3 h-3" />
							</button>
						)}
						{msg.role === 'assistant' && onStructureSave && (
							<button onClick={() => onStructureSave(msg.id, msg.content)} className="chat-action-btn" title="保存到配方库">
								<Leaf className="w-3 h-3" />
							</button>
						)}
						{msg.role === 'assistant' && onStructureShare && (
							<button onClick={() => onStructureShare(msg.id, msg.content)} className="chat-action-btn" title="分享配方">
								<Share2 className="w-3 h-3" />
							</button>
						)}
						{
							<button
								onClick={() => {
									const menu = (document.getElementById('msg-menu-' + msg.id) as HTMLElement | null)
									if (menu) menu.remove(); else {
										const el = document.createElement('div')
										el.id = 'msg-menu-' + msg.id
										el.className = 'chat-more-menu'
										el.innerHTML = `
											<div class="chat-more-menu-content">
												<button class="chat-more-menu-item" data-action="edit">编辑</button>
												<button class="chat-more-menu-item" data-action="regen">重新生成</button>
												<button class="chat-more-menu-item" data-action="delete">删除</button>
												${onDetails ? `<button class="chat-more-menu-item" data-action="details">详情</button>` : ''}
											</div>`
										document.body.appendChild(el)
										setTimeout(() => {
											const close = () => { el.remove(); document.removeEventListener('mousedown', close) }
											document.addEventListener('mousedown', close)
											el.addEventListener('click', (e) => {
												const target = e.target as HTMLElement
												if (target.classList.contains('chat-more-menu-item')) {
													const action = target.dataset.action
													if (action === 'edit') startEdit()
													else if (action === 'regen') onRegenerate?.(msg.id)
													else if (action === 'delete') onDelete?.(msg.id)
													else if (action === 'details') onDetails?.({
														id: msg.id, name: 'assistant_analysis',
														args: { query: msg.content.slice(0, 100) },
														status: 'completed',
													})
													close()
												}
											})
										}, 10)
									}
								}}
								className="chat-action-btn"
								title="更多"
							>
								<MoreHorizontal className="w-3 h-3" />
							</button>
						}
					</div>
				)}
			</div>
		</React.Fragment>
	)
}
