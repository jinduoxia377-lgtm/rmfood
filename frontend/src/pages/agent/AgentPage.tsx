/**
 * 多智能体协作中心（DS Bot 移植 Phase 1 + Phase 2）
 *
 * - Bot 列表：管理具名智能体（创建/详情/记忆/删除），与单个 Bot 持续会话
 * - Chief 控制台：复用 AgentWorkflowTab（工作流执行/派单），作为主控 Bot 的工作台
 * - 群聊协作：多 Bot 分工协作，@ 定向派单，Chief 默认统筹（Phase 2）
 *
 * 评审 R1/S6：AgentWorkflowTab 组件保留并迁移到本页，/ai 的 Agent Tab 已收敛移除。
 *
 * UI 规范（对齐 DashboardPage）：
 * - 页面根节点：max-w-[1600px] 居中 + space-y-4 垂直节奏 + bg-grid 点阵底（MainLayout 提供）
 * - 欢迎横幅：surface-primary 实底 + 圆角 + 内嵌「胶囊视图切换 + ghost 按钮」快速操作栏
 * - 数据条/卡片：rounded-[var(--radius-Apple-md)] border border-border bg-card
 * - 图标：统一 lucide-react 语义图标，禁止 Emoji 表情包
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  ArrowLeft,
  LayoutGrid,
  Workflow,
  Users,
  FolderKanban,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { BotList, BotChatView, BotDetailDrawer, GroupChatPanel, TaskCenter, usageApi } from '@/components/ai/bots';
import { AgentWorkflowTab } from '@/components/ai/features/AgentWorkflowTab';
import { botApi } from '@/components/ai/bots';
import type { Bot as BotType } from '@/components/ai/bots/types';
import { logger } from '@/utils/safeLogger';

type View = 'bots' | 'chief' | 'groups' | 'tasks';

const NAV_ITEMS: { view: View; labelKey: string; icon: LucideIcon; testId: string }[] = [
  { view: 'bots', labelKey: 'pages.agent.navBots', icon: LayoutGrid, testId: 'agent-nav-bots' },
  { view: 'chief', labelKey: 'pages.agent.navChief', icon: Workflow, testId: 'agent-nav-chief' },
  { view: 'groups', labelKey: 'pages.agent.navGroups', icon: Users, testId: 'agent-nav-groups' },
  { view: 'tasks', labelKey: 'pages.agent.navTasks', icon: FolderKanban, testId: 'agent-nav-tasks' },
];

export default function AgentPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('bots');
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState<BotType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Phase 3：用量概览
  const [usage, setUsage] = useState<{ todayTokens: number; todayCalls: number; weekTokens: number } | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      const data = await usageApi.stats();
      setUsage({
        todayTokens: data.today?.total_tokens ?? 0,
        todayCalls: data.today?.calls ?? 0,
        weekTokens: data.week?.total_tokens ?? 0,
      });
    } catch {
      // 用量统计失败不阻塞页面
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    usageApi.stats()
      .then((data) => {
        if (cancelled) return;
        setUsage({
          todayTokens: data.today?.total_tokens ?? 0,
          todayCalls: data.today?.calls ?? 0,
          weekTokens: data.week?.total_tokens ?? 0,
        });
      })
      .catch(() => { /* 用量统计失败不阻塞页面 */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBots = useCallback(async () => {
    setLoading(true);
    try {
      const data = await botApi.list({ limit: 200 });
      setBots(data.items);
    } catch (e) {
      logger.error('加载 Bot 列表失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    botApi.list({ limit: 200 })
      .then((data) => {
        if (!cancelled) setBots(data.items);
      })
      .catch((e) => logger.error('加载 Bot 列表失败', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    void loadBots();
    void loadUsage();
  }, [loadBots, loadUsage]);

  const handleSelectBot = (bot: BotType) => {
    setSelectedBot(bot);
  };

  const handleCreated = (bot: BotType) => {
    setBots((prev) => [bot, ...prev]);
    setSelectedBot(bot);
  };

  const handleDeleted = (bot: BotType) => {
    setBots((prev) => prev.filter((b) => b.id !== bot.id));
    if (selectedBot?.id === bot.id) setSelectedBot(null);
  };

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col space-y-4 px-[var(--space-apple-sm)] sm:px-5 lg:px-[var(--space-apple-lg)] py-[var(--space-apple-lg)]">
      {/* 欢迎横幅（对齐 DashboardPage：surface-primary 实底 + 内嵌快速操作栏） */}
      <div className="surface-primary rounded-[var(--radius-Apple-md)] p-[var(--space-apple-lg)] shadow-sm">
        <div className="flex flex-col gap-[var(--space-apple-md)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{t('pages.agent.title')}</h1>
            <p className="mt-1 text-sm text-white/80 hidden sm:block">{t('pages.agent.subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Bot className="h-5 w-5 text-white/90" aria-hidden="true" />
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-white/90 hover:bg-[var(--bg-secondary)]/10 hover:text-white"
              aria-label={t('pages.agent.refreshAria')}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('pages.agent.refresh')}
            </Button>
          </div>
        </div>

        {/* 快速操作栏（对齐 Dashboard 工具栏：胶囊视图切换 + ghost 风格） */}
        <div className="mt-[var(--space-apple-sm)] flex flex-wrap items-center gap-2 border-t border-white/10 pt-[var(--space-apple-sm)]">
          <div
            className="flex items-center rounded-[var(--radius-pill)] bg-black/15 overflow-hidden dark:bg-[var(--bg-secondary)]/15"
            role="tablist"
            aria-label={t('pages.agent.viewAria')}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => setView(item.view)}
                  data-testid={item.testId}
                  role="tab"
                  aria-selected={active}
                  className={`flex items-center gap-1.5 px-[var(--space-apple-md)] py-2 min-h-[44px] text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-secondary)] text-[var(--color-primary-text)] dark:bg-[var(--bg-tertiary)] dark:text-neutral-50'
                      : 'text-white/90 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phase 3：AI 用量概览（数据条卡片） */}
      {usage && (
        <div className="flex flex-wrap items-center gap-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] border border-border bg-card px-[var(--space-apple-md)] py-2.5 text-xs shadow-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-2 w-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)]" /> {t('pages.agent.usage')}
          </span>
          <span className="text-muted-foreground">
            {t('pages.agent.today')} <b className="text-foreground">{(usage.todayTokens / 1000).toFixed(1)}k</b> tokens
            · <b className="text-foreground">{usage.todayCalls}</b> {t('pages.agent.calls')}
          </span>
          <span className="text-muted-foreground">
            {t('pages.agent.week')} <b className="text-foreground">{(usage.weekTokens / 1000).toFixed(1)}k</b> tokens
          </span>
        </div>
      )}

      {/* 主内容区（Chief 工作流视图为通栏，避免卡片套卡片） */}
      <div className="flex min-h-[440px] flex-1 flex-col overflow-hidden rounded-[var(--radius-Apple-md)] border border-border bg-card">
        {view === 'bots' ? (
          <div className="flex min-h-0 flex-1 flex-col p-[var(--space-apple-md)]">
            {selectedBot ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBot(null)}
                    data-testid="bot-chat-back"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" /> {t('pages.agent.backToList')}
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <BotChatView bot={selectedBot} onOpenDetail={() => setDetailOpen(true)} />
                </div>
              </>
            ) : (
              <BotList
                bots={bots}
                loading={loading}
                onSelect={handleSelectBot}
                onRefresh={() => void loadBots()}
                onCreated={handleCreated}
              />
            )}
          </div>
        ) : view === 'chief' ? (
          <div className="min-h-0 flex-1">
            <AgentWorkflowTab />
          </div>
        ) : view === 'tasks' ? (
          <div className="min-h-0 flex-1 p-[var(--space-apple-md)]">
            <TaskCenter bots={bots} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-apple-md)]">
            <GroupChatPanel bots={bots} />
          </div>
        )}
      </div>

      <BotDetailDrawer
        bot={selectedBot}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDeleted={handleDeleted}
      />
    </div>
  );
}