/**
 * SessionHistory - 会话历史列表组件
 *
 * 职责：
 * - 显示用户的对话会话列表
 * - 支持搜索和筛选会话
 * - 支持打开、删除会话操作
 * - 显示会话基本信息（标题、消息数量、最后更新时间）
 * - Material Design 3 风格的卡片设计
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, Trash2, Plus, Clock, FileText, ChevronRight, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import type { ChatSession } from '@/api/chat';


import { logger } from '@/utils/safeLogger';
// ===== 类型定义 =====

export interface SessionHistoryProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onOpenSession: (sessionId: number) => void;
  onCreateSession: (title: string) => void;
  onDeleteSession: (sessionId: number) => void;
  onLoadSessions: () => void;
}

// ===== 辅助函数 =====

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return '今天';
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else if (days < 30) {
    return `${Math.floor(days / 7)}周前`;
  } else if (days < 365) {
    return `${Math.floor(days / 30)}个月前`;
  } else {
    return `${Math.floor(days / 365)}年前`;
  }
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ===== 会话卡片组件 =====

const SessionCard: React.FC<{
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ session, isActive, onClick, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className={clsx(
        'group relative p-4 rounded-xl cursor-pointer transition-all duration-200',
        'border-2',
        isActive
          ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/20'
          : 'border-transparent bg-slate-50/50 dark:bg-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700',
        'hover:shadow-md',
        'animate-fade-in',
      )}
       role="button" tabIndex={0} onClick={onClick}
    >
      {/* 内容区域 */}
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            isActive ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
          )}
        >
          <MessageSquare className="w-5 h-5" />
        </div>

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <h3
            className={clsx(
              'text-sm font-medium truncate',
              isActive ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-800 dark:text-neutral-200',
            )}
          >
            {session.title || '未命名会话'}
          </h3>

          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <FileText className="w-3 h-3" />
              {session.message_count} 条消息
            </span>
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="w-3 h-3" />
              {formatDate(session.updated_at)} {formatTime(session.updated_at)}
            </span>
          </div>

          {/* 标签显示 */}
          {session.tags && session.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.tags.slice(0, 3).map((tag: any, index: any) => (
                <span
                  key={index}
                  className="px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-700 rounded-full text-neutral-500"
                >
                  {tag}
                </span>
              ))}
              {session.tags.length > 3 && (
                <span className="px-2 py-0.5 text-xs text-neutral-400">+{session.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* 箭头和删除按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleDeleteClick}
            className={clsx(
              'p-2 rounded-lg opacity-0 group-hover:opacity-100',
              'hover:bg-error-50 dark:hover:bg-error-900/30',
              'transition-all duration-200',
            )}
            title="删除会话"
            aria-label="删除此会话"
          >
            <Trash2 className="w-4 h-4 text-error-500" />
          </button>
          <ChevronRight
            className={clsx(
              'w-4 h-4 transition-transform duration-200',
              isActive ? 'text-primary-500' : 'text-neutral-300 group-hover:text-neutral-400',
            )}
          />
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-50"  role="button" tabIndex={0} onClick={handleCancelDelete} />
          <div className="absolute z-50 right-0 top-full mt-2 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-3 min-w-[200px]">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">确定要删除此会话吗？</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-3 py-1.5 text-xs bg-error-500 text-white rounded-lg hover:bg-error-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ===== 主组件 =====

export function SessionHistory({
  sessions,
  currentSessionId,
  onOpenSession,
  onCreateSession,
  onDeleteSession,
  onLoadSessions,
}: SessionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      await onLoadSessions();
    } catch (error) {
      logger.error('加载会话列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onLoadSessions]);

  const handleCreateSession = () => {
    const title = prompt('请输入新会话标题:', '新对话');
    if (title && title.trim()) {
      onCreateSession(title.trim());
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title.toLowerCase().includes(query) || session.tags?.some((tag: any) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="h-full flex flex-col">
      {/* 头部区域 */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            会话历史
          </h2>
          <button
            onClick={handleCreateSession}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            title="创建新会话"
          >
            <Plus className="w-4 h-4" />
            新会话
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-700 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-neutral-800 dark:text-neutral-200 placeholder-slate-400"
          />
        </div>
      </div>

      {/* 会话列表区域 */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && filteredSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">暂无会话</p>
            <p className="text-xs mt-1">点击上方按钮创建新会话</p>
          </div>
        )}

        {!isLoading &&
          filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isActive={currentSessionId === session.id.toString()}
              onClick={() => onOpenSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
      </div>

      {/* 底部统计 */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-xs text-neutral-400 text-center">共 {sessions.length} 个会话</p>
      </div>
    </div>
  );
}

export default React.memo(SessionHistory);
