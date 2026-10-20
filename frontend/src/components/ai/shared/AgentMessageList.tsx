/**
 * Agent 消息列表组件（对话内容专业渲染版）
 *
 * 规范：
 * 1. 头像：AI 员工使用「真实 AI 头像」（复用项目 AI 真实人脸生成能力，会话内缓存），
 *    用户头像实时同步「用户账户」中的头像（useAuthStore + resolveAvatarUrl），
 *    未设置时回退到用户名首字母渐变头像；
 * 2. 内容：AI 消息启用专业 Markdown 渲染（标题/表格/列表/代码块/Callout），
 *    并叠加 EnhancedContentRenderer 自动识别配方结构化段落（君臣佐使/功效占比/配方特色），
 *    用户消息保持纯文本；
 * 3. 字体：统一正文 14px + 宽松行高，消息气泡带边框/品牌实底，层级清晰。
 */
import React from 'react';
import type { AgentMessage } from './types';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { RealAIAvatar } from './RealAIAvatar';
import { UserAvatar } from './UserAvatar';
import { cleanAgentContent } from './agentContent';
import MarkdownRenderer from '@/components/ai/features/components/pro/MarkdownRenderer';
import EnhancedContentRenderer from '@/components/ai/features/components/pro/EnhancedContentRenderer';

interface AgentMessageListProps {
  messages: AgentMessage[];
  isRunning?: boolean;
  executedCount?: number;
  'data-testid'?: string;
}

export function AgentMessageList({
  messages,
  isRunning = false,
  executedCount = 0,
  'data-testid': dataTestId,
}: AgentMessageListProps) {
  if (messages.length === 0 && !isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400 dark:text-neutral-400">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center mb-4">
          <RealAIAvatar size="md" />
        </div>
        <p className="text-lg font-medium">开始新的对话</p>
        <p className="text-sm mt-2">输入您的问题，AI Agent 将自动调用工具完成分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid={dataTestId}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            data-testid={isUser ? 'user-message' : 'assistant-message'}
            className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
          >
            {/* 专用头像 */}
            {isUser ? <UserAvatar /> : <RealAIAvatar size="sm" />}

            {/* 气泡容器：flex-1 占满剩余宽度 */}
            <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
              {/* 消息气泡 */}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                  isUser
                    ? 'surface-primary'
                    : 'border border-border bg-white dark:bg-neutral-800'
                }`}
              >
                {/* 内容：用户消息纯文本；AI 消息专业 Markdown + 配方结构化增强 */}
                {isUser ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
                    {cleanAgentContent(msg.content)}
                  </p>
                ) : (
                  <div className="text-sm leading-relaxed text-foreground">
                    <EnhancedContentRenderer content={msg.content}>
                      <MarkdownRenderer content={msg.content} />
                    </EnhancedContentRenderer>
                  </div>
                )}
                {msg.executionId && (
                  <div className={`mt-1 text-xs opacity-70 ${isUser ? 'text-white/80' : 'text-muted-foreground'}`}>
                    执行ID: {msg.executionId.slice(0, 8)}...
                  </div>
                )}
                {/* 时间戳（气泡内右下角小字） */}
                <div
                  className={`mt-1 text-right text-[10px] leading-none ${
                    isUser ? 'text-white/80' : 'text-muted-foreground'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* 运行中指示器 */}
      {isRunning && (
        <div className="flex items-center gap-2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Agent 正在执行...</span>
        </div>
      )}

      {/* 执行统计 */}
      {executedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] pt-2 border-t">
          <CheckCircle2 className="w-3 h-3 text-success-500" />
          <span>已完成 {executedCount} 次执行</span>
        </div>
      )}
    </div>
  );
}
