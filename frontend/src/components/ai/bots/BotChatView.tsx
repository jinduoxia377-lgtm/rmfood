/**
 * BotChatView — 与单个具名 Bot 持续会话（DS Bot 移植）
 *
 * 消息区使用 BotChatMessageList（参照研发助手对话框设计：专家/用户专用头像、
 * Markdown 清洗、规范字体气泡），输入区复用 Pro ChatInput，
 * 通过 botChatService 走 /ai/chat/stream（携带 bot_id，后端注入人设+记忆+模型覆盖）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { BotAvatar } from './BotAvatar';
import { BotChatMessageList } from './BotChatMessageList';
import ChatInput from '@/components/ai/features/components/pro/ChatInput';
import { botChatStream } from './botChatService';
import { botApi } from './api';
import type { Bot as BotType, BotChatMessage } from './types';

interface BotChatViewProps {
  bot: BotType;
  onOpenDetail: () => void;
}

export function BotChatView({ bot, onOpenDetail }: BotChatViewProps) {
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState<string | undefined>(bot.model_id || undefined);
  // 放大/全屏状态：内容较多时铺满视口，减少上下翻动
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  // 切换 Bot 时清空会话（React 推荐：render 期间调整状态，避免 effect 同步 setState）
  const [prevBotId, setPrevBotId] = useState<number | null>(null);
  if (bot.id !== prevBotId) {
    setPrevBotId(bot.id);
    setMessages([]);
    setModel(bot.model_id || undefined);
  }

  // 加载该 Bot 的持续会话历史（待完善项 4）
  useEffect(() => {
    let cancelled = false;

    botApi.getHistory(bot.id)
      .then((items) => {
        if (cancelled) return;
        const history: BotChatMessage[] = items.map((m) => ({
          id: `h-${m.id}`,
          role: m.sender_type === 'user' ? 'user' : 'assistant',
          content: m.content,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
          model: m.sender_bot_id ? undefined : undefined,
        }));
        setMessages(history);
      })
      .catch(() => { /* 历史加载失败不阻塞 */ });

    return () => {
      cancelled = true;
    };
  }, [bot.id]);

  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  const buildHistory = useCallback((): Array<{ role: string; content: string }> => {
    return messages
      .filter((m) => m.role !== 'system' && !m.isLoading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    const userMsg: BotChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    const assistantMsg: BotChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    const history = buildHistory();
    abortRef.current = botChatStream(
      bot.id,
      question,
      history,
      {
        onMeta: (m) => setModel(m),
        onContent: (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, content: msg.content + chunk, isLoading: false }
                : msg,
            ),
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id ? { ...msg, isLoading: false } : msg,
            ),
          );
          setIsStreaming(false);
        },
        onError: (err) => {
          setIsStreaming(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id
                ? { ...msg, content: msg.content || '（生成失败）', isLoading: false, error: err.message }
                : msg,
            ),
          );
        },
      },
    );
  }, [input, isStreaming, bot.id, buildHistory]);

  // 会话主体（头部 + 消息区 + 输入区），普通态与全屏态共用
  const chatBody = (
    <>
      {/* 会话头部 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <BotAvatar bot={bot} size="sm" />
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {bot.name}
              {bot.is_chief && (
                <Badge className="gap-1 bg-primary-600 text-[10px]">
                  <Sparkles className="h-3 w-3" /> Chief
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {model || '跟随全局模型'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onOpenDetail}>
            详情 / 记忆
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            data-testid="bot-chat-expand"
            aria-label={expanded ? '退出全屏' : '放大对话框'}
            title={expanded ? '退出全屏' : '放大对话框'}
          >
            {expanded ? (
              <Minimize2 className="mr-1 h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            {expanded ? '退出全屏' : '放大'}
          </Button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex min-h-[120px] flex-1">
        <BotChatMessageList
          bot={bot}
          messages={messages}
          isStreaming={isStreaming}
          onCopyMessage={(content) => navigator.clipboard?.writeText(content)}
        />
      </div>

      {/* 输入区 */}
      <div className="border-t border-border p-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => void handleSend()}
          onStop={() => abortRef.current?.()}
          isStreaming={isStreaming}
          placeholder={`向 ${bot.name} 提问…`}
          maxLength={2000}
        />
      </div>
    </>
  );

  // 放大/全屏：通过 Portal 渲染到 body，逃出 main 的堆叠上下文，覆盖整个视口
  if (expanded) {
    return createPortal(
      <div
        className="fixed inset-0 z-[2000] flex flex-col bg-[var(--bg-canvas)]"
        data-testid="bot-chat-expanded"
      >
        {chatBody}
      </div>,
      document.body,
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="bot-chat">
      {chatBody}
    </div>
  );
}