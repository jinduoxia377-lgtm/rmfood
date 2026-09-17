/**
 * MessageList — 消息列表容器（含虚拟滚动）
 *
 * 职责：
 * - 管理消息列表渲染（普通/虚拟化）
 * - 自动滚动到底部
 * - 骨架屏/空状态
 * - 跳到底部按钮
 * - 流式加载指示器
 *
 * @version 1.0.0
 * @lastUpdated 2026-08-23
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ChatMessage } from '../../hooks/useChatMessages'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { MessageBubble } from './MessageBubble'
import {
	Bot, Sparkles, ChevronDown, Leaf, Handshake, Dna, Shield, RefreshCw,
} from 'lucide-react'

export interface MessageListProps {
	messages: ChatMessage[]
	isStreaming: boolean
	isLoading?: boolean
	chatError: Error | null
	onRetry?: () => void
	onRetryMessage?: (messageId: string) => void
	onCopyMessage?: (content: string) => void
	onRegenerate?: (messageId: string) => void
	onDeleteMessage?: (messageId: string) => void
	onGenerateReport?: () => void
	showReportButton?: boolean
	highlightedMessageId?: string | null
	selectedMessageIds?: string[]
	onReferenceMessage?: (msg: ChatMessage) => void
	onEditMessage?: (id: string, newContent: string) => void
	onRetractMessage?: (id: string) => void
	onForkMessage?: (messageId: string) => void
	onDetailsMessage?: (call: { id: string; name: string; args: Record<string, unknown>; status: 'running' | 'completed' | 'error'; durationMs?: number }) => void
	thinkingSteps?: Array<{ step: string; content: string; status: string; detail?: string }>
}

const VIRTUALIZE_THRESHOLD = 40

const QUICK_ACTIONS = [
	{ Icon: Leaf, title: '补气药材', desc: '药食同源目录里有哪些常用的补气药材？', color: 'text-primary-500' },
	{ Icon: Handshake, title: '配伍协同', desc: '黄芪和党参配伍有什么协同作用？', color: 'text-secondary-500' },
	{ Icon: Dna, title: '活性肽', desc: '功能性食品中常用的活性肽有哪些来源？', color: 'text-accent-500' },
	{ Icon: Shield, title: '抗氧化', desc: '设计一款抗氧化保健食品需要注意什么？', color: 'text-rose-500' },
]

export function MessageList({
	messages, isStreaming, isLoading, chatError,
	onRetry, onRetryMessage, onCopyMessage, onRegenerate, onDeleteMessage,
	onGenerateReport, showReportButton,
	highlightedMessageId, selectedMessageIds, onReferenceMessage,
	onEditMessage, onRetractMessage, onForkMessage, onDetailsMessage,
	thinkingSteps,
}: MessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const bottomRef = useRef<HTMLDivElement>(null)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike' | null>>({})
	const [showScrollBtn, setShowScrollBtn] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editContent, setEditContent] = useState('')
	const [retryQueue, setRetryQueue] = useState<Array<{ id: string; content: string; timestamp: number }>>([])

	const networkStatus = useNetworkStatus()
	const { isOnline, isSlowConnection } = networkStatus

	const shouldVirtualize = messages.length > VIRTUALIZE_THRESHOLD
	const listContainerRef = useRef<HTMLDivElement>(null)
	const [scrollMargin, setScrollMargin] = useState(0)

	// 动态高度估计：根据消息内容和角色计算，避免固定 140px 导致的滚动错位
	const getEstimatedSize = useCallback((index: number): number => {
		const msg = messages[index]
		if (!msg) return 140

		if (msg.role === 'assistant') {
			// AI回复：基础高度 + 内容长度（每80字符约25px）+ thinking步骤额外空间
			const baseHeight = 80
			const contentHeight = Math.min(Math.floor(msg.content.length / 80) * 25, 400)
			const stepHeight = ((msg as Record<string, unknown>).thinking_steps?.length ?? 0) * 30
			return baseHeight + contentHeight + stepHeight
		}

		if (msg.role === 'user') {
			// 用户消息：基础高度 + 内容长度
			return Math.min(60 + Math.floor(msg.content.length / 40) * 15, 200)
		}

		// 错误消息等
		return 100
	}, [messages])

	const rowVirtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: getEstimatedSize,
		overscan: 10,
		scrollMargin,
		getItemKey: (index) => messages[index]?.id ?? index,
	})

	useLayoutEffect(() => {
		if (shouldVirtualize && listContainerRef.current) {
			setScrollMargin(listContainerRef.current.offsetTop)
		}
	}, [shouldVirtualize, isOnline, isSlowConnection, showReportButton, selectedMessageIds])

	// Auto scroll
	useEffect(() => {
		if (shouldVirtualize) {
			rowVirtualizer.scrollToIndex(Math.max(0, messages.length - 1), { align: 'end' })
		} else {
			bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages, isStreaming, shouldVirtualize])

	const handleScroll = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
		setShowScrollBtn(!isNearBottom)
	}, [])

	const handleCopy = useCallback((id: string, content: string) => {
		navigator.clipboard.writeText(content).then(() => {
			setCopiedId(id)
			setTimeout(() => setCopiedId(null), 2000)
		}).catch(() => {})
		onCopyMessage?.(content)
	}, [onCopyMessage])

	const handleReaction = useCallback((msgId: string, type: 'like' | 'dislike') => {
		setReactions(prev => {
			const current = prev[msgId]
			if (current === type) return { ...prev, [msgId]: null }
			return { ...prev, [msgId]: type }
		})
	}, [])

	const scrollToBottom = useCallback(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [])

	const startEdit = useCallback((msg: ChatMessage) => {
		setEditingId(msg.id)
		setEditContent(msg.content)
	}, [])

	const confirmEdit = useCallback(() => {
		if (editingId && editContent.trim()) onEditMessage?.(editingId, editContent.trim())
		setEditingId(null)
		setEditContent('')
	}, [editingId, editContent, onEditMessage])

	const cancelEdit = useCallback(() => {
		setEditingId(null)
		setEditContent('')
	}, [])

	// 网络恢复自动重试
	useEffect(() => {
		if (!isOnline || retryQueue.length === 0 || !onRetryMessage) return
		const timer = setTimeout(() => {
			retryQueue.forEach(item => onRetryMessage(item.id))
			setRetryQueue([])
		}, 1000)
		return () => clearTimeout(timer)
	}, [isOnline, retryQueue, onRetryMessage])

	const isHL = useCallback((id: string) => highlightedMessageId === id, [highlightedMessageId])
	const isSel = useCallback((id: string) => selectedMessageIds?.includes(id) ?? false, [selectedMessageIds])

	// 渲染消息列表（必须在所有条件 return 之前定义，遵守 React hooks 规则）
	const renderInner = useCallback((msg: ChatMessage, i: number) => (
		<MessageBubble
			msg={msg}
			index={i}
			allMessages={messages}
			isStreaming={isStreaming}
			reaction={reactions[msg.id]}
			searchQuery={undefined}
			editingId={editingId}
			editContent={editContent}
			setEditContent={setEditContent}
			onCopy={handleCopy}
			onReaction={handleReaction}
			copiedId={copiedId}
			onEdit={(id, content) => { const msg = messages.find(m => m.id === id); if (msg) startEdit(msg); setEditContent(content); }}
			onRetract={onRetractMessage ?? (() => {})}
			onDelete={onDeleteMessage ?? (() => {})}
			onReference={onReferenceMessage ?? (() => {})}
			onRegenerate={onRegenerate ?? (() => {})}
			onForkMessage={onForkMessage}
			onDetails={onDetailsMessage}
			thinkingSteps={(i === messages.length - 1 && msg.role === 'assistant' && thinkingSteps) ? thinkingSteps : undefined}
			isHighlighted={isHL(msg.id)}
			isSelected={isSel(msg.id)}
		/>
	), [messages, isStreaming, reactions, editingId, editContent, handleCopy, handleReaction, thinkingSteps, isHL, isSel, onRetractMessage, onDeleteMessage, onReferenceMessage, onRegenerate, onForkMessage, onDetailsMessage, startEdit])

	// 骨架屏
	if (messages.length === 0 && isLoading && !chatError) {
		return (
			<div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 chat-custom-scrollbar">
				<div className="chat-skeleton space-y-5 max-w-lg mx-auto">
					<div className="flex items-end gap-3 justify-end">
						<div className="flex flex-col items-end gap-2 flex-1 max-w-[75%]">
							<div className="skeleton-bubble skeleton-user h-10 w-[70%] rounded-2xl rounded-br-sm" />
						</div>
						<div className="skeleton-avatar w-9 h-9 rounded-full bg-neutral-300 animate-pulse" />
					</div>
					<div className="flex items-start gap-3">
						<div className="skeleton-avatar w-9 h-9 rounded-full bg-neutral-300 animate-pulse" />
						<div className="flex flex-col gap-2 flex-1 max-w-[80%]">
							<div className="skeleton-bubble skeleton-ai h-16 w-full rounded-2xl rounded-tl-sm" />
							<div className="skeleton-bubble skeleton-ai h-8 w-[60%] rounded-2xl rounded-tl-sm" />
						</div>
					</div>
					<div className="flex items-end gap-3 justify-end">
						<div className="flex flex-col items-end gap-2 flex-1 max-w-[65%]">
							<div className="skeleton-bubble skeleton-user h-7 w-[90%] rounded-2xl rounded-br-sm" />
						</div>
						<div className="skeleton-avatar w-9 h-9 rounded-full bg-neutral-300 animate-pulse" />
					</div>
				</div>
			</div>
		)
	}

	// 空状态
	if (messages.length === 0 && !chatError) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center px-4 py-8 space-y-6">
				<div className="text-center space-y-3">
					<div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 shadow-lg shadow-primary-300/40 dark:shadow-primary-900/30 flex items-center justify-center animate-pulse-slow">
						<Sparkles className="w-10 h-10 text-white drop-shadow-sm" />
					</div>
					<h3 className="text-lg font-semibold text-neutral-800">开始新对话</h3>
					<p className="text-sm text-neutral-500 max-w-md">输入您的问题或需求，AI 将为您提供专业的配方建议和分析。</p>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
					{QUICK_ACTIONS.map((action, i) => (
						<button key={i} className="group relative flex items-start gap-3 p-4 rounded-xl border border-neutral-200 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gradient-to-br hover:from-primary-50/60 hover:to-transparent dark:hover:from-primary-900/15 dark:hover:to-transparent transition-all duration-200 ease-out text-left hover:scale-[1.02] hover:shadow-md hover:shadow-primary-100/50 dark:hover:shadow-primary-900/20 active:scale-[0.98]">
							<div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color} bg-white dark:bg-neutral-800 shadow-sm`}>
								<action.Icon className="w-4 h-4" />
							</div>
							<div>
								<div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{action.title}</div>
								<div className="text-xs text-neutral-500 mt-0.5">{action.desc}</div>
							</div>
						</button>
					))}
				</div>
			</div>
		)
	}

	// 错误状态
	if (chatError) {
		return (
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="text-center space-y-3">
					<p className="text-error-600 dark:text-error-400 text-sm">{chatError.message}</p>
					{onRetry && (
						<button onClick={onRetry} className="text-xs flex items-center gap-1 hover:underline mx-auto">
							<RefreshCw className="w-3 h-3" /> 重新发送
						</button>
					)}
				</div>
			</div>
		)
	}

	if (shouldVirtualize) {
		return (
			<div className="flex-1 overflow-y-auto chat-custom-scrollbar relative" ref={scrollRef} onScroll={handleScroll}>
				<div
					ref={listContainerRef}
					style={{ height: rowVirtualizer.getTotalSize(), width: '100%', position: 'relative' }}
				>
					{rowVirtualizer.getVirtualItems().map((vi) => (
						<div
							key={vi.key}
							data-index={vi.index}
							ref={rowVirtualizer.measureElement}
							style={{
								position: 'absolute',
								top: 0, left: 0, width: '100%',
								transform: `translateY(${vi.start - rowVirtualizer.options.scrollMargin}px)`,
							}}
						>
							{renderInner(messages[vi.index], vi.index)}
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="flex-1 overflow-y-auto chat-custom-scrollbar" ref={scrollRef} onScroll={handleScroll}>
			<div ref={listContainerRef} />
			{messages.map((msg, i) => renderInner(msg, i))}

			{/* 流式加载指示器 */}
			{isStreaming && messages.length > 0 && !messages[messages.length - 1]?.isLoading && (
				<div className="chat-message-row">
					<div className="avatar-ai">
						<Bot className="w-4 h-4" />
						<span className="avatar-status-indicator avatar-status-thinking" />
					</div>
					<div className="chat-typing-indicator">
						<span className="chat-typing-dot" />
						<span className="chat-typing-dot" />
						<span className="chat-typing-dot" />
					</div>
				</div>
			)}

			<div ref={bottomRef} />

			{/* 跳到底部按钮 */}
			{showScrollBtn && (
				<button onClick={scrollToBottom}
					className="sticky bottom-3 left-1/2 -translate-x-1/2 min-h-[36px] px-4 py-2 rounded-full surface-overlay80 backdrop-blur-md border border-neutral-200/60/60 shadow-lg shadow-slate-200/50 dark:shadow-black/20 text-xs font-medium text-neutral-600 flex items-center gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:bg-white hover:border-primary-300/60 dark:hover:border-primary-600/40 active:translate-y-0 animate-fade-in"
				>
					<ChevronDown className="w-4 h-4" />
					<span>回到最新</span>
				</button>
			)}
		</div>
	)
}

export default MessageList
