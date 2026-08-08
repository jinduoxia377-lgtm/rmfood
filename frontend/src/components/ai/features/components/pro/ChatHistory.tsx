/**
 * ChatHistory — 对话历史侧栏
 *
 * 管理历史会话：新建、切换、重命名、删除
 * 数据持久化到 localStorage
 */
import React, { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Plus, Trash2, Edit2, Check, X, Clock } from 'lucide-react'

export interface HistorySession {
  id: string
  title: string
  messageCount: number
  lastMessage: string
  timestamp: number
}

interface ChatHistoryProps {
  sessions: HistorySession[]
  activeSessionId: string | null
  onNewChat: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  isVisible: boolean
  onToggle: () => void
}

const STORAGE_KEY = 'chat_history_sessions'

// 持久化工具
export function saveSessions(sessions: HistorySession[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)) } catch {}
}
export function loadSessions(): HistorySession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export default function ChatHistory({
  sessions, activeSessionId, onNewChat, onSelectSession,
  onDeleteSession, onRenameSession, isVisible, onToggle,
}: ChatHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startRename = useCallback((id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }, [])

  const confirmRename = useCallback((id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim())
    }
    setEditingId(null)
  }, [editTitle, onRenameSession])

  const sortedSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp)

  if (!isVisible) return null

  return (
    <div className="w-60 border-r border-neutral-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-900/80 flex flex-col flex-shrink-0">
      {/* 头部 */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            对话历史
          </h3>
          <button onClick={onNewChat}
            className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 transition-colors"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sortedSessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-6 h-6 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-[11px] text-neutral-400">暂无历史对话</p>
          </div>
        ) : (
          sortedSessions.map(session => {
            const isActive = session.id === activeSessionId
            const isEditing = editingId === session.id

            return (
              <div
                key={session.id}
                className={`group relative rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                }`}
              >
                {isEditing ? (
                  /* 编辑模式 */
                  <div className="p-2 flex items-center gap-1">
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmRename(session.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-primary-400"
                      autoFocus
                    />
                    <button onClick={() => confirmRename(session.id)} className="p-0.5 text-success-500 hover:text-success-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingId(null)} className="p-0.5 text-neutral-400 hover:text-neutral-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  /* 显示模式 */
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full text-left p-2"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isActive ? 'text-primary-500' : 'text-neutral-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                          {session.title || '新对话'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span className="text-[10px] text-neutral-400">{formatTime(session.timestamp)}</span>
                          <span className="text-[10px] text-neutral-300">·</span>
                          <span className="text-[10px] text-neutral-400">{session.messageCount}条</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* 操作按钮（hover 显示） */}
                {!isEditing && (
                  <div className={`absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity${'ontouchstart' in window ? ' !opacity-100' : ''}`}>
                    <button onClick={() => startRename(session.id, session.title)}
                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600"
                    ><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => onDeleteSession(session.id)}
                      aria-label="删除对话"
                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-error-500"
                    ><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
