/**
 * BotChatMessageList — 专家独立对话框消息列表（对话内容专业渲染版）
 *
 * 参照「研发助手」对话框设计：
 * 1. 头像：专家复用 BotAvatar（品牌渐变 + 角色图标），用户头像实时同步「用户账户」头像；
 * 2. 内容：AI 消息启用专业 Markdown 渲染（标题/表格/列表/代码块/Callout），
 *    并叠加 EnhancedContentRenderer 自动识别配方结构化段落（君臣佐使/功效占比/配方特色），
 *    用户消息保持纯文本；流式阶段内容由父级逐块追加，直接增量渲染；
 * 3. 字体/气泡：正文 14px + 宽松行高，用户气泡 surface-primary 实底白字，AI 气泡白底/暗底 + 边框。
 */
import { Loader2, Copy } from 'lucide-react';
import { BotAvatar } from './BotAvatar';
import { UserAvatar } from '@/components/ai/shared/UserAvatar';
import { cleanAgentContent } from '@/components/ai/shared/agentContent';
import MarkdownRenderer from '@/components/ai/features/components/pro/MarkdownRenderer';
import EnhancedContentRenderer from '@/components/ai/features/components/pro/EnhancedContentRenderer';
import type { Bot as BotType, BotChatMessage } from './types';

interface BotChatMessageListProps {
  bot: BotType;
  messages: BotChatMessage[];
  isStreaming: boolean;
  onCopyMessage?: (content: string) => void;
}

export function BotChatMessageList({ bot, messages, isStreaming, onCopyMessage }: BotChatMessageListProps) {
  // 空状态
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 flex items-center justify-center mb-4">
          <BotAvatar bot={bot} size="md" />
        </div>
        <p className="text-lg font-medium text-foreground">开始与 {bot.name} 对话</p>
        <p className="text-sm mt-2 text-muted-foreground">输入您的问题或需求，AI 将为您提供专业的配方建议和分析。</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4 chat-custom-scrollbar">
      <div className="space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const time = msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={msg.id}
              data-testid={isUser ? 'bot-chat-msg-user' : 'bot-chat-msg-assistant'}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* 专用头像 */}
              {isUser ? <UserAvatar /> : <BotAvatar bot={bot} size="sm" />}

              {/* 气泡容器：flex-1 占满剩余宽度 */}
              <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
                {/* 消息气泡 */}
                <div
                  className={`group relative max-w-[80%] rounded-xl px-4 py-2.5 ${
                    isUser
                      ? 'surface-primary'
                      : 'border border-border bg-white dark:bg-neutral-800'
                  }`}
                >
                  {/* 复制按钮（AI 消息悬浮显示） */}
                  {!isUser && onCopyMessage && msg.content && !msg.isLoading && (
                    <button
                      type="button"
                      onClick={() => onCopyMessage(msg.content)}
                      className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:flex group-hover:opacity-100"
                      title="复制内容"
                      aria-label="复制内容"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

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

                  {/* 流式加载指示 */}
                  {msg.isLoading && !msg.content && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>{isUser ? '发送中…' : '正在生成…'}</span>
                    </div>
                  )}

                  {/* 错误提示 */}
                  {msg.error && (
                    <div className="mt-1 text-xs text-error-600" role="alert">
                      生成失败：{msg.error}
                    </div>
                  )}

                  {/* 时间戳（气泡内右下角小字） */}
                  {time && (
                    <div
                      className={`mt-1 text-right text-xs leading-none ${
                        isUser ? 'text-white/80' : 'text-muted-foreground'
                      }`}
                    >
                      {time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 运行中指示器 */}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{bot.name} 正在思考...</span>
          </div>
        )}
      </div>
    </div>
  );
}