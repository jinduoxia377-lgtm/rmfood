/**
 * TaskCenter — 研发任务中心（v3.3 任务驱动自动建群）
 *
 * - 新建任务对话框：输入任务描述 → 系统自动配人+建群+派单
 * - 任务列表（全部/进行中/已完成/失败/已归档）
 * - 点击任务 → 右侧展示对应任务群执行视图（复用 GroupChatView + 轮询）
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Archive, RotateCcw, UserPlus, ArrowLeft } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Badge, Textarea } from '@/components/ui';
import { BotAvatar } from './BotAvatar';
import { taskApi, groupApi } from './api';
import { GroupChatView } from './GroupChatView';
import type { Bot as BotType, GroupSession, TaskItem } from './types';

interface TaskCenterProps {
  bots: BotType[];
}

/** 任务状态 → pages.agent.taskStatus.* 的 key 后缀 */
const TASK_STATUS_KEY: Record<string, string> = {
  recruiting: 'taskStatus.recruiting',
  dispatching: 'taskStatus.dispatching',
  completed: 'taskStatus.completed',
  failed: 'taskStatus.failed',
  archived: 'taskStatus.archived',
};

export function TaskCenter({ bots }: TaskCenterProps) {
  const { t } = useTranslation();
  /** 解析任务状态为本地化标签；未知状态回退原始值 */
  const statusLabel = (status: string) =>
    TASK_STATUS_KEY[status] ? t(`pages.agent.${TASK_STATUS_KEY[status]}`) : status;
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addExpertOpen, setAddExpertOpen] = useState(false);
  const [addExpertError, setAddExpertError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const items = await taskApi.list();
      setTasks(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.taskLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    taskApi.list()
      .then((items) => {
        if (!cancelled) setTasks(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('pages.agent.taskLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const selectTask = useCallback(async (task: TaskItem) => {
    setSelected(task);
    setError(null);
    try {
      const g = await groupApi.get(task.group_id);
      setGroup(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.taskGroupLoadFailed'));
      setGroup(null);
    }
  }, [t]);

  // 任务状态自动刷新：派单中/招募中的任务每 5s 拉取最新状态，完成后停止
  useEffect(() => {
    if (!selected) return;
    if (selected.status !== 'recruiting' && selected.status !== 'dispatching') return;
    const timer = setInterval(async () => {
      try {
        const items = await taskApi.list();
        setTasks(items);
        const updated = items.find((t) => t.id === selected.id);
        if (updated) {
          setSelected(updated);
          if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'archived') {
            clearInterval(timer);
          }
        }
      } catch {
        // 轮询失败静默
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [selected]);

  const handleCreate = async () => {
    const content = taskInput.trim();
    if (!content || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await taskApi.autoTeam(content);
      setTaskInput('');
      setDialogOpen(false);
      // 用最新列表定位新任务，避免闭包中的过期 tasks 状态
      const items = await taskApi.list();
      setTasks(items);
      const created = items.find((t) => t.id === result.task_id) ?? null;
      if (created) {
        await selectTask(created);
      } else {
        // 从服务端拉最新
        const item = await taskApi.get(result.task_id);
        await selectTask(item);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.taskCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!selected) return;
    await taskApi.archive(selected.id);
    await loadTasks();
    const item = await taskApi.get(selected.id);
    setSelected(item);
  };

  const handleRestore = async () => {
    if (!selected) return;
    await taskApi.restore(selected.id);
    await loadTasks();
    const item = await taskApi.get(selected.id);
    setSelected(item);
  };

  const handleRetry = async () => {
    if (!selected) return;
    setError(null);
    try {
      await taskApi.retry(selected.id);
      await loadTasks();
      const item = await taskApi.get(selected.id);
      setSelected(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.agent.taskRetryFailed'));
    }
  };

  const handleAddExpert = async (botId: number) => {
    if (!selected) return;
    setAddExpertError(null);
    try {
      await groupApi.addMembers(selected.group_id, [botId]);
      const latest = await groupApi.get(selected.group_id);
      setGroup(latest);
    } catch (e) {
      setAddExpertError(e instanceof Error ? e.message : t('pages.agent.taskAddExpertFailed'));
    }
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const activeTask = selected ?? null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('pages.agent.taskTitle')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('pages.agent.taskSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadTasks()}
            disabled={loading}
            aria-label={t('pages.agent.refreshAria')}
            title={t('pages.agent.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="task-create-button">
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> {t('pages.agent.createTask')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
      )}

      {/* 主体 — 移动端纵向堆叠，lg+ 恢复双列 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* 任务列表列 */}
        <div className="flex w-full lg:w-[300px] lg:shrink-0 flex-col rounded-[var(--radius-Apple-md)] border border-border">
          <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
            {['all', 'recruiting', 'dispatching', 'completed', 'failed', 'archived'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {f === 'all' ? t('pages.agent.taskFilterAll') : statusLabel(f)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {t('pages.agent.taskEmpty')}
              </div>
            )}
            <div className="space-y-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void selectTask(t)}
                  className={`w-full rounded-lg border p-2 text-left transition-colors ${
                    activeTask?.id === t.id
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950'
                      : 'border-border hover:border-primary-300'
                  }`}
                  data-testid={`task-card-${t.id}`}
                >
                  <div className="text-xs font-medium text-foreground">
                    {t.task_content.length > 18 ? `${t.task_content.slice(0, 18)}…` : t.task_content}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <Badge variant={t.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                      {statusLabel(t.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString().slice(0, 16) : ''}
                    </span>
                  </div>
                  {t.status === 'failed' && t.error_message && (
                    <div className="mt-1 line-clamp-2 text-xs leading-tight text-destructive">
                      {t.error_message.slice(0, 80)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 执行视图列 */}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTask && group ? (
            <>
              {/* 返回列表（参考智能体：聊天面板上方一行） */}
              <div className="mb-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelected(null);
                    setGroup(null);
                  }}
                  data-testid="group-chat-back"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('pages.agent.taskBackToList')}
                </Button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-Apple-md)] border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{activeTask.task_content}</span>
                    <Badge className="text-xs">{statusLabel(activeTask.status)}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setAddExpertOpen(true)}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> {t('pages.agent.taskAddExpertBtn')}
                    </Button>
                    {activeTask.status !== 'archived' ? (
                      <Button variant="ghost" size="sm" onClick={() => void handleArchive()}>
                        <Archive className="mr-1 h-3.5 w-3.5" /> {t('pages.agent.taskArchive')}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void handleRestore()}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t('pages.agent.taskRestore')}
                      </Button>
                    )}
                  </div>
                </div>
                {activeTask.status === 'failed' && (
                  <div className="flex items-center justify-between border-b border-border bg-destructive/10 px-3 py-2">
                    <div className="text-xs text-destructive">
                      {t('pages.agent.taskFailReason', { msg: activeTask.error_message || t('pages.agent.taskUnknownError') })}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleRetry()}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t('pages.agent.taskRetry')}
                    </Button>
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  <GroupChatView
                    group={group}
                    bots={bots}
                    taskStatus={activeTask.status}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {t('pages.agent.taskSelectHint')}
            </div>
          )}
        </div>
      </div>

      {/* 新建任务对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('pages.agent.taskCreateTitle')}</DialogTitle>
            <DialogDescription>
              {t('pages.agent.taskCreateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 py-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">{t('pages.agent.taskDescLabel')}</span>
              <Textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={t('pages.agent.taskDescPlaceholder')}
                data-testid="task-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={creating}>
              {t('pages.agent.taskCancel')}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating || !taskInput.trim()}>
              {creating ? t('pages.agent.taskCreating') : t('pages.agent.taskCreateAndDispatch')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 追加专家对话框（P1-1） */}
      <Dialog open={addExpertOpen} onOpenChange={setAddExpertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pages.agent.taskAddExpertTitle')}</DialogTitle>
            <DialogDescription>
              {t('pages.agent.taskAddExpertDesc')}
            </DialogDescription>
          </DialogHeader>
          {addExpertError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{addExpertError}</div>
          )}
          <div className="max-h-[50vh] space-y-2 overflow-y-auto px-6 py-2">
            {(() => {
              const memberIds = new Set(group?.members.map((m) => m.bot_id) ?? []);
              const candidates = bots.filter((b) => !memberIds.has(b.id) && !b.is_chief);
              if (candidates.length === 0) {
                return <div className="py-6 text-center text-xs text-muted-foreground">{t('pages.agent.taskAddExpertEmpty')}</div>;
              }
              return candidates.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <BotAvatar bot={b} size="sm" />
                    <span className="text-foreground">{b.name}</span>
                    <span className="text-xs text-muted-foreground">{(b.capabilities || []).slice(0, 3).join(', ')}</span>
                  </div>
                  <Button size="sm" onClick={() => void handleAddExpert(b.id)}>
                    {t('pages.agent.taskAdd')}
                  </Button>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}