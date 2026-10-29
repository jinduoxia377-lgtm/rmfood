/**
 * GroupChatView — 群聊工作台（DS Bot 移植 Phase 2 + v2 自主派单）
 *
 * - 消息流（用户消息 + Bot 回复/派单过程消息，显示发送者）
 * - @ 选择器（可选）：点选成员 Bot 后定向派单；不 @ 时触发 Chief 自主派单
 * - 异步派单：发送后立即返回 pending_message，前端每 3s 轮询消息流，
 *   子任务结果逐条出现，检测到【汇总】后停止轮询
 * - 成员管理（待完善项 2）：添加/移除群成员 Bot（Chief 不可移除）
 * - 消息引用（待完善项 3）：hover 消息可引用，发送带 reply_to
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Send, RefreshCw, Users, Pencil, X, Info, Search, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui';
import { BotAvatar } from './BotAvatar';
import { UserAvatar } from '@/components/ai/shared/UserAvatar';
import { cleanAgentContent } from '@/components/ai/shared/agentContent';
import MarkdownRenderer from '@/components/ai/features/components/pro/MarkdownRenderer';
import EnhancedContentRenderer from '@/components/ai/features/components/pro/EnhancedContentRenderer';
import { groupApi, botApi } from './api';
import type { Bot as BotType, GroupMessage, GroupSession } from './types';

interface GroupChatViewProps {
  group: GroupSession;
  bots: BotType[];
  onDeleted?: () => void;
  /** 任务状态（任务群传入：recruiting/dispatching/completed/failed/archived） */
  taskStatus?: string;
  /** 从群聊视图返回任务中心（TaskCenter 传入） */
  onBackToTasks?: () => void;
}

const POLL_INTERVAL_MS = 3000;

/** 结构化消息类型（专业群聊阶段 A） */
type StructuredMsgType = 'user' | 'plan' | 'recruit' | 'summary' | 'failure' | 'pending' | 'result';

function getMessageType(msg: GroupMessage): StructuredMsgType {
  if (msg.sender_type === 'user') return 'user';
  const c = msg.content || '';
  if (c.startsWith('【汇总】')) return 'summary';
  if (c.startsWith('【任务分配')) return 'plan';
  if (c.startsWith('【GitHub供给】') || c.startsWith('【招募】')) return 'recruit';
  if (c.startsWith('❌') || c.includes('执行失败') || c.includes('LLM调用失败')) return 'failure';
  if (c.startsWith('⏳')) return 'pending';
  return 'result';
}

/** 结构化消息类型小标签（统一气泡背景后，用标签保留语义区分）；labelKey 为 pages.agent 命名空间的 key 后缀 */
const MSG_TYPE_BADGE: Record<string, { labelKey: string; cls: string }> = {
  summary: { labelKey: 'groupMsgSummary', cls: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300' },
  plan: { labelKey: 'groupMsgPlan', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' },
  recruit: { labelKey: 'groupMsgRecruit', cls: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300' },
  failure: { labelKey: 'groupMsgFailure', cls: 'bg-destructive/10 text-destructive' },
  pending: { labelKey: 'groupMsgPending', cls: 'bg-muted text-muted-foreground' },
};

/** 任务状态 → pages.agent.taskStatus.* 的 key 后缀 */
const TASK_STATUS_KEY: Record<string, string> = {
  recruiting: 'taskStatus.recruiting',
  dispatching: 'taskStatus.dispatching',
  completed: 'taskStatus.completed',
  failed: 'taskStatus.failed',
  archived: 'taskStatus.archived',
};

export function GroupChatView({ group, bots, taskStatus, onBackToTasks }: GroupChatViewProps) {
  const { t } = useTranslation();
  /** 解析任务状态为本地化标签；未知状态回退原始值 */
  const taskStatusLabel = (status: string) =>
    TASK_STATUS_KEY[status] ? t(`pages.agent.${TASK_STATUS_KEY[status]}`) : status;
  // 本地群聊状态（成员管理后更新）
  const [groupState, setGroupState] = useState<GroupSession>(group);
  // 归档只读（阶段 C）
  const isArchived = Boolean(groupState.archived_at) || taskStatus === 'archived';

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [mentioned, setMentioned] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; content: string; senderName: string } | null>(null);

  // 当 group 切换时重置本地状态（React 推荐：render 期间调整，避免 effect 同步 setState）
  const [prevGroupId, setPrevGroupId] = useState<number | null>(null);
  if (group.id !== prevGroupId) {
    setPrevGroupId(group.id);
    setGroupState(group);
    setMessages([]);
    setReplyTo(null);
  }

  // 深度开发：专家详情 + 消息搜索
  const [botDetail, setBotDetail] = useState<BotType | null>(null);
  const [botDetailOpen, setBotDetailOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  // 放大/全屏状态：内容较多时铺满视口，减少上下翻动
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 已见消息 id 集合（去重）
  const seenIdsRef = useRef<Set<number>>(new Set());
  // 轮询定时器
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const botName = useCallback(
    (botId: number | null | undefined) => {
      if (!botId) return t('pages.agent.groupUnknownBot');
      return bots.find((b) => b.id === botId)?.name ?? `Bot#${botId}`;
    },
    [bots, t],
  );

  const botAvatar = useCallback((botId: number | null | undefined) => {
    if (!botId) return <BotAvatar size="sm" />;
    const bot = bots.find((b) => b.id === botId);
    return <BotAvatar bot={bot} size="sm" />;
  }, [bots]);

  // 成员名称缓存：临时专家/动态招募 Bot 不在 bots 列表时，按需拉取（P1-2）
  const [memberNameCache, setMemberNameCache] = useState<Record<number, string>>({});
  const resolveMemberName = useCallback((botId: number) => {
    const local = bots.find((b) => b.id === botId);
    if (local) return local.name;
    if (memberNameCache[botId]) return memberNameCache[botId];
    botApi.get(botId)
      .then((b) => setMemberNameCache((prev) => ({ ...prev, [botId]: b.name })))
      .catch(() => { /* 拉取失败回退 Bot#id */ });
    return `Bot#${botId}`;
  }, [bots, memberNameCache]);

  // 深度开发：派单进度条（基于消息流推断当前批次子任务完成数）
  const progress = useMemo(() => {
    if (messages.length === 0) return null;
    const planMsgs = messages.filter(
      (m) => m.sender_type === 'bot' && m.content.startsWith('【任务分配'),
    );
    if (planMsgs.length === 0) return null;
    const lastPlan = planMsgs[planMsgs.length - 1];
    const total = lastPlan.content
      .split('\n')
      .filter((l) => /^\d+\.\s/.test(l.trim())).length;
    if (total <= 0) return null;
    const planIndex = messages.indexOf(lastPlan);
    let endIndex = messages.length - 1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].content.startsWith('【汇总】')) {
        endIndex = i;
        break;
      }
    }
    const resultCount = messages.slice(planIndex + 1, endIndex).filter(
      (m) =>
        m.sender_type === 'bot' &&
        !m.content.startsWith('【') &&
        !m.content.startsWith('⏳') &&
        !m.content.startsWith('（'),
    ).length;
    return { total, done: Math.min(resultCount, total) };
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (!filterText.trim()) return messages;
    const kw = filterText.trim().toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(kw));
  }, [messages, filterText]);

  const openBotDetail = useCallback((botId: number) => {
    botApi.get(botId)
      .then((b) => {
        setBotDetail(b);
        setBotDetailOpen(true);
      })
      .catch(() => { /* 拉取失败忽略 */ });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setSending(false);
  }, []);

  const pollOnce = useCallback(async (groupId: number) => {
    try {
      const items = await groupApi.listMessages(groupId, 200);
      const seen = seenIdsRef.current;
      const fresh = items.filter((m) => !seen.has(m.id));
      if (fresh.length > 0) {
        fresh.forEach((m) => seen.add(m.id));
        setMessages((prev) => [...prev, ...fresh]);
        if (fresh.some((m) => m.content.startsWith('【汇总】'))) {
          stopPolling();
        }
      }
    } catch {
      // 轮询失败静默
    }
  }, [stopPolling]);

  const startPolling = useCallback((groupId: number) => {
    stopPolling();
    void pollOnce(groupId);
    pollingRef.current = setInterval(() => void pollOnce(groupId), POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const items = await groupApi.listMessages(group.id, 200);
      items.forEach((m) => seenIdsRef.current.add(m.id));
      setMessages(items);
      setError(null);
      // 自动轮询（v3.3+）：任务群/自主派单群打开后自动拉取派单过程。
      // 判断依据：最新一条“派单活动消息”（任务分配/组织团队）是否出现在最新【汇总】之后。
      // 这样即使历史已有【汇总】（重新派单场景），只要最新活动是派单就会继续轮询。
      const isPendingMsg = (m: GroupMessage) =>
        m.content.startsWith('⏳ Chief 正在组织团队') || m.content.startsWith('【任务分配');
      const reversed = [...items].reverse();
      const lastPendingIdx = reversed.findIndex(isPendingMsg);
      const lastSummaryIdx = reversed.findIndex((m) => m.content.startsWith('【汇总】'));
      // reverse 后索引越小越靠后；若最近的是派单活动（在最新汇总之后）则启动轮询
      if (lastPendingIdx !== -1 && (lastSummaryIdx === -1 || lastPendingIdx < lastSummaryIdx)) {
        startPolling(group.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.groupMessagesLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [group.id, startPolling]);

  useEffect(() => {
    let cancelled = false;
    // 可选链：测试/异常环境缺少 listMessages 时静默短路，不抛错
    groupApi.listMessages?.(group.id, 200)
      ?.then((items) => {
        if (cancelled) return;
        items.forEach((m) => seenIdsRef.current.add(m.id));
        setMessages(items);
        setError(null);
        // 自动轮询（v3.3+）：任务群/自主派单群打开后自动拉取派单过程。
        // 判断依据：最新一条“派单活动消息”（任务分配/组织团队）是否出现在最新【汇总】之后。
        const isPendingMsg = (m: GroupMessage) =>
          m.content.startsWith('⏳ Chief 正在组织团队') || m.content.startsWith('【任务分配');
        const reversed = [...items].reverse();
        const lastPendingIdx = reversed.findIndex(isPendingMsg);
        const lastSummaryIdx = reversed.findIndex((m) => m.content.startsWith('【汇总】'));
        // reverse 后索引越小越靠后；若最近的是派单活动（在最新汇总之后）则启动轮询
        if (lastPendingIdx !== -1 && (lastSummaryIdx === -1 || lastPendingIdx < lastSummaryIdx)) {
          startPolling(group.id);
        }
      })
      ?.catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('pages.agent.groupMessagesLoadFailed'));
      })
      ?.finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, startPolling]);

  const toggleMention = (botId: number) => {
    setMentioned((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId],
    );
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await groupApi.postMessage(group.id, {
        content,
        mentioned_bot_ids: mentioned.length > 0 ? mentioned : undefined,
        reply_to: replyTo?.id ?? null,
      });
      const d = result.data;
      const fresh: GroupMessage[] = [d.user_message];
      if (d.pending_message) fresh.push(d.pending_message);
      if (d.replies && d.replies.length > 0) fresh.push(...d.replies);
      fresh.forEach((m) => seenIdsRef.current.add(m.id));
      setMessages((prev) => [...prev, ...fresh]);
      setInput('');
      setMentioned([]);
      setReplyTo(null);
      if (d.async) {
        startPolling(group.id);
      } else {
        setSending(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.groupSendFailed'));
      setSending(false);
    }
  };

  // ── 成员管理 ──
  const memberBots = groupState.members
    .map((m) => bots.find((b) => b.id === m.bot_id))
    .filter((b): b is BotType => Boolean(b));

  const nonMemberBots = bots.filter((b) => !groupState.members.some((m) => m.bot_id === b.id) && !b.is_chief);

  const handleAddMember = async (botId: number) => {
    try {
      await groupApi.addMembers(group.id, [botId]);
      const latest = await groupApi.get(group.id);
      setGroupState(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.groupAddMemberFailed'));
    }
  };

  const handleRemoveMember = async (botId: number) => {
    try {
      await groupApi.removeMember(group.id, botId);
      const latest = await groupApi.get(group.id);
      setGroupState(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.groupRemoveMemberFailed'));
    }
  };

  const senderName = (msg: GroupMessage): string =>
    msg.sender_type === 'user'
      ? t('pages.agent.groupMe')
      : msg.sender_bot_name || botName(msg.sender_bot_id);

  const chatContent = (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-[2000] flex flex-col bg-[var(--bg-canvas)]'
          : 'flex h-full flex-col'
      }
      data-testid={expanded ? 'group-chat-expanded' : 'group-chat'}
    >
      {/* 群聊头 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {onBackToTasks && (
            <Button variant="ghost" size="sm" onClick={onBackToTasks} aria-label={t('pages.agent.groupBackToTasks')} title={t('pages.agent.groupBackToTasks')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-100 dark:bg-secondary-950">
            <Users className="h-4 w-4 text-secondary-600" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{groupState.name}</div>
            <div className="text-xs text-muted-foreground">
              {t('pages.agent.groupAdminInfo', { name: botName(groupState.chief_bot_id), count: groupState.members.length })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {taskStatus && TASK_STATUS_KEY[taskStatus] && (
            <Badge
              variant={taskStatus === 'failed' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {taskStatusLabel(taskStatus)}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => setMemberOpen(true)}>
            <Users className="mr-1 h-4 w-4" /> {t('pages.agent.groupMemberBtn')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void loadMessages()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            data-testid="group-chat-expand"
            aria-label={expanded ? t('pages.agent.groupExitFullscreen') : t('pages.agent.groupExpandTitle')}
            title={expanded ? t('pages.agent.groupExitFullscreen') : t('pages.agent.groupExpandTitle')}
          >
            {expanded ? (
              <Minimize2 className="mr-1 h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            {expanded ? t('pages.agent.groupExitFullscreen') : t('pages.agent.groupExpand')}
          </Button>
        </div>
      </div>

      {/* 派单进度条（深度开发 D-1） */}
      {progress && (taskStatus === 'recruiting' || taskStatus === 'dispatching') && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
          <span className="text-xs text-muted-foreground">{t('pages.agent.groupProgress')}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}

      {/* 消息区 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
        {/* 消息搜索（深度开发 D-3） */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('pages.agent.groupSearchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="space-y-3">
          {visibleMessages.map((msg) => {
            const isUser = msg.sender_type === 'user';
            const msgType = getMessageType(msg);
            // 统一气泡背景：用户=品牌实底白字，Bot=白底/暗底+边框（语义用小标签区分）
            const cardClass = isUser
              ? 'surface-primary'
              : 'border border-border bg-white dark:bg-neutral-800 text-foreground';
            const typeBadge = !isUser ? MSG_TYPE_BADGE[msgType] : null;
            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
                data-testid={`group-msg-${isUser ? 'user' : 'bot'}`}
              >
                {/* 专用头像：用户账户头像 / 专家 BotAvatar */}
                {isUser ? <UserAvatar /> : botAvatar(msg.sender_bot_id)}
                <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
                  <div className={`mb-0.5 flex items-center gap-1 text-xs text-muted-foreground ${isUser ? 'justify-end' : ''}`}>
                    <span>{senderName(msg)}</span>
                    {typeBadge && (
                      <span className={`rounded px-1 py-0.5 text-xs font-medium ${typeBadge.cls}`}>{t(`pages.agent.${typeBadge.labelKey}`)}</span>
                    )}
                    {!isUser && msg.task_execution_id && (
                      <Badge variant="secondary" className="text-xs">{t('pages.agent.groupDispatched')}</Badge>
                    )}
                    {/* 查看专家详情（深度开发 D-2） */}
                    {!isUser && msg.sender_bot_id && (
                      <button
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => openBotDetail(msg.sender_bot_id as number)}
                        title={t('pages.agent.groupViewExpert')}
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    )}
                    {/* 引用按钮 */}
                    <button
                      className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setReplyTo({ id: msg.id, content: msg.content, senderName: senderName(msg) })}
                      title={t('pages.agent.groupReplyTitle')}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  {/* 内容：用户消息纯文本；Bot 消息专业 Markdown + 配方结构化增强 */}
                  {isUser ? (
                    <div
                      className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${cardClass}`}
                    >
                      {cleanAgentContent(msg.content)}
                    </div>
                  ) : (
                    <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${cardClass}`}>
                      <EnhancedContentRenderer content={msg.content}>
                        <MarkdownRenderer content={msg.content} />
                      </EnhancedContentRenderer>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && !loading && (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {t('pages.agent.groupReady', { chief: botName(groupState.chief_bot_id) })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* @ 选择器（可选定向） */}
      {memberBots.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 pt-2">
          <span className="text-xs text-muted-foreground">{t('pages.agent.groupAtSelector')}</span>
          {memberBots.map((bot) => {
            const active = mentioned.includes(bot.id);
            return (
              <button
                key={bot.id}
                onClick={() => toggleMention(bot.id)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  active
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950'
                    : 'border-border text-muted-foreground hover:border-primary-300'
                }`}
              >
                {bot.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 引用提示条 */}
      {replyTo && (
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="truncate text-muted-foreground">
            {t('pages.agent.groupReplyPrefix', { name: replyTo.senderName })}{replyTo.content.slice(0, 60)}
          </span>
          <button onClick={() => setReplyTo(null)} className="ml-2 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={isArchived ? t('pages.agent.groupArchivedPlaceholder') : t('pages.agent.groupPlaceholder', { chief: botName(groupState.chief_bot_id) })}
          aria-label={t('pages.agent.groupInputAria')}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
          rows={2}
          maxLength={4000}
          disabled={isArchived}
          data-testid="group-input"
        />
        <Button onClick={() => void handleSend()} disabled={isArchived || sending || !input.trim()}>
          <Send className="mr-1 h-4 w-4" aria-hidden="true" /> {isArchived ? t('pages.agent.botArchived') : sending ? t('pages.agent.groupSending') : t('pages.agent.groupSend')}
        </Button>
      </div>

      {/* 成员管理对话框 */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pages.agent.groupMemberTitle')}</DialogTitle>
            <DialogDescription>{t('pages.agent.groupMemberDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">{t('pages.agent.groupMemberCurrent')}</div>
              {groupState.members.map((m) => {
                const b = bots.find((x) => x.id === m.bot_id);
                return (
                  <div key={m.bot_id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <BotAvatar bot={b} size="sm" />
                      <span>{resolveMemberName(m.bot_id)}</span>
                      {m.role === 'admin' && <Badge variant="secondary" className="text-xs">{t('pages.agent.groupMemberAdmin')}</Badge>}
                    </div>
                    {m.role !== 'admin' && (
                      <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void handleRemoveMember(m.bot_id)}>
                        {t('pages.agent.groupMemberRemove')}
                      </button>
                    )}
                  </div>
                );
              })}
              {groupState.members.length === 0 && (
                <div className="text-xs text-muted-foreground">{t('pages.agent.groupMemberEmpty')}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">{t('pages.agent.groupMemberAdd')}</div>
              {nonMemberBots.length === 0 && (
                <div className="text-xs text-muted-foreground">{t('pages.agent.groupMemberNoAdd')}</div>
              )}
              <div className="flex flex-wrap gap-2">
                {nonMemberBots.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => void handleAddMember(b.id)}
                    className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary-300 hover:text-foreground"
                  >
                    + {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setMemberOpen(false)}>{t('pages.agent.groupClose')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 专家详情对话框（深度开发 D-2） */}
      <Dialog open={botDetailOpen} onOpenChange={setBotDetailOpen}>
        <DialogContent className="sm:max-w-md">
          {botDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BotAvatar bot={botDetail} size="sm" />
                  {botDetail.name}
                  {botDetail.is_chief && <Badge>Chief</Badge>}
                </DialogTitle>
                <DialogDescription>{botDetail.description || t('pages.agent.groupNoDesc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-6 py-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{t('pages.agent.groupCapabilities')}</div>
                  <div className="flex flex-wrap gap-1">
                    {(botDetail.capabilities || []).map((cap) => (
                      <span key={cap} className="rounded bg-background px-1.5 py-0.5 text-xs text-foreground">
                        {cap}
                      </span>
                    ))}
                    {(!botDetail.capabilities || botDetail.capabilities.length === 0) && (
                      <span className="text-xs text-muted-foreground">{t('pages.agent.groupCapabilityNone')}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{t('pages.agent.groupPersona')}</div>
                  <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                    {botDetail.persona_prompt}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setBotDetailOpen(false)}>{t('pages.agent.groupClose')}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // 放大/全屏：通过 Portal 渲染到 body，逃出 main 的堆叠上下文，覆盖整个视口
  if (expanded) {
    return createPortal(chatContent, document.body);
  }
  return chatContent;
}