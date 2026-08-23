/**
 * Agent 消息列表组件
 *
 * 统一的消息展示，支持用户/助手消息、执行状态指示
 */
import React from 'react';
import type { AgentMessage } from './types';
import { Bot, User, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface AgentMessageListProps {
  messages: AgentMessage[];
  isRunning?: boolean;
  executedCount?: number;
}

export function AgentMessageList({
  messages,
  isRunning = false,
  executedCount = 0,
}: AgentMessageListProps) {
  if (messages.length === 0 && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
        <Bot className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">开始新的对话</p>
        <p className="text-sm mt-2">输入您的问题，AI Agent 将自动调用工具完成分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-3 ${
            msg.role === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          {/* 头像 */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-200 dark:bg-neutral-700'
            }`}
          >
            {msg.role === 'user' ? (
              <User className="w-5 h-5" />
            ) : (
              <Bot className="w-5 h-5" />
            )}
          </div>

          {/* 消息内容 */}
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            {msg.executionId && (
              <div className="mt-1 text-xs opacity-70">
                执行ID: {msg.executionId.slice(0, 8)}...
              </div>
            )}
          </div>

          {/* 时间戳 */}
          <span className="text-xs text-neutral-400 flex-shrink-0">
            {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}

      {/* 运行中指示器 */}
      {isRunning && (
        <div className="flex items-center gap-2 text-neutral-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Agent 正在执行...</span>
        </div>
      )}

      {/* 执行统计 */}
      {executedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 pt-2 border-t">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span>已完成 {executedCount} 次执行</span>
        </div>
      )}
    </div>
  );
}
