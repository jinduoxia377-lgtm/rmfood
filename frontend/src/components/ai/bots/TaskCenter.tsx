/**
 * TaskCenter — 研发任务中心（v3.3 任务驱动自动建群）
 *
 * - 新建任务对话框：输入任务描述 → 系统自动配人+建群+派单
 * - 任务列表（全部/进行中/已完成/失败/已归档）
 * - 点击任务 → 右侧展示对应任务群执行视图（复用 GroupChatView + 轮询）
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Archive, RotateCcw, UserPlus, ArrowLeft } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Badge, Textarea } from '@/components/ui';
import { BotAvatar } from './BotAvatar';
import { taskApi, groupApi } from './api';
import { GroupChatView } from './GroupChatView';
import type { Bot as BotType, GroupSession, TaskItem } from './types';

interface TaskCenterProps {
  bots: BotType[];
}

const STATUS_LABEL: Record<string, string> = {
  recruiting: '招募中',
  dispatching: '派单中',
  completed: '已完成',
  failed: '失败',
  archived: '已归档',
};

export function TaskCenter({ bots }: TaskCenterProps) {
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
      setError(e instanceof Error ? e.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    taskApi.list()
      .then((items) => {
        if (!cancelled) setTasks(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载任务失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectTask = useCallback(async (task: TaskItem) => {
    setSelected(task);
    setError(null);
    try {
      const g = await groupApi.get(task.group_id);
      setGroup(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载任务群失败');
      setGroup(null);
    }
  }, []);

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
      setError(e instanceof Error ? e.message : '创建任务失败');
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
      setError(e instanceof Error ? e.message : '重新派单失败');
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
      setAddExpertError(e instanceof Error ? e.message : '添加专家失败');
    }
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const activeTask = selected ?? null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">研发任务中心</h2>
          <p className="text-xs text-muted-foreground">
            提交任务 → 系统自动配齐专家、创建任务群并派单执行
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void loadTasks()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="task-create-button">
            <Plus className="mr-1 h-4 w-4" /> 创建研发任务
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
                {f === 'all' ? '全部' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                暂无任务。点击「创建研发任务」开始。
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
                    <Badge variant={t.status === 'failed' ? 'destructive' : 'secondary'} className="text-[9px]">
                      {STATUS_LABEL[t.status] || t.status}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString().slice(0, 16) : ''}
                    </span>
                  </div>
                  {t.status === 'failed' && t.error_message && (
                    <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-destructive">
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
                  返回列表
                </Button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-Apple-md)] border border-border">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{activeTask.task_content}</span>
                    <Badge className="text-[9px]">{STATUS_LABEL[activeTask.status] || activeTask.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setAddExpertOpen(true)}>
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> 追加专家
                    </Button>
                    {activeTask.status !== 'archived' ? (
                      <Button variant="ghost" size="sm" onClick={() => void handleArchive()}>
                        <Archive className="mr-1 h-3.5 w-3.5" /> 归档
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void handleRestore()}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> 恢复
                      </Button>
                    )}
                  </div>
                </div>
                {activeTask.status === 'failed' && (
                  <div className="flex items-center justify-between border-b border-border bg-destructive/10 px-3 py-2">
                    <div className="text-xs text-destructive">
                      失败原因：{activeTask.error_message || '未知错误'}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleRetry()}>
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> 重新派单
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
              选择左侧任务查看执行过程
            </div>
          )}
        </div>
      </div>

      {/* 新建任务对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>创建研发任务</DialogTitle>
            <DialogDescription>
              提交任务后，系统将自动从角色库配齐专家（必要时实时招募 AI 员工）、创建任务群并派单执行。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 py-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">任务描述 *</span>
              <Textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="如：设计一款辅助降血糖的饮品配方，并做安全性审查与药食同源合规核查。"
                data-testid="task-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating || !taskInput.trim()}>
              {creating ? '创建中…' : '创建并派单'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 追加专家对话框（P1-1） */}
      <Dialog open={addExpertOpen} onOpenChange={setAddExpertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>追加专家</DialogTitle>
            <DialogDescription>
              将团队中尚未加入的 Bot 添加到当前任务群，之后可在群聊中 @ 该专家定向派单。
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
                return <div className="py-6 text-center text-xs text-muted-foreground">没有可追加的 Bot（当前团队已包含全部可用专家）。</div>;
              }
              return candidates.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <BotAvatar bot={b} size="sm" />
                    <span className="text-foreground">{b.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(b.capabilities || []).slice(0, 3).join(', ')}</span>
                  </div>
                  <Button size="sm" onClick={() => void handleAddExpert(b.id)}>
                    添加
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