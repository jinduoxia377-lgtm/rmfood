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

import React, { useState, useCallback, useMemo } from 'react'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { useAuthStore } from '@/stores/auth'
import { detectMessageType, parseChartData } from './utils.tsx'
import MarkdownRenderer from './MarkdownRenderer'
import TypewriterText from './TypewriterText'
import ReasoningRow, { type ReasoningStep } from './ReasoningRow'
import StructuredMessageRenderer from '../structured/StructuredMessageRenderer'
import { detectStructuredContent, extractStructuredFallback } from '../structured/utils'
import EnhancedContentRenderer from './EnhancedContentRenderer'
import {
	Leaf, Copy, Check, RefreshCw,
	Pencil, Undo2, X,
	Link, Code, Image as ImageIcon, ExternalLink,
	FileText, AlertTriangle, MoreHorizontal,
	GitBranch, Share2, Cpu, Wand2,
} from 'lucide-react'

type Reaction = 'like' | 'dislike' | null

/**
 * ModelSourceBadge — 回复来源徽标
 *
 * 后端 chat_engine.py 在 LLM 不可用（额度不足 / Key 无效 / 超时）时会
 * 降级到本地规则引擎，并把 result.model 标为 "rule-engine-fallback" 或
 * "ultimate-fallback"。此前 ChatMessage 类型甚至没有 model 字段，前端完全
 * 丢弃该信息，导致用户无法分辨「大模型推理」与「规则引擎降级」。
 *
 * 这是「配方设计专家」系统的能力真实性底线：不能让规则引擎冒充大模型。
 * 该徽标取代了此处原有的调试块（黄色内联样式显示 struct:Xblks）。
 */
function ModelSourceBadge({ model }: { model: string }) {
	// 三级降级均失败：固定文案兜底（最严重的诚实性问题）
	if (model === 'ultimate-fallback') {
		return (
			<div
				className="mb-2 flex items-center gap-1.5 rounded-md border border-warning-200 dark:border-warning-500/40 bg-warning-50 dark:bg-warning-500/15 px-2 py-1 text-xs leading-tight text-warning-700 dark:text-warning-400"
				role="note"
			>
				<AlertTriangle className="h-3 w-3 shrink-0" />
				<span>大模型三级降级均失败，以下为固定引导文案，非智能生成</span>
			</div>
		)
	}
	// 规则引擎降级：内容真实但来源不是大模型
	if (model === 'rule-engine-fallback') {
		return (
			<div
				className="mb-2 flex items-center gap-1.5 rounded-md border border-warning-200 dark:border-warning-500/40 bg-warning-50 dark:bg-warning-500/15 px-2 py-1 text-xs leading-tight text-warning-700 dark:text-warning-400"
				role="note"
			>
				<AlertTriangle className="h-3 w-3 shrink-0" />
				<span>大模型不可用，以下由本地配方引擎生成，非大模型推理</span>
			</div>
		)
	}
	// 生成失败
	if (model === 'error') {
		return (
			<div
				className="mb-2 flex items-center gap-1.5 rounded-md border border-error-200 dark:border-error-500/40 bg-error-50 dark:bg-error-500/15 px-2 py-1 text-xs leading-tight text-error-700 dark:text-error-400"
				role="alert"
			>
				<AlertTriangle className="h-3 w-3 shrink-0" />
				<span>回复生成失败</span>
			</div>
		)
	}
	// 真实大模型推理：低调呈现模型名，作为能力凭据
	return (
		<div className="mb-2 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs leading-tight text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
			<Cpu className="h-3 w-3 shrink-0" />
			<span>{model}</span>
		</div>
	)
}

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
	/** 结构化兜底：将非结构化配方文本修复为结构化 JSON 后保存 */
	onStructureRepair?: (messageId: string, content: string) => void
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

/**
 * 判断文本是否包含配方特征（成分表/配方/克/g 等关键词）。
 * 用于结构化兜底：当 detectStructuredContent 返回 null 但内容像配方时，
 * 在消息操作区展示「修复为结构化配方」按钮。
 */
export function isFormulaLikeContent(content: string): boolean {
	if (!content || typeof content !== 'string') return false
	const text = content.toLowerCase()
	// 剂量写法：数字 + 克 / 数字 + g（避免单独字母 g 误报）
	const hasDosageGram = /\d+\s*(克|g\b)/i.test(text)
	// 配方特征关键词
	const hasFormulaKeyword = /配方|成分表|配料|原料|用量|剂量|配伍|君臣佐使|功效|煎煮|服用|药食同源/.test(text)
	return hasDosageGram || hasFormulaKeyword
}

// ── 子组件 ────────────────────────────────────────────────────────

function LinkMessageCard({ url }: { url: string }) {
	const domain = tryExtractDomain(url)
	const domainInitial = domain ? domain.charAt(0).toUpperCase() : '?'
	return (
		<div className="group/link relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-white dark:from-neutral-800/50 dark:to-neutral-900/50 hover:shadow-md transition-all duration-200">
			{/* 顶部装饰条 */}
			<div className="h-1 bg-gradient-to-r from-primary-500 to-accent-500 opacity-0 group-hover/link:opacity-100 transition-opacity duration-200" />
			<div className="p-3.5">
				<div className="flex items-center gap-2 mb-2">
					<div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-300/25 flex items-center justify-center flex-shrink-0">
						<Link className="w-3.5 h-3.5 text-primary-700 dark:text-primary-700" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
							{tryExtractTitle(url)}
						</div>
						<div className="text-xs text-neutral-400 dark:text-neutral-400 truncate flex items-center gap-1">
							{domain && (
								<span className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
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
					className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
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
		PDF: 'bg-error-100 text-error-600 dark:bg-error-300/25 dark:text-error-700',
		DOC: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-300/25 dark:text-secondary-700',
		DOCX: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-300/25 dark:text-secondary-700',
		XLS: 'bg-success-100 text-success-600 dark:bg-success-300/25 dark:text-success-700',
		XLSX: 'bg-success-100 text-success-600 dark:bg-success-300/25 dark:text-success-700',
		PNG: 'bg-accent-100 text-accent-600 dark:bg-accent-300/25 dark:text-accent-700',
		JPG: 'bg-accent-100 text-accent-600 dark:bg-accent-300/25 dark:text-accent-700',
		MP4: 'bg-warning-100 text-warning-600 dark:bg-warning-300/25 dark:text-warning-700',
		ZIP: 'bg-warning-100 text-warning-600 dark:bg-warning-300/25 dark:text-warning-700',
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
		// 兜底：即使标准检测失败，只要内容是合法 blocks JSON（如带前后说明文字/格式差异），
		// 也渲染为专业配方卡，绝不裸显示 JSON。
		const fallbackStructured = extractStructuredFallback(msg.content)
		if (fallbackStructured) {
			return <StructuredMessageRenderer content={fallbackStructured} />
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
								<div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-3">
									{parsed.chartJson.items.map((item: any, i: number) => (
										<div key={i} className="surface-card rounded-lg p-3 text-center border border-neutral-100 shadow-sm">
											<div className="text-2xl font-bold text-primary-700 dark:text-primary-700">
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

			// eslint-disable-next-line no-case-declarations
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

export function DialecticsCallout({ dialectics }: { dialectics: NonNullable<ChatMessage['dialectics']> }) {
	if (!dialectics) return null

	// 急症：红色警示卡片
	if (dialectics.urgent) {
		return (
			<div className="mb-2 p-3 rounded-xl border border-danger-300 bg-danger-50 dark:bg-danger-900/15 text-sm">
				<div className="flex items-start gap-2">
					<AlertTriangle className="w-4 h-4 mt-0.5 text-danger-600 flex-shrink-0" />
					<div>
						<p className="font-semibold text-danger-700 dark:text-danger-600">⚠️ 建议立即就医</p>
						<p className="mt-1 text-danger-600 dark:text-danger-500">{dialectics.referral_message || '您的描述可能属于急重症表现，请立即就医，不要依赖食疗调理。'}</p>
					</div>
				</div>
			</div>
		)
	}

	// 常规辨证：体质倾向 + 调理方向 + 证据参考
	const goals = dialectics.regulation_goals || []
	const evidence = dialectics.evidence || []
	return (
		<div className="mb-2 p-3 rounded-xl border border-primary-100 dark:border-primary-800/30 bg-primary-50/60 dark:bg-primary-900/10 text-sm">
			<p className="text-xs font-semibold text-primary-700 dark:text-primary-700 mb-1.5 flex items-center gap-1.5">
				<Cpu className="w-3.5 h-3.5" /> 辨证分析
				{dialectics.engine === 'rule_engine_fallback' && (
					<span className="text-xs font-normal px-1.5 py-0.5 rounded bg-warning-100 dark:bg-warning-900/30 text-warning-600">规则引擎降级</span>
				)}
			</p>
			{dialectics.constitution_tendency && (
				<p className="text-neutral-800 dark:text-neutral-200">
					<span className="font-medium">体质倾向：</span>{dialectics.constitution_tendency}
				</p>
			)}
			{goals.length > 0 && (
				<div className="mt-1.5">
					<p className="text-xs text-muted-foreground mb-1">调理方向：</p>
					<ul className="space-y-0.5 text-xs text-neutral-700 dark:text-neutral-300">
						{goals.map((g, i) => <li key={i}>· {g}</li>)}
					</ul>
				</div>
			)}
			{evidence.length > 0 && (
				<div className="mt-1.5 space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
					{evidence.slice(0, 3).map((e, i) => (
						<p key={i}><span className="text-info-600 dark:text-info-500">[{e.level}]</span> {e.claim}{e.source ? `（来源：${e.source}）` : ''}</p>
					))}
				</div>
			)}
		</div>
	)
}

export function MessageBubble({
	msg,
	index,
	allMessages,
	isStreaming,
	editingId,
	editContent,
	setEditContent,
	onCopy,
	copiedId,
	onEdit,
	onRetract,
	onDelete,
	onRegenerate,
	onForkMessage,
	onDetails,
	onStructureSave,
	onStructureShare,
	onStructureRepair,
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

	// ── 用户头像实时同步：订阅 auth store 的当前用户（更新头像后自动刷新）──
	const currentUser = useAuthStore((s) => s.user)
	// 头像 URL 追加基于当前用户头像地址变化的版本号，避免浏览器缓存旧头像；
	// 仅当 avatarUrl 变化时递增版本号（纯函数），不在 render 中调用不纯函数。
	const [prevAvatarUrl, setPrevAvatarUrl] = useState(currentUser?.avatarUrl)
	const [avatarVersion, setAvatarVersion] = useState(0)
	if (prevAvatarUrl !== currentUser?.avatarUrl) {
		setPrevAvatarUrl(currentUser?.avatarUrl)
		setAvatarVersion(v => v + 1)
	}
	const userAvatarSrc = useMemo(() => {
		if (!currentUser?.avatarUrl) return ''
		const sep = currentUser.avatarUrl.includes('?') ? '&' : '?'
		return `${currentUser.avatarUrl}${sep}t=${avatarVersion}`
	}, [currentUser?.avatarUrl, avatarVersion])
	const userAvatarLabel = (currentUser?.fullName || currentUser?.username || 'U').slice(0, 1).toUpperCase()

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
						userAvatarSrc ? (
							<img
								key={currentUser?.avatarUrl}
								src={userAvatarSrc}
								alt={currentUser?.username || '用户'}
								className="avatar-img"
								referrerPolicy="no-referrer"
								loading="lazy"
							/>
						) : (
							<span className="avatar-letter">{userAvatarLabel}</span>
						)
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
										<div className="mb-2 p-2 bg-primary-50 dark:bg-primary-300/15 rounded-lg border border-primary-100 dark:border-primary-800/30">
											<div className="flex items-center gap-1.5 mb-1.5">
												<RefreshCw className={`w-3 h-3 text-primary-500 ${delegationProgress.subtasks.some(s => s.status === 'running') ? 'animate-spin' : ''}`} />
												<span className="text-xs font-medium text-primary-700 dark:text-primary-700">子任务执行中</span>
											</div>
											<div className="space-y-0.5">
												{delegationProgress.subtasks.map(st => (
													<div key={st.id} className="flex items-center gap-1.5 text-xs">
														{st.status === 'completed' && <Check className="w-3 h-3 text-success-500 flex-shrink-0" />}
														{st.status === 'running' && <RefreshCw className="w-3 h-3 text-primary-500 animate-spin flex-shrink-0" />}
														{st.status === 'failed' && <AlertTriangle className="w-3 h-3 text-error-500 flex-shrink-0" />}
														{st.status === 'pending' && <div className="w-3 h-3 rounded-full border-2 border-neutral-300 dark:border-neutral-600 flex-shrink-0" />}
														<span className={st.status === 'completed' ? 'text-success-600 dark:text-success-600' : st.status === 'running' ? 'text-primary-700 dark:text-primary-700' : st.status === 'failed' ? 'text-error-600 dark:text-error-600' : 'text-neutral-500'}>
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
									{msg.role === 'assistant' && msg.model && <ModelSourceBadge model={msg.model} />}
									{msg.role === 'assistant' && msg.dialectics && <DialecticsCallout dialectics={msg.dialectics} />}
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
								? <Check className="w-3 h-3 text-success-500" />
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
						{msg.role === 'assistant' && onStructureRepair && !detectStructuredContent(msg.content) && isFormulaLikeContent(msg.content) && (
							<button onClick={() => onStructureRepair(msg.id, msg.content)} className="chat-action-btn inline-flex items-center gap-1" title="修复为结构化配方">
								<Wand2 className="w-3 h-3" />
								<span className="text-[10px] leading-none">修复为结构化配方</span>
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
